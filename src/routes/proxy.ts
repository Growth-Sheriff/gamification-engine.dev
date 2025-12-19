/**
 * Gamification Engine - Proxy Routes
 * Storefront API endpoints (called from customer-facing pages)
 * These routes are accessed via Shopify App Proxy
 */

import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { createShopifyClient } from '../lib/shopify.js';
import {
  generateFingerprint,
  parseDeviceType,
  parseBrowser,
  parseOS,
  weightedRandom,
  generateDiscountCode,
  calculateSpinAngle,
  addDays,
  formatShopifyDate,
} from '../utils/index.js';
import { nanoid } from 'nanoid';

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════
// INIT - Session başlatma (fingerprint bazlı)
// ═══════════════════════════════════════════════════════════════════════════

interface InitRequest {
  fingerprint?: string;
  page?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

/**
 * Initialize session
 * POST /api/proxy/init
 */
router.post('/init', async (req: Request, res: Response) => {
  try {
    // Get shop domain from App Proxy header or query
    const shopDomain = req.get('X-Shopify-Shop-Domain') || req.query.shop as string;

    if (!shopDomain) {
      res.status(400).json({ success: false, error: 'Missing shop domain' });
      return;
    }

    // Get shop from database
    const shop = await prisma.shop.findUnique({
      where: { domain: shopDomain },
    });

    if (!shop || !shop.isActive) {
      res.status(404).json({ success: false, error: 'Shop not found' });
      return;
    }

    const body = req.body as InitRequest;

    // Generate or use provided fingerprint
    const userAgent = req.get('User-Agent') || '';
    const acceptLanguage = req.get('Accept-Language') || '';
    const ip = req.ip || req.get('X-Forwarded-For') || 'unknown';

    const fingerprint = body.fingerprint || generateFingerprint(userAgent, acceptLanguage, ip);

    // Find or create visitor
    let visitor = await prisma.visitor.findUnique({
      where: {
        shopId_fingerprint: {
          shopId: shop.id,
          fingerprint,
        },
      },
    });

    const isNewVisitor = !visitor;

    if (!visitor) {
      visitor = await prisma.visitor.create({
        data: {
          shopId: shop.id,
          fingerprint,
          device: parseDeviceType(userAgent),
          browser: parseBrowser(userAgent),
          os: parseOS(userAgent),
          country: req.get('CF-IPCountry') || null,
        },
      });
    } else {
      // Update last visit
      await prisma.visitor.update({
        where: { id: visitor.id },
        data: { lastVisit: new Date() },
      });
    }

    // Create session
    const sessionToken = `sess_${nanoid(24)}`;

    const session = await prisma.session.create({
      data: {
        visitorId: visitor.id,
        token: sessionToken,
        currentPage: body.page,
        referrer: body.referrer,
        utmSource: body.utmSource,
        utmMedium: body.utmMedium,
        utmCampaign: body.utmCampaign,
      },
    });

    // Get active game
    const activeGame = await prisma.game.findFirst({
      where: {
        shopId: shop.id,
        isActive: true,
        OR: [
          { startDate: null },
          { startDate: { lte: new Date() } },
        ],
        AND: [
          {
            OR: [
              { endDate: null },
              { endDate: { gte: new Date() } },
            ],
          },
        ],
      },
      include: {
        segments: { orderBy: { order: 'asc' } },
      },
    });

    // Check if visitor can play
    let canPlay = false;
    let cooldownRemaining = 0;

    if (activeGame) {
      // Get discount rule for this game
      const rule = await prisma.discountRule.findFirst({
        where: {
          shopId: shop.id,
          isActive: true,
          OR: [
            { gameId: activeGame.id },
            { gameId: null },
          ],
        },
        orderBy: { createdAt: 'asc' },
      });

      if (rule) {
        // Count plays in cooldown period
        const cooldownStart = new Date();
        cooldownStart.setHours(cooldownStart.getHours() - rule.cooldownHours);

        const recentPlays = await prisma.play.count({
          where: {
            visitorId: visitor.id,
            gameId: activeGame.id,
            playedAt: { gte: cooldownStart },
          },
        });

        canPlay = recentPlays < rule.maxPlaysPerVisitor;

        if (!canPlay && recentPlays > 0) {
          // Calculate remaining cooldown
          const lastPlay = await prisma.play.findFirst({
            where: {
              visitorId: visitor.id,
              gameId: activeGame.id,
            },
            orderBy: { playedAt: 'desc' },
          });

          if (lastPlay) {
            const cooldownEnd = new Date(lastPlay.playedAt);
            cooldownEnd.setHours(cooldownEnd.getHours() + rule.cooldownHours);
            cooldownRemaining = Math.max(0, cooldownEnd.getTime() - Date.now());
          }
        }
      }
    }

    res.json({
      success: true,
      data: {
        sessionToken,
        visitorId: visitor.id,
        isNewVisitor,
        canPlay,
        cooldownRemaining,
        activeGame: activeGame ? {
          id: activeGame.id,
          type: activeGame.type,
          name: activeGame.name,
          config: activeGame.config,
          trigger: activeGame.trigger,
          triggerValue: activeGame.triggerValue,
          segments: activeGame.segments.map(seg => ({
            id: seg.id,
            label: seg.label,
            color: seg.color,
          })),
        } : null,
      },
    });
  } catch (error) {
    console.error('Proxy init error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PLAY - Oyunu oyna
// ═══════════════════════════════════════════════════════════════════════════

interface PlayRequest {
  sessionToken: string;
  gameId: string;
  email?: string;
}

/**
 * Play game
 * POST /api/proxy/play
 */
router.post('/play', async (req: Request, res: Response) => {
  try {
    const { sessionToken, gameId, email } = req.body as PlayRequest;

    if (!sessionToken || !gameId) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    // Get session
    const session = await prisma.session.findUnique({
      where: { token: sessionToken },
      include: {
        visitor: {
          include: {
            shop: true,
          },
        },
      },
    });

    if (!session || !session.isActive) {
      res.status(401).json({ success: false, error: 'Invalid session' });
      return;
    }

    const visitor = session.visitor;
    const shop = visitor.shop;

    // Get game
    const game = await prisma.game.findFirst({
      where: {
        id: gameId,
        shopId: shop.id,
        isActive: true,
      },
      include: {
        segments: { orderBy: { order: 'asc' } },
      },
    });

    if (!game) {
      res.status(404).json({ success: false, error: 'Game not found' });
      return;
    }

    // Get applicable rule
    const rule = await prisma.discountRule.findFirst({
      where: {
        shopId: shop.id,
        isActive: true,
        OR: [
          { gameId: game.id },
          { gameId: null },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!rule) {
      res.status(400).json({ success: false, error: 'No discount rule found' });
      return;
    }

    // Check if email is required
    if (rule.requireEmail && !email && !visitor.email) {
      res.status(400).json({ success: false, error: 'Email required', requireEmail: true });
      return;
    }

    // Update visitor email if provided
    if (email && !visitor.email) {
      await prisma.visitor.update({
        where: { id: visitor.id },
        data: { email },
      });
    }

    // Check cooldown
    const cooldownStart = new Date();
    cooldownStart.setHours(cooldownStart.getHours() - rule.cooldownHours);

    const recentPlays = await prisma.play.count({
      where: {
        visitorId: visitor.id,
        gameId: game.id,
        playedAt: { gte: cooldownStart },
      },
    });

    if (recentPlays >= rule.maxPlaysPerVisitor) {
      res.status(429).json({ success: false, error: 'Play limit reached' });
      return;
    }

    // Select winning segment using weighted random
    const winningSegment = weightedRandom(game.segments);

    if (!winningSegment) {
      res.status(500).json({ success: false, error: 'No segments configured' });
      return;
    }

    const isWin = winningSegment.type !== 'NO_PRIZE';
    const segmentIndex = game.segments.findIndex(s => s.id === winningSegment.id);

    // Calculate animation angle for spin wheel
    const spinAngle = game.type === 'SPIN_WHEEL'
      ? calculateSpinAngle(segmentIndex, game.segments.length)
      : 0;

    let discount = null;
    let discountCode = null;

    if (isWin) {
      // Generate discount code
      const prefix = winningSegment.type === 'PERCENTAGE'
        ? `SPIN${winningSegment.value}`
        : winningSegment.type === 'FREE_SHIPPING'
          ? 'FREESHIP'
          : `SAVE${winningSegment.value}`;

      discountCode = generateDiscountCode(prefix);

      const expiresAt = addDays(new Date(), rule.validityDays);

      // Create discount in Shopify
      const shopifyClient = createShopifyClient(shop.domain, shop.accessToken);

      let shopifyResult;

      if (winningSegment.type === 'FREE_SHIPPING') {
        shopifyResult = await shopifyClient.createDiscountCode({
          title: `Gamification: ${discountCode}`,
          code: discountCode,
          freeShipping: true,
          startsAt: formatShopifyDate(new Date()),
          endsAt: formatShopifyDate(expiresAt),
          usageLimit: rule.maxRedemptionsPerCode,
          appliesOncePerCustomer: true,
          combinesWith: {
            productDiscounts: rule.combineWithProductDiscount,
            orderDiscounts: rule.combineWithOrderDiscount,
            shippingDiscounts: false,
          },
        });
      } else if (winningSegment.type === 'PERCENTAGE') {
        shopifyResult = await shopifyClient.createDiscountCode({
          title: `Gamification: ${discountCode}`,
          code: discountCode,
          percentage: winningSegment.value,
          startsAt: formatShopifyDate(new Date()),
          endsAt: formatShopifyDate(expiresAt),
          usageLimit: rule.maxRedemptionsPerCode,
          appliesOncePerCustomer: true,
          minimumRequirement: rule.minOrderAmount
            ? { subtotal: rule.minOrderAmount }
            : undefined,
          combinesWith: {
            productDiscounts: rule.combineWithProductDiscount,
            orderDiscounts: rule.combineWithOrderDiscount,
            shippingDiscounts: rule.combineWithShipping,
          },
        });
      } else if (winningSegment.type === 'FIXED_AMOUNT') {
        shopifyResult = await shopifyClient.createDiscountCode({
          title: `Gamification: ${discountCode}`,
          code: discountCode,
          fixedAmount: winningSegment.value,
          startsAt: formatShopifyDate(new Date()),
          endsAt: formatShopifyDate(expiresAt),
          usageLimit: rule.maxRedemptionsPerCode,
          appliesOncePerCustomer: true,
          minimumRequirement: rule.minOrderAmount
            ? { subtotal: rule.minOrderAmount }
            : undefined,
          combinesWith: {
            productDiscounts: rule.combineWithProductDiscount,
            orderDiscounts: rule.combineWithOrderDiscount,
            shippingDiscounts: rule.combineWithShipping,
          },
        });
      }

      // Get Shopify discount ID
      const shopifyDiscountId = (shopifyResult as any)?.data?.discountCodeBasicCreate?.codeDiscountNode?.id
        || (shopifyResult as any)?.data?.discountCodeFreeShippingCreate?.codeDiscountNode?.id
        || null;

      // Save discount to database
      discount = await prisma.discount.create({
        data: {
          shopId: shop.id,
          visitorId: visitor.id,
          ruleId: rule.id,
          code: discountCode,
          shopifyId: shopifyDiscountId,
          type: winningSegment.type,
          value: winningSegment.value,
          expiresAt,
        },
      });
    }

    // Create play record
    const play = await prisma.play.create({
      data: {
        gameId: game.id,
        visitorId: visitor.id,
        result: isWin ? 'WIN' : 'LOSE',
        segmentId: winningSegment.id,
        prize: isWin ? {
          type: winningSegment.type,
          value: winningSegment.value,
          label: winningSegment.label,
        } : null,
        discountId: discount?.id,
      },
    });

    // Update visitor stats
    await prisma.visitor.update({
      where: { id: visitor.id },
      data: {
        totalPlays: { increment: 1 },
        totalWins: isWin ? { increment: 1 } : undefined,
      },
    });

    // Update session activity
    await prisma.session.update({
      where: { id: session.id },
      data: { lastActivityAt: new Date() },
    });

    // Update analytics (upsert for today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.analytics.upsert({
      where: {
        shopId_gameId_date: {
          shopId: shop.id,
          gameId: game.id,
          date: today,
        },
      },
      update: {
        plays: { increment: 1 },
        wins: isWin ? { increment: 1 } : undefined,
      },
      create: {
        shopId: shop.id,
        gameId: game.id,
        date: today,
        plays: 1,
        wins: isWin ? 1 : 0,
      },
    });

    res.json({
      success: true,
      data: {
        playId: play.id,
        result: isWin ? 'WIN' : 'LOSE',
        segment: {
          id: winningSegment.id,
          label: winningSegment.label,
          type: winningSegment.type,
          value: winningSegment.value,
          color: winningSegment.color,
        },
        discount: discount ? {
          code: discount.code,
          type: discount.type,
          value: discount.value,
          expiresAt: discount.expiresAt,
        } : null,
        animation: {
          angle: spinAngle,
          duration: 5000,
        },
      },
    });
  } catch (error) {
    console.error('Proxy play error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// TRACK - Event takibi
// ═══════════════════════════════════════════════════════════════════════════

interface TrackRequest {
  sessionToken: string;
  event: string;
  data?: Record<string, unknown>;
}

/**
 * Track event
 * POST /api/proxy/track
 */
router.post('/track', async (req: Request, res: Response) => {
  try {
    const { sessionToken, event, data } = req.body as TrackRequest;

    if (!sessionToken || !event) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    // Get session
    const session = await prisma.session.findUnique({
      where: { token: sessionToken },
    });

    if (!session) {
      res.status(401).json({ success: false, error: 'Invalid session' });
      return;
    }

    // Update session
    await prisma.session.update({
      where: { id: session.id },
      data: {
        lastActivityAt: new Date(),
        currentPage: (data?.page as string) || session.currentPage,
      },
    });

    // Handle specific events (analytics updates, etc.)
    // This can be extended for more detailed tracking

    res.json({ success: true });
  } catch (error) {
    console.error('Proxy track error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;

