// utils.js

export class StorageManager {
  constructor() {
    this.storage = chrome.storage.local; // Using local storage, consider chrome.storage.sync for cloud sync
  }

  /**
   * Retrieves all aliases.
   * @returns {Promise<Object>} - An object containing all aliases.
   */
  async getAliases() {
    const result = await this.storage.get('aliases');
    return result.aliases || {};
  }

  /**
   * Saves or updates a single alias.
   * @param {string} alias - The alias name.
   * @param {Object} data - The alias data (url, description, keywords, etc.).
   * @returns {Promise<void>}
   */
  async saveAlias(alias, data) {
    const aliases = await this.getAliases();
    // Ensure alias is clean
    const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/--+/g, '-').trim();
    if (cleanAlias.endsWith('-')) alias = cleanAlias.slice(0, -1);
    
    aliases[cleanAlias] = { ...aliases[cleanAlias], ...data }; // Merge with existing if updating
    await this.storage.set({ aliases });
  }

  /**
   * Updates specific fields of an existing alias.
   * @param {string} alias - The alias name.
   * @param {Object} partialData - The data fields to update.
   * @returns {Promise<void>}
   */
  async updateAlias(alias, partialData) {
    const aliases = await this.getAliases();
    if (aliases[alias]) {
      aliases[alias] = { ...aliases[alias], ...partialData };
      await this.storage.set({ aliases });
    } else {
      console.warn(`Attempted to update non-existent alias: ${alias}`);
    }
  }

  /**
   * Deletes an alias.
   * @param {string} alias - The alias name to delete.
   * @returns {Promise<void>}
   */
  async deleteAlias(alias) {
    const aliases = await this.getAliases();
    delete aliases[alias];
    await this.storage.set({ aliases });
  }
}

/**
 * Debounce function to limit the rate at which a function can fire.
 * @param {Function} func - The function to debounce.
 * @param {number} delay - The delay in milliseconds.
 * @returns {Function} - The debounced function.
 */
export function debounce(func, delay) {
  let timeout;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), delay);
  };
}