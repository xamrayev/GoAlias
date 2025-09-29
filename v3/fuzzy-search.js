// fuzzy-search.js

export class FuzzySearch {
  constructor() {
    // Levenshtein distance function (simple implementation)
    this.levenshtein = (s1, s2) => {
      s1 = s1.toLowerCase();
      s2 = s2.toLowerCase();
      const costs = [];
      for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
          if (i === 0) {
            costs[j] = j;
          } else if (j > 0) {
            let newValue = costs[j - 1];
            if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
              newValue = Math.min(newValue, lastValue, costs[j]) + 1;
            }
            costs[j - 1] = lastValue;
            lastValue = newValue;
          }
        }
        if (i > 0) {
          costs[s2.length] = lastValue;
        }
      }
      return costs[s2.length];
    };
  }

  /**
   * Performs fuzzy search across alias names, descriptions, keywords, and tags.
   * @param {string} query - The search query.
   * @param {Object} aliases - An object containing all aliases.
   * @returns {Array<{alias: string, url: string, description: string, score: number}>} - Ranked search results.
   */
  search(query, aliases) {
    query = query.toLowerCase().trim();
    if (!query) return [];

    const results = [];

    for (const [alias, data] of Object.entries(aliases)) {
      let score = 0;
      let matchType = '';

      const aliasLower = alias.toLowerCase();
      const descriptionLower = data.description ? data.description.toLowerCase() : '';
      const keywordsLower = data.keywords ? data.keywords.map(k => k.toLowerCase()).join(' ') : '';
      const tagsLower = data.tags ? data.tags.map(t => t.toLowerCase()).join(' ') : '';
      const fullText = `${aliasLower} ${descriptionLower} ${keywordsLower} ${tagsLower}`;

      // 1. Direct match on alias (highest priority)
      if (aliasLower === query) {
        score = 1.0;
        matchType = 'direct_alias';
      }
      // 2. Exact word match in description/keywords/tags
      else if (fullText.includes(query)) {
        score = 0.9;
        matchType = 'exact_phrase';
      }
      // 3. Partial word match / Substring match
      else if (aliasLower.includes(query) || descriptionLower.includes(query) || keywordsLower.includes(query) || tagsLower.includes(query)) {
        score = 0.8;
        matchType = 'partial_word';
      }
      // 4. Word-by-word fuzzy match (more robust)
      else {
        const queryWords = query.split(/\s+/).filter(w => w.length > 0);
        const targetWords = fullText.split(/\s+/).filter(w => w.length > 0);
        let wordMatchCount = 0;
        let totalWordSimilarity = 0;

        queryWords.forEach(qWord => {
          let bestWordSim = 0;
          targetWords.forEach(tWord => {
            const distance = this.levenshtein(qWord, tWord);
            const maxLen = Math.max(qWord.length, tWord.length);
            const similarity = maxLen > 0 ? (maxLen - distance) / maxLen : 0;
            if (similarity > bestWordSim) {
              bestWordSim = similarity;
            }
          });
          if (bestWordSim > 0.6) { // Consider a word 'matched' if similarity is above 60%
            wordMatchCount++;
            totalWordSimilarity += bestWordSim;
          }
        });

        if (wordMatchCount > 0) {
          score = (0.7 * (wordMatchCount / queryWords.length)) + (0.3 * (totalWordSimilarity / wordMatchCount));
          matchType = 'word_fuzzy';
        }
      }

      if (score > 0.1) { // Only add if there's a reasonable score
        results.push({
          alias,
          url: data.url,
          description: data.description,
          score: score,
          matchType: matchType,
          // Add usage data for better sorting
          usageCount: data.usageCount || 0,
          lastUsed: data.lastUsed ? new Date(data.lastUsed).getTime() : 0
        });
      }
    }

    // Sort results: prioritize higher score, then usage count, then last used
    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
      return b.lastUsed - a.lastUsed;
    });

    return results.slice(0, 10); // Limit to top 10 results
  }
}