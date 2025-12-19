/**
 * Gamification Engine - Utility Functions
 */

import { nanoid } from 'nanoid';

/**
 * Generate a unique discount code
 * Format: PREFIX-RANDOM (e.g., SPIN10-A8kM2x)
 */
export function generateDiscountCode(prefix: string = 'SPIN'): string {
  const random = nanoid(6).toUpperCase();
  return `${prefix}-${random}`;
}

/**
 * Weighted random selection
 * Given an array of items with probabilities, select one randomly
 */
export function weightedRandom<T extends { probability: number }>(items: T[]): T | null {
  if (items.length === 0) return null;

  // Normalize probabilities
  const totalProbability = items.reduce((sum, item) => sum + item.probability, 0);

  // Generate random number
  let random = Math.random() * totalProbability;

  // Select item
  for (const item of items) {
    random -= item.probability;
    if (random <= 0) {
      return item;
    }
  }

  // Fallback to last item
  return items[items.length - 1];
}

/**
 * Calculate spin wheel angle for animation
 * Returns the angle that will land on the selected segment
 */
export function calculateSpinAngle(
  segmentIndex: number,
  totalSegments: number,
  minRotations: number = 5
): number {
  const segmentAngle = 360 / totalSegments;
  const targetAngle = segmentIndex * segmentAngle + segmentAngle / 2;

  // Add multiple full rotations for dramatic effect
  const fullRotations = (minRotations + Math.random() * 3) * 360;

  // Final angle (clockwise)
  return fullRotations + (360 - targetAngle);
}

/**
 * Generate a simple fingerprint from request headers
 * This is a basic implementation - can be enhanced with FingerprintJS
 */
export function generateFingerprint(
  userAgent: string,
  acceptLanguage: string,
  ip: string
): string {
  const data = `${userAgent}|${acceptLanguage}|${ip}`;

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return `fp_${Math.abs(hash).toString(36)}`;
}

/**
 * Parse device type from user agent
 */
export function parseDeviceType(userAgent: string): 'mobile' | 'tablet' | 'desktop' {
  const ua = userAgent.toLowerCase();

  if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile/i.test(ua)) {
    return 'mobile';
  }

  if (/ipad|tablet|playbook|silk/i.test(ua)) {
    return 'tablet';
  }

  return 'desktop';
}

/**
 * Parse browser from user agent
 */
export function parseBrowser(userAgent: string): string {
  const ua = userAgent.toLowerCase();

  if (ua.includes('firefox')) return 'Firefox';
  if (ua.includes('edg')) return 'Edge';
  if (ua.includes('chrome')) return 'Chrome';
  if (ua.includes('safari')) return 'Safari';
  if (ua.includes('opera') || ua.includes('opr')) return 'Opera';

  return 'Unknown';
}

/**
 * Parse OS from user agent
 */
export function parseOS(userAgent: string): string {
  const ua = userAgent.toLowerCase();

  if (ua.includes('windows')) return 'Windows';
  if (ua.includes('mac')) return 'macOS';
  if (ua.includes('linux')) return 'Linux';
  if (ua.includes('android')) return 'Android';
  if (ua.includes('iphone') || ua.includes('ipad')) return 'iOS';

  return 'Unknown';
}

/**
 * Format date for Shopify API (ISO 8601)
 */
export function formatShopifyDate(date: Date): string {
  return date.toISOString();
}

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Check if a date is expired
 */
export function isExpired(date: Date): boolean {
  return new Date() > date;
}

/**
 * Safe JSON parse
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Delay utility
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Format currency
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Format percentage
 */
export function formatPercentage(value: number): string {
  return `${value}%`;
}

