// Fuzzy search функция
function fuzzyMatch(str, pattern) {
  pattern = pattern.toLowerCase();
  str = str.toLowerCase();
  
  let patternIdx = 0;
  let strIdx = 0;
  let score = 0;
  
  while (strIdx < str.length && patternIdx < pattern.length) {
    if (str[strIdx] === pattern[patternIdx]) {
      score += 1;
      patternIdx++;
    }
    strIdx++;
  }
  
  return patternIdx === pattern.length ? score : 0;
}

// Levenshtein distance для более точного поиска
function levenshteinDistance(a, b) {
  const matrix = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

// AI поиск с использованием Summarizer API (если доступен)
async function aiSearch(query, items) {
  try {
    if (!("Summarizer" in self)) {
      return fuzzySearchFallback(query, items);
    }
    
    // Используем AI для понимания запроса
    const summarizer = await Summarizer.create({
      type: "key-points",
      format: "plain-text",
      length: "short"
    });
    
    const queryContext = await summarizer.summarize(query);
    summarizer.destroy();
    
    // Ищем совпадения с учетом контекста
    const results = items.map(item => {
      const descScore = fuzzyMatch(item.description || '', queryContext);
      const titleScore = fuzzyMatch(item.alias, query);
      const urlScore = fuzzyMatch(item.url, query);
      
      return {
        ...item,
        score: descScore * 3 + titleScore * 2 + urlScore
      };
    }).filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);
    
    return results;
    
  } catch (error) {
    console.error('AI search failed, using fallback:', error);
    return fuzzySearchFallback(query, items);
  }
}

// Fallback поиск без AI
function fuzzySearchFallback(query, items) {
  return items.map(item => {
    const aliasScore = fuzzyMatch(item.alias, query);
    const descScore = fuzzyMatch(item.description || '', query);
    const urlScore = fuzzyMatch(item.url, query);
    const distanceScore = 10 - levenshteinDistance(query, item.alias);
    
    return {
      ...item,
      score: aliasScore * 2 + descScore * 3 + urlScore + Math.max(0, distanceScore)
    };
  }).filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);
}

// Получить статистику использования
async function getUsageStats() {
  const stats = await chrome.storage.local.get('_stats');
  return stats._stats || {};
}

// Обновить статистику
async function updateUsageStats(alias) {
  const stats = await getUsageStats();
  
  if (!stats[alias]) {
    stats[alias] = {
      visitCount: 0,
      lastVisited: null,
      firstVisited: Date.now()
    };
  }
  
  stats[alias].visitCount++;
  stats[alias].lastVisited = Date.now();
  
  await chrome.storage.local.set({ '_stats': stats });
}

// Получить рекомендации для пустого запроса
async function getDefaultSuggestions() {
  const data = await chrome.storage.local.get(null);
  const stats = await getUsageStats();
  
  // Удаляем служебные ключи
  delete data._stats;
  delete data._metadata;
  
  const items = Object.entries(data).map(([alias, urlOrData]) => {
    // Поддержка старого формата (просто URL) и нового (объект с данными)
    const url = typeof urlOrData === 'string' ? urlOrData : urlOrData.url;
    const description = typeof urlOrData === 'object' ? urlOrData.description : '';
    
    const stat = stats[alias] || { visitCount: 0, lastVisited: null, firstVisited: Date.now() };
    
    return {
      alias,
      url,
      description,
      visitCount: stat.visitCount,
      lastVisited: stat.lastVisited,
      firstVisited: stat.firstVisited
    };
  });
  
  if (items.length === 0) return [];
  
  // Сортируем: 1 недавний, 3 часто посещаемых, 1 неоткрытый
  const recent = items
    .filter(i => i.lastVisited)
    .sort((a, b) => b.lastVisited - a.lastVisited)
    .slice(0, 1);
  
  const frequent = items
    .filter(i => i.visitCount > 0)
    .sort((a, b) => b.visitCount - a.visitCount)
    .slice(0, 3);
  
  const unvisited = items
    .filter(i => i.visitCount === 0)
    .sort((a, b) => b.firstVisited - a.firstVisited)
    .slice(0, 1);
  
  // Объединяем без дубликатов
  const suggestions = [];
  const added = new Set();
  
  [...recent, ...frequent, ...unvisited].forEach(item => {
    if (!added.has(item.alias)) {
      suggestions.push(item);
      added.add(item.alias);
    }
  });
  
  return suggestions.slice(0, 5);
}

// Omnibox input changed handler
chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  const query = text.trim();
  
  // Если пустой запрос - показываем рекомендации
  if (!query) {
    const defaults = await getDefaultSuggestions();
    const suggestions = defaults.map(item => ({
      content: item.alias,
      description: `${item.alias} - ${item.description || item.url} ${item.visitCount > 0 ? '(👁️ ' + item.visitCount + ')' : '(🆕 new)'}`
    }));
    
    suggest(suggestions);
    return;
  }
  
  // Получаем все данные
  const data = await chrome.storage.local.get(null);
  delete data._stats;
  delete data._metadata;
  
  const items = Object.entries(data).map(([alias, urlOrData]) => {
    const url = typeof urlOrData === 'string' ? urlOrData : urlOrData.url;
    const description = typeof urlOrData === 'object' ? urlOrData.description : '';
    
    return { alias, url, description };
  });
  
  // Проверяем префикс для AI поиска
  if (query.startsWith('ai ')) {
    const searchQuery = query.substring(3).trim();
    if (searchQuery) {
      const results = await aiSearch(searchQuery, items);
      const suggestions = results.slice(0, 5).map(item => ({
        content: item.alias,
        description: `🤖 ${item.alias} - ${item.description || item.url}`
      }));
      
      suggest(suggestions);
      return;
    }
  }
  
  // Обычный fuzzy поиск
  const results = fuzzySearchFallback(query, items);
  const suggestions = results.slice(0, 5).map(item => ({
    content: item.alias,
    description: `${item.alias} - ${item.description || item.url}`
  }));
  
  suggest(suggestions);
});

// Omnibox input entered handler
chrome.omnibox.onInputEntered.addListener(async (text) => {
  const alias = text.trim();
  
  const data = await chrome.storage.local.get(alias);
  
  if (data[alias]) {
    const urlOrData = data[alias];
    const url = typeof urlOrData === 'string' ? urlOrData : urlOrData.url;
    
    // Обновляем статистику
    await updateUsageStats(alias);
    
    // Открываем URL
    chrome.tabs.update({ url });
  } else {
    // Если не найдено - поиск в Google
    chrome.tabs.update({ 
      url: "https://www.google.com/search?q=" + encodeURIComponent(text) 
    });
  }
});

// Default suggestion
chrome.omnibox.setDefaultSuggestion({
  description: 'Поиск в закладках (используй "ai [запрос]" для AI поиска) или введи alias'
});