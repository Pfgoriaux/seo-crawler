import { URL } from 'url';

/**
 * Check if a URL is valid
 */
export function isValidUrl(urlString: string): boolean {
  try {
    new URL(urlString);
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalize a URL by removing trailing slashes and query params
 */
export function normalizeUrl(urlString: string): string {
  try {
    const url = new URL(urlString);
    let normalized = `${url.protocol}//${url.host}${url.pathname}`;
    if (normalized.endsWith('/') && normalized.length > 1) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch {
    return urlString;
  }
}

/**
 * Get the domain from a URL
 */
export function getDomain(urlString: string): string {
  try {
    const url = new URL(urlString);
    return url.hostname;
  } catch {
    return '';
  }
}

/**
 * Check if two URLs are from the same domain
 */
export function isSameDomain(url1: string, url2: string): boolean {
  return getDomain(url1) === getDomain(url2);
}

/**
 * Check if a URL is SEO-friendly
 * - Only contains letters, numbers, dashes, underscores
 * - No query parameters (optional)
 * - Not too long
 */
export function isSeoFriendlyUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const path = url.pathname;

    // Check for special characters (excluding /, -, _, .)
    const hasSpecialChars = /[^a-zA-Z0-9\/\-_\.]/.test(path);

    // Check if path is not too long (generally < 100 chars is good)
    const isTooLong = path.length > 100;

    // Check for common bad patterns
    const hasBadPatterns = /\.(php|asp|aspx|jsp)\?/.test(urlString) ||
                          /[?&].*=/.test(urlString);

    return !hasSpecialChars && !isTooLong && !hasBadPatterns;
  } catch {
    return false;
  }
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Truncate a string to a specified length
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Calculate a score based on thresholds
 */
export function calculateScore(
  value: number,
  thresholds: { good: number; moderate: number },
  lowerIsBetter = true
): 'good' | 'needs-improvement' | 'poor' {
  if (lowerIsBetter) {
    if (value <= thresholds.good) return 'good';
    if (value <= thresholds.moderate) return 'needs-improvement';
    return 'poor';
  } else {
    if (value >= thresholds.good) return 'good';
    if (value >= thresholds.moderate) return 'needs-improvement';
    return 'poor';
  }
}

/**
 * Sanitize HTML content for display
 */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Extract text content from HTML string
 */
export function extractTextContent(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Count words in text
 */
export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0).length;
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Parse a robots meta content string
 */
export function parseRobotsContent(content: string): {
  noindex: boolean;
  nofollow: boolean;
  noarchive: boolean;
  nosnippet: boolean;
} {
  const directives = content.toLowerCase().split(',').map(d => d.trim());
  return {
    noindex: directives.includes('noindex'),
    nofollow: directives.includes('nofollow'),
    noarchive: directives.includes('noarchive'),
    nosnippet: directives.includes('nosnippet'),
  };
}

/**
 * Check if string contains passive voice (simple heuristic)
 */
export function hasPassiveVoice(text: string): boolean {
  const passivePatterns = [
    /\b(is|are|was|were|be|been|being)\s+\w+ed\b/gi,
    /\b(is|are|was|were|be|been|being)\s+\w+en\b/gi,
  ];
  return passivePatterns.some(pattern => pattern.test(text));
}

/**
 * Calculate reading time in minutes
 */
export function calculateReadingTime(wordCount: number, wpm: number = 200): number {
  return Math.ceil(wordCount / wpm);
}
