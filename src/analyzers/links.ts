import { Page } from 'playwright';
import https from 'https';
import http from 'http';
import { LinksAnalysis, LinkInfo } from '../types';
import { getDomain, isSameDomain } from '../utils/helpers';

/**
 * Analyze links on a page
 */
export async function analyzeLinks(
  page: Page,
  pageUrl: string,
  checkBrokenLinks: boolean = false
): Promise<LinksAnalysis> {
  const pageDomain = getDomain(pageUrl);

  const links = await page.evaluate((domain: string) => {
    const anchors = document.querySelectorAll('a[href]');
    const linkInfos: {
      href: string;
      text: string;
      rel: string | null;
      isInternal: boolean;
    }[] = [];

    anchors.forEach((anchor: Element) => {
      const href = anchor.getAttribute('href');
      if (!href) return;

      // Skip javascript:, mailto:, tel:, and anchor links
      if (
        href.startsWith('javascript:') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('#')
      ) {
        return;
      }

      try {
        const absoluteUrl = new URL(href, window.location.href).href;
        const linkDomain = new URL(absoluteUrl).hostname;
        const isInternal = linkDomain === domain;

        linkInfos.push({
          href: absoluteUrl,
          text: (anchor.textContent || '').trim().substring(0, 100),
          rel: anchor.getAttribute('rel'),
          isInternal,
        });
      } catch {
        // Invalid URL, skip
      }
    });

    return linkInfos;
  }, pageDomain);

  // Categorize links
  const internalLinks: LinkInfo[] = [];
  const externalLinks: LinkInfo[] = [];

  for (const link of links) {
    const linkInfo: LinkInfo = {
      href: link.href,
      text: link.text,
      rel: link.rel,
      isNofollow: link.rel?.toLowerCase().includes('nofollow') || false,
    };

    if (link.isInternal) {
      internalLinks.push(linkInfo);
    } else {
      externalLinks.push(linkInfo);
    }
  }

  // Check for broken links if enabled
  let brokenLinks: LinkInfo[] = [];
  if (checkBrokenLinks) {
    // Only check a sample of links to avoid overwhelming the server
    const linksToCheck = [...internalLinks, ...externalLinks].slice(0, 20);
    brokenLinks = await checkLinksStatus(linksToCheck);
  }

  return {
    internalLinks,
    externalLinks,
    brokenLinks,
    totalLinks: links.length,
    internalLinksCount: internalLinks.length,
    externalLinksCount: externalLinks.length,
    brokenLinksCount: brokenLinks.length,
  };
}

/**
 * Check HTTP status of links
 */
async function checkLinksStatus(links: LinkInfo[]): Promise<LinkInfo[]> {
  const brokenLinks: LinkInfo[] = [];

  const checkPromises = links.map(async (link) => {
    try {
      const statusCode = await checkLinkStatus(link.href);
      if (statusCode >= 400) {
        brokenLinks.push({ ...link, statusCode });
      }
    } catch {
      // If we can't check, assume it's broken
      brokenLinks.push({ ...link, statusCode: 0 });
    }
  });

  await Promise.all(checkPromises);
  return brokenLinks;
}

/**
 * Check single link status with HEAD request
 */
function checkLinkStatus(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;

      const request = client.request(
        {
          hostname: urlObj.hostname,
          port: urlObj.port,
          path: urlObj.pathname + urlObj.search,
          method: 'HEAD',
          timeout: 5000,
          headers: {
            'User-Agent': 'SEO-Crawler/1.0',
          },
        },
        (response) => {
          resolve(response.statusCode || 0);
        }
      );

      request.on('error', () => reject(new Error('Request failed')));
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });
      request.end();
    } catch {
      reject(new Error('Invalid URL'));
    }
  });
}

/**
 * Calculate links score
 */
export function calculateLinksScore(links: LinksAnalysis): number {
  let score = 100;

  // Broken links penalty
  if (links.brokenLinksCount > 0) {
    score -= Math.min(30, links.brokenLinksCount * 5);
  }

  // No internal links penalty
  if (links.internalLinksCount === 0) {
    score -= 20;
  }

  // Too few links penalty (should have some navigation)
  if (links.totalLinks < 5) {
    score -= 10;
  }

  return Math.max(0, score);
}

export default analyzeLinks;
