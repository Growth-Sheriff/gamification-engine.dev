/**
 * Gamification Engine - Authentication Middleware
 * Shopify OAuth and session management
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { config } from '../config.js';
import prisma from '../lib/prisma.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      shop?: {
        id: string;
        domain: string;
        accessToken: string;
        name: string | null;
      };
    }
  }
}

/**
 * Verify Shopify HMAC signature
 */
export function verifyHmac(queryString: string, hmac: string): boolean {
  const params = new URLSearchParams(queryString);
  params.delete('hmac');
  params.sort();

  const message = params.toString();
  const generatedHash = crypto
    .createHmac('sha256', config.shopify.apiSecret)
    .update(message)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(hmac),
    Buffer.from(generatedHash)
  );
}

/**
 * Verify Shopify webhook signature
 */
export function verifyWebhook(body: string, hmacHeader: string): boolean {
  const generatedHash = crypto
    .createHmac('sha256', config.shopify.apiSecret)
    .update(body, 'utf8')
    .digest('base64');

  return crypto.timingSafeEqual(
    Buffer.from(hmacHeader),
    Buffer.from(generatedHash)
  );
}

/**
 * Authentication middleware - Requires shop session
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Check session for shop domain
    const shopDomain = req.session?.shopDomain as string | undefined;

    if (!shopDomain) {
      // No session, redirect to auth
      const shop = req.query.shop as string;
      if (shop) {
        res.redirect(`/auth?shop=${shop}`);
      } else {
        res.status(401).render('pages/error', {
          title: 'Authentication Required',
          message: 'Please install the app from your Shopify admin.',
        });
      }
      return;
    }

    // Get shop from database
    const shop = await prisma.shop.findUnique({
      where: { domain: shopDomain },
      select: {
        id: true,
        domain: true,
        accessToken: true,
        name: true,
        isActive: true,
      },
    });

    if (!shop || !shop.isActive) {
      // Shop not found or inactive
      req.session?.destroy(() => {});
      res.redirect(`/auth?shop=${shopDomain}`);
      return;
    }

    // Attach shop to request
    req.shop = {
      id: shop.id,
      domain: shop.domain,
      accessToken: shop.accessToken,
      name: shop.name,
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).render('pages/error', {
      title: 'Error',
      message: 'An error occurred during authentication.',
    });
  }
}

/**
 * API authentication middleware - For JSON API routes
 */
export async function requireApiAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const shopDomain = req.session?.shopDomain as string | undefined;

    if (!shopDomain) {
      res.status(401).json({ error: 'Unauthorized', message: 'No session found' });
      return;
    }

    const shop = await prisma.shop.findUnique({
      where: { domain: shopDomain },
      select: {
        id: true,
        domain: true,
        accessToken: true,
        name: true,
        isActive: true,
      },
    });

    if (!shop || !shop.isActive) {
      res.status(401).json({ error: 'Unauthorized', message: 'Shop not found or inactive' });
      return;
    }

    req.shop = {
      id: shop.id,
      domain: shop.domain,
      accessToken: shop.accessToken,
      name: shop.name,
    };

    next();
  } catch (error) {
    console.error('API auth middleware error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

/**
 * Webhook authentication middleware
 */
export function verifyWebhookMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const hmacHeader = req.get('X-Shopify-Hmac-Sha256');

  if (!hmacHeader) {
    res.status(401).send('Unauthorized');
    return;
  }

  // Body should be raw string for verification
  const rawBody = (req as Request & { rawBody?: string }).rawBody;

  if (!rawBody) {
    res.status(400).send('Missing body');
    return;
  }

  if (!verifyWebhook(rawBody, hmacHeader)) {
    res.status(401).send('Invalid signature');
    return;
  }

  next();
}

