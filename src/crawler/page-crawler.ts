import { Browser, Page, Response, Request } from 'playwright';
import { CrawlerConfig, PageAnalysis, ResourceDetail } from '../types';
import logger from '../utils/logger';
import { analyzeCoreWebVitals } from '../analyzers/core-web-vitals';
import { analyzeMetaTags } from '../analyzers/meta-tags';
import { analyzeTechnicalSeo } from '../analyzers/technical-seo';
import { analyzeDocumentStructure } from '../analyzers/document-structure';
import { analyzeLinks } from '../analyzers/links';
import { analyzePerformance } from '../analyzers/performance';
import { analyzeMobileFriendliness } from '../analyzers/mobile-friendly';
import { analyzeStructuredData } from '../analyzers/structured-data';
import { calculatePageScore, collectIssues } from '../analyzers';

// New analyzer imports
import { analyzeReadability } from '../analyzers/readability';
import { analyzeEEAT } from '../analyzers/eeat';
import { analyzeSecurityHeaders } from '../analyzers/security-headers';
import { analyzeContentFreshness } from '../analyzers/content-freshness';
import { analyzeAICitation } from '../analyzers/ai-citation';
import { analyzeThirdParty } from '../analyzers/third-party';
import { analyzeJSRendering } from '../analyzers/js-rendering';
import { analyzeRedirectChain } from '../analyzers/redirect-chain';
import { analyzeINP } from '../analyzers/inp-analysis';
import { analyzeHreflang } from '../analyzers/hreflang-validator';

export interface CrawlResult {
  success: boolean;
  analysis: PageAnalysis | null;
  error?: string;
}

export interface NetworkData {
  resources: ResourceDetail[];
  responseHeaders: Record<string, string>;
  statusCode: number;
  redirectChain: string[];
}

export class PageCrawler {
  private config: CrawlerConfig;

  constructor(config: CrawlerConfig) {
    this.config = config;
  }

  async crawlPage(browser: Browser, url: string): Promise<CrawlResult> {
    const startTime = Date.now();
    let page: Page | null = null;

    try {
      const context = await browser.newContext({
        userAgent: this.config.userAgent,
        viewport: this.config.viewport,
      });

      page = await context.newPage();

      // Set up network monitoring
      const networkData: NetworkData = {
        resources: [],
        responseHeaders: {},
        statusCode: 0,
        redirectChain: [],
      };

      // Track all requests
      page.on('request', (request: Request) => {
        // Track redirect chain for main document
        if (request.isNavigationRequest()) {
          const redirectedFrom = request.redirectedFrom();
          if (redirectedFrom) {
            networkData.redirectChain.push(redirectedFrom.url());
          }
        }
      });

      // Track all responses
      page.on('response', async (response: Response) => {
        try {
          const request = response.request();
          const resourceType = request.resourceType();

          // Capture main document response
          if (request.isNavigationRequest() && response.url() === url) {
            networkData.statusCode = response.status();
            const headers = response.headers();
            networkData.responseHeaders = headers;
          }

          // Track resource details
          const size = (await response.body().catch(() => Buffer.from(''))).length;
          const contentEncoding = response.headers()['content-encoding'] || '';
          const cacheControl = response.headers()['cache-control'] || '';

          networkData.resources.push({
            url: response.url(),
            type: resourceType,
            size,
            compressed: contentEncoding.includes('gzip') || contentEncoding.includes('br'),
            cached: cacheControl.includes('max-age') || cacheControl.includes('public'),
          });
        } catch {
          // Ignore errors from response handling
        }
      });

      // Navigate to the page
      logger.debug(`Navigating to: ${url}`);
      const response = await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: this.config.timeout,
      });

      if (!response) {
        throw new Error('No response received');
      }

      networkData.statusCode = response.status();
      networkData.responseHeaders = response.headers();

      // Wait for any remaining network activity
      await page.waitForLoadState('networkidle');

      // Run all analyzers in parallel
      const [
        coreWebVitals,
        metaTags,
        technicalSeo,
        documentStructure,
        linksAnalysis,
        performance,
        mobileFriendliness,
        structuredData,
        // New analyzers
        readability,
        eeat,
        securityHeaders,
        contentFreshness,
        aiCitation,
        thirdParty,
        jsRendering,
        redirectChain,
        inp,
        hreflang,
      ] = await Promise.all([
        analyzeCoreWebVitals(page),
        analyzeMetaTags(page),
        analyzeTechnicalSeo(page, networkData),
        analyzeDocumentStructure(page, url),
        analyzeLinks(page, url, this.config.checkBrokenLinks),
        analyzePerformance(page, networkData),
        analyzeMobileFriendliness(page),
        analyzeStructuredData(page),
        // New analyzers
        analyzeReadability(page),
        analyzeEEAT(page),
        analyzeSecurityHeaders(page, networkData),
        analyzeContentFreshness(page),
        analyzeAICitation(page),
        analyzeThirdParty(page, networkData),
        analyzeJSRendering(page, url),
        analyzeRedirectChain(page, networkData, url),
        analyzeINP(page),
        analyzeHreflang(page, url),
      ]);

      const loadTime = Date.now() - startTime;

      // Collect all issues from analyzers
      const issues = collectIssues({
        coreWebVitals,
        metaTags,
        technicalSeo,
        documentStructure,
        links: linksAnalysis,
        performance,
        mobileFriendliness,
        structuredData,
        // New analyzers
        readability,
        eeat,
        securityHeaders,
        contentFreshness,
        aiCitation,
        thirdParty,
        jsRendering,
        redirectChain,
        inp,
        hreflang,
      });

      // Calculate scores
      const score = calculatePageScore({
        coreWebVitals,
        metaTags,
        technicalSeo,
        documentStructure,
        links: linksAnalysis,
        performance,
        mobileFriendliness,
        structuredData,
        // New analyzers
        readability,
        eeat,
        securityHeaders,
        contentFreshness,
        aiCitation,
        thirdParty,
        jsRendering,
        redirectChain,
        inp,
        hreflang,
      });

      // Calculate Core Web Vitals score ratings
      const coreWebVitalsScore = {
        lcp: getCwvRating(coreWebVitals.lcp, 2500, 4000),
        fid: getCwvRating(coreWebVitals.fid, 100, 300),
        cls: getCwvRating(coreWebVitals.cls, 0.1, 0.25),
      };

      const analysis: PageAnalysis = {
        url,
        crawledAt: new Date().toISOString(),
        statusCode: networkData.statusCode,
        loadTime,
        coreWebVitals,
        coreWebVitalsScore,
        metaTags,
        documentStructure,
        technicalSeo,
        links: linksAnalysis,
        performance,
        mobileFriendliness,
        structuredData,
        // New analyzer results
        readability,
        eeat,
        securityHeaders,
        contentFreshness,
        aiCitation,
        thirdParty,
        jsRendering,
        redirectChain,
        inp,
        hreflang,
        issues,
        score,
      };

      // Take screenshot if enabled
      if (this.config.screenshotsEnabled) {
        const screenshotPath = `${this.config.outputDir}/screenshots/${encodeURIComponent(url)}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
      }

      await context.close();

      return {
        success: true,
        analysis,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to crawl ${url}: ${errorMessage}`);

      if (page) {
        await page.context().close().catch(() => {});
      }

      return {
        success: false,
        analysis: null,
        error: errorMessage,
      };
    }
  }
}

function getCwvRating(
  value: number | null,
  goodThreshold: number,
  poorThreshold: number
): 'good' | 'needs-improvement' | 'poor' | 'unknown' {
  if (value === null) return 'unknown';
  if (value <= goodThreshold) return 'good';
  if (value <= poorThreshold) return 'needs-improvement';
  return 'poor';
}

export default PageCrawler;
