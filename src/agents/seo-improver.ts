/**
 * SEO Improvement Agent
 *
 * Analyzes crawl reports and generates prioritized improvement suggestions
 * using AI/LLM capabilities for content optimization.
 */

import {
  CrawlReport,
  ClusterAnalysis,
  ImprovementSuggestion,
  ClusterImprovement,
  ImprovementPlan,
  PageAnalysis,
  Issue,
} from '../types';

// Priority thresholds
const CRITICAL_SCORE_THRESHOLD = 30;
const HIGH_PRIORITY_SCORE_THRESHOLD = 50;
const MEDIUM_PRIORITY_SCORE_THRESHOLD = 70;

// Issue category to improvement category mapping
const CATEGORY_MAPPING: Record<string, string> = {
  'meta-tags': 'Meta Tags',
  'core-web-vitals': 'Core Web Vitals',
  'technical-seo': 'Technical SEO',
  'document-structure': 'Document Structure',
  'links': 'Links',
  'performance': 'Performance',
  'mobile-friendliness': 'Mobile Friendliness',
  'structured-data': 'Structured Data',
  'readability': 'Readability',
  'eeat': 'E-E-A-T',
  'security-headers': 'Security Headers',
  'content-freshness': 'Content Freshness',
  'ai-citation': 'AI Citation',
  'third-party': 'Third Party Scripts',
  'js-rendering': 'JS Rendering',
  'redirect-chain': 'Redirect Chain',
  'inp': 'INP (Interaction to Next Paint)',
  'hreflang': 'Hreflang',
};

/**
 * Determine priority based on issue type and affected count
 */
function determinePriority(
  issue: Issue,
  affectedCount: number,
  totalPages: number
): 'critical' | 'high' | 'medium' | 'low' {
  const affectedPercentage = (affectedCount / totalPages) * 100;

  // Critical: Errors affecting many pages
  if (issue.type === 'error' && affectedPercentage > 50) {
    return 'critical';
  }

  // High: Errors or warnings affecting significant portion
  if (issue.type === 'error' || affectedPercentage > 30) {
    return 'high';
  }

  // Medium: Warnings affecting moderate portion
  if (issue.type === 'warning' || affectedPercentage > 10) {
    return 'medium';
  }

  return 'low';
}

/**
 * Generate implementation guide based on issue category
 */
function generateImplementationGuide(category: string, issue: Issue): string {
  const guides: Record<string, string> = {
    'meta-tags': `
1. Locate the page template or CMS settings for meta tags
2. Update the title tag to be 50-60 characters with primary keyword
3. Write a compelling meta description (150-160 characters)
4. Ensure Open Graph and Twitter Card tags are present
5. Verify changes in Google Search Console after indexing`,

    'structured-data': `
1. Identify the appropriate Schema.org type for your content
2. Add JSON-LD script in the <head> section
3. Include required properties for the schema type
4. Test with Google Rich Results Test tool
5. Monitor Search Console for structured data errors`,

    'readability': `
1. Aim for Flesch-Kincaid grade level of 8-10
2. Use shorter sentences (15-20 words average)
3. Break up long paragraphs (3-4 sentences max)
4. Use subheadings every 300-400 words
5. Include bullet points and numbered lists`,

    'ai-citation': `
1. Add clear, factual statements that can be cited
2. Include statistics with sources
3. Structure content with clear Q&A sections
4. Add FAQ schema markup
5. Ensure content answers common questions directly`,

    'eeat': `
1. Add author information with credentials
2. Include publication and last modified dates
3. Link to authoritative sources
4. Add trust signals (reviews, certifications)
5. Create an About page with expertise details`,

    'security-headers': `
1. Configure Content-Security-Policy header
2. Enable HSTS with appropriate max-age
3. Set X-Content-Type-Options: nosniff
4. Configure X-Frame-Options or frame-ancestors
5. Test headers with securityheaders.com`,

    'core-web-vitals': `
1. Optimize images (WebP, lazy loading, proper sizing)
2. Minimize render-blocking resources
3. Reduce JavaScript execution time
4. Reserve space for dynamic content (prevent CLS)
5. Use a CDN for faster resource delivery`,

    'performance': `
1. Enable compression (gzip/brotli)
2. Implement browser caching
3. Minimize CSS and JavaScript
4. Optimize images and use modern formats
5. Remove unused code and dependencies`,
  };

  return guides[category] || `
1. Review the specific issue details
2. Identify the affected elements or code
3. Implement the suggested fix
4. Test changes in a staging environment
5. Deploy and verify the improvement`;
}

/**
 * Estimate the impact of fixing an issue
 */
function estimateImpact(
  category: string,
  affectedCount: number,
  totalPages: number
): string {
  const percentage = Math.round((affectedCount / totalPages) * 100);

  const impactDescriptions: Record<string, string> = {
    'meta-tags': `Improve click-through rates from search results for ${percentage}% of pages`,
    'structured-data': `Enable rich snippets in search results for ${percentage}% of pages`,
    'readability': `Improve user engagement and time on page for ${percentage}% of content`,
    'ai-citation': `Increase likelihood of AI/LLM citations for ${percentage}% of content`,
    'eeat': `Boost authority signals for ${percentage}% of pages`,
    'security-headers': `Enhance security posture across ${percentage}% of pages`,
    'core-web-vitals': `Improve Core Web Vitals scores affecting ${percentage}% of pages`,
    'performance': `Reduce load times for ${percentage}% of pages`,
  };

  return impactDescriptions[category] ||
    `Fix affects ${affectedCount} pages (${percentage}% of site)`;
}

/**
 * Generate improvement suggestions for a cluster
 */
function generateClusterImprovements(
  cluster: ClusterAnalysis,
  totalPages: number
): ImprovementSuggestion[] {
  const suggestions: ImprovementSuggestion[] = [];

  // Focus on template issues first (highest impact)
  for (const templateIssue of cluster.templateIssues) {
    const category = CATEGORY_MAPPING[templateIssue.issue.category] || templateIssue.issue.category;

    suggestions.push({
      category,
      priority: determinePriority(templateIssue.issue, templateIssue.affectedCount, totalPages),
      issue: templateIssue.issue.message,
      currentState: `Affects ${templateIssue.affectedCount} pages (${templateIssue.percentage}% of ${cluster.patternDisplay})`,
      suggestedFix: templateIssue.issue.details || `Fix the ${category.toLowerCase()} issue in the template`,
      affectedUrls: templateIssue.affectedUrls.slice(0, 10), // Limit to first 10 URLs
      estimatedImpact: estimateImpact(templateIssue.issue.category, templateIssue.affectedCount, totalPages),
      implementationGuide: generateImplementationGuide(templateIssue.issue.category, templateIssue.issue),
    });
  }

  // Add common issues that aren't template issues
  for (const commonIssue of cluster.commonIssues) {
    if (!commonIssue.isTemplateIssue && commonIssue.affectedCount >= 2) {
      const category = CATEGORY_MAPPING[commonIssue.issue.category] || commonIssue.issue.category;

      suggestions.push({
        category,
        priority: determinePriority(commonIssue.issue, commonIssue.affectedCount, totalPages),
        issue: commonIssue.issue.message,
        currentState: `Affects ${commonIssue.affectedCount} pages (${commonIssue.percentage}% of ${cluster.patternDisplay})`,
        suggestedFix: commonIssue.issue.details || `Address the ${category.toLowerCase()} issue`,
        affectedUrls: commonIssue.affectedUrls.slice(0, 10),
        estimatedImpact: estimateImpact(commonIssue.issue.category, commonIssue.affectedCount, totalPages),
        implementationGuide: generateImplementationGuide(commonIssue.issue.category, commonIssue.issue),
      });
    }
  }

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  return suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

/**
 * Generate site-wide recommendations
 */
function generateSiteWideRecommendations(
  report: CrawlReport
): ImprovementSuggestion[] {
  const suggestions: ImprovementSuggestion[] = [];
  const totalPages = report.crawledPages;

  // Check site-wide issues from cluster analysis
  if (report.clusters?.siteWideIssues) {
    for (const siteWideIssue of report.clusters.siteWideIssues) {
      suggestions.push({
        category: 'Site-Wide',
        priority: siteWideIssue.totalAffectedPages > totalPages * 0.5 ? 'critical' : 'high',
        issue: siteWideIssue.message,
        currentState: `Affects ${siteWideIssue.totalAffectedPages} pages across ${siteWideIssue.affectedClusters} page types`,
        suggestedFix: 'This is likely a site-wide configuration issue that should be fixed at the global level',
        affectedUrls: [],
        estimatedImpact: `Fixing this will improve ${siteWideIssue.totalAffectedPages} pages simultaneously`,
      });
    }
  }

  // Add recommendations based on summary scores
  if (report.summary.averageScore < CRITICAL_SCORE_THRESHOLD) {
    suggestions.push({
      category: 'Overall Health',
      priority: 'critical',
      issue: `Site average SEO score is critically low (${Math.round(report.summary.averageScore)}/100)`,
      currentState: `Average score: ${Math.round(report.summary.averageScore)}/100`,
      suggestedFix: 'Focus on fixing critical errors first, then address warnings systematically',
      affectedUrls: [],
      estimatedImpact: 'Comprehensive improvements could significantly boost search visibility',
    });
  }

  // Core Web Vitals recommendation
  const cwvDistribution = report.summary.coreWebVitalsDistribution;
  const poorCWVPercentage = (cwvDistribution.poor / totalPages) * 100;

  if (poorCWVPercentage > 20) {
    suggestions.push({
      category: 'Core Web Vitals',
      priority: 'high',
      issue: `${Math.round(poorCWVPercentage)}% of pages have poor Core Web Vitals`,
      currentState: `Good: ${cwvDistribution.good}, Needs Improvement: ${cwvDistribution.needsImprovement}, Poor: ${cwvDistribution.poor}`,
      suggestedFix: 'Optimize LCP by improving server response times, resource loading, and image optimization',
      affectedUrls: [],
      estimatedImpact: 'Core Web Vitals are a Google ranking factor - improving them can boost rankings',
      implementationGuide: generateImplementationGuide('core-web-vitals', { type: 'warning', category: 'core-web-vitals', message: '' }),
    });
  }

  return suggestions;
}

/**
 * Generate prioritized action items
 */
function generatePrioritizedActions(
  clusterImprovements: ClusterImprovement[],
  siteWideRecommendations: ImprovementSuggestion[]
): Array<{ action: string; impact: string; effort: 'low' | 'medium' | 'high'; affectedPages: number }> {
  const actions: Array<{ action: string; impact: string; effort: 'low' | 'medium' | 'high'; affectedPages: number }> = [];

  // Add site-wide actions first
  for (const rec of siteWideRecommendations.filter(r => r.priority === 'critical' || r.priority === 'high')) {
    actions.push({
      action: rec.suggestedFix,
      impact: rec.estimatedImpact,
      effort: 'medium',
      affectedPages: parseInt(rec.currentState.match(/\d+/)?.[0] || '0', 10),
    });
  }

  // Add template issue fixes (high impact, single fix affects many pages)
  for (const cluster of clusterImprovements) {
    const templateFixes = cluster.improvements.filter(i =>
      i.currentState.includes('template') || parseInt(i.currentState.match(/\d+/)?.[0] || '0', 10) > 5
    );

    for (const fix of templateFixes.slice(0, 3)) { // Top 3 per cluster
      const affectedCount = parseInt(fix.currentState.match(/\d+/)?.[0] || '0', 10);
      actions.push({
        action: `[${cluster.cluster}] ${fix.issue}: ${fix.suggestedFix.substring(0, 100)}`,
        impact: fix.estimatedImpact,
        effort: getEffortEstimate(fix.category),
        affectedPages: affectedCount,
      });
    }
  }

  // Sort by affected pages (highest impact first)
  return actions.sort((a, b) => b.affectedPages - a.affectedPages).slice(0, 20);
}

/**
 * Estimate effort based on category
 */
function getEffortEstimate(category: string): 'low' | 'medium' | 'high' {
  const lowEffort = ['Meta Tags', 'Structured Data', 'Security Headers'];
  const highEffort = ['Core Web Vitals', 'Performance', 'JS Rendering', 'Readability'];

  if (lowEffort.includes(category)) return 'low';
  if (highEffort.includes(category)) return 'high';
  return 'medium';
}

/**
 * Main function to generate an improvement plan from a crawl report
 */
export function generateImprovementPlan(report: CrawlReport): ImprovementPlan {
  const clusterImprovements: ClusterImprovement[] = [];
  let totalIssues = 0;
  let criticalIssues = 0;

  // Generate improvements for each cluster
  if (report.clusters) {
    for (const cluster of report.clusters.clusters) {
      const improvements = generateClusterImprovements(cluster, report.crawledPages);

      totalIssues += improvements.length;
      criticalIssues += improvements.filter(i => i.priority === 'critical').length;

      clusterImprovements.push({
        cluster: cluster.patternDisplay,
        improvements,
      });
    }
  }

  // Generate site-wide recommendations
  const siteWideRecommendations = generateSiteWideRecommendations(report);
  totalIssues += siteWideRecommendations.length;
  criticalIssues += siteWideRecommendations.filter(r => r.priority === 'critical').length;

  // Generate prioritized actions
  const prioritizedActions = generatePrioritizedActions(clusterImprovements, siteWideRecommendations);

  // Calculate estimated score improvement
  const currentScore = report.summary.averageScore;
  const potentialImprovement = Math.min(30, criticalIssues * 5 + (totalIssues - criticalIssues) * 2);
  const estimatedScoreImprovement = Math.min(100 - currentScore, potentialImprovement);

  return {
    siteUrl: report.siteUrl,
    generatedAt: new Date().toISOString(),
    summary: {
      totalIssues,
      criticalIssues,
      estimatedScoreImprovement: Math.round(estimatedScoreImprovement),
    },
    clusterImprovements,
    siteWideRecommendations,
    prioritizedActions,
  };
}

/**
 * Generate meta tag suggestions for pages with issues
 */
export function generateMetaTagSuggestions(
  pages: PageAnalysis[]
): Array<{ url: string; currentTitle: string | null; suggestedTitle: string; currentDescription: string | null; suggestedDescription: string }> {
  const suggestions: Array<{
    url: string;
    currentTitle: string | null;
    suggestedTitle: string;
    currentDescription: string | null;
    suggestedDescription: string;
  }> = [];

  for (const page of pages) {
    const hasMetaIssue = page.issues.some(i => i.category === 'meta-tags');

    if (hasMetaIssue) {
      // Extract page context for suggestion generation
      const h1 = page.documentStructure.headings.find(h => h.level === 1)?.text || '';
      const url = page.url;
      const pathSegments = new URL(url).pathname.split('/').filter(Boolean);

      suggestions.push({
        url: page.url,
        currentTitle: page.metaTags.title,
        suggestedTitle: generateTitleSuggestion(page.metaTags.title, h1, pathSegments),
        currentDescription: page.metaTags.description,
        suggestedDescription: generateDescriptionSuggestion(page.metaTags.description, h1, pathSegments),
      });
    }
  }

  return suggestions;
}

/**
 * Generate a title suggestion based on current state
 */
function generateTitleSuggestion(
  currentTitle: string | null,
  h1: string,
  pathSegments: string[]
): string {
  if (!currentTitle || currentTitle.length < 30) {
    // Use H1 or path to generate suggestion
    const base = h1 || pathSegments.join(' ').replace(/-/g, ' ');
    return `${capitalizeWords(base)} | Your Brand Name`;
  }

  if (currentTitle.length > 60) {
    // Suggest truncation
    return currentTitle.substring(0, 57) + '...';
  }

  return currentTitle;
}

/**
 * Generate a description suggestion
 */
function generateDescriptionSuggestion(
  currentDescription: string | null,
  h1: string,
  pathSegments: string[]
): string {
  if (!currentDescription || currentDescription.length < 70) {
    const context = h1 || pathSegments.join(' ').replace(/-/g, ' ');
    return `Learn about ${context.toLowerCase()}. Comprehensive guide with expert insights and actionable tips. Discover more today.`;
  }

  if (currentDescription.length > 160) {
    return currentDescription.substring(0, 157) + '...';
  }

  return currentDescription;
}

/**
 * Capitalize words in a string
 */
function capitalizeWords(str: string): string {
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export default generateImprovementPlan;
