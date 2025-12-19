/**
 * Gamification Engine - Auth Routes
 * Shopify OAuth 2.0 Flow
 */

import { Router, Request, Response } from 'express';
import type { Router as RouterType } from 'express';
import crypto from 'crypto';
import { config } from '../config.js';
import prisma from '../lib/prisma.js';
import { createShopifyClient } from '../lib/shopify.js';
import { verifyHmac } from '../middleware/auth.js';

const router: RouterType = Router();

/**
 * Step 1: Initiate OAuth
 * GET /auth?shop=xxx.myshopify.com
 */
router.get('/', (req: Request, res: Response) => {
  const shop = req.query.shop as string;

  if (!shop) {
    res.status(400).render('pages/error', {
      title: 'Missing Shop',
      message: 'Please provide a shop parameter.',
    });
    return;
  }

  // Validate shop domain
  if (!shop.endsWith('.myshopify.com')) {
    res.status(400).render('pages/error', {
      title: 'Invalid Shop',
      message: 'Invalid shop domain.',
    });
    return;
  }

  // Generate state for CSRF protection
  const state = crypto.randomBytes(16).toString('hex');

  // Store state in session
  if (req.session) {
    req.session.state = state;
  }

  // Build authorization URL
  const redirectUri = `${config.appUrl}/auth/callback`;
  const scopes = config.shopify.scopes.join(',');

  const authUrl = new URL(`https://${shop}/admin/oauth/authorize`);
  authUrl.searchParams.set('client_id', config.shopify.apiKey);
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);

  res.redirect(authUrl.toString());
});

/**
 * Step 2: OAuth Callback
 * GET /auth/callback
 */
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { shop, code, state, hmac } = req.query as Record<string, string>;

    // Verify state
    const storedState = req.session?.state as string | undefined;
    if (!state || state !== storedState) {
      res.status(400).render('pages/error', {
        title: 'Invalid State',
        message: 'State mismatch. Please try again.',
      });
      return;
    }

    // Verify HMAC
    const queryString = req.url.split('?')[1] || '';
    if (!hmac || !verifyHmac(queryString, hmac)) {
      res.status(400).render('pages/error', {
        title: 'Invalid Signature',
        message: 'Request signature is invalid.',
      });
      return;
    }

    // Exchange code for access token
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: config.shopify.apiKey,
        client_secret: config.shopify.apiSecret,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to get access token');
    }

    const tokenData = await tokenResponse.json() as {
      access_token: string;
      scope: string;
    };

    // Get shop info
    const shopifyClient = createShopifyClient(shop, tokenData.access_token);
    const shopInfo = await shopifyClient.getShop();

    if (shopInfo.errors) {
      throw new Error(shopInfo.errors[0].message);
    }

    // Upsert shop in database
    const shopData = await prisma.shop.upsert({
      where: { domain: shop },
      update: {
        accessToken: tokenData.access_token,
        name: shopInfo.data?.shop.name,
        email: shopInfo.data?.shop.email,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        domain: shop,
        accessToken: tokenData.access_token,
        name: shopInfo.data?.shop.name,
        email: shopInfo.data?.shop.email,
        isActive: true,
      },
    });

    // Create default game if none exists
    const existingGames = await prisma.game.count({
      where: { shopId: shopData.id },
    });

    if (existingGames === 0) {
      // Create default spin wheel
      await prisma.game.create({
        data: {
          shopId: shopData.id,
          type: 'SPIN_WHEEL',
          name: 'Şanslı Çark',
          isActive: false,
          trigger: 'TIME_ON_PAGE',
          triggerValue: 3000,
          config: {
            title: '🎡 Şanslı Çark!',
            subtitle: 'Çarkı çevir, indirim kazan!',
            buttonText: 'Çarkı Çevir',
            backgroundColor: '#ffffff',
            textColor: '#333333',
          },
          segments: {
            create: [
              { label: '%5 İndirim', type: 'PERCENTAGE', value: 5, probability: 0.30, color: '#7367F0', order: 0 },
              { label: '%10 İndirim', type: 'PERCENTAGE', value: 10, probability: 0.25, color: '#28C76F', order: 1 },
              { label: 'Şanssız', type: 'NO_PRIZE', value: 0, probability: 0.20, color: '#82868B', order: 2 },
              { label: '%15 İndirim', type: 'PERCENTAGE', value: 15, probability: 0.15, color: '#FF9F43', order: 3 },
              { label: '%20 İndirim', type: 'PERCENTAGE', value: 20, probability: 0.08, color: '#EA5455', order: 4 },
              { label: 'Ücretsiz Kargo', type: 'FREE_SHIPPING', value: 0, probability: 0.02, color: '#00CFE8', order: 5 },
            ],
          },
        },
      });

      // Create default discount rule
      await prisma.discountRule.create({
        data: {
          shopId: shopData.id,
          name: 'Varsayılan Kural',
          isActive: true,
          maxPlaysPerVisitor: 1,
          maxWinsPerVisitor: 1,
          cooldownHours: 24,
          validityDays: 7,
        },
      });
    }

    // Set session
    if (req.session) {
      req.session.shopDomain = shop;
      delete req.session.state;
    }

    // Redirect to dashboard
    res.redirect('/');

  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).render('pages/error', {
      title: 'Error',
      message: 'Failed to complete authentication.',
    });
  }
});

/**
 * Logout
 * POST /auth/logout
 */
router.post('/logout', (req: Request, res: Response) => {
  req.session?.destroy((err) => {
    if (err) {
      console.error('Session destroy error:', err);
    }
    res.redirect('/');
  });
});

export default router;

