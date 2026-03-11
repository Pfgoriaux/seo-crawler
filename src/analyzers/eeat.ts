import { Page } from 'playwright';

/**
 * E-E-A-T Signals interface
 * Represents Experience, Expertise, Authoritativeness, and Trustworthiness signals
 */
export interface EEATSignals {
  // Author Information
  authorName: string | null;
  authorBio: boolean;
  authorSchemaMarkup: boolean;
  authorCredentials: boolean;
  authorSocialProfiles: string[];

  // Content Dating
  publishedDate: string | null;
  lastUpdatedDate: string | null;
  reviewDate: string | null;
  dateSchemaMarkup: boolean;

  // Expertise Signals
  citationsCount: number;
  sourcesLinked: string[];
  eduGovLinksCount: number;
  authorityLinksCount: number;
  expertQuotesCount: number;

  // Trust Signals
  aboutPageExists: boolean;
  contactPageExists: boolean;
  physicalAddress: boolean;
  phoneNumber: boolean;
  privacyPolicyLink: boolean;
  termsOfServiceLink: boolean;
  trustBadges: string[];

  // Editorial Signals
  editorialReview: boolean;
  factCheckIndicators: boolean;
  editorialGuidelinesLink: boolean;
}

/**
 * Analyze E-E-A-T signals on a page
 */
export async function analyzeEEAT(page: Page): Promise<EEATSignals> {
  const eeatData = await page.evaluate(() => {
    // Helper function to check if text contains credentials keywords
    const hasCredentials = (text: string): boolean => {
      const credentialKeywords = [
        'phd', 'md', 'professor', 'dr.', 'certified', 'licensed',
        'expert', 'specialist', 'degree', 'masters', 'bachelor',
        'credentials', 'qualification', 'board-certified'
      ];
      const lowerText = text.toLowerCase();
      return credentialKeywords.some(keyword => lowerText.includes(keyword));
    };

    // Helper to check for phone numbers
    const hasPhoneNumber = (): boolean => {
      const phonePattern = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
      return phonePattern.test(document.body.textContent || '');
    };

    // Helper to check for physical addresses
    const hasAddress = (): boolean => {
      const addressKeywords = ['address:', 'location:', 'office:'];
      const text = document.body.textContent?.toLowerCase() || '';
      const hasAddressLabel = addressKeywords.some(keyword => text.includes(keyword));

      // Also check for common address patterns (street, city, zip)
      const addressPattern = /\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr)/i;
      const hasAddressPattern = addressPattern.test(document.body.textContent || '');

      return hasAddressLabel || hasAddressPattern;
    };

    // 1. Author Information
    const authorName =
      document.querySelector('[rel="author"]')?.textContent?.trim() ||
      document.querySelector('.author-name')?.textContent?.trim() ||
      document.querySelector('.author')?.textContent?.trim() ||
      document.querySelector('[itemprop="author"]')?.textContent?.trim() ||
      null;

    const authorBio = !!(
      document.querySelector('.author-bio') ||
      document.querySelector('.author-about') ||
      document.querySelector('[itemprop="author"] [itemprop="description"]')
    );

    // Check for Person schema in JSON-LD
    let authorSchemaMarkup = false;
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    jsonLdScripts.forEach((script) => {
      try {
        const data = JSON.parse(script.textContent || '');
        const checkForPerson = (obj: any): boolean => {
          if (!obj) return false;
          if (obj['@type'] === 'Person' || obj['@type'] === 'Author') return true;
          if (obj.author && (obj.author['@type'] === 'Person' || obj.author['@type'] === 'Author')) return true;
          return false;
        };
        if (Array.isArray(data)) {
          authorSchemaMarkup = data.some(checkForPerson);
        } else {
          authorSchemaMarkup = checkForPerson(data);
        }
      } catch {}
    });

    const authorText = document.body.textContent || '';
    const authorCredentials = hasCredentials(authorText);

    // Social profiles
    const socialProfiles: string[] = [];
    const socialSelectors = [
      'a[href*="twitter.com"]',
      'a[href*="linkedin.com"]',
      'a[href*="facebook.com"]',
      'a[href*="instagram.com"]',
      'a[href*="github.com"]'
    ];
    socialSelectors.forEach(selector => {
      const links = document.querySelectorAll(selector);
      links.forEach(link => {
        const href = link.getAttribute('href');
        if (href && !socialProfiles.includes(href)) {
          socialProfiles.push(href);
        }
      });
    });

    // 2. Content Dating
    const publishedDate =
      document.querySelector('[itemprop="datePublished"]')?.getAttribute('content') ||
      document.querySelector('meta[property="article:published_time"]')?.getAttribute('content') ||
      document.querySelector('.published-date')?.textContent?.trim() ||
      document.querySelector('.publish-date')?.textContent?.trim() ||
      null;

    const lastUpdatedDate =
      document.querySelector('[itemprop="dateModified"]')?.getAttribute('content') ||
      document.querySelector('meta[property="article:modified_time"]')?.getAttribute('content') ||
      document.querySelector('.updated-date')?.textContent?.trim() ||
      document.querySelector('.last-updated')?.textContent?.trim() ||
      null;

    const reviewDate =
      document.querySelector('[itemprop="reviewDate"]')?.getAttribute('content') ||
      document.querySelector('.review-date')?.textContent?.trim() ||
      null;

    // Check for date schema markup
    let dateSchemaMarkup = false;
    jsonLdScripts.forEach((script) => {
      try {
        const data = JSON.parse(script.textContent || '');
        const checkForDate = (obj: any): boolean => {
          if (!obj) return false;
          return !!(obj.datePublished || obj.dateModified || obj.dateCreated);
        };
        if (Array.isArray(data)) {
          dateSchemaMarkup = data.some(checkForDate);
        } else {
          dateSchemaMarkup = checkForDate(data);
        }
      } catch {}
    });

    // 3. Expertise Signals
    const allLinks = document.querySelectorAll('a[href]');
    const externalLinks: string[] = [];
    const sourcesLinked: string[] = [];
    let eduGovLinksCount = 0;
    let authorityLinksCount = 0;

    const currentHost = window.location.hostname;
    const authorityDomains = [
      'wikipedia.org', 'who.int', 'cdc.gov', 'nih.gov', 'nature.com',
      'sciencedirect.com', 'ncbi.nlm.nih.gov', 'ieee.org', 'acm.org',
      'springer.com', 'wiley.com', 'oxford.com', 'cambridge.org'
    ];

    allLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return;
      }

      try {
        const url = new URL(href, window.location.href);
        if (url.hostname !== currentHost) {
          externalLinks.push(url.href);

          // Check for .edu or .gov domains
          if (url.hostname.endsWith('.edu') || url.hostname.endsWith('.gov')) {
            eduGovLinksCount++;
          }

          // Check for authority domains
          if (authorityDomains.some(domain => url.hostname.includes(domain))) {
            authorityLinksCount++;
          }

          // Check if link is in a citation/reference/source context
          const parent = link.closest('[class*="citation"], [class*="reference"], [class*="source"], sup, [id*="ref"]');
          if (parent && !sourcesLinked.includes(url.href)) {
            sourcesLinked.push(url.href);
          }
        }
      } catch {}
    });

    const citationsCount = sourcesLinked.length;

    // Count expert quotes (blockquotes with attribution or quotes with cite)
    const blockquotes = document.querySelectorAll('blockquote');
    let expertQuotesCount = 0;
    blockquotes.forEach(quote => {
      const hasAttribution = !!(
        quote.querySelector('cite') ||
        quote.querySelector('.attribution') ||
        quote.querySelector('.author')
      );
      if (hasAttribution) {
        expertQuotesCount++;
      }
    });

    // 4. Trust Signals
    const aboutPageExists = !!(
      document.querySelector('a[href*="/about"]') ||
      document.querySelector('a[href*="/about-us"]')
    );

    const contactPageExists = !!(
      document.querySelector('a[href*="/contact"]') ||
      document.querySelector('a[href*="/contact-us"]')
    );

    const physicalAddress = hasAddress();
    const phoneNumber = hasPhoneNumber();

    const privacyPolicyLink = !!(
      document.querySelector('a[href*="/privacy"]') ||
      document.querySelector('a[href*="privacy-policy"]')
    );

    const termsOfServiceLink = !!(
      document.querySelector('a[href*="/terms"]') ||
      document.querySelector('a[href*="terms-of-service"]') ||
      document.querySelector('a[href*="terms-and-conditions"]')
    );

    // Trust badges and certifications
    const trustBadges: string[] = [];
    const badgeKeywords = ['verified', 'certified', 'secure', 'ssl', 'badge', 'seal', 'accredited'];
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      const alt = (img.alt || '').toLowerCase();
      const src = (img.src || '').toLowerCase();
      const className = (img.className || '').toLowerCase();

      if (badgeKeywords.some(keyword =>
        alt.includes(keyword) || src.includes(keyword) || className.includes(keyword)
      )) {
        const badge = img.alt || img.src;
        if (badge && !trustBadges.includes(badge)) {
          trustBadges.push(badge);
        }
      }
    });

    // 5. Editorial Signals
    const bodyText = document.body.textContent?.toLowerCase() || '';
    const editorialKeywords = [
      'editorial review', 'medically reviewed', 'fact-checked',
      'reviewed by', 'editorial team', 'editorial board'
    ];
    const editorialReview = editorialKeywords.some(keyword => bodyText.includes(keyword));

    const factCheckKeywords = [
      'fact-check', 'fact check', 'verified', 'fact-checked',
      'sources verified', 'accuracy reviewed'
    ];
    const factCheckIndicators = factCheckKeywords.some(keyword => bodyText.includes(keyword));

    const editorialGuidelinesLink = !!(
      document.querySelector('a[href*="editorial-guidelines"]') ||
      document.querySelector('a[href*="editorial-policy"]') ||
      document.querySelector('a[href*="editorial-standards"]')
    );

    return {
      // Author Information
      authorName,
      authorBio,
      authorSchemaMarkup,
      authorCredentials,
      authorSocialProfiles: socialProfiles,

      // Content Dating
      publishedDate,
      lastUpdatedDate,
      reviewDate,
      dateSchemaMarkup,

      // Expertise Signals
      citationsCount,
      sourcesLinked,
      eduGovLinksCount,
      authorityLinksCount,
      expertQuotesCount,

      // Trust Signals
      aboutPageExists,
      contactPageExists,
      physicalAddress,
      phoneNumber,
      privacyPolicyLink,
      termsOfServiceLink,
      trustBadges,

      // Editorial Signals
      editorialReview,
      factCheckIndicators,
      editorialGuidelinesLink,
    };
  });

  return eeatData;
}

/**
 * Calculate E-E-A-T score (0-100)
 *
 * Scoring breakdown:
 * - Author info: 25 points
 * - Dating signals: 20 points
 * - Expertise signals: 25 points
 * - Trust signals: 20 points
 * - Editorial signals: 10 points
 */
export function calculateEEATScore(eeat: EEATSignals): number {
  let score = 0;

  // Author Information (25 points)
  if (eeat.authorName) score += 8;
  if (eeat.authorBio) score += 5;
  if (eeat.authorSchemaMarkup) score += 4;
  if (eeat.authorCredentials) score += 5;
  if (eeat.authorSocialProfiles.length > 0) {
    score += Math.min(3, eeat.authorSocialProfiles.length); // Up to 3 points
  }

  // Content Dating (20 points)
  if (eeat.publishedDate) score += 7;
  if (eeat.lastUpdatedDate) score += 7;
  if (eeat.reviewDate) score += 3;
  if (eeat.dateSchemaMarkup) score += 3;

  // Expertise Signals (25 points)
  if (eeat.citationsCount > 0) {
    score += Math.min(8, eeat.citationsCount * 2); // Up to 8 points
  }
  if (eeat.eduGovLinksCount > 0) {
    score += Math.min(5, eeat.eduGovLinksCount * 2); // Up to 5 points
  }
  if (eeat.authorityLinksCount > 0) {
    score += Math.min(5, eeat.authorityLinksCount * 2); // Up to 5 points
  }
  if (eeat.expertQuotesCount > 0) {
    score += Math.min(7, eeat.expertQuotesCount * 2); // Up to 7 points
  }

  // Trust Signals (20 points)
  if (eeat.aboutPageExists) score += 3;
  if (eeat.contactPageExists) score += 3;
  if (eeat.physicalAddress) score += 3;
  if (eeat.phoneNumber) score += 3;
  if (eeat.privacyPolicyLink) score += 3;
  if (eeat.termsOfServiceLink) score += 2;
  if (eeat.trustBadges.length > 0) {
    score += Math.min(3, eeat.trustBadges.length); // Up to 3 points
  }

  // Editorial Signals (10 points)
  if (eeat.editorialReview) score += 4;
  if (eeat.factCheckIndicators) score += 4;
  if (eeat.editorialGuidelinesLink) score += 2;

  return Math.min(100, Math.round(score));
}

export default analyzeEEAT;
