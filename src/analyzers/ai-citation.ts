import { Page } from 'playwright';

export interface AICitationAnalysis {
  questionAnswerPairs: number;
  hasDirectAnswer: boolean;
  hasFAQSection: boolean;
  definitionCount: number;
  avgParagraphLength: number;
  avgSentenceLength: number;
  hasSummarySection: boolean;
  listAndTableCount: number;
  entityClarity: {
    mainTopicMentions: number;
    consistentTerminology: boolean;
  };
  uniqueDataPoints: number;
  conversationalScore: number;
  citationWorthiness: 'high' | 'medium' | 'low';
}

/**
 * Analyze AI Citation Potential
 */
export async function analyzeAICitation(page: Page): Promise<AICitationAnalysis> {
  const analysis = await page.evaluate(() => {
    // Helper function to check if text is a question
    const isQuestion = (text: string): boolean => {
      const questionWords = ['who', 'what', 'when', 'where', 'why', 'how', 'which', 'whose', 'whom'];
      const cleanText = text.toLowerCase().trim();
      return (
        cleanText.endsWith('?') ||
        questionWords.some(word => cleanText.startsWith(word + ' '))
      );
    };

    // Helper function to check if text is a definition pattern
    const isDefinition = (text: string): boolean => {
      const definitionPatterns = [
        /^\w+\s+is\s+/i,
        /^\w+\s+are\s+/i,
        /^\w+\s+refers to\s+/i,
        /^\w+\s+means\s+/i,
        /^\w+\s+can be defined as\s+/i,
      ];
      return definitionPatterns.some(pattern => pattern.test(text.trim()));
    };

    // Helper function to extract sentences
    const extractSentences = (text: string): string[] => {
      // Split on sentence-ending punctuation followed by space and capital letter
      return text
        .split(/[.!?]+\s+(?=[A-Z])/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
    };

    // 1. Question-Answer Format Detection
    let questionAnswerPairs = 0;
    let hasFAQSection = false;
    let definitionCount = 0;

    // Check for FAQ sections
    const faqPatterns = ['faq', 'frequently asked questions', 'q&a', 'questions and answers'];
    const allText = document.body.textContent?.toLowerCase() || '';
    hasFAQSection = faqPatterns.some(pattern => allText.includes(pattern));

    // Analyze headings for questions
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    headings.forEach((heading, index) => {
      const headingText = heading.textContent?.trim() || '';

      if (isQuestion(headingText)) {
        // Check if next element after heading contains a concise answer
        let nextElement = heading.nextElementSibling;
        if (nextElement) {
          const answerText = nextElement.textContent?.trim() || '';
          const wordCount = answerText.split(/\s+/).length;
          // Consider it a Q&A pair if answer is 10-150 words
          if (wordCount >= 10 && wordCount <= 150) {
            questionAnswerPairs++;
          }
        }
      }
    });

    // Check for definition patterns in paragraphs
    const paragraphs = Array.from(document.querySelectorAll('p'));
    paragraphs.forEach(p => {
      const text = p.textContent?.trim() || '';
      if (isDefinition(text)) {
        definitionCount++;
      }
    });

    // 2. Direct Answer Optimization
    let hasDirectAnswer = false;
    let keyFactsInFirst200Words = 0;

    // Check if first paragraph summarizes the main topic
    const firstParagraph = document.querySelector('p');
    if (firstParagraph) {
      const firstParaText = firstParagraph.textContent?.trim() || '';
      const firstParaWords = firstParaText.split(/\s+/).length;

      // Consider it a direct answer if it's 50-200 words
      if (firstParaWords >= 50 && firstParaWords <= 200) {
        hasDirectAnswer = true;
      }

      // Count sentences in first 200 words (potential key facts)
      const first200Words = firstParaText.split(/\s+/).slice(0, 200).join(' ');
      const sentences = extractSentences(first200Words);
      keyFactsInFirst200Words = sentences.length;
    }

    // Count lists and tables
    const lists = document.querySelectorAll('ul, ol');
    const tables = document.querySelectorAll('table');
    const listAndTableCount = lists.length + tables.length;

    // 3. Content Structure for AI
    let totalParagraphLength = 0;
    let paragraphCount = 0;
    let totalSentences = 0;
    let totalWords = 0;

    paragraphs.forEach(p => {
      const text = p.textContent?.trim() || '';
      if (text.length > 0) {
        const sentences = extractSentences(text);
        const words = text.split(/\s+/).length;

        totalParagraphLength += sentences.length;
        paragraphCount++;
        totalSentences += sentences.length;
        totalWords += words;
      }
    });

    const avgParagraphLength = paragraphCount > 0 ? totalParagraphLength / paragraphCount : 0;
    const avgSentenceLength = totalSentences > 0 ? totalWords / totalSentences : 0;

    // Check for summary/conclusion sections
    let hasSummarySection = false;
    const summaryKeywords = ['summary', 'conclusion', 'takeaway', 'key points', 'in conclusion'];
    headings.forEach(heading => {
      const headingText = heading.textContent?.toLowerCase().trim() || '';
      if (summaryKeywords.some(keyword => headingText.includes(keyword))) {
        hasSummarySection = true;
      }
    });

    // 4. Entity Clarity
    let mainTopicMentions = 0;
    let consistentTerminology = true;

    // Helper to escape special regex characters
    const escapeRegex = (str: string): string => {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    // Extract main topic from title or first heading
    const title = document.querySelector('title')?.textContent || '';
    const firstH1 = document.querySelector('h1')?.textContent || '';
    const mainTopic = title || firstH1;

    if (mainTopic) {
      // Extract key terms (words longer than 3 characters, not common words)
      const commonWords = ['the', 'and', 'for', 'that', 'this', 'with', 'from', 'your'];
      const mainTopicWords = mainTopic
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3 && !commonWords.includes(word));

      // Count mentions of main topic terms in content
      const bodyText = document.body.textContent?.toLowerCase() || '';
      mainTopicWords.forEach(word => {
        // Escape special regex characters to prevent invalid regex errors
        const escapedWord = escapeRegex(word);
        const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi');
        const matches = bodyText.match(regex);
        if (matches) {
          mainTopicMentions += matches.length;
        }
      });

      // Check for consistent terminology (simplified check)
      // If main topic is mentioned at least 3 times, consider it consistent
      consistentTerminology = mainTopicMentions >= 3;
    }

    // 5. Conversational Readiness
    let conversationalScore = 0;

    // Check sentence length (ideal 15-25 words)
    if (avgSentenceLength >= 15 && avgSentenceLength <= 25) {
      conversationalScore += 30;
    } else if (avgSentenceLength >= 10 && avgSentenceLength < 30) {
      conversationalScore += 15;
    }

    // Check paragraph length (ideal 2-4 sentences)
    if (avgParagraphLength >= 2 && avgParagraphLength <= 4) {
      conversationalScore += 30;
    } else if (avgParagraphLength >= 1 && avgParagraphLength < 6) {
      conversationalScore += 15;
    }

    // Check for natural language (absence of keyword stuffing)
    // Count repeated phrases as indicator of keyword stuffing
    const words = allText.split(/\s+/);
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    const vocabularyDiversity = uniqueWords.size / words.length;

    if (vocabularyDiversity > 0.5) {
      conversationalScore += 20;
    } else if (vocabularyDiversity > 0.3) {
      conversationalScore += 10;
    }

    // Check for complete sentences (paragraphs should end with punctuation)
    const completeSentences = paragraphs.filter(p => {
      const text = p.textContent?.trim() || '';
      return /[.!?]$/.test(text);
    }).length;

    if (paragraphCount > 0 && completeSentences / paragraphCount > 0.8) {
      conversationalScore += 20;
    } else if (paragraphCount > 0 && completeSentences / paragraphCount > 0.6) {
      conversationalScore += 10;
    }

    // 6. Citation Worthiness
    let uniqueDataPoints = 0;

    // Look for numbers, statistics, percentages
    const numberPattern = /\b\d+([,.\d]*)?%?\b/g;
    const numbers = allText.match(numberPattern);
    if (numbers) {
      uniqueDataPoints = Math.min(numbers.length, 20); // Cap at 20 for scoring
    }

    // Look for quotes (indicated by quotation marks)
    const quotePattern = /[""].*?[""]|".*?"/g;
    const quotes = allText.match(quotePattern);
    if (quotes) {
      uniqueDataPoints += quotes.length;
    }

    // Look for attribution keywords
    const attributionKeywords = ['according to', 'says', 'states', 'reports', 'study shows', 'research indicates'];
    attributionKeywords.forEach(keyword => {
      if (allText.includes(keyword)) {
        uniqueDataPoints += 2;
      }
    });

    // Determine citation worthiness
    let citationWorthiness: 'high' | 'medium' | 'low' = 'low';

    const hasOriginalContent = uniqueDataPoints >= 5;
    const hasGoodStructure = (questionAnswerPairs >= 2 || hasFAQSection) && listAndTableCount >= 1;
    const hasEntityClarity = mainTopicMentions >= 5 && consistentTerminology;

    if (hasOriginalContent && hasGoodStructure && hasEntityClarity) {
      citationWorthiness = 'high';
    } else if (hasOriginalContent || hasGoodStructure) {
      citationWorthiness = 'medium';
    }

    return {
      questionAnswerPairs,
      hasDirectAnswer,
      hasFAQSection,
      definitionCount,
      avgParagraphLength: Math.round(avgParagraphLength * 10) / 10,
      avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
      hasSummarySection,
      listAndTableCount,
      entityClarity: {
        mainTopicMentions,
        consistentTerminology,
      },
      uniqueDataPoints,
      conversationalScore: Math.min(100, conversationalScore),
      citationWorthiness,
    };
  });

  return analysis;
}

/**
 * Calculate AI Citation score
 */
export function calculateAICitationScore(analysis: AICitationAnalysis): number {
  let score = 0;

  // 1. Q&A Format (25 points)
  let qaScore = 0;

  // Question-answer pairs (up to 15 points)
  if (analysis.questionAnswerPairs >= 5) {
    qaScore += 15;
  } else if (analysis.questionAnswerPairs >= 3) {
    qaScore += 10;
  } else if (analysis.questionAnswerPairs >= 1) {
    qaScore += 5;
  }

  // FAQ section (5 points)
  if (analysis.hasFAQSection) {
    qaScore += 5;
  }

  // Definition patterns (5 points)
  if (analysis.definitionCount >= 3) {
    qaScore += 5;
  } else if (analysis.definitionCount >= 1) {
    qaScore += 2;
  }

  score += Math.min(25, qaScore);

  // 2. Direct Answers (20 points)
  let directAnswerScore = 0;

  // Has direct answer in first paragraph (10 points)
  if (analysis.hasDirectAnswer) {
    directAnswerScore += 10;
  }

  // Lists and tables for structured info (10 points)
  if (analysis.listAndTableCount >= 5) {
    directAnswerScore += 10;
  } else if (analysis.listAndTableCount >= 3) {
    directAnswerScore += 7;
  } else if (analysis.listAndTableCount >= 1) {
    directAnswerScore += 4;
  }

  score += Math.min(20, directAnswerScore);

  // 3. Content Structure (20 points)
  let structureScore = 0;

  // Paragraph length (10 points) - ideal 2-4 sentences
  if (analysis.avgParagraphLength >= 2 && analysis.avgParagraphLength <= 4) {
    structureScore += 10;
  } else if (analysis.avgParagraphLength >= 1 && analysis.avgParagraphLength < 6) {
    structureScore += 5;
  }

  // Sentence length (5 points) - ideal 15-25 words
  if (analysis.avgSentenceLength >= 15 && analysis.avgSentenceLength <= 25) {
    structureScore += 5;
  } else if (analysis.avgSentenceLength >= 10 && analysis.avgSentenceLength < 30) {
    structureScore += 2;
  }

  // Summary section (5 points)
  if (analysis.hasSummarySection) {
    structureScore += 5;
  }

  score += Math.min(20, structureScore);

  // 4. Entity Clarity (15 points)
  let entityScore = 0;

  // Main topic mentions (10 points)
  if (analysis.entityClarity.mainTopicMentions >= 10) {
    entityScore += 10;
  } else if (analysis.entityClarity.mainTopicMentions >= 5) {
    entityScore += 7;
  } else if (analysis.entityClarity.mainTopicMentions >= 3) {
    entityScore += 4;
  }

  // Consistent terminology (5 points)
  if (analysis.entityClarity.consistentTerminology) {
    entityScore += 5;
  }

  score += Math.min(15, entityScore);

  // 5. Citation Worthiness (20 points)
  let citationScore = 0;

  // Unique data points (10 points)
  if (analysis.uniqueDataPoints >= 10) {
    citationScore += 10;
  } else if (analysis.uniqueDataPoints >= 5) {
    citationScore += 7;
  } else if (analysis.uniqueDataPoints >= 2) {
    citationScore += 4;
  }

  // Conversational score (10 points) - scale from 0-100 to 0-10
  citationScore += Math.round(analysis.conversationalScore / 10);

  score += Math.min(20, citationScore);

  return Math.min(100, Math.max(0, score));
}

export default analyzeAICitation;
