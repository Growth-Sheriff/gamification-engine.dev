/**
 * Gamification Engine - API Routes
 * JSON API endpoints for AJAX calls
 */

import { Router, Request, Response } from 'express';
import type { Router as RouterType } from 'express';
import { requireApiAuth } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

const router: RouterType = Router();

// All API routes require authentication
router.use(requireApiAuth);

// ═══════════════════════════════════════════════════════════════════════════
// GAMES API
// ═══════════════════════════════════════════════════════════════════════════

// Game create schema
const createGameSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['SPIN_WHEEL', 'SCRATCH_CARD', 'POPUP']),
  isActive: z.boolean().optional(),
  trigger: z.enum(['PAGE_LOAD', 'TIME_ON_PAGE', 'SCROLL_DEPTH', 'EXIT_INTENT']).optional(),
  triggerValue: z.number().min(0).optional(),
  showOnPages: z.array(z.string()).optional(),
  config: z.record(z.unknown()).optional(),
  segments: z.array(z.object({
    label: z.string(),
    type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING', 'NO_PRIZE']),
    value: z.number(),
    probability: z.number(),
    color: z.string().optional(),
  })).optional(),
});

/**
 * Create game
 * POST /api/games
 */
router.post('/games', async (req: Request, res: Response) => {
  try {
    const shopId = req.shop!.id;
    const parsed = createGameSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Invalid data', details: parsed.error.flatten() });
      return;
    }

    const { segments, ...gameData } = parsed.data;

    const game = await prisma.game.create({
      data: {
        shopId,
        ...gameData,
        config: gameData.config as Prisma.InputJsonValue || {},
        segments: segments ? {
          create: segments.map((seg, index) => ({
            label: seg.label,
            type: seg.type,
            value: seg.value,
            probability: seg.probability,
            color: seg.color || '#7367f0',
            order: index,
          })),
        } : undefined,
      },
      include: {
        segments: { orderBy: { order: 'asc' } },
      },
    });

    res.json({ success: true, data: game });
  } catch (error) {
    console.error('Create game error:', error);
    res.status(500).json({ success: false, error: 'Failed to create game' });
  }
});

/**
 * Get all games
 * GET /api/games
 */
router.get('/games', async (req: Request, res: Response) => {
  try {
    const shopId = req.shop!.id;

    const games = await prisma.game.findMany({
      where: { shopId },
      include: {
        segments: { orderBy: { order: 'asc' } },
        _count: { select: { plays: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: games });
  } catch (error) {
    console.error('Get games error:', error);
    res.status(500).json({ success: false, error: 'Failed to get games' });
  }
});

/**
 * Get single game
 * GET /api/games/:id
 */
router.get('/games/:id', async (req: Request, res: Response) => {
  try {
    const shopId = req.shop!.id;

    const game = await prisma.game.findFirst({
      where: { id: req.params.id, shopId },
      include: {
        segments: { orderBy: { order: 'asc' } },
        rules: true,
      },
    });

    if (!game) {
      res.status(404).json({ success: false, error: 'Game not found' });
      return;
    }

    res.json({ success: true, data: game });
  } catch (error) {
    console.error('Get game error:', error);
    res.status(500).json({ success: false, error: 'Failed to get game' });
  }
});

// Game update schema
const updateGameSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  trigger: z.enum(['PAGE_LOAD', 'TIME_ON_PAGE', 'SCROLL_DEPTH', 'EXIT_INTENT']).optional(),
  triggerValue: z.number().min(0).optional(),
  showOnPages: z.array(z.string()).optional(),
  config: z.record(z.unknown()).optional(),
});

/**
 * Update game
 * PUT /api/games/:id
 */
router.put('/games/:id', async (req: Request, res: Response) => {
  try {
    const shopId = req.shop!.id;
    const parsed = updateGameSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Invalid data', details: parsed.error.flatten() });
      return;
    }

    const game = await prisma.game.findFirst({
      where: { id: req.params.id, shopId },
    });

    if (!game) {
      res.status(404).json({ success: false, error: 'Game not found' });
      return;
    }

    const updated = await prisma.game.update({
      where: { id: req.params.id },
      data: {
        ...parsed.data,
        config: parsed.data.config as Prisma.InputJsonValue,
      },
      include: {
        segments: { orderBy: { order: 'asc' } },
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update game error:', error);
    res.status(500).json({ success: false, error: 'Failed to update game' });
  }
});

/**
 * Toggle game active status
 * PUT /api/games/:id/toggle
 */
router.put('/games/:id/toggle', async (req: Request, res: Response) => {
  try {
    const shopId = req.shop!.id;

    const game = await prisma.game.findFirst({
      where: { id: req.params.id, shopId },
    });

    if (!game) {
      res.status(404).json({ success: false, error: 'Game not found' });
      return;
    }

    const updated = await prisma.game.update({
      where: { id: req.params.id },
      data: { isActive: !game.isActive },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Toggle game error:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle game' });
  }
});

// Segment schema
const segmentSchema = z.object({
  label: z.string().min(1),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING', 'NO_PRIZE']),
  value: z.number().min(0),
  probability: z.number().min(0).max(1),
  color: z.string(),
  order: z.number().optional(),
});

/**
 * Update game segments
 * PUT /api/games/:id/segments
 */
router.put('/games/:id/segments', async (req: Request, res: Response) => {
  try {
    const shopId = req.shop!.id;
    const segments = z.array(segmentSchema).safeParse(req.body.segments);

    if (!segments.success) {
      res.status(400).json({ success: false, error: 'Invalid segments', details: segments.error.flatten() });
      return;
    }

    const game = await prisma.game.findFirst({
      where: { id: req.params.id, shopId },
    });

    if (!game) {
      res.status(404).json({ success: false, error: 'Game not found' });
      return;
    }

    // Delete existing segments and create new ones
    await prisma.$transaction([
      prisma.gameSegment.deleteMany({ where: { gameId: game.id } }),
      prisma.gameSegment.createMany({
        data: segments.data.map((seg, index) => ({
          gameId: game.id,
          label: seg.label,
          type: seg.type,
          value: seg.value,
          probability: seg.probability,
          color: seg.color,
          order: seg.order ?? index,
        })),
      }),
    ]);

    const updated = await prisma.game.findUnique({
      where: { id: game.id },
      include: { segments: { orderBy: { order: 'asc' } } },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update segments error:', error);
    res.status(500).json({ success: false, error: 'Failed to update segments' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DISCOUNT RULES API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get all rules
 * GET /api/rules
 */
router.get('/rules', async (req: Request, res: Response) => {
  try {
    const shopId = req.shop!.id;

    const rules = await prisma.discountRule.findMany({
      where: { shopId },
      include: {
        game: { select: { name: true, type: true } },
        _count: { select: { discounts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: rules });
  } catch (error) {
    console.error('Get rules error:', error);
    res.status(500).json({ success: false, error: 'Failed to get rules' });
  }
});

// Rule schema
const ruleSchema = z.object({
  name: z.string().min(1),
  gameId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  maxPlaysPerVisitor: z.number().min(1).optional(),
  maxWinsPerVisitor: z.number().min(1).optional(),
  cooldownHours: z.number().min(0).optional(),
  requireEmail: z.boolean().optional(),
  appliesTo: z.enum(['ALL', 'SPECIFIC_PRODUCTS', 'SPECIFIC_COLLECTIONS']).optional(),
  productIds: z.array(z.string()).optional(),
  collectionIds: z.array(z.string()).optional(),
  excludeProductIds: z.array(z.string()).optional(),
  excludeSaleItems: z.boolean().optional(),
  maxTotalRedemptions: z.number().nullable().optional(),
  maxRedemptionsPerCode: z.number().min(1).optional(),
  minOrderAmount: z.number().nullable().optional(),
  maxDiscountAmount: z.number().nullable().optional(),
  combineWithProductDiscount: z.boolean().optional(),
  combineWithOrderDiscount: z.boolean().optional(),
  combineWithShipping: z.boolean().optional(),
  validityDays: z.number().min(1).optional(),
});

/**
 * Create rule
 * POST /api/rules
 */
router.post('/rules', async (req: Request, res: Response) => {
  try {
    const shopId = req.shop!.id;
    const parsed = ruleSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Invalid data', details: parsed.error.flatten() });
      return;
    }

    const rule = await prisma.discountRule.create({
      data: {
        shopId,
        ...parsed.data,
      },
    });

    res.json({ success: true, data: rule });
  } catch (error) {
    console.error('Create rule error:', error);
    res.status(500).json({ success: false, error: 'Failed to create rule' });
  }
});

/**
 * Update rule
 * PUT /api/rules/:id
 */
router.put('/rules/:id', async (req: Request, res: Response) => {
  try {
    const shopId = req.shop!.id;
    const parsed = ruleSchema.partial().safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Invalid data', details: parsed.error.flatten() });
      return;
    }

    const rule = await prisma.discountRule.findFirst({
      where: { id: req.params.id, shopId },
    });

    if (!rule) {
      res.status(404).json({ success: false, error: 'Rule not found' });
      return;
    }

    const updated = await prisma.discountRule.update({
      where: { id: req.params.id },
      data: parsed.data,
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update rule error:', error);
    res.status(500).json({ success: false, error: 'Failed to update rule' });
  }
});

/**
 * Delete rule
 * DELETE /api/rules/:id
 */
router.delete('/rules/:id', async (req: Request, res: Response) => {
  try {
    const shopId = req.shop!.id;

    const rule = await prisma.discountRule.findFirst({
      where: { id: req.params.id, shopId },
    });

    if (!rule) {
      res.status(404).json({ success: false, error: 'Rule not found' });
      return;
    }

    await prisma.discountRule.delete({
      where: { id: req.params.id },
    });

    res.json({ success: true, message: 'Rule deleted' });
  } catch (error) {
    console.error('Delete rule error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete rule' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DISCOUNTS API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get all discounts
 * GET /api/discounts
 */
router.get('/discounts', async (req: Request, res: Response) => {
  try {
    const shopId = req.shop!.id;
    const status = req.query.status as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const where: Record<string, unknown> = { shopId };
    if (status) {
      where.status = status;
    }

    const [discounts, total] = await Promise.all([
      prisma.discount.findMany({
        where,
        include: {
          visitor: { select: { fingerprint: true, email: true } },
          rule: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.discount.count({ where }),
    ]);

    res.json({
      success: true,
      data: discounts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get discounts error:', error);
    res.status(500).json({ success: false, error: 'Failed to get discounts' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ANALYTICS API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get analytics
 * GET /api/analytics
 */
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const shopId = req.shop!.id;
    const days = parseInt(req.query.days as string) || 30;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const analytics = await prisma.analytics.findMany({
      where: {
        shopId,
        date: { gte: startDate },
      },
      orderBy: { date: 'asc' },
    });

    // Calculate totals
    const totals = analytics.reduce(
      (acc, day) => ({
        views: acc.views + day.views,
        plays: acc.plays + day.plays,
        wins: acc.wins + day.wins,
        claims: acc.claims + day.claims,
        redemptions: acc.redemptions + day.redemptions,
        revenue: acc.revenue + day.revenue,
      }),
      { views: 0, plays: 0, wins: 0, claims: 0, redemptions: 0, revenue: 0 }
    );

    res.json({
      success: true,
      data: {
        daily: analytics,
        totals,
        period: { start: startDate, end: new Date(), days },
      },
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ success: false, error: 'Failed to get analytics' });
  }
});

/**
 * Get chart data
 * GET /api/analytics/chart
 */
router.get('/analytics/chart', async (req: Request, res: Response) => {
  try {
    const shopId = req.shop!.id;
    const days = parseInt(req.query.days as string) || 7;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const analytics = await prisma.analytics.findMany({
      where: {
        shopId,
        date: { gte: startDate },
      },
      orderBy: { date: 'asc' },
    });

    const labels = analytics.map(a => a.date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }));
    const plays = analytics.map(a => a.plays);
    const wins = analytics.map(a => a.wins);

    res.json({
      success: true,
      data: { labels, plays, wins },
    });
  } catch (error) {
    console.error('Get chart data error:', error);
    res.status(500).json({ success: false, error: 'Failed to get chart data' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SEGMENTS API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Add segment to game
 * POST /api/games/:id/segments
 */
router.post('/games/:id/segments', async (req: Request, res: Response) => {
  try {
    const shopId = req.shop!.id;
    const gameId = req.params.id;

    const game = await prisma.game.findFirst({
      where: { id: gameId, shopId },
      include: { segments: true },
    });

    if (!game) {
      res.status(404).json({ success: false, error: 'Game not found' });
      return;
    }

    const { label, type, value, probability, color } = req.body;

    const segment = await prisma.gameSegment.create({
      data: {
        gameId,
        label,
        type,
        value: parseFloat(value) || 0,
        probability: parseFloat(probability) || 0.1,
        color: color || '#7367f0',
        order: game.segments.length,
      },
    });

    res.json({ success: true, data: segment });
  } catch (error) {
    console.error('Add segment error:', error);
    res.status(500).json({ success: false, error: 'Failed to add segment' });
  }
});

/**
 * Update segment
 * PUT /api/games/:id/segments/:segmentId
 */
router.put('/games/:id/segments/:segmentId', async (req: Request, res: Response) => {
  try {
    const shopId = req.shop!.id;
    const { id: gameId, segmentId } = req.params;

    const game = await prisma.game.findFirst({
      where: { id: gameId, shopId },
    });

    if (!game) {
      res.status(404).json({ success: false, error: 'Game not found' });
      return;
    }

    const { label, type, value, probability, color } = req.body;

    const segment = await prisma.gameSegment.update({
      where: { id: segmentId },
      data: {
        label,
        type,
        value: parseFloat(value) || 0,
        probability: parseFloat(probability) || 0.1,
        color,
      },
    });

    res.json({ success: true, data: segment });
  } catch (error) {
    console.error('Update segment error:', error);
    res.status(500).json({ success: false, error: 'Failed to update segment' });
  }
});

/**
 * Delete segment
 * DELETE /api/games/:id/segments/:segmentId
 */
router.delete('/games/:id/segments/:segmentId', async (req: Request, res: Response) => {
  try {
    const shopId = req.shop!.id;
    const { id: gameId, segmentId } = req.params;

    const game = await prisma.game.findFirst({
      where: { id: gameId, shopId },
    });

    if (!game) {
      res.status(404).json({ success: false, error: 'Game not found' });
      return;
    }

    await prisma.gameSegment.delete({
      where: { id: segmentId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete segment error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete segment' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Update shop settings
 * PUT /api/settings
 */
router.put('/settings', async (req: Request, res: Response) => {
  try {
    const shopId = req.shop!.id;
    const { name, email } = req.body;

    const shop = await prisma.shop.update({
      where: { id: shopId },
      data: { name, email },
    });

    res.json({ success: true, data: shop });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
});

/**
 * Update general settings
 * PUT /api/settings/general
 */
router.put('/settings/general', async (req: Request, res: Response) => {
  try {
    // TODO: Store general settings in a settings table or shop config JSON
    res.json({ success: true });
  } catch (error) {
    console.error('Update general settings error:', error);
    res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
});

/**
 * Delete all data
 * DELETE /api/data/all
 */
router.delete('/data/all', async (req: Request, res: Response) => {
  try {
    const shopId = req.shop!.id;

    // Delete in order (due to foreign keys)
    await prisma.discount.deleteMany({ where: { shopId } });
    await prisma.play.deleteMany({ where: { visitor: { shopId } } });
    await prisma.session.deleteMany({ where: { visitor: { shopId } } });
    await prisma.visitor.deleteMany({ where: { shopId } });
    await prisma.analytics.deleteMany({ where: { shopId } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete all data error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete data' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// LOYALTY PROGRAM API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Update loyalty program
 * PUT /api/loyalty/program
 */
router.put('/loyalty/program', async (req: Request, res: Response) => {
  try {
    const shopId = req.shop!.id;
    const data = req.body;

    const program = await prisma.loyaltyProgram.upsert({
      where: { shopId },
      update: data,
      create: { shopId, ...data },
    });

    res.json({ success: true, data: program });
  } catch (error) {
    console.error('Update loyalty program error:', error);
    res.status(500).json({ success: false, error: 'Failed to update loyalty program' });
  }
});

/**
 * Adjust member points
 * POST /api/loyalty/members/:id/adjust
 */
router.post('/loyalty/members/:id/adjust', async (req: Request, res: Response) => {
  try {
    const memberId = req.params.id;
    const { points, reason } = req.body;

    const member = await prisma.loyaltyPoints.update({
      where: { id: memberId },
      data: {
        points: { increment: points },
        lifetimePoints: points > 0 ? { increment: points } : undefined,
        transactions: {
          create: {
            type: 'ADMIN_ADJUST',
            points,
            description: reason || 'Admin adjustment',
          },
        },
      },
    });

    res.json({ success: true, data: member });
  } catch (error) {
    console.error('Adjust points error:', error);
    res.status(500).json({ success: false, error: 'Failed to adjust points' });
  }
});

/**
 * Get member transaction history
 * GET /api/loyalty/members/:id/history
 */
router.get('/loyalty/members/:id/history', async (req: Request, res: Response) => {
  try {
    const memberId = req.params.id;

    const loyaltyPoints = await prisma.loyaltyPoints.findUnique({
      where: { id: memberId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!loyaltyPoints) {
      res.status(404).json({ success: false, error: 'Member not found' });
      return;
    }

    res.json({ success: true, data: loyaltyPoints.transactions });
  } catch (error) {
    console.error('Get member history error:', error);
    res.status(500).json({ success: false, error: 'Failed to get history' });
  }
});

/**
 * Create loyalty tier
 * POST /api/loyalty/tiers
 */
router.post('/loyalty/tiers', async (req: Request, res: Response) => {
  try {
    const shopId = req.shop!.id;
    const { name, minPoints, color, pointMultiplier, freeShipping, exclusiveAccess, birthdayBonus } = req.body;

    const program = await prisma.loyaltyProgram.findUnique({
      where: { shopId },
    });

    if (!program) {
      res.status(404).json({ success: false, error: 'Loyalty program not found' });
      return;
    }

    const tierCount = await prisma.loyaltyTier.count({ where: { programId: program.id } });

    const tier = await prisma.loyaltyTier.create({
      data: {
        programId: program.id,
        name,
        minPoints: minPoints || 0,
        color: color || '#7367f0',
        pointMultiplier: pointMultiplier || 1,
        freeShipping: freeShipping || false,
        exclusiveAccess: exclusiveAccess || false,
        birthdayBonus: birthdayBonus || 0,
        order: tierCount,
      },
    });

    res.json({ success: true, data: tier });
  } catch (error) {
    console.error('Create tier error:', error);
    res.status(500).json({ success: false, error: 'Failed to create tier' });
  }
});

/**
 * Update loyalty tier
 * PUT /api/loyalty/tiers/:id
 */
router.put('/loyalty/tiers/:id', async (req: Request, res: Response) => {
  try {
    const tierId = req.params.id;
    const data = req.body;

    const tier = await prisma.loyaltyTier.update({
      where: { id: tierId },
      data,
    });

    res.json({ success: true, data: tier });
  } catch (error) {
    console.error('Update tier error:', error);
    res.status(500).json({ success: false, error: 'Failed to update tier' });
  }
});

/**
 * Delete loyalty tier
 * DELETE /api/loyalty/tiers/:id
 */
router.delete('/loyalty/tiers/:id', async (req: Request, res: Response) => {
  try {
    const tierId = req.params.id;

    await prisma.loyaltyTier.delete({ where: { id: tierId } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete tier error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete tier' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// A/B TESTING API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create A/B test
 * POST /api/ab-tests
 */
router.post('/ab-tests', async (req: Request, res: Response) => {
  try {
    const shopId = req.shop!.id;
    const { variants, ...testData } = req.body;

    const test = await prisma.aBTest.create({
      data: {
        shopId,
        ...testData,
        variants: {
          create: variants.map((v: { name: string; isControl: boolean }) => ({
            name: v.name,
            isControl: v.isControl || false,
            config: {},
          })),
        },
      },
      include: { variants: true },
    });

    res.json({ success: true, data: test });
  } catch (error) {
    console.error('Create A/B test error:', error);
    res.status(500).json({ success: false, error: 'Failed to create A/B test' });
  }
});

/**
 * Update A/B test
 * PUT /api/ab-tests/:id
 */
router.put('/ab-tests/:id', async (req: Request, res: Response) => {
  try {
    const shopId = req.shop!.id;
    const testId = req.params.id;
    const { variants, ...testData } = req.body;

    const test = await prisma.aBTest.update({
      where: { id: testId },
      data: testData,
    });

    res.json({ success: true, data: test });
  } catch (error) {
    console.error('Update A/B test error:', error);
    res.status(500).json({ success: false, error: 'Failed to update A/B test' });
  }
});

/**
 * Delete A/B test
 * DELETE /api/ab-tests/:id
 */
router.delete('/ab-tests/:id', async (req: Request, res: Response) => {
  try {
    const testId = req.params.id;

    await prisma.aBTest.delete({ where: { id: testId } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete A/B test error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete A/B test' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// TARGETING RULES API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create targeting rule
 * POST /api/targeting
 */
router.post('/targeting', async (req: Request, res: Response) => {
  try {
    const shopId = req.shop!.id;
    const data = req.body;

    const rule = await prisma.targetingRule.create({
      data: { shopId, ...data },
    });

    res.json({ success: true, data: rule });
  } catch (error) {
    console.error('Create targeting rule error:', error);
    res.status(500).json({ success: false, error: 'Failed to create targeting rule' });
  }
});

/**
 * Update targeting rule
 * PUT /api/targeting/:id
 */
router.put('/targeting/:id', async (req: Request, res: Response) => {
  try {
    const ruleId = req.params.id;
    const data = req.body;

    const rule = await prisma.targetingRule.update({
      where: { id: ruleId },
      data,
    });

    res.json({ success: true, data: rule });
  } catch (error) {
    console.error('Update targeting rule error:', error);
    res.status(500).json({ success: false, error: 'Failed to update targeting rule' });
  }
});

/**
 * Delete targeting rule
 * DELETE /api/targeting/:id
 */
router.delete('/targeting/:id', async (req: Request, res: Response) => {
  try {
    const ruleId = req.params.id;

    await prisma.targetingRule.delete({ where: { id: ruleId } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete targeting rule error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete targeting rule' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// REFERRAL PROGRAM API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Update referral program
 * PUT /api/referral/program
 */
router.put('/referral/program', async (req: Request, res: Response) => {
  try {
    const shopId = req.shop!.id;
    const data = req.body;

    const program = await prisma.referralProgram.upsert({
      where: { shopId },
      update: data,
      create: { shopId, ...data },
    });

    res.json({ success: true, data: program });
  } catch (error) {
    console.error('Update referral program error:', error);
    res.status(500).json({ success: false, error: 'Failed to update referral program' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// EMAIL INTEGRATION API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Update email integration
 * PUT /api/integrations/email
 */
router.put('/integrations/email', async (req: Request, res: Response) => {
  try {
    const shopId = req.shop!.id;
    const data = req.body;

    const integration = await prisma.emailIntegration.upsert({
      where: { shopId },
      update: data,
      create: { shopId, ...data },
    });

    res.json({ success: true, data: integration });
  } catch (error) {
    console.error('Update email integration error:', error);
    res.status(500).json({ success: false, error: 'Failed to update email integration' });
  }
});

/**
 * Test email connection
 * POST /api/integrations/email/test
 */
router.post('/integrations/email/test', async (req: Request, res: Response) => {
  try {
    const { provider, apiKey } = req.body;

    // TODO: Implement actual API testing for each provider
    // For now, just return success if API key is provided
    if (!apiKey) {
      res.status(400).json({ success: false, error: 'API key required' });
      return;
    }

    res.json({ success: true, message: 'Connection successful' });
  } catch (error) {
    console.error('Test email connection error:', error);
    res.status(500).json({ success: false, error: 'Connection test failed' });
  }
});

export default router;

