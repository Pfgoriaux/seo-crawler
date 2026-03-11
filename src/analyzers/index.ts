import {
  CoreWebVitals,
  MetaTags,
  TechnicalSeo,
  DocumentStructure,
  LinksAnalysis,
  PerformanceMetrics,
  MobileFriendliness,
  StructuredData,
  Issue,
  CategoryScores,
  ReadabilityMetrics,
  EEATSignals,
  SecurityHeadersAnalysis,
  ContentFreshnessAnalysis,
  AICitationAnalysis,
  ThirdPartyAnalysis,
  JSRenderingAnalysis,
  RedirectChainAnalysis,
  INPAnalysis,
  HreflangAnalysis,
} from '../types';

import { calculateCwvScore } from './core-web-vitals';
import { calculateMetaTagsScore } from './meta-tags';
import { calculateTechnicalSeoScore } from './technical-seo';
import { calculateDocumentStructureScore } from './document-structure';
import { calculateLinksScore } from './links';
import { calculatePerformanceScore } from './performance';
import { calculateMobileFriendlinessScore } from './mobile-friendly';
import { calculateStructuredDataScore } from './structured-data';

// New analyzer score imports
import { calculateReadabilityScore } from './readability';
import { calculateEEATScore } from './eeat';
import { calculateSecurityHeadersScore } from './security-headers';
import { calculateFreshnessScore } from './content-freshness';
import { calculateAICitationScore } from './ai-citation';
import { calculateThirdPartyScore } from './third-party';
import { calculateJSRenderingScore } from './js-rendering';
import { calculateRedirectScore } from './redirect-chain';
import { calculateINPScore } from './inp-analysis';
import { calculateHreflangScore } from './hreflang-validator';

export interface AnalyzerResults {
  coreWebVitals: CoreWebVitals;
  metaTags: MetaTags;
  technicalSeo: TechnicalSeo;
  documentStructure: DocumentStructure;
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
}

/**
 * Calculate overall page score from all analyzers
 */
export function calculatePageScore(results: AnalyzerResults): CategoryScores {
  // Base scores (always calculated)
  const baseScores = {
    coreWebVitals: calculateCwvScore(results.coreWebVitals),
    metaTags: calculateMetaTagsScore(results.metaTags),
    technicalSeo: calculateTechnicalSeoScore(results.technicalSeo),
    documentStructure: calculateDocumentStructureScore(results.documentStructure),
    links: calculateLinksScore(results.links),
    performance: calculatePerformanceScore(results.performance),
    mobileFriendliness: calculateMobileFriendlinessScore(results.mobileFriendliness),
    structuredData: calculateStructuredDataScore(results.structuredData),
  };

  // New analyzer scores (calculated if data available)
  const newScores = {
    readability: results.readability ? calculateReadabilityScore(results.readability) : 0,
    eeat: results.eeat ? calculateEEATScore(results.eeat) : 0,
    securityHeaders: results.securityHeaders ? calculateSecurityHeadersScore(results.securityHeaders) : 0,
    contentFreshness: results.contentFreshness ? calculateFreshnessScore(results.contentFreshness) : 0,
    aiCitation: results.aiCitation ? calculateAICitationScore(results.aiCitation) : 0,
    thirdParty: results.thirdParty ? calculateThirdPartyScore(results.thirdParty) : 0,
    jsRendering: results.jsRendering ? calculateJSRenderingScore(results.jsRendering) : 0,
    redirectChain: results.redirectChain ? calculateRedirectScore(results.redirectChain) : 0,
    inp: results.inp ? calculateINPScore(results.inp) : 0,
    hreflang: results.hreflang ? calculateHreflangScore(results.hreflang) : 0,
  };

  // Calculate weighted overall score (base analyzers)
  const baseWeights = {
    coreWebVitals: 0.15,
    metaTags: 0.12,
    technicalSeo: 0.12,
    documentStructure: 0.08,
    links: 0.08,
    performance: 0.12,
    mobileFriendliness: 0.08,
    structuredData: 0.05,
  };

  // New analyzer weights (total: 0.20)
  const newWeights = {
    readability: 0.03,
    eeat: 0.03,
    securityHeaders: 0.03,
    contentFreshness: 0.02,
    aiCitation: 0.02,
    thirdParty: 0.02,
    jsRendering: 0.02,
    redirectChain: 0.01,
    inp: 0.01,
    hreflang: 0.01,
  };

  const baseScore = Object.entries(baseWeights).reduce((sum, [key, weight]) => {
    return sum + baseScores[key as keyof typeof baseScores] * weight;
  }, 0);

  const newScore = Object.entries(newWeights).reduce((sum, [key, weight]) => {
    return sum + newScores[key as keyof typeof newScores] * weight;
  }, 0);

  const overall = Math.round(baseScore + newScore);

  return {
    overall,
    ...baseScores,
    ...newScores,
  };
}

/**
 * Collect all issues from analyzer results
 */
export function collectIssues(results: AnalyzerResults): Issue[] {
  const issues: Issue[] = [];

  // Core Web Vitals issues
  if (results.coreWebVitals.lcp !== null && results.coreWebVitals.lcp > 4000) {
    issues.push({
      type: 'error',
      category: 'Core Web Vitals',
      message: `LCP is ${(results.coreWebVitals.lcp / 1000).toFixed(2)}s - should be under 2.5s`,
    });
  } else if (results.coreWebVitals.lcp !== null && results.coreWebVitals.lcp > 2500) {
    issues.push({
      type: 'warning',
      category: 'Core Web Vitals',
      message: `LCP is ${(results.coreWebVitals.lcp / 1000).toFixed(2)}s - needs improvement`,
    });
  }

  if (results.coreWebVitals.cls !== null && results.coreWebVitals.cls > 0.25) {
    issues.push({
      type: 'error',
      category: 'Core Web Vitals',
      message: `CLS is ${results.coreWebVitals.cls.toFixed(3)} - should be under 0.1`,
    });
  } else if (results.coreWebVitals.cls !== null && results.coreWebVitals.cls > 0.1) {
    issues.push({
      type: 'warning',
      category: 'Core Web Vitals',
      message: `CLS is ${results.coreWebVitals.cls.toFixed(3)} - needs improvement`,
    });
  }

  // Meta tags issues
  if (!results.metaTags.title) {
    issues.push({
      type: 'error',
      category: 'Meta Tags',
      message: 'Missing title tag',
    });
  } else if (results.metaTags.titleLength > 60) {
    issues.push({
      type: 'warning',
      category: 'Meta Tags',
      message: 'Title too long (over 60 chars)',
      details: `${results.metaTags.titleLength} characters - recommended 50-60`,
    });
  } else if (results.metaTags.titleLength < 50) {
    issues.push({
      type: 'warning',
      category: 'Meta Tags',
      message: 'Title too short (under 50 chars)',
      details: `${results.metaTags.titleLength} characters - recommended 50-60`,
    });
  }

  // Pixel width check for title (separate from character count)
  if (results.metaTags.title && results.metaTags.titlePixelWidth > 600) {
    issues.push({
      type: 'warning',
      category: 'Meta Tags',
      message: 'Title will be truncated in SERP (over 600px)',
      details: `${results.metaTags.titlePixelWidth}px - Google SERP displays ~600px max`,
    });
  }

  if (!results.metaTags.description) {
    issues.push({
      type: 'error',
      category: 'Meta Tags',
      message: 'Missing meta description',
    });
  } else if (results.metaTags.descriptionLength > 160) {
    issues.push({
      type: 'warning',
      category: 'Meta Tags',
      message: 'Description too long (over 160 chars)',
      details: `${results.metaTags.descriptionLength} characters - recommended 110-160`,
    });
  } else if (results.metaTags.descriptionLength < 110) {
    issues.push({
      type: 'warning',
      category: 'Meta Tags',
      message: 'Description too short (under 110 chars)',
      details: `${results.metaTags.descriptionLength} characters - recommended 110-160`,
    });
  }

  // Pixel width check for description (separate from character count)
  if (results.metaTags.description && results.metaTags.descriptionPixelWidth > 920) {
    issues.push({
      type: 'warning',
      category: 'Meta Tags',
      message: 'Description will be truncated in SERP (over 920px)',
      details: `${results.metaTags.descriptionPixelWidth}px - Google SERP displays ~920px max on desktop`,
    });
  }

  if (!results.metaTags.viewport) {
    issues.push({
      type: 'error',
      category: 'Meta Tags',
      message: 'Missing viewport meta tag',
    });
  }

  if (!results.metaTags.canonical) {
    issues.push({
      type: 'warning',
      category: 'Meta Tags',
      message: 'Missing canonical URL',
    });
  }

  // Open Graph issues
  if (!results.metaTags.openGraph.title) {
    issues.push({
      type: 'warning',
      category: 'Meta Tags',
      message: 'Missing og:title',
    });
  }
  if (!results.metaTags.openGraph.image) {
    issues.push({
      type: 'warning',
      category: 'Meta Tags',
      message: 'Missing og:image',
    });
  }

  if (!results.metaTags.favicon) {
    issues.push({
      type: 'info',
      category: 'Meta Tags',
      message: 'Missing favicon',
    });
  }

  // Technical SEO issues
  if (!results.technicalSeo.isHttps) {
    issues.push({
      type: 'error',
      category: 'Technical SEO',
      message: 'Page is not served over HTTPS',
    });
  }

  if (results.technicalSeo.statusCode >= 400) {
    issues.push({
      type: 'error',
      category: 'Technical SEO',
      message: `HTTP status code ${results.technicalSeo.statusCode}`,
    });
  }

  if (results.technicalSeo.hasRobotsNoindex) {
    issues.push({
      type: 'warning',
      category: 'Technical SEO',
      message: 'Page has robots noindex directive',
    });
  }

  if (results.technicalSeo.hasXRobotsNoindex) {
    issues.push({
      type: 'warning',
      category: 'Technical SEO',
      message: 'Page has X-Robots-Tag noindex header',
    });
  }

  if (results.technicalSeo.redirectChain.length > 2) {
    issues.push({
      type: 'warning',
      category: 'Technical SEO',
      message: `Too many redirects (${results.technicalSeo.redirectChain.length})`,
    });
  }

  // Document structure issues
  if (!results.documentStructure.hasValidDoctype) {
    issues.push({
      type: 'warning',
      category: 'Document Structure',
      message: 'Invalid or missing HTML5 doctype',
    });
  }

  if (results.documentStructure.h1Count === 0) {
    issues.push({
      type: 'error',
      category: 'Document Structure',
      message: 'Missing H1 heading',
    });
  } else if (results.documentStructure.h1Count > 1) {
    issues.push({
      type: 'warning',
      category: 'Document Structure',
      message: `Multiple H1 headings (${results.documentStructure.h1Count})`,
    });
  }

  if (!results.documentStructure.headingHierarchyValid) {
    issues.push({
      type: 'warning',
      category: 'Document Structure',
      message: 'Heading hierarchy is not valid (skipped levels)',
    });
  }

  if (results.documentStructure.imagesWithoutAlt > 0) {
    issues.push({
      type: 'warning',
      category: 'Document Structure',
      message: `${results.documentStructure.imagesWithoutAlt} images missing alt attribute`,
    });
  }

  if (!results.documentStructure.urlSeoFriendly) {
    issues.push({
      type: 'warning',
      category: 'Document Structure',
      message: 'URL is not SEO-friendly',
    });
  }

  // Links issues
  if (results.links.brokenLinksCount > 0) {
    issues.push({
      type: 'error',
      category: 'Links',
      message: `${results.links.brokenLinksCount} broken links found`,
    });
  }

  if (results.links.internalLinksCount === 0) {
    issues.push({
      type: 'warning',
      category: 'Links',
      message: 'No internal links found',
    });
  }

  // Performance issues
  const sizeMB = results.performance.totalResourceSize / (1024 * 1024);
  if (sizeMB > 5) {
    issues.push({
      type: 'error',
      category: 'Performance',
      message: `Page size is ${sizeMB.toFixed(2)}MB - should be under 3MB`,
    });
  } else if (sizeMB > 3) {
    issues.push({
      type: 'warning',
      category: 'Performance',
      message: `Page size is ${sizeMB.toFixed(2)}MB - consider optimizing`,
    });
  }

  if (!results.performance.compressionEnabled) {
    issues.push({
      type: 'warning',
      category: 'Performance',
      message: 'Compression (gzip/brotli) is not enabled',
    });
  }

  if (results.performance.resourceCount.total > 100) {
    issues.push({
      type: 'warning',
      category: 'Performance',
      message: `Too many resources (${results.performance.resourceCount.total})`,
    });
  }

  // Mobile friendliness issues
  if (!results.mobileFriendliness.hasViewportMeta) {
    issues.push({
      type: 'error',
      category: 'Mobile Friendliness',
      message: 'Missing viewport meta tag',
    });
  }

  if (results.mobileFriendliness.smallTextElements > 0) {
    issues.push({
      type: 'warning',
      category: 'Mobile Friendliness',
      message: `${results.mobileFriendliness.smallTextElements} elements with font size < 12px`,
    });
  }

  if (results.mobileFriendliness.smallTapTargets > 0) {
    issues.push({
      type: 'warning',
      category: 'Mobile Friendliness',
      message: `${results.mobileFriendliness.smallTapTargets} tap targets smaller than 48x48px`,
    });
  }

  if (results.mobileFriendliness.hasPlugins) {
    issues.push({
      type: 'error',
      category: 'Mobile Friendliness',
      message: 'Page uses deprecated plugins (Flash/Silverlight)',
    });
  }

  // Structured data issues
  const invalidJsonLd = results.structuredData.jsonLd.filter((item) => !item.valid);
  if (invalidJsonLd.length > 0) {
    issues.push({
      type: 'error',
      category: 'Structured Data',
      message: `${invalidJsonLd.length} invalid JSON-LD block(s)`,
    });
  }

  if (!results.structuredData.hasStructuredData) {
    issues.push({
      type: 'info',
      category: 'Structured Data',
      message: 'No structured data found',
    });
  }

  // ===== NEW ANALYZER ISSUES =====

  // Readability issues
  if (results.readability) {
    if (results.readability.wordCount < 300) {
      issues.push({
        type: 'warning',
        category: 'Readability',
        message: `Low word count (${results.readability.wordCount}) - consider adding more content`,
      });
    }
    if (results.readability.fleschKincaidGrade > 12) {
      issues.push({
        type: 'warning',
        category: 'Readability',
        message: `Content reading level too high (Grade ${results.readability.fleschKincaidGrade.toFixed(1)}) - aim for Grade 8-10`,
      });
    }
    if (results.readability.averageSentenceLength > 25) {
      issues.push({
        type: 'info',
        category: 'Readability',
        message: `Long average sentence length (${results.readability.averageSentenceLength.toFixed(1)} words) - consider shorter sentences`,
      });
    }
  }

  // E-E-A-T issues
  if (results.eeat) {
    if (!results.eeat.authorName && !results.eeat.authorBio) {
      issues.push({
        type: 'warning',
        category: 'E-E-A-T',
        message: 'No author information found - add author bylines for credibility',
      });
    }
    if (!results.eeat.privacyPolicyLink) {
      issues.push({
        type: 'warning',
        category: 'E-E-A-T',
        message: 'No privacy policy link found',
      });
    }
    if (!results.eeat.contactPageExists && !results.eeat.phoneNumber) {
      issues.push({
        type: 'warning',
        category: 'E-E-A-T',
        message: 'No contact information found - add contact details for trust',
      });
    }
  }

  // Security Headers issues
  if (results.securityHeaders) {
    if (results.securityHeaders.overallGrade === 'F') {
      issues.push({
        type: 'error',
        category: 'Security',
        message: 'Critical security headers missing - Grade F',
      });
    } else if (results.securityHeaders.overallGrade === 'D') {
      issues.push({
        type: 'warning',
        category: 'Security',
        message: 'Multiple security headers missing - Grade D',
      });
    }
    if (!results.securityHeaders.strictTransportSecurity.present) {
      issues.push({
        type: 'warning',
        category: 'Security',
        message: 'Missing HSTS header (Strict-Transport-Security)',
      });
    }
    if (!results.securityHeaders.xContentTypeOptions.present) {
      issues.push({
        type: 'info',
        category: 'Security',
        message: 'Missing X-Content-Type-Options header',
      });
    }
  }

  // Content Freshness issues
  if (results.contentFreshness) {
    if (results.contentFreshness.contentAgeDays !== null && results.contentFreshness.contentAgeDays > 730) {
      issues.push({
        type: 'warning',
        category: 'Content Freshness',
        message: `Content is over 2 years old (${Math.floor(results.contentFreshness.contentAgeDays / 365)} years)`,
      });
    }
    if (!results.contentFreshness.publishedDate && !results.contentFreshness.lastModifiedDate) {
      issues.push({
        type: 'info',
        category: 'Content Freshness',
        message: 'No publication or modification date found - add date metadata',
      });
    }
    if (results.contentFreshness.outdatedYears.length > 0) {
      issues.push({
        type: 'info',
        category: 'Content Freshness',
        message: `Content references outdated years: ${results.contentFreshness.outdatedYears.slice(0, 3).join(', ')}`,
      });
    }
  }

  // AI Citation issues
  if (results.aiCitation) {
    if (results.aiCitation.citationWorthiness === 'low') {
      issues.push({
        type: 'info',
        category: 'AI Citation',
        message: 'Low AI citation potential - consider adding FAQ sections, definitions, or direct answers',
      });
    }
    if (!results.aiCitation.hasFAQSection && !results.aiCitation.hasDirectAnswer) {
      issues.push({
        type: 'info',
        category: 'AI Citation',
        message: 'Content lacks FAQ or direct answer format - optimize for AI crawlers',
      });
    }
  }

  // Third Party issues
  if (results.thirdParty) {
    if (results.thirdParty.vendors.length > 20) {
      issues.push({
        type: 'warning',
        category: 'Third Party',
        message: `High number of third-party vendors (${results.thirdParty.vendors.length}) - may impact performance`,
      });
    }
    if (results.thirdParty.trackingScripts.length > 0) {
      issues.push({
        type: 'info',
        category: 'Third Party',
        message: `Tracking scripts detected: ${results.thirdParty.trackingScripts.slice(0, 2).join(', ')}`,
      });
    }
    if (results.thirdParty.blockingScripts.length > 0) {
      issues.push({
        type: 'warning',
        category: 'Third Party',
        message: `Render-blocking third-party scripts: ${results.thirdParty.blockingScripts.length} detected`,
      });
    }
  }

  // JS Rendering issues
  if (results.jsRendering) {
    const diff = results.jsRendering.differences;
    if (diff.titleChanged || diff.descriptionChanged || diff.h1Changed) {
      issues.push({
        type: 'warning',
        category: 'JS Rendering',
        message: 'Critical SEO content changes after JavaScript execution - may affect crawlers',
        details: [
          diff.titleChanged && 'Title changed',
          diff.descriptionChanged && 'Description changed',
          diff.h1Changed && 'H1 changed',
        ].filter(Boolean).join(', '),
      });
    }
    if (diff.contentLengthDiff > 1000) {
      issues.push({
        type: 'info',
        category: 'JS Rendering',
        message: `Significant content added via JavaScript (+${diff.contentLengthDiff} characters)`,
      });
    }
  }

  // Redirect Chain issues
  if (results.redirectChain) {
    if (results.redirectChain.totalHops > 3) {
      issues.push({
        type: 'warning',
        category: 'Redirect Chain',
        message: `Long redirect chain (${results.redirectChain.totalHops} hops) - consolidate redirects`,
      });
    }
    if (results.redirectChain.hasLoop) {
      issues.push({
        type: 'error',
        category: 'Redirect Chain',
        message: 'Redirect loop detected - will cause infinite redirect',
      });
    }
    if (results.redirectChain.issues.length > 0) {
      issues.push({
        type: 'warning',
        category: 'Redirect Chain',
        message: results.redirectChain.issues[0],
      });
    }
  }

  // INP issues
  if (results.inp) {
    if (results.inp.inpRating === 'poor') {
      issues.push({
        type: 'error',
        category: 'Interaction to Next Paint',
        message: `Poor INP score (${results.inp.estimatedINP}ms) - should be under 200ms`,
      });
    } else if (results.inp.inpRating === 'needs-improvement') {
      issues.push({
        type: 'warning',
        category: 'Interaction to Next Paint',
        message: `INP needs improvement (${results.inp.estimatedINP}ms) - target under 200ms`,
      });
    }
    if (results.inp.longTasks.count > 5) {
      issues.push({
        type: 'warning',
        category: 'Interaction to Next Paint',
        message: `${results.inp.longTasks.count} long tasks detected - may impact interactivity`,
      });
    }
  }

  // Hreflang issues
  if (results.hreflang) {
    if (results.hreflang.totalTags > 0 && !results.hreflang.hasSelfReference) {
      issues.push({
        type: 'warning',
        category: 'Hreflang',
        message: 'Missing self-referencing hreflang tag',
      });
    }
    if (results.hreflang.invalidCodes.length > 0) {
      issues.push({
        type: 'error',
        category: 'Hreflang',
        message: `Invalid hreflang codes: ${results.hreflang.invalidCodes.join(', ')}`,
      });
    }
    if (results.hreflang.canonicalConflict) {
      issues.push({
        type: 'error',
        category: 'Hreflang',
        message: 'Canonical URL conflicts with hreflang tags',
      });
    }
  }

  return issues;
}

// Re-export analyzer functions
export { analyzeCoreWebVitals, calculateCwvScore } from './core-web-vitals';
export { analyzeMetaTags, calculateMetaTagsScore } from './meta-tags';
export { analyzeTechnicalSeo, calculateTechnicalSeoScore } from './technical-seo';
export { analyzeDocumentStructure, calculateDocumentStructureScore } from './document-structure';
export { analyzeLinks, calculateLinksScore } from './links';
export { analyzePerformance, calculatePerformanceScore } from './performance';
export { analyzeMobileFriendliness, calculateMobileFriendlinessScore } from './mobile-friendly';
export { analyzeStructuredData, calculateStructuredDataScore } from './structured-data';
export { validateSitemap, calculateSitemapScore } from './sitemap-validator';
export type { SitemapValidation, SitemapIssue } from './sitemap-validator';

// New analyzer exports
export { analyzeReadability, calculateReadabilityScore } from './readability';
export type { ReadabilityMetrics } from './readability';
export { analyzeEEAT, calculateEEATScore } from './eeat';
export type { EEATSignals } from './eeat';
export { analyzeSecurityHeaders, calculateSecurityHeadersScore } from './security-headers';
export type { SecurityHeadersAnalysis, SecurityGrade, CSPAnalysis, HSTSAnalysis } from './security-headers';
export { analyzeContentFreshness, calculateFreshnessScore } from './content-freshness';
export type { ContentFreshnessAnalysis } from './content-freshness';
export { analyzeAICitation, calculateAICitationScore } from './ai-citation';
export type { AICitationAnalysis } from './ai-citation';
export { analyzeThirdParty, calculateThirdPartyScore } from './third-party';
export type { ThirdPartyAnalysis, ThirdPartyVendor } from './third-party';
export { analyzeJSRendering, calculateJSRenderingScore } from './js-rendering';
export type { JSRenderingAnalysis } from './js-rendering';
export { analyzeRedirectChain, calculateRedirectScore } from './redirect-chain';
export type { RedirectChainAnalysis, RedirectHop } from './redirect-chain';
export { analyzeINP, calculateINPScore } from './inp-analysis';
export type { INPAnalysis } from './inp-analysis';
export { analyzeHreflang, calculateHreflangScore } from './hreflang-validator';
export type { HreflangAnalysis, HreflangIssue, HreflangTag } from './hreflang-validator';
export { OrphanPageDetector, calculateOrphanScore, generateOrphanReport } from './orphan-pages';
export type { OrphanPageAnalysis, SiteLinkGraph, PageNode } from './orphan-pages';
