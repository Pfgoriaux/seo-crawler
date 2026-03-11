import { Page } from 'playwright';
import { CoreWebVitals } from '../types';

/**
 * Analyze Core Web Vitals using the Performance API
 */
export async function analyzeCoreWebVitals(page: Page): Promise<CoreWebVitals> {
  const metrics = await page.evaluate(() => {
    return new Promise<{
      lcp: number | null;
      fid: number | null;
      cls: number | null;
      ttfb: number | null;
      fcp: number | null;
      si: number | null;
      tti: number | null;
    }>((resolve) => {
      const result = {
        lcp: null as number | null,
        fid: null as number | null,
        cls: null as number | null,
        ttfb: null as number | null,
        fcp: null as number | null,
        si: null as number | null,
        tti: null as number | null,
      };

      // Get navigation timing metrics
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const navEntries = (performance as any).getEntriesByType('navigation');
      const navTiming = navEntries[0] as PerformanceResourceTiming;
      if (navTiming) {
        result.ttfb = navTiming.responseStart - navTiming.requestStart;
      }

      // Get paint timing metrics
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const paintEntries = (performance as any).getEntriesByType('paint');
      for (const entry of paintEntries) {
        if (entry.name === 'first-contentful-paint') {
          result.fcp = entry.startTime;
        }
      }

      // Observe LCP
      let lcpValue: number | null = null;
      try {
        const lcpObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const lastEntry = entries[entries.length - 1];
          if (lastEntry) {
            lcpValue = lastEntry.startTime;
          }
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true } as any);

        // Get already recorded LCP entries
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lcpEntries = (performance as any).getEntriesByType('largest-contentful-paint');
        if (lcpEntries.length > 0) {
          lcpValue = lcpEntries[lcpEntries.length - 1].startTime;
        }
      } catch {
        // LCP not supported
      }

      // Observe CLS
      let clsValue = 0;
      try {
        const clsObserver = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (!(entry as any).hadRecentInput) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              clsValue += (entry as any).value;
            }
          }
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        clsObserver.observe({ type: 'layout-shift', buffered: true } as any);
      } catch {
        // CLS not supported
      }

      // FID can only be measured with real user interaction
      // For synthetic testing, we'll use TBT (Total Blocking Time) as a proxy
      // or leave it null

      // Wait a bit for observers to collect data
      setTimeout(() => {
        result.lcp = lcpValue;
        result.cls = clsValue;
        resolve(result);
      }, 1000);
    });
  });

  return metrics;
}

/**
 * Calculate Core Web Vitals scores
 */
export function calculateCwvScore(vitals: CoreWebVitals): number {
  let score = 100;
  let factors = 0;

  // LCP scoring (target: < 2.5s, poor: > 4s)
  if (vitals.lcp !== null) {
    factors++;
    if (vitals.lcp > 4000) {
      score -= 33;
    } else if (vitals.lcp > 2500) {
      score -= 16;
    }
  }

  // FID scoring (target: < 100ms, poor: > 300ms)
  if (vitals.fid !== null) {
    factors++;
    if (vitals.fid > 300) {
      score -= 33;
    } else if (vitals.fid > 100) {
      score -= 16;
    }
  }

  // CLS scoring (target: < 0.1, poor: > 0.25)
  if (vitals.cls !== null) {
    factors++;
    if (vitals.cls > 0.25) {
      score -= 33;
    } else if (vitals.cls > 0.1) {
      score -= 16;
    }
  }

  // If no metrics available, return 50 (unknown)
  if (factors === 0) {
    return 50;
  }

  return Math.max(0, score);
}

export default analyzeCoreWebVitals;
