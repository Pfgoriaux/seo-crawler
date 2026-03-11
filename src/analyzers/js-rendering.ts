import { Page } from 'playwright';

/**
 * JavaScript Rendering Analysis Interface
 */
export interface JSRenderingAnalysis {
  initialHTML: {
    title: string | null;
    description: string | null;
    h1: string | null;
    contentLength: number;
    linksCount: number;
    imagesCount: number;
  };
  renderedHTML: {
    title: string | null;
    description: string | null;
    h1: string | null;
    contentLength: number;
    linksCount: number;
    imagesCount: number;
  };
  differences: {
    titleChanged: boolean;
    descriptionChanged: boolean;
    h1Changed: boolean;
    contentLengthDiff: number;
    linksCountDiff: number;
    imagesCountDiff: number;
  };
  criticalIssues: string[];
  framework: string | null;
  isSSR: boolean;
  isSPA: boolean;
  jsOnlyContent: {
    hasJSOnlyTitle: boolean;
    hasJSOnlyDescription: boolean;
    hasJSOnlyH1: boolean;
    hasJSOnlyMainContent: boolean;
  };
  seoImpact: 'critical' | 'warning' | 'good';
  hydrationDetected: boolean;
}

/**
 * Extract HTML content details
 */
async function extractHTMLContent(page: Page): Promise<{
  title: string | null;
  description: string | null;
  h1: string | null;
  contentLength: number;
  linksCount: number;
  imagesCount: number;
}> {
  return await page.evaluate(() => {
    const title = document.querySelector('title')?.textContent?.trim() || null;
    const description = document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || null;
    const h1 = document.querySelector('h1')?.textContent?.trim() || null;

    // Get main content length (body text without scripts/styles)
    const bodyClone = document.body.cloneNode(true) as HTMLElement;
    bodyClone.querySelectorAll('script, style, noscript').forEach(el => el.remove());
    const contentLength = bodyClone.textContent?.trim().length || 0;

    // Count links and images
    const linksCount = document.querySelectorAll('a[href]').length;
    const imagesCount = document.querySelectorAll('img').length;

    return {
      title,
      description,
      h1,
      contentLength,
      linksCount,
      imagesCount,
    };
  });
}

/**
 * Detect JavaScript frameworks and SPA patterns
 */
async function detectFrameworkAndSPA(page: Page): Promise<{
  framework: string | null;
  isSPA: boolean;
  isSSR: boolean;
  hydrationDetected: boolean;
}> {
  return await page.evaluate(() => {
    let framework: string | null = null;
    let isSPA = false;
    let isSSR = false;
    let hydrationDetected = false;

    // Detect React
    if (
      document.querySelector('[data-reactroot]') ||
      document.querySelector('[data-react-root]') ||
      document.getElementById('__next') ||
      document.getElementById('root') ||
      (window as any).__NEXT_DATA__ ||
      (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__
    ) {
      framework = 'React';

      // Check for Next.js (SSR framework)
      if ((window as any).__NEXT_DATA__) {
        framework = 'Next.js';
        isSSR = true;
      }

      // Check for Gatsby (SSR framework)
      if (document.querySelector('[id^="gatsby-"]') || (window as any).___gatsby) {
        framework = 'Gatsby';
        isSSR = true;
      }

      // Check for Create React App (client-side only)
      const rootElement = document.getElementById('root');
      if (rootElement && rootElement.innerHTML.trim().length === 0) {
        isSPA = true;
      }
    }

    // Detect Vue
    if (
      document.querySelector('[data-v-app]') ||
      (document.querySelector('[id*="app"]') as any)?.__vue__ ||
      (window as any).__NUXT__ ||
      (window as any).__VUE_DEVTOOLS_GLOBAL_HOOK__
    ) {
      framework = 'Vue';

      // Check for Nuxt.js (SSR framework)
      if ((window as any).__NUXT__) {
        framework = 'Nuxt.js';
        isSSR = true;
      }
    }

    // Detect Angular
    const ngVersion = document.querySelector('[ng-version]');
    if (
      ngVersion ||
      document.querySelector('[ng-app]') ||
      (window as any).ng ||
      (window as any).getAllAngularRootElements
    ) {
      framework = 'Angular';

      // Angular Universal (SSR)
      if ((window as any).__NG_SERVER_CONTEXT__ || ngVersion?.hasAttribute('ng-server-context')) {
        isSSR = true;
      }
    }

    // Detect Svelte
    if ((window as any).__SVELTE__ || document.querySelector('[data-svelte]')) {
      framework = 'Svelte';

      // SvelteKit (SSR framework)
      if ((window as any).__SVELTEKIT__) {
        framework = 'SvelteKit';
        isSSR = true;
      }
    }

    // Detect Ember
    if ((window as any).Ember || document.querySelector('.ember-application')) {
      framework = 'Ember';
    }

    // Detect hydration markers
    if (
      document.querySelector('[data-reactroot]') ||
      document.querySelector('[data-server-rendered]') ||
      document.querySelector('[data-ssr]') ||
      (window as any).__NEXT_DATA__?.props ||
      (window as any).__NUXT__?.serverRendered
    ) {
      hydrationDetected = true;
    }

    // SPA detection heuristics
    if (framework && !isSSR) {
      // Check if main content area is initially empty
      const mainContent = document.querySelector('main, #app, #root, [data-v-app]');
      if (mainContent && mainContent.children.length === 0) {
        isSPA = true;
      }
    }

    // Check for common SPA patterns
    if (
      (window as any).history?.pushState &&
      (document.body.innerHTML.includes('data-react-') ||
       document.body.innerHTML.includes('data-v-') ||
       document.body.innerHTML.includes('ng-'))
    ) {
      isSPA = true;
    }

    return {
      framework,
      isSPA,
      isSSR,
      hydrationDetected,
    };
  });
}

/**
 * Analyze JavaScript rendering impact on SEO
 */
export async function analyzeJSRendering(page: Page, url: string): Promise<JSRenderingAnalysis> {
  // Step 1: Get initial HTML (before JS execution)
  // We'll fetch the raw HTML using a new request
  let initialHTML = {
    title: null as string | null,
    description: null as string | null,
    h1: null as string | null,
    contentLength: 0,
    linksCount: 0,
    imagesCount: 0,
  };

  try {
    // Fetch raw HTML using fetch API
    const rawHTMLResponse = await fetch(url);
    const rawHTML = await rawHTMLResponse.text();

    // Parse raw HTML to extract initial content
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHTML, 'text/html');

    initialHTML = {
      title: doc.querySelector('title')?.textContent?.trim() || null,
      description: doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || null,
      h1: doc.querySelector('h1')?.textContent?.trim() || null,
      contentLength: doc.body?.textContent?.trim().length || 0,
      linksCount: doc.querySelectorAll('a[href]').length,
      imagesCount: doc.querySelectorAll('img').length,
    };
  } catch (error) {
    // If fetch fails, try to get initial state from page context
    // This is a fallback and may not represent true server HTML
    try {
      initialHTML = await page.evaluate(() => {
        // This attempts to capture the initial server-rendered state
        const title = document.querySelector('title')?.textContent?.trim() || null;
        const description = document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || null;
        const h1 = document.querySelector('h1')?.textContent?.trim() || null;

        return {
          title,
          description,
          h1,
          contentLength: 0,
          linksCount: 0,
          imagesCount: 0,
        };
      });
    } catch {
      // Keep default empty values
    }
  }

  // Step 2: Wait for page to be fully rendered with JavaScript
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
    // Continue even if networkidle times out
  });

  // Give additional time for dynamic content to render
  await page.waitForTimeout(1000);

  // Step 3: Get rendered HTML (after JS execution)
  const renderedHTML = await extractHTMLContent(page);

  // Step 4: Detect framework and SPA patterns
  const frameworkInfo = await detectFrameworkAndSPA(page);

  // Step 5: Calculate differences
  const differences = {
    titleChanged: initialHTML.title !== renderedHTML.title,
    descriptionChanged: initialHTML.description !== renderedHTML.description,
    h1Changed: initialHTML.h1 !== renderedHTML.h1,
    contentLengthDiff: renderedHTML.contentLength - initialHTML.contentLength,
    linksCountDiff: renderedHTML.linksCount - initialHTML.linksCount,
    imagesCountDiff: renderedHTML.imagesCount - initialHTML.imagesCount,
  };

  // Step 6: Detect JS-only content
  const jsOnlyContent = {
    hasJSOnlyTitle: !initialHTML.title && !!renderedHTML.title,
    hasJSOnlyDescription: !initialHTML.description && !!renderedHTML.description,
    hasJSOnlyH1: !initialHTML.h1 && !!renderedHTML.h1,
    hasJSOnlyMainContent: initialHTML.contentLength === 0 && renderedHTML.contentLength > 0,
  };

  // Step 7: Identify critical issues
  const criticalIssues: string[] = [];

  if (jsOnlyContent.hasJSOnlyTitle) {
    criticalIssues.push('Title tag is only present after JavaScript execution');
  }

  if (jsOnlyContent.hasJSOnlyDescription) {
    criticalIssues.push('Meta description is only present after JavaScript execution');
  }

  if (jsOnlyContent.hasJSOnlyH1) {
    criticalIssues.push('H1 heading is only present after JavaScript execution');
  }

  if (jsOnlyContent.hasJSOnlyMainContent) {
    criticalIssues.push('Main content is only rendered after JavaScript execution (critical for SEO)');
  }

  if (frameworkInfo.isSPA && !frameworkInfo.isSSR) {
    criticalIssues.push('Single Page Application detected without Server-Side Rendering');
  }

  if (differences.contentLengthDiff > 1000 && !frameworkInfo.isSSR) {
    criticalIssues.push(`Significant content added by JavaScript (${differences.contentLengthDiff} characters)`);
  }

  if (initialHTML.linksCount === 0 && renderedHTML.linksCount > 0) {
    criticalIssues.push('Navigation links are only available after JavaScript execution');
  }

  if (!frameworkInfo.isSSR && frameworkInfo.framework) {
    criticalIssues.push(`${frameworkInfo.framework} detected without SSR - content may not be indexed by search engines`);
  }

  // Step 8: Assess SEO impact
  let seoImpact: 'critical' | 'warning' | 'good' = 'good';

  if (
    jsOnlyContent.hasJSOnlyMainContent ||
    jsOnlyContent.hasJSOnlyTitle ||
    (frameworkInfo.isSPA && !frameworkInfo.isSSR)
  ) {
    seoImpact = 'critical';
  } else if (
    jsOnlyContent.hasJSOnlyDescription ||
    jsOnlyContent.hasJSOnlyH1 ||
    differences.contentLengthDiff > 500 ||
    criticalIssues.length > 0
  ) {
    seoImpact = 'warning';
  }

  return {
    initialHTML,
    renderedHTML,
    differences,
    criticalIssues,
    framework: frameworkInfo.framework,
    isSSR: frameworkInfo.isSSR,
    isSPA: frameworkInfo.isSPA,
    jsOnlyContent,
    seoImpact,
    hydrationDetected: frameworkInfo.hydrationDetected,
  };
}

/**
 * Calculate JavaScript rendering score (0-100)
 */
export function calculateJSRenderingScore(analysis: JSRenderingAnalysis): number {
  let score = 100;

  // Critical: main content only in JS
  if (analysis.jsOnlyContent.hasJSOnlyMainContent) {
    score -= 40;
  }

  // Critical: title only in JS
  if (analysis.jsOnlyContent.hasJSOnlyTitle) {
    score -= 40;
  }

  // Meta description in JS only
  if (analysis.jsOnlyContent.hasJSOnlyDescription) {
    score -= 20;
  }

  // H1 in JS only
  if (analysis.jsOnlyContent.hasJSOnlyH1) {
    score -= 20;
  }

  // No SSR detected for SPA/Framework
  if ((analysis.isSPA || analysis.framework) && !analysis.isSSR) {
    score -= 30;
  }

  // Minor differences in content
  if (analysis.differences.titleChanged && !analysis.jsOnlyContent.hasJSOnlyTitle) {
    score -= 10;
  }

  if (analysis.differences.descriptionChanged && !analysis.jsOnlyContent.hasJSOnlyDescription) {
    score -= 10;
  }

  if (analysis.differences.h1Changed && !analysis.jsOnlyContent.hasJSOnlyH1) {
    score -= 10;
  }

  // Significant content length difference (if not SSR)
  if (analysis.differences.contentLengthDiff > 1000 && !analysis.isSSR) {
    score -= 15;
  } else if (analysis.differences.contentLengthDiff > 500 && !analysis.isSSR) {
    score -= 10;
  }

  // Bonus: SSR detected with hydration
  if (analysis.isSSR && analysis.hydrationDetected) {
    score = Math.min(100, score + 5);
  }

  // Bonus: Content matches perfectly
  if (
    !analysis.differences.titleChanged &&
    !analysis.differences.descriptionChanged &&
    !analysis.differences.h1Changed &&
    Math.abs(analysis.differences.contentLengthDiff) < 100
  ) {
    score = 100;
  }

  return Math.max(0, Math.min(100, score));
}

export default analyzeJSRendering;
