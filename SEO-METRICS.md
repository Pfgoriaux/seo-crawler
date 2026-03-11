# SEO Metrics & Data Points

This document outlines all SEO metrics and data points monitored by the SEO Crawler.

---

## 1. Core Web Vitals

| Metric | Description | Good | Needs Improvement | Poor |
|--------|-------------|------|-------------------|------|
| **LCP** (Largest Contentful Paint) | Time until the largest content element is visible | < 2.5s | 2.5s - 4.0s | > 4.0s |
| **FID** (First Input Delay) | Time from first interaction to browser response | < 100ms | 100ms - 300ms | > 300ms |
| **CLS** (Cumulative Layout Shift) | Visual stability score | < 0.1 | 0.1 - 0.25 | > 0.25 |
| **TTFB** (Time to First Byte) | Server response time | < 800ms | 800ms - 1800ms | > 1800ms |
| **FCP** (First Contentful Paint) | Time until first content is painted | < 1.8s | 1.8s - 3.0s | > 3.0s |

---

## 2. Meta Tags

### Essential Meta Tags
| Data Point | Description | Recommendation |
|------------|-------------|----------------|
| **Title Tag** | Page title displayed in SERPs | 50-60 characters (max 600px width) |
| **Title Length** | Character count of title | Warning if < 50 or > 60 chars |
| **Meta Description** | Page summary in SERPs | 110-160 characters |
| **Description Length** | Character count of description | Warning if < 110 or > 160 chars |
| **Viewport Meta** | Mobile viewport configuration | Must be present |
| **Robots Meta** | Indexing directives | Check for noindex |
| **Canonical URL** | Preferred URL for the page | Should be present |

### Hreflang Tags
| Data Point | Description |
|------------|-------------|
| **Language Code** | ISO language code (e.g., en, es, fr) |
| **URL** | Alternate language page URL |

### Open Graph Tags
| Data Point | Description | Required |
|------------|-------------|----------|
| **og:title** | Social share title | Yes |
| **og:type** | Content type (website, article, etc.) | Yes |
| **og:image** | Social share image URL | Yes |
| **og:url** | Canonical URL for sharing | Yes |
| **og:description** | Social share description | Recommended |
| **og:site_name** | Website name | Recommended |

### Twitter Card Tags
| Data Point | Description |
|------------|-------------|
| **twitter:card** | Card type (summary, summary_large_image) |
| **twitter:title** | Tweet title |
| **twitter:description** | Tweet description |
| **twitter:image** | Tweet image URL |
| **twitter:site** | Twitter @username |

### Other Meta
| Data Point | Description |
|------------|-------------|
| **Favicon** | Site icon presence |

---

## 3. Technical SEO

| Data Point | Description | Expected |
|------------|-------------|----------|
| **HTTP Status Code** | Response status | 200 OK |
| **HTTPS** | Secure connection | Required |
| **Robots Noindex** | Meta robots noindex directive | Should be absent (unless intentional) |
| **X-Robots-Tag** | HTTP header robots directive | Should be absent (unless intentional) |
| **Canonical URL** | Self-referencing canonical | Should match page URL |
| **Canonical Valid** | Canonical URL validation | Must be valid URL |
| **Redirect Chain** | Number of redirects | < 3 redirects |
| **Response Headers** | All HTTP response headers | For analysis |

---

## 4. Document Structure

| Data Point | Description | Recommendation |
|------------|-------------|----------------|
| **Doctype** | HTML doctype declaration | HTML5 (`<!DOCTYPE html>`) |
| **Valid Doctype** | HTML5 doctype validation | Must be valid |
| **H1 Count** | Number of H1 headings | Exactly 1 |
| **Heading Hierarchy** | H1-H6 proper nesting | No skipped levels |
| **Headings List** | All headings with levels | For analysis |
| **Total Images** | Image count on page | For analysis |
| **Images Without Alt** | Images missing alt attribute | Should be 0 |
| **URL SEO Friendly** | Clean URL structure | Lowercase, hyphens, no special chars |

### Image Analysis
| Data Point | Description |
|------------|-------------|
| **Source URL** | Image src attribute |
| **Alt Text** | Alternative text |
| **Width** | Image width |
| **Height** | Image height |
| **Loading** | Lazy loading attribute |

---

## 5. Links Analysis

### Link Metrics
| Data Point | Description |
|------------|-------------|
| **Total Links** | All links on page |
| **Internal Links Count** | Links to same domain |
| **External Links Count** | Links to other domains |
| **Broken Links Count** | Links returning 4xx/5xx |

### Link Details
| Data Point | Description |
|------------|-------------|
| **href** | Link destination URL |
| **Anchor Text** | Link text content |
| **rel Attribute** | Link relationship (nofollow, etc.) |
| **Is Nofollow** | Has rel="nofollow" |
| **Status Code** | HTTP status (for broken link check) |

---

## 6. Performance Metrics

### Resource Counts
| Data Point | Description |
|------------|-------------|
| **Total Resources** | All loaded resources |
| **Scripts** | JavaScript files |
| **Stylesheets** | CSS files |
| **Images** | Image files |
| **Fonts** | Font files |
| **Other** | Other resource types |

### Size Metrics
| Data Point | Description | Recommendation |
|------------|-------------|----------------|
| **Total Resource Size** | Combined size of all resources | < 3MB |
| **HTML Size** | HTML document size | < 100KB |
| **CSS Size** | Total CSS size | < 200KB |
| **JS Size** | Total JavaScript size | < 500KB |
| **Image Size** | Total image size | Optimize images |
| **Font Size** | Total font size | < 200KB |

### Optimization Checks
| Data Point | Description | Expected |
|------------|-------------|----------|
| **Compression Enabled** | Gzip/Brotli compression | Yes |
| **Cache Headers Present** | Cache-Control headers | Yes |

---

## 7. Mobile Friendliness

| Data Point | Description | Recommendation |
|------------|-------------|----------------|
| **Has Viewport Meta** | Viewport meta tag present | Required |
| **Viewport Content** | Viewport configuration | `width=device-width` |
| **Small Text Elements** | Elements with font < 12px | Should be 0 |
| **Small Tap Targets** | Buttons/links < 48x48px | Should be 0 |
| **Has Plugins** | Flash/Silverlight usage | Should be false |
| **Plugin Elements** | List of deprecated plugins | Should be empty |

---

## 8. Structured Data

### JSON-LD
| Data Point | Description |
|------------|-------------|
| **Type** | Schema.org type (@type) |
| **Data** | Full JSON-LD object |
| **Valid** | Passes basic validation |
| **Errors** | Validation error messages |

### Microdata
| Data Point | Description |
|------------|-------------|
| **Type** | itemtype attribute |
| **Properties** | itemprop values |

### Summary
| Data Point | Description |
|------------|-------------|
| **Has Structured Data** | Any structured data present |
| **Schema Types** | List of all schema types found |

---

## 9. Scoring System

### Category Weights
| Category | Weight |
|----------|--------|
| Core Web Vitals | 20% |
| Meta Tags | 15% |
| Technical SEO | 15% |
| Performance | 15% |
| Document Structure | 10% |
| Links | 10% |
| Mobile Friendliness | 10% |
| Structured Data | 5% |

### Score Ranges
| Score | Rating |
|-------|--------|
| 90-100 | Excellent |
| 70-89 | Good |
| 50-69 | Needs Improvement |
| 0-49 | Poor |

---

## 10. Issue Types

| Type | Severity | Description |
|------|----------|-------------|
| **Error** | High | Critical issues that must be fixed |
| **Warning** | Medium | Issues that should be addressed |
| **Info** | Low | Suggestions for improvement |

### Issue Categories
- Core Web Vitals
- Meta Tags
- Technical SEO
- Document Structure
- Links
- Performance
- Mobile Friendliness
- Structured Data

---

## 11. Report Outputs

### JSON Report
- Complete crawl data
- All page analyses
- Summary statistics
- Machine-readable format

### HTML Report
- Interactive dashboard
- Score visualizations (Chart.js)
- Filterable issue tables
- Expandable page details
- CWV distribution charts
- Issues by category breakdown
