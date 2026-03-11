import { Page } from 'playwright';
import { MobileFriendliness } from '../types';

/**
 * Analyze mobile friendliness
 */
export async function analyzeMobileFriendliness(page: Page): Promise<MobileFriendliness> {
  const analysis = await page.evaluate(() => {
    // Check viewport meta tag
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    const hasViewportMeta = !!viewportMeta;
    const viewportContent = viewportMeta?.getAttribute('content') || null;

    // Check for small text elements
    let smallTextElements = 0;
    const textElements = document.querySelectorAll(
      'p, span, a, li, td, th, label, input, button, div'
    );
    textElements.forEach((el: Element) => {
      const style = window.getComputedStyle(el);
      const fontSize = parseFloat(style.fontSize);
      if (fontSize < 12 && el.textContent?.trim()) {
        smallTextElements++;
      }
    });

    // Check for small tap targets
    let smallTapTargets = 0;
    const interactiveElements = document.querySelectorAll(
      'a, button, input, select, textarea, [role="button"], [onclick]'
    );
    interactiveElements.forEach((el: Element) => {
      const rect = el.getBoundingClientRect();
      // Tap targets should be at least 48x48 pixels
      if (rect.width < 48 || rect.height < 48) {
        smallTapTargets++;
      }
    });

    // Check for deprecated plugins
    const pluginElements: string[] = [];
    const plugins = document.querySelectorAll('embed, object, applet');
    plugins.forEach((el: Element) => {
      const type = el.getAttribute('type') || '';
      const deprecatedTypes = [
        'application/x-java-applet',
        'application/x-java-bean',
        'application/x-shockwave-flash',
        'application/x-silverlight',
        'application/x-silverlight-2',
      ];
      if (deprecatedTypes.some((t) => type.includes(t))) {
        pluginElements.push(el.tagName.toLowerCase());
      }
    });

    // Also check for Flash embeds
    const flashEmbeds = document.querySelectorAll(
      '[src*=".swf"], [data*=".swf"]'
    );
    flashEmbeds.forEach(() => {
      pluginElements.push('flash');
    });

    return {
      hasViewportMeta,
      viewportContent,
      smallTextElements,
      smallTapTargets,
      hasPlugins: pluginElements.length > 0,
      pluginElements,
    };
  });

  return analysis;
}

/**
 * Calculate mobile friendliness score
 */
export function calculateMobileFriendlinessScore(
  mobileFriendliness: MobileFriendliness
): number {
  let score = 100;

  // Viewport meta tag check
  if (!mobileFriendliness.hasViewportMeta) {
    score -= 30;
  } else if (mobileFriendliness.viewportContent) {
    // Check if viewport has proper settings
    const content = mobileFriendliness.viewportContent.toLowerCase();
    if (!content.includes('width=device-width')) {
      score -= 15;
    }
    if (content.includes('user-scalable=no') || content.includes('maximum-scale=1')) {
      score -= 10; // Disabling zoom is bad for accessibility
    }
  }

  // Small text elements penalty
  if (mobileFriendliness.smallTextElements > 20) {
    score -= 20;
  } else if (mobileFriendliness.smallTextElements > 10) {
    score -= 10;
  } else if (mobileFriendliness.smallTextElements > 0) {
    score -= 5;
  }

  // Small tap targets penalty
  if (mobileFriendliness.smallTapTargets > 20) {
    score -= 20;
  } else if (mobileFriendliness.smallTapTargets > 10) {
    score -= 10;
  } else if (mobileFriendliness.smallTapTargets > 0) {
    score -= 5;
  }

  // Plugin penalty
  if (mobileFriendliness.hasPlugins) {
    score -= 20;
  }

  return Math.max(0, score);
}

export default analyzeMobileFriendliness;
