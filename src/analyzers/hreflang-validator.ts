import { Page } from 'playwright';

export interface HreflangTag {
  hreflang: string;
  href: string;
  language: string | null;
  region: string | null;
  isValid: boolean;
  isSelfReference: boolean;
}

export interface HreflangIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  affectedUrl?: string;
}

export interface HreflangAnalysis {
  tags: HreflangTag[];
  hasSelfReference: boolean;
  hasXDefault: boolean;
  xDefaultUrl: string | null;
  validCodes: string[];
  invalidCodes: string[];
  issues: HreflangIssue[];
  implementationMethod: 'html' | 'header' | 'both' | 'none';
  languagesCovered: string[];
  regionsCovered: string[];
  canonicalConflict: boolean;
  totalTags: number;
}

// ISO 639-1 language codes (common ones)
const VALID_LANGUAGE_CODES = new Set([
  'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko',
  'ar', 'nl', 'pl', 'sv', 'no', 'da', 'fi', 'cs', 'el', 'tr',
  'he', 'th', 'vi', 'id', 'ms', 'hi', 'bn', 'uk', 'ro', 'hu',
  'sk', 'bg', 'hr', 'lt', 'lv', 'et', 'sl', 'sr', 'ca', 'is',
  'af', 'sq', 'eu', 'be', 'bs', 'gl', 'ka', 'mk', 'mt', 'cy'
]);

// ISO 3166-1 region codes (common ones)
const VALID_REGION_CODES = new Set([
  'US', 'GB', 'CA', 'AU', 'DE', 'FR', 'ES', 'IT', 'BR', 'MX',
  'JP', 'CN', 'KR', 'IN', 'RU', 'NL', 'BE', 'CH', 'AT', 'SE',
  'NO', 'DK', 'FI', 'PL', 'CZ', 'GR', 'TR', 'IL', 'TH', 'VN',
  'ID', 'MY', 'SG', 'PH', 'HK', 'TW', 'NZ', 'IE', 'PT', 'ZA',
  'AR', 'CL', 'CO', 'PE', 'VE', 'EG', 'SA', 'AE', 'PK', 'BD',
  'NG', 'KE', 'ET', 'TZ', 'UG', 'GH', 'RO', 'HU', 'UA', 'SK',
  'BG', 'HR', 'LT', 'LV', 'EE', 'SI', 'RS', 'BA', 'MK', 'AL',
  'IS', 'LU', 'MT', 'CY', 'BY', 'MD', 'GE', 'AM', 'AZ', 'KZ'
]);

/**
 * Parse hreflang attribute value into language and region components
 */
function parseHreflangValue(hreflang: string): {
  language: string | null;
  region: string | null;
  isValid: boolean;
} {
  // Special case: x-default
  if (hreflang.toLowerCase() === 'x-default') {
    return {
      language: 'x-default',
      region: null,
      isValid: true
    };
  }

  // Parse language-region format (e.g., "en-US", "en", "zh-Hans-CN")
  const parts = hreflang.split('-');

  if (parts.length === 0) {
    return { language: null, region: null, isValid: false };
  }

  const language = parts[0].toLowerCase();
  let region: string | null = null;
  let isValid = VALID_LANGUAGE_CODES.has(language);

  // Check for region code
  if (parts.length >= 2) {
    // Handle script codes (e.g., zh-Hans-CN)
    const lastPart = parts[parts.length - 1].toUpperCase();
    if (lastPart.length === 2) {
      region = lastPart;
      isValid = isValid && VALID_REGION_CODES.has(region);
    } else if (parts.length === 2) {
      // Could be a script code or invalid region
      const secondPart = parts[1].toUpperCase();
      if (secondPart.length === 2) {
        region = secondPart;
        isValid = isValid && VALID_REGION_CODES.has(region);
      }
    }
  }

  return { language, region, isValid };
}

/**
 * Normalize URL for comparison
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove trailing slash, convert to lowercase
    return parsed.href.toLowerCase().replace(/\/$/, '');
  } catch {
    return url.toLowerCase().replace(/\/$/, '');
  }
}

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

interface RawHreflangTag {
  hreflang: string;
  href: string;
}

/**
 * Extract hreflang tags from HTML link elements
 */
async function extractHtmlHreflangTags(page: Page): Promise<RawHreflangTag[]> {
  return await page.evaluate(() => {
    const links = Array.from(
      document.querySelectorAll('link[rel="alternate"][hreflang]')
    );

    return links.map((link) => {
      const hreflang = link.getAttribute('hreflang') || '';
      const href = link.getAttribute('href') || '';

      return {
        hreflang,
        href,
      };
    });
  });
}

/**
 * Parse Link header for hreflang tags
 * Note: This requires the Link header string to be passed in
 */
function parseHeaderHreflangTags(linkHeader: string | null): RawHreflangTag[] {
  if (!linkHeader) {
    return [];
  }

  const tags: RawHreflangTag[] = [];

  // Parse Link header (can contain multiple links separated by commas)
  const linkParts = linkHeader.split(',');

  for (const part of linkParts) {
    // Match: <url>; rel="alternate"; hreflang="xx"
    const urlMatch = part.match(/<([^>]+)>/);
    const hreflangMatch = part.match(/hreflang=["']([^"']+)["']/i);
    const relMatch = part.match(/rel=["']([^"']+)["']/i);

    if (urlMatch && hreflangMatch && relMatch && relMatch[1].includes('alternate')) {
      tags.push({
        hreflang: hreflangMatch[1],
        href: urlMatch[1],
      });
    }
  }

  return tags;
}

/**
 * Main hreflang analysis function
 */
export async function analyzeHreflang(
  page: Page,
  currentUrl: string
): Promise<HreflangAnalysis> {
  const issues: HreflangIssue[] = [];
  const normalizedCurrentUrl = normalizeUrl(currentUrl);

  // Extract hreflang tags from HTML
  // Note: Header-based hreflang extraction is skipped to avoid re-navigation issues
  let htmlTags: RawHreflangTag[] = [];

  try {
    htmlTags = await extractHtmlHreflangTags(page);
  } catch (error) {
    issues.push({
      type: 'error',
      message: `Failed to extract HTML hreflang tags: ${error}`
    });
  }

  // Header tags would require access to response headers from initial page load
  // For now, we only support HTML-based hreflang detection
  const headerTags: RawHreflangTag[] = [];

  // Determine implementation method
  let implementationMethod: 'html' | 'header' | 'both' | 'none' = 'none';
  if (htmlTags.length > 0 && headerTags.length > 0) {
    implementationMethod = 'both';
    issues.push({
      type: 'warning',
      message: 'Hreflang implemented in both HTML and HTTP headers. Google recommends using only one method.'
    });
  } else if (htmlTags.length > 0) {
    implementationMethod = 'html';
  } else if (headerTags.length > 0) {
    implementationMethod = 'header';
  }

  // Combine all tags
  const allRawTags = [...htmlTags, ...headerTags];

  // Process and validate each tag
  const tags: HreflangTag[] = allRawTags.map((rawTag) => {
    const { language, region, isValid } = parseHreflangValue(rawTag.hreflang);

    // Validate URL format
    if (!isValidUrl(rawTag.href)) {
      issues.push({
        type: 'error',
        message: `Invalid URL format for hreflang="${rawTag.hreflang}"`,
        affectedUrl: rawTag.href
      });
    }

    // Check if it's a self-reference
    const isSelfReference = normalizeUrl(rawTag.href) === normalizedCurrentUrl;

    // Add issue for invalid codes
    if (!isValid && rawTag.hreflang.toLowerCase() !== 'x-default') {
      issues.push({
        type: 'error',
        message: `Invalid language/region code: "${rawTag.hreflang}"`,
        affectedUrl: rawTag.href
      });
    }

    return {
      hreflang: rawTag.hreflang,
      href: rawTag.href,
      language,
      region,
      isValid,
      isSelfReference
    };
  });

  // Check for self-reference
  const hasSelfReference = tags.some(tag => tag.isSelfReference);
  if (!hasSelfReference && tags.length > 0) {
    issues.push({
      type: 'warning',
      message: 'Missing self-referencing hreflang tag. Each page should include a hreflang tag pointing to itself.'
    });
  }

  // Check for x-default
  const xDefaultTag = tags.find(tag => tag.hreflang.toLowerCase() === 'x-default');
  const hasXDefault = !!xDefaultTag;
  const xDefaultUrl = xDefaultTag?.href || null;

  if (!hasXDefault && tags.length > 1) {
    issues.push({
      type: 'warning',
      message: 'Missing x-default hreflang tag. Consider adding an x-default for users who don\'t match any language/region.'
    });
  }

  // Collect valid and invalid codes
  const validCodes: string[] = [];
  const invalidCodes: string[] = [];
  const languagesCovered = new Set<string>();
  const regionsCovered = new Set<string>();

  for (const tag of tags) {
    if (tag.isValid || tag.hreflang.toLowerCase() === 'x-default') {
      validCodes.push(tag.hreflang);
      if (tag.language && tag.language !== 'x-default') {
        languagesCovered.add(tag.language);
      }
      if (tag.region) {
        regionsCovered.add(tag.region);
      }
    } else {
      invalidCodes.push(tag.hreflang);
    }
  }

  // Check for duplicate hreflang values
  const hreflangCounts = new Map<string, number>();
  for (const tag of tags) {
    const count = hreflangCounts.get(tag.hreflang) || 0;
    hreflangCounts.set(tag.hreflang, count + 1);
  }

  for (const [hreflang, count] of hreflangCounts.entries()) {
    if (count > 1) {
      issues.push({
        type: 'error',
        message: `Duplicate hreflang value: "${hreflang}" appears ${count} times`
      });
    }
  }

  // Check for conflicting URLs (same hreflang pointing to different URLs)
  const hreflangUrls = new Map<string, Set<string>>();
  for (const tag of tags) {
    if (!hreflangUrls.has(tag.hreflang)) {
      hreflangUrls.set(tag.hreflang, new Set());
    }
    hreflangUrls.get(tag.hreflang)!.add(normalizeUrl(tag.href));
  }

  for (const [hreflang, urls] of hreflangUrls.entries()) {
    if (urls.size > 1) {
      issues.push({
        type: 'error',
        message: `Conflicting URLs for hreflang="${hreflang}": points to ${urls.size} different URLs`
      });
    }
  }

  // Check canonical conflict
  let canonicalConflict = false;
  try {
    const canonicalUrl = await page.evaluate(() => {
      const canonical = document.querySelector('link[rel="canonical"]');
      return canonical?.getAttribute('href') || null;
    });

    if (canonicalUrl) {
      const normalizedCanonical = normalizeUrl(canonicalUrl);
      if (normalizedCanonical !== normalizedCurrentUrl) {
        // Check if any hreflang tags point to the current page
        const currentPageHreflangTags = tags.filter(tag => tag.isSelfReference);
        if (currentPageHreflangTags.length > 0) {
          canonicalConflict = true;
          issues.push({
            type: 'error',
            message: 'Canonical conflict: Page has self-referencing hreflang tags but canonical points to a different URL',
            affectedUrl: canonicalUrl
          });
        }
      }
    }
  } catch (error) {
    // Canonical check failure is not critical
  }

  // Check for non-absolute URLs
  for (const tag of tags) {
    if (!tag.href.startsWith('http://') && !tag.href.startsWith('https://')) {
      issues.push({
        type: 'error',
        message: 'Hreflang URLs must be absolute (include protocol and domain)',
        affectedUrl: tag.href
      });
    }
  }

  // Check for broken or redirecting URLs (could be done with additional requests, but skipped for performance)
  // This would require making HEAD requests to each hreflang URL

  return {
    tags,
    hasSelfReference,
    hasXDefault,
    xDefaultUrl,
    validCodes,
    invalidCodes,
    issues,
    implementationMethod,
    languagesCovered: Array.from(languagesCovered),
    regionsCovered: Array.from(regionsCovered),
    canonicalConflict,
    totalTags: tags.length
  };
}

/**
 * Calculate hreflang score based on analysis
 * Scoring breakdown:
 * - Self-reference: 25 points
 * - X-default: 20 points
 * - Valid codes: 25 points (proportional to valid/total)
 * - No issues: 30 points (deducted based on issue severity)
 */
export function calculateHreflangScore(analysis: HreflangAnalysis): number {
  let score = 0;

  // If no tags, return 0
  if (analysis.totalTags === 0) {
    return 0;
  }

  // Self-reference: 25 points
  if (analysis.hasSelfReference) {
    score += 25;
  }

  // X-default: 20 points
  if (analysis.hasXDefault) {
    score += 20;
  }

  // Valid codes: 25 points (proportional)
  if (analysis.totalTags > 0) {
    const validRatio = analysis.validCodes.length / analysis.totalTags;
    score += validRatio * 25;
  }

  // No issues: 30 points (deduct based on severity)
  let issueDeduction = 0;
  for (const issue of analysis.issues) {
    if (issue.type === 'error') {
      issueDeduction += 5;
    } else if (issue.type === 'warning') {
      issueDeduction += 2;
    } else if (issue.type === 'info') {
      issueDeduction += 0.5;
    }
  }

  // Cap deduction at 30 points
  issueDeduction = Math.min(issueDeduction, 30);
  score += 30 - issueDeduction;

  // Ensure score is between 0 and 100
  return Math.max(0, Math.min(100, Math.round(score)));
}
