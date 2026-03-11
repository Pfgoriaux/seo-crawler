import { Page } from 'playwright';
import readability from 'text-readability';

/**
 * Readability metrics interface
 */
export interface ReadabilityMetrics {
  // Text content stats
  wordCount: number;
  sentenceCount: number;
  averageSentenceLength: number;
  averageSyllablesPerWord: number;

  // Readability scores
  fleschKincaidGrade: number;
  fleschReadingEase: number;
  smogIndex: number;
  colemanLiauIndex: number;
  automatedReadabilityIndex: number;

  // Reading level assessment
  readingLevel: 'elementary' | 'middle-school' | 'high-school' | 'college' | 'graduate';
  readingLevelDescription: string;

  // Text sample
  textContent: string;
}

/**
 * Analyze readability of page content
 */
export async function analyzeReadability(page: Page): Promise<ReadabilityMetrics> {
  // Extract text content from the page with proper spacing between elements
  const textContent = await page.evaluate(() => {
    // Remove script, style, nav, footer, header elements
    const elementsToExclude = [
      'script',
      'style',
      'nav',
      'footer',
      'header',
      'noscript',
      'svg',
      'iframe',
      'aside',
    ];

    // Block-level elements that should have spacing around them
    const blockElements = new Set([
      'address', 'article', 'aside', 'blockquote', 'br', 'canvas', 'dd', 'div',
      'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main',
      'nav', 'noscript', 'ol', 'p', 'pre', 'section', 'table', 'tfoot',
      'ul', 'video', 'tr', 'td', 'th',
    ]);

    // Elements that should be treated as sentence-ending (headings, list items)
    // This helps readability analysis when content is mostly headlines without punctuation
    const sentenceEndingElements = new Set([
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'p', 'figcaption', 'caption', 'dt', 'dd',
    ]);

    // Clone the body to avoid modifying the actual page
    const bodyClone = document.body.cloneNode(true) as HTMLElement;

    // Remove excluded elements
    elementsToExclude.forEach((tag) => {
      const elements = bodyClone.querySelectorAll(tag);
      elements.forEach((el) => el.remove());
    });

    // Recursive function to extract text with proper spacing
    function extractTextWithSpacing(element: Node): string {
      if (element.nodeType === Node.TEXT_NODE) {
        return element.textContent || '';
      }

      if (element.nodeType !== Node.ELEMENT_NODE) {
        return '';
      }

      const el = element as Element;
      const tagName = el.tagName?.toLowerCase() || '';

      // Skip hidden elements
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return '';
      }

      let text = '';
      const isBlock = blockElements.has(tagName);

      // Add space before block elements
      if (isBlock) {
        text += ' ';
      }

      // Process child nodes
      for (const child of Array.from(element.childNodes)) {
        text += extractTextWithSpacing(child);
      }

      // Add space after block elements
      if (isBlock) {
        text += ' ';
      }

      // Add implicit period after headings/list items if they don't end with punctuation
      // This helps readability analysis for headline-heavy pages
      const isSentenceEnding = sentenceEndingElements.has(tagName);
      if (isSentenceEnding && text.trim().length > 0) {
        const trimmedText = text.trim();
        const lastChar = trimmedText.charAt(trimmedText.length - 1);
        if (!'.!?:;'.includes(lastChar)) {
          text = text.trimEnd() + '. ';
        }
      }

      return text;
    }

    const text = extractTextWithSpacing(bodyClone);

    // Clean up whitespace
    return text
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
  });

  // Handle empty content
  if (!textContent || textContent.length < 100) {
    return {
      wordCount: 0,
      sentenceCount: 0,
      averageSentenceLength: 0,
      averageSyllablesPerWord: 0,
      fleschKincaidGrade: 0,
      fleschReadingEase: 0,
      smogIndex: 0,
      colemanLiauIndex: 0,
      automatedReadabilityIndex: 0,
      readingLevel: 'elementary',
      readingLevelDescription: 'No content to analyze',
      textContent: '',
    };
  }

  // Calculate word and sentence counts
  const wordCount = readability.lexiconCount(textContent, true); // true = remove punctuation
  const sentCount = readability.sentenceCount(textContent);

  // Calculate averages
  const averageSentenceLength = sentCount > 0 ? wordCount / sentCount : 0;
  const totalSyllables = readability.syllableCount(textContent);
  const averageSyllablesPerWord = wordCount > 0 ? totalSyllables / wordCount : 0;

  // Calculate readability scores
  const fkGrade = readability.fleschKincaidGrade(textContent);
  const freScore = readability.fleschReadingEase(textContent);
  const smog = readability.smogIndex(textContent);
  const colemanLiau = readability.colemanLiauIndex(textContent);
  const ari = readability.automatedReadabilityIndex(textContent);

  // Determine reading level based on Flesch-Kincaid Grade
  const readingLevelData = determineReadingLevel(fkGrade);

  return {
    wordCount,
    sentenceCount: sentCount,
    averageSentenceLength: Math.round(averageSentenceLength * 10) / 10,
    averageSyllablesPerWord: Math.round(averageSyllablesPerWord * 100) / 100,
    fleschKincaidGrade: Math.round(fkGrade * 10) / 10,
    fleschReadingEase: Math.round(freScore * 10) / 10,
    smogIndex: Math.round(smog * 10) / 10,
    colemanLiauIndex: Math.round(colemanLiau * 10) / 10,
    automatedReadabilityIndex: Math.round(ari * 10) / 10,
    readingLevel: readingLevelData.level,
    readingLevelDescription: readingLevelData.description,
    textContent: textContent.substring(0, 500), // Store first 500 chars as sample
  };
}

/**
 * Determine reading level based on grade level
 */
function determineReadingLevel(gradeLevel: number): {
  level: 'elementary' | 'middle-school' | 'high-school' | 'college' | 'graduate';
  description: string;
} {
  if (gradeLevel < 6) {
    return {
      level: 'elementary',
      description: `Grade ${Math.round(gradeLevel)} (Elementary School)`,
    };
  } else if (gradeLevel < 9) {
    return {
      level: 'middle-school',
      description: `Grade ${Math.round(gradeLevel)} (Middle School)`,
    };
  } else if (gradeLevel < 13) {
    return {
      level: 'high-school',
      description: `Grade ${Math.round(gradeLevel)} (High School)`,
    };
  } else if (gradeLevel < 16) {
    return {
      level: 'college',
      description: `Grade ${Math.round(gradeLevel)} (College)`,
    };
  } else {
    return {
      level: 'graduate',
      description: `Grade ${Math.round(gradeLevel)}+ (Graduate School)`,
    };
  }
}

/**
 * Calculate readability score (0-100)
 *
 * Ideal web readability is 8th-10th grade level (Flesch-Kincaid Grade: 8-10)
 * This corresponds to Flesch Reading Ease of 60-70
 *
 * Scoring criteria:
 * - Perfect score (100): Grade level 8-10, Reading Ease 60-70
 * - Good score (80-99): Grade level 6-12, Reading Ease 50-80
 * - Acceptable (60-79): Grade level 5-13, Reading Ease 40-90
 * - Poor (0-59): Too complex (>13) or too simple (<5)
 */
export function calculateReadabilityScore(metrics: ReadabilityMetrics): number {
  // Handle no content case
  if (metrics.wordCount === 0) {
    return 0;
  }

  let score = 100;
  const gradeLevel = metrics.fleschKincaidGrade;
  const readingEase = metrics.fleschReadingEase;

  // Grade level scoring (40 points max)
  if (gradeLevel >= 8 && gradeLevel <= 10) {
    // Ideal range - full points
    score += 0;
  } else if (gradeLevel >= 6 && gradeLevel <= 12) {
    // Good range - minor penalty
    const deviation = Math.min(Math.abs(gradeLevel - 9), 3);
    score -= deviation * 3; // -3 to -9 points
  } else if (gradeLevel >= 5 && gradeLevel <= 13) {
    // Acceptable range - moderate penalty
    const deviation = Math.abs(gradeLevel - 9);
    score -= deviation * 5; // -20 to -25 points
  } else {
    // Poor range - major penalty
    if (gradeLevel < 5) {
      // Too simple
      score -= 30 + (5 - gradeLevel) * 5; // -30 to -50 points
    } else {
      // Too complex (>13)
      score -= 30 + (gradeLevel - 13) * 3; // -30+ points
    }
  }

  // Flesch Reading Ease scoring (30 points max)
  if (readingEase >= 60 && readingEase <= 70) {
    // Ideal range - full points
    score += 0;
  } else if (readingEase >= 50 && readingEase <= 80) {
    // Good range - minor penalty
    const deviation = Math.abs(readingEase - 65);
    score -= deviation * 0.3; // -0 to -4.5 points
  } else if (readingEase >= 40 && readingEase <= 90) {
    // Acceptable range - moderate penalty
    const deviation = Math.abs(readingEase - 65);
    score -= deviation * 0.5; // -0 to -12.5 points
  } else {
    // Poor range - major penalty
    if (readingEase < 40) {
      // Too difficult
      score -= 15 + (40 - readingEase) * 0.5; // -15+ points
    } else {
      // Too easy (>90)
      score -= 15 + (readingEase - 90) * 0.3; // -15+ points
    }
  }

  // Sentence length penalty (15 points max)
  const avgSentenceLength = metrics.averageSentenceLength;
  if (avgSentenceLength > 25) {
    // Too long - harder to read
    score -= Math.min((avgSentenceLength - 25) * 0.5, 15);
  } else if (avgSentenceLength < 8) {
    // Too short - choppy
    score -= Math.min((8 - avgSentenceLength) * 1, 10);
  }

  // Syllables per word penalty (15 points max)
  const avgSyllables = metrics.averageSyllablesPerWord;
  if (avgSyllables > 1.7) {
    // Too many syllables - complex words
    score -= Math.min((avgSyllables - 1.7) * 10, 15);
  } else if (avgSyllables < 1.3) {
    // Too few syllables - overly simple
    score -= Math.min((1.3 - avgSyllables) * 10, 10);
  }

  // Ensure score is within 0-100 range
  return Math.max(0, Math.min(100, Math.round(score)));
}

export default analyzeReadability;
