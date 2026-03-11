import { XMLParser } from 'fast-xml-parser';

export interface SitemapValidation {
  url: string;
  isValid: boolean;
  urlCount: number;
  issues: SitemapIssue[];
  lastmodPresent: number;
  priorityPresent: number;
  changefreqPresent: number;
  urlsWithoutLastmod: string[];
  duplicateUrls: string[];
  invalidUrls: string[];
  avgPriority: number | null;
  hasImages: boolean;
  hasVideos: boolean;
  hasNews: boolean;
  compressionUsed: boolean;
  sizeBytes: number;
  isIndex: boolean;
  childSitemaps: string[];
  httpsMixedContent: boolean;
  robotsTxtAllowed: boolean | null;
}

export interface SitemapIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  affectedUrl?: string;
}

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
  'image:image'?: any;
  'video:video'?: any;
  'news:news'?: any;
}

interface ParsedSitemap {
  urlset?: {
    url?: SitemapUrl | SitemapUrl[];
  };
  sitemapindex?: {
    sitemap?: { loc: string }[] | { loc: string };
  };
}

const SITEMAP_NAMESPACE_PATTERNS = [
  'http://www.sitemaps.org/schemas/sitemap/0.9',
  'http://www.google.com/schemas/sitemap-image/1.1',
  'http://www.google.com/schemas/sitemap-video/1.1',
  'http://www.google.com/schemas/sitemap-news/0.9'
];

const MAX_SITEMAP_URLS = 50000;
const MAX_SITEMAP_SIZE = 52428800; // 50MB
const VALID_CHANGEFREQ = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'];

/**
 * Validate a sitemap.xml file in depth
 */
export async function validateSitemap(sitemapUrl: string): Promise<SitemapValidation> {
  const issues: SitemapIssue[] = [];
  const urlsWithoutLastmod: string[] = [];
  const duplicateUrls: string[] = [];
  const invalidUrls: string[] = [];
  const childSitemaps: string[] = [];

  let urlCount = 0;
  let lastmodPresent = 0;
  let priorityPresent = 0;
  let changefreqPresent = 0;
  let priorities: number[] = [];
  let hasImages = false;
  let hasVideos = false;
  let hasNews = false;
  let compressionUsed = false;
  let sizeBytes = 0;
  let isIndex = false;
  let httpsMixedContent = false;
  let isValid = true;

  try {
    // Validate sitemap URL
    let parsedSitemapUrl: URL;
    try {
      parsedSitemapUrl = new URL(sitemapUrl);
      if (!parsedSitemapUrl.protocol.match(/^https?:$/)) {
        issues.push({
          type: 'error',
          message: 'Sitemap URL must use HTTP or HTTPS protocol'
        });
        isValid = false;
      }
    } catch (error) {
      issues.push({
        type: 'error',
        message: `Invalid sitemap URL: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      isValid = false;

      return {
        url: sitemapUrl,
        isValid,
        urlCount: 0,
        issues,
        lastmodPresent: 0,
        priorityPresent: 0,
        changefreqPresent: 0,
        urlsWithoutLastmod: [],
        duplicateUrls: [],
        invalidUrls: [],
        avgPriority: null,
        hasImages: false,
        hasVideos: false,
        hasNews: false,
        compressionUsed: false,
        sizeBytes: 0,
        isIndex: false,
        childSitemaps: [],
        httpsMixedContent: false,
        robotsTxtAllowed: null
      };
    }

    // Fetch sitemap with proper headers
    const response = await fetch(sitemapUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEO-Crawler/1.0; +http://example.com/bot)',
        'Accept': 'application/xml,text/xml,*/*',
        'Accept-Encoding': 'gzip, deflate'
      },
      redirect: 'follow'
    });

    if (!response.ok) {
      issues.push({
        type: 'error',
        message: `Failed to fetch sitemap: HTTP ${response.status} ${response.statusText}`
      });
      isValid = false;
    }

    // Check content type
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('xml') && !contentType.includes('text/plain')) {
      issues.push({
        type: 'warning',
        message: `Unexpected content-type: ${contentType}. Expected application/xml or text/xml`
      });
    }

    // Check compression
    const contentEncoding = response.headers.get('content-encoding') || '';
    compressionUsed = contentEncoding.includes('gzip') || contentEncoding.includes('deflate');

    if (!compressionUsed) {
      issues.push({
        type: 'info',
        message: 'Sitemap is not compressed. Consider using gzip compression to reduce bandwidth'
      });
    }

    // Get response body
    const responseText = await response.text();
    sizeBytes = new Blob([responseText]).size;

    // Check size
    if (sizeBytes > MAX_SITEMAP_SIZE) {
      issues.push({
        type: 'error',
        message: `Sitemap size (${formatBytes(sizeBytes)}) exceeds maximum allowed size of 50MB`
      });
      isValid = false;
    } else if (sizeBytes > MAX_SITEMAP_SIZE * 0.8) {
      issues.push({
        type: 'warning',
        message: `Sitemap size (${formatBytes(sizeBytes)}) is approaching the 50MB limit`
      });
    }

    // Validate XML structure
    if (!responseText.trim().startsWith('<?xml')) {
      issues.push({
        type: 'warning',
        message: 'Sitemap does not start with XML declaration'
      });
    }

    // Check for common XML errors
    if (!responseText.includes('<urlset') && !responseText.includes('<sitemapindex')) {
      issues.push({
        type: 'error',
        message: 'Sitemap does not contain <urlset> or <sitemapindex> root element'
      });
      isValid = false;
    }

    // Parse XML
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseAttributeValue: true,
      trimValues: true
    });

    let parsedData: ParsedSitemap;
    try {
      parsedData = parser.parse(responseText);
    } catch (error) {
      issues.push({
        type: 'error',
        message: `XML parsing error: ${error instanceof Error ? error.message : 'Invalid XML structure'}`
      });
      isValid = false;

      return {
        url: sitemapUrl,
        isValid,
        urlCount: 0,
        issues,
        lastmodPresent: 0,
        priorityPresent: 0,
        changefreqPresent: 0,
        urlsWithoutLastmod: [],
        duplicateUrls: [],
        invalidUrls: [],
        avgPriority: null,
        hasImages: false,
        hasVideos: false,
        hasNews: false,
        compressionUsed,
        sizeBytes,
        isIndex: false,
        childSitemaps: [],
        httpsMixedContent: false,
        robotsTxtAllowed: null
      };
    }

    // Check namespace declarations
    checkNamespaceDeclarations(responseText, issues);

    // Determine if this is a sitemap index or regular sitemap
    if (parsedData.sitemapindex) {
      isIndex = true;
      const sitemaps = Array.isArray(parsedData.sitemapindex.sitemap)
        ? parsedData.sitemapindex.sitemap
        : parsedData.sitemapindex.sitemap
        ? [parsedData.sitemapindex.sitemap]
        : [];

      childSitemaps.push(...sitemaps.map(s => s.loc));
      urlCount = sitemaps.length;

      if (urlCount === 0) {
        issues.push({
          type: 'error',
          message: 'Sitemap index contains no child sitemaps'
        });
        isValid = false;
      }

      // Validate child sitemap URLs
      for (const sitemap of sitemaps) {
        if (!isValidUrl(sitemap.loc)) {
          invalidUrls.push(sitemap.loc);
          issues.push({
            type: 'error',
            message: 'Invalid child sitemap URL',
            affectedUrl: sitemap.loc
          });
        }
      }

      issues.push({
        type: 'info',
        message: `Sitemap index contains ${urlCount} child sitemaps`
      });
    } else if (parsedData.urlset) {
      // Regular sitemap with URLs
      const urls = Array.isArray(parsedData.urlset.url)
        ? parsedData.urlset.url
        : parsedData.urlset.url
        ? [parsedData.urlset.url]
        : [];

      urlCount = urls.length;

      if (urlCount === 0) {
        issues.push({
          type: 'error',
          message: 'Sitemap contains no URLs'
        });
        isValid = false;
      }

      // Check URL count limit
      if (urlCount > MAX_SITEMAP_URLS) {
        issues.push({
          type: 'error',
          message: `Sitemap contains ${urlCount} URLs, exceeding the maximum of ${MAX_SITEMAP_URLS}`
        });
        isValid = false;
      } else if (urlCount > MAX_SITEMAP_URLS * 0.9) {
        issues.push({
          type: 'warning',
          message: `Sitemap contains ${urlCount} URLs, approaching the limit of ${MAX_SITEMAP_URLS}`
        });
      }

      // Track seen URLs for duplicate detection
      const seenUrls = new Map<string, number>();
      const sitemapProtocol = parsedSitemapUrl.protocol;

      // Validate each URL
      for (const urlEntry of urls) {
        const url = urlEntry.loc;

        // Check for duplicate URLs
        if (seenUrls.has(url)) {
          duplicateUrls.push(url);
          issues.push({
            type: 'error',
            message: 'Duplicate URL found in sitemap',
            affectedUrl: url
          });
        }
        seenUrls.set(url, (seenUrls.get(url) || 0) + 1);

        // Validate URL format
        if (!isValidUrl(url)) {
          invalidUrls.push(url);
          issues.push({
            type: 'error',
            message: 'Invalid URL format',
            affectedUrl: url
          });
          continue;
        }

        // Check HTTP/HTTPS consistency
        try {
          const urlObj = new URL(url);
          if (urlObj.protocol !== sitemapProtocol) {
            httpsMixedContent = true;
            issues.push({
              type: 'warning',
              message: `Protocol mismatch: sitemap uses ${sitemapProtocol} but URL uses ${urlObj.protocol}`,
              affectedUrl: url
            });
          }
        } catch {
          // Already caught by isValidUrl
        }

        // Check lastmod presence
        if (urlEntry.lastmod) {
          lastmodPresent++;
          // Validate lastmod format
          if (!isValidDate(urlEntry.lastmod)) {
            issues.push({
              type: 'warning',
              message: 'Invalid lastmod date format. Should be W3C Datetime format (YYYY-MM-DD or ISO 8601)',
              affectedUrl: url
            });
          }
        } else {
          urlsWithoutLastmod.push(url);
        }

        // Check priority presence and validity
        if (urlEntry.priority !== undefined) {
          priorityPresent++;
          const priority = parseFloat(urlEntry.priority);
          if (isNaN(priority) || priority < 0 || priority > 1) {
            issues.push({
              type: 'warning',
              message: `Invalid priority value: ${urlEntry.priority}. Should be between 0.0 and 1.0`,
              affectedUrl: url
            });
          } else {
            priorities.push(priority);
          }
        }

        // Check changefreq presence and validity
        if (urlEntry.changefreq) {
          changefreqPresent++;
          if (!VALID_CHANGEFREQ.includes(urlEntry.changefreq.toLowerCase())) {
            issues.push({
              type: 'warning',
              message: `Invalid changefreq value: ${urlEntry.changefreq}`,
              affectedUrl: url
            });
          }
        }

        // Check for image sitemap extensions
        if (urlEntry['image:image']) {
          hasImages = true;
        }

        // Check for video sitemap extensions
        if (urlEntry['video:video']) {
          hasVideos = true;
        }

        // Check for news sitemap extensions
        if (urlEntry['news:news']) {
          hasNews = true;
        }
      }

      // Additional validation warnings
      if (lastmodPresent === 0) {
        issues.push({
          type: 'warning',
          message: 'No URLs have lastmod dates. This helps search engines understand content freshness'
        });
      } else if (lastmodPresent < urlCount * 0.5) {
        issues.push({
          type: 'info',
          message: `Only ${Math.round((lastmodPresent / urlCount) * 100)}% of URLs have lastmod dates`
        });
      }

      if (priorityPresent === 0) {
        issues.push({
          type: 'info',
          message: 'No URLs have priority values. Consider adding priorities to indicate relative importance'
        });
      }

      if (changefreqPresent === 0) {
        issues.push({
          type: 'info',
          message: 'No URLs have changefreq values. This helps search engines schedule crawls'
        });
      }
    } else {
      issues.push({
        type: 'error',
        message: 'Sitemap structure is invalid: missing both <urlset> and <sitemapindex> elements'
      });
      isValid = false;
    }

    // Calculate average priority
    const avgPriority = priorities.length > 0
      ? priorities.reduce((a, b) => a + b, 0) / priorities.length
      : null;

    // Check robots.txt for sitemap reference
    const robotsTxtAllowed = await checkRobotsTxt(parsedSitemapUrl, sitemapUrl);
    if (robotsTxtAllowed === false) {
      issues.push({
        type: 'warning',
        message: 'Sitemap is not referenced in robots.txt. Consider adding "Sitemap: <url>" directive'
      });
    }

    return {
      url: sitemapUrl,
      isValid,
      urlCount,
      issues,
      lastmodPresent,
      priorityPresent,
      changefreqPresent,
      urlsWithoutLastmod: urlsWithoutLastmod.slice(0, 10), // Limit to first 10 for reporting
      duplicateUrls,
      invalidUrls,
      avgPriority,
      hasImages,
      hasVideos,
      hasNews,
      compressionUsed,
      sizeBytes,
      isIndex,
      childSitemaps,
      httpsMixedContent,
      robotsTxtAllowed
    };

  } catch (error) {
    issues.push({
      type: 'error',
      message: `Unexpected error validating sitemap: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    return {
      url: sitemapUrl,
      isValid: false,
      urlCount: 0,
      issues,
      lastmodPresent: 0,
      priorityPresent: 0,
      changefreqPresent: 0,
      urlsWithoutLastmod: [],
      duplicateUrls: [],
      invalidUrls: [],
      avgPriority: null,
      hasImages: false,
      hasVideos: false,
      hasNews: false,
      compressionUsed: false,
      sizeBytes: 0,
      isIndex: false,
      childSitemaps: [],
      httpsMixedContent: false,
      robotsTxtAllowed: null
    };
  }
}

/**
 * Calculate sitemap quality score (0-100)
 */
export function calculateSitemapScore(validation: SitemapValidation): number {
  if (!validation.isValid) {
    return 0;
  }

  let score = 100;
  const errorCount = validation.issues.filter(i => i.type === 'error').length;
  const warningCount = validation.issues.filter(i => i.type === 'warning').length;

  // Penalize errors heavily
  score -= errorCount * 15;

  // Penalize warnings moderately
  score -= warningCount * 5;

  // Empty sitemap
  if (validation.urlCount === 0) {
    return 0;
  }

  // Bonus for good practices
  if (validation.lastmodPresent > 0) {
    const lastmodPercentage = validation.lastmodPresent / validation.urlCount;
    if (lastmodPercentage > 0.9) {
      score += 5;
    }
  }

  if (validation.compressionUsed) {
    score += 5;
  }

  if (!validation.httpsMixedContent) {
    score += 5;
  }

  if (validation.robotsTxtAllowed === true) {
    score += 5;
  }

  // Penalize large numbers of duplicates or invalid URLs
  if (validation.duplicateUrls.length > 0) {
    score -= Math.min(20, validation.duplicateUrls.length * 2);
  }

  if (validation.invalidUrls.length > 0) {
    score -= Math.min(20, validation.invalidUrls.length * 3);
  }

  // Penalize approaching limits
  if (!validation.isIndex && validation.urlCount > MAX_SITEMAP_URLS * 0.9) {
    score -= 10;
  }

  if (validation.sizeBytes > MAX_SITEMAP_SIZE * 0.9) {
    score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Validate URL format
 */
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate date format (W3C Datetime format)
 */
function isValidDate(dateString: string): boolean {
  // W3C Datetime format: YYYY-MM-DD or full ISO 8601
  const w3cDatePattern = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)?)?$/;

  if (!w3cDatePattern.test(dateString)) {
    return false;
  }

  // Additional validation: check if date is valid
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

/**
 * Check namespace declarations in sitemap XML
 */
function checkNamespaceDeclarations(xml: string, issues: SitemapIssue[]): void {
  const hasMainNamespace = xml.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');

  if (!hasMainNamespace) {
    issues.push({
      type: 'warning',
      message: 'Missing or incorrect sitemap namespace declaration'
    });
  }

  // Check for image namespace if needed
  if (xml.includes('<image:')) {
    const hasImageNamespace = xml.includes('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
    if (!hasImageNamespace) {
      issues.push({
        type: 'warning',
        message: 'Using image sitemap elements without proper namespace declaration'
      });
    }
  }

  // Check for video namespace if needed
  if (xml.includes('<video:')) {
    const hasVideoNamespace = xml.includes('xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"');
    if (!hasVideoNamespace) {
      issues.push({
        type: 'warning',
        message: 'Using video sitemap elements without proper namespace declaration'
      });
    }
  }

  // Check for news namespace if needed
  if (xml.includes('<news:')) {
    const hasNewsNamespace = xml.includes('xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"');
    if (!hasNewsNamespace) {
      issues.push({
        type: 'warning',
        message: 'Using news sitemap elements without proper namespace declaration'
      });
    }
  }
}

/**
 * Check if sitemap is referenced in robots.txt
 */
async function checkRobotsTxt(sitemapUrl: URL, fullSitemapUrl: string): Promise<boolean | null> {
  try {
    const robotsTxtUrl = `${sitemapUrl.protocol}//${sitemapUrl.host}/robots.txt`;
    const response = await fetch(robotsTxtUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEO-Crawler/1.0; +http://example.com/bot)'
      }
    });

    if (!response.ok) {
      return null; // robots.txt doesn't exist or not accessible
    }

    const robotsTxt = await response.text();

    // Check if sitemap is mentioned in robots.txt
    const sitemapLines = robotsTxt
      .split('\n')
      .filter(line => line.toLowerCase().startsWith('sitemap:'));

    if (sitemapLines.length === 0) {
      return false; // No sitemap declarations
    }

    // Check if our specific sitemap is mentioned
    const mentioned = sitemapLines.some(line => {
      const declaredSitemap = line.substring(8).trim();
      return declaredSitemap === fullSitemapUrl;
    });

    return mentioned;
  } catch {
    return null; // Error checking robots.txt
  }
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

export default validateSitemap;
