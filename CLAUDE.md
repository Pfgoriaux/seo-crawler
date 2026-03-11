# CLAUDE.md - SEO Crawler Project Guide

This file provides context for Claude Code when working on this project.

---

## Project Overview

SEO Crawler is a comprehensive TypeScript-based CLI tool that analyzes websites for SEO health. It uses Playwright for browser automation and crawls sites starting from their sitemap.xml, measuring Core Web Vitals and 50+ SEO metrics including advanced analysis for E-E-A-T, AI citation optimization, security headers, and content freshness.

---

## Technology Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript (strict mode)
- **Browser Automation**: Playwright (Chromium)
- **CLI Framework**: Commander.js
- **Concurrency**: p-limit (default 3 concurrent pages)
- **XML Parsing**: fast-xml-parser
- **Reports**: Custom HTML with Chart.js (CDN)

---

## Project Structure

```
seo-crawler/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── crawler/
│   │   ├── index.ts          # Main crawler orchestrator
│   │   ├── sitemap-parser.ts # Sitemap.xml parsing
│   │   └── page-crawler.ts   # Single page analysis
│   ├── analyzers/            # SEO metric analyzers
│   │   ├── index.ts          # Analyzer orchestrator
│   │   ├── core-web-vitals.ts    # LCP, FID, CLS, TTFB, FCP
│   │   ├── meta-tags.ts          # Title, description, OG tags
│   │   ├── document-structure.ts # Headings, alt attributes
│   │   ├── technical-seo.ts      # HTTPS, robots, canonical
│   │   ├── performance.ts        # Resources, compression
│   │   ├── mobile-friendly.ts    # Viewport, tap targets
│   │   ├── links.ts              # Internal/external links
│   │   ├── structured-data.ts    # JSON-LD, Schema.org
│   │   ├── readability.ts        # Flesch-Kincaid analysis
│   │   ├── eeat.ts               # E-E-A-T signals
│   │   ├── security-headers.ts   # CSP, HSTS, X-Frame-Options
│   │   ├── content-freshness.ts  # Publication dates, freshness
│   │   ├── ai-citation-optimization.ts  # AI/LLM optimization
│   │   ├── third-party-scripts.ts       # 3rd party impact
│   │   ├── js-rendering.ts       # JavaScript rendering analysis
│   │   ├── redirect-chain.ts     # Redirect chain detection
│   │   ├── inp.ts                # Interaction to Next Paint
│   │   └── hreflang-validation.ts # Multi-language validation
│   ├── reporters/
│   │   ├── json-reporter.ts      # JSON output
│   │   └── html-reporter.ts      # Interactive HTML dashboard
│   ├── types/
│   │   └── index.ts          # TypeScript interfaces
│   └── utils/
│       ├── logger.ts
│       └── helpers.ts
├── templates/
│   └── report.html           # HTML report template
└── output/                   # Generated reports
```

---

## Key Commands

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run crawler
npm start -- https://example.com/sitemap.xml

# Run with options
npm start -- https://example.com/sitemap.xml --concurrency 5 --output ./reports

# Development mode (watch)
npm run dev
```

---

## Coding Conventions

### TypeScript

- Use strict TypeScript (`strict: true` in tsconfig.json)
- Explicit type annotations for function parameters and return types
- Use `interface` for object shapes, `type` for unions/primitives
- Avoid `any` unless interfacing with browser APIs (use `as any` with eslint-disable comment)

### Browser API Patterns

When using Playwright's `page.evaluate()` with browser APIs that lack proper types:

```typescript
// Use type assertions for Performance API
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const entries = (performance as any).getEntriesByType('navigation');

// Explicit Element types in DOM callbacks
elements.forEach((el: Element) => { ... });
images.map((img: HTMLImageElement) => { ... });
```

### Analyzer Structure

Each analyzer follows this pattern:

```typescript
// 1. Main analysis function
export async function analyzeX(page: Page): Promise<XData> {
  const analysis = await page.evaluate(() => {
    // Browser-side code here
    return { ... };
  });
  return analysis;
}

// 2. Score calculation function
export function calculateXScore(data: XData): number {
  let score = 100;
  // Apply penalties/bonuses
  return Math.max(0, Math.min(100, score));
}

// 3. Default export
export default analyzeX;
```

### Error Handling

- Wrap async operations in try/catch
- Log errors with context using the logger utility
- Return partial results when possible (don't fail entire crawl for one page)
- Use optional chaining (`?.`) for potentially missing DOM elements

---

## Scoring System

### Category Scores (Primary)

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

### Advanced Analysis Scores

| Category | Description |
|----------|-------------|
| Readability | Flesch-Kincaid grade level (ideal: 8th-10th grade) |
| E-E-A-T | Experience, Expertise, Authority, Trust signals |
| Security Headers | CSP, HSTS, X-Frame-Options, etc. |
| Content Freshness | Publication dates, last modified, copyright year |
| AI Citation | Optimization for AI/LLM citation |
| 3rd Party Scripts | Third-party script impact on performance |
| JS Rendering | Content added via JavaScript analysis |
| Redirect Chain | Number of redirects in chain |
| INP | Interaction to Next Paint (replacing FID) |
| Hreflang | Multi-language tag validation |

### Score Ranges
- **90-100**: Excellent (green) ✓
- **50-89**: Needs Improvement (yellow) ⚠
- **0-49**: Poor (red) ✗

---

## Adding New Analyzers

1. Create file in `src/analyzers/`
2. Export analysis function + score calculation function
3. Add types to `src/types/index.ts`
4. Register in `src/analyzers/index.ts`
5. Update scoring weights if needed
6. Document metrics in `SEO-METRICS.md`

---

## Testing Locally

```bash
# Test with a real sitemap
npm start -- https://example.com/sitemap.xml

# Test with limited pages
npm start -- https://example.com/sitemap.xml --max-pages 5

# Output formats
npm start -- https://example.com/sitemap.xml --format json
npm start -- https://example.com/sitemap.xml --format html
npm start -- https://example.com/sitemap.xml --format json,html
```

---

## Common Issues

### "Browser not installed"
Run: `npx playwright install chromium`

### TypeScript DOM errors
Ensure tsconfig.json includes: `"lib": ["ES2022", "DOM", "DOM.Iterable"]`

### Timeout errors
Increase timeout: `--timeout 60000`

### Memory issues on large sites
Reduce concurrency: `--concurrency 2`

---

## Dependencies

Core:
- `playwright` - Browser automation
- `commander` - CLI framework
- `fast-xml-parser` - XML parsing
- `p-limit` - Concurrency control
- `chalk` - Terminal colors
- `ora` - Progress spinners
- `text-readability` - Flesch-Kincaid readability analysis

Dev:
- `typescript` - Language
- `@types/node` - Node.js types

---

## Output Files

- `output/seo-report-{timestamp}.json` - Machine-readable data
- `output/seo-report-{timestamp}.html` - Interactive visual dashboard

---

## HTML Report Features

### Interactive Elements
- **Clickable Top Issues**: Click any issue to expand and see all affected page URLs
- **Expandable Page Details**: Click page headers to view detailed metrics
- **Tooltips**: Hover over any metric to see explanation and good/bad score guidance

### Tooltip Format
Each metric tooltip includes:
1. What the metric measures
2. Why it matters for SEO
3. Score thresholds (e.g., "✓ Good: 90-100 | ⚠ Okay: 50-89 | ✗ Poor: <50")

### Report Sections
1. **Summary Cards**: Overall score, pages crawled, errors, warnings
2. **Charts**: Core Web Vitals distribution, Issues by category
3. **Top Issues**: Clickable list with affected URLs
4. **All Pages Table**: Sortable overview of all crawled pages
5. **Page Details**: Expandable cards with full metrics per page
   - Core metrics (LCP, FID, CLS, Load Time, Page Size, Requests)
   - Category scores (8 categories)
   - Advanced analysis scores (10 categories)
   - Security headers detail table
   - Page-specific issues list

---

## Reference Documentation

- See `SEO-METRICS.md` for complete list of monitored metrics
- See `templates/report.html` for report structure
