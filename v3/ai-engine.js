// ai-engine.js

// --- Chrome AI API functions ---
// These functions leverage the native Chrome AI API (if available) for summarization.
// They are exposed here for clarity but are meant to be used by the AIEngine class.

/**
 * Summarizes text into a short headline (e.g., for an alias or primary keyword).
 * Uses Chrome AI Summarizer if available, falls back to first few words.
 * @param {string} text - The input text to summarize.
 * @returns {Promise<string>} - A promise that resolves with the summarized headline.
 */
async function summarizeOneWord(text) {
  if (!("Summarizer" in self)) {
    // Fallback: Return first meaningful word from text
    const words = text.trim().split(/\s+/).filter(w => w.length > 2);
    return words.length > 0 ? words[0] : '';
  }

  let status;
  try {
    status = await Summarizer.availability();
  } catch (e) {
    console.warn("GoAlias: Failed to check Summarizer API availability:", e);
    const words = text.trim().split(/\s+/).filter(w => w.length > 2);
    return words.length > 0 ? words[0] : '';
  }

  if (status === "unavailable") {
    // Fallback: Summarizer not available
    const words = text.trim().split(/\s+/).filter(w => w.length > 2);
    return words.length > 0 ? words[0] : '';
  }

  let summarizer;
  let summary = '';
  try {
    summarizer = await Summarizer.create({
      type: "headline",
      format: "plain-text",
      length: "short"
    });
    summary = await summarizer.summarize(text);
  } catch (e) {
    console.warn("GoAlias: Error during summarization (headline):", e);
    const words = text.trim().split(/\s+/).filter(w => w.length > 2);
    return words.length > 0 ? words[0] : '';
  } finally {
    if (summarizer) {
      summarizer.destroy(); // Always destroy the summarizer
    }
  }

  const words = summary.trim().split(/\s+/).filter(w => w.length > 2);
  return words.length > 0 ? words[0] : '';
}

/**
 * Generates a short description for a page using Chrome AI Summarizer.
 * NOTE: This is kept for semantic search (AI-Search), but no longer used by default in popup for saving.
 * @param {string} text - The input text to describe.
 * @returns {Promise<string>} - A promise that resolves with the generated description.
 */
async function generateFullDescriptionForAISearch(text) { // Renamed for clarity
  try {
    if (!("Summarizer" in self)) {
      return text.substring(0, 150) + (text.length > 150 ? '...' : '');
    }

    const status = await Summarizer.availability();
    if (status === "unavailable") {
      return text.substring(0, 150) + (text.length > 150 ? '...' : '');
    }

    const summarizer = await Summarizer.create({
      type: "tldr", // "tldr" for concise summary, "summary" for slightly longer
      format: "plain-text",
      length: "short"
    });

    const description = await summarizer.summarize(text);
    summarizer.destroy();

    return description;
  } catch (error) {
    console.error("GoAlias: Description generation failed:", error);
    return text.substring(0, 150) + (text.length > 150 ? '...' : '');
  }
}

// --- AIEngine Class ---
export class AIEngine {
  constructor() {
    this.stopWords = new Set(['и', 'в', 'на', 'с', 'по', 'за', 'из', 'до', 'о', 'у', 'не', 'а', 'но', 'да', 'как', 'что', 'это', 'для', 'от', 'к', 'бы', 'же', 'ли', 'ни', 'если', 'или', 'также']);
  }

  /**
   * Performs a semantic search based on query and alias descriptions/keywords.
   * Uses a local TF-IDF-like approach with cosine similarity.
   * @param {string} query - The user's search query.
   * @param {Object} aliases - An object containing all aliases.
   * @returns {Promise<Array<{alias: string, url: string, description: string, score: number}>>} - Ranked search results.
   */
  async semanticSearch(query, aliases) {
    const queryVector = this.textToVector(query);
    const results = [];

    for (const [alias, data] of Object.entries(aliases)) {
      // For semantic search, we use the stored description and keywords
      const contentVector = this.textToVector(
        `${data.description || ''} ${data.keywords.join(' ')} ${data.tags.join(' ')}`
      );

      const similarity = this.cosineSimilarity(queryVector, contentVector);

      if (similarity > 0.1) { // Threshold for relevance, adjust as needed
        results.push({
          alias,
          url: data.url,
          description: data.description, // Use stored description
          score: similarity
        });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // Top 10 results
  }

  /**
   * Generates a suggested alias and keywords for a new page using Chrome AI.
   * Note: The full description is NOT generated here for the popup, but it is generated
   * by `generateFullDescriptionForAISearch` internally if `semanticSearch` needs it.
   * @param {{title: string, url: string, content: string}} tabInfo - Object containing tab title, URL, and page content.
   * @returns {Promise<{suggestedAlias: string, keywords: string[]}>} - Generated alias and keywords.
   */
  async generateDescription(tabInfo) {
    const { title, url, content } = tabInfo;

    let textForAI = content || title || url;
    if (textForAI.length === 0 && url) {
      textForAI = `Страница по адресу ${url}`;
    }

    const MAX_AI_INPUT_LENGTH = 10000;
    if (textForAI.length > MAX_AI_INPUT_LENGTH) {
      textForAI = textForAI.substring(0, MAX_AI_INPUT_LENGTH);
    }

    // Generate a potential primary keyword/alias part using Chrome AI
    const potentialKeywordAI = await summarizeOneWord(textForAI);
    let suggestedAlias = potentialKeywordAI.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/--+/g, '-').trim();
    if (suggestedAlias.endsWith('-')) suggestedAlias = suggestedAlias.slice(0, -1);
    if (suggestedAlias.length > 30) suggestedAlias = suggestedAlias.substring(0, 30);


    // Extract keywords using local logic from title and URL and potentially content
    const localKeywords = this.extractKeywords(title, url, content);

    // Combine keywords: AI-generated + locally extracted, remove duplicates and short words
    let combinedKeywords = [potentialKeywordAI, ...localKeywords].filter(k => k && k.length > 2);
    combinedKeywords = [...new Set(combinedKeywords)]; // Deduplicate

    // For the popup's "generate AI" button, we only return keywords and a suggested alias.
    // The description field in the popup is meant for manual input.
    return {
      suggestedAlias: suggestedAlias,
      keywords: combinedKeywords
    };
  }


  /**
   * Converts a text string into a frequency vector (simple TF-like).
   * @param {string} text - The input text.
   * @returns {Object<string, number>} - A map of word frequencies.
   */
  textToVector(text) {
    const words = this.preprocessText(text);
    const vector = {};
    words.forEach(word => {
      vector[word] = (vector[word] || 0) + 1;
    });
    return vector;
  }

  /**
   * Cleans and tokenizes text.
   * @param {string} text - The input text.
   * @returns {string[]} - An array of processed words.
   */
  preprocessText(text) {
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ') // Allow Unicode letters and numbers
      .split(/\s+/)
      .filter(word => word.length > 2 && !this.stopWords.has(word));
  }

  /**
   * Calculates cosine similarity between two word frequency vectors.
   * @param {Object<string, number>} vec1 - First vector.
   * @param {Object<string, number>} vec2 - Second vector.
   * @returns {number} - Cosine similarity score (0 to 1).
   */
  cosineSimilarity(vec1, vec2) {
    const allWords = new Set([...Object.keys(vec1), ...Object.keys(vec2)]);
    if (allWords.size === 0) return 0;

    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (const word of allWords) {
      const val1 = vec1[word] || 0;
      const val2 = vec2[word] || 0;

      dotProduct += val1 * val2;
      magnitude1 += val1 * val1;
      magnitude2 += val2 * val2;
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    if (magnitude1 === 0 || magnitude2 === 0) return 0;

    return dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * Extracts keywords from title, URL, and page content.
   * @param {string} title - Page title.
   * @param {string} url - Page URL.
   * @param {string} content - Page main content.
   * @returns {string[]} - An array of extracted keywords.
   */
  extractKeywords(title, url, content = '') {
    const titleWords = this.preprocessText(title);
    let urlKeywords = [];
    try {
        const urlObj = new URL(url);
        urlKeywords = this.preprocessText(`${urlObj.hostname.replace('www.', '')} ${urlObj.pathname.replace(/[-_/]/g, ' ')}`);
    } catch (e) {
        console.warn("GoAlias: Invalid URL for keyword extraction:", url);
    }
    const contentWords = this.preprocessText(content).slice(0, 20); // Limit content words for speed

    let keywords = [...new Set([
      ...titleWords,
      ...urlKeywords,
      ...contentWords
    ])];

    return keywords.slice(0, 15); // Limit total keywords
  }
}

