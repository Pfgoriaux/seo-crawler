import { XMLParser } from 'fast-xml-parser';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import zlib from 'zlib';
import { SitemapUrl } from '../types';
import logger from '../utils/logger';

interface ParsedSitemap {
  urlset?: {
    url: SitemapEntry | SitemapEntry[];
  };
  sitemapindex?: {
    sitemap: SitemapIndexEntry | SitemapIndexEntry[];
  };
}

interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number | string;
}

interface SitemapIndexEntry {
  loc: string;
  lastmod?: string;
}

export class SitemapParser {
  private parser: XMLParser;
  private visitedSitemaps: Set<string> = new Set();

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
    });
  }

  /**
   * Fetch and parse a sitemap, handling sitemap indexes recursively
   */
  async parse(sitemapUrl: string): Promise<SitemapUrl[]> {
    logger.info(`Fetching sitemap: ${sitemapUrl}`);
    this.visitedSitemaps.clear();
    return this.parseSitemap(sitemapUrl);
  }

  private async parseSitemap(sitemapUrl: string): Promise<SitemapUrl[]> {
    if (this.visitedSitemaps.has(sitemapUrl)) {
      logger.warn(`Skipping already visited sitemap: ${sitemapUrl}`);
      return [];
    }
    this.visitedSitemaps.add(sitemapUrl);

    try {
      const content = await this.fetchSitemap(sitemapUrl);
      const parsed: ParsedSitemap = this.parser.parse(content);

      // Check if it's a sitemap index
      if (parsed.sitemapindex) {
        return this.handleSitemapIndex(parsed.sitemapindex);
      }

      // Regular sitemap
      if (parsed.urlset) {
        return this.handleUrlset(parsed.urlset);
      }

      logger.warn(`Unknown sitemap format for ${sitemapUrl}`);
      return [];
    } catch (error) {
      logger.error(`Failed to parse sitemap ${sitemapUrl}:`, error);
      return [];
    }
  }

  private async handleSitemapIndex(
    sitemapindex: { sitemap: SitemapIndexEntry | SitemapIndexEntry[] }
  ): Promise<SitemapUrl[]> {
    const sitemaps = Array.isArray(sitemapindex.sitemap)
      ? sitemapindex.sitemap
      : [sitemapindex.sitemap];

    logger.info(`Found sitemap index with ${sitemaps.length} sitemaps`);

    const allUrls: SitemapUrl[] = [];
    for (const sitemap of sitemaps) {
      const loc = typeof sitemap === 'string' ? sitemap : sitemap.loc;
      if (loc) {
        const urls = await this.parseSitemap(loc);
        allUrls.push(...urls);
      }
    }

    return allUrls;
  }

  private handleUrlset(
    urlset: { url: SitemapEntry | SitemapEntry[] }
  ): SitemapUrl[] {
    const urls = Array.isArray(urlset.url) ? urlset.url : [urlset.url];

    return urls
      .filter(entry => entry && entry.loc)
      .map(entry => ({
        loc: typeof entry.loc === 'string' ? entry.loc : String(entry.loc),
        lastmod: entry.lastmod,
        changefreq: this.validateChangefreq(entry.changefreq),
        priority: typeof entry.priority === 'number'
          ? entry.priority
          : entry.priority
            ? parseFloat(String(entry.priority))
            : undefined,
      }));
  }

  private validateChangefreq(
    freq?: string
  ): 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never' | undefined {
    const validFreqs = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'];
    if (freq && validFreqs.includes(freq.toLowerCase())) {
      return freq.toLowerCase() as SitemapUrl['changefreq'];
    }
    return undefined;
  }

  private fetchSitemap(sitemapUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = new URL(sitemapUrl);
      const client = url.protocol === 'https:' ? https : http;
      const isGzipped = sitemapUrl.endsWith('.gz');

      const request = client.get(sitemapUrl, {
        headers: {
          'User-Agent': 'SEO-Crawler/1.0',
          'Accept-Encoding': 'gzip, deflate',
        },
      }, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            logger.info(`Following redirect to: ${redirectUrl}`);
            this.fetchSitemap(redirectUrl).then(resolve).catch(reject);
            return;
          }
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to fetch sitemap: HTTP ${response.statusCode}`));
          return;
        }

        const chunks: Buffer[] = [];

        response.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        response.on('end', () => {
          const buffer = Buffer.concat(chunks);

          // Check if response is gzipped
          const contentEncoding = response.headers['content-encoding'];
          if (isGzipped || contentEncoding === 'gzip') {
            zlib.gunzip(buffer, (err, decoded) => {
              if (err) {
                reject(err);
              } else {
                resolve(decoded.toString('utf-8'));
              }
            });
          } else {
            resolve(buffer.toString('utf-8'));
          }
        });

        response.on('error', reject);
      });

      request.on('error', reject);
      request.setTimeout(30000, () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }
}

/**
 * Fetch and validate robots.txt for a domain
 */
export async function fetchRobotsTxt(baseUrl: string): Promise<{
  content: string;
  sitemaps: string[];
  disallowed: string[];
  allowed: string[];
} | null> {
  return new Promise((resolve) => {
    try {
      const url = new URL(baseUrl);
      const robotsUrl = `${url.protocol}//${url.host}/robots.txt`;
      const client = url.protocol === 'https:' ? https : http;

      client.get(robotsUrl, {
        headers: { 'User-Agent': 'SEO-Crawler/1.0' },
      }, (response) => {
        if (response.statusCode !== 200) {
          resolve(null);
          return;
        }

        let content = '';
        response.on('data', (chunk) => { content += chunk; });
        response.on('end', () => {
          const lines = content.split('\n');
          const sitemaps: string[] = [];
          const disallowed: string[] = [];
          const allowed: string[] = [];

          for (const line of lines) {
            const trimmed = line.trim().toLowerCase();
            if (trimmed.startsWith('sitemap:')) {
              sitemaps.push(line.substring(8).trim());
            } else if (trimmed.startsWith('disallow:')) {
              disallowed.push(line.substring(9).trim());
            } else if (trimmed.startsWith('allow:')) {
              allowed.push(line.substring(6).trim());
            }
          }

          resolve({ content, sitemaps, disallowed, allowed });
        });
        response.on('error', () => resolve(null));
      }).on('error', () => resolve(null));
    } catch {
      resolve(null);
    }
  });
}

export default SitemapParser;
