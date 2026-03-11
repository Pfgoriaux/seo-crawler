import { Page } from 'playwright';
import { NetworkData } from '../crawler/page-crawler';

export interface RedirectHop {
  url: string;
  statusCode: number;
  type: 'http' | 'meta-refresh' | 'javascript' | 'unknown';
  location: string | null;
}

export interface RedirectChainAnalysis {
  chain: RedirectHop[];
  totalHops: number;
  hasLoop: boolean;
  finalUrl: string;
  originalUrl: string;
  urlChanged: boolean;
  issues: string[];
  redirectTypes: string[];
  estimatedOverheadMs: number;
  recommendations: string[];
}

/**
 * Analyze redirect chains and loops
 */
export async function analyzeRedirectChain(
  page: Page,
  networkData: NetworkData,
  originalUrl: string
): Promise<RedirectChainAnalysis> {
  const chain: RedirectHop[] = [];
  const issues: string[] = [];
  const recommendations: string[] = [];
  const redirectTypes: string[] = [];
  let hasLoop = false;

  // Get final URL from page
  const finalUrl = page.url();

  // Build redirect chain from networkData
  if (networkData.redirectChain.length > 0) {
    // Add original URL as first hop if it's in redirect chain
    const fullChain = [...networkData.redirectChain, finalUrl];

    // Track URLs to detect loops
    const urlSet = new Set<string>();

    for (let i = 0; i < fullChain.length - 1; i++) {
      const currentUrl = fullChain[i];
      const nextUrl = fullChain[i + 1];

      // Detect loops
      if (urlSet.has(currentUrl)) {
        hasLoop = true;
        issues.push(`Redirect loop detected at: ${currentUrl}`);
      }
      urlSet.add(currentUrl);

      // Determine redirect type based on URL patterns and status codes
      let type: 'http' | 'meta-refresh' | 'javascript' | 'unknown' = 'http';
      let statusCode = 301; // Default to 301, we'll try to infer the actual code

      // Analyze redirect patterns
      const currentUrlObj = new URL(currentUrl);
      const nextUrlObj = new URL(nextUrl);

      // HTTP status redirects (most common)
      if (currentUrl !== nextUrl) {
        type = 'http';

        // Try to infer status code from common redirect patterns
        if (currentUrlObj.protocol === 'http:' && nextUrlObj.protocol === 'https:') {
          // HTTP to HTTPS redirects are typically 301
          statusCode = 301;
          issues.push('HTTP to HTTPS redirect (expected but adds overhead)');
        } else if (currentUrlObj.hostname !== nextUrlObj.hostname) {
          // Domain changes could be 301 or 302
          statusCode = 301;
        } else if (currentUrlObj.pathname !== nextUrlObj.pathname) {
          // Path changes could be various types
          statusCode = 302;
        }
      }

      chain.push({
        url: currentUrl,
        statusCode,
        type,
        location: nextUrl,
      });

      if (!redirectTypes.includes(type)) {
        redirectTypes.push(type);
      }
    }
  }

  // Check for meta refresh or JavaScript redirects
  const hasMetaRefresh = await page.evaluate(() => {
    const metaTags = document.querySelectorAll('meta[http-equiv="refresh"]');
    return metaTags.length > 0;
  });

  if (hasMetaRefresh) {
    issues.push('Meta refresh redirect detected (slower than HTTP redirects)');
    redirectTypes.push('meta-refresh');
  }

  // Analyze URL changes
  const urlChanged = originalUrl !== finalUrl;
  const totalHops = chain.length;

  // Analyze common redirect patterns
  if (urlChanged && totalHops > 0) {
    const origUrl = new URL(originalUrl);
    const finalUrlObj = new URL(finalUrl);

    // Check for www to non-www or vice versa
    if (
      (origUrl.hostname.startsWith('www.') && !finalUrlObj.hostname.startsWith('www.')) ||
      (!origUrl.hostname.startsWith('www.') && finalUrlObj.hostname.startsWith('www.'))
    ) {
      issues.push('WWW subdomain redirect detected');
      recommendations.push('Consider using canonical URLs consistently across your site');
    }

    // Check for trailing slash normalization
    if (
      origUrl.pathname.endsWith('/') !== finalUrlObj.pathname.endsWith('/') &&
      origUrl.pathname.replace(/\/$/, '') === finalUrlObj.pathname.replace(/\/$/, '')
    ) {
      issues.push('Trailing slash normalization redirect');
      recommendations.push('Use consistent trailing slash convention');
    }

    // Check for protocol changes
    if (origUrl.protocol !== finalUrlObj.protocol) {
      issues.push(`Protocol redirect: ${origUrl.protocol} to ${finalUrlObj.protocol}`);
      if (origUrl.protocol === 'http:' && finalUrlObj.protocol === 'https:') {
        recommendations.push('Consider using HSTS headers to force HTTPS');
      }
    }
  }

  // Check for redirect chains longer than 2 hops
  if (totalHops > 2) {
    issues.push(`Long redirect chain detected: ${totalHops} hops`);
    recommendations.push('Reduce redirect chain to maximum 1-2 hops for better performance');
  }

  // Check for mixed redirect types
  if (redirectTypes.length > 1) {
    issues.push(`Mixed redirect types: ${redirectTypes.join(', ')}`);
    recommendations.push('Use consistent HTTP redirects (301/302) instead of meta refresh or JavaScript');
  }

  // Estimate overhead time (rough estimate: ~50-100ms per hop)
  const estimatedOverheadMs = totalHops * 75;

  // Add general recommendations
  if (totalHops > 0) {
    recommendations.push('Update internal links to point directly to final URL');
  }

  if (totalHops === 0 && !urlChanged) {
    recommendations.push('No redirects detected - excellent!');
  }

  if (hasLoop) {
    recommendations.push('CRITICAL: Fix redirect loop immediately to prevent infinite redirects');
  }

  return {
    chain,
    totalHops,
    hasLoop,
    finalUrl,
    originalUrl,
    urlChanged,
    issues,
    redirectTypes,
    estimatedOverheadMs,
    recommendations,
  };
}

/**
 * Calculate redirect chain score (0-100)
 */
export function calculateRedirectScore(analysis: RedirectChainAnalysis): number {
  // Loop detected - critical issue
  if (analysis.hasLoop) {
    return 0;
  }

  // Score based on number of redirects
  let score = 100;

  switch (analysis.totalHops) {
    case 0:
      score = 100;
      break;
    case 1:
      score = 90;
      break;
    case 2:
      score = 75;
      break;
    case 3:
      score = 50;
      break;
    default:
      // 4+ redirects
      score = Math.max(20, 50 - (analysis.totalHops - 3) * 10);
      break;
  }

  // Penalize for mixed redirect types
  if (analysis.redirectTypes.length > 1) {
    score -= 10;
  }

  // Penalize for meta refresh redirects (they're slower)
  if (analysis.redirectTypes.includes('meta-refresh')) {
    score -= 15;
  }

  // Penalize for JavaScript redirects
  if (analysis.redirectTypes.includes('javascript')) {
    score -= 15;
  }

  return Math.max(0, score);
}

export default analyzeRedirectChain;
