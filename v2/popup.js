// Popup script для AI Shortlinker
document.addEventListener('DOMContentLoaded', async () => {
  const syncButton = document.getElementById('syncButton');
  const manageButton = document.getElementById('manageButton');
  const syncStatus = document.getElementById('syncStatus');
  const recentBookmarks = document.getElementById('recentBookmarks');
  const lastSyncElement = document.getElementById('lastSync');
  const totalBookmarks = document.getElementById('totalBookmarks');
  const totalFolders = document.getElementById('totalFolders');

  // Загружаем статистику при открытии popup
  await loadStats();

  // Синхронизация закладок
  syncButton.addEventListener('click', async () => {
    setSyncStatus('syncing', 'Синхронизация...');
    syncButton.disabled = true;
    
    try {
      const response = await chrome.runtime.sendMessage({ action: 'syncBookmarks' });
      
      if (response.success) {
        setSyncStatus('success', 'Синхронизировано!');
        await loadStats();
        
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

  // Открытие страницы управления
  manageButton.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('manage.html') });
    window.close();
  });

  // Установка статуса синхронизации
  function setSyncStatus(status, text) {
    const statusDot = syncStatus.querySelector('.status-dot');
    const statusText = syncStatus.querySelector('.status-text');
    
    statusDot.className = `status-dot status-${status}`;
    statusText.textContent = text;
  }

  // Загрузка статистики
  async function loadStats() {
    try {
      const data = await chrome.runtime.sendMessage({ action: 'getBookmarks' });
      
      if (data) {
        // Статистика
        const bookmarksCount = Object.keys(data.bookmarksCache || {}).length;
        const foldersCount = Object.keys(data.aliasMap || {}).length;
        
        totalBookmarks.textContent = bookmarksCount;
        totalFolders.textContent = foldersCount;

        // Последняя синхронизация
        if (data.lastSync) {
          const syncDate = new Date(data.lastSync);
          const now = new Date();
          const diffMinutes = Math.floor((now - syncDate) / (1000 * 60));
          
          let timeText;
          if (diffMinutes < 1) {
            timeText = 'только что';
          } else if (diffMinutes < 60) {
            timeText = `${diffMinutes} мин назад`;
          } else if (diffMinutes < 1440) {
            const hours = Math.floor(diffMinutes / 60);
            timeText = `${hours} ч назад`;
          } else {
            timeText = syncDate.toLocaleDateString('ru-RU');
          }
          
          lastSyncElement.textContent = `Последняя синхронизация: ${timeText}`;
        }

        // Последние закладки (первые 5)
        displayRecentBookmarks(data.bookmarksCache || {});
      }
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
    }
  }

  // Отображение последних закладок
  function displayRecentBookmarks(bookmarksCache) {
    const bookmarks = Object.values(bookmarksCache).slice(0, 5);
    
    if (bookmarks.length === 0) {
      recentBookmarks.innerHTML = '<div class="empty-state">Нет закладок. Нажмите "Синхронизировать"</div>';
      return;
    }

    recentBookmarks.innerHTML = '';
    
    bookmarks.forEach(bookmark => {
      const item = document.createElement('div');
      item.className = 'recent-item';
      
      const favicon = getFaviconUrl(bookmark.url);
      
      item.innerHTML = `
        <img class="favicon" src="${favicon}" alt="" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTggMTZBOCA4IDAgMSAwIDggMGE4IDggMCAwIDAgMCAxNloiIGZpbGw9IiNlNWU3ZWIiLz4KPHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTggMTZBOCA4IDAgMSAwIDggMGE4IDggMCAwIDAgMCAxNloiIGZpbGw9IiNlNWU3ZWIiLz4KPC9zdmc+Cg=='" />
        <div class="bookmark-info">
          <div class="bookmark-title">${escapeHtml(bookmark.title)}</div>
          <div class="bookmark-url">${getDomain(bookmark.url)}</div>
        </div>
      `;
      
      item.addEventListener('click', () => {
        chrome.tabs.create({ url: bookmark.url });
        window.close();
      });
      
      recentBookmarks.appendChild(item);
    });
  }

  // Получение URL фавикона
  function getFaviconUrl(url) {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
    } catch (e) {
      return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTggMTZBOCA4IDAgMSAwIDggMGE4IDggMCAwIDAgMCAxNloiIGZpbGw9IiNlNWU3ZWIiLz4KPC9zdmc+';
    }
  }

  // Получение домена из URL
  function getDomain(url) {
    try {
      return new URL(url).hostname;
    } catch (e) {
      return url;
    }
  }

  // Экранирование HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});