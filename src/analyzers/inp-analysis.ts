import { Page } from 'playwright';

export interface INPAnalysis {
  estimatedINP: number | null;
  inpRating: 'good' | 'needs-improvement' | 'poor' | 'unknown';
  longTasks: {
    count: number;
    totalDuration: number;
  };
  interactiveElements: number;
  heavyEventHandlers: boolean;
  mainThreadBlocking: number;
  potentialBottlenecks: string[];
}

/**
 * Analyze Interaction to Next Paint (INP)
 *
 * Note: True INP requires real user interactions. In a crawler context, we:
 * - Estimate based on Long Tasks and main thread blocking
 * - Analyze JS execution patterns
 * - Check for heavy event handlers
 * - Simulate basic interactions where possible
 */
export async function analyzeINP(page: Page): Promise<INPAnalysis> {
  const potentialBottlenecks: string[] = [];

  // Measure Long Tasks and main thread blocking
  const performanceData = await page.evaluate(() => {
    return new Promise<{
      longTasks: { count: number; totalDuration: number };
      interactiveElements: number;
      heavyEventHandlers: boolean;
      estimatedINP: number | null;
      mainThreadBlocking: number;
    }>((resolve) => {
      const result = {
        longTasks: { count: 0, totalDuration: 0 },
        interactiveElements: 0,
        heavyEventHandlers: false,
        estimatedINP: null as number | null,
        mainThreadBlocking: 0,
      };

      // Count interactive elements
      const interactiveSelectors = [
        'button',
        'a[href]',
        'input',
        'select',
        'textarea',
        '[onclick]',
        '[role="button"]',
        '[role="link"]',
        '[tabindex]:not([tabindex="-1"])',
      ];

      const interactiveElements = new Set<Element>();
      interactiveSelectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((el) => interactiveElements.add(el));
      });
      result.interactiveElements = interactiveElements.size;

      // Check for heavy event handlers (elements with onclick or event listeners)
      const elementsWithHandlers = document.querySelectorAll('[onclick]');
      result.heavyEventHandlers = elementsWithHandlers.length > 20;

      // Observe Long Tasks
      try {
        const longTaskObserver = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            result.longTasks.count++;
            result.longTasks.totalDuration += entry.duration;

            // Tasks over 50ms block the main thread
            if (entry.duration > 50) {
              result.mainThreadBlocking += entry.duration - 50;
            }
          }
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        longTaskObserver.observe({ type: 'longtask', buffered: true } as any);

        // Get already recorded long tasks
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const longTaskEntries = (performance as any).getEntriesByType('longtask');
        for (const entry of longTaskEntries) {
          result.longTasks.count++;
          result.longTasks.totalDuration += entry.duration;

          if (entry.duration > 50) {
            result.mainThreadBlocking += entry.duration - 50;
          }
        }
      } catch {
        // Long task observation not supported
      }

      // Try to get event timing entries (for actual interactions if any occurred)
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const eventEntries = (performance as any).getEntriesByType('event');
        const interactionDurations: number[] = [];

        for (const entry of eventEntries) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const duration = (entry as any).duration || 0;
          if (duration > 0) {
            interactionDurations.push(duration);
          }
        }

        // If we have interaction data, calculate 98th percentile
        if (interactionDurations.length > 0) {
          interactionDurations.sort((a, b) => a - b);
          const index = Math.ceil(interactionDurations.length * 0.98) - 1;
          result.estimatedINP = interactionDurations[index];
        }
      } catch {
        // Event timing not supported
      }

      // Wait for observers to collect data
      setTimeout(() => {
        resolve(result);
      }, 1500);
    });
  });

  // Estimate INP based on Long Tasks if we don't have real interaction data
  let estimatedINP = performanceData.estimatedINP;

  if (estimatedINP === null && performanceData.longTasks.count > 0) {
    // Rough estimation: Average long task duration is a proxy for potential interaction delay
    const avgLongTaskDuration = performanceData.longTasks.totalDuration / performanceData.longTasks.count;

    // Estimate INP as slightly higher than average long task duration
    // since interactions often queue behind long tasks
    estimatedINP = avgLongTaskDuration * 1.5;

    potentialBottlenecks.push(
      `Estimated INP based on ${performanceData.longTasks.count} long tasks detected`
    );
  }

  // Analyze main thread blocking
  if (performanceData.mainThreadBlocking > 1000) {
    potentialBottlenecks.push(
      `High main thread blocking: ${Math.round(performanceData.mainThreadBlocking)}ms`
    );
  }

  // Check for heavy event handlers
  if (performanceData.heavyEventHandlers) {
    potentialBottlenecks.push('Many elements with inline event handlers detected');
  }

  // Analyze long tasks
  if (performanceData.longTasks.count > 10) {
    potentialBottlenecks.push(
      `${performanceData.longTasks.count} long tasks detected (>50ms each)`
    );
  }

  if (performanceData.longTasks.totalDuration > 2000) {
    potentialBottlenecks.push(
      `Total long task duration: ${Math.round(performanceData.longTasks.totalDuration)}ms`
    );
  }

  // Check interactive element count
  if (performanceData.interactiveElements > 100) {
    potentialBottlenecks.push(
      `${performanceData.interactiveElements} interactive elements may impact responsiveness`
    );
  }

  // Simulate a simple interaction to measure responsiveness
  try {
    const simulatedInteraction = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        const startTime = performance.now();
        const button = document.querySelector('button, a[href], input');

        if (button) {
          // Simulate click without actually triggering it
          const event = new MouseEvent('click', { bubbles: true, cancelable: true });

          // Measure time to process event
          requestAnimationFrame(() => {
            const endTime = performance.now();
            resolve(endTime - startTime);
          });

          // Don't actually dispatch to avoid side effects
          // button.dispatchEvent(event);
        } else {
          resolve(0);
        }
      });
    });

    if (simulatedInteraction > 100) {
      potentialBottlenecks.push(
        `Simulated interaction delay: ${Math.round(simulatedInteraction)}ms`
      );
    }
  } catch {
    // Interaction simulation failed - not critical
  }

  // Determine INP rating based on thresholds
  let inpRating: 'good' | 'needs-improvement' | 'poor' | 'unknown' = 'unknown';

  if (estimatedINP !== null) {
    if (estimatedINP < 200) {
      inpRating = 'good';
    } else if (estimatedINP <= 500) {
      inpRating = 'needs-improvement';
    } else {
      inpRating = 'poor';
    }
  }

  // Add general recommendations
  if (estimatedINP === null && performanceData.longTasks.count === 0) {
    potentialBottlenecks.push('No long tasks detected - good for responsiveness');
  }

  if (performanceData.interactiveElements === 0) {
    potentialBottlenecks.push('No interactive elements detected');
  }

  return {
    estimatedINP,
    inpRating,
    longTasks: performanceData.longTasks,
    interactiveElements: performanceData.interactiveElements,
    heavyEventHandlers: performanceData.heavyEventHandlers,
    mainThreadBlocking: Math.round(performanceData.mainThreadBlocking),
    potentialBottlenecks,
  };
}

/**
 * Calculate INP score (0-100)
 *
 * INP thresholds:
 * - Good: < 200ms (100 points)
 * - Needs improvement: 200-500ms (50-80 points)
 * - Poor: > 500ms (0-50 points)
 */
export function calculateINPScore(analysis: INPAnalysis): number {
  // If we can't estimate INP, base score on other factors
  if (analysis.estimatedINP === null) {
    let score = 70; // Default score when unknown

    // Adjust based on long tasks
    if (analysis.longTasks.count === 0) {
      score = 85; // Good sign
    } else if (analysis.longTasks.count > 20) {
      score -= 15;
    } else if (analysis.longTasks.count > 10) {
      score -= 10;
    }

    // Adjust for main thread blocking
    if (analysis.mainThreadBlocking > 2000) {
      score -= 20;
    } else if (analysis.mainThreadBlocking > 1000) {
      score -= 10;
    }

    // Adjust for heavy event handlers
    if (analysis.heavyEventHandlers) {
      score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  // Score based on estimated INP
  const inp = analysis.estimatedINP;

  if (inp < 200) {
    // Good: 100 points, linear decrease from 200ms to 0ms
    return 100;
  } else if (inp <= 500) {
    // Needs improvement: 50-80 points
    // Linear interpolation between 200ms (80 points) and 500ms (50 points)
    const ratio = (inp - 200) / (500 - 200);
    return Math.round(80 - ratio * 30);
  } else {
    // Poor: 0-50 points
    // Linear decrease from 500ms (50 points) to 1000ms (0 points)
    const ratio = Math.min((inp - 500) / 500, 1);
    return Math.round(50 - ratio * 50);
  }
}

export default analyzeINP;
