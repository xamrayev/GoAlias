// background.js

import { AIEngine } from './ai-engine.js';    // <--- ПУТИ ИЗМЕНЕНЫ
import { FuzzySearch } from './fuzzy-search.js'; // <--- ПУТИ ИЗМЕНЕНЫ
import { StorageManager } from './utils.js';     // <--- ПУТИ ИЗМЕНЕНЫ

const storage = new StorageManager();
const aiEngine = new AIEngine();
const fuzzySearch = new FuzzySearch();

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
    "lastUsed": null
  },
  "google": {
    "url": "https://www.google.com",
    "description": "Поисковая система Google",
    "keywords": ["search", "google", "engine"],
    "tags": ["search"],
    "created": "2024-01-01T00:00:00Z",
    "usageCount": 0,
    "lastUsed": null
  }
};

// --- Command Parser ---
const CommandParser = {
  parse(input) {
    input = input.trim();
    if (input.startsWith('ai ')) {
      return { mode: 'ai', query: input.substring(3).trim() };
    } else if (input.startsWith('fz ')) {
      return { mode: 'fuzzy', query: input.substring(3).trim() };
    } else if (input) {
      // Smart default: try direct, then fuzzy, then AI if it looks like a semantic query
      return { mode: 'smart', query: input };
    }
    return { mode: 'none', query: '' }; // Empty input
  }
};

// --- Omnibox API Listeners ---

chrome.omnibox.onInputChanged.addListener(async (input, suggest) => {
  const aliases = await storage.getAliases();
  const { mode, query } = CommandParser.parse(input);
  let suggestions = [];

  if (!query) {
    // Show some default suggestions or recently used aliases
    const recentAliases = Object.values(aliases)
      .sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0))
      .slice(0, 5);
    suggestions = recentAliases.map(aliasData => ({
      content: aliasData.url, // This is the URL that will be navigated to
      description: `<url>${aliasData.url}</url> - ${aliasData.description} (${aliasData.usageCount} uses)`
    }));
    suggest(suggestions);
    return;
  }

  try {
    if (mode === 'direct' || mode === 'smart') {
      // 1. Try direct match first for smart and direct modes
      const directMatch = aliases[query];
      if (directMatch) {
        suggestions.push({
          content: directMatch.url,
          description: `<match>🔗 ${query}</match> - ${directMatch.description} <url>${directMatch.url}</url>`
        });
      }
      if (mode === 'direct' && suggestions.length > 0) {
        suggest(suggestions);
        return; // For direct mode, we only care about direct matches
      }
    }

    if (mode === 'fuzzy' || mode === 'smart') {
      // 2. Perform fuzzy search
      const fuzzyResults = fuzzySearch.search(query, aliases);
      const fuzzySuggestions = fuzzyResults.map(result => ({
        content: result.url,
        description: `<dim>🔍</dim> <match>${result.alias}</match> - ${result.description} <url>${result.url}</url> (<dim>${Math.round(result.score * 100)}%</dim>)`
      }));
      suggestions = [...suggestions, ...fuzzySuggestions].slice(0, 5); // Limit suggestions
    }

    // AI search should be primary for 'ai' mode or fallback for 'smart' mode if fuzzy is weak/empty
    if (mode === 'ai' || (mode === 'smart' && suggestions.length < 3)) {
      const aiResults = await aiEngine.semanticSearch(query, aliases);
      const aiSuggestions = aiResults.map(result => ({
        content: result.url,
        description: `<dim>🤖</dim> <match>${result.alias}</match> - ${result.description} <url>${result.url}</url> (<dim>${Math.round(result.score * 100)}%</dim>)`
      }));
      suggestions = [...suggestions, ...aiSuggestions].slice(0, 5);
    }

  } catch (error) {
    console.error("Omnibox search error:", error);
    suggestions.push({
      content: "error",
      description: `<dim>❌</dim> Ошибка при поиске: ${error.message}`
    });
  }

  // Deduplicate and sort (e.g., by score, then by usage)
  const uniqueSuggestions = [];
  const seenUrls = new Set();
  for (const s of suggestions) {
    if (!seenUrls.has(s.content)) {
      uniqueSuggestions.push(s);
      seenUrls.add(s.content);
    }
  }

  // Final sort: Direct matches first, then fuzzy/AI by score
  uniqueSuggestions.sort((a, b) => {
    const isADirect = a.description.includes('🔗');
    const isBDirect = b.description.includes('🔗');

    if (isADirect && !isBDirect) return -1;
    if (!isADirect && isBDirect) return 1;

    // Extract scores for AI/Fuzzy for secondary sort
    const scoreA = parseFloat((a.description.match(/\((\d+)%\)/) || [])[1]) || 0;
    const scoreB = parseFloat((b.description.match(/\((\d+)%\)/) || [])[1]) || 0;
    return scoreB - scoreA;
  });

  suggest(uniqueSuggestions.slice(0, 5)); // Show top 5 unique suggestions
});


chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
  let urlToNavigate = text;

  // If the user directly typed an alias or a query without selecting a suggestion
  const aliases = await storage.getAliases();
  const { mode, query } = CommandParser.parse(text);

  // Try direct match first if it's not a specific AI/Fuzzy command
  if (mode === 'smart' || mode === 'direct') {
    const directMatch = aliases[query];
    if (directMatch) {
      urlToNavigate = directMatch.url;
    }
  }
  
  // If the text isn't a direct alias and isn't a recognized URL
  if (!urlToNavigate.startsWith('http')) {
      // This means user entered a query, and no direct alias matched,
      // so we should default to a search result or try to find a URL from a previous omnibox suggestion
      // For simplicity, we'll try to find the best match from aliases again,
      // otherwise, redirect to a default search engine
      let finalUrl = null;
      if (mode === 'ai') {
        const aiResults = await aiEngine.semanticSearch(query, aliases);
        if (aiResults.length > 0) finalUrl = aiResults[0].url;
      } else if (mode === 'fuzzy') {
        const fuzzyResults = fuzzySearch.search(query, aliases);
        if (fuzzyResults.length > 0) finalUrl = fuzzyResults[0].url;
      } else if (mode === 'smart' || mode === 'direct') { // Already handled direct, now fuzzy/AI if smart
         const fuzzyResults = fuzzySearch.search(query, aliases);
         if (fuzzyResults.length > 0) finalUrl = fuzzyResults[0].url;
         if (!finalUrl) {
            const aiResults = await aiEngine.semanticSearch(query, aliases);
            if (aiResults.length > 0) finalUrl = aiResults[0].url;
         }
      }

      if (finalUrl) {
        urlToNavigate = finalUrl;
      } else {
        // Fallback to Google search if no alias matched
        urlToNavigate = `https://www.google.com/search?q=${encodeURIComponent(text)}`;
      }
  }

  // Update usage stats for the alias if found
  const aliasKey = Object.keys(aliases).find(key => aliases[key].url === urlToNavigate);
  if (aliasKey) {
    await storage.updateAlias(aliasKey, {
      usageCount: aliases[aliasKey].usageCount + 1,
      lastUsed: new Date().toISOString()
    });
  }

  // Navigate based on disposition
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


// --- Runtime Messages (from popup, options page, content script) ---

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    switch (request.action) {
      case 'getAliases':
        sendResponse(await storage.getAliases());
        break;
      case 'saveAlias':
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
        // This is called from popup.js when user clicks "Generate AI Keywords"
        const tabId = request.tabId;
        const url = request.url;
        const title = request.title;

        try {
          // Inject content script to get page content
          const results = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content_script.js']
          });

          let pageContent = '';
          if (results && results[0] && results[0].result) {
            pageContent = results[0].result;
          }

          // We only need keywords and suggested alias here for the popup's primary function
          // The AIEngine's generateDescription method returns both, we extract what's needed.
          const aiData = await aiEngine.generateDescription({ title, url, content: pageContent });
          
          sendResponse({
            success: true,
            suggestedAlias: aiData.suggestedAlias, // New field to return a suggested alias
            keywords: aiData.keywords
          });

        } catch (error) {
          console.error("Error generating content for popup:", error);
          sendResponse({ success: false, error: error.message });
        }
        break;
      case 'openOptionsPage': // New action to open options page from popup
          try {
            chrome.runtime.openOptionsPage();
            sendResponse({ success: true });
          } catch (error) {
            console.error("Error opening options page from background:", error);
            sendResponse({ success: false, error: error.message });
          }
        break;
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  })();
  return true; // Indicates an asynchronous response
});

// --- On Installation ---
chrome.runtime.onInstalled.addListener(async () => {
  const aliases = await storage.getAliases();
  if (Object.keys(aliases).length === 0) {
    // If no aliases exist, add some defaults
    for (const alias in DEFAULT_ALIASES) {
      await storage.saveAlias(alias, DEFAULT_ALIASES[alias]);
    }
    console.log("Default GoAlias aliases added.");
  }
});