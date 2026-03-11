import { chromium, Browser } from 'playwright';
import pLimit from 'p-limit';
import fs from 'fs';
import path from 'path';
import { CrawlerConfig, CrawlReport, CrawlSummary, PageAnalysis, SitemapUrl, ClusterSummary } from '../types';
import { SitemapParser } from './sitemap-parser';
import { PageCrawler } from './page-crawler';
import logger from '../utils/logger';
import { generateJsonReport } from '../reporters/json-reporter';
import { generateHtmlReport } from '../reporters/html-reporter';
import { getDomain, formatDuration } from '../utils/helpers';
import { analyzePageClusters } from '../analyzers/cluster-analyzer';

// Save progress every N pages for large crawls
const PROGRESS_SAVE_INTERVAL = 500;

export class Crawler {
  private config: CrawlerConfig;
  private browser: Browser | null = null;
  private sitemapParser: SitemapParser;
  private pageCrawler: PageCrawler;
  private progressFile: string;

  constructor(config: CrawlerConfig) {
    this.config = config;
    this.sitemapParser = new SitemapParser();
    this.pageCrawler = new PageCrawler(config);
    this.progressFile = path.join(config.outputDir, 'crawl-progress.json');
  }

  /**
   * Save crawl progress to disk (for recovery in case of failure)
   */
  private saveProgress(results: PageAnalysis[], totalUrls: number, startTime: number): void {
    try {
      // Ensure output directory exists
      if (!fs.existsSync(this.config.outputDir)) {
        fs.mkdirSync(this.config.outputDir, { recursive: true });
      }

      const progress = {
        siteUrl: getDomain(this.config.sitemapUrl) || this.config.sitemapUrl,
        sitemapUrl: this.config.sitemapUrl,
        crawlDate: new Date().toISOString(),
        totalPages: totalUrls,
        crawledPages: results.length,
        duration: Date.now() - startTime,
        status: 'in_progress',
        pages: results,
      };

      // Use streaming write to handle large data
      const stream = fs.createWriteStream(this.progressFile, { encoding: 'utf-8' });
      stream.write('{\n');
      stream.write(`  "siteUrl": ${JSON.stringify(progress.siteUrl)},\n`);
      stream.write(`  "sitemapUrl": ${JSON.stringify(progress.sitemapUrl)},\n`);
      stream.write(`  "crawlDate": ${JSON.stringify(progress.crawlDate)},\n`);
      stream.write(`  "totalPages": ${progress.totalPages},\n`);
      stream.write(`  "crawledPages": ${progress.crawledPages},\n`);
      stream.write(`  "duration": ${progress.duration},\n`);
      stream.write(`  "status": "${progress.status}",\n`);
      stream.write('  "pages": [\n');

      results.forEach((page, index) => {
        const pageJson = JSON.stringify(page);
        stream.write('    ' + pageJson);
        stream.write(index < results.length - 1 ? ',\n' : '\n');
      });

      stream.write('  ]\n');
      stream.write('}\n');
      stream.end();

      logger.debug(`Progress saved: ${results.length}/${totalUrls} pages`);
    } catch (error) {
      logger.warn(`Failed to save progress: ${error}`);
    }
  }

  /**
   * Clean up progress file after successful completion
   */
  private cleanupProgress(): void {
    try {
      if (fs.existsSync(this.progressFile)) {
        fs.unlinkSync(this.progressFile);
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  async run(): Promise<CrawlReport> {
    const startTime = Date.now();
    logger.header('SEO Crawler');
    logger.info(`Starting crawl of ${this.config.sitemapUrl}`);
    logger.divider();

    try {
      // Parse sitemap
      logger.info('Parsing sitemap...');
      const sitemapUrls = await this.sitemapParser.parse(this.config.sitemapUrl);
      logger.success(`Found ${sitemapUrls.length} URLs in sitemap`);

      if (sitemapUrls.length === 0) {
        throw new Error('No URLs found in sitemap');
      }

      // Limit pages if specified
      const urlsToProcess = this.config.maxPages
        ? sitemapUrls.slice(0, this.config.maxPages)
        : sitemapUrls;

      logger.info(`Will crawl ${urlsToProcess.length} pages with concurrency ${this.config.concurrency}`);
      logger.divider();

      // Launch browser
      logger.info('Launching browser...');
      this.browser = await chromium.launch({
        headless: true,
      });
      logger.success('Browser launched');

      // Crawl pages concurrently
      const limit = pLimit(this.config.concurrency);
      const results: PageAnalysis[] = [];
      let completed = 0;
      let failed = 0;
      let lastSavedAt = 0;

      const crawlPromises = urlsToProcess.map((sitemapUrl) =>
        limit(async () => {
          const result = await this.pageCrawler.crawlPage(this.browser!, sitemapUrl.loc);
          completed++;

          if (result.success && result.analysis) {
            results.push(result.analysis);
            logger.progress(
              completed,
              urlsToProcess.length,
              `Crawled: ${sitemapUrl.loc.substring(0, 50)}...`
            );

            // Save progress periodically for large crawls
            if (results.length - lastSavedAt >= PROGRESS_SAVE_INTERVAL) {
              this.saveProgress(results, urlsToProcess.length, startTime);
              lastSavedAt = results.length;
            }
          } else {
            failed++;
            logger.error(`Failed: ${sitemapUrl.loc} - ${result.error}`);
          }

          return result;
        })
      );

      await Promise.all(crawlPromises);
      logger.newLine();

      // Save final progress before generating reports
      if (urlsToProcess.length > PROGRESS_SAVE_INTERVAL) {
        logger.info('Saving final progress before report generation...');
        this.saveProgress(results, urlsToProcess.length, startTime);
      }

      // Close browser
      await this.browser.close();
      this.browser = null;

      // Generate report
      const duration = Date.now() - startTime;
      const report = this.generateReport(
        results,
        urlsToProcess,
        failed,
        duration
      );

      // Save reports
      logger.divider();
      logger.info('Generating reports...');

      if (this.config.formats.includes('json')) {
        await generateJsonReport(report, this.config.outputDir);
      }

      if (this.config.formats.includes('html')) {
        await generateHtmlReport(report, this.config.outputDir);
      }

      // Clean up progress file after successful completion
      this.cleanupProgress();

      // Print summary
      this.printSummary(report);

      return report;
    } catch (error) {
      if (this.browser) {
        await this.browser.close();
      }

      // Inform user about progress file if it exists
      if (fs.existsSync(this.progressFile)) {
        logger.warn(`Crawl failed, but progress was saved to: ${this.progressFile}`);
        logger.info(`You can use this file to recover partial results.`);
      }

      throw error;
    }
  }

  private generateReport(
    pages: PageAnalysis[],
    sitemapUrls: SitemapUrl[],
    failedCount: number,
    duration: number
  ): CrawlReport {
    const summary = this.generateSummary(pages);

    // Generate cluster analysis
    logger.info('Analyzing page clusters...');
    const clusters = this.generateClusterAnalysis(pages);
    logger.success(`Identified ${clusters.totalClusters} page clusters`);

    return {
      siteUrl: getDomain(this.config.sitemapUrl) || this.config.sitemapUrl,
      sitemapUrl: this.config.sitemapUrl,
      crawlDate: new Date().toISOString(),
      totalPages: sitemapUrls.length,
      crawledPages: pages.length,
      failedPages: failedCount,
      duration,
      summary,
      pages,
      clusters,
    };
  }

  private generateClusterAnalysis(pages: PageAnalysis[]): ClusterSummary {
    return analyzePageClusters(pages);
  }

  private generateSummary(pages: PageAnalysis[]): CrawlSummary {
    // Calculate average score
    const averageScore =
      pages.length > 0
        ? pages.reduce((sum, p) => sum + p.score.overall, 0) / pages.length
        : 0;

    // Count issues by type
    const issuesByType = {
      errors: 0,
      warnings: 0,
      info: 0,
    };

    // Count issues by category
    const issuesByCategory: Record<string, number> = {};

    // Count CWV distribution
    const coreWebVitalsDistribution = {
      good: 0,
      needsImprovement: 0,
      poor: 0,
    };

    // Issue frequency counter
    const issueFrequency: Record<string, number> = {};

    for (const page of pages) {
      // Count issue types
      for (const issue of page.issues) {
        issuesByType[issue.type === 'error' ? 'errors' : issue.type === 'warning' ? 'warnings' : 'info']++;

        // Count by category
        issuesByCategory[issue.category] = (issuesByCategory[issue.category] || 0) + 1;

        // Track issue frequency
        issueFrequency[issue.message] = (issueFrequency[issue.message] || 0) + 1;
      }

      // Count CWV distribution based on LCP
      if (page.coreWebVitalsScore.lcp === 'good') {
        coreWebVitalsDistribution.good++;
      } else if (page.coreWebVitalsScore.lcp === 'needs-improvement') {
        coreWebVitalsDistribution.needsImprovement++;
      } else if (page.coreWebVitalsScore.lcp === 'poor') {
        coreWebVitalsDistribution.poor++;
      }
    }

    // Get top issues
    const topIssues = Object.entries(issueFrequency)
      .map(([message, count]) => ({ message, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    return {
      averageScore,
      issuesByType,
      issuesByCategory,
      coreWebVitalsDistribution,
      topIssues,
    };
  }

  private printSummary(report: CrawlReport): void {
    logger.divider();
    logger.header('Crawl Summary');
    logger.info(`Site: ${report.siteUrl}`);
    logger.info(`Pages crawled: ${report.crawledPages}/${report.totalPages}`);
    logger.info(`Failed: ${report.failedPages}`);
    logger.info(`Duration: ${formatDuration(report.duration)}`);
    logger.newLine();
    logger.info(`Average Score: ${Math.round(report.summary.averageScore)}/100`);
    logger.info(`Errors: ${report.summary.issuesByType.errors}`);
    logger.info(`Warnings: ${report.summary.issuesByType.warnings}`);
    logger.newLine();

    if (report.summary.topIssues.length > 0) {
      logger.info('Top Issues:');
      report.summary.topIssues.slice(0, 5).forEach((issue, i) => {
        logger.info(`  ${i + 1}. ${issue.message} (${issue.count} pages)`);
      });
    }

    // Cluster analysis summary
    if (report.clusters && report.clusters.totalClusters > 0) {
      logger.newLine();
      logger.info(`Page Clusters: ${report.clusters.totalClusters}`);

      if (report.clusters.worstPerformingClusters.length > 0) {
        logger.info('Clusters Needing Attention:');
        report.clusters.worstPerformingClusters.slice(0, 3).forEach((cluster, i) => {
          logger.info(`  ${i + 1}. ${cluster.pattern} (avg score: ${cluster.avgScore}, ${cluster.issueCount} issues)`);
        });
      }

      // Show template issues (site-wide problems)
      const templateIssueCount = report.clusters.clusters.reduce(
        (sum, c) => sum + c.templateIssues.length, 0
      );
      if (templateIssueCount > 0) {
        logger.warn(`Template Issues Found: ${templateIssueCount} (fix these to improve multiple pages at once)`);
      }
    }

    logger.divider();
  }
}

export default Crawler;
