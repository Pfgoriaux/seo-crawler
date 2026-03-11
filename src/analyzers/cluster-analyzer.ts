/**
 * Cluster Analyzer
 *
 * Groups pages by URL patterns (e.g., /jobs/*, /blog/*) and aggregates
 * issues at the cluster level to identify template-level problems.
 */

import {
  PageAnalysis,
  ClusterAnalysis,
  ClusterSummary,
  ClusterIssue,
  Issue,
  CategoryScores,
} from '../types';

// Threshold for considering an issue a "template issue" (appears in X% of cluster)
const TEMPLATE_ISSUE_THRESHOLD = 0.8; // 80%

// Minimum pages to form a meaningful cluster
const MIN_CLUSTER_SIZE = 2;

/**
 * Extract URL pattern from a full URL
 * Groups by first path segment: /jobs/*, /blog/*, /products/*, etc.
 */
export function extractUrlPattern(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname.split('/').filter(Boolean);

    if (pathSegments.length === 0) {
      return '/'; // Root/homepage
    }

    // Use first path segment as pattern
    return `/${pathSegments[0]}/*`;
  } catch {
    return '/other/*';
  }
}

/**
 * Get a human-readable display name for a pattern
 */
function getPatternDisplayName(pattern: string): string {
  if (pattern === '/') return 'Homepage';
  if (pattern === '/other/*') return 'Other Pages';

  // Extract the segment name and capitalize
  const segment = pattern.replace('/', '').replace('/*', '');
  return segment.charAt(0).toUpperCase() + segment.slice(1) + ' Pages';
}

/**
 * Group pages by their URL patterns
 */
function groupPagesByPattern(pages: PageAnalysis[]): Map<string, PageAnalysis[]> {
  const groups = new Map<string, PageAnalysis[]>();

  for (const page of pages) {
    const pattern = extractUrlPattern(page.url);
    const existing = groups.get(pattern) || [];
    existing.push(page);
    groups.set(pattern, existing);
  }

  return groups;
}

/**
 * Aggregate issues within a cluster
 */
function aggregateClusterIssues(pages: PageAnalysis[]): ClusterIssue[] {
  const issueMap = new Map<string, {
    issue: Issue;
    urls: string[];
  }>();

  for (const page of pages) {
    for (const issue of page.issues) {
      const key = `${issue.category}::${issue.message}`;
      const existing = issueMap.get(key);

      if (existing) {
        existing.urls.push(page.url);
      } else {
        issueMap.set(key, {
          issue: { ...issue },
          urls: [page.url],
        });
      }
    }
  }

  const clusterIssues: ClusterIssue[] = [];
  const pageCount = pages.length;

  for (const [, data] of issueMap) {
    const percentage = data.urls.length / pageCount;
    clusterIssues.push({
      issue: data.issue,
      affectedCount: data.urls.length,
      affectedUrls: data.urls,
      percentage: Math.round(percentage * 100),
      isTemplateIssue: percentage >= TEMPLATE_ISSUE_THRESHOLD,
    });
  }

  // Sort by affected count (most common issues first)
  return clusterIssues.sort((a, b) => b.affectedCount - a.affectedCount);
}

/**
 * Calculate aggregate scores for a cluster
 */
function calculateClusterScores(pages: PageAnalysis[]): {
  avg: CategoryScores;
  min: CategoryScores;
  max: CategoryScores;
} {
  const scoreKeys: (keyof CategoryScores)[] = [
    'overall', 'coreWebVitals', 'metaTags', 'technicalSeo',
    'documentStructure', 'links', 'performance', 'mobileFriendliness',
    'structuredData', 'readability', 'eeat', 'securityHeaders',
    'contentFreshness', 'aiCitation', 'thirdParty', 'jsRendering',
    'redirectChain', 'inp', 'hreflang',
  ];

  const avg: Record<string, number> = {};
  const min: Record<string, number> = {};
  const max: Record<string, number> = {};

  for (const key of scoreKeys) {
    const values = pages.map(p => p.score[key]);
    avg[key] = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    min[key] = Math.min(...values);
    max[key] = Math.max(...values);
  }

  return {
    avg: avg as unknown as CategoryScores,
    min: min as unknown as CategoryScores,
    max: max as unknown as CategoryScores,
  };
}

/**
 * Analyze a single cluster
 */
function analyzeCluster(pattern: string, pages: PageAnalysis[]): ClusterAnalysis {
  const allIssues = aggregateClusterIssues(pages);
  const scores = calculateClusterScores(pages);

  // Count issue types
  let errors = 0;
  let warnings = 0;
  let info = 0;

  for (const page of pages) {
    for (const issue of page.issues) {
      if (issue.type === 'error') errors++;
      else if (issue.type === 'warning') warnings++;
      else info++;
    }
  }

  return {
    pattern,
    patternDisplay: getPatternDisplayName(pattern),
    pageCount: pages.length,
    pages: pages.map(p => p.url),
    avgScore: scores.avg.overall,
    minScore: scores.min.overall,
    maxScore: scores.max.overall,
    commonIssues: allIssues.filter(i => i.affectedCount >= 2), // Appears in 2+ pages
    templateIssues: allIssues.filter(i => i.isTemplateIssue),
    scores,
    issueDistribution: { errors, warnings, info },
  };
}

/**
 * Find issues that appear across multiple clusters (site-wide problems)
 */
function findSiteWideIssues(clusters: ClusterAnalysis[]): Array<{
  message: string;
  affectedClusters: number;
  totalAffectedPages: number;
}> {
  const issueMap = new Map<string, {
    clusters: Set<string>;
    totalPages: number;
  }>();

  for (const cluster of clusters) {
    for (const clusterIssue of cluster.commonIssues) {
      const key = clusterIssue.issue.message;
      const existing = issueMap.get(key);

      if (existing) {
        existing.clusters.add(cluster.pattern);
        existing.totalPages += clusterIssue.affectedCount;
      } else {
        issueMap.set(key, {
          clusters: new Set([cluster.pattern]),
          totalPages: clusterIssue.affectedCount,
        });
      }
    }
  }

  // Filter to issues appearing in 2+ clusters
  const siteWideIssues: Array<{
    message: string;
    affectedClusters: number;
    totalAffectedPages: number;
  }> = [];

  for (const [message, data] of issueMap) {
    if (data.clusters.size >= 2) {
      siteWideIssues.push({
        message,
        affectedClusters: data.clusters.size,
        totalAffectedPages: data.totalPages,
      });
    }
  }

  return siteWideIssues.sort((a, b) => b.totalAffectedPages - a.totalAffectedPages);
}

/**
 * Main cluster analysis function
 */
export function analyzePageClusters(pages: PageAnalysis[]): ClusterSummary {
  // Group pages by URL pattern
  const groups = groupPagesByPattern(pages);

  // Analyze each cluster
  const clusters: ClusterAnalysis[] = [];

  for (const [pattern, clusterPages] of groups) {
    // Only analyze clusters with minimum size (2+ pages)
    // Single pages are excluded from cluster analysis
    if (clusterPages.length >= MIN_CLUSTER_SIZE) {
      clusters.push(analyzeCluster(pattern, clusterPages));
    }
  }

  // Sort clusters by page count (largest first)
  clusters.sort((a, b) => b.pageCount - a.pageCount);

  // Find worst performing clusters
  const worstPerformingClusters = [...clusters]
    .sort((a, b) => a.avgScore - b.avgScore)
    .slice(0, 5)
    .map(c => ({
      pattern: c.pattern,
      avgScore: c.avgScore,
      issueCount: c.issueDistribution.errors + c.issueDistribution.warnings,
    }));

  // Find site-wide issues
  const siteWideIssues = findSiteWideIssues(clusters);

  return {
    totalClusters: clusters.length,
    clusters,
    worstPerformingClusters,
    siteWideIssues: siteWideIssues.slice(0, 10), // Top 10 site-wide issues
  };
}

/**
 * Get cluster for a specific URL
 */
export function getClusterForUrl(url: string, clusterSummary: ClusterSummary): ClusterAnalysis | undefined {
  const pattern = extractUrlPattern(url);
  return clusterSummary.clusters.find(c => c.pattern === pattern);
}

/**
 * Calculate cluster improvement priority score
 * Higher score = more important to fix
 */
export function calculateClusterPriority(cluster: ClusterAnalysis): number {
  let priority = 0;

  // Factor 1: Number of pages affected (more pages = higher priority)
  priority += cluster.pageCount * 10;

  // Factor 2: Template issues (fixing one template fixes many pages)
  priority += cluster.templateIssues.length * 50;

  // Factor 3: Low average score
  priority += (100 - cluster.avgScore) * 2;

  // Factor 4: High error count
  priority += cluster.issueDistribution.errors * 5;

  return priority;
}

export default analyzePageClusters;
