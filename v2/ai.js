// AI модуль для интеграции с Gemini API
class AIShortlinkerAI {
  constructor() {
    this.apiKey = null;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    this.initialized = false;
  }

  // Инициализация API ключа
  async init(apiKey) {
    this.apiKey = apiKey;
    this.initialized = true;
    
    // Сохраняем ключ в storage (зашифрованно в реальном приложении)
    await chrome.storage.local.set({ geminiApiKey: apiKey });
  }

  // Загрузка API ключа из storage
  async loadApiKey() {
    const data = await chrome.storage.local.get(['geminiApiKey']);
    if (data.geminiApiKey) {
      this.apiKey = data.geminiApiKey;
      this.initialized = true;
      return true;
    }
    return false;
  }

  // Проверка инициализации
  checkInit() {
    if (!this.initialized || !this.apiKey) {
      throw new Error('AI не инициализирован. Установите API ключ Gemini.');
    }
  }

  // Генерация alias для папки
  async generateFolderAlias(folderName, bookmarks = []) {
    this.checkInit();

    const bookmarkTitles = bookmarks.slice(0, 5).map(b => b.title).join(', ');
    const prompt = `
Создай короткий alias (1-2 слова, латиницей, без пробелов) для папки закладок браузера.

Название папки: "${folderName}"
Примеры закладок в папке: ${bookmarkTitles || 'Нет примеров'}

Правила для alias:
- Только латинские буквы и цифры
- Без пробелов, дефисов, подчеркиваний
- Максимум 15 символов
- Отражает содержимое папки
- Легко запомнить и набрать

Ответь только alias, без объяснений.
    `.trim();

    try {
      const response = await this.callGemini(prompt);
      return this.sanitizeAlias(response);
    } catch (error) {
      console.error('Ошибка генерации alias:', error);
      // Fallback к простому преобразованию имени папки
      return this.createFallbackAlias(folderName);
    }
  }

  // Генерация описания для закладки
  async generateBookmarkDescription(title, url, content = '') {
    this.checkInit();

    const prompt = `
Создай краткое описание (2-3 слова) для закладки браузера на русском языке.

Название: "${title}"
URL: "${url}"
${content ? `Содержимое: "${content.substring(0, 200)}..."` : ''}

Описание должно:
- Быть максимально кратким (2-3 слова)
- Отражать суть сайта/страницы
- Помочь в поиске
- Быть на русском языке

Примеры:
- GitHub → "код репозитории"
- Stack Overflow → "вопросы программирование"
- YouTube → "видео контент"
- Netflix → "фильмы сериалы"

Ответь только описанием, без кавычек и объяснений.
    `.trim();

    try {
      const response = await this.callGemini(prompt);
      return response.trim();
    } catch (error) {
      console.error('Ошибка генерации описания:', error);
      return this.createFallbackDescription(title, url);
    }
  }

  // Семантический поиск закладок
  async semanticSearch(query, bookmarks) {
    this.checkInit();

    const bookmarksList = bookmarks.slice(0, 50).map((bookmark, index) => 
      `${index}: ${bookmark.title} | ${bookmark.url}${bookmark.description ? ` | ${bookmark.description}` : ''}`
    ).join('\n');

    const prompt = `
Найди наиболее релевантные закладки для запроса пользователя.

Запрос: "${query}"

Список закладок:
${bookmarksList}

Верни только номера наиболее подходящих закладок (максимум 10), разделенные запятыми.
Учитывай не только прямое совпадение слов, но и смысловую близость.

Пример ответа: 1,5,12,8
    `.trim();

    try {
      const response = await this.callGemini(prompt);
      const indices = response.split(',').map(i => parseInt(i.trim())).filter(i => !isNaN(i));
      return indices.map(i => bookmarks[i]).filter(Boolean);
    } catch (error) {
      console.error('Ошибка семантического поиска:', error);
      return [];
    }
  }

  // Автоматическая категоризация закладок
  async categorizeBookmarks(bookmarks) {
    this.checkInit();

    const bookmarksList = bookmarks.slice(0, 30).map((bookmark, index) => 
      `${index}: ${bookmark.title} | ${bookmark.url}`
    ).join('\n');

    const prompt = `
Раздели закладки на логические категории и предложи alias для каждой категории.

Закладки:
${bookmarksList}

Верни результат в формате JSON:
{
  "categories": [
    {
      "name": "Название категории",
      "alias": "alias",
      "bookmarks": [0, 1, 5]
    }
  ]
}

Правила для alias:
- Латинские буквы
- Без пробелов
- Максимум 15 символов
    `.trim();

    try {
      const response = await this.callGemini(prompt);
      const result = JSON.parse(response);
      return result.categories || [];
    } catch (error) {
      console.error('Ошибка категоризации:', error);
      return [];
    }
  }

  // Предложения для улучшения структуры закладок
  async suggestImprovements(aliasMap) {
    this.checkInit();

    const foldersInfo = Object.entries(aliasMap).map(([alias, data]) => 
      `${alias}: ${data.title} (${data.bookmarks.length} закладок)`
    ).join('\n');

    const prompt = `
Проанализируй структуру закладок пользователя и предложи улучшения.

Текущие папки:
${foldersInfo}

Предложи:
1. Какие папки можно объединить
2. Какие папки стоит разделить
3. Новые alias для плохо названных папок
4. Отсутствующие важные категории

Ответь в формате JSON:
{
  "suggestions": [
    {
      "type": "merge|split|rename|add",
      "description": "Описание предложения",
      "action": "Конкретное действие"
    }
  ]
}
    `.trim();

    try {
      const response = await this.callGemini(prompt);
      const result = JSON.parse(response);
      return result.suggestions || [];
    } catch (error) {
      console.error('Ошибка анализа улучшений:', error);
      return [];
    }
  }

  // Вызов Gemini API
  async callGemini(prompt, maxTokens = 256) {
    if (!this.apiKey) {
      throw new Error('API ключ Gemini не установлен');
    }

    const url = `${this.baseUrl}/models/gemini-pro:generateContent?key=${this.apiKey}`;
    
    const requestBody = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.7
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      return data.candidates[0].content.parts[0].text;
    }
    
    throw new Error('Неожиданный ответ от Gemini API');
  }

  // Очистка и валидация alias
  sanitizeAlias(alias) {
    return alias
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 15) || 'bookmark';
  }

  // Создание fallback alias без AI
  createFallbackAlias(folderName) {
    return folderName
      .toLowerCase()
      .replace(/[^a-z0-9а-я]/g, '')
      .replace(/[а-я]/g, char => {
        const map = {
          'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e',
          'ё': 'e', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k',
          'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r',
          'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c',
          'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '',
          'э': 'e', 'ю': 'yu', 'я': 'ya'
        };
        return map[char] || char;
      })
      .substring(0, 15) || 'folder';
  }

  // Создание fallback описания без AI
  createFallbackDescription(title, url) {
    try {
      const domain = new URL(url).hostname;
      const domainName = domain.replace('www.', '').split('.')[0];
      
      const commonSites = {
        'github': 'код разработка',
        'stackoverflow': 'вопросы программирование',
        'youtube': 'видео контент',
        'google': 'поиск информация',
        'wikipedia': 'энциклопедия знания',
        'habr': 'статьи технологии',
        'medium': 'статьи блог',
        'reddit': 'форум обсуждения',
        'twitter': 'социальная сеть',
        'facebook': 'социальная сеть',
        'linkedin': 'профессиональная сеть',
        'instagram': 'фото социальная',
        'vk': 'социальная сеть'
      };
      
      return commonSites[domainName] || `сайт ${domainName}`;
    } catch (e) {
      return 'веб страница';
    }
  }

  // Проверка доступности API
  async testConnection() {
    try {
      await this.callGemini('Скажи "тест"', 10);
      return true;
    } catch (error) {
      console.error('Тест соединения с Gemini API не удался:', error);
      return false;
    }
  }

  // Обработка закладок с AI улучшениями
  async enhanceBookmarks(bookmarksCache, aliasMap) {
    this.checkInit();
    
    const enhanced = { ...bookmarksCache };
    const enhancedAliasMap = { ...aliasMap };
    
    // Генерируем описания для закладок (пакетами по 5)
    const bookmarks = Object.values(enhanced);
    const batchSize = 5;
    
    for (let i = 0; i < bookmarks.length; i += batchSize) {
      const batch = bookmarks.slice(i, i + batchSize);
      
      for (const bookmark of batch) {
        if (!bookmark.aiDescription) {
          try {
            bookmark.aiDescription = await this.generateBookmarkDescription(
              bookmark.title, 
              bookmark.url
            );
            
            // Добавляем задержку между запросами
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (error) {
            console.error('Ошибка генерации описания для закладки:', error);
            bookmark.aiDescription = this.createFallbackDescription(bookmark.title, bookmark.url);
          }
        }
      }
    }
    
    // Улучшаем alias для папок
    for (const [alias, data] of Object.entries(enhancedAliasMap)) {
      if (!data.aiAlias) {
        try {
          const newAlias = await this.generateFolderAlias(data.title, data.bookmarks);
          data.aiAlias = newAlias;
          
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error('Ошибка генерации alias для папки:', error);
          data.aiAlias = this.createFallbackAlias(data.title);
        }
      }
    }
    
    return {
      bookmarksCache: enhanced,
      aliasMap: enhancedAliasMap
    };
  }
}

// Создаем глобальный экземпляр
const aiShortlinker = new AIShortlinkerAI();

// Экспортируем для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIShortlinkerAI;
}