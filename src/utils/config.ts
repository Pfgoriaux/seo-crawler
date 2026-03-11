/**
 * Configuration utility
 *
 * Loads configuration from environment variables with sensible defaults.
 */

import dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Environment configuration interface
 */
export interface EnvConfig {
  // Crawler settings
  crawlerConcurrency: number;
  crawlerTimeout: number;
  crawlerOutputDir: string;
  crawlerUserAgent: string;

  // AI Agent settings
  anthropicApiKey: string | undefined;
  claudeModel: string;
  claudeMaxTokens: number;

  // Advanced settings
  debugMode: boolean;
  viewportWidth: number;
  viewportHeight: number;
  checkBrokenLinks: boolean;
}

/**
 * Parse boolean from environment variable
 */
function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Parse integer from environment variable
 */
function parseInt(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const parsed = Number.parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): EnvConfig {
  return {
    // Crawler settings
    crawlerConcurrency: parseInt(process.env.CRAWLER_CONCURRENCY, 3),
    crawlerTimeout: parseInt(process.env.CRAWLER_TIMEOUT, 30000),
    crawlerOutputDir: process.env.CRAWLER_OUTPUT_DIR || './seo-reports',
    crawlerUserAgent: process.env.CRAWLER_USER_AGENT || 'SEO-Crawler/1.0 (https://github.com/Pfgoriaux/seo-crawler)',

    // AI Agent settings
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || undefined,
    claudeModel: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
    claudeMaxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS, 4096),

    // Advanced settings
    debugMode: parseBool(process.env.DEBUG_MODE, false),
    viewportWidth: parseInt(process.env.VIEWPORT_WIDTH, 1920),
    viewportHeight: parseInt(process.env.VIEWPORT_HEIGHT, 1080),
    checkBrokenLinks: parseBool(process.env.CHECK_BROKEN_LINKS, true),
  };
}

/**
 * Validate that required AI agent configuration is present
 */
export function validateAIConfig(config: EnvConfig): { valid: boolean; error?: string } {
  if (!config.anthropicApiKey) {
    return {
      valid: false,
      error: 'ANTHROPIC_API_KEY is not set. Please add it to your .env file.',
    };
  }
  return { valid: true };
}

/**
 * Get the loaded configuration (singleton)
 */
let cachedConfig: EnvConfig | null = null;

export function getConfig(): EnvConfig {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}

export default getConfig;
