// Import types for use in PageAnalysis interface
import type { ReadabilityMetrics } from '../analyzers/readability';
import type { EEATSignals } from '../analyzers/eeat';
import type { ContentFreshnessAnalysis } from '../analyzers/content-freshness';
import type { AICitationAnalysis } from '../analyzers/ai-citation';
import type { ThirdPartyAnalysis } from '../analyzers/third-party';
import type { JSRenderingAnalysis } from '../analyzers/js-rendering';
import type { RedirectChainAnalysis } from '../analyzers/redirect-chain';
import type { INPAnalysis } from '../analyzers/inp-analysis';
import type { HreflangAnalysis } from '../analyzers/hreflang-validator';
import type { SecurityHeadersAnalysis } from '../analyzers/security-headers';

// Sitemap types
export interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

// Re-export new analyzer interfaces
export type { ReadabilityMetrics } from '../analyzers/readability';
export type { EEATSignals } from '../analyzers/eeat';
export type { ContentFreshnessAnalysis } from '../analyzers/content-freshness';
export type { AICitationAnalysis } from '../analyzers/ai-citation';
export type { ThirdPartyAnalysis, ThirdPartyVendor } from '../analyzers/third-party';
export type { JSRenderingAnalysis } from '../analyzers/js-rendering';
export type { RedirectChainAnalysis, RedirectHop } from '../analyzers/redirect-chain';
export type { INPAnalysis } from '../analyzers/inp-analysis';
export type { HreflangAnalysis, HreflangIssue, HreflangTag as HreflangTagDetailed } from '../analyzers/hreflang-validator';
export type { SitemapValidation, SitemapIssue } from '../analyzers/sitemap-validator';
export type { SecurityHeadersAnalysis, SecurityGrade, CSPAnalysis, HSTSAnalysis } from '../analyzers/security-headers';
export type { OrphanPageAnalysis, SiteLinkGraph, PageNode } from '../analyzers/orphan-pages';

export interface SitemapIndex {
  sitemap: {
    loc: string;
    lastmod?: string;
  }[];
}

// Core Web Vitals types
export interface CoreWebVitals {
  lcp: number | null;          // Largest Contentful Paint (ms)
  fid: number | null;          // First Input Delay (ms)
  cls: number | null;          // Cumulative Layout Shift
  ttfb: number | null;         // Time to First Byte (ms)
  fcp: number | null;          // First Contentful Paint (ms)
  si: number | null;           // Speed Index (ms)
  tti: number | null;          // Time to Interactive (ms)
}

export interface CoreWebVitalsScore {
  lcp: 'good' | 'needs-improvement' | 'poor' | 'unknown';
  fid: 'good' | 'needs-improvement' | 'poor' | 'unknown';
  cls: 'good' | 'needs-improvement' | 'poor' | 'unknown';
}

// Meta tags types
export interface MetaTags {
  title: string | null;
  titleLength: number;
  titlePixelWidth: number;  // Estimated pixel width for SERP display (~600px max)
  description: string | null;
  descriptionLength: number;
  descriptionPixelWidth: number;  // Estimated pixel width for SERP display (~920px max)
  viewport: string | null;
  robots: string | null;
  canonical: string | null;
  hreflang: HreflangTag[];
  openGraph: OpenGraphTags;
  twitterCard: TwitterCardTags;
  favicon: string | null;
}

export interface HreflangTag {
  lang: string;
  href: string;
}

export interface OpenGraphTags {
  title: string | null;
  type: string | null;
  image: string | null;
  url: string | null;
  description: string | null;
  siteName: string | null;
}

export interface TwitterCardTags {
  card: string | null;
  title: string | null;
  description: string | null;
  image: string | null;
  site: string | null;
}

// Document structure types
export interface DocumentStructure {
  doctype: string | null;
  hasValidDoctype: boolean;
  headings: HeadingInfo[];
  headingHierarchyValid: boolean;
  h1Count: number;
  images: ImageInfo[];
  imagesWithoutAlt: number;
  totalImages: number;
  urlSeoFriendly: boolean;
}

export interface HeadingInfo {
  level: number;
  text: string;
}

export interface ImageInfo {
  src: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  loading: string | null;
}

// Technical SEO types
export interface TechnicalSeo {
  statusCode: number;
  isHttps: boolean;
  hasRobotsNoindex: boolean;
  hasXRobotsNoindex: boolean;
  canonicalUrl: string | null;
  canonicalValid: boolean;
  redirectChain: string[];
  responseHeaders: Record<string, string>;
}

// Links types
export interface LinksAnalysis {
  internalLinks: LinkInfo[];
  externalLinks: LinkInfo[];
  brokenLinks: LinkInfo[];
  totalLinks: number;
  internalLinksCount: number;
  externalLinksCount: number;
  brokenLinksCount: number;
}

export interface LinkInfo {
  href: string;
  text: string;
  rel: string | null;
  isNofollow: boolean;
  statusCode?: number;
}

// Performance types
export interface PerformanceMetrics {
  totalResourceSize: number;
  resourceCount: ResourceCount;
  compressionEnabled: boolean;
  cacheHeaders: CacheAnalysis;
  resourceDetails: ResourceDetail[];
}

export interface ResourceCount {
  total: number;
  scripts: number;
  stylesheets: number;
  images: number;
  fonts: number;
  other: number;
}

export interface CacheAnalysis {
  hasCacheControl: boolean;
  hasExpires: boolean;
  cacheableResources: number;
  nonCacheableResources: number;
}

export interface ResourceDetail {
  url: string;
  type: string;
  size: number;
  compressed: boolean;
  cached: boolean;
}

// Mobile friendliness types
export interface MobileFriendliness {
  hasViewportMeta: boolean;
  viewportContent: string | null;
  smallTextElements: number;
  smallTapTargets: number;
  hasPlugins: boolean;
  pluginElements: string[];
}

// Structured data types
export interface StructuredData {
  jsonLd: JsonLdData[];
  microdata: MicrodataItem[];
  hasStructuredData: boolean;
  schemaTypes: string[];
}

export interface JsonLdData {
  type: string;
  data: Record<string, unknown>;
  valid: boolean;
  errors: string[];
}

export interface MicrodataItem {
  type: string;
  properties: Record<string, string>;
}

// Overall page analysis result
export interface PageAnalysis {
  url: string;
  crawledAt: string;
  statusCode: number;
  loadTime: number;
  coreWebVitals: CoreWebVitals;
  coreWebVitalsScore: CoreWebVitalsScore;
  metaTags: MetaTags;
  documentStructure: DocumentStructure;
  technicalSeo: TechnicalSeo;
  links: LinksAnalysis;
  performance: PerformanceMetrics;
  mobileFriendliness: MobileFriendliness;
  structuredData: StructuredData;
  // New analyzer results
  readability?: ReadabilityMetrics;
  eeat?: EEATSignals;
  securityHeaders?: SecurityHeadersAnalysis;
  contentFreshness?: ContentFreshnessAnalysis;
  aiCitation?: AICitationAnalysis;
  thirdParty?: ThirdPartyAnalysis;
  jsRendering?: JSRenderingAnalysis;
  redirectChain?: RedirectChainAnalysis;
  inp?: INPAnalysis;
  hreflang?: HreflangAnalysis;
  issues: Issue[];
  score: CategoryScores;
}

export interface Issue {
  type: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  details?: string;
  element?: string;
}

export interface CategoryScores {
  overall: number;
  coreWebVitals: number;
  metaTags: number;
  technicalSeo: number;
  documentStructure: number;
  links: number;
  performance: number;
  mobileFriendliness: number;
  structuredData: number;
  // New analyzer scores
  readability: number;
  eeat: number;
  securityHeaders: number;
  contentFreshness: number;
  aiCitation: number;
  thirdParty: number;
  jsRendering: number;
  redirectChain: number;
  inp: number;
  hreflang: number;
}

// Crawl report types
export interface CrawlReport {
  siteUrl: string;
  sitemapUrl: string;
  crawlDate: string;
  totalPages: number;
  crawledPages: number;
  failedPages: number;
  duration: number;
  summary: CrawlSummary;
  pages: PageAnalysis[];
  clusters?: ClusterSummary;  // Cluster-based analysis
}

export interface CrawlSummary {
  averageScore: number;
  issuesByType: {
    errors: number;
    warnings: number;
    info: number;
  };
  issuesByCategory: Record<string, number>;
  coreWebVitalsDistribution: {
    good: number;
    needsImprovement: number;
    poor: number;
  };
  topIssues: { message: string; count: number }[];
}

// Crawler configuration
export interface CrawlerConfig {
  sitemapUrl: string;
  outputDir: string;
  concurrency: number;
  timeout: number;
  userAgent: string;
  formats: ('json' | 'html')[];
  maxPages?: number;
  screenshotsEnabled: boolean;
  checkBrokenLinks: boolean;
  viewport: {
    width: number;
    height: number;
  };
}

export const DEFAULT_CONFIG: Partial<CrawlerConfig> = {
  concurrency: 3,
  timeout: 30000,
  userAgent: 'SEO-Crawler/1.0 (https://github.com/pfgope/seo-crawler)',
  formats: ['json', 'html'],
  screenshotsEnabled: false,
  checkBrokenLinks: true,
  viewport: {
    width: 1920,
    height: 1080,
  },
};

// Cluster Analysis Types
export interface ClusterAnalysis {
  pattern: string;              // e.g., "/jobs/*", "/blog/*"
  patternDisplay: string;       // Human-readable pattern name
  pageCount: number;
  pages: string[];              // URLs in this cluster
  avgScore: number;
  minScore: number;
  maxScore: number;

  // Common issues that appear in multiple pages of this cluster
  commonIssues: ClusterIssue[];

  // Template issues (appear in 80%+ of cluster pages - likely template-level problems)
  templateIssues: ClusterIssue[];

  // Category score aggregates
  scores: {
    avg: CategoryScores;
    min: CategoryScores;
    max: CategoryScores;
  };

  // Issue distribution within cluster
  issueDistribution: {
    errors: number;
    warnings: number;
    info: number;
  };
}

export interface ClusterIssue {
  issue: Issue;
  affectedCount: number;        // How many pages in cluster have this issue
  affectedUrls: string[];       // URLs affected
  percentage: number;           // % of cluster affected
  isTemplateIssue: boolean;     // True if appears in 80%+ of pages
}

export interface ClusterSummary {
  totalClusters: number;
  clusters: ClusterAnalysis[];

  // Cross-cluster metrics
  worstPerformingClusters: Array<{
    pattern: string;
    avgScore: number;
    issueCount: number;
  }>;

  // Issues that appear across multiple clusters (site-wide problems)
  siteWideIssues: Array<{
    message: string;
    affectedClusters: number;
    totalAffectedPages: number;
  }>;
}

// AI Improvement Agent Types
export interface ImprovementSuggestion {
  category: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  issue: string;
  currentState: string;
  suggestedFix: string;
  affectedUrls: string[];
  estimatedImpact: string;
  implementationGuide?: string;
}

export interface ClusterImprovement {
  cluster: string;
  improvements: ImprovementSuggestion[];
  generatedContent?: {
    metaTags?: Array<{
      url: string;
      title: string;
      description: string;
    }>;
    structuredData?: Array<{
      url: string;
      schema: Record<string, unknown>;
    }>;
    contentRewrites?: Array<{
      url: string;
      original: string;
      improved: string;
      reason: string;
    }>;
  };
}

export interface ImprovementPlan {
  siteUrl: string;
  generatedAt: string;
  summary: {
    totalIssues: number;
    criticalIssues: number;
    estimatedScoreImprovement: number;
  };
  clusterImprovements: ClusterImprovement[];
  siteWideRecommendations: ImprovementSuggestion[];
  prioritizedActions: Array<{
    action: string;
    impact: string;
    effort: 'low' | 'medium' | 'high';
    affectedPages: number;
  }>;
}
