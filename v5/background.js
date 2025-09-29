// background.js

import { AIEngine } from './ai-engine.js';
import { FuzzySearch } from './fuzzy-search.js';
import { StorageManager, getDevicePerformanceClass } from './utils.js';

const storage = new StorageManager();
const aiEngine = new AIEngine();
const fuzzySearch = new FuzzySearch();

// --- XML escaping utility for Omnibox suggestions ---
function escapeXml(unsafe) {
  if (!unsafe || typeof unsafe !== 'string') return '';
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
    }
    return '';
  });
}

// --- Constants & Defaults ---
const OMNIBOX_KEYWORD = 'go';
const DEFAULT_ALIASES = {
  "goalias-docs": {
    "url": "https://developer.chrome.com/docs/extensions/",
    "description": "Официальная документация по расширениям Chrome",
    "keywords": ["chrome", "extensions", "docs", "developer"],
    "tags": ["development"],
    "created": "2024-01-01T00:00:00Z",
    "usageCount": 0,
    "lastUsed": null,
    "source": "manual",
    "bookmarkPath": "/"
  },
  "google": {
    "url": "https://www.google.com",
    "description": "Поисковая система Google",
    "keywords": ["search", "google", "engine"],
    "tags": ["search"],
    "created": "2024-01-01T00:00:00Z",
    "usageCount": 0,
    "lastUsed": null,
    "source": "manual",
    "bookmarkPath": "/"
  }
};

// --- Helper function to generate a safe alias from text ---
function generateSafeAlias(text, existingAliases = {}) {
  let safeAlias = text.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/--+/g, '-').trim();
  if (safeAlias.endsWith('-')) safeAlias = safeAlias.slice(0, -1);
  if (safeAlias.length > 30) safeAlias = safeAlias.substring(0, 30);
  if (safeAlias.length === 0) safeAlias = 'untitled';

  let counter = 1;
  let uniqueAlias = safeAlias;
  while (existingAliases[uniqueAlias]) {
    uniqueAlias = `${safeAlias}-${counter}`;
    counter++;
  }
  return uniqueAlias;
}

// --- Command Parser ---
const CommandParser = {
  parse(input) {
    input = input.trim();
    if (input.startsWith('ai ')) {
      return { mode: 'ai', query: input.substring(3).trim() };
    } else if (input.startsWith('fz ')) {
      return { mode: 'fuzzy', query: input.substring(3).trim() };
    } else if (input) {
      return { mode: 'smart', query: input };
    }
    return { mode: 'none', query: '' };
  }
};

// --- Bookmark Synchronization Logic (Helper Functions) ---

async function getBookmarkPath(nodeId) {
    let pathParts = [];
    let currentId = nodeId;
    while (currentId) {
        const node = (await chrome.bookmarks.get(currentId))[0];
        if (!node) break;
        if (node.title) {
            pathParts.unshift(node.title);
        }
        currentId = node.parentId;
        if (node.id === "0") break;
    }
    const filteredPathParts = pathParts.filter(part => !["Панель закладок", "Другие закладки", "Мобильные закладки", "Закладки"].includes(part));
    return filteredPathParts.length > 0 ? "/" + filteredPathParts.join('/') : "/";
}

async function processBookmark(bookmarkNode, existingAliases, isAIGeneration = false, performanceClass = 'Medium') {
  if (bookmarkNode.url) {
    const url = bookmarkNode.url;
    const title = bookmarkNode.title || url;
    const bookmarkPath = await getBookmarkPath(bookmarkNode.parentId);

    let existingAliasForUrl = Object.entries(existingAliases).find(([, data]) => data.url === url);

    if (existingAliasForUrl) {
      const [aliasKey, aliasData] = existingAliasForUrl;
      let updated = false;

      if (!aliasData.source || aliasData.source === 'manual') {
        aliasData.source = 'bookmark';
        updated = true;
      }
      if (aliasData.bookmarkPath !== bookmarkPath) {
          aliasData.bookmarkPath = bookmarkPath;
          updated = true;
      }

      if (isAIGeneration && aliasData.source !== 'bookmark-ai') {
        let generatedAIKeywords = [];
        try {
            const aiData = await aiEngine.generateDescription({ title, url, content: '' }, performanceClass);
            generatedAIKeywords = aiData.keywords;
        } catch (e) {
            console.warn("AI generation failed for existing bookmark (URL):", title, e);
            generatedAIKeywords = aiEngine.extractKeywords(title, url);
        }
        aliasData.keywords = generatedAIKeywords;
        aliasData.source = 'bookmark-ai';
        updated = true;
      }

      if (updated) {
        await storage.updateAlias(aliasKey, aliasData);
        return { action: 'updated', alias: aliasKey };
      }
      return { action: 'skipped_existing', alias: aliasKey };
    }

    let generatedAlias;
    let generatedKeywords = [];
    let generatedDescription = title;

    if (isAIGeneration) {
        try {
            const aiData = await aiEngine.generateDescription({ title, url, content: '' }, performanceClass);
            generatedAlias = aiData.suggestedAlias;
            generatedKeywords = aiData.keywords;
        } catch (e) {
            console.warn("AI generation failed for new bookmark:", title, e);
            generatedAlias = generateSafeAlias(title, existingAliases);
            generatedKeywords = aiEngine.extractKeywords(title, url);
        }
    } else {
        generatedAlias = generateSafeAlias(title, existingAliases);
        generatedKeywords = aiEngine.extractKeywords(title, url);
    }
    
    let finalAlias = generateSafeAlias(generatedAlias, existingAliases);

    const newAliasData = {
      url: url,
      description: generatedDescription,
      keywords: generatedKeywords,
      tags: [],
      created: new Date().toISOString(),
      usageCount: 0,
      lastUsed: null,
      source: isAIGeneration ? 'bookmark-ai' : 'bookmark',
      bookmarkPath: bookmarkPath
    };

    await storage.saveAlias(finalAlias, newAliasData);
    return { action: 'added', alias: finalAlias };
  }
  return null;
}

async function traverseBookmarks(bookmarkNodes, existingAliases, isAIGeneration = false, performanceClass = 'Medium') {
  let results = [];
  for (const node of bookmarkNodes) {
    if (node.url) {
      const result = await processBookmark(node, existingAliases, isAIGeneration, performanceClass);
      if (result && result.action !== 'skipped_existing') results.push(result);
    }
    if (node.children) {
      results = results.concat(await traverseBookmarks(node.children, existingAliases, isAIGeneration, performanceClass));
    }
  }
  return results;
}


// --- Omnibox API Listeners ---

// onInputChanged - для предложений в выпадающем списке
chrome.omnibox.onInputChanged.addListener(async (input, suggest) => {
  const aliases = await storage.getAliases();
  const { mode, query } = CommandParser.parse(input);
  let suggestions = [];

  if (!query) {
    chrome.omnibox.setDefaultSuggestion({
      description: `<url>${escapeXml("Начните вводить запрос или alias...")}</url>`
    });

    const recentAliases = Object.values(aliases)
      .sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0))
      .slice(0, 5);
    suggestions = recentAliases.map(aliasData => ({
      content: aliasData.url,
      description: `<url>${escapeXml(aliasData.url)}</url> - ${escapeXml(aliasData.description)} (<dim>${aliasData.usageCount} uses</dim>)`
    }));
    suggest(suggestions);
    return;
  }

  try {
    // 1. Прямое совпадение алиаса
    const directMatchAlias = Object.keys(aliases).find(key => key === query);
    if (directMatchAlias) {
      const aliasData = aliases[directMatchAlias];
      suggestions.push({
        content: aliasData.url,
        description: `<match>🔗 ${escapeXml(directMatchAlias)}</match> - ${escapeXml(aliasData.description)} <url>${escapeXml(aliasData.url)}</url>`
      });
      if (mode === 'direct' && suggestions.length > 0) {
        suggest(suggestions);
        return;
      }
    }

    // 2. Fuzzy-поиск
    if (mode === 'fuzzy' || mode === 'smart' || mode === 'direct') {
      const fuzzyResults = fuzzySearch.search(query, aliases);
      const fuzzySuggestions = fuzzyResults.map(result => ({
        content: result.url,
        description: `<dim>🔍</dim> <match>${escapeXml(result.alias)}</match> - ${escapeXml(result.description)} <url>${escapeXml(result.url)}</url> (<dim>${Math.round(result.score * 100)}%</dim>)`
      }));
      suggestions = [...suggestions, ...fuzzySuggestions].filter((s, i, a) => a.findIndex(t => (t.content === s.content)) === i);
    }
    
    // 3. AI-поиск
    if (mode === 'ai' || (mode === 'smart' && suggestions.length < 3)) {
      const performanceClass = getDevicePerformanceClass(); // Получаем здесь, чтобы использовать в AI
      const aiResults = await aiEngine.semanticSearch(query, aliases, performanceClass); // AI-поиск тоже можно адаптировать
      const aiSuggestions = aiResults.map(result => ({
        content: result.url,
        description: `<dim>🤖</dim> <match>${escapeXml(result.alias)}</match> - ${escapeXml(result.description)} <url>${escapeXml(result.url)}</url> (<dim>${Math.round(result.score * 100)}%</dim>)`
      }));
      suggestions = [...suggestions, ...aiSuggestions].filter((s, i, a) => a.findIndex(t => (t.content === s.content)) === i);
    }

  } catch (error) {
    console.error("Omnibox search error:", error);
    suggestions.push({
      content: "error",
      description: `<dim>❌</dim> Ошибка при поиске: ${escapeXml(error.message)}`
    });
  }

  // Окончательная сортировка и уникализация
  suggestions.sort((a, b) => {
    const isADirect = a.description.includes('🔗');
    const isBDirect = b.description.includes('🔗');

    if (isADirect && !isBDirect) return -1;
    if (!isADirect && isBDirect) return 1;

    const scoreA = parseFloat((a.description.match(/\((\d+)%\)/) || [])[1]) || 0;
    const scoreB = parseFloat((b.description.match(/\((\d+)%\)/) || [])[1]) || 0;
    return scoreB - scoreA;
  });

  const finalUniqueSuggestions = [];
  const seenContent = new Set();
  for (const s of suggestions) {
    if (!seenContent.has(s.content)) {
      finalUniqueSuggestions.push(s);
      seenContent.add(s.content);
    }
  }
  suggest(finalUniqueSuggestions.slice(0, 5));
});


// onInputEntered - для обработки выбранного предложения или окончательного ввода
chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
  let urlToNavigate = text;
  let statsKeyToIncrement = null;
  let aliasFoundByGoAliasSearch = null;

  const aliases = await storage.getAliases();
  const { mode, query } = CommandParser.parse(text);

  let finalResultUrl = null;

  // 1. Прямое совпадение алиаса
  const directMatch = aliases[query];
  if (directMatch) {
    finalResultUrl = directMatch.url;
    aliasFoundByGoAliasSearch = query;
    statsKeyToIncrement = 'directAliasLaunches';
  }

  // 2. Fuzzy-поиск (явный 'fz' или в Smart-режиме)
  if (!finalResultUrl && (mode === 'fuzzy' || mode === 'smart')) {
    const fuzzyResults = fuzzySearch.search(query, aliases);
    if (fuzzyResults.length > 0) {
      finalResultUrl = fuzzyResults[0].url;
      aliasFoundByGoAliasSearch = fuzzyResults[0].alias;
      statsKeyToIncrement = 'fuzzySearchLaunches';
    }
  }

  // 3. AI-поиск (явный 'ai' или в Smart-режиме)
  if (!finalResultUrl && (mode === 'ai' || mode === 'smart')) {
    const performanceClass = getDevicePerformanceClass();
    const aiResults = await aiEngine.semanticSearch(query, aliases, performanceClass);
    if (aiResults.length > 0) {
      finalResultUrl = aiResults[0].url;
      aliasFoundByGoAliasSearch = aiResults[0].alias;
      statsKeyToIncrement = 'aiSearchLaunches';
    }
  }

  if (finalResultUrl) {
    urlToNavigate = finalResultUrl;
  } else if (!urlToNavigate.startsWith('http')) {
    urlToNavigate = `https://www.google.com/search?q=${encodeURIComponent(text)}`;
    statsKeyToIncrement = 'googleFallbackLaunches';
  } else {
    statsKeyToIncrement = null; // Не инкрементируем GoAlias статистику
  }

  // Обновляем статистику Omnibox
  if (statsKeyToIncrement) {
    await storage.updateStats(statsKeyToIncrement);
  }

  // Обновляем usageCount и lastUsed для конкретного алиаса, если он был использован
  if (aliasFoundByGoAliasSearch) {
    await storage.updateAlias(aliasFoundByGoAliasSearch, {
      usageCount: aliases[aliasFoundByGoAliasSearch].usageCount + 1,
      lastUsed: new Date().toISOString()
    });
  }

  switch (disposition) {
    case "currentTab":
      await chrome.tabs.update({ url: urlToNavigate });
      break;
    case "newForegroundTab":
      await chrome.tabs.create({ url: urlToNavigate });
      break;
    case "newBackgroundTab":
      await chrome.tabs.create({ url: urlToNavigate, active: false });
      break;
  }
});


// --- Runtime Messages (от popup, options page, content script) ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    // Этот performanceClass используется только для AI-вызовов из popup/options
    const performanceClass = getDevicePerformanceClass(); 

    switch (request.action) {
      case 'getAliases':
        sendResponse(await storage.getAliases());
        break;
      case 'saveAlias':
        if (!request.data.source) request.data.source = 'manual';
        if (request.data.source !== 'manual' && !request.data.bookmarkPath) request.data.bookmarkPath = '/';
        await storage.saveAlias(request.alias, request.data);
        sendResponse({ success: true });
        break;
      case 'updateAlias':
        await storage.updateAlias(request.alias, request.data);
        sendResponse({ success: true });
        break;
      case 'deleteAlias':
        await storage.deleteAlias(request.alias);
        sendResponse({ success: true });
        break;
      case 'generateContentForPopup':
        const tabId = request.tabId;
        const url = request.url;
        const title = request.title;

        try {
          let pageContent = '';
          if (tabId) {
              const results = await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content_script.js']
              });
              if (results && results[0] && results[0].result) {
                pageContent = results[0].result;
              }
          }
          
          const aiData = await aiEngine.generateDescription({ title, url, content: pageContent }, performanceClass);

          const allAliases = await storage.getAliases();
          const finalSuggestedAlias = generateSafeAlias(aiData.suggestedAlias, allAliases);

          sendResponse({
            success: true,
            suggestedAlias: finalSuggestedAlias,
            keywords: aiData.keywords
          });

        } catch (error) {
          console.error("Error generating content for popup:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;
      case 'openOptionsPage':
          try {
            chrome.runtime.openOptionsPage();
            sendResponse({ success: true });
          } catch (error) {
            console.error("Error opening options page from background:", error);
            sendResponse({ success: false, error: error.message });
          }
        break;

      case 'syncBookmarks':
        try {
          const bookmarkTree = await chrome.bookmarks.getTree();
          const currentAliases = await storage.getAliases();
          const results = await traverseBookmarks(bookmarkTree, currentAliases); 
          sendResponse({ success: true, results });
        } catch (error) {
          console.error("Error syncing bookmarks:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;
      
      case 'generateAIKeywordsForBookmarks':
        try {
          const bookmarkTree = await chrome.bookmarks.getTree();
          const currentAliases = await storage.getAliases();
          const results = await traverseBookmarks(bookmarkTree, currentAliases, true, performanceClass);
          sendResponse({ success: true, results });
        } catch (error) {
          console.error("Error generating AI keywords for bookmarks:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'getBookmarkFolders':
        try {
            const aliases = await storage.getAliases();
            const uniqueFolders = new Set();
            uniqueFolders.add("/");
            for (const aliasKey in aliases) {
                if (aliases[aliasKey].bookmarkPath) {
                    uniqueFolders.add(aliases[aliasKey].bookmarkPath);
                }
            }
            sendResponse({ success: true, folders: Array.from(uniqueFolders).sort() });
        } catch (error) {
            console.error("Error getting bookmark folders:", error);
            sendResponse({ success: false, error: error.message });
        }
        break;

      case 'deleteAllBookmarksAliases':
        try {
            const aliasesToDelete = [];
            const allAliases = await storage.getAliases();
            for (const aliasKey in allAliases) {
                if (allAliases[aliasKey].source === 'bookmark' || allAliases[aliasKey].source === 'bookmark-ai') {
                    aliasesToDelete.push(aliasKey);
                }
            }
            for (const aliasKey of aliasesToDelete) {
                await storage.deleteAlias(aliasKey);
            }
            sendResponse({ success: true, deletedCount: aliasesToDelete.length });
        } catch (error) {
            console.error("Error deleting all bookmark aliases:", error);
            sendResponse({ success: false, error: error.message });
        }
        break;

      case 'deleteAllAliases':
        try {
            await storage.clearAliases();
            sendResponse({ success: true });
        } catch (error) {
            console.error("Error deleting all aliases:", error);
            sendResponse({ success: false, error: error.message });
        }
        break;
      
      case 'deleteAllAliasesInFolder':
        try {
            const folderPathToDelete = request.folderPath;
            if (!folderPathToDelete) {
                sendResponse({ success: false, error: 'Folder path not provided.' });
                return;
            }

            const aliasesToDelete = [];
            const allAliases = await storage.getAliases();
            for (const aliasKey in allAliases) {
                if ((allAliases[aliasKey].source === 'bookmark' || allAliases[aliasKey].source === 'bookmark-ai') && 
                    allAliases[aliasKey].bookmarkPath === folderPathToDelete) {
                    aliasesToDelete.push(aliasKey);
                }
            }
            for (const aliasKey of aliasesToDelete) {
                await storage.deleteAlias(aliasKey);
            }
            sendResponse({ success: true, deletedCount: aliasesToDelete.length });
        } catch (error) {
            console.error("Error deleting aliases in folder:", error);
            sendResponse({ success: false, error: error.message });
        }
        break;

      case 'getStats':
        try {
            sendResponse(await storage.getStats());
        } catch (error) {
            console.error("Error getting stats:", error);
            sendResponse({ success: false, error: error.message });
        }
        break;

      case 'clearStats':
        try {
            await storage.clearStats();
            sendResponse({ success: true });
        } catch (error) {
            console.error("Error clearing stats:", error);
            sendResponse({ success: false, error: error.message });
        }
        break;

      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  })();
  return true;
});


// --- On Installation ---
chrome.runtime.onInstalled.addListener(async () => {
  const aliases = await storage.getAliases();
  if (Object.keys(aliases).length === 0) {
    for (const alias in DEFAULT_ALIASES) {
      await storage.saveAlias(alias, DEFAULT_ALIASES[alias]);
    }
    console.log("Default GoAlias aliases added.");
  }
});