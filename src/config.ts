/**
 * Gamification Engine - Configuration
 * Environment variables and app settings
 */

import 'dotenv/config';
import { z } from 'zod';

// Environment schema validation
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  HOST: z.string().default('localhost'),
  APP_URL: z.string().url(),
  DATABASE_URL: z.string(),
  SHOPIFY_API_KEY: z.string(),
  SHOPIFY_API_SECRET: z.string(),
  SHOPIFY_SCOPES: z.string(),
  SHOPIFY_API_VERSION: z.string().default('2025-10'),
  SESSION_SECRET: z.string(),
});

// Parse and validate environment variables
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  // Server
  env: parsed.data.NODE_ENV,
  port: parseInt(parsed.data.PORT, 10),
  host: parsed.data.HOST,
  appUrl: parsed.data.APP_URL,
  isProduction: parsed.data.NODE_ENV === 'production',
  isDevelopment: parsed.data.NODE_ENV === 'development',

  // Database
  databaseUrl: parsed.data.DATABASE_URL,

  // Shopify
  shopify: {
    apiKey: parsed.data.SHOPIFY_API_KEY,
    apiSecret: parsed.data.SHOPIFY_API_SECRET,
    scopes: parsed.data.SHOPIFY_SCOPES.split(','),
    apiVersion: parsed.data.SHOPIFY_API_VERSION as '2025-10',
    hostName: new URL(parsed.data.APP_URL).hostname,
    hostScheme: 'https',
  },

  // Session
  sessionSecret: parsed.data.SESSION_SECRET,
} as const;

export type Config = typeof config;

