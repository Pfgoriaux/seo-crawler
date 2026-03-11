#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs';
import { Crawler } from './crawler';
import { CrawlerConfig, DEFAULT_CONFIG, CrawlReport } from './types';
import logger, { setLogLevel, LogLevel } from './utils/logger';
import { generateImprovementPlan, generateImprovementReport } from './agents';
import { getConfig } from './utils/config';

// Load environment configuration
const envConfig = getConfig();

const program = new Command();

program
  .name('seo-crawler')
  .description('Comprehensive SEO crawler with Core Web Vitals analysis and AI improvement suggestions')
  .version('1.0.0');

// Print banner helper
function printBanner(title: string, subtitle: string): void {
  console.log();
  console.log(chalk.cyan.bold('  ╔═══════════════════════════════════════╗'));
  console.log(chalk.cyan.bold(`  ║          ${title.padEnd(27)}║`));
  console.log(chalk.cyan.bold(`  ║   ${subtitle.padEnd(35)}║`));
  console.log(chalk.cyan.bold('  ╚═══════════════════════════════════════╝'));
  console.log();
}

// Crawl command (default)
program
  .command('crawl', { isDefault: true })
  .description('Crawl a website from its sitemap and generate SEO reports')
  .argument('<sitemap-url>', 'URL of the sitemap.xml to crawl')
  .option('-o, --output <dir>', 'Output directory for reports', envConfig.crawlerOutputDir)
  .option('-c, --concurrency <number>', 'Number of concurrent pages to crawl', String(envConfig.crawlerConcurrency))
  .option('-t, --timeout <ms>', 'Timeout for each page in milliseconds', String(envConfig.crawlerTimeout))
  .option('-f, --format <formats>', 'Output formats (json,html)', 'json,html')
  .option('-m, --max-pages <number>', 'Maximum number of pages to crawl')
  .option('-u, --user-agent <string>', 'Custom user agent string', envConfig.crawlerUserAgent)
  .option('--screenshots', 'Capture screenshots of each page', false)
  .option('--no-broken-links', 'Skip broken link checking')
  .option('--viewport-width <number>', 'Viewport width', String(envConfig.viewportWidth))
  .option('--viewport-height <number>', 'Viewport height', String(envConfig.viewportHeight))
  .option('-v, --verbose', 'Enable verbose logging')
  .option('-q, --quiet', 'Suppress all output except errors')
  .action(async (sitemapUrl: string, options) => {
    // Configure logging
    if (options.verbose || envConfig.debugMode) {
      setLogLevel(LogLevel.DEBUG);
    } else if (options.quiet) {
      setLogLevel(LogLevel.ERROR);
    }

    // Validate sitemap URL
    if (!sitemapUrl.startsWith('http://') && !sitemapUrl.startsWith('https://')) {
      console.error(chalk.red('Error: Sitemap URL must start with http:// or https://'));
      process.exit(1);
    }

    // Parse formats
    const formats = options.format.split(',').map((f: string) => f.trim().toLowerCase()) as ('json' | 'html')[];
    const validFormats = ['json', 'html'];
    for (const format of formats) {
      if (!validFormats.includes(format)) {
        console.error(chalk.red(`Error: Invalid format "${format}". Valid formats are: json, html`));
        process.exit(1);
      }
    }

    // Build config
    const config: CrawlerConfig = {
      sitemapUrl,
      outputDir: path.resolve(options.output),
      concurrency: parseInt(options.concurrency, 10) || DEFAULT_CONFIG.concurrency!,
      timeout: parseInt(options.timeout, 10) || DEFAULT_CONFIG.timeout!,
      userAgent: options.userAgent || DEFAULT_CONFIG.userAgent!,
      formats,
      maxPages: options.maxPages ? parseInt(options.maxPages, 10) : undefined,
      screenshotsEnabled: options.screenshots,
      checkBrokenLinks: options.brokenLinks !== false,
      viewport: {
        width: parseInt(options.viewportWidth, 10) || DEFAULT_CONFIG.viewport!.width,
        height: parseInt(options.viewportHeight, 10) || DEFAULT_CONFIG.viewport!.height,
      },
    };

    printBanner('SEO Crawler v1.0.0', 'Core Web Vitals & SEO Analysis');

    // Run crawler
    const spinner = ora('Initializing crawler...').start();

    try {
      const crawler = new Crawler(config);
      spinner.succeed('Crawler initialized');

      const report = await crawler.run();

      // Final success message
      console.log();
      console.log(chalk.green.bold('✓ Crawl completed successfully!'));
      console.log();
      console.log(chalk.white(`  Reports saved to: ${chalk.cyan(config.outputDir)}`));
      console.log();

      // Exit with appropriate code based on errors
      if (report.summary.issuesByType.errors > 0) {
        process.exit(1);
      }
      process.exit(0);
    } catch (error) {
      spinner.fail('Crawl failed');
      console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// Improve command - generates improvement plan from existing report
program
  .command('improve')
  .description('Generate AI-powered improvement suggestions from a crawl report')
  .argument('<report-file>', 'Path to the JSON crawl report file')
  .option('-o, --output <dir>', 'Output directory for improvement plan', envConfig.crawlerOutputDir)
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (reportFile: string, options) => {
    // Configure logging
    if (options.verbose) {
      setLogLevel(LogLevel.DEBUG);
    }

    printBanner('SEO Improvement Agent', 'AI-Powered Optimization');

    const spinner = ora('Loading crawl report...').start();

    try {
      // Load and parse the report file
      const reportPath = path.resolve(reportFile);

      if (!fs.existsSync(reportPath)) {
        spinner.fail('Report file not found');
        console.error(chalk.red(`\nError: File not found: ${reportPath}`));
        process.exit(1);
      }

      const reportContent = fs.readFileSync(reportPath, 'utf-8');
      const report: CrawlReport = JSON.parse(reportContent);

      spinner.succeed(`Loaded report for ${report.siteUrl} (${report.crawledPages} pages)`);

      // Generate improvement plan
      const planSpinner = ora('Analyzing issues and generating improvement plan...').start();

      const improvementPlan = generateImprovementPlan(report);

      planSpinner.succeed('Improvement plan generated');

      // Display summary
      console.log();
      logger.header('Improvement Plan Summary');
      logger.info(`Site: ${improvementPlan.siteUrl}`);
      logger.info(`Total Issues: ${improvementPlan.summary.totalIssues}`);
      logger.info(`Critical Issues: ${improvementPlan.summary.criticalIssues}`);
      logger.info(`Estimated Score Improvement: +${improvementPlan.summary.estimatedScoreImprovement} points`);
      console.log();

      // Show top prioritized actions
      if (improvementPlan.prioritizedActions.length > 0) {
        logger.info('Top Prioritized Actions:');
        improvementPlan.prioritizedActions.slice(0, 5).forEach((action, i) => {
          logger.info(`  ${i + 1}. [${action.effort}] ${action.action.substring(0, 70)}...`);
          logger.info(`     Impact: ${action.impact.substring(0, 60)}...`);
        });
        console.log();
      }

      // Generate reports
      const reportSpinner = ora('Generating improvement reports...').start();
      const outputDir = path.resolve(options.output);
      const { jsonPath, htmlPath } = await generateImprovementReport(improvementPlan, outputDir);
      reportSpinner.succeed('Reports generated');

      // Final success message
      console.log();
      console.log(chalk.green.bold('✓ Improvement plan generated successfully!'));
      console.log();
      console.log(chalk.white(`  JSON report: ${chalk.cyan(jsonPath)}`));
      console.log(chalk.white(`  HTML report: ${chalk.cyan(htmlPath)}`));
      console.log();

      process.exit(0);
    } catch (error) {
      spinner.fail('Failed to generate improvement plan');
      console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// Parse arguments
program.parse();
