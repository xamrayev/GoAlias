// utils.js

export class StorageManager {
  constructor() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      this.storage = chrome.storage.local;
    } else {
      console.error("Chrome storage API is not available.");
      this.storage = {
        get: async () => ({}),
        set: async () => {},
        remove: async () => {}
      };
    }
  }

  async getAliases() {
    const result = await this.storage.get('aliases');
    return result.aliases || {};
  }

  async saveAlias(alias, data) {
    const aliases = await this.getAliases();
    const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/--+/g, '-').trim();
    const finalAlias = cleanAlias.endsWith('-') ? cleanAlias.slice(0, -1) : cleanAlias;
    
    const aliasData = { source: 'manual', bookmarkPath: '/', ...data };
    
    aliases[finalAlias] = { ...aliases[finalAlias], ...aliasData };
    await this.storage.set({ aliases });
  }

  async updateAlias(alias, partialData) {
    const aliases = await this.getAliases();
    if (aliases[alias]) {
      aliases[alias] = { ...aliases[alias], ...partialData };
      await this.storage.set({ aliases });
    } else {
      console.warn(`Attempted to update non-existent alias: ${alias}`);
    }
  }

  async deleteAlias(alias) {
    const aliases = await this.getAliases();
    delete aliases[alias];
    await this.storage.set({ aliases });
  }

  async clearAliases() {
    await this.storage.remove('aliases');
  }

  // --- НОВЫЕ МЕТОДЫ ДЛЯ СТАТИСТИКИ ---
  async getStats() {
    const result = await this.storage.get('stats');
    console.log('[StorageManager] Raw result from chrome.storage.local.get("stats"):', result); // <-- ДОБАВЛЕНО
    console.log('[StorageManager] Extracted stats object:', result.stats); // <-- ДОБАВЛЕНО

    return result.stats || {
      "totalLaunches": 0,
      "directAliasLaunches": 0,
      "fuzzySearchLaunches": 0,
      "aiSearchLaunches": 0,
      "smartSearchLaunches": 0,
      "googleFallbackLaunches": 0
    };
  }

  async updateStats(key, increment = 1) {
    const stats = await this.getStats();
    stats[key] = (stats[key] || 0) + increment;
    stats.totalLaunches = (stats.totalLaunches || 0) + increment; // Обновляем общий счетчик
    await this.storage.set({ stats });
  }

  async clearStats() {
    await this.storage.remove('stats');
  }
  // --- КОНЕЦ НОВЫХ МЕТОДОВ ---
}

export function debounce(func, delay) {
  let timeout;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), delay);
  };
}

let cachedPerformanceClass = null;

export function getDevicePerformanceClass() {
    if (cachedPerformanceClass) {
        return cachedPerformanceClass;
    }

    const concurrency = navigator.hardwareConcurrency || 4;
    const deviceMemory = navigator.deviceMemory || 4;

    if (concurrency <= 2 || deviceMemory <= 2) {
        cachedPerformanceClass = 'Very Low';
    } else if (concurrency <= 4 || deviceMemory <= 4) {
        cachedPerformanceClass = 'Low';
    } else if (concurrency <= 8 || deviceMemory <= 8) {
        cachedPerformanceClass = 'Medium';
    } else {
        cachedPerformanceClass = 'High';
    }
    
    console.log(`Detected device performance: Concurrency=${concurrency}, Memory=${deviceMemory}GB => Class=${cachedPerformanceClass}`);
    return cachedPerformanceClass;
}