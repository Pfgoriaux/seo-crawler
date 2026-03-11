import fs from 'fs';
import path from 'path';
import { CrawlReport } from '../types';
import logger from '../utils/logger';

/**
 * Stream write JSON for large reports to avoid "Invalid string length" error
 */
function streamWriteJson(filepath: string, report: CrawlReport): void {
  const stream = fs.createWriteStream(filepath, { encoding: 'utf-8' });

  // Write opening and metadata
  stream.write('{\n');
  stream.write(`  "siteUrl": ${JSON.stringify(report.siteUrl)},\n`);
  stream.write(`  "sitemapUrl": ${JSON.stringify(report.sitemapUrl)},\n`);
  stream.write(`  "crawlDate": ${JSON.stringify(report.crawlDate)},\n`);
  stream.write(`  "totalPages": ${report.totalPages},\n`);
  stream.write(`  "crawledPages": ${report.crawledPages},\n`);
  stream.write(`  "failedPages": ${report.failedPages},\n`);
  stream.write(`  "duration": ${report.duration},\n`);
  stream.write(`  "summary": ${JSON.stringify(report.summary, null, 2).split('\n').map((l, i) => i === 0 ? l : '  ' + l).join('\n')},\n`);

  // Write pages array incrementally
  stream.write('  "pages": [\n');
  report.pages.forEach((page, index) => {
    const pageJson = JSON.stringify(page, null, 2)
      .split('\n')
      .map((line, i) => i === 0 ? '    ' + line : '    ' + line)
      .join('\n');
    stream.write(pageJson);
    if (index < report.pages.length - 1) {
      stream.write(',\n');
    } else {
      stream.write('\n');
    }
  });
  stream.write('  ],\n');

  // Write clusters
  if (report.clusters) {
    stream.write(`  "clusters": ${JSON.stringify(report.clusters, null, 2).split('\n').map((l, i) => i === 0 ? l : '  ' + l).join('\n')}\n`);
  } else {
    stream.write('  "clusters": null\n');
  }

  stream.write('}\n');
  stream.end();
}

/**
 * Generate JSON report
 */
export async function generateJsonReport(
  report: CrawlReport,
  outputDir: string
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `seo-report-${timestamp}.json`;
  const filepath = path.join(outputDir, filename);

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Use streaming for large reports (>1000 pages)
  if (report.pages.length > 1000) {
    logger.info(`Large report (${report.pages.length} pages), using streaming write...`);
    streamWriteJson(filepath, report);
  } else {
    // Standard write for smaller reports
    fs.writeFileSync(filepath, JSON.stringify(report, null, 2), 'utf-8');
  }

  logger.success(`JSON report saved to: ${filepath}`);

  return filepath;
}

/**
 * Generate summary JSON report (lightweight version)
 */
export async function generateSummaryJsonReport(
  report: CrawlReport,
  outputDir: string
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `seo-summary-${timestamp}.json`;
  const filepath = path.join(outputDir, filename);

  // Create summary version
  const summary = {
    siteUrl: report.siteUrl,
    sitemapUrl: report.sitemapUrl,
    crawlDate: report.crawlDate,
    totalPages: report.totalPages,
    crawledPages: report.crawledPages,
    failedPages: report.failedPages,
    duration: report.duration,
    summary: report.summary,
    pages: report.pages.map((page) => ({
      url: page.url,
      statusCode: page.statusCode,
      loadTime: page.loadTime,
      score: page.score,
      issueCount: {
        errors: page.issues.filter((i) => i.type === 'error').length,
        warnings: page.issues.filter((i) => i.type === 'warning').length,
        info: page.issues.filter((i) => i.type === 'info').length,
      },
    })),
  };

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write report
  fs.writeFileSync(filepath, JSON.stringify(summary, null, 2), 'utf-8');
  logger.success(`Summary JSON report saved to: ${filepath}`);

  return filepath;
}

export default generateJsonReport;
