// fuzzy-search.js

export class FuzzySearch {
  constructor() {
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
   * Aims for a Fuse.js-like behavior for better relevance.
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
      let matchDetails = []; // Для отслеживания, где найдено совпадение

      const aliasLower = alias.toLowerCase();
      const descriptionLower = data.description ? data.description.toLowerCase() : '';
      const keywordsLower = data.keywords ? data.keywords.map(k => k.toLowerCase()).join(' ') : '';
      const tagsLower = data.tags ? data.tags.map(t => t.toLowerCase()).join(' ') : '';
      const urlLower = data.url ? data.url.toLowerCase() : ''; // Добавим поиск по URL

      const fieldsToSearch = [
        { name: 'alias', value: aliasLower, weight: 1.0 },
        { name: 'keywords', value: keywordsLower, weight: 0.9 },
        { name: 'tags', value: tagsLower, weight: 0.8 },
        { name: 'description', value: descriptionLower, weight: 0.7 },
        { name: 'url', value: urlLower, weight: 0.6 } // Поиск по URL
      ];

      for (const field of fieldsToSearch) {
        if (field.value.includes(query)) {
          score += field.weight * 1.0; // Прямое вхождение фразы
          matchDetails.push({ field: field.name, type: 'exact_phrase', score: field.weight });
        } else {
          // Нечеткий поиск по словам
          const queryWords = query.split(/\s+/).filter(w => w.length > 0);
          const targetWords = field.value.split(/\s+/).filter(w => w.length > 0);
          let fieldWordMatchScore = 0;
          let wordMatches = 0;

          queryWords.forEach(qWord => {
            let bestWordSim = 0;
            targetWords.forEach(tWord => {
              // Игнорируем очень короткие слова в запросе, если они не являются самим алиасом
              if (qWord.length <= 1 && qWord !== aliasLower) return; 
              const distance = this.levenshtein(qWord, tWord);
              const maxLen = Math.max(qWord.length, tWord.length);
              const similarity = maxLen > 0 ? (maxLen - distance) / maxLen : 0;
              if (similarity > bestWordSim) {
                bestWordSim = similarity;
              }
            });
            if (bestWordSim > 0.6) { // Порог для частичного совпадения слова
              fieldWordMatchScore += bestWordSim;
              wordMatches++;
            }
          });

          if (wordMatches > 0) {
            score += field.weight * (fieldWordMatchScore / queryWords.length) * 0.8; // Взвешиваем и понижаем, так как это нечеткий
            matchDetails.push({ field: field.name, type: 'word_fuzzy', score: field.weight * (fieldWordMatchScore / queryWords.length) * 0.8 });
          }
        }
      }

      // Дополнительная логика для прямого совпадения алиаса
      if (aliasLower === query) {
        score = 1.1; // Даем небольшой бонус для точного совпадения алиаса
        matchDetails.push({ field: 'alias', type: 'perfect_alias', score: 1.1 });
      }


      if (score > 0.1) { // Только если есть какая-то релевантность
        results.push({
          alias,
          url: data.url,
          description: data.description,
          score: score,
          matchDetails: matchDetails, // Можно использовать для отладки
          usageCount: data.usageCount || 0,
          lastUsed: data.lastUsed ? new Date(data.lastUsed).getTime() : 0
        });
      }
    }

    // Сортировка: по score (релевантность), затем по usageCount, затем по lastUsed
    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
      return b.lastUsed - a.lastUsed;
    });

    return results.slice(0, 10); // Ограничение на 10 результатов
  }
}