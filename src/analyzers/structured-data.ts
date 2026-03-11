import { Page } from 'playwright';
import { StructuredData, JsonLdData, MicrodataItem } from '../types';

/**
 * Analyze structured data on a page
 */
export async function analyzeStructuredData(page: Page): Promise<StructuredData> {
  const analysis = await page.evaluate(() => {
    const jsonLd: {
      type: string;
      data: Record<string, unknown>;
      valid: boolean;
      errors: string[];
    }[] = [];

    // Parse JSON-LD scripts
    const jsonLdScripts = document.querySelectorAll(
      'script[type="application/ld+json"]'
    );

    jsonLdScripts.forEach((script: Element) => {
      try {
        const content = script.textContent || '';
        const data = JSON.parse(content);
        const errors: string[] = [];

        // Handle arrays of JSON-LD objects
        const items = Array.isArray(data) ? data : [data];

        items.forEach((item) => {
          const type = item['@type'] || 'Unknown';

          // Basic validation
          if (!item['@context']) {
            errors.push('Missing @context');
          }
          if (!item['@type']) {
            errors.push('Missing @type');
          }

          jsonLd.push({
            type: Array.isArray(type) ? type.join(', ') : type,
            data: item,
            valid: errors.length === 0,
            errors,
          });
        });
      } catch (e) {
        jsonLd.push({
          type: 'ParseError',
          data: {},
          valid: false,
          errors: ['Invalid JSON: ' + (e as Error).message],
        });
      }
    });

    // Parse Microdata
    const microdata: { type: string; properties: Record<string, string> }[] = [];
    const microdataElements = document.querySelectorAll('[itemscope]');

    microdataElements.forEach((el: Element) => {
      const itemType = el.getAttribute('itemtype') || 'Unknown';
      const properties: Record<string, string> = {};

      // Get immediate itemprop children
      const props = el.querySelectorAll('[itemprop]');
      props.forEach((prop: Element) => {
        const name = prop.getAttribute('itemprop') || '';
        let value = '';

        // Get value based on element type
        if (prop.tagName === 'META') {
          value = prop.getAttribute('content') || '';
        } else if (prop.tagName === 'LINK') {
          value = prop.getAttribute('href') || '';
        } else if (prop.tagName === 'IMG') {
          value = prop.getAttribute('src') || '';
        } else if (prop.tagName === 'TIME') {
          value = prop.getAttribute('datetime') || prop.textContent || '';
        } else {
          value = prop.textContent?.trim().substring(0, 100) || '';
        }

        if (name && value) {
          properties[name] = value;
        }
      });

      microdata.push({
        type: itemType,
        properties,
      });
    });

    return { jsonLd, microdata };
  });

  // Extract schema types
  const schemaTypes = [
    ...new Set([
      ...analysis.jsonLd.map((item) => item.type),
      ...analysis.microdata.map((item) => item.type),
    ]),
  ].filter((type) => type !== 'Unknown' && type !== 'ParseError');

  return {
    jsonLd: analysis.jsonLd,
    microdata: analysis.microdata,
    hasStructuredData:
      analysis.jsonLd.length > 0 || analysis.microdata.length > 0,
    schemaTypes,
  };
}

/**
 * Calculate structured data score
 */
export function calculateStructuredDataScore(
  structuredData: StructuredData
): number {
  let score = 50; // Start at 50 since structured data is optional

  // Bonus for having structured data
  if (structuredData.hasStructuredData) {
    score += 30;
  }

  // Bonus for having valid JSON-LD
  const validJsonLd = structuredData.jsonLd.filter((item) => item.valid);
  if (validJsonLd.length > 0) {
    score += 10;
  }

  // Penalty for invalid structured data
  const invalidJsonLd = structuredData.jsonLd.filter((item) => !item.valid);
  if (invalidJsonLd.length > 0) {
    score -= invalidJsonLd.length * 10;
  }

  // Bonus for common schema types
  const importantTypes = [
    'Organization',
    'WebSite',
    'WebPage',
    'Article',
    'Product',
    'LocalBusiness',
    'BreadcrumbList',
    'FAQPage',
    'HowTo',
  ];

  const hasImportantType = structuredData.schemaTypes.some((type) =>
    importantTypes.some(
      (important) =>
        type.toLowerCase().includes(important.toLowerCase()) ||
        type.includes(`schema.org/${important}`)
    )
  );

  if (hasImportantType) {
    score += 10;
  }

  return Math.min(100, Math.max(0, score));
}

export default analyzeStructuredData;
