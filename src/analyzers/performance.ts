import { Page } from 'playwright';
import { PerformanceMetrics, ResourceCount, CacheAnalysis, ResourceDetail } from '../types';
import { NetworkData } from '../crawler/page-crawler';

/**
 * Analyze page performance
 */
export async function analyzePerformance(
  page: Page,
  networkData: NetworkData
): Promise<PerformanceMetrics> {
  // Categorize resources by type
  const resourceCount: ResourceCount = {
    total: networkData.resources.length,
    scripts: 0,
    stylesheets: 0,
    images: 0,
    fonts: 0,
    other: 0,
  };

  let totalSize = 0;
  let compressedCount = 0;
  let cachedCount = 0;

  for (const resource of networkData.resources) {
    totalSize += resource.size;

    if (resource.compressed) {
      compressedCount++;
    }
    if (resource.cached) {
      cachedCount++;
    }

    switch (resource.type) {
      case 'script':
        resourceCount.scripts++;
        break;
      case 'stylesheet':
        resourceCount.stylesheets++;
        break;
      case 'image':
        resourceCount.images++;
        break;
      case 'font':
        resourceCount.fonts++;
        break;
      default:
        resourceCount.other++;
    }
  }

  // Check compression from response headers
  const contentEncoding = networkData.responseHeaders['content-encoding'] || '';
  const compressionEnabled =
    contentEncoding.includes('gzip') ||
    contentEncoding.includes('br') ||
    contentEncoding.includes('deflate');

  // Analyze cache headers
  const cacheControl = networkData.responseHeaders['cache-control'] || '';
  const expires = networkData.responseHeaders['expires'] || '';

  const cacheHeaders: CacheAnalysis = {
    hasCacheControl: cacheControl.length > 0,
    hasExpires: expires.length > 0,
    cacheableResources: cachedCount,
    nonCacheableResources: networkData.resources.length - cachedCount,
  };

  return {
    totalResourceSize: totalSize,
    resourceCount,
    compressionEnabled,
    cacheHeaders,
    resourceDetails: networkData.resources,
  };
}

/**
 * Calculate performance score
 */
export function calculatePerformanceScore(performance: PerformanceMetrics): number {
  let score = 100;

  // Total page size check
  const sizeMB = performance.totalResourceSize / (1024 * 1024);
  if (sizeMB > 5) {
    score -= 30;
  } else if (sizeMB > 3) {
    score -= 20;
  } else if (sizeMB > 1) {
    score -= 10;
  }

  // Too many requests
  if (performance.resourceCount.total > 100) {
    score -= 20;
  } else if (performance.resourceCount.total > 50) {
    score -= 10;
  }

  // Compression check
  if (!performance.compressionEnabled) {
    score -= 15;
  }

  // Cache headers check
  if (!performance.cacheHeaders.hasCacheControl && !performance.cacheHeaders.hasExpires) {
    score -= 10;
  }

  // Too many scripts
  if (performance.resourceCount.scripts > 20) {
    score -= 10;
  }

  return Math.max(0, score);
}

export default analyzePerformance;
