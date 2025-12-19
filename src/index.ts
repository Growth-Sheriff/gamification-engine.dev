/**
 * Gamification Engine - Main Entry Point
 * Shopify App for Spin Wheel, Scratch Card, Popup Games
 */

import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

import { config } from './config.js';
import prisma from './lib/prisma.js';

// Routes
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import apiRoutes from './routes/api.js';
import proxyRoutes from './routes/proxy.js';
import webhookRoutes from './routes/webhooks.js';

// ES Module dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app
const app = express();

// ═══════════════════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════

// Trust proxy (for Shopify App Proxy)
app.set('trust proxy', 1);

// Security headers (relaxed for Shopify iframe embedding)
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled for Shopify admin embedding
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
  })
);

// CORS
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// Logging
app.use(morgan(config.isDevelopment ? 'dev' : 'combined'));

// Cookie parser
app.use(cookieParser());

// Session
declare module 'express-session' {
  interface SessionData {
    shopDomain?: string;
    state?: string;
  }
}

app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: config.isProduction,
      httpOnly: true,
      sameSite: 'none', // Required for Shopify iframe
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Raw body for webhook HMAC verification
app.use('/webhooks', express.raw({ type: 'application/json' }));
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.path.startsWith('/webhooks')) {
    (req as Request & { rawBody?: string }).rawBody = req.body?.toString();
  }
  next();
});

// JSON body parser (after webhooks)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ═══════════════════════════════════════════════════════════════════════════
// VIEW ENGINE
// ═══════════════════════════════════════════════════════════════════════════

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// ═══════════════════════════════════════════════════════════════════════════
// STATIC FILES
// ═══════════════════════════════════════════════════════════════════════════

app.use('/public', express.static(path.join(__dirname, '../public')));
app.use('/assets', express.static(path.join(__dirname, '../public')));
app.use('/widget', express.static(path.join(__dirname, '../public/widget'), {
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
  },
}));

// Widget loader script
app.get('/widget.js', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.sendFile(path.join(__dirname, '../public/widget.js'));
});

// ═══════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes
app.use('/auth', authRoutes);

// Webhook routes (before session check)
app.use('/webhooks', webhookRoutes);

// Proxy routes (for storefront - App Proxy)
app.use('/api/proxy', proxyRoutes);

// API routes (JSON)
app.use('/api', apiRoutes);

// Admin routes (EJS pages)
app.use('/', adminRoutes);

// ═══════════════════════════════════════════════════════════════════════════
// ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════════════

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).render('pages/error', {
    title: '404 - Not Found',
    message: 'The page you are looking for does not exist.',
  });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).render('pages/error', {
    title: 'Server Error',
    message: config.isDevelopment ? err.message : 'An unexpected error occurred.',
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SERVER START
// ═══════════════════════════════════════════════════════════════════════════

const startServer = async () => {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected');

    // Start server
    app.listen(config.port, () => {
      console.log('');
      console.log('🎮 ═══════════════════════════════════════════════════');
      console.log('   GAMIFICATION ENGINE');
      console.log('═══════════════════════════════════════════════════════');
      console.log(`   🌐 URL:      ${config.appUrl}`);
      console.log(`   🚀 Port:     ${config.port}`);
      console.log(`   📦 Mode:     ${config.env}`);
      console.log(`   🔧 API:      Shopify GraphQL ${config.shopify.apiVersion}`);
      console.log('═══════════════════════════════════════════════════════');
      console.log('');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

// Start
startServer();

