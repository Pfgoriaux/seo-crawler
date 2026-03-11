import { Page } from 'playwright';
import { TechnicalSeo } from '../types';
import { NetworkData } from '../crawler/page-crawler';

/**
 * Analyze technical SEO factors
 */
export async function analyzeTechnicalSeo(
  page: Page,
  networkData: NetworkData
): Promise<TechnicalSeo> {
  const url = page.url();

  // Check for robots meta tag
  const robotsMeta = await page.evaluate(() => {
    const meta = document.querySelector('meta[name="robots"]');
    return meta?.getAttribute('content') || null;
  });

  // Check canonical URL
  const canonicalUrl = await page.evaluate(() => {
    const canonical = document.querySelector('link[rel="canonical"]');
    return canonical?.getAttribute('href') || null;
  });

  // Parse robots meta content
  const hasRobotsNoindex = robotsMeta
    ? robotsMeta.toLowerCase().includes('noindex')
    : false;

  // Check X-Robots-Tag header
  const xRobotsTag = networkData.responseHeaders['x-robots-tag'] || '';
  const hasXRobotsNoindex = xRobotsTag.toLowerCase().includes('noindex');

  // Validate canonical URL
  let canonicalValid = true;
  if (canonicalUrl) {
    try {
      const canonical = new URL(canonicalUrl, url);
      // Canonical should point to a valid URL
      canonicalValid = canonical.href.startsWith('http');
    } catch {
      canonicalValid = false;
    }
  }

  return {
    statusCode: networkData.statusCode,
    isHttps: url.startsWith('https://'),
    hasRobotsNoindex,
    hasXRobotsNoindex,
    canonicalUrl,
    canonicalValid,
    redirectChain: networkData.redirectChain,
    responseHeaders: networkData.responseHeaders,
  };
}

/**
 * Calculate technical SEO score
 */
export function calculateTechnicalSeoScore(technicalSeo: TechnicalSeo): number {
  let score = 100;

  // Status code check
  if (technicalSeo.statusCode >= 400) {
    score -= 40;
  } else if (technicalSeo.statusCode >= 300) {
    score -= 10;
  }

  // HTTPS check
  if (!technicalSeo.isHttps) {
    score -= 20;
  }

  // Robots noindex check (not an error, but reduces score if present)
  if (technicalSeo.hasRobotsNoindex || technicalSeo.hasXRobotsNoindex) {
    score -= 30;
  }

  // Canonical validation
  if (technicalSeo.canonicalUrl && !technicalSeo.canonicalValid) {
    score -= 15;
  }

  // Too many redirects
  if (technicalSeo.redirectChain.length > 2) {
    score -= 10;
  }

  return Math.max(0, score);
}

export default analyzeTechnicalSeo;
