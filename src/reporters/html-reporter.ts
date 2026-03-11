import fs from 'fs';
import path from 'path';
import { CrawlReport, PageAnalysis, Issue, ClusterAnalysis, ClusterSummary } from '../types';
import logger from '../utils/logger';
import { formatBytes, formatDuration, sanitizeHtml, truncate } from '../utils/helpers';

// Maximum pages to show in detail in HTML report (to avoid memory issues)
const MAX_PAGES_IN_TABLE = 500;
const MAX_PAGES_IN_DETAIL = 100;

/**
 * Generate HTML report
 */
export async function generateHtmlReport(
  report: CrawlReport,
  outputDir: string
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `seo-report-${timestamp}.html`;
  const filepath = path.join(outputDir, filename);

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // For large reports, create a limited version to avoid memory issues
  let reportToRender = report;
  let isLargeReport = false;

  if (report.pages.length > MAX_PAGES_IN_TABLE) {
    isLargeReport = true;
    logger.info(`Large report (${report.pages.length} pages), limiting HTML to worst ${MAX_PAGES_IN_DETAIL} pages...`);

    // Sort by score (worst first) and take top pages
    const sortedPages = [...report.pages].sort((a, b) => a.score.overall - b.score.overall);

    reportToRender = {
      ...report,
      pages: sortedPages.slice(0, MAX_PAGES_IN_TABLE),
    };
  }

  const html = generateHtml(reportToRender, isLargeReport, report.pages.length);
  fs.writeFileSync(filepath, html, 'utf-8');
  logger.success(`HTML report saved to: ${filepath}`);

  return filepath;
}

function generateHtml(report: CrawlReport, isLargeReport: boolean = false, totalPages: number = 0): string {
  const actualTotalPages = totalPages || report.pages.length;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SEO Report - ${sanitizeHtml(report.siteUrl)}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    :root {
      --primary: #2563eb;
      --success: #16a34a;
      --warning: #ca8a04;
      --error: #dc2626;
      --gray-50: #f9fafb;
      --gray-100: #f3f4f6;
      --gray-200: #e5e7eb;
      --gray-300: #d1d5db;
      --gray-600: #4b5563;
      --gray-800: #1f2937;
      --gray-900: #111827;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--gray-50);
      color: var(--gray-800);
      line-height: 1.6;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
    }

    header {
      background: linear-gradient(135deg, var(--primary), #1d4ed8);
      color: white;
      padding: 40px 20px;
      margin-bottom: 30px;
    }

    header h1 {
      font-size: 2rem;
      margin-bottom: 10px;
    }

    header .meta {
      opacity: 0.9;
      font-size: 0.9rem;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .card h2 {
      font-size: 0.875rem;
      color: var(--gray-600);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
    }

    .card .value {
      font-size: 2.5rem;
      font-weight: 700;
    }

    .card .value.good { color: var(--success); }
    .card .value.warning { color: var(--warning); }
    .card .value.error { color: var(--error); }

    .score-ring {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
      font-weight: 700;
      margin: 0 auto;
    }

    .score-ring.good {
      background: conic-gradient(var(--success) calc(var(--score) * 1%), var(--gray-200) 0);
    }
    .score-ring.warning {
      background: conic-gradient(var(--warning) calc(var(--score) * 1%), var(--gray-200) 0);
    }
    .score-ring.error {
      background: conic-gradient(var(--error) calc(var(--score) * 1%), var(--gray-200) 0);
    }

    .score-ring::before {
      content: '';
      width: 100px;
      height: 100px;
      background: white;
      border-radius: 50%;
      position: absolute;
    }

    .score-ring span {
      position: relative;
      z-index: 1;
    }

    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .chart-container {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .chart-container h3 {
      margin-bottom: 20px;
      color: var(--gray-800);
    }

    .issues-section {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      margin-bottom: 30px;
    }

    .issues-section h3 {
      margin-bottom: 20px;
    }

    .issue-list {
      list-style: none;
    }

    .issue-item {
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .issue-item.error { background: #fef2f2; border-left: 4px solid var(--error); }
    .issue-item.warning { background: #fefce8; border-left: 4px solid var(--warning); }
    .issue-item.info { background: #eff6ff; border-left: 4px solid var(--primary); }

    .issue-badge {
      font-size: 0.75rem;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .issue-badge.error { background: var(--error); color: white; }
    .issue-badge.warning { background: var(--warning); color: white; }
    .issue-badge.info { background: var(--primary); color: white; }

    .issue-count {
      margin-left: auto;
      font-weight: 600;
      color: var(--gray-600);
    }

    /* Expandable top issues */
    .top-issue-item {
      cursor: pointer;
      transition: background 0.2s;
    }

    .top-issue-item:hover {
      filter: brightness(0.97);
    }

    .top-issue-item .expand-icon {
      transition: transform 0.2s;
      font-size: 12px;
      margin-right: 8px;
    }

    .top-issue-item.expanded .expand-icon {
      transform: rotate(90deg);
    }

    .affected-urls {
      display: none;
      margin: 8px 0 0 32px;
      padding: 12px;
      background: rgba(0,0,0,0.03);
      border-radius: 6px;
      max-height: 200px;
      overflow-y: auto;
    }

    .affected-urls.open {
      display: block;
    }

    .affected-urls a {
      display: block;
      color: var(--primary);
      text-decoration: none;
      padding: 4px 0;
      font-size: 0.85rem;
      word-break: break-all;
    }

    .affected-urls a:hover {
      text-decoration: underline;
    }

    /* Tooltips */
    .tooltip-wrapper {
      position: relative;
      display: inline-block;
    }

    .metric[data-tooltip] {
      cursor: help;
      position: relative;
    }

    .metric[data-tooltip]::after {
      content: attr(data-tooltip);
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      background: var(--gray-900);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 400;
      white-space: normal;
      width: max-content;
      max-width: 250px;
      text-align: center;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.2s, visibility 0.2s;
      z-index: 100;
      pointer-events: none;
      line-height: 1.4;
    }

    .metric[data-tooltip]::before {
      content: '';
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      border: 6px solid transparent;
      border-top-color: var(--gray-900);
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.2s, visibility 0.2s;
      z-index: 100;
    }

    .metric[data-tooltip]:hover::after,
    .metric[data-tooltip]:hover::before {
      opacity: 1;
      visibility: visible;
    }

    .metric .metric-label {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }

    .metric .info-icon {
      font-size: 10px;
      color: var(--gray-400);
    }

    .pages-table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .pages-table th {
      background: var(--gray-100);
      padding: 16px;
      text-align: left;
      font-weight: 600;
      color: var(--gray-600);
      font-size: 0.875rem;
    }

    .pages-table td {
      padding: 16px;
      border-top: 1px solid var(--gray-200);
    }

    .pages-table tr:hover {
      background: var(--gray-50);
    }

    .url-cell {
      max-width: 400px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .url-cell a {
      color: var(--primary);
      text-decoration: none;
    }

    .url-cell a:hover {
      text-decoration: underline;
    }

    .score-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-weight: 600;
      font-size: 0.875rem;
    }

    .score-badge.good { background: #dcfce7; color: var(--success); }
    .score-badge.warning { background: #fef9c3; color: var(--warning); }
    .score-badge.error { background: #fee2e2; color: var(--error); }

    .status-code {
      font-family: monospace;
      font-weight: 600;
    }

    .status-code.success { color: var(--success); }
    .status-code.redirect { color: var(--warning); }
    .status-code.error { color: var(--error); }

    .collapsible {
      cursor: pointer;
    }

    .collapsible-content {
      display: none;
      padding: 16px;
      background: var(--gray-50);
    }

    .collapsible-content.open {
      display: block;
    }

    .page-details {
      margin-top: 30px;
    }

    .page-detail-card {
      background: white;
      border-radius: 12px;
      margin-bottom: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      overflow: hidden;
    }

    .page-detail-header {
      padding: 16px 24px;
      background: var(--gray-100);
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
    }

    .page-detail-header:hover {
      background: var(--gray-200);
    }

    .page-detail-body {
      padding: 24px;
      display: none;
    }

    .page-detail-body.open {
      display: block;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .metric {
      text-align: center;
      padding: 16px;
      background: var(--gray-50);
      border-radius: 8px;
    }

    .metric-label {
      font-size: 0.75rem;
      color: var(--gray-600);
      text-transform: uppercase;
      margin-bottom: 4px;
    }

    .metric-value {
      font-size: 1.5rem;
      font-weight: 700;
    }

    footer {
      text-align: center;
      padding: 40px;
      color: var(--gray-600);
      font-size: 0.875rem;
    }

    /* Cluster Analysis Styles */
    .clusters-section {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      margin-bottom: 30px;
    }

    .clusters-section h3 {
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .cluster-badge {
      background: var(--primary);
      color: white;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .cluster-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 20px;
    }

    .cluster-card {
      background: var(--gray-50);
      border-radius: 10px;
      padding: 20px;
      border: 1px solid var(--gray-200);
      transition: box-shadow 0.2s;
    }

    .cluster-card:hover {
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }

    .cluster-card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
      cursor: pointer;
    }

    .cluster-card-header h4 {
      font-size: 1.1rem;
      color: var(--gray-800);
      margin: 0;
    }

    .cluster-card-header .page-count {
      color: var(--gray-600);
      font-size: 0.85rem;
    }

    .cluster-score {
      text-align: right;
    }

    .cluster-score .score-value {
      font-size: 1.5rem;
      font-weight: 700;
    }

    .cluster-score .score-range {
      font-size: 0.75rem;
      color: var(--gray-600);
    }

    .cluster-stats {
      display: flex;
      gap: 16px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .cluster-stat {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.85rem;
    }

    .cluster-stat.errors { color: var(--error); }
    .cluster-stat.warnings { color: var(--warning); }
    .cluster-stat.template { color: var(--primary); }

    .template-issues-section {
      background: #fef3c7;
      border: 1px solid #fbbf24;
      border-radius: 8px;
      padding: 12px;
      margin-top: 12px;
    }

    .template-issues-section h5 {
      color: #92400e;
      font-size: 0.85rem;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .template-issue-item {
      font-size: 0.8rem;
      color: #78350f;
      padding: 4px 0;
      border-bottom: 1px solid rgba(251, 191, 36, 0.3);
    }

    .template-issue-item:last-child {
      border-bottom: none;
    }

    .template-issue-item .percentage {
      font-weight: 600;
      margin-left: 4px;
    }

    .cluster-details {
      display: none;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--gray-200);
    }

    .cluster-details.open {
      display: block;
    }

    .cluster-pages-list {
      max-height: 150px;
      overflow-y: auto;
      font-size: 0.8rem;
    }

    .cluster-pages-list a {
      display: block;
      color: var(--primary);
      text-decoration: none;
      padding: 4px 0;
      word-break: break-all;
    }

    .cluster-pages-list a:hover {
      text-decoration: underline;
    }

    .site-wide-issues {
      background: #fef2f2;
      border: 1px solid #fca5a5;
      border-radius: 10px;
      padding: 20px;
      margin-top: 20px;
    }

    .site-wide-issues h4 {
      color: #991b1b;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .site-wide-issue-item {
      background: white;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.9rem;
    }

    .site-wide-issue-item:last-child {
      margin-bottom: 0;
    }

    .site-wide-issue-item .issue-text {
      color: var(--gray-800);
      flex: 1;
    }

    .site-wide-issue-item .issue-meta {
      display: flex;
      gap: 16px;
      font-size: 0.8rem;
      color: var(--gray-600);
    }

    @media (max-width: 768px) {
      .summary-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .charts-grid {
        grid-template-columns: 1fr;
      }

      .pages-table {
        display: block;
        overflow-x: auto;
      }

      .cluster-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <header>
    <div class="container">
      <h1>SEO Audit Report</h1>
      <div class="meta">
        <strong>${sanitizeHtml(report.siteUrl)}</strong><br>
        Crawled on ${new Date(report.crawlDate).toLocaleString()} •
        ${report.crawledPages} pages analyzed in ${formatDuration(report.duration)}
      </div>
    </div>
  </header>

  <div class="container">
    <!-- Summary Cards -->
    <div class="summary-grid">
      <div class="card">
        <h2>Overall Score</h2>
        <div class="value ${getScoreClass(report.summary.averageScore)}">${Math.round(report.summary.averageScore)}</div>
      </div>
      <div class="card">
        <h2>Pages Crawled</h2>
        <div class="value">${report.crawledPages}</div>
      </div>
      <div class="card">
        <h2>Errors</h2>
        <div class="value error">${report.summary.issuesByType.errors}</div>
      </div>
      <div class="card">
        <h2>Warnings</h2>
        <div class="value warning">${report.summary.issuesByType.warnings}</div>
      </div>
    </div>

    <!-- Charts -->
    <div class="charts-grid">
      <div class="chart-container">
        <h3>Core Web Vitals Distribution</h3>
        <canvas id="cwvChart"></canvas>
      </div>
      <div class="chart-container">
        <h3>Issues by Category</h3>
        <canvas id="issuesChart"></canvas>
      </div>
    </div>

    <!-- Cluster Analysis -->
    ${report.clusters ? generateClusterSection(report.clusters) : ''}

    <!-- Top Issues -->
    <div class="issues-section">
      <h3>Top Issues <span style="font-weight: normal; font-size: 0.85rem; color: var(--gray-600);">(click to see affected pages)</span></h3>
      <ul class="issue-list">
        ${report.summary.topIssues.slice(0, 10).map((issue, idx) => {
          const affectedUrls = report.pages
            .filter(page => page.issues.some(i => i.message === issue.message))
            .map(page => page.url);
          return `
          <li class="issue-item warning top-issue-item" onclick="toggleIssue(${idx})">
            <span class="expand-icon">▶</span>
            <span class="issue-badge warning">Issue</span>
            <span>${sanitizeHtml(issue.message)}</span>
            <span class="issue-count">${issue.count} pages</span>
          </li>
          <div class="affected-urls" id="issue-urls-${idx}">
            ${affectedUrls.map(url => `<a href="${sanitizeHtml(url)}" target="_blank">${sanitizeHtml(url)}</a>`).join('')}
          </div>
        `}).join('')}
      </ul>
    </div>

    <!-- Pages Table -->
    <h3 style="margin-bottom: 16px;">All Pages</h3>
    <table class="pages-table">
      <thead>
        <tr>
          <th>URL</th>
          <th>Status</th>
          <th>Score</th>
          <th>LCP</th>
          <th>CLS</th>
          <th>Errors</th>
          <th>Warnings</th>
        </tr>
      </thead>
      <tbody>
        ${report.pages.map(page => `
          <tr>
            <td class="url-cell">
              <a href="${sanitizeHtml(page.url)}" target="_blank">${sanitizeHtml(truncate(page.url, 60))}</a>
            </td>
            <td>
              <span class="status-code ${getStatusClass(page.statusCode)}">${page.statusCode}</span>
            </td>
            <td>
              <span class="score-badge ${getScoreClass(page.score.overall)}">${page.score.overall}</span>
            </td>
            <td>${page.coreWebVitals.lcp ? (page.coreWebVitals.lcp / 1000).toFixed(2) + 's' : 'N/A'}</td>
            <td>${page.coreWebVitals.cls !== null ? page.coreWebVitals.cls.toFixed(3) : 'N/A'}</td>
            <td>${page.issues.filter(i => i.type === 'error').length}</td>
            <td>${page.issues.filter(i => i.type === 'warning').length}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- Page Details -->
    <div class="page-details">
      <h3 style="margin-bottom: 16px;">Page Details ${isLargeReport ? `(showing ${Math.min(report.pages.length, MAX_PAGES_IN_DETAIL)} worst-performing of ${actualTotalPages} total pages)` : ''}</h3>
      ${isLargeReport ? `
        <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <strong>⚠️ Large Report Notice:</strong> This report contains ${actualTotalPages.toLocaleString()} pages.
          Only the ${Math.min(report.pages.length, MAX_PAGES_IN_DETAIL)} worst-performing pages are shown in detail below.
          For full data, see the JSON report.
        </div>
      ` : ''}
      ${report.pages.slice(0, MAX_PAGES_IN_DETAIL).map((page, index) => generatePageDetail(page, index)).join('')}
    </div>
  </div>

  <footer>
    Generated by SEO Crawler • ${new Date().toISOString()}
  </footer>

  <script>
    // Core Web Vitals Chart
    new Chart(document.getElementById('cwvChart'), {
      type: 'doughnut',
      data: {
        labels: ['Good', 'Needs Improvement', 'Poor'],
        datasets: [{
          data: [${report.summary.coreWebVitalsDistribution.good}, ${report.summary.coreWebVitalsDistribution.needsImprovement}, ${report.summary.coreWebVitalsDistribution.poor}],
          backgroundColor: ['#16a34a', '#ca8a04', '#dc2626']
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });

    // Issues by Category Chart
    new Chart(document.getElementById('issuesChart'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(Object.keys(report.summary.issuesByCategory))},
        datasets: [{
          label: 'Issues',
          data: ${JSON.stringify(Object.values(report.summary.issuesByCategory))},
          backgroundColor: '#2563eb'
        }]
      },
      options: {
        responsive: true,
        indexAxis: 'y',
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });

    // Toggle page details
    document.querySelectorAll('.page-detail-header').forEach(header => {
      header.addEventListener('click', () => {
        const body = header.nextElementSibling;
        body.classList.toggle('open');
      });
    });

    // Toggle top issues to show affected URLs
    function toggleIssue(idx) {
      const issueItem = document.querySelectorAll('.top-issue-item')[idx];
      const urlsList = document.getElementById('issue-urls-' + idx);
      issueItem.classList.toggle('expanded');
      urlsList.classList.toggle('open');
    }

    // Toggle cluster details
    function toggleCluster(idx) {
      const details = document.getElementById('cluster-details-' + idx);
      details.classList.toggle('open');
    }
  </script>
</body>
</html>`;
}

function generateClusterSection(clusters: ClusterSummary): string {
  if (!clusters || clusters.totalClusters === 0) {
    return '';
  }

  return `
    <div class="clusters-section">
      <h3>
        Cluster Analysis
        <span class="cluster-badge">${clusters.totalClusters} clusters</span>
      </h3>
      <p style="margin-bottom: 20px; color: var(--gray-600); font-size: 0.9rem;">
        Pages grouped by URL pattern. Template issues appear in 80%+ of pages in a cluster - fixing the template fixes all pages.
      </p>

      <div class="cluster-grid">
        ${clusters.clusters.map((cluster, idx) => generateClusterCard(cluster, idx)).join('')}
      </div>

      ${clusters.siteWideIssues.length > 0 ? `
        <div class="site-wide-issues">
          <h4>
            <span style="font-size: 1.2rem;">⚠️</span>
            Site-Wide Issues (appear across multiple clusters)
          </h4>
          ${clusters.siteWideIssues.slice(0, 5).map(issue => `
            <div class="site-wide-issue-item">
              <span class="issue-text">${sanitizeHtml(issue.message)}</span>
              <div class="issue-meta">
                <span>${issue.affectedClusters} clusters</span>
                <span>${issue.totalAffectedPages} pages</span>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

function generateClusterCard(cluster: ClusterAnalysis, index: number): string {
  const scoreClass = getScoreClass(cluster.avgScore);

  return `
    <div class="cluster-card">
      <div class="cluster-card-header" onclick="toggleCluster(${index})">
        <div>
          <h4>${sanitizeHtml(cluster.patternDisplay)}</h4>
          <span class="page-count">${cluster.pageCount} page${cluster.pageCount !== 1 ? 's' : ''} • ${sanitizeHtml(cluster.pattern)}</span>
        </div>
        <div class="cluster-score">
          <div class="score-value ${scoreClass}">${cluster.avgScore}</div>
          <div class="score-range">${cluster.minScore} - ${cluster.maxScore}</div>
        </div>
      </div>

      <div class="cluster-stats">
        <span class="cluster-stat errors">
          <strong>${cluster.issueDistribution.errors}</strong> errors
        </span>
        <span class="cluster-stat warnings">
          <strong>${cluster.issueDistribution.warnings}</strong> warnings
        </span>
        ${cluster.templateIssues.length > 0 ? `
          <span class="cluster-stat template">
            <strong>${cluster.templateIssues.length}</strong> template issues
          </span>
        ` : ''}
      </div>

      ${cluster.templateIssues.length > 0 ? `
        <div class="template-issues-section">
          <h5>
            <span>🔧</span>
            Template Issues (fix once, improve all ${cluster.pageCount} pages)
          </h5>
          ${cluster.templateIssues.map(ti => `
            <div class="template-issue-item">
              ${sanitizeHtml(ti.issue.message)}
              <span class="percentage">(${ti.percentage}%)</span>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div class="cluster-details" id="cluster-details-${index}">
        <h5 style="margin-bottom: 8px; font-size: 0.85rem; color: var(--gray-600);">Pages in this cluster:</h5>
        <div class="cluster-pages-list">
          ${cluster.pages.map(url => `
            <a href="${sanitizeHtml(url)}" target="_blank">${sanitizeHtml(truncate(url, 80))}</a>
          `).join('')}
        </div>

        ${cluster.commonIssues.length > 0 ? `
          <h5 style="margin: 16px 0 8px 0; font-size: 0.85rem; color: var(--gray-600);">Common Issues:</h5>
          <ul style="list-style: none; padding: 0; margin: 0;">
            ${cluster.commonIssues.map(ci => `
              <li style="font-size: 0.8rem; padding: 4px 0; border-bottom: 1px solid var(--gray-200);">
                <span class="issue-badge ${ci.issue.type}" style="font-size: 0.65rem; padding: 1px 6px;">${ci.issue.type}</span>
                ${sanitizeHtml(ci.issue.message)}
                <span style="color: var(--gray-500);">(${ci.affectedCount} pages, ${ci.percentage}%)</span>
              </li>
            `).join('')}
          </ul>
        ` : ''}
      </div>
    </div>
  `;
}

function generatePageDetail(page: PageAnalysis, index: number): string {
  return `
    <div class="page-detail-card">
      <div class="page-detail-header">
        <div>
          <strong>${sanitizeHtml(truncate(page.url, 80))}</strong>
          <span class="score-badge ${getScoreClass(page.score.overall)}" style="margin-left: 12px;">${page.score.overall}</span>
        </div>
        <span>${page.issues.length} issues</span>
      </div>
      <div class="page-detail-body">
        <div class="metrics-grid">
          <div class="metric" data-tooltip="Largest Contentful Paint: Time to render the largest visible content. ✓ Good: ≤2.5s | ⚠ Needs improvement: ≤4s | ✗ Poor: >4s">
            <div class="metric-label">LCP <span class="info-icon">ⓘ</span></div>
            <div class="metric-value ${getCwvClass(page.coreWebVitalsScore.lcp)}">${page.coreWebVitals.lcp ? (page.coreWebVitals.lcp / 1000).toFixed(2) + 's' : 'N/A'}</div>
          </div>
          <div class="metric" data-tooltip="First Input Delay: Time from user interaction to browser response. ✓ Good: ≤100ms | ⚠ Needs improvement: ≤300ms | ✗ Poor: >300ms">
            <div class="metric-label">FID <span class="info-icon">ⓘ</span></div>
            <div class="metric-value ${getCwvClass(page.coreWebVitalsScore.fid)}">${page.coreWebVitals.fid ? page.coreWebVitals.fid.toFixed(0) + 'ms' : 'N/A'}</div>
          </div>
          <div class="metric" data-tooltip="Cumulative Layout Shift: Visual stability score. ✓ Good: ≤0.1 | ⚠ Needs improvement: ≤0.25 | ✗ Poor: >0.25">
            <div class="metric-label">CLS <span class="info-icon">ⓘ</span></div>
            <div class="metric-value ${getCwvClass(page.coreWebVitalsScore.cls)}">${page.coreWebVitals.cls !== null ? page.coreWebVitals.cls.toFixed(3) : 'N/A'}</div>
          </div>
          <div class="metric" data-tooltip="Total time from navigation start to page fully loaded. ✓ Good: <3s | ⚠ Okay: 3-5s | ✗ Slow: >5s">
            <div class="metric-label">Load Time <span class="info-icon">ⓘ</span></div>
            <div class="metric-value">${(page.loadTime / 1000).toFixed(2)}s</div>
          </div>
          <div class="metric" data-tooltip="Total size of all resources (HTML, CSS, JS, images, fonts). ✓ Good: <1MB | ⚠ Okay: 1-3MB | ✗ Heavy: >3MB">
            <div class="metric-label">Page Size <span class="info-icon">ⓘ</span></div>
            <div class="metric-value">${formatBytes(page.performance.totalResourceSize)}</div>
          </div>
          <div class="metric" data-tooltip="Number of HTTP requests made to load the page. ✓ Good: <50 | ⚠ Okay: 50-100 | ✗ Too many: >100">
            <div class="metric-label">Requests <span class="info-icon">ⓘ</span></div>
            <div class="metric-value">${page.performance.resourceCount.total}</div>
          </div>
        </div>

        <h4 style="margin-bottom: 12px;">Category Scores</h4>
        <div class="metrics-grid" style="margin-bottom: 24px;">
          <div class="metric" data-tooltip="Google's Core Web Vitals: LCP, FID, CLS. Key ranking factors measuring loading, interactivity, and visual stability. ✓ Good: 90-100 | ⚠ Okay: 50-89 | ✗ Poor: <50">
            <div class="metric-label">Core Web Vitals <span class="info-icon">ⓘ</span></div>
            <div class="metric-value ${getScoreClass(page.score.coreWebVitals)}">${page.score.coreWebVitals}</div>
          </div>
          <div class="metric" data-tooltip="Title tag, meta description, viewport, canonical URL, Open Graph tags. Essential for search rankings and social sharing. ✓ Good: 90-100 | ⚠ Okay: 50-89 | ✗ Poor: <50">
            <div class="metric-label">Meta Tags <span class="info-icon">ⓘ</span></div>
            <div class="metric-value ${getScoreClass(page.score.metaTags)}">${page.score.metaTags}</div>
          </div>
          <div class="metric" data-tooltip="HTTPS, robots directives, canonical URLs, redirects. Technical foundation for search engine crawling and indexing. ✓ Good: 90-100 | ⚠ Okay: 50-89 | ✗ Poor: <50">
            <div class="metric-label">Technical SEO <span class="info-icon">ⓘ</span></div>
            <div class="metric-value ${getScoreClass(page.score.technicalSeo)}">${page.score.technicalSeo}</div>
          </div>
          <div class="metric" data-tooltip="Heading hierarchy (H1-H6), image alt attributes, SEO-friendly URLs. Proper HTML structure helps search engines understand content. ✓ Good: 90-100 | ⚠ Okay: 50-89 | ✗ Poor: <50">
            <div class="metric-label">Structure <span class="info-icon">ⓘ</span></div>
            <div class="metric-value ${getScoreClass(page.score.documentStructure)}">${page.score.documentStructure}</div>
          </div>
          <div class="metric" data-tooltip="Internal and external links, broken link detection. Good internal linking improves crawlability and distributes page authority. ✓ Good: 90-100 | ⚠ Okay: 50-89 | ✗ Poor: <50">
            <div class="metric-label">Links <span class="info-icon">ⓘ</span></div>
            <div class="metric-value ${getScoreClass(page.score.links)}">${page.score.links}</div>
          </div>
          <div class="metric" data-tooltip="Page size, resource count, compression, caching. Faster pages rank better and provide better user experience. ✓ Good: 90-100 | ⚠ Okay: 50-89 | ✗ Poor: <50">
            <div class="metric-label">Performance <span class="info-icon">ⓘ</span></div>
            <div class="metric-value ${getScoreClass(page.score.performance)}">${page.score.performance}</div>
          </div>
          <div class="metric" data-tooltip="Viewport meta tag, tap target sizes, font sizes, no Flash/plugins. Mobile-first indexing requires mobile-optimized pages. ✓ Good: 90-100 | ⚠ Okay: 50-89 | ✗ Poor: <50">
            <div class="metric-label">Mobile <span class="info-icon">ⓘ</span></div>
            <div class="metric-value ${getScoreClass(page.score.mobileFriendliness)}">${page.score.mobileFriendliness}</div>
          </div>
          <div class="metric" data-tooltip="JSON-LD and microdata (Schema.org). Enables rich snippets in search results like ratings, prices, and FAQs. ✓ Good: 90-100 | ⚠ Okay: 50-89 | ✗ Poor: <50">
            <div class="metric-label">Structured Data <span class="info-icon">ⓘ</span></div>
            <div class="metric-value ${getScoreClass(page.score.structuredData)}">${page.score.structuredData}</div>
          </div>
        </div>

        <h4 style="margin-bottom: 12px;">Advanced Analysis Scores</h4>
        <div class="metrics-grid" style="margin-bottom: 24px;">
          <div class="metric" data-tooltip="Flesch-Kincaid readability analysis. Ideal web content is 8th-10th grade level. Too complex or too simple loses points. ✓ Good: 90-100 | ⚠ Okay: 50-89 | ✗ Poor: <50">
            <div class="metric-label">Readability <span class="info-icon">ⓘ</span></div>
            <div class="metric-value ${getScoreClass(page.score.readability)}">${page.score.readability}</div>
          </div>
          <div class="metric" data-tooltip="Experience, Expertise, Authoritativeness, Trustworthiness. Checks for author info, citations, trust signals, contact details. ✓ Good: 90-100 | ⚠ Okay: 50-89 | ✗ Poor: <50">
            <div class="metric-label">E-E-A-T <span class="info-icon">ⓘ</span></div>
            <div class="metric-value ${getScoreClass(page.score.eeat)}">${page.score.eeat}</div>
          </div>
          <div class="metric" data-tooltip="HTTP security headers (CSP, HSTS, X-Frame-Options, etc.). Protects against XSS, clickjacking attacks. ✓ Good: 90-100 | ⚠ Okay: 50-89 | ✗ Poor: <50">
            <div class="metric-label">Security <span class="info-icon">ⓘ</span></div>
            <div class="metric-value ${getScoreClass(page.score.securityHeaders)}">${page.score.securityHeaders}</div>
          </div>
          <div class="metric" data-tooltip="Content freshness: publication date, last modified, copyright year. Fresh content ranks better for time-sensitive queries. ✓ Good: 90-100 | ⚠ Okay: 50-89 | ✗ Poor: <50">
            <div class="metric-label">Freshness <span class="info-icon">ⓘ</span></div>
            <div class="metric-value ${getScoreClass(page.score.contentFreshness)}">${page.score.contentFreshness}</div>
          </div>
          <div class="metric" data-tooltip="Optimization for AI/LLM citation. Clear structure, factual content, proper attribution help AI reference your content. ✓ Good: 90-100 | ⚠ Okay: 50-89 | ✗ Poor: <50">
            <div class="metric-label">AI Citation <span class="info-icon">ⓘ</span></div>
            <div class="metric-value ${getScoreClass(page.score.aiCitation)}">${page.score.aiCitation}</div>
          </div>
          <div class="metric" data-tooltip="Third-party scripts impact (analytics, ads, widgets). Too many scripts slow pages and hurt Core Web Vitals. ✓ Good: 90-100 (few scripts) | ⚠ Okay: 50-89 | ✗ Poor: <50 (too many)">
            <div class="metric-label">3rd Party <span class="info-icon">ⓘ</span></div>
            <div class="metric-value ${getScoreClass(page.score.thirdParty)}">${page.score.thirdParty}</div>
          </div>
          <div class="metric" data-tooltip="JavaScript rendering analysis. Content added via JS may not be indexed. Server-side rendering preferred. ✓ Good: 90-100 (minimal JS content) | ⚠ Okay: 50-89 | ✗ Poor: <50 (heavy JS)">
            <div class="metric-label">JS Rendering <span class="info-icon">ⓘ</span></div>
            <div class="metric-value ${getScoreClass(page.score.jsRendering)}">${page.score.jsRendering}</div>
          </div>
          <div class="metric" data-tooltip="Redirect chain analysis. Multiple redirects slow loading and dilute link equity. ✓ Good: 100 (0 redirects) | ⚠ Okay: 80 (1 redirect) | ✗ Poor: <80 (2+ redirects)">
            <div class="metric-label">Redirects <span class="info-icon">ⓘ</span></div>
            <div class="metric-value ${getScoreClass(page.score.redirectChain)}">${page.score.redirectChain}</div>
          </div>
          <div class="metric" data-tooltip="Interaction to Next Paint: Responsiveness to user interactions. Replacing FID as Core Web Vital in 2024. ✓ Good: 90-100 (≤200ms) | ⚠ Okay: 50-89 (≤500ms) | ✗ Poor: <50 (>500ms)">
            <div class="metric-label">INP <span class="info-icon">ⓘ</span></div>
            <div class="metric-value ${getScoreClass(page.score.inp)}">${page.score.inp}</div>
          </div>
          <div class="metric" data-tooltip="Hreflang tag validation for multi-language sites. Ensures proper language/region targeting. ✓ Good: 100 (valid or N/A) | ⚠ Okay: 50-99 (minor issues) | ✗ Poor: <50 (invalid tags)">
            <div class="metric-label">Hreflang <span class="info-icon">ⓘ</span></div>
            <div class="metric-value ${getScoreClass(page.score.hreflang)}">${page.score.hreflang}</div>
          </div>
        </div>

        ${page.securityHeaders ? `
          <h4 style="margin-bottom: 12px;">Security Headers Details - Grade ${page.securityHeaders.overallGrade}</h4>
          <div style="margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px;">
              <thead>
                <tr style="background: #f5f5f5;">
                  <th style="padding: 8px; text-align: left; border-bottom: 2px solid #ddd;">Header</th>
                  <th style="padding: 8px; text-align: center; border-bottom: 2px solid #ddd;">Status</th>
                  <th style="padding: 8px; text-align: left; border-bottom: 2px solid #ddd;">Details</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Content-Security-Policy</strong></td>
                  <td style="padding: 8px; text-align: center; border-bottom: 1px solid #eee;">
                    <span style="color: ${page.securityHeaders.contentSecurityPolicy.present ? '#22c55e' : '#ef4444'};">
                      ${page.securityHeaders.contentSecurityPolicy.present ? '✓' : '✗'}
                    </span>
                  </td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 12px;">
                    ${page.securityHeaders.contentSecurityPolicy.present
                      ? `Strength: ${page.securityHeaders.contentSecurityPolicy.strength}${page.securityHeaders.contentSecurityPolicy.hasUnsafeInline ? ' (has unsafe-inline)' : ''}${page.securityHeaders.contentSecurityPolicy.hasUnsafeEval ? ' (has unsafe-eval)' : ''}`
                      : 'Missing - protects against XSS attacks'}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Strict-Transport-Security</strong></td>
                  <td style="padding: 8px; text-align: center; border-bottom: 1px solid #eee;">
                    <span style="color: ${page.securityHeaders.strictTransportSecurity.present ? '#22c55e' : '#ef4444'};">
                      ${page.securityHeaders.strictTransportSecurity.present ? '✓' : '✗'}
                    </span>
                  </td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 12px;">
                    ${page.securityHeaders.strictTransportSecurity.present
                      ? `max-age: ${page.securityHeaders.strictTransportSecurity.maxAge || 'N/A'}${page.securityHeaders.strictTransportSecurity.includeSubDomains ? ', includeSubDomains' : ''}${page.securityHeaders.strictTransportSecurity.preload ? ', preload' : ''}`
                      : 'Missing - enforces HTTPS connections'}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>X-Frame-Options</strong></td>
                  <td style="padding: 8px; text-align: center; border-bottom: 1px solid #eee;">
                    <span style="color: ${page.securityHeaders.xFrameOptions.present ? '#22c55e' : '#ef4444'};">
                      ${page.securityHeaders.xFrameOptions.present ? '✓' : '✗'}
                    </span>
                  </td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 12px;">
                    ${page.securityHeaders.xFrameOptions.present
                      ? `Value: ${page.securityHeaders.xFrameOptions.value}`
                      : 'Missing - prevents clickjacking attacks'}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>X-Content-Type-Options</strong></td>
                  <td style="padding: 8px; text-align: center; border-bottom: 1px solid #eee;">
                    <span style="color: ${page.securityHeaders.xContentTypeOptions.present ? '#22c55e' : '#ef4444'};">
                      ${page.securityHeaders.xContentTypeOptions.present ? '✓' : '✗'}
                    </span>
                  </td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 12px;">
                    ${page.securityHeaders.xContentTypeOptions.present
                      ? `Value: ${page.securityHeaders.xContentTypeOptions.value}`
                      : 'Missing - prevents MIME-type sniffing'}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Referrer-Policy</strong></td>
                  <td style="padding: 8px; text-align: center; border-bottom: 1px solid #eee;">
                    <span style="color: ${page.securityHeaders.referrerPolicy.present ? '#22c55e' : '#ef4444'};">
                      ${page.securityHeaders.referrerPolicy.present ? '✓' : '✗'}
                    </span>
                  </td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 12px;">
                    ${page.securityHeaders.referrerPolicy.present
                      ? `Privacy level: ${page.securityHeaders.referrerPolicy.privacyLevel}`
                      : 'Missing - controls referrer information leakage'}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Permissions-Policy</strong></td>
                  <td style="padding: 8px; text-align: center; border-bottom: 1px solid #eee;">
                    <span style="color: ${page.securityHeaders.permissionsPolicy.present ? '#22c55e' : '#ef4444'};">
                      ${page.securityHeaders.permissionsPolicy.present ? '✓' : '✗'}
                    </span>
                  </td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 12px;">
                    ${page.securityHeaders.permissionsPolicy.present
                      ? `Restricted features: ${page.securityHeaders.permissionsPolicy.restrictedFeatures.length}`
                      : 'Missing - restricts browser feature access'}
                  </td>
                </tr>
              </tbody>
            </table>
            ${page.securityHeaders.recommendations.length > 0 ? `
              <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 4px; padding: 12px;">
                <strong style="color: #92400e;">Recommendations:</strong>
                <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #92400e;">
                  ${page.securityHeaders.recommendations.map(rec => `<li style="margin-bottom: 4px;">${sanitizeHtml(rec)}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
          </div>
        ` : ''}

        ${page.issues.length > 0 ? `
          <h4 style="margin-bottom: 12px;">Issues</h4>
          <ul class="issue-list">
            ${page.issues.map(issue => `
              <li class="issue-item ${issue.type}">
                <span class="issue-badge ${issue.type}">${issue.type}</span>
                <span><strong>${sanitizeHtml(issue.category)}:</strong> ${sanitizeHtml(issue.message)}</span>
              </li>
            `).join('')}
          </ul>
        ` : '<p>No issues found</p>'}
      </div>
    </div>
  `;
}

function getScoreClass(score: number): string {
  if (score >= 90) return 'good';
  if (score >= 50) return 'warning';
  return 'error';
}

function getStatusClass(status: number): string {
  if (status >= 200 && status < 300) return 'success';
  if (status >= 300 && status < 400) return 'redirect';
  return 'error';
}

function getCwvClass(score: 'good' | 'needs-improvement' | 'poor' | 'unknown'): string {
  switch (score) {
    case 'good': return 'good';
    case 'needs-improvement': return 'warning';
    case 'poor': return 'error';
    default: return '';
  }
}

export default generateHtmlReport;
