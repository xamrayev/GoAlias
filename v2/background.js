// Background script для AI Shortlinker
let bookmarksCache = {};
let aliasMap = {};

// Инициализация при установке
chrome.runtime.onInstalled.addListener(() => {
  console.log('AI Shortlinker установлен');
  syncBookmarks();
});

// Синхронизация закладок
async function syncBookmarks() {
  try {
    const bookmarkTree = await chrome.bookmarks.getTree();
    bookmarksCache = {};
    aliasMap = {};
    
    // Рекурсивно обходим дерево закладок
    function processBookmarks(nodes, parentPath = '') {
      nodes.forEach(node => {
        if (node.children) {
          // Это папка - создаем alias
          const folderName = node.title.toLowerCase().replace(/\s+/g, '');
          const folderPath = parentPath ? `${parentPath}/${folderName}` : folderName;
          
          if (folderName && !aliasMap[folderName]) {
            aliasMap[folderName] = {
              title: node.title,
              path: folderPath,
              bookmarks: []
            };
          }
          
          // Рекурсивно обрабатываем дочерние элементы
          processBookmarks(node.children, folderPath);
        } else if (node.url) {
          // Это закладка
          const bookmark = {
            id: node.id,
            title: node.title,
            url: node.url,
            parentId: node.parentId
          };
          
          // Находим родительскую папку
          const parentFolder = findParentFolder(node.parentId, bookmarkTree[0]);
          if (parentFolder) {
            const alias = parentFolder.toLowerCase().replace(/\s+/g, '');
            if (aliasMap[alias]) {
              aliasMap[alias].bookmarks.push(bookmark);
            }
          }
          
          // Добавляем в общий кеш
          bookmarksCache[node.id] = bookmark;
        }
      });
    }
    
    processBookmarks(bookmarkTree[0].children);
    
    // Сохраняем в storage
    await chrome.storage.local.set({
      bookmarksCache: bookmarksCache,
      aliasMap: aliasMap,
      lastSync: Date.now()
    });
    
    console.log('Закладки синхронизированы:', Object.keys(aliasMap));
  } catch (error) {
    console.error('Ошибка синхронизации:', error);
  }
}

// Поиск родительской папки
function findParentFolder(parentId, root, path = '') {
  if (root.id === parentId) {
    return root.title || path;
  }
  
  if (root.children) {
    for (let child of root.children) {
      const result = findParentFolder(parentId, child, path ? `${path}/${child.title}` : child.title);
      if (result) return result;
    }
  }
  
  return null;
}

// Обработка поиска через omnibox
chrome.omnibox.onInputChanged.addListener((text, suggest) => {
  const suggestions = searchBookmarks(text);
  const formatted = suggestions.slice(0, 6).map(item => ({
    content: item.url,
    description: `${item.title} - <dim>${item.url}</dim>`
  }));
  
  suggest(formatted);
});

chrome.omnibox.onInputEntered.addListener((text) => {
  // Если это URL, открываем его
  if (text.startsWith('http')) {
    chrome.tabs.update({ url: text });
  } else {
    // Иначе ищем первую подходящую закладку
    const results = searchBookmarks(text);
    if (results.length > 0) {
      chrome.tabs.update({ url: results[0].url });
    }
  }
});

// Поиск закладок
function searchBookmarks(query) {
  const parts = query.trim().split(' ');
  const alias = parts[0].toLowerCase();
  const searchTerm = parts.slice(1).join(' ').toLowerCase();
  
  let results = [];
  
  // Если указан alias, ищем в конкретной папке
  if (aliasMap[alias]) {
    results = aliasMap[alias].bookmarks.filter(bookmark => {
      return !searchTerm || 
             bookmark.title.toLowerCase().includes(searchTerm) ||
             bookmark.url.toLowerCase().includes(searchTerm);
    });
  } else {
    // Иначе ищем во всех закладках
    const fullQuery = query.toLowerCase();
    results = Object.values(bookmarksCache).filter(bookmark => {
      return bookmark.title.toLowerCase().includes(fullQuery) ||
             bookmark.url.toLowerCase().includes(fullQuery);
    });
  }
  
  return results.slice(0, 10);
}

// Обработка сообщений от popup/manage
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'syncBookmarks':
      syncBookmarks().then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true;
      
    case 'getBookmarks':
      chrome.storage.local.get(['bookmarksCache', 'aliasMap', 'lastSync']).then(data => {
        sendResponse(data);
      });
      return true;
      
    case 'searchBookmarks':
      const results = searchBookmarks(request.query);
      sendResponse({ results });
      return true;
  }
});

// Загружаем данные при старте
chrome.storage.local.get(['bookmarksCache', 'aliasMap']).then(data => {
  if (data.bookmarksCache) bookmarksCache = data.bookmarksCache;
  if (data.aliasMap) aliasMap = data.aliasMap;
});