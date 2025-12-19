/**
 * Gamification Engine - API Routes
 * JSON API endpoints for AJAX calls
 */

import { Router, Request, Response } from 'express';
import { requireApiAuth } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { z } from 'zod';

const router = Router();

// All API routes require authentication
router.use(requireApiAuth);

// ═══════════════════════════════════════════════════════════════════════════
// GAMES API
// ═══════════════════════════════════════════════════════════════════════════

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
      data: parsed.data,
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

export default router;

