# XML Sitemap Deep Validation

Comprehensive sitemap.xml validation analyzer that checks XML structure, URL validity, and adherence to sitemap protocol standards.

## Features

### Core Validation
- ✅ XML structure and well-formedness
- ✅ Proper namespace declarations (sitemap, image, video, news)
- ✅ URL count limits (50,000 URLs per sitemap)
- ✅ File size limits (50MB uncompressed)
- ✅ Sitemap index support
- ✅ HTTP/HTTPS protocol consistency

### URL Analysis
- ✅ Duplicate URL detection
- ✅ Invalid URL format detection
- ✅ URL accessibility validation
- ✅ Protocol consistency checking

### Metadata Validation
- ✅ `lastmod` presence and format validation (W3C Datetime)
- ✅ `priority` presence and value range (0.0-1.0)
- ✅ `changefreq` presence and valid values
- ✅ Average priority calculation

### Extensions Support
- ✅ Image sitemap extensions detection
- ✅ Video sitemap extensions detection
- ✅ News sitemap extensions detection

### Best Practices
- ✅ Compression (gzip) usage detection
- ✅ robots.txt sitemap reference validation
- ✅ Content-Type header validation
- ✅ Size optimization recommendations

## Usage

### Basic Usage

```typescript
import { validateSitemap, calculateSitemapScore } from './analyzers/sitemap-validator';

// Validate a sitemap
const validation = await validateSitemap('https://example.com/sitemap.xml');

// Calculate quality score (0-100)
const score = calculateSitemapScore(validation);

console.log(`Sitemap is ${validation.isValid ? 'valid' : 'invalid'}`);
console.log(`Score: ${score}/100`);
console.log(`Contains ${validation.urlCount} URLs`);
```

### Detailed Analysis

```typescript
const validation = await validateSitemap('https://example.com/sitemap.xml');

// Check if it's a sitemap index
if (validation.isIndex) {
  console.log(`Sitemap index with ${validation.childSitemaps.length} child sitemaps`);
  validation.childSitemaps.forEach(sitemap => {
    console.log(`- ${sitemap}`);
  });
}

// Review metadata coverage
console.log('Metadata coverage:');
console.log(`- lastmod: ${validation.lastmodPresent}/${validation.urlCount} URLs`);
console.log(`- priority: ${validation.priorityPresent}/${validation.urlCount} URLs`);
console.log(`- changefreq: ${validation.changefreqPresent}/${validation.urlCount} URLs`);

// Check for issues
const errors = validation.issues.filter(i => i.type === 'error');
const warnings = validation.issues.filter(i => i.type === 'warning');

console.log(`Found ${errors.length} errors and ${warnings.length} warnings`);

// Review specific issues
validation.issues.forEach(issue => {
  console.log(`[${issue.type}] ${issue.message}`);
  if (issue.affectedUrl) {
    console.log(`  URL: ${issue.affectedUrl}`);
  }
});
```

### Validating Sitemap Index

```typescript
const validation = await validateSitemap('https://example.com/sitemap-index.xml');

if (validation.isIndex) {
  console.log('This is a sitemap index');
  console.log(`Child sitemaps: ${validation.childSitemaps.length}`);

  // Validate each child sitemap
  for (const childUrl of validation.childSitemaps) {
    const childValidation = await validateSitemap(childUrl);
    console.log(`${childUrl}: ${childValidation.urlCount} URLs, Score: ${calculateSitemapScore(childValidation)}`);
  }
}
```

## Validation Results

### SitemapValidation Interface

```typescript
interface SitemapValidation {
  url: string;                    // Sitemap URL
  isValid: boolean;               // Overall validity
  urlCount: number;               // Number of URLs (or child sitemaps)
  issues: SitemapIssue[];         // All issues found

  // Metadata coverage
  lastmodPresent: number;         // URLs with lastmod
  priorityPresent: number;        // URLs with priority
  changefreqPresent: number;      // URLs with changefreq

  // URL quality
  urlsWithoutLastmod: string[];   // First 10 URLs missing lastmod
  duplicateUrls: string[];        // Duplicate URLs found
  invalidUrls: string[];          // Malformed URLs

  // Statistics
  avgPriority: number | null;     // Average priority value

  // Extensions
  hasImages: boolean;             // Uses image sitemap extension
  hasVideos: boolean;             // Uses video sitemap extension
  hasNews: boolean;               // Uses news sitemap extension

  // Technical
  compressionUsed: boolean;       // Gzip/deflate enabled
  sizeBytes: number;              // Uncompressed size

  // Sitemap index
  isIndex: boolean;               // Is this a sitemap index?
  childSitemaps: string[];        // Child sitemap URLs

  // Additional checks
  httpsMixedContent: boolean;     // Mixed HTTP/HTTPS URLs
  robotsTxtAllowed: boolean|null; // Referenced in robots.txt
}
```

### SitemapIssue Interface

```typescript
interface SitemapIssue {
  type: 'error' | 'warning' | 'info';  // Issue severity
  message: string;                      // Issue description
  affectedUrl?: string;                 // Specific URL (if applicable)
}
```

## Issue Types

### Errors (Critical)
- Invalid XML structure
- Malformed URLs
- Duplicate URLs
- Exceeding 50,000 URL limit
- Exceeding 50MB size limit
- Invalid namespace declarations
- Empty sitemap (0 URLs)
- HTTP errors when fetching

### Warnings (Important)
- Missing or invalid namespace
- Invalid date formats
- Invalid priority values (not 0.0-1.0)
- Invalid changefreq values
- HTTP/HTTPS protocol inconsistency
- Approaching size/URL limits (>90%)
- No compression used
- Not referenced in robots.txt

### Info (Suggestions)
- Missing metadata (lastmod, priority, changefreq)
- Metadata coverage statistics
- Recommendations for improvement

## Scoring System

The `calculateSitemapScore()` function returns a score from 0-100:

**Scoring Factors:**
- Base score: 100
- Errors: -15 points each
- Warnings: -5 points each
- Duplicate URLs: -2 points each (max -20)
- Invalid URLs: -3 points each (max -20)
- Approaching limits: -10 points
- Mixed HTTPS content: -5 points

**Bonuses:**
- Good lastmod coverage (>90%): +5 points
- Compression enabled: +5 points
- No mixed content: +5 points
- Referenced in robots.txt: +5 points

## Validation Checks

### XML Structure
1. XML declaration present
2. Root element (urlset or sitemapindex)
3. Valid XML syntax
4. Proper namespace declarations

### URL Validation
1. Valid URL format
2. HTTP/HTTPS protocol
3. No duplicates
4. Consistent protocol usage

### Metadata Validation
1. **lastmod**: W3C Datetime format (YYYY-MM-DD or ISO 8601)
2. **priority**: Numeric value 0.0 to 1.0
3. **changefreq**: One of: always, hourly, daily, weekly, monthly, yearly, never

### Size Limits
1. URL count ≤ 50,000 per sitemap
2. File size ≤ 50MB uncompressed
3. Warnings at 90% of limits

### Extensions
1. Image sitemap: `xmlns:image` namespace and `<image:image>` elements
2. Video sitemap: `xmlns:video` namespace and `<video:video>` elements
3. News sitemap: `xmlns:news` namespace and `<news:news>` elements

### robots.txt Integration
- Checks if sitemap is declared in robots.txt
- Validates using `Sitemap:` directive

## Valid Changefreq Values

```
always    - Changes with every access
hourly    - Changes hourly
daily     - Changes daily
weekly    - Changes weekly
monthly   - Changes monthly
yearly    - Changes yearly
never     - Archived URL, never changes
```

## Date Format (lastmod)

Valid W3C Datetime formats:
```
YYYY-MM-DD                    # 2024-01-15
YYYY-MM-DDThh:mm:ss+hh:mm    # 2024-01-15T14:30:00+00:00
YYYY-MM-DDThh:mm:ssZ         # 2024-01-15T14:30:00Z
```

## Examples

See `examples/sitemap-validation-example.ts` for complete usage examples.

### Example Output

```
=== Sitemap Validation Results ===
URL: https://example.com/sitemap.xml
Valid: ✓
Type: URL Sitemap
URLs: 1,234
Size: 245.67 KB
Compressed: Yes
Score: 95/100

=== Metadata Coverage ===
lastmod: 1234/1234 URLs
priority: 1234/1234 URLs
changefreq: 1234/1234 URLs
Average priority: 0.65

=== Extensions ===
Images: Yes
Videos: No
News: No

=== Additional Checks ===
HTTPS Mixed Content: No
Referenced in robots.txt: Yes

✓ No issues found!
```

## Error Handling

The validator includes comprehensive error handling:

```typescript
try {
  const validation = await validateSitemap(url);

  if (!validation.isValid) {
    console.error('Sitemap validation failed');
    validation.issues
      .filter(i => i.type === 'error')
      .forEach(error => console.error(error.message));
  }
} catch (error) {
  console.error('Failed to validate sitemap:', error);
}
```

## Performance Considerations

- Uses native `fetch()` API (no external HTTP libraries)
- Efficient XML parsing with `fast-xml-parser`
- Supports gzip/deflate compressed sitemaps
- Limits issue reporting (first 10 URLs without lastmod)
- Handles large sitemaps (up to 50MB)

## Best Practices

1. **Enable compression**: Reduce bandwidth and improve crawl efficiency
2. **Include lastmod**: Help search engines prioritize recent content
3. **Use priority wisely**: Indicate relative importance (0.0-1.0)
4. **Add to robots.txt**: Include `Sitemap:` directive
5. **Keep URLs under limit**: Use sitemap index for >50,000 URLs
6. **Use HTTPS consistently**: Don't mix HTTP/HTTPS
7. **Validate regularly**: Check after content updates
8. **Monitor extensions**: Use image/video/news extensions when applicable

## Limitations

- Does not validate URL accessibility (just format)
- Does not crawl URLs to verify content
- robots.txt checking requires domain access
- Maximum processing size: 50MB
- Network timeouts may affect validation

## References

- [Sitemap Protocol](https://www.sitemaps.org/protocol.html)
- [Google Sitemap Guidelines](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview)
- [Image Sitemap Extension](https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps)
- [Video Sitemap Extension](https://developers.google.com/search/docs/crawling-indexing/sitemaps/video-sitemaps)
- [News Sitemap Extension](https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap)
