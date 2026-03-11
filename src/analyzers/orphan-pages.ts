/**
 * Orphan Page Detection Analyzer
 *
 * Tracks internal linking across a site to identify orphan pages (pages with no incoming links)
 * and near-orphan pages (pages with only 1-2 incoming links). Uses BFS to calculate click depth
 * from homepage and cross-references with sitemap data.
 */

export interface OrphanPageAnalysis {
  url: string;
  incomingLinks: number;
  incomingLinkSources: string[];
  isOrphan: boolean;
  isNearOrphan: boolean; // Only 1-2 incoming links
  depth: number; // Click depth from homepage
  inSitemap: boolean;
  recommendation: string | null;
}

export interface SiteLinkGraph {
  pages: Map<string, PageNode>;
  orphanPages: string[];
  nearOrphanPages: string[];
  averageIncomingLinks: number;
  maxDepth: number;
  totalInternalLinks: number;
}

export interface PageNode {
  url: string;
  incomingLinks: Set<string>;
  outgoingLinks: Set<string>;
  depth: number;
  inSitemap: boolean;
}

/**
 * Detects orphan pages by building and analyzing a site's internal link graph
 */
export class OrphanPageDetector {
  private linkGraph: Map<string, PageNode> = new Map();
  private sitemapUrls: Set<string> = new Set();
  private homepageUrl: string = '';

  /**
   * Set the sitemap URLs for cross-referencing
   * Should be called when crawler starts and sitemap is parsed
   */
  setSitemapUrls(urls: string[]): void {
    this.sitemapUrls.clear();
    urls.forEach((url) => {
      const normalized = this.normalizeUrl(url);
      this.sitemapUrls.add(normalized);
    });
  }

  /**
   * Set the homepage URL for depth calculation
   * Should be called when crawler initializes
   */
  setHomepage(url: string): void {
    this.homepageUrl = this.normalizeUrl(url);

    // Ensure homepage node exists
    if (!this.linkGraph.has(this.homepageUrl)) {
      this.linkGraph.set(this.homepageUrl, {
        url: this.homepageUrl,
        incomingLinks: new Set(),
        outgoingLinks: new Set(),
        depth: 0,
        inSitemap: this.sitemapUrls.has(this.homepageUrl),
      });
    }
  }

  /**
   * Add a page and its outgoing links to the graph
   * Should be called for each crawled page
   */
  addPage(url: string, outgoingInternalLinks: string[]): void {
    const normalizedUrl = this.normalizeUrl(url);

    // Get or create node for current page
    let pageNode = this.linkGraph.get(normalizedUrl);
    if (!pageNode) {
      pageNode = {
        url: normalizedUrl,
        incomingLinks: new Set(),
        outgoingLinks: new Set(),
        depth: Infinity,
        inSitemap: this.sitemapUrls.has(normalizedUrl),
      };
      this.linkGraph.set(normalizedUrl, pageNode);
    }

    // Process outgoing links
    outgoingInternalLinks.forEach((linkUrl) => {
      const normalizedLinkUrl = this.normalizeUrl(linkUrl);

      // Add to current page's outgoing links
      pageNode!.outgoingLinks.add(normalizedLinkUrl);

      // Get or create node for linked page
      let linkedNode = this.linkGraph.get(normalizedLinkUrl);
      if (!linkedNode) {
        linkedNode = {
          url: normalizedLinkUrl,
          incomingLinks: new Set(),
          outgoingLinks: new Set(),
          depth: Infinity,
          inSitemap: this.sitemapUrls.has(normalizedLinkUrl),
        };
        this.linkGraph.set(normalizedLinkUrl, linkedNode);
      }

      // Add to linked page's incoming links
      linkedNode.incomingLinks.add(normalizedUrl);
    });
  }

  /**
   * Analyze the complete link graph
   * Should be called after all pages have been crawled
   */
  analyze(): SiteLinkGraph {
    // Calculate depths using BFS from homepage
    this.calculateDepths();

    const orphanPages: string[] = [];
    const nearOrphanPages: string[] = [];
    let totalIncomingLinks = 0;
    let totalInternalLinks = 0;
    let maxDepth = 0;

    // Analyze each page
    this.linkGraph.forEach((node) => {
      const incomingCount = node.incomingLinks.size;
      totalIncomingLinks += incomingCount;
      totalInternalLinks += node.outgoingLinks.size;

      if (node.depth > maxDepth && node.depth !== Infinity) {
        maxDepth = node.depth;
      }

      // Identify orphan pages (no incoming links)
      if (incomingCount === 0 && node.url !== this.homepageUrl) {
        orphanPages.push(node.url);
      }
      // Identify near-orphan pages (1-2 incoming links)
      else if (incomingCount >= 1 && incomingCount <= 2) {
        nearOrphanPages.push(node.url);
      }
    });

    const averageIncomingLinks =
      this.linkGraph.size > 0 ? totalIncomingLinks / this.linkGraph.size : 0;

    return {
      pages: this.linkGraph,
      orphanPages,
      nearOrphanPages,
      averageIncomingLinks,
      maxDepth,
      totalInternalLinks,
    };
  }

  /**
   * Get analysis for a specific page
   */
  getPageAnalysis(url: string): OrphanPageAnalysis | null {
    const normalizedUrl = this.normalizeUrl(url);
    const node = this.linkGraph.get(normalizedUrl);

    if (!node) {
      return null;
    }

    const incomingLinks = node.incomingLinks.size;
    const isOrphan = incomingLinks === 0 && normalizedUrl !== this.homepageUrl;
    const isNearOrphan = incomingLinks >= 1 && incomingLinks <= 2;

    return {
      url: normalizedUrl,
      incomingLinks,
      incomingLinkSources: Array.from(node.incomingLinks),
      isOrphan,
      isNearOrphan,
      depth: node.depth === Infinity ? -1 : node.depth,
      inSitemap: node.inSitemap,
      recommendation: this.generateRecommendation(node, isOrphan, isNearOrphan),
    };
  }

  /**
   * Calculate click depth from homepage using BFS
   */
  private calculateDepths(): void {
    if (!this.homepageUrl || !this.linkGraph.has(this.homepageUrl)) {
      return;
    }

    // Reset all depths
    this.linkGraph.forEach((node) => {
      node.depth = Infinity;
    });

    // BFS queue: [url, depth]
    const queue: Array<[string, number]> = [[this.homepageUrl, 0]];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const [currentUrl, depth] = queue.shift()!;

      if (visited.has(currentUrl)) {
        continue;
      }

      visited.add(currentUrl);

      const node = this.linkGraph.get(currentUrl);
      if (!node) {
        continue;
      }

      // Update depth
      node.depth = depth;

      // Add outgoing links to queue
      node.outgoingLinks.forEach((linkUrl) => {
        if (!visited.has(linkUrl)) {
          queue.push([linkUrl, depth + 1]);
        }
      });
    }
  }

  /**
   * Generate actionable recommendation for a page
   */
  private generateRecommendation(
    node: PageNode,
    isOrphan: boolean,
    isNearOrphan: boolean
  ): string | null {
    if (isOrphan) {
      if (node.inSitemap) {
        return 'CRITICAL: Page is in sitemap but has no internal links. Add links from relevant pages or navigation.';
      } else if (node.depth === Infinity) {
        return 'Page is unreachable from homepage. Add internal links from relevant pages or consider removing if not needed.';
      }
      return 'Page has no incoming links. Add contextual links from related pages to improve discoverability.';
    }

    if (isNearOrphan) {
      if (node.depth > 5) {
        return `Page is ${node.depth} clicks from homepage with only ${node.incomingLinks.size} link(s). Consider adding more internal links or restructuring site hierarchy.`;
      }
      return `Page has only ${node.incomingLinks.size} incoming link(s). Consider adding more internal links to improve authority flow.`;
    }

    if (node.depth > 7) {
      return `Page is ${node.depth} clicks from homepage. Consider moving it closer to the top-level navigation.`;
    }

    if (node.inSitemap && node.depth === Infinity) {
      return 'Page is in sitemap but unreachable from homepage. Ensure proper internal linking structure.';
    }

    return null;
  }

  /**
   * Normalize URL for consistent comparison
   */
  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);

      // Remove fragment
      parsed.hash = '';

      // Remove trailing slash from path (except for root)
      if (parsed.pathname !== '/') {
        parsed.pathname = parsed.pathname.replace(/\/$/, '');
      }

      // Sort query parameters for consistency
      const params = Array.from(parsed.searchParams.entries()).sort();
      parsed.search = '';
      params.forEach(([key, value]) => {
        parsed.searchParams.append(key, value);
      });

      return parsed.href;
    } catch {
      // If URL parsing fails, return as-is
      return url;
    }
  }

  /**
   * Reset the detector state
   */
  reset(): void {
    this.linkGraph.clear();
    this.sitemapUrls.clear();
    this.homepageUrl = '';
  }

  /**
   * Get statistics about the link graph
   */
  getStatistics(): {
    totalPages: number;
    pagesWithIncomingLinks: number;
    pagesWithNoIncomingLinks: number;
    averageOutgoingLinks: number;
    mostLinkedPages: Array<{ url: string; incomingLinks: number }>;
    leastLinkedPages: Array<{ url: string; incomingLinks: number }>;
  } {
    const pages = Array.from(this.linkGraph.values());
    const pagesWithLinks = pages.filter((p) => p.incomingLinks.size > 0);
    const pagesWithoutLinks = pages.filter(
      (p) => p.incomingLinks.size === 0 && p.url !== this.homepageUrl
    );

    const totalOutgoingLinks = pages.reduce(
      (sum, p) => sum + p.outgoingLinks.size,
      0
    );
    const averageOutgoingLinks = pages.length > 0 ? totalOutgoingLinks / pages.length : 0;

    // Sort by incoming links
    const sortedPages = [...pages].sort(
      (a, b) => b.incomingLinks.size - a.incomingLinks.size
    );

    return {
      totalPages: pages.length,
      pagesWithIncomingLinks: pagesWithLinks.length,
      pagesWithNoIncomingLinks: pagesWithoutLinks.length,
      averageOutgoingLinks,
      mostLinkedPages: sortedPages.slice(0, 10).map((p) => ({
        url: p.url,
        incomingLinks: p.incomingLinks.size,
      })),
      leastLinkedPages: sortedPages
        .slice(-10)
        .reverse()
        .map((p) => ({
          url: p.url,
          incomingLinks: p.incomingLinks.size,
        })),
    };
  }
}

/**
 * Calculate orphan score for the site
 * @param graph - The analyzed site link graph
 * @returns Score from 0-100 (100 = no orphans, 0 = all pages are orphans)
 */
export function calculateOrphanScore(graph: SiteLinkGraph): number {
  const totalPages = graph.pages.size;

  if (totalPages === 0) {
    return 100;
  }

  const orphanCount = graph.orphanPages.length;
  const nearOrphanCount = graph.nearOrphanPages.length;

  // Weight orphans more heavily than near-orphans
  const orphanPenalty = (orphanCount / totalPages) * 60;
  const nearOrphanPenalty = (nearOrphanCount / totalPages) * 30;

  // Additional penalty for high max depth (poor site structure)
  const depthPenalty = Math.min(10, Math.max(0, (graph.maxDepth - 5) * 2));

  const score = 100 - orphanPenalty - nearOrphanPenalty - depthPenalty;

  return Math.max(0, Math.round(score));
}

/**
 * Generate a summary report for orphan pages
 */
export function generateOrphanReport(graph: SiteLinkGraph): {
  score: number;
  summary: string;
  criticalIssues: string[];
  recommendations: string[];
} {
  const score = calculateOrphanScore(graph);
  const totalPages = graph.pages.size;
  const orphanCount = graph.orphanPages.length;
  const nearOrphanCount = graph.nearOrphanPages.length;

  // Count orphans in sitemap
  const orphansInSitemap = graph.orphanPages.filter((url) => {
    const node = graph.pages.get(url);
    return node?.inSitemap;
  }).length;

  // Count unreachable pages
  const unreachablePages = Array.from(graph.pages.values()).filter(
    (node) => node.depth === Infinity
  ).length;

  const criticalIssues: string[] = [];
  const recommendations: string[] = [];

  // Generate summary
  let summary = `Found ${orphanCount} orphan pages and ${nearOrphanCount} near-orphan pages out of ${totalPages} total pages. `;

  if (orphanCount > 0) {
    summary += `${orphanCount} pages have no internal links. `;
  }

  if (nearOrphanCount > 0) {
    summary += `${nearOrphanCount} pages have only 1-2 internal links. `;
  }

  if (graph.maxDepth > 5) {
    summary += `Maximum click depth is ${graph.maxDepth}, which may impact crawlability.`;
  }

  // Critical issues
  if (orphansInSitemap > 0) {
    criticalIssues.push(
      `${orphansInSitemap} orphan pages are listed in sitemap but have no internal links`
    );
  }

  if (unreachablePages > 0) {
    criticalIssues.push(
      `${unreachablePages} pages are unreachable from the homepage`
    );
  }

  if (orphanCount / totalPages > 0.2) {
    criticalIssues.push(
      `Over 20% of pages are orphans - significant internal linking issues`
    );
  }

  // Recommendations
  if (orphanCount > 0) {
    recommendations.push(
      'Add contextual internal links to orphan pages from related content'
    );
    recommendations.push(
      'Review site navigation to ensure all important pages are linked'
    );
  }

  if (nearOrphanCount > 0) {
    recommendations.push(
      'Increase internal links to near-orphan pages to improve authority distribution'
    );
  }

  if (graph.maxDepth > 5) {
    recommendations.push(
      'Flatten site architecture - important pages should be 3-4 clicks from homepage'
    );
  }

  if (graph.averageIncomingLinks < 2) {
    recommendations.push(
      'Increase internal linking - average page should have 3-5 incoming links'
    );
  }

  recommendations.push(
    'Implement breadcrumb navigation to improve internal linking structure'
  );
  recommendations.push(
    'Add related posts/products sections to increase contextual linking'
  );

  return {
    score,
    summary,
    criticalIssues,
    recommendations,
  };
}

export default OrphanPageDetector;
