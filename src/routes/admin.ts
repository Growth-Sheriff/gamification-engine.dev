/**
 * Gamification Engine - Admin Routes
 * EJS rendered pages for admin panel
 */

import { Router, Request, Response } from 'express';
import type { Router as RouterType } from 'express';
import { requireAuth } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';

const router: RouterType = Router();

// All admin routes require authentication
router.use(requireAuth);

/**
 * Dashboard
 * GET /
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const shopId = req.shop!.id;

    // Get last 7 days for chart
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get statistics
    const [
      totalGames,
      activeGames,
      totalPlays,
      totalWins,
      totalDiscounts,
      usedDiscounts,
      recentPlays,
      chartAnalytics,
    ] = await Promise.all([
      prisma.game.count({ where: { shopId } }),
      prisma.game.count({ where: { shopId, isActive: true } }),
      prisma.play.count({ where: { game: { shopId } } }),
      prisma.play.count({ where: { game: { shopId }, result: 'WIN' } }),
      prisma.discount.count({ where: { shopId } }),
      prisma.discount.count({ where: { shopId, status: 'USED' } }),
      prisma.play.findMany({
        where: { game: { shopId } },
        include: {
          game: { select: { name: true, type: true } },
          visitor: { select: { fingerprint: true, email: true } },
          discount: { select: { code: true, status: true } },
        },
        orderBy: { playedAt: 'desc' },
        take: 10,
      }),
      prisma.analytics.findMany({
        where: { shopId, date: { gte: sevenDaysAgo } },
        orderBy: { date: 'asc' },
      }),
    ]);

    // Calculate conversion rate
    const conversionRate = totalPlays > 0 ? ((usedDiscounts / totalPlays) * 100).toFixed(1) : '0';

    // Chart data
    const chartData = {
      labels: chartAnalytics.map(a => a.date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })),
      plays: chartAnalytics.map(a => a.plays),
      wins: chartAnalytics.map(a => a.wins),
    };

    // Get games for sidebar
    const games = await prisma.game.findMany({
      where: { shopId },
      select: { id: true, name: true, type: true, isActive: true },
    });

    res.render('pages/dashboard', {
      title: 'Dashboard',
      shop: req.shop,
      stats: {
        totalGames,
        activeGames,
        totalPlays,
        totalWins,
        totalDiscounts,
        usedDiscounts,
        conversionRate,
        winRate: totalPlays > 0 ? ((totalWins / totalPlays) * 100).toFixed(1) : '0',
      },
      recentPlays,
      games,
      chartData,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).render('pages/error', {
      title: 'Error',
      message: 'Failed to load dashboard.',
    });
  }
});

/**
 * Spin Wheel Settings
 * GET /games/spin-wheel
 */
router.get('/games/spin-wheel', async (req: Request, res: Response) => {
  try {
    const shopId = req.shop!.id;

    // Get or create spin wheel game
    let game = await prisma.game.findFirst({
      where: { shopId, type: 'SPIN_WHEEL' },
      include: {
        segments: { orderBy: { order: 'asc' } },
        rules: { where: { isActive: true } },
      },
    });

    if (!game) {
      // Create default spin wheel
      game = await prisma.game.create({
        data: {
          shopId,
          type: 'SPIN_WHEEL',
          name: 'Şanslı Çark',
          isActive: false,
          trigger: 'TIME_ON_PAGE',
          triggerValue: 3000,
          config: {
            title: '🎡 Şanslı Çark!',
            subtitle: 'Çarkı çevir, indirim kazan!',
            buttonText: 'Çarkı Çevir',
          },
          segments: {
            create: [
              { label: '%5', type: 'PERCENTAGE', value: 5, probability: 0.30, color: '#7367F0', order: 0 },
              { label: '%10', type: 'PERCENTAGE', value: 10, probability: 0.25, color: '#28C76F', order: 1 },
              { label: 'Şanssız', type: 'NO_PRIZE', value: 0, probability: 0.20, color: '#82868B', order: 2 },
              { label: '%15', type: 'PERCENTAGE', value: 15, probability: 0.15, color: '#FF9F43', order: 3 },
              { label: '%20', type: 'PERCENTAGE', value: 20, probability: 0.08, color: '#EA5455', order: 4 },
              { label: 'Kargo Bedava', type: 'FREE_SHIPPING', value: 0, probability: 0.02, color: '#00CFE8', order: 5 },
            ],
          },
        },
        include: {
          segments: { orderBy: { order: 'asc' } },
          rules: { where: { isActive: true } },
        },
      });
    }

    res.render('pages/games/spin-wheel', {
      title: 'Spin Wheel',
      shop: req.shop,
      game,
    });
  } catch (error) {
    console.error('Spin wheel page error:', error);
    res.status(500).render('pages/error', {
      title: 'Error',
      message: 'Failed to load spin wheel settings.',
    });
  }
});

/**
 * Scratch Card Settings
 * GET /games/scratch-card
 */
router.get('/games/scratch-card', async (req: Request, res: Response) => {
  try {
    const shopId = req.shop!.id;

    let game = await prisma.game.findFirst({
      where: { shopId, type: 'SCRATCH_CARD' },
      include: {
        segments: { orderBy: { order: 'asc' } },
      },
    });

    if (!game) {
      game = await prisma.game.create({
        data: {
          shopId,
          type: 'SCRATCH_CARD',
          name: 'Kazı Kazan',
          isActive: false,
          trigger: 'TIME_ON_PAGE',
          triggerValue: 5000,
          config: {
            title: '🎫 Kazı Kazan!',
            subtitle: 'Kartı kazı, sürprizi gör!',
            buttonText: 'Kazımaya Başla',
          },
          segments: {
            create: [
              { label: '%5', type: 'PERCENTAGE', value: 5, probability: 0.35, color: '#7367F0', order: 0 },
              { label: '%10', type: 'PERCENTAGE', value: 10, probability: 0.30, color: '#28C76F', order: 1 },
              { label: 'Şanssız', type: 'NO_PRIZE', value: 0, probability: 0.25, color: '#82868B', order: 2 },
              { label: '%15', type: 'PERCENTAGE', value: 15, probability: 0.10, color: '#FF9F43', order: 3 },
            ],
          },
        },
        include: {
          segments: { orderBy: { order: 'asc' } },
        },
      });
    }

    res.render('pages/games/scratch-card', {
      title: 'Scratch Card',
      shop: req.shop,
      game,
    });
  } catch (error) {
    console.error('Scratch card page error:', error);
    res.status(500).render('pages/error', {
      title: 'Error',
      message: 'Failed to load scratch card settings.',
    });
  }
});

/**
 * Popup Settings
 * GET /games/popup
 */
router.get('/games/popup', async (req: Request, res: Response) => {
  try {
    const shopId = req.shop!.id;

    let game = await prisma.game.findFirst({
      where: { shopId, type: 'POPUP' },
      include: {
        segments: { orderBy: { order: 'asc' } },
      },
    });

    if (!game) {
      game = await prisma.game.create({
        data: {
          shopId,
          type: 'POPUP',
          name: 'İndirim Popup',
          isActive: false,
          trigger: 'EXIT_INTENT',
          triggerValue: 0,
          config: {
            title: '🎁 Özel Teklif!',
            subtitle: 'Ayrılmadan önce sana özel indirim!',
            buttonText: 'İndirimi Al',
          },
          segments: {
            create: [
              { label: '%10 İndirim', type: 'PERCENTAGE', value: 10, probability: 1.0, color: '#7367F0', order: 0 },
            ],
          },
        },
        include: {
          segments: { orderBy: { order: 'asc' } },
        },
      });
    }

    res.render('pages/games/popup', {
      title: 'Popup',
      shop: req.shop,
      game,
    });
  } catch (error) {
    console.error('Popup page error:', error);
    res.status(500).render('pages/error', {
      title: 'Error',
      message: 'Failed to load popup settings.',
    });
  }
});

/**
 * Discount Rules List
 * GET /discounts/rules
 */
router.get('/discounts/rules', async (req: Request, res: Response) => {
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

    const games = await prisma.game.findMany({
      where: { shopId },
      select: { id: true, name: true, type: true },
    });

    res.render('pages/discounts/rules', {
      title: 'İndirim Kuralları',
      shop: req.shop,
      rules,
      games,
    });
  } catch (error) {
    console.error('Rules page error:', error);
    res.status(500).render('pages/error', {
      title: 'Error',
      message: 'Failed to load discount rules.',
    });
  }
});

/**
 * New Discount Rule Form
 * GET /discounts/rules/new
 */
router.get('/discounts/rules/new', async (req: Request, res: Response) => {
  try {
    const shopId = req.shop!.id;

    const games = await prisma.game.findMany({
      where: { shopId },
      select: { id: true, name: true, type: true },
    });

    res.render('pages/discounts/rule-form', {
      title: 'Yeni Kural',
      shop: req.shop,
      rule: null,
      games,
      isEdit: false,
    });
  } catch (error) {
    console.error('New rule page error:', error);
    res.status(500).render('pages/error', {
      title: 'Error',
      message: 'Failed to load form.',
    });
  }
});

/**
 * Edit Discount Rule Form
 * GET /discounts/rules/:id
 */
router.get('/discounts/rules/:id', async (req: Request, res: Response) => {
  try {
    const shopId = req.shop!.id;
    const ruleId = req.params.id;

    const rule = await prisma.discountRule.findFirst({
      where: { id: ruleId, shopId },
    });

    if (!rule) {
      res.status(404).render('pages/error', {
        title: 'Not Found',
        message: 'Discount rule not found.',
      });
      return;
    }

    const games = await prisma.game.findMany({
      where: { shopId },
      select: { id: true, name: true, type: true },
    });

    res.render('pages/discounts/rule-form', {
      title: 'Kural Düzenle',
      shop: req.shop,
      rule,
      games,
      isEdit: true,
    });
  } catch (error) {
    console.error('Edit rule page error:', error);
    res.status(500).render('pages/error', {
      title: 'Error',
      message: 'Failed to load rule.',
    });
  }
});

/**
 * Discount Codes List
 * GET /discounts/codes
 */
router.get('/discounts/codes', async (req: Request, res: Response) => {
  try {
    const shopId = req.shop!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = 50;
    const skip = (page - 1) * limit;

    const [discounts, total, usedCount, expiredCount] = await Promise.all([
      prisma.discount.findMany({
        where: { shopId },
        include: {
          visitor: { select: { fingerprint: true, email: true } },
          rule: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.discount.count({ where: { shopId } }),
      prisma.discount.count({ where: { shopId, status: 'USED' } }),
      prisma.discount.count({ where: { shopId, status: 'EXPIRED' } }),
    ]);

    const pendingCount = total - usedCount - expiredCount;
    const totalPages = Math.ceil(total / limit);

    res.render('pages/discounts/codes', {
      title: 'İndirim Kodları',
      shop: req.shop,
      discounts,
      stats: {
        totalCodes: total,
        usedCodes: usedCount,
        pendingCodes: pendingCount,
        expiredCodes: expiredCount,
      },
      pagination: {
        page,
        totalPages,
        total,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('Codes page error:', error);
    res.status(500).render('pages/error', {
      title: 'Error',
      message: 'Failed to load discount codes.',
    });
  }
});

/**
 * Analytics
 * GET /analytics
 */
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const shopId = req.shop!.id;

    // Get last 30 days analytics
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const analytics = await prisma.analytics.findMany({
      where: {
        shopId,
        date: { gte: thirtyDaysAgo },
      },
      orderBy: { date: 'asc' },
    });

    // Aggregate totals
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

    // Chart data
    const chartData = {
      labels: analytics.map(a => a.date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })),
      plays: analytics.map(a => a.plays),
      wins: analytics.map(a => a.wins),
    };

    // Game stats
    const gameStats = await prisma.game.findMany({
      where: { shopId },
      include: {
        _count: { select: { plays: true } },
        plays: {
          where: { result: 'WIN' },
          select: { id: true },
        },
      },
    });

    const gameStatsFormatted = await Promise.all(gameStats.map(async g => {
      const plays = g._count.plays;
      const wins = g.plays.length;
      const used = await prisma.discount.count({
        where: {
          shopId,
          status: 'USED',
          play: { gameId: g.id },
        },
      });
      return {
        name: g.name,
        type: g.type,
        plays,
        wins,
        winRate: plays > 0 ? Math.round((wins / plays) * 100) : 0,
        used,
        conversionRate: wins > 0 ? Math.round((used / wins) * 100) : 0,
      };
    }));

    // Stats summary
    const stats = {
      totalPlays: totals.plays,
      totalWins: totals.wins,
      conversionRate: totals.plays > 0 ? Math.round((totals.redemptions / totals.plays) * 100) : 0,
      usedDiscounts: totals.redemptions,
      totalRevenue: totals.revenue,
    };

    res.render('pages/analytics', {
      title: 'Analitik',
      shop: req.shop,
      analytics,
      totals,
      chartData,
      gameStats: gameStatsFormatted,
      stats,
    });
  } catch (error) {
    console.error('Analytics page error:', error);
    res.status(500).render('pages/error', {
      title: 'Error',
      message: 'Failed to load analytics.',
    });
  }
});

/**
 * Settings
 * GET /settings
 */
router.get('/settings', async (req: Request, res: Response) => {
  try {
    const shopId = req.shop!.id;

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
    });

    res.render('pages/settings', {
      title: 'Ayarlar',
      shop: req.shop,
      shopDetails: shop,
    });
  } catch (error) {
    console.error('Settings page error:', error);
    res.status(500).render('pages/error', {
      title: 'Error',
      message: 'Failed to load settings.',
    });
  }
});

export default router;

