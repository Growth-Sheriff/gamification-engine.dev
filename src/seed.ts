/**
 * Gamification Engine - Seed Data Script
 * Creates default game and rules for testing
 */

import prisma from './lib/prisma.js';

async function seed() {
  console.log('🌱 Seeding database...');

  // Check if test shop exists
  let shop = await prisma.shop.findUnique({
    where: { domain: 'tester-12345678908798.myshopify.com' },
  });

  if (!shop) {
    console.log('Creating test shop...');
    shop = await prisma.shop.create({
      data: {
        domain: 'tester-12345678908798.myshopify.com',
        name: 'Test Store',
        email: 'test@example.com',
        accessToken: process.env.TEST_STORE_ACCESS_TOKEN || 'test_token',
        isActive: true,
      },
    });
    console.log('✅ Test shop created');
  } else {
    console.log('✅ Test shop already exists');
  }

  // Check if game exists
  let game = await prisma.game.findFirst({
    where: { shopId: shop.id, type: 'SPIN_WHEEL' },
  });

  if (!game) {
    console.log('Creating spin wheel game...');
    game = await prisma.game.create({
      data: {
        shopId: shop.id,
        type: 'SPIN_WHEEL',
        name: 'Şanslı Çark',
        isActive: true,
        trigger: 'TIME_ON_PAGE',
        triggerValue: 3000,
        showOnPages: ['/', '/collections/*', '/products/*'],
        config: {
          title: '🎡 Şanslı Çark!',
          subtitle: 'Çarkı çevir, indirim kazan!',
          buttonText: 'Çarkı Çevir',
        },
        segments: {
          create: [
            { label: '%5 İndirim', type: 'PERCENTAGE', value: 5, probability: 0.30, color: '#7367f0', order: 0 },
            { label: '%10 İndirim', type: 'PERCENTAGE', value: 10, probability: 0.25, color: '#28c76f', order: 1 },
            { label: 'Şanssız', type: 'NO_PRIZE', value: 0, probability: 0.20, color: '#82868b', order: 2 },
            { label: '%15 İndirim', type: 'PERCENTAGE', value: 15, probability: 0.15, color: '#ff9f43', order: 3 },
            { label: 'Ücretsiz Kargo', type: 'FREE_SHIPPING', value: 0, probability: 0.05, color: '#00cfe8', order: 4 },
            { label: '%20 İndirim', type: 'PERCENTAGE', value: 20, probability: 0.05, color: '#ea5455', order: 5 },
          ],
        },
      },
      include: { segments: true },
    });
    console.log('✅ Spin wheel game created with', game.segments.length, 'segments');
  } else {
    console.log('✅ Spin wheel game already exists');
  }

  // Check if rule exists
  let rule = await prisma.discountRule.findFirst({
    where: { shopId: shop.id },
  });

  if (!rule) {
    console.log('Creating discount rule...');
    rule = await prisma.discountRule.create({
      data: {
        shopId: shop.id,
        name: 'Varsayılan Kural',
        isActive: true,
        gameId: game.id,
        maxPlaysPerVisitor: 1,
        maxWinsPerVisitor: 1,
        cooldownHours: 24,
        requireEmail: false,
        validityDays: 7,
        maxRedemptionsPerCode: 1,
        appliesTo: 'ALL',
        combineWithShipping: true,
      },
    });
    console.log('✅ Discount rule created');
  } else {
    console.log('✅ Discount rule already exists');
  }

  console.log('');
  console.log('🎮 Seed completed!');
  console.log('─────────────────────────────────────────');
  console.log('Shop ID:', shop.id);
  console.log('Game ID:', game.id);
  console.log('Rule ID:', rule.id);
  console.log('─────────────────────────────────────────');
}

seed()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

