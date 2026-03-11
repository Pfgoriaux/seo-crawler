import { Page } from 'playwright';
import { DocumentStructure, HeadingInfo, ImageInfo } from '../types';
import { isSeoFriendlyUrl } from '../utils/helpers';

/**
 * Analyze document structure
 */
export async function analyzeDocumentStructure(
  page: Page,
  url: string
): Promise<DocumentStructure> {
  const structure = await page.evaluate(() => {
    // Get doctype
    const doctype = document.doctype;
    const doctypeString = doctype
      ? `<!DOCTYPE ${doctype.name}${doctype.publicId ? ` PUBLIC "${doctype.publicId}"` : ''}${doctype.systemId ? ` "${doctype.systemId}"` : ''}>`
      : null;

    // Check if doctype is HTML5
    const hasValidDoctype = doctype?.name?.toLowerCase() === 'html' && !doctype.publicId;

    // Get all headings
    const headings: HeadingInfo[] = [];
    for (let i = 1; i <= 6; i++) {
      const elements = document.querySelectorAll(`h${i}`);
      elements.forEach((el: Element) => {
        headings.push({
          level: i,
          text: el.textContent?.trim().substring(0, 100) || '',
        });
      });
    }

    // Check heading hierarchy
    let headingHierarchyValid = true;
    let lastLevel = 0;
    for (const heading of headings) {
      if (heading.level > lastLevel + 1 && lastLevel !== 0) {
        headingHierarchyValid = false;
        break;
      }
      lastLevel = heading.level;
    }

    // Count H1 tags
    const h1Count = document.querySelectorAll('h1').length;

    // Get all images
    const imageElements = document.querySelectorAll('img');
    const images: ImageInfo[] = Array.from(imageElements).map((img: HTMLImageElement) => ({
      src: img.src || img.getAttribute('data-src') || '',
      alt: img.alt || null,
      width: img.width || null,
      height: img.height || null,
      loading: img.loading || null,
    }));

    // Count images without alt
    const imagesWithoutAlt = images.filter(
      (img) => !img.alt || img.alt.trim() === ''
    ).length;

    return {
      doctype: doctypeString,
      hasValidDoctype,
      headings,
      headingHierarchyValid,
      h1Count,
      images,
      imagesWithoutAlt,
      totalImages: images.length,
    };
  });

  // Check if URL is SEO friendly
  const urlSeoFriendly = isSeoFriendlyUrl(url);

  return {
    ...structure,
    urlSeoFriendly,
  };
}

/**
 * Calculate document structure score
 */
export function calculateDocumentStructureScore(structure: DocumentStructure): number {
  let score = 100;

  // Doctype check
  if (!structure.hasValidDoctype) {
    score -= 10;
  }

  // H1 check - should have exactly one
  if (structure.h1Count === 0) {
    score -= 20;
  } else if (structure.h1Count > 1) {
    score -= 10;
  }

  // Heading hierarchy check
  if (!structure.headingHierarchyValid) {
    score -= 15;
  }

  // Images without alt check
  if (structure.totalImages > 0) {
    const altMissingPercent = (structure.imagesWithoutAlt / structure.totalImages) * 100;
    if (altMissingPercent > 50) {
      score -= 20;
    } else if (altMissingPercent > 25) {
      score -= 10;
    } else if (structure.imagesWithoutAlt > 0) {
      score -= 5;
    }
  }

  // URL friendliness check
  if (!structure.urlSeoFriendly) {
    score -= 10;
  }

  return Math.max(0, score);
}

export default analyzeDocumentStructure;
