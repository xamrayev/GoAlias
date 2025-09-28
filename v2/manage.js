// Manage page script для AI Shortlinker
let bookmarksData = {};
let aliasMap = {};
let currentView = 'tree';

document.addEventListener('DOMContentLoaded', async () => {
  // Элементы интерфейса
  const syncButton = document.getElementById('syncButton');
  const syncStatus = document.getElementById('syncStatus');
  const searchInput = document.getElementById('searchInput');
  const searchButton = document.getElementById('searchButton');
  const viewMode = document.getElementById('viewMode');
  const panelTitle = document.getElementById('panelTitle');
  const panelContent = document.getElementById('panelContent');

  // Инициализация
  await loadData();
  renderCurrentView();

  // Синхронизация
  syncButton.addEventListener('click', async () => {
    setSyncStatus('syncing', 'Синхронизация...');
    syncButton.disabled = true;
    
    try {
      const response = await chrome.runtime.sendMessage({ action: 'syncBookmarks' });
      
      if (response.success) {
        setSyncStatus('success', 'Синхронизировано!');
        await loadData();
        renderCurrentView();
        
        setTimeout(() => {
          setSyncStatus('ready', 'Готов');
        }, 2000);
      } else {
        setSyncStatus('error', 'Ошибка');
        console.error('Ошибка синхронизации:', response.error);
      }
    } catch (error) {
      setSyncStatus('error', 'Ошибка');
      console.error('Ошибка:', error);
    } finally {
      syncButton.disabled = false;
    }
  });

  // Поиск
  searchInput.addEventListener('input', debounce(performSearch, 300));
  searchButton.addEventListener('click', performSearch);
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
  });

  // Переключение режимов просмотра
  viewMode.addEventListener('change', (e) => {
    currentView = e.target.value;
    renderCurrentView();
  });

  // Загрузка данных
  async function loadData() {
    try {
      const data = await chrome.runtime.sendMessage({ action: 'getBookmarks' });
      
      if (data) {
        bookmarksData = data.bookmarksCache || {};
        aliasMap = data.aliasMap || {};
        
        updateStats(data);
        renderAliases();
      }
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
    }
  }

  // Обновление статистики
  function updateStats(data) {
    const totalBookmarks = Object.keys(data.bookmarksCache || {}).length;
    const totalFolders = Object.keys(data.aliasMap || {}).length;
    
    document.getElementById('totalBookmarks').textContent = totalBookmarks;
    document.getElementById('totalFolders').textContent = totalFolders;

    if (data.lastSync) {
      const syncDate = new Date(data.lastSync);
      document.getElementById('lastSync').textContent = formatDate(syncDate);
    }
  }

  // Отображение alias
  function renderAliases() {
    const aliasesList = document.getElementById('aliasesList');
    aliasesList.innerHTML = '';

    const aliases = Object.entries(aliasMap).sort(([a], [b]) => a.localeCompare(b));

    aliases.forEach(([alias, data]) => {
      const item = document.createElement('div');
      item.className = 'alias-item';
      
      item.innerHTML = `
        <div class="alias-name">${alias}</div>
        <div class="alias-info">${data.bookmarks.length} закладок</div>
      `;
      
      item.addEventListener('click', () => {
        showAliasContent(alias, data);
      });
      
      aliasesList.appendChild(item);
    });
  }

  // Показать содержимое alias
  function showAliasContent(alias, data) {
    const listView = document.getElementById('listView');
    
    panelTitle.textContent = `📁 ${data.title} (${alias})`;
    
    listView.innerHTML = '';
    
    data.bookmarks.forEach(bookmark => {
      const item = createBookmarkItem(bookmark);
      listView.appendChild(item);
    });
    
    // Переключаем в режим списка
    showView('list');
    viewMode.value = 'list';
    currentView = 'list';
  }

  // Поиск
  async function performSearch() {
    const query = searchInput.value.trim();
    if (!query) return;
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'searchBookmarks',
        query: query
      });
      
      if (response.results) {
        showSearchResults(response.results, query);
      }
    } catch (error) {
      console.error('Ошибка поиска:', error);
    }
  }

  // Показать результаты поиска
  function showSearchResults(results, query) {
    const searchResults = document.getElementById('searchResults');
    
    panelTitle.textContent = `🔍 Результаты поиска: "${query}"`;
    
    if (results.length === 0) {
      searchResults.innerHTML = '<div class="empty-state">Ничего не найдено</div>';
    } else {
      searchResults.innerHTML = `<div class="search-info">Найдено: ${results.length} результатов</div>`;
      
      results.forEach(bookmark => {
        const item = createBookmarkItem(bookmark, query);
        searchResults.appendChild(item);
      });
    }
    
    // Переключаем в режим поиска
    showView('search');
    viewMode.value = 'search';
    currentView = 'search';
  }

  // Создание элемента закладки
  function createBookmarkItem(bookmark, highlightQuery = '') {
    const item = document.createElement('div');
    item.className = 'bookmark-item';
    
    const favicon = getFaviconUrl(bookmark.url);
    let title = escapeHtml(bookmark.title);
    let url = bookmark.url;
    
    // Подсветка результатов поиска
    if (highlightQuery) {
      const regex = new RegExp(`(${escapeRegex(highlightQuery)})`, 'gi');
      title = title.replace(regex, '<mark>$1</mark>');
    }
    
    item.innerHTML = `
      <div class="bookmark-favicon">
        <img src="${favicon}" alt="" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTggMTZBOCA4IDAgMSAwIDggMGE4IDggMCAwIDAgMCAxNloiIGZpbGw9IiNlNWU3ZWIiLz4KPC9zdmc+'" />
      </div>
      <div class="bookmark-content">
        <div class="bookmark-title">${title}</div>
        <div class="bookmark-url">${escapeHtml(url)}</div>
      </div>
      <div class="bookmark-actions">
        <button class="btn-icon" onclick="openBookmark('${escapeHtml(url)}')" title="Открыть">🔗</button>
        <button class="btn-icon" onclick="copyToClipboard('${escapeHtml(url)}')" title="Копировать URL">📋</button>
      </div>
    `;
    
    return item;
  }

  // Отображение текущего режима
  function renderCurrentView() {
    switch (currentView) {
      case 'tree':
        renderTreeView();
        panelTitle.textContent = '📁 Структура закладок';
        showView('tree');
        break;
      case 'list':
        renderListView();
        panelTitle.textContent = '📋 Все закладки';
        showView('list');
        break;
      case 'search':
        panelTitle.textContent = '🔍 Поиск';
        showView('search');
        break;
    }
  }

  // Показать нужный view
  function showView(viewName) {
    document.getElementById('treeView').style.display = viewName === 'tree' ? 'block' : 'none';
    document.getElementById('listView').style.display = viewName === 'list' ? 'block' : 'none';
    document.getElementById('searchView').style.display = viewName === 'search' ? 'block' : 'none';
  }

  // Отображение дерева папок
  function renderTreeView() {
    const treeView = document.getElementById('treeView');
    treeView.innerHTML = '';

    if (Object.keys(aliasMap).length === 0) {
      treeView.innerHTML = '<div class="empty-state">Нет синхронизированных папок. Нажмите "Синхронизировать"</div>';
      return;
    }

    const folders = Object.entries(aliasMap).sort(([a], [b]) => a.localeCompare(b));

    folders.forEach(([alias, data]) => {
      const folderItem = document.createElement('div');
      folderItem.className = 'folder-item';
      
      folderItem.innerHTML = `
        <div class="folder-header" onclick="toggleFolder('${alias}')">
          <span class="folder-icon">📁</span>
          <span class="folder-name">${escapeHtml(data.title)}</span>
          <span class="folder-alias">(${alias})</span>
          <span class="folder-count">${data.bookmarks.length}</span>
          <span class="folder-toggle">▼</span>
        </div>
        <div class="folder-content" id="folder-${alias}" style="display: none;">
          ${data.bookmarks.map(bookmark => `
            <div class="tree-bookmark-item">
              <img src="${getFaviconUrl(bookmark.url)}" class="tree-favicon" alt="" />
              <div class="tree-bookmark-info">
                <div class="tree-bookmark-title">${escapeHtml(bookmark.title)}</div>
                <div class="tree-bookmark-url">${escapeHtml(bookmark.url)}</div>
              </div>
              <div class="tree-bookmark-actions">
                <button class="btn-icon" onclick="openBookmark('${escapeHtml(bookmark.url)}')" title="Открыть">🔗</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
      
      treeView.appendChild(folderItem);
    });
  }

  // Отображение списка всех закладок
  function renderListView() {
    const listView = document.getElementById('listView');
    listView.innerHTML = '';

    const allBookmarks = Object.values(bookmarksData).sort((a, b) => 
      a.title.localeCompare(b.title)
    );

    if (allBookmarks.length === 0) {
      listView.innerHTML = '<div class="empty-state">Нет закладок</div>';
      return;
    }

    allBookmarks.forEach(bookmark => {
      const item = createBookmarkItem(bookmark);
      listView.appendChild(item);
    });
  }

  // Установка статуса синхронизации
  function setSyncStatus(status, text) {
    const statusDot = syncStatus.querySelector('.status-dot');
    const statusText = syncStatus.querySelector('.status-text');
    
    statusDot.className = `status-dot status-${status}`;
    statusText.textContent = text;
  }

  // Вспомогательные функции
  function getFaviconUrl(url) {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
    } catch (e) {
      return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTggMTZBOCA4IDAgMSAwIDggMGE4IDggMCAwIDAgMCAxNloiIGZpbGw9IiNlNWU3ZWIiLz4KPC9zdmc+';
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

function escapeRegex(text) {
  // Escapes special regex characters: .*+?^${}()|[]\
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

  function formatDate(date) {
    const now = new Date();
    const diffMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffMinutes < 1) return 'только что';
    if (diffMinutes < 60) return `${diffMinutes} мин назад`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} ч назад`;
    return date.toLocaleDateString('ru-RU');
  }

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
});

// Глобальные функции для использования в HTML
window.toggleFolder = function(alias) {
  const content = document.getElementById(`folder-${alias}`);
  const header = content.previousElementSibling;
  const toggle = header.querySelector('.folder-toggle');
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    toggle.textContent = '▲';
    header.classList.add('expanded');
  } else {
    content.style.display = 'none';
    toggle.textContent = '▼';
    header.classList.remove('expanded');
  }
};

window.openBookmark = function(url) {
  chrome.tabs.create({ url: url });
};

window.copyToClipboard = function(text) {
  navigator.clipboard.writeText(text).then(() => {
    // Показать уведомление
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = 'URL скопирован!';
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 2000);
  }).catch(err => {
    console.error('Ошибка копирования:', err);
  });
};