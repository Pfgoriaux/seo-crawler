import { Page } from 'playwright';
import { NetworkData } from '../crawler/page-crawler';

export interface ThirdPartyVendor {
  domain: string;
  category: string;
  requests: number;
  totalSize: number;
  isBlocking: boolean;
  resources: string[];
}

export interface ThirdPartyAnalysis {
  vendors: ThirdPartyVendor[];
  totalThirdPartyRequests: number;
  totalThirdPartySize: number;
  thirdPartyPercentage: {
    requests: number;
    size: number;
  };
  categories: Record<string, { count: number; size: number }>;
  blockingScripts: string[];
  trackingScripts: string[];
  unknownVendors: string[];
  recommendations: string[];
  criticalVendors: string[];
}

interface VendorPattern {
  pattern: RegExp;
  category: string;
  name: string;
  isTracking?: boolean;
}

// Comprehensive vendor detection patterns
const KNOWN_VENDORS: VendorPattern[] = [
  // Analytics
  { pattern: /google-analytics\.com|googletagmanager\.com|analytics\.google\.com/i, category: 'analytics', name: 'Google Analytics', isTracking: true },
  { pattern: /mixpanel\.com/i, category: 'analytics', name: 'Mixpanel', isTracking: true },
  { pattern: /segment\.(com|io)/i, category: 'analytics', name: 'Segment', isTracking: true },
  { pattern: /hotjar\.com/i, category: 'analytics', name: 'Hotjar', isTracking: true },
  { pattern: /fullstory\.com/i, category: 'analytics', name: 'FullStory', isTracking: true },
  { pattern: /amplitude\.com/i, category: 'analytics', name: 'Amplitude', isTracking: true },
  { pattern: /heap(analytics)?\.com/i, category: 'analytics', name: 'Heap', isTracking: true },
  { pattern: /pendo\.io/i, category: 'analytics', name: 'Pendo', isTracking: true },
  { pattern: /quantcast\.com/i, category: 'analytics', name: 'Quantcast', isTracking: true },
  { pattern: /chartbeat\.com/i, category: 'analytics', name: 'Chartbeat', isTracking: true },
  { pattern: /mouseflow\.com/i, category: 'analytics', name: 'Mouseflow', isTracking: true },
  { pattern: /crazyegg\.com/i, category: 'analytics', name: 'Crazy Egg', isTracking: true },
  { pattern: /newrelic\.com|nr-data\.net/i, category: 'analytics', name: 'New Relic' },
  { pattern: /datadoghq\.com/i, category: 'analytics', name: 'Datadog' },

  // Advertising
  { pattern: /doubleclick\.net|googlesyndication\.com|adservice\.google\.com/i, category: 'ads', name: 'Google Ads', isTracking: true },
  { pattern: /facebook\.net|connect\.facebook\.net/i, category: 'ads', name: 'Facebook Pixel', isTracking: true },
  { pattern: /ads-twitter\.com|analytics\.twitter\.com/i, category: 'ads', name: 'Twitter Ads', isTracking: true },
  { pattern: /linkedin\.com\/px\//i, category: 'ads', name: 'LinkedIn Insight', isTracking: true },
  { pattern: /adsrvr\.org/i, category: 'ads', name: 'The Trade Desk', isTracking: true },
  { pattern: /pubmatic\.com/i, category: 'ads', name: 'PubMatic', isTracking: true },
  { pattern: /criteo\.(com|net)/i, category: 'ads', name: 'Criteo', isTracking: true },
  { pattern: /outbrain\.com/i, category: 'ads', name: 'Outbrain', isTracking: true },
  { pattern: /taboola\.com/i, category: 'ads', name: 'Taboola', isTracking: true },
  { pattern: /amazon-adsystem\.com/i, category: 'ads', name: 'Amazon Advertising', isTracking: true },
  { pattern: /rubiconproject\.com/i, category: 'ads', name: 'Rubicon Project', isTracking: true },
  { pattern: /mediavoice\.com/i, category: 'ads', name: 'MediaVoice', isTracking: true },

  // Social
  { pattern: /facebook\.com\/plugins/i, category: 'social', name: 'Facebook SDK' },
  { pattern: /platform\.twitter\.com/i, category: 'social', name: 'Twitter Widgets' },
  { pattern: /platform\.linkedin\.com/i, category: 'social', name: 'LinkedIn Widgets' },
  { pattern: /instagram\.com\/embed/i, category: 'social', name: 'Instagram Embed' },
  { pattern: /pinterest\.com\/js/i, category: 'social', name: 'Pinterest Widgets' },
  { pattern: /addtoany\.com/i, category: 'social', name: 'AddToAny' },
  { pattern: /sharethis\.com/i, category: 'social', name: 'ShareThis' },
  { pattern: /reddit\.com\/static/i, category: 'social', name: 'Reddit Widgets' },
  { pattern: /snapchat\.com\/web-sdk/i, category: 'social', name: 'Snapchat SDK' },
  { pattern: /tiktok\.com\/embed/i, category: 'social', name: 'TikTok Embed' },

  // Fonts
  { pattern: /fonts\.googleapis\.com|fonts\.gstatic\.com/i, category: 'fonts', name: 'Google Fonts' },
  { pattern: /use\.typekit\.net|typekit\.com/i, category: 'fonts', name: 'Adobe Fonts' },
  { pattern: /cloud\.typography\.com/i, category: 'fonts', name: 'Cloud.typography' },
  { pattern: /fonts\.com/i, category: 'fonts', name: 'Fonts.com' },
  { pattern: /fast\.fonts\.net/i, category: 'fonts', name: 'Fonts.net' },
  { pattern: /fontawesome\.com/i, category: 'fonts', name: 'Font Awesome' },

  // CDN
  { pattern: /cloudflare\.com|cdnjs\.cloudflare\.com/i, category: 'cdn', name: 'Cloudflare' },
  { pattern: /fastly\.net/i, category: 'cdn', name: 'Fastly' },
  { pattern: /jsdelivr\.net/i, category: 'cdn', name: 'jsDelivr' },
  { pattern: /unpkg\.com/i, category: 'cdn', name: 'unpkg' },
  { pattern: /cdnjs\.com/i, category: 'cdn', name: 'cdnjs' },
  { pattern: /maxcdn\.bootstrapcdn\.com/i, category: 'cdn', name: 'Bootstrap CDN' },
  { pattern: /ajax\.googleapis\.com/i, category: 'cdn', name: 'Google CDN' },
  { pattern: /cdn\.jsdelivr\.net/i, category: 'cdn', name: 'jsDelivr CDN' },
  { pattern: /stackpath\.bootstrapcdn\.com/i, category: 'cdn', name: 'StackPath' },
  { pattern: /akamaihd\.net|akamaized\.net/i, category: 'cdn', name: 'Akamai' },
  { pattern: /cloudfront\.net/i, category: 'cdn', name: 'Amazon CloudFront' },

  // Video
  { pattern: /youtube\.com|ytimg\.com/i, category: 'video', name: 'YouTube' },
  { pattern: /vimeo\.com|vimeocdn\.com/i, category: 'video', name: 'Vimeo' },
  { pattern: /wistia\.(com|net)/i, category: 'video', name: 'Wistia' },
  { pattern: /brightcove\.(com|net)/i, category: 'video', name: 'Brightcove' },
  { pattern: /jwplatform\.com|jwpcdn\.com/i, category: 'video', name: 'JW Player' },
  { pattern: /videojs\.com/i, category: 'video', name: 'Video.js' },
  { pattern: /dailymotion\.com/i, category: 'video', name: 'Dailymotion' },

  // Chat/Support
  { pattern: /intercom\.io|intercomcdn\.com/i, category: 'chat', name: 'Intercom' },
  { pattern: /drift\.com/i, category: 'chat', name: 'Drift' },
  { pattern: /zendesk\.com|zdassets\.com/i, category: 'chat', name: 'Zendesk' },
  { pattern: /olark\.com/i, category: 'chat', name: 'Olark' },
  { pattern: /livechatinc\.com/i, category: 'chat', name: 'LiveChat' },
  { pattern: /tawk\.to/i, category: 'chat', name: 'Tawk.to' },
  { pattern: /crisp\.chat/i, category: 'chat', name: 'Crisp' },
  { pattern: /helpscout\.net/i, category: 'chat', name: 'Help Scout' },
  { pattern: /freshchat\.com|freshworks\.com/i, category: 'chat', name: 'Freshchat' },

  // Tag Managers
  { pattern: /googletagmanager\.com/i, category: 'tag-manager', name: 'Google Tag Manager' },
  { pattern: /tealiumiq\.com/i, category: 'tag-manager', name: 'Tealium' },
  { pattern: /ensighten\.com/i, category: 'tag-manager', name: 'Ensighten' },
  { pattern: /tagcommander\.com/i, category: 'tag-manager', name: 'Tag Commander' },

  // A/B Testing
  { pattern: /optimizely\.com/i, category: 'ab-testing', name: 'Optimizely' },
  { pattern: /vwo\.com/i, category: 'ab-testing', name: 'VWO' },
  { pattern: /abtasty\.com/i, category: 'ab-testing', name: 'AB Tasty' },
  { pattern: /google-optimize\.com/i, category: 'ab-testing', name: 'Google Optimize' },
  { pattern: /kameleoon\.com/i, category: 'ab-testing', name: 'Kameleoon' },
  { pattern: /convert\.com/i, category: 'ab-testing', name: 'Convert' },

  // Payment
  { pattern: /stripe\.com|stripe\.network/i, category: 'payment', name: 'Stripe' },
  { pattern: /paypal\.com|paypalobjects\.com/i, category: 'payment', name: 'PayPal' },
  { pattern: /braintreegateway\.com/i, category: 'payment', name: 'Braintree' },
  { pattern: /square(up)?\.com/i, category: 'payment', name: 'Square' },
  { pattern: /klarna\.com/i, category: 'payment', name: 'Klarna' },
  { pattern: /adyen\.com/i, category: 'payment', name: 'Adyen' },

  // Error Tracking
  { pattern: /sentry\.io/i, category: 'error-tracking', name: 'Sentry' },
  { pattern: /bugsnag\.com/i, category: 'error-tracking', name: 'Bugsnag' },
  { pattern: /rollbar\.com/i, category: 'error-tracking', name: 'Rollbar' },
  { pattern: /airbrake\.io/i, category: 'error-tracking', name: 'Airbrake' },
  { pattern: /trackjs\.com/i, category: 'error-tracking', name: 'TrackJS' },

  // Maps
  { pattern: /maps\.googleapis\.com|maps\.gstatic\.com/i, category: 'maps', name: 'Google Maps' },
  { pattern: /mapbox\.com/i, category: 'maps', name: 'Mapbox' },
  { pattern: /openstreetmap\.org/i, category: 'maps', name: 'OpenStreetMap' },

  // CMS/Widgets
  { pattern: /wordpress\.com/i, category: 'cms', name: 'WordPress.com' },
  { pattern: /shopify\.com|shopifycdn\.com/i, category: 'cms', name: 'Shopify' },
  { pattern: /wix\.com|wixstatic\.com/i, category: 'cms', name: 'Wix' },
  { pattern: /squarespace\.com/i, category: 'cms', name: 'Squarespace' },
  { pattern: /disqus\.com/i, category: 'widgets', name: 'Disqus' },
  { pattern: /recaptcha\.net|gstatic\.com\/recaptcha/i, category: 'widgets', name: 'reCAPTCHA' },
  { pattern: /hcaptcha\.com/i, category: 'widgets', name: 'hCaptcha' },
  { pattern: /calendly\.com/i, category: 'widgets', name: 'Calendly' },
  { pattern: /mailchimp\.com/i, category: 'widgets', name: 'Mailchimp' },
  { pattern: /hubspot\.com|hs-scripts\.com|hs-analytics\.net/i, category: 'widgets', name: 'HubSpot' },
];

// Self-hostable resources that could improve performance
const SELF_HOSTABLE_PATTERNS = [
  /fonts\.googleapis\.com|fonts\.gstatic\.com/i,
  /ajax\.googleapis\.com/i,
  /code\.jquery\.com/i,
  /maxcdn\.bootstrapcdn\.com/i,
  /cdnjs\.cloudflare\.com/i,
  /jsdelivr\.net/i,
  /unpkg\.com/i,
  /fontawesome\.com/i,
];

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return '';
  }
}

/**
 * Get main domain from page URL
 */
function getMainDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    const parts = urlObj.hostname.split('.');
    // Get the last two parts (e.g., example.com)
    if (parts.length >= 2) {
      return parts.slice(-2).join('.');
    }
    return urlObj.hostname;
  } catch {
    return '';
  }
}

/**
 * Check if domain is third-party
 */
function isThirdParty(resourceDomain: string, mainDomain: string): boolean {
  if (!resourceDomain || !mainDomain) return false;

  // Extract base domain for comparison (e.g., example.com from www.example.com)
  const getBaseDomain = (domain: string) => {
    const parts = domain.split('.');
    return parts.length >= 2 ? parts.slice(-2).join('.') : domain;
  };

  return getBaseDomain(resourceDomain) !== getBaseDomain(mainDomain);
}

/**
 * Categorize vendor by URL patterns
 */
function categorizeVendor(url: string): { category: string; name: string; isTracking: boolean } {
  for (const vendor of KNOWN_VENDORS) {
    if (vendor.pattern.test(url)) {
      return {
        category: vendor.category,
        name: vendor.name,
        isTracking: vendor.isTracking || false,
      };
    }
  }
  return { category: 'other', name: 'Unknown', isTracking: false };
}

/**
 * Check if resource is self-hostable
 */
function isSelfHostable(url: string): boolean {
  return SELF_HOSTABLE_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * Check if script is blocking
 */
async function isBlockingScript(page: Page, url: string): Promise<boolean> {
  try {
    // Check if script has async or defer attributes
    const isNonBlocking = await page.evaluate((scriptUrl) => {
      const scripts = Array.from(document.querySelectorAll('script'));
      const script = scripts.find(s => s.src && scriptUrl.includes(s.src));
      if (script) {
        return script.hasAttribute('async') || script.hasAttribute('defer');
      }
      return false;
    }, url);

    return !isNonBlocking;
  } catch {
    // If we can't determine, assume it might be blocking
    return true;
  }
}

/**
 * Analyze third-party script impact
 */
export async function analyzeThirdParty(
  page: Page,
  networkData: NetworkData
): Promise<ThirdPartyAnalysis> {
  const pageUrl = page.url();
  const mainDomain = getMainDomain(pageUrl);

  const vendorMap = new Map<string, {
    domain: string;
    category: string;
    name: string;
    requests: number;
    totalSize: number;
    isBlocking: boolean;
    resources: string[];
    isTracking: boolean;
  }>();

  let totalThirdPartyRequests = 0;
  let totalThirdPartySize = 0;
  const trackingScripts: string[] = [];
  const unknownVendors = new Set<string>();
  const blockingScripts: string[] = [];

  // Analyze each resource
  for (const resource of networkData.resources) {
    const domain = extractDomain(resource.url);

    if (!isThirdParty(domain, mainDomain)) {
      continue;
    }

    totalThirdPartyRequests++;
    totalThirdPartySize += resource.size;

    const { category, name, isTracking } = categorizeVendor(resource.url);

    if (category === 'other') {
      unknownVendors.add(domain);
    }

    if (isTracking) {
      trackingScripts.push(resource.url);
    }

    // Check if script is blocking (only for script resources)
    let isBlocking = false;
    if (resource.type === 'script') {
      isBlocking = await isBlockingScript(page, resource.url);
      if (isBlocking) {
        blockingScripts.push(resource.url);
      }
    }

    if (!vendorMap.has(domain)) {
      vendorMap.set(domain, {
        domain,
        category,
        name,
        requests: 0,
        totalSize: 0,
        isBlocking: false,
        resources: [],
        isTracking,
      });
    }

    const vendor = vendorMap.get(domain)!;
    vendor.requests++;
    vendor.totalSize += resource.size;
    vendor.resources.push(resource.url);
    vendor.isBlocking = vendor.isBlocking || isBlocking;
  }

  // Convert map to array and sort by size
  const vendors: ThirdPartyVendor[] = Array.from(vendorMap.values())
    .map(v => ({
      domain: v.domain,
      category: v.category,
      requests: v.requests,
      totalSize: v.totalSize,
      isBlocking: v.isBlocking,
      resources: v.resources,
    }))
    .sort((a, b) => b.totalSize - a.totalSize);

  // Calculate percentages
  const totalRequests = networkData.resources.length;
  const totalSize = networkData.resources.reduce((sum, r) => sum + r.size, 0);

  const thirdPartyPercentage = {
    requests: totalRequests > 0 ? (totalThirdPartyRequests / totalRequests) * 100 : 0,
    size: totalSize > 0 ? (totalThirdPartySize / totalSize) * 100 : 0,
  };

  // Group by category
  const categories: Record<string, { count: number; size: number }> = {};
  for (const vendor of vendorMap.values()) {
    if (!categories[vendor.category]) {
      categories[vendor.category] = { count: 0, size: 0 };
    }
    categories[vendor.category].count += vendor.requests;
    categories[vendor.category].size += vendor.totalSize;
  }

  // Identify critical vendors (top 5 by size)
  const criticalVendors = vendors
    .slice(0, 5)
    .filter(v => v.totalSize > 50000) // Only if > 50KB
    .map(v => v.domain);

  // Generate recommendations
  const recommendations = generateRecommendations(
    vendors,
    blockingScripts,
    unknownVendors.size,
    totalThirdPartySize,
    trackingScripts.length,
    networkData.resources
  );

  return {
    vendors,
    totalThirdPartyRequests,
    totalThirdPartySize,
    thirdPartyPercentage,
    categories,
    blockingScripts,
    trackingScripts,
    unknownVendors: Array.from(unknownVendors),
    recommendations,
    criticalVendors,
  };
}

/**
 * Generate actionable recommendations
 */
function generateRecommendations(
  vendors: ThirdPartyVendor[],
  blockingScripts: string[],
  unknownVendorCount: number,
  totalThirdPartySize: number,
  trackingScriptCount: number,
  allResources: { url: string; type: string; size: number }[]
): string[] {
  const recommendations: string[] = [];

  // Self-hostable resources
  const selfHostable = allResources.filter(r => isSelfHostable(r.url));
  if (selfHostable.length > 0) {
    const types = new Set(selfHostable.map(r => {
      if (r.url.includes('fonts')) return 'fonts';
      if (r.url.includes('jquery')) return 'jQuery';
      if (r.url.includes('bootstrap')) return 'Bootstrap';
      return 'libraries';
    }));
    recommendations.push(`Consider self-hosting ${Array.from(types).join(', ')} to improve performance and reduce external dependencies (${selfHostable.length} resources)`);
  }

  // Blocking scripts
  if (blockingScripts.length > 0) {
    recommendations.push(`Add async or defer attributes to ${blockingScripts.length} blocking third-party script(s) to prevent render blocking`);
  }

  // Large third-party size
  if (totalThirdPartySize > 500000) {
    const sizeMB = (totalThirdPartySize / 1024 / 1024).toFixed(2);
    recommendations.push(`Third-party resources account for ${sizeMB}MB. Consider removing unnecessary vendors or lazy-loading non-critical scripts`);
  }

  // Too many tracking scripts
  if (trackingScriptCount > 5) {
    recommendations.push(`${trackingScriptCount} tracking scripts detected. Review if all are necessary and consider consolidating analytics tools`);
  }

  // Unknown vendors
  if (unknownVendorCount > 3) {
    recommendations.push(`${unknownVendorCount} unknown third-party domains detected. Audit these for security and necessity`);
  }

  // High number of third-party requests
  const thirdPartyRequestCount = vendors.reduce((sum, v) => sum + v.requests, 0);
  if (thirdPartyRequestCount > 30) {
    recommendations.push(`High number of third-party requests (${thirdPartyRequestCount}). Consider combining or removing unnecessary integrations`);
  }

  // Specific vendor recommendations
  const hasMultipleAnalytics = vendors.filter(v => v.category === 'analytics').length > 2;
  if (hasMultipleAnalytics) {
    recommendations.push('Multiple analytics tools detected. Consider consolidating to reduce overhead');
  }

  // Heavy vendors
  const heavyVendors = vendors.filter(v => v.totalSize > 200000);
  if (heavyVendors.length > 0) {
    recommendations.push(`Large third-party resources found: ${heavyVendors.map(v => `${v.domain} (${(v.totalSize / 1024).toFixed(0)}KB)`).join(', ')}. Review if optimization is possible`);
  }

  // Video embeds
  const videoVendors = vendors.filter(v => v.category === 'video');
  if (videoVendors.length > 0) {
    recommendations.push('Consider lazy-loading video embeds (YouTube, Vimeo) with a placeholder until user interaction');
  }

  // Chat widgets
  const chatVendors = vendors.filter(v => v.category === 'chat');
  if (chatVendors.length > 0) {
    recommendations.push('Defer loading chat widgets until after initial page load to improve Time to Interactive');
  }

  return recommendations;
}

/**
 * Calculate third-party score (0-100)
 */
export function calculateThirdPartyScore(analysis: ThirdPartyAnalysis): number {
  let score = 100;

  // Number of third-party vendors
  const vendorCount = analysis.vendors.length;
  if (vendorCount > 20) {
    score -= 30;
  } else if (vendorCount > 15) {
    score -= 20;
  } else if (vendorCount > 10) {
    score -= 10;
  } else {
    // Bonus for few vendors
    score += Math.min(10, (10 - vendorCount) * 2);
  }

  // Total third-party size
  const sizeMB = analysis.totalThirdPartySize / (1024 * 1024);
  if (sizeMB > 2) {
    score -= 25;
  } else if (sizeMB > 1) {
    score -= 15;
  } else if (sizeMB > 0.5) {
    score -= 5;
  } else {
    // Bonus for small size
    score += 10;
  }

  // Blocking scripts
  if (analysis.blockingScripts.length > 5) {
    score -= 20;
  } else if (analysis.blockingScripts.length > 2) {
    score -= 10;
  } else if (analysis.blockingScripts.length === 0) {
    // Bonus for no blocking scripts
    score += 10;
  }

  // Tracking scripts
  if (analysis.trackingScripts.length > 10) {
    score -= 15;
  } else if (analysis.trackingScripts.length > 5) {
    score -= 8;
  } else if (analysis.trackingScripts.length <= 2) {
    // Bonus for low tracking
    score += 5;
  }

  // Unknown vendors
  if (analysis.unknownVendors.length > 5) {
    score -= 10;
  } else if (analysis.unknownVendors.length === 0) {
    // Bonus for all known vendors
    score += 5;
  }

  // Third-party percentage impact
  if (analysis.thirdPartyPercentage.size > 70) {
    score -= 15;
  } else if (analysis.thirdPartyPercentage.size > 50) {
    score -= 10;
  }

  // Critical vendors (heavy ones)
  if (analysis.criticalVendors.length > 3) {
    score -= 10;
  }

  // Ensure score stays within 0-100 range
  return Math.max(0, Math.min(100, Math.round(score)));
}

export default analyzeThirdParty;
