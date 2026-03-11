# SEO Crawler

A comprehensive CLI tool that analyzes websites for SEO health. Crawls sites from their sitemap.xml, measuring Core Web Vitals and 50+ SEO metrics including E-E-A-T signals, AI citation optimization, security headers, and content freshness.

## Features

- **Core Web Vitals** - LCP, FID/INP, CLS, TTFB, FCP
- **Meta Tags** - Title, description, Open Graph, Twitter Cards
- **Technical SEO** - HTTPS, robots, canonical, redirects
- **Document Structure** - Headings hierarchy, image alt attributes
- **Performance** - Resource analysis, compression, caching
- **Mobile Friendliness** - Viewport, tap targets, plugins
- **Structured Data** - JSON-LD, Schema.org validation
- **Links** - Internal/external link analysis, broken link detection
- **Readability** - Flesch-Kincaid grade level analysis
- **E-E-A-T** - Experience, Expertise, Authority, Trust signals
- **Security Headers** - CSP, HSTS, X-Frame-Options
- **Content Freshness** - Publication dates, last modified
- **AI Citation** - Optimization for AI/LLM citation
- **Third-Party Scripts** - Performance impact analysis
- **JS Rendering** - Content added via JavaScript
- **Hreflang** - Multi-language tag validation
- **AI Improvement Agent** - Claude-powered fix suggestions (optional)

## Installation

```bash
git clone https://github.com/Pfgoriaux/seo-crawler.git
cd seo-crawler
npm install
npx playwright install chromium
npm run build
```

## Quick Start

```bash
# Crawl a website
npm start -- https://example.com/sitemap.xml

# Limit pages for quick testing
npm start -- https://example.com/sitemap.xml --max-pages 5

# Custom output directory
npm start -- https://example.com/sitemap.xml --output ./reports

# JSON only
npm start -- https://example.com/sitemap.xml --format json
```

## CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `-o, --output <dir>` | Output directory | `./seo-reports` |
| `-c, --concurrency <n>` | Concurrent pages | `3` |
| `-t, --timeout <ms>` | Page timeout (ms) | `30000` |
| `-f, --format <formats>` | Output formats (`json`, `html`) | `json,html` |
| `-m, --max-pages <n>` | Max pages to crawl | all |
| `-u, --user-agent <str>` | Custom user agent | built-in |
| `--screenshots` | Capture page screenshots | `false` |
| `--no-broken-links` | Skip broken link checks | checks enabled |
| `-v, --verbose` | Verbose logging | `false` |
| `-q, --quiet` | Errors only | `false` |

## Configuration

Copy `.env.example` to `.env` to customize defaults:

```bash
cp .env.example .env
```

Settings include concurrency, timeouts, viewport size, and an optional Anthropic API key for AI-powered improvement suggestions.

## Output

Reports are generated in `./seo-reports/` by default:

- **JSON** - Machine-readable data with all metrics
- **HTML** - Interactive dashboard with charts, clickable issues, expandable page details, and tooltips

### Scoring

| Score | Rating |
|-------|--------|
| 90-100 | Excellent |
| 50-89 | Needs Improvement |
| 0-49 | Poor |

## Requirements

- Node.js 18+
- Chromium (installed via Playwright)

## License

[MIT](LICENSE)
