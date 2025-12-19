/**
 * Gamification Engine - Proxy Routes
 * Storefront API endpoints (called from customer-facing pages)
 * These routes are accessed via Shopify App Proxy
 */

import { Router, Request, Response } from 'express';
import type { Router as RouterType } from 'express';
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
import { Prisma } from '@prisma/client';

const router: RouterType = Router();

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
    // Get shop domain from App Proxy header, query, or body
    const shopDomain = req.get('X-Shopify-Shop-Domain') ||
                       req.query.shop as string ||
                       req.body?.shop as string;

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

    const _session = await prisma.session.create({
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
    let activeGame = await prisma.game.findFirst({
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

    // ═══════════════════════════════════════════════════════════════════════
    // TARGETING RULE EVALUATION
    // ═══════════════════════════════════════════════════════════════════════

    let targetedGameId: string | null = null;

    // Get all active targeting rules for this shop
    const targetingRules = await prisma.targetingRule.findMany({
      where: {
        shopId: shop.id,
        isActive: true,
      },
      orderBy: { priority: 'desc' },
    });

    // Evaluate each rule
    for (const rule of targetingRules) {
      let matches = true;

      // Page type check
      if (rule.pageType && rule.pageType.length > 0) {
        const pageType = body.page?.includes('/products/') ? 'product' :
                        body.page?.includes('/collections/') ? 'collection' :
                        body.page === '/' ? 'index' :
                        body.page?.includes('/cart') ? 'cart' : 'page';
        if (!rule.pageType.includes(pageType)) {
          matches = false;
        }
      }

      // Device check
      if (matches && rule.devices && rule.devices.length > 0) {
        if (!rule.devices.includes(visitor.device || 'desktop')) {
          matches = false;
        }
      }

      // Visitor type check
      if (matches && rule.visitorType !== 'ALL') {
        const isNew = isNewVisitor;
        const isCustomer = !!visitor.customerId;
        const isLoggedIn = !!visitor.email;

        switch (rule.visitorType) {
          case 'NEW':
            if (!isNew) matches = false;
            break;
          case 'RETURNING':
            if (isNew) matches = false;
            break;
          case 'CUSTOMERS':
            if (!isCustomer) matches = false;
            break;
          case 'NON_CUSTOMERS':
            if (isCustomer) matches = false;
            break;
          case 'LOGGED_IN':
            if (!isLoggedIn) matches = false;
            break;
          case 'NOT_LOGGED_IN':
            if (isLoggedIn) matches = false;
            break;
        }
      }

      // Traffic source check
      if (matches && rule.trafficSource && rule.trafficSource.length > 0) {
        const source = body.utmSource ? 'paid' :
                      body.referrer?.includes('google') ? 'organic' :
                      body.referrer?.includes('facebook') || body.referrer?.includes('instagram') ? 'social' :
                      !body.referrer ? 'direct' : 'referral';
        if (!rule.trafficSource.includes(source)) {
          matches = false;
        }
      }

      // UTM checks
      if (matches && rule.utmSource && rule.utmSource.length > 0 && body.utmSource) {
        if (!rule.utmSource.includes(body.utmSource)) {
          matches = false;
        }
      }

      // Schedule check
      if (matches && rule.scheduleEnabled) {
        const now = new Date();
        const currentDay = now.getDay();
        const currentHour = now.getHours();

        if (rule.scheduleDays && rule.scheduleDays.length > 0) {
          if (!rule.scheduleDays.includes(currentDay)) {
            matches = false;
          }
        }

        if (matches && rule.scheduleStartHour !== null && rule.scheduleEndHour !== null) {
          if (currentHour < rule.scheduleStartHour || currentHour > rule.scheduleEndHour) {
            matches = false;
          }
        }
      }

      // If rule matches, use this game
      if (matches) {
        targetedGameId = rule.gameId;
        break;
      }
    }

    // If targeting found a game, override activeGame
    if (targetedGameId && (!activeGame || activeGame.id !== targetedGameId)) {
      const targetedGame = await prisma.game.findFirst({
        where: {
          id: targetedGameId,
          shopId: shop.id,
          isActive: true,
        },
        include: {
          segments: { orderBy: { order: 'asc' } },
        },
      });

      if (targetedGame) {
        activeGame = targetedGame;
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
        } : Prisma.JsonNull,
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

// ═══════════════════════════════════════════════════════════════════════════
// CLAIM - Email ile indirim kodunu talep et
// ═══════════════════════════════════════════════════════════════════════════

interface ClaimRequest {
  sessionToken: string;
  discountId: string;
  email: string;
}

router.post('/claim', async (req: Request, res: Response) => {
  try {
    const { sessionToken, discountId, email } = req.body as ClaimRequest;

    if (!sessionToken || !discountId || !email) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ success: false, error: 'Invalid email format' });
      return;
    }

    const session = await prisma.session.findUnique({
      where: { token: sessionToken },
      include: { visitor: true },
    });

    if (!session || !session.isActive) {
      res.status(401).json({ success: false, error: 'Invalid session' });
      return;
    }

    const discount = await prisma.discount.findUnique({
      where: { id: discountId },
    });

    if (!discount) {
      res.status(404).json({ success: false, error: 'Discount not found' });
      return;
    }

    if (discount.visitorId !== session.visitorId) {
      res.status(403).json({ success: false, error: 'Unauthorized' });
      return;
    }

    await prisma.visitor.update({
      where: { id: session.visitorId },
      data: { email },
    });

    res.json({
      success: true,
      data: {
        code: discount.code,
        type: discount.type,
        value: discount.value,
        expiresAt: discount.expiresAt,
      },
    });
  } catch (error) {
    console.error('Proxy claim error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// VERIFY - İndirim kodunu doğrula
// ═══════════════════════════════════════════════════════════════════════════

interface VerifyRequest {
  code: string;
  shop?: string;
}

router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { code } = req.body as VerifyRequest;
    const shopDomain = req.get('X-Shopify-Shop-Domain') ||
                       req.query.shop as string ||
                       req.body?.shop as string;

    if (!code) {
      res.status(400).json({ success: false, error: 'Missing discount code' });
      return;
    }

    const discount = await prisma.discount.findFirst({
      where: shopDomain ? {
        code: code.toUpperCase(),
        shop: { domain: shopDomain },
      } : {
        code: code.toUpperCase(),
      },
      include: { rule: true },
    });

    if (!discount) {
      res.json({ success: true, data: { valid: false, reason: 'Code not found' } });
      return;
    }

    if (discount.status === 'USED') {
      res.json({ success: true, data: { valid: false, reason: 'Code already used' } });
      return;
    }

    if (discount.status === 'EXPIRED' || new Date() > discount.expiresAt) {
      res.json({ success: true, data: { valid: false, reason: 'Code expired' } });
      return;
    }

    res.json({
      success: true,
      data: {
        valid: true,
        code: discount.code,
        type: discount.type,
        value: discount.value,
        expiresAt: discount.expiresAt,
        minOrderAmount: discount.rule?.minOrderAmount,
      },
    });
  } catch (error) {
    console.error('Proxy verify error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// STATUS - Session durumunu kontrol et
// ═══════════════════════════════════════════════════════════════════════════

interface StatusRequest {
  sessionToken: string;
}

router.post('/status', async (req: Request, res: Response) => {
  try {
    const { sessionToken } = req.body as StatusRequest;

    if (!sessionToken) {
      res.status(400).json({ success: false, error: 'Missing session token' });
      return;
    }

    const session = await prisma.session.findUnique({
      where: { token: sessionToken },
      include: {
        visitor: {
          include: {
            shop: true,
            plays: {
              orderBy: { playedAt: 'desc' },
              take: 5,
              include: { game: true, discount: true },
            },
            discounts: {
              where: { status: 'CREATED' },
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
        },
      },
    });

    if (!session) {
      res.status(404).json({ success: false, error: 'Session not found' });
      return;
    }

    const visitor = session.visitor;

    const activeGame = await prisma.game.findFirst({
      where: { shopId: visitor.shopId, isActive: true },
    });

    let canPlay = false;
    if (activeGame) {
      const rule = await prisma.discountRule.findFirst({
        where: {
          shopId: visitor.shopId,
          isActive: true,
          OR: [{ gameId: activeGame.id }, { gameId: null }],
        },
      });

      if (rule) {
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
      }
    }

    res.json({
      success: true,
      data: {
        sessionActive: session.isActive,
        visitor: {
          id: visitor.id,
          email: visitor.email,
          totalPlays: visitor.totalPlays,
          totalWins: visitor.totalWins,
        },
        canPlay,
        activeGame: activeGame ? { id: activeGame.id, type: activeGame.type, name: activeGame.name } : null,
        recentPlays: visitor.plays.map(p => ({
          id: p.id,
          game: p.game.name,
          result: p.result,
          playedAt: p.playedAt,
          discount: p.discount ? { code: p.discount.code, status: p.discount.status } : null,
        })),
        activeDiscounts: visitor.discounts.map(d => ({
          code: d.code,
          type: d.type,
          value: d.value,
          expiresAt: d.expiresAt,
        })),
      },
    });
  } catch (error) {
    console.error('Proxy status error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GAME - Aktif oyun ayarlarını al (public)
// ═══════════════════════════════════════════════════════════════════════════

router.get('/game', async (req: Request, res: Response) => {
  try {
    const shopDomain = req.get('X-Shopify-Shop-Domain') || req.query.shop as string;

    if (!shopDomain) {
      res.status(400).json({ success: false, error: 'Missing shop domain' });
      return;
    }

    const shop = await prisma.shop.findUnique({
      where: { domain: shopDomain },
    });

    if (!shop || !shop.isActive) {
      res.status(404).json({ success: false, error: 'Shop not found' });
      return;
    }

    const activeGame = await prisma.game.findFirst({
      where: {
        shopId: shop.id,
        isActive: true,
        OR: [{ startDate: null }, { startDate: { lte: new Date() } }],
        AND: [{ OR: [{ endDate: null }, { endDate: { gte: new Date() } }] }],
      },
      include: {
        segments: {
          orderBy: { order: 'asc' },
          select: { id: true, label: true, color: true },
        },
      },
    });

    if (!activeGame) {
      res.json({ success: true, data: null });
      return;
    }

    res.json({
      success: true,
      data: {
        id: activeGame.id,
        type: activeGame.type,
        name: activeGame.name,
        config: activeGame.config,
        trigger: activeGame.trigger,
        triggerValue: activeGame.triggerValue,
        showOnPages: activeGame.showOnPages,
        segments: activeGame.segments,
      },
    });
  } catch (error) {
    console.error('Proxy game error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// LOYALTY - Müşteri sadakat puanları
// ═══════════════════════════════════════════════════════════════════════════

interface LoyaltyBalanceRequest {
  shop: string;
  customerId?: string;
  email?: string;
}

/**
 * Get loyalty balance
 * POST /api/proxy/loyalty/balance
 */
router.post('/loyalty/balance', async (req: Request, res: Response) => {
  try {
    const { shop: shopDomain, customerId, email } = req.body as LoyaltyBalanceRequest;

    if (!shopDomain) {
      res.status(400).json({ success: false, error: 'Missing shop domain' });
      return;
    }

    const shop = await prisma.shop.findUnique({
      where: { domain: shopDomain },
      include: { loyaltyProgram: { include: { tiers: { orderBy: { minPoints: 'asc' } } } } },
    });

    if (!shop || !shop.isActive || !shop.loyaltyProgram?.isActive) {
      res.status(404).json({ success: false, error: 'Loyalty program not found' });
      return;
    }

    // Find visitor by customerId or email
    let visitor = null;
    if (customerId) {
      visitor = await prisma.visitor.findFirst({
        where: { shopId: shop.id, customerId },
      });
    }
    if (!visitor && email) {
      visitor = await prisma.visitor.findFirst({
        where: { shopId: shop.id, email },
      });
    }

    if (!visitor) {
      // Return zero balance for new customers
      res.json({
        success: true,
        data: {
          points: 0,
          tier: shop.loyaltyProgram.tiers[0]?.name || 'Bronze',
          tierColor: shop.loyaltyProgram.tiers[0]?.color || '#CD7F32',
          nextTier: shop.loyaltyProgram.tiers[1]?.name || null,
          pointsToNext: shop.loyaltyProgram.tiers[1]?.minPoints || 0,
        },
      });
      return;
    }

    // Get loyalty points
    const loyaltyPoints = await prisma.loyaltyPoints.findUnique({
      where: { visitorId_shopId: { visitorId: visitor.id, shopId: shop.id } },
    });

    const points = loyaltyPoints?.points || 0;
    const tiers = shop.loyaltyProgram.tiers;

    // Determine current tier
    let currentTier = tiers[0];
    let nextTier = tiers[1] || null;

    for (let i = tiers.length - 1; i >= 0; i--) {
      if (points >= tiers[i].minPoints) {
        currentTier = tiers[i];
        nextTier = tiers[i + 1] || null;
        break;
      }
    }

    res.json({
      success: true,
      data: {
        points,
        lifetimePoints: loyaltyPoints?.lifetimePoints || 0,
        tier: currentTier.name,
        tierColor: currentTier.color,
        tierMultiplier: currentTier.pointMultiplier,
        freeShipping: currentTier.freeShipping,
        nextTier: nextTier?.name || null,
        pointsToNext: nextTier ? Math.max(0, nextTier.minPoints - points) : 0,
      },
    });
  } catch (error) {
    console.error('Loyalty balance error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Get loyalty history
 * POST /api/proxy/loyalty/history
 */
router.post('/loyalty/history', async (req: Request, res: Response) => {
  try {
    const { shop: shopDomain, customerId, email } = req.body as LoyaltyBalanceRequest;

    if (!shopDomain) {
      res.status(400).json({ success: false, error: 'Missing shop domain' });
      return;
    }

    const shop = await prisma.shop.findUnique({
      where: { domain: shopDomain },
    });

    if (!shop) {
      res.status(404).json({ success: false, error: 'Shop not found' });
      return;
    }

    // Find visitor
    let visitor = null;
    if (customerId) {
      visitor = await prisma.visitor.findFirst({
        where: { shopId: shop.id, customerId },
      });
    }
    if (!visitor && email) {
      visitor = await prisma.visitor.findFirst({
        where: { shopId: shop.id, email },
      });
    }

    if (!visitor) {
      res.json({ success: true, data: [] });
      return;
    }

    const loyaltyPoints = await prisma.loyaltyPoints.findUnique({
      where: { visitorId_shopId: { visitorId: visitor.id, shopId: shop.id } },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    res.json({
      success: true,
      data: loyaltyPoints?.transactions || [],
    });
  } catch (error) {
    console.error('Loyalty history error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// REFERRAL - Arkadaş getir
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get or create referral code
 * POST /api/proxy/referral/code
 */
router.post('/referral/code', async (req: Request, res: Response) => {
  try {
    const { shop: shopDomain, customerId, email } = req.body;

    if (!shopDomain || (!customerId && !email)) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    const shop = await prisma.shop.findUnique({
      where: { domain: shopDomain },
      include: { referralProgram: true },
    });

    if (!shop || !shop.referralProgram?.isActive) {
      res.status(404).json({ success: false, error: 'Referral program not found' });
      return;
    }

    // Find or create visitor
    let visitor = await prisma.visitor.findFirst({
      where: {
        shopId: shop.id,
        OR: [
          { customerId: customerId || undefined },
          { email: email || undefined },
        ],
      },
    });

    if (!visitor) {
      res.status(404).json({ success: false, error: 'Customer not found' });
      return;
    }

    // Check for existing referral code
    let referral = await prisma.referral.findFirst({
      where: {
        programId: shop.referralProgram.id,
        referrerVisitorId: visitor.id,
      },
    });

    if (!referral) {
      // Generate unique code
      const code = `REF-${nanoid(8).toUpperCase()}`;

      referral = await prisma.referral.create({
        data: {
          programId: shop.referralProgram.id,
          referrerVisitorId: visitor.id,
          code,
        },
      });
    }

    res.json({
      success: true,
      data: {
        code: referral.code,
        shareUrl: `https://${shopDomain}?ref=${referral.code}`,
        referrerReward: shop.referralProgram.referrerValue,
        refereeReward: shop.referralProgram.refereeValue,
      },
    });
  } catch (error) {
    console.error('Referral code error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Apply referral code
 * POST /api/proxy/referral/apply
 */
router.post('/referral/apply', async (req: Request, res: Response) => {
  try {
    const { shop: shopDomain, code, email } = req.body;

    if (!shopDomain || !code || !email) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    const shop = await prisma.shop.findUnique({
      where: { domain: shopDomain },
      include: { referralProgram: true },
    });

    if (!shop || !shop.referralProgram?.isActive) {
      res.status(404).json({ success: false, error: 'Referral program not found' });
      return;
    }

    // Find referral
    const referral = await prisma.referral.findUnique({
      where: { code },
    });

    if (!referral || referral.programId !== shop.referralProgram.id) {
      res.status(404).json({ success: false, error: 'Invalid referral code' });
      return;
    }

    if (referral.refereeVisitorId) {
      res.status(400).json({ success: false, error: 'Referral code already used' });
      return;
    }

    // Find or create referee visitor
    let referee = await prisma.visitor.findFirst({
      where: { shopId: shop.id, email },
    });

    if (!referee) {
      referee = await prisma.visitor.create({
        data: {
          shopId: shop.id,
          email,
          fingerprint: `email_${email}`,
        },
      });
    }

    // Check if referee is the same as referrer
    if (referee.id === referral.referrerVisitorId) {
      res.status(400).json({ success: false, error: 'Cannot use your own referral code' });
      return;
    }

    // Update referral
    await prisma.referral.update({
      where: { id: referral.id },
      data: {
        refereeVisitorId: referee.id,
        refereeRewarded: true, // Give immediate reward
      },
    });

    res.json({
      success: true,
      data: {
        reward: shop.referralProgram.refereeValue,
        rewardType: shop.referralProgram.refereeReward,
        message: `Tebrikler! ${shop.referralProgram.refereeValue} ${shop.referralProgram.refereeReward === 'POINTS' ? 'puan' : 'TL indirim'} kazandınız!`,
      },
    });
  } catch (error) {
    console.error('Referral apply error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;

