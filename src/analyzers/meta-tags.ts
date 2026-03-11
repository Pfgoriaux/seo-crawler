import { Page } from 'playwright';
import { MetaTags, HreflangTag, OpenGraphTags, TwitterCardTags } from '../types';

/**
 * Character width map for Google SERP font (Arial-like, ~16px)
 * Based on average character widths in Google's search results
 * Values are in pixels per character
 */
const CHAR_WIDTH_MAP: Record<string, number> = {
  // Narrow characters
  'i': 4, 'l': 4, 'I': 5, 'j': 4, '|': 4, '!': 4, '.': 4, ',': 4, ':': 4, ';': 4, "'": 3, '"': 5,
  'f': 5, 't': 5, 'r': 5, '1': 8,
  // Medium-narrow characters
  ' ': 4, '-': 5, '_': 8, '(': 5, ')': 5, '[': 5, ']': 5, '{': 6, '}': 6,
  // Medium characters
  'a': 8, 'b': 9, 'c': 8, 'd': 9, 'e': 8, 'g': 9, 'h': 9, 'k': 8, 'n': 9, 'o': 9,
  'p': 9, 'q': 9, 's': 7, 'u': 9, 'v': 8, 'x': 8, 'y': 8, 'z': 7,
  'A': 10, 'B': 10, 'C': 10, 'D': 11, 'E': 9, 'F': 9, 'G': 11, 'H': 11, 'J': 8,
  'K': 10, 'L': 8, 'N': 11, 'O': 12, 'P': 10, 'Q': 12, 'R': 10, 'S': 9, 'T': 9,
  'U': 11, 'V': 10, 'X': 10, 'Y': 10, 'Z': 9,
  '0': 9, '2': 9, '3': 9, '4': 9, '5': 9, '6': 9, '7': 9, '8': 9, '9': 9,
  // Wide characters
  'm': 13, 'w': 12, 'M': 13, 'W': 15,
  '@': 14, '#': 9, '$': 9, '%': 12, '&': 11, '*': 7, '+': 9, '=': 9, '~': 9,
  '/': 5, '\\': 5, '<': 9, '>': 9, '?': 8,
};

const DEFAULT_CHAR_WIDTH = 8; // Default width for unknown characters

/**
 * Calculate approximate pixel width of text for Google SERP display
 * Google uses a proportional font (Arial-like) for SERP titles and descriptions
 */
function calculatePixelWidth(text: string | null): number {
  if (!text) return 0;

  let width = 0;
  for (const char of text) {
    width += CHAR_WIDTH_MAP[char] || DEFAULT_CHAR_WIDTH;
  }
  return Math.round(width);
}

/**
 * Analyze meta tags on a page
 */
export async function analyzeMetaTags(page: Page): Promise<MetaTags> {
  const metaTags = await page.evaluate(() => {
    // Helper to get meta content
    const getMeta = (name: string, property?: boolean): string | null => {
      const selector = property
        ? `meta[property="${name}"]`
        : `meta[name="${name}"]`;
      const element = document.querySelector(selector);
      return element?.getAttribute('content') || null;
    };

    // Get title
    const titleElement = document.querySelector('title');
    const title = titleElement?.textContent || null;

    // Get meta description
    const description = getMeta('description');

    // Get viewport
    const viewport = getMeta('viewport');

    // Get robots
    const robots = getMeta('robots');

    // Get canonical
    const canonicalElement = document.querySelector('link[rel="canonical"]');
    const canonical = canonicalElement?.getAttribute('href') || null;

    // Get hreflang tags
    const hreflangElements = document.querySelectorAll('link[rel="alternate"][hreflang]');
    const hreflang: { lang: string; href: string }[] = Array.from(hreflangElements).map((el: Element) => ({
      lang: el.getAttribute('hreflang') || '',
      href: el.getAttribute('href') || '',
    }));

    // Get Open Graph tags
    const openGraph = {
      title: getMeta('og:title', true),
      type: getMeta('og:type', true),
      image: getMeta('og:image', true),
      url: getMeta('og:url', true),
      description: getMeta('og:description', true),
      siteName: getMeta('og:site_name', true),
    };

    // Get Twitter Card tags
    const twitterCard = {
      card: getMeta('twitter:card'),
      title: getMeta('twitter:title'),
      description: getMeta('twitter:description'),
      image: getMeta('twitter:image'),
      site: getMeta('twitter:site'),
    };

    // Get favicon
    const faviconElement = document.querySelector(
      'link[rel="icon"], link[rel="shortcut icon"]'
    );
    const favicon = faviconElement?.getAttribute('href') || null;

    return {
      title,
      description,
      viewport,
      robots,
      canonical,
      hreflang,
      openGraph,
      twitterCard,
      favicon,
    };
  });

  // Calculate pixel widths server-side (can't use external functions in page.evaluate)
  const titlePixelWidth = calculatePixelWidth(metaTags.title);
  const descriptionPixelWidth = calculatePixelWidth(metaTags.description);

  return {
    ...metaTags,
    titleLength: metaTags.title?.length || 0,
    titlePixelWidth,
    descriptionLength: metaTags.description?.length || 0,
    descriptionPixelWidth,
  } as MetaTags;
}

/**
 * Calculate meta tags score
 */
export function calculateMetaTagsScore(metaTags: MetaTags): number {
  let score = 100;

  // Title checks
  // Character count: recommended 50-60 characters
  // Pixel width: max ~600px for Google SERP display
  if (!metaTags.title) {
    score -= 20;
  } else {
    // Character length check
    if (metaTags.titleLength < 30) {
      score -= 10; // Too short
    } else if (metaTags.titleLength > 60) {
      score -= 5; // Slightly over recommended
    }

    // Pixel width check (more accurate for SERP truncation)
    if (metaTags.titlePixelWidth > 600) {
      score -= 10; // Will be truncated in SERP
    } else if (metaTags.titlePixelWidth > 550) {
      score -= 3; // Close to limit
    }
  }

  // Description checks
  // Character count: recommended 110-160 characters
  // Pixel width: max ~920px for Google SERP display (desktop)
  if (!metaTags.description) {
    score -= 15;
  } else {
    // Character length check
    if (metaTags.descriptionLength < 70) {
      score -= 7; // Too short
    } else if (metaTags.descriptionLength > 160) {
      score -= 5; // Slightly over recommended
    }

    // Pixel width check (more accurate for SERP truncation)
    if (metaTags.descriptionPixelWidth > 920) {
      score -= 7; // Will be truncated in SERP
    } else if (metaTags.descriptionPixelWidth > 850) {
      score -= 3; // Close to limit
    }
  }

  // Viewport check
  if (!metaTags.viewport) {
    score -= 15;
  }

  // Canonical check
  if (!metaTags.canonical) {
    score -= 10;
  }

  // Open Graph checks
  const ogRequired = ['title', 'type', 'image', 'url'];
  const ogMissing = ogRequired.filter(
    (key) => !metaTags.openGraph[key as keyof OpenGraphTags]
  ).length;
  score -= ogMissing * 5;

  // Favicon check
  if (!metaTags.favicon) {
    score -= 5;
  }

  return Math.max(0, score);
}

export default analyzeMetaTags;
