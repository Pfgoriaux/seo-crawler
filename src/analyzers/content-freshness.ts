import { Page } from 'playwright';

export interface ContentFreshnessAnalysis {
  publishedDate: string | null;
  lastModifiedDate: string | null;
  lastReviewedDate: string | null;
  contentAgeDays: number | null;
  outdatedYears: string[];
  temporalReferences: {
    relative: number;
    specific: number;
  };
  updateIndicators: {
    hasUpdateNotice: boolean;
    hasVersionInfo: boolean;
  };
  freshnessSignals: {
    positive: string[];
    negative: string[];
  };
}

/**
 * Analyze content freshness on a page
 */
export async function analyzeContentFreshness(page: Page): Promise<ContentFreshnessAnalysis> {
  const freshnessData = await page.evaluate(() => {
    const currentYear = new Date().getFullYear();
    const twoYearsAgo = currentYear - 2;

    // Helper to get meta content
    const getMeta = (name: string, property?: boolean): string | null => {
      const selector = property
        ? `meta[property="${name}"]`
        : `meta[name="${name}"]`;
      const element = document.querySelector(selector);
      return element?.getAttribute('content') || null;
    };

    // Helper to extract dates from structured data
    const extractStructuredDataDates = (): {
      published: string | null;
      modified: string | null;
    } => {
      const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
      let published: string | null = null;
      let modified: string | null = null;

      jsonLdScripts.forEach((script) => {
        try {
          const data = JSON.parse(script.textContent || '');
          if (data.datePublished && !published) {
            published = data.datePublished;
          }
          if (data.dateModified && !modified) {
            modified = data.dateModified;
          }
        } catch {
          // Skip invalid JSON
        }
      });

      return { published, modified };
    };

    // Get dates from various sources
    const structuredDates = extractStructuredDataDates();

    // Published date from multiple sources
    const publishedDate =
      getMeta('article:published_time', true) ||
      getMeta('datePublished') ||
      getMeta('date') ||
      getMeta('DC.date.created') ||
      structuredDates.published;

    // Last modified date from multiple sources
    const lastModifiedDate =
      getMeta('article:modified_time', true) ||
      getMeta('dateModified') ||
      getMeta('last-modified') ||
      getMeta('DC.date.modified') ||
      structuredDates.modified;

    // Last reviewed date
    const lastReviewedDate =
      getMeta('article:reviewed_time', true) ||
      getMeta('dateReviewed');

    // Calculate content age
    let contentAgeDays: number | null = null;
    const dateToCheck = lastModifiedDate || publishedDate;
    if (dateToCheck) {
      try {
        const date = new Date(dateToCheck);
        if (!isNaN(date.getTime())) {
          const now = new Date();
          contentAgeDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        }
      } catch {
        // Invalid date format
      }
    }

    // Get body text for content analysis
    const bodyText = document.body.innerText || '';

    // Find outdated years in content
    const yearPattern = /\b(20\d{2})\b/g;
    const yearsFound = new Set<string>();
    let match;
    while ((match = yearPattern.exec(bodyText)) !== null) {
      const year = parseInt(match[1]);
      if (year <= twoYearsAgo && year >= 2010) {
        yearsFound.add(match[1]);
      }
    }
    const outdatedYears = Array.from(yearsFound).sort().reverse();

    // Count temporal references
    const relativeTimePatterns = [
      /\b(recently|lately|now|today|currently|these days|nowadays)\b/gi,
      /\b(this (year|month|week)|last (year|month|week))\b/gi,
      /\b(at the moment|as of now|for now)\b/gi,
    ];

    let relativeCount = 0;
    relativeTimePatterns.forEach((pattern) => {
      const matches = bodyText.match(pattern);
      if (matches) {
        relativeCount += matches.length;
      }
    });

    // Count specific date references
    const specificDatePatterns = [
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+20\d{2}\b/gi,
      /\b\d{1,2}\/(0?[1-9]|1[0-2])\/20\d{2}\b/g,
      /\b20\d{2}-\d{2}-\d{2}\b/g,
    ];

    let specificCount = 0;
    specificDatePatterns.forEach((pattern) => {
      const matches = bodyText.match(pattern);
      if (matches) {
        specificCount += matches.length;
      }
    });

    // Check for update indicators
    const updatePatterns = [
      /\b(updated|revised|modified)\s+(on|:)/i,
      /\blast\s+updated?\b/i,
      /\boriginally\s+published\b/i,
      /\bcontent\s+updated\b/i,
    ];

    const hasUpdateNotice = updatePatterns.some((pattern) => pattern.test(bodyText));

    // Check for version information
    const versionPatterns = [
      /\bversion\s+\d+\.\d+/i,
      /\bv\d+\.\d+/i,
      /\bchangelog\b/i,
      /\brelease notes\b/i,
    ];

    const hasVersionInfo = versionPatterns.some((pattern) => pattern.test(bodyText));

    // Detect freshness signals
    const positiveSignals: string[] = [];
    const negativeSignals: string[] = [];

    // Positive signals
    if (hasUpdateNotice) {
      positiveSignals.push('Has update notice');
    }
    if (hasVersionInfo) {
      positiveSignals.push('Contains version information');
    }
    if (lastModifiedDate) {
      positiveSignals.push('Has last modified date');
    }
    if (lastReviewedDate) {
      positiveSignals.push('Has last reviewed date');
    }
    if (contentAgeDays !== null && contentAgeDays < 180) {
      positiveSignals.push('Content less than 6 months old');
    }

    // Negative signals
    if (outdatedYears.length > 0) {
      negativeSignals.push(`Contains outdated year references: ${outdatedYears.join(', ')}`);
    }
    if (contentAgeDays !== null && contentAgeDays > 730) {
      negativeSignals.push('Content more than 2 years old');
    }
    if (!lastModifiedDate && !publishedDate) {
      negativeSignals.push('No publication or modification date found');
    }
    if (relativeCount > 5) {
      negativeSignals.push('Excessive relative time references (may become outdated)');
    }

    // Check for "current" or "latest" claims
    const staleClaimPatterns = [
      /\bthe latest\b/i,
      /\bmost recent\b/i,
      /\bcurrently\b/i,
      /\bup to date\b/i,
      /\bup-to-date\b/i,
    ];

    const hasStaleClaimRisk = staleClaimPatterns.some((pattern) => pattern.test(bodyText));
    if (hasStaleClaimRisk && contentAgeDays !== null && contentAgeDays > 365) {
      negativeSignals.push('Contains "latest/current" claims in potentially outdated content');
    }

    // Check for technology/version references that might be outdated
    const techVersionPattern = /\b(iOS|Android|Windows|macOS|Node\.?js|Python|Java|PHP|React|Angular|Vue)\s+(\d+)/gi;
    const techVersionMatches = bodyText.match(techVersionPattern);
    if (techVersionMatches && techVersionMatches.length > 0) {
      if (contentAgeDays !== null && contentAgeDays > 365) {
        negativeSignals.push('Contains technology version references in content over 1 year old');
      } else {
        positiveSignals.push('Contains specific technology versions');
      }
    }

    return {
      publishedDate,
      lastModifiedDate,
      lastReviewedDate,
      contentAgeDays,
      outdatedYears,
      temporalReferences: {
        relative: relativeCount,
        specific: specificCount,
      },
      updateIndicators: {
        hasUpdateNotice,
        hasVersionInfo,
      },
      freshnessSignals: {
        positive: positiveSignals,
        negative: negativeSignals,
      },
    };
  });

  // Note: HTTP Last-Modified header check removed to avoid re-navigation issues
  // Headers would need to be passed from the initial page load to be checked here

  return freshnessData;
}

/**
 * Calculate freshness score (0-100)
 * Higher scores indicate fresher, more up-to-date content
 */
export function calculateFreshnessScore(analysis: ContentFreshnessAnalysis): number {
  let score = 100;

  // Content age scoring (most important factor)
  if (analysis.contentAgeDays !== null) {
    if (analysis.contentAgeDays <= 30) {
      // Content less than 1 month old: full points
      score += 0;
    } else if (analysis.contentAgeDays <= 90) {
      // Content 1-3 months old: slight penalty
      score -= 5;
    } else if (analysis.contentAgeDays <= 180) {
      // Content 3-6 months old: moderate penalty
      score -= 10;
    } else if (analysis.contentAgeDays <= 365) {
      // Content 6-12 months old: significant penalty
      score -= 20;
    } else if (analysis.contentAgeDays <= 730) {
      // Content 1-2 years old: major penalty
      score -= 35;
    } else {
      // Content over 2 years old: severe penalty
      score -= 50;
    }
  } else {
    // No date information: significant penalty
    score -= 30;
  }

  // Outdated year references penalty
  if (analysis.outdatedYears.length > 0) {
    const currentYear = new Date().getFullYear();
    const oldestYear = Math.min(...analysis.outdatedYears.map(y => parseInt(y)));
    const yearsDiff = currentYear - oldestYear;

    if (yearsDiff >= 5) {
      score -= 20; // Very old references
    } else if (yearsDiff >= 3) {
      score -= 15; // Moderately old references
    } else {
      score -= 10; // Somewhat old references
    }
  }

  // Update indicators bonus
  if (analysis.updateIndicators.hasUpdateNotice) {
    score += 10; // Shows content is being maintained
  }

  if (analysis.updateIndicators.hasVersionInfo) {
    score += 5; // Shows versioning awareness
  }

  // Date metadata bonus
  if (analysis.lastModifiedDate) {
    score += 5;
  }

  if (analysis.lastReviewedDate) {
    score += 5;
  }

  // Temporal references check
  if (analysis.temporalReferences.relative > 10) {
    // Too many relative time references can become outdated
    score -= 10;
  }

  // Apply penalties from negative signals
  const criticalNegativeSignals = analysis.freshnessSignals.negative.filter(
    signal => signal.includes('latest/current') || signal.includes('more than 2 years')
  );
  score -= criticalNegativeSignals.length * 10;

  // No publication date and old content is worst case
  if (!analysis.publishedDate && !analysis.lastModifiedDate) {
    if (analysis.contentAgeDays === null || analysis.contentAgeDays > 730) {
      score -= 15; // Additional penalty for lack of transparency
    }
  }

  // Bonus for very fresh content with good signals
  if (analysis.contentAgeDays !== null && analysis.contentAgeDays <= 30) {
    if (analysis.publishedDate || analysis.lastModifiedDate) {
      score += 5; // Recently updated and properly dated
    }
  }

  return Math.max(0, Math.min(100, score));
}

export default analyzeContentFreshness;
