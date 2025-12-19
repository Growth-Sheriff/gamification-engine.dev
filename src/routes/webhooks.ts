/**
 * Gamification Engine - Webhook Routes
 * Shopify webhook handlers
 */

import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { verifyWebhookMiddleware } from '../middleware/auth.js';

const router = Router();

// All webhooks need raw body for HMAC verification
// This is handled in the main app with express.raw()

/**
 * App uninstalled
 * POST /webhooks/app/uninstalled
 */
router.post('/app/uninstalled', verifyWebhookMiddleware, async (req: Request, res: Response) => {
  try {
    const shopDomain = req.get('X-Shopify-Shop-Domain');

    if (!shopDomain) {
      res.status(400).send('Missing shop domain');
      return;
    }

    console.log(`App uninstalled from: ${shopDomain}`);

    // Mark shop as inactive (soft delete)
    await prisma.shop.update({
      where: { domain: shopDomain },
      data: { isActive: false },
    });

    res.status(200).send('OK');
  } catch (error) {
    console.error('Uninstall webhook error:', error);
    res.status(500).send('Error');
  }
});

/**
 * Order paid - Track discount usage
 * POST /webhooks/orders/paid
 */
router.post('/orders/paid', verifyWebhookMiddleware, async (req: Request, res: Response) => {
  try {
    const shopDomain = req.get('X-Shopify-Shop-Domain');

    if (!shopDomain) {
      res.status(400).send('Missing shop domain');
      return;
    }

    const shop = await prisma.shop.findUnique({
      where: { domain: shopDomain },
    });

    if (!shop) {
      res.status(404).send('Shop not found');
      return;
    }

    const order = req.body as {
      id: number;
      admin_graphql_api_id: string;
      total_price: string;
      discount_codes: Array<{
        code: string;
        amount: string;
        type: string;
      }>;
      customer?: {
        id: number;
        email: string;
      };
    };

    // Check if any of our discount codes were used
    for (const discountCode of order.discount_codes) {
      const discount = await prisma.discount.findUnique({
        where: {
          shopId_code: {
            shopId: shop.id,
            code: discountCode.code,
          },
        },
        include: {
          visitor: true,
        },
      });

      if (discount && discount.status === 'CREATED') {
        // Update discount status
        await prisma.discount.update({
          where: { id: discount.id },
          data: {
            status: 'USED',
            usedAt: new Date(),
            usedOrderId: order.admin_graphql_api_id,
            usedOrderAmount: parseFloat(order.total_price),
          },
        });

        // Update visitor with customer ID if available
        if (order.customer && !discount.visitor.customerId) {
          await prisma.visitor.update({
            where: { id: discount.visitorId },
            data: {
              customerId: `gid://shopify/Customer/${order.customer.id}`,
              email: order.customer.email || discount.visitor.email,
            },
          });
        }

        // Update analytics
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        await prisma.analytics.upsert({
          where: {
            shopId_gameId_date: {
              shopId: shop.id,
              gameId: null as unknown as string, // Global analytics
              date: today,
            },
          },
          update: {
            redemptions: { increment: 1 },
            revenue: { increment: parseFloat(order.total_price) },
          },
          create: {
            shopId: shop.id,
            gameId: null,
            date: today,
            redemptions: 1,
            revenue: parseFloat(order.total_price),
          },
        });

        console.log(`Discount ${discountCode.code} used in order ${order.id}`);
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Order paid webhook error:', error);
    res.status(500).send('Error');
  }
});

/**
 * GDPR - Customer data request
 * POST /webhooks/customers/data_request
 */
router.post('/customers/data_request', verifyWebhookMiddleware, async (req: Request, res: Response) => {
  try {
    // Log the request for manual processing
    console.log('GDPR Customer data request:', req.body);

    // In production, you would:
    // 1. Queue a job to collect all customer data
    // 2. Send the data to the customer or store owner

    res.status(200).send('OK');
  } catch (error) {
    console.error('GDPR data request error:', error);
    res.status(500).send('Error');
  }
});

/**
 * GDPR - Customer redact (delete data)
 * POST /webhooks/customers/redact
 */
router.post('/customers/redact', verifyWebhookMiddleware, async (req: Request, res: Response) => {
  try {
    const { shop_domain, customer } = req.body as {
      shop_domain: string;
      customer: {
        id: number;
        email: string;
      };
    };

    const shop = await prisma.shop.findUnique({
      where: { domain: shop_domain },
    });

    if (shop) {
      // Delete visitor data for this customer
      await prisma.visitor.deleteMany({
        where: {
          shopId: shop.id,
          OR: [
            { customerId: `gid://shopify/Customer/${customer.id}` },
            { email: customer.email },
          ],
        },
      });

      console.log(`GDPR: Deleted data for customer ${customer.email}`);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('GDPR customer redact error:', error);
    res.status(500).send('Error');
  }
});

/**
 * GDPR - Shop redact (delete all shop data)
 * POST /webhooks/shop/redact
 */
router.post('/shop/redact', verifyWebhookMiddleware, async (req: Request, res: Response) => {
  try {
    const { shop_domain } = req.body as { shop_domain: string };

    // Delete all shop data
    await prisma.shop.delete({
      where: { domain: shop_domain },
    });

    console.log(`GDPR: Deleted all data for shop ${shop_domain}`);

    res.status(200).send('OK');
  } catch (error) {
    console.error('GDPR shop redact error:', error);
    res.status(500).send('Error');
  }
});

export default router;

