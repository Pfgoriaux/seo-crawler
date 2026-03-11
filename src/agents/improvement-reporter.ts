/**
 * Improvement Report Generator
 *
 * Generates human-readable reports from improvement plans.
 */

import fs from 'fs';
import path from 'path';
import { ImprovementPlan, ImprovementSuggestion, ClusterImprovement } from '../types';
import logger from '../utils/logger';

/**
 * Generate both JSON and HTML improvement reports
 */
export async function generateImprovementReport(
  plan: ImprovementPlan,
  outputDir: string
): Promise<{ jsonPath: string; htmlPath: string }> {
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  // Generate JSON report
  const jsonPath = path.join(outputDir, `improvement-plan-${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(plan, null, 2), 'utf-8');
  logger.success(`Improvement plan JSON saved to: ${jsonPath}`);

  // Generate HTML report
  const htmlPath = path.join(outputDir, `improvement-plan-${timestamp}.html`);
  const htmlContent = generateImprovementHtml(plan);
  fs.writeFileSync(htmlPath, htmlContent, 'utf-8');
  logger.success(`Improvement plan HTML saved to: ${htmlPath}`);

  return { jsonPath, htmlPath };
}

/**
 * Generate HTML content for improvement plan
 */
function generateImprovementHtml(plan: ImprovementPlan): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SEO Improvement Plan - ${plan.siteUrl}</title>
  <style>
    :root {
      --primary: #2563eb;
      --primary-light: #3b82f6;
      --success: #10b981;
      --warning: #f59e0b;
      --error: #ef4444;
      --critical: #dc2626;
      --gray-50: #f9fafb;
      --gray-100: #f3f4f6;
      --gray-200: #e5e7eb;
      --gray-300: #d1d5db;
      --gray-600: #4b5563;
      --gray-700: #374151;
      --gray-800: #1f2937;
      --gray-900: #111827;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: var(--gray-50);
      color: var(--gray-800);
      line-height: 1.6;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }

    header {
      background: linear-gradient(135deg, var(--primary), var(--primary-light));
      color: white;
      padding: 2rem;
      margin-bottom: 2rem;
      border-radius: 12px;
    }

    header h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }

    header p {
      opacity: 0.9;
    }

    .summary-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .summary-card {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      text-align: center;
    }

    .summary-card .value {
      font-size: 2.5rem;
      font-weight: bold;
      color: var(--primary);
    }

    .summary-card .label {
      color: var(--gray-600);
      font-size: 0.875rem;
      margin-top: 0.5rem;
    }

    .summary-card.critical .value {
      color: var(--critical);
    }

    .summary-card.success .value {
      color: var(--success);
    }

    section {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    section h2 {
      font-size: 1.25rem;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid var(--gray-200);
      color: var(--gray-800);
    }

    .priority-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }

    .priority-critical {
      background: #fef2f2;
      color: var(--critical);
    }

    .priority-high {
      background: #fef3c7;
      color: #b45309;
    }

    .priority-medium {
      background: #e0f2fe;
      color: #0369a1;
    }

    .priority-low {
      background: var(--gray-100);
      color: var(--gray-600);
    }

    .effort-badge {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .effort-low {
      background: #d1fae5;
      color: #065f46;
    }

    .effort-medium {
      background: #fef3c7;
      color: #92400e;
    }

    .effort-high {
      background: #fee2e2;
      color: #991b1b;
    }

    .action-item {
      padding: 1rem;
      border: 1px solid var(--gray-200);
      border-radius: 8px;
      margin-bottom: 0.75rem;
    }

    .action-item:hover {
      border-color: var(--primary);
      background: var(--gray-50);
    }

    .action-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.5rem;
    }

    .action-title {
      font-weight: 600;
      color: var(--gray-800);
      flex: 1;
    }

    .action-meta {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }

    .action-impact {
      font-size: 0.875rem;
      color: var(--gray-600);
    }

    .action-pages {
      font-size: 0.75rem;
      color: var(--gray-500);
      background: var(--gray-100);
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
    }

    .cluster-section {
      margin-bottom: 1.5rem;
    }

    .cluster-header {
      background: var(--gray-100);
      padding: 1rem;
      border-radius: 8px;
      margin-bottom: 1rem;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .cluster-header:hover {
      background: var(--gray-200);
    }

    .cluster-header h3 {
      font-size: 1rem;
      color: var(--gray-800);
    }

    .cluster-count {
      background: var(--primary);
      color: white;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
    }

    .cluster-content {
      display: none;
      padding-left: 1rem;
    }

    .cluster-content.open {
      display: block;
    }

    .suggestion-card {
      background: var(--gray-50);
      border: 1px solid var(--gray-200);
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 0.75rem;
    }

    .suggestion-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.75rem;
    }

    .suggestion-category {
      font-weight: 600;
      color: var(--gray-700);
    }

    .suggestion-issue {
      font-weight: 500;
      color: var(--gray-800);
      margin-bottom: 0.5rem;
    }

    .suggestion-details {
      font-size: 0.875rem;
      color: var(--gray-600);
    }

    .suggestion-fix {
      background: white;
      border-left: 3px solid var(--success);
      padding: 0.75rem;
      margin-top: 0.75rem;
      font-size: 0.875rem;
    }

    .suggestion-impact {
      font-size: 0.75rem;
      color: var(--success);
      margin-top: 0.5rem;
    }

    .implementation-guide {
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 8px;
      padding: 1rem;
      margin-top: 0.75rem;
      font-size: 0.875rem;
    }

    .implementation-guide h4 {
      font-size: 0.875rem;
      color: #0369a1;
      margin-bottom: 0.5rem;
    }

    .implementation-guide pre {
      white-space: pre-wrap;
      font-family: inherit;
      color: var(--gray-700);
    }

    .urls-list {
      margin-top: 0.5rem;
      padding-left: 1rem;
      font-size: 0.75rem;
      color: var(--gray-500);
    }

    .urls-list li {
      margin-bottom: 0.25rem;
    }

    .urls-list a {
      color: var(--primary);
      text-decoration: none;
    }

    .urls-list a:hover {
      text-decoration: underline;
    }

    footer {
      text-align: center;
      padding: 2rem;
      color: var(--gray-500);
      font-size: 0.875rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>SEO Improvement Plan</h1>
      <p>${plan.siteUrl} - Generated ${new Date(plan.generatedAt).toLocaleDateString()}</p>
    </header>

    <div class="summary-cards">
      <div class="summary-card">
        <div class="value">${plan.summary.totalIssues}</div>
        <div class="label">Total Issues Found</div>
      </div>
      <div class="summary-card critical">
        <div class="value">${plan.summary.criticalIssues}</div>
        <div class="label">Critical Issues</div>
      </div>
      <div class="summary-card success">
        <div class="value">+${plan.summary.estimatedScoreImprovement}</div>
        <div class="label">Potential Score Improvement</div>
      </div>
      <div class="summary-card">
        <div class="value">${plan.prioritizedActions.length}</div>
        <div class="label">Action Items</div>
      </div>
    </div>

    <section>
      <h2>Prioritized Actions</h2>
      <p style="color: var(--gray-600); margin-bottom: 1rem; font-size: 0.875rem;">
        Focus on these high-impact actions first. Sorted by number of pages affected.
      </p>
      ${generateActionsHtml(plan.prioritizedActions)}
    </section>

    ${plan.siteWideRecommendations.length > 0 ? `
    <section>
      <h2>Site-Wide Recommendations</h2>
      <p style="color: var(--gray-600); margin-bottom: 1rem; font-size: 0.875rem;">
        Issues affecting multiple page types. Fixing these will have the broadest impact.
      </p>
      ${generateSuggestionsHtml(plan.siteWideRecommendations)}
    </section>
    ` : ''}

    <section>
      <h2>Improvements by Page Type</h2>
      <p style="color: var(--gray-600); margin-bottom: 1rem; font-size: 0.875rem;">
        Click on each page type to see specific improvement suggestions.
      </p>
      ${generateClusterImprovementsHtml(plan.clusterImprovements)}
    </section>

    <footer>
      Generated by SEO Crawler Improvement Agent
    </footer>
  </div>

  <script>
    function toggleCluster(id) {
      const content = document.getElementById('cluster-' + id);
      content.classList.toggle('open');
    }
  </script>
</body>
</html>`;
}

/**
 * Generate HTML for prioritized actions
 */
function generateActionsHtml(
  actions: Array<{ action: string; impact: string; effort: 'low' | 'medium' | 'high'; affectedPages: number }>
): string {
  if (actions.length === 0) {
    return '<p style="color: var(--gray-500);">No prioritized actions generated.</p>';
  }

  return actions.map((action, index) => `
    <div class="action-item">
      <div class="action-header">
        <span class="action-title">${index + 1}. ${escapeHtml(action.action)}</span>
        <div class="action-meta">
          <span class="effort-badge effort-${action.effort}">${action.effort} effort</span>
          <span class="action-pages">${action.affectedPages} pages</span>
        </div>
      </div>
      <div class="action-impact">${escapeHtml(action.impact)}</div>
    </div>
  `).join('');
}

/**
 * Generate HTML for improvement suggestions
 */
function generateSuggestionsHtml(suggestions: ImprovementSuggestion[]): string {
  if (suggestions.length === 0) {
    return '<p style="color: var(--gray-500);">No suggestions for this section.</p>';
  }

  return suggestions.map(suggestion => `
    <div class="suggestion-card">
      <div class="suggestion-header">
        <span class="suggestion-category">${escapeHtml(suggestion.category)}</span>
        <span class="priority-badge priority-${suggestion.priority}">${suggestion.priority}</span>
      </div>
      <div class="suggestion-issue">${escapeHtml(suggestion.issue)}</div>
      <div class="suggestion-details">${escapeHtml(suggestion.currentState)}</div>
      <div class="suggestion-fix">
        <strong>Suggested Fix:</strong> ${escapeHtml(suggestion.suggestedFix)}
      </div>
      <div class="suggestion-impact">${escapeHtml(suggestion.estimatedImpact)}</div>
      ${suggestion.implementationGuide ? `
        <div class="implementation-guide">
          <h4>Implementation Guide</h4>
          <pre>${escapeHtml(suggestion.implementationGuide)}</pre>
        </div>
      ` : ''}
      ${suggestion.affectedUrls.length > 0 ? `
        <ul class="urls-list">
          ${suggestion.affectedUrls.slice(0, 5).map(url => `
            <li><a href="${escapeHtml(url)}" target="_blank">${escapeHtml(url)}</a></li>
          `).join('')}
          ${suggestion.affectedUrls.length > 5 ? `<li>... and ${suggestion.affectedUrls.length - 5} more</li>` : ''}
        </ul>
      ` : ''}
    </div>
  `).join('');
}

/**
 * Generate HTML for cluster improvements
 */
function generateClusterImprovementsHtml(clusterImprovements: ClusterImprovement[]): string {
  if (clusterImprovements.length === 0) {
    return '<p style="color: var(--gray-500);">No cluster-specific improvements available.</p>';
  }

  return clusterImprovements.map((cluster, index) => `
    <div class="cluster-section">
      <div class="cluster-header" onclick="toggleCluster(${index})">
        <h3>${escapeHtml(cluster.cluster)}</h3>
        <span class="cluster-count">${cluster.improvements.length} improvements</span>
      </div>
      <div class="cluster-content" id="cluster-${index}">
        ${generateSuggestionsHtml(cluster.improvements)}
      </div>
    </div>
  `).join('');
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

export default generateImprovementReport;
