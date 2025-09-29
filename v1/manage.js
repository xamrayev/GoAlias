let allData = {};
let selectedItems = new Set();

// Toast notification system
function showToast(message, type = 'success') {
  const toast = document.getElementById("toast");
  const toastIcon = document.getElementById("toastIcon");
  const toastMessage = document.getElementById("toastMessage");
  
  // Set icon based on type
  const icons = {
    success: `<svg style="color: #10b981;" viewBox="0 0 24 24">
      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
    </svg>`,
    error: `<svg style="color: #ef4444;" viewBox="0 0 24 24">
      <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
    </svg>`,
    info: `<svg style="color: #3b82f6;" viewBox="0 0 24 24">
      <path d="M13 16h-1v-4m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
    </svg>`
  };
  
  toastIcon.innerHTML = icons[type] || icons.success;
  toastMessage.textContent = message;
  
  // Show toast
  toast.classList.add('show');
  
  // Auto-hide after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// AI summarization function
async function summarizeOneWord(text) {
  if (!("Summarizer" in self)) {
    throw new Error("Summarizer API не поддерживается в этом браузере");
  }

  const status = await Summarizer.availability();
  if (status === "unavailable") {
    throw new Error("Summarizer недоступен");
  }

  const summarizer = await Summarizer.create({
    type: "headline",
    format: "plain-text",
    length: "short"
  });

  const summary = await summarizer.summarize(text);
  summarizer.destroy();

  return summary.split(/\s+/)[0];
}

// Fixed AI alias generation function
async function generateAliasAI(url) {
  try {
    // Try to fetch the page title
    const response = await fetch(url);
    const html = await response.text();
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';
    
    if (title) {
      return await summarizeOneWord(title);
    }
    
    // Fallback to URL-based generation
    const urlObj = new URL(url);
    return await summarizeOneWord(urlObj.hostname + urlObj.pathname);
    
  } catch (error) {
    console.error('AI generation failed:', error);
    
    // Simple fallback
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');
      return domain.split('.')[0];
    } catch {
      return 'link' + Date.now().toString().slice(-4);
    }
  }
}

// Show/hide loading overlay
function showLoading(show = true) {
  const overlay = document.getElementById("loadingOverlay");
  if (show) {
    overlay.style.display = 'flex';
  } else {
    overlay.style.display = 'none';
  }
}

// Create table row
function createTableRow(alias, data) {
  // Support both old format (just URL) and new format (object)
  const url = typeof data === 'string' ? data : data.url;
  const description = typeof data === 'object' ? data.description : '';
  const created = typeof data === 'object' ? data.created : Date.now();
  
  // Check for duplicate URLs
  const isDuplicate = Object.values(allData).filter(d => {
    const u = typeof d === 'string' ? d : d.url;
    return u === url;
  }).length > 1;
  
  const isSelected = selectedItems.has(alias);
  
  const row = document.createElement('div');
  row.className = `table-row ${isDuplicate ? 'duplicate' : ''}`;
  row.dataset.alias = alias;
  
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    
    row.innerHTML = `
      <div>
        <input type="checkbox" class="row-checkbox" ${isSelected ? 'checked' : ''}>
      </div>
      
      <div>
        <input 
          type="text" 
          value="${alias}" 
          class="aliasInput table-input"
        />
        ${isDuplicate ? '<span class="duplicate-warning">⚠️ Duplicate URL</span>' : ''}
      </div>
      
      <div>
        <input 
          type="text" 
          value="${url}" 
          class="urlInput table-input"
          style="margin-bottom: 4px;"
        />
        <textarea 
          class="descInput table-input" 
          placeholder="Add description (helps with AI search)..."
          style="min-height: 60px; resize: vertical; font-size: 12px;"
        >${description}</textarea>
        <div class="url-domain">${domain}</div>
      </div>
      
      <div class="actions">
        <button class="generateBtn action-btn btn-ai" title="Generate AI alias">
          <svg viewBox="0 0 24 24">
            <path d="M13 10V3L4 14h7v7l9-11h-7z"></path>
          </svg>
        </button>
        
        <button class="visitBtn action-btn btn-visit" title="Visit URL">
          <svg viewBox="0 0 24 24">
            <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
          </svg>
        </button>
        
        <button class="deleteBtn action-btn btn-delete" title="Delete alias">
          <svg viewBox="0 0 24 24">
            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
        </button>
      </div>
    `;
    
  } catch (error) {
    // Fallback for invalid URLs
    row.innerHTML = `
      <div>
        <input type="checkbox" class="row-checkbox" ${isSelected ? 'checked' : ''}>
      </div>
      
      <div>
        <input 
          type="text" 
          value="${alias}" 
          class="aliasInput table-input"
        />
        ${isDuplicate ? '<span class="duplicate-warning">⚠️ Duplicate URL</span>' : ''}
      </div>
      
      <div>
        <input 
          type="text" 
          value="${url}" 
          class="urlInput table-input"
          style="margin-bottom: 4px;"
        />
        <textarea 
          class="descInput table-input" 
          placeholder="Add description (helps with AI search)..."
          style="min-height: 60px; resize: vertical; font-size: 12px;"
        >${description}</textarea>
        <div class="url-domain">Invalid URL</div>
      </div>
      
      <div class="actions">
        <button class="generateBtn action-btn btn-ai" title="Generate AI alias">
          <svg viewBox="0 0 24 24">
            <path d="M13 10V3L4 14h7v7l9-11h-7z"></path>
          </svg>
        </button>
        
        <button class="visitBtn action-btn btn-visit" title="Visit URL">
          <svg viewBox="0 0 24 24">
            <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
          </svg>
        </button>
        
        <button class="deleteBtn action-btn btn-delete" title="Delete alias">
          <svg viewBox="0 0 24 24">
            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
        </button>
      </div>
    `;
  }
  
  return row;
}

// Render table with data
function renderTable(data) {
  const tableBody = document.getElementById("tableBody");
  const emptyState = document.getElementById("emptyState");
  const aliasCount = document.getElementById("aliasCount");
  
  const entries = Object.entries(data);
  
  // Update alias count
  aliasCount.textContent = `${entries.length} alias${entries.length !== 1 ? 'es' : ''}`;
  
  if (entries.length === 0) {
    tableBody.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }
  
  emptyState.classList.add('hidden');
  
  // Clear existing content
  tableBody.innerHTML = '';
  
  // Sort entries alphabetically
  const sortedEntries = entries.sort((a, b) => a[0].localeCompare(b[0]));
  
  // Add rows
  sortedEntries.forEach(([alias, data]) => {
    const row = createTableRow(alias, data);
    tableBody.appendChild(row);
  });
  
  // Add event listeners
  attachRowEventListeners();
}

// Attach event listeners to table rows
function attachRowEventListeners() {
  const tableBody = document.getElementById("tableBody");
  
  // Checkbox handling
  tableBody.addEventListener('change', (e) => {
    if (e.target.classList.contains('row-checkbox')) {
      const row = e.target.closest('[data-alias]');
      const alias = row.dataset.alias;
      
      if (e.target.checked) {
        selectedItems.add(alias);
      } else {
        selectedItems.delete(alias);
      }
      
      updateBulkActions();
    }
  });
  
  // Input blur handlers for auto-save
  tableBody.addEventListener('blur', async (e) => {
    if (e.target.classList.contains('aliasInput') || 
        e.target.classList.contains('urlInput') || 
        e.target.classList.contains('descInput')) {
      
      const row = e.target.closest('[data-alias]');
      const originalAlias = row.dataset.alias;
      const aliasInput = row.querySelector('.aliasInput');
      const urlInput = row.querySelector('.urlInput');
      const descInput = row.querySelector('.descInput');
      
      const newAlias = aliasInput.value.trim();
      const newUrl = urlInput.value.trim();
      const newDesc = descInput.value.trim();
      
      if (!newAlias || !newUrl) {
        showToast('Alias and URL cannot be empty', 'error');
        loadAliases();
        return;
      }
      
      if (newAlias !== originalAlias && allData.hasOwnProperty(newAlias)) {
        showToast('Alias already exists!', 'error');
        loadAliases();
        return;
      }
      
      try {
        // Remove old alias if changed
        if (newAlias !== originalAlias) {
          await chrome.storage.local.remove(originalAlias);
          selectedItems.delete(originalAlias);
          selectedItems.add(newAlias);
        }
        
        // Get old data to preserve metadata
        const oldData = allData[originalAlias];
        const created = typeof oldData === 'object' ? oldData.created : Date.now();
        
        // Save new data with description
        await chrome.storage.local.set({ 
          [newAlias]: {
            url: newUrl,
            description: newDesc,
            created: created,
            updated: Date.now()
          }
        });
        
        showToast('Saved successfully!');
        loadAliases();
        
      } catch (error) {
        showToast('Failed to save changes', 'error');
        loadAliases();
      }
    }
  }, true);
  
  // Button click handlers
  tableBody.addEventListener('click', async (e) => {
    const row = e.target.closest('[data-alias]');
    if (!row) return;
    
    const alias = row.dataset.alias;
    const urlInput = row.querySelector('.urlInput');
    const aliasInput = row.querySelector('.aliasInput');
    const descInput = row.querySelector('.descInput');
    
    if (e.target.closest('.generateBtn')) {
      if (!urlInput.value.trim()) {
        showToast('URL is empty!', 'error');
        return;
      }
      
      showLoading(true);
      showToast('Generating AI alias...', 'info');
      
      try {
        const aiAlias = await generateAliasAI(urlInput.value.trim());
        
        if (allData.hasOwnProperty(aiAlias) && aiAlias !== alias) {
          showLoading(false);
          showToast('Generated alias already exists!', 'error');
          return;
        }
        
        // Remove old alias and add new one
        await chrome.storage.local.remove(alias);
        
        const oldData = allData[alias];
        const created = typeof oldData === 'object' ? oldData.created : Date.now();
        
        await chrome.storage.local.set({ 
          [aiAlias]: {
            url: urlInput.value.trim(),
            description: descInput.value.trim(),
            created: created,
            updated: Date.now()
          }
        });
        
        showLoading(false);
        showToast(`AI alias generated: ${aiAlias}`);
        loadAliases();
        
      } catch (error) {
        showLoading(false);
        showToast('AI generation failed', 'error');
      }
    }
    
    else if (e.target.closest('.visitBtn')) {
      const data = allData[alias];
      const url = typeof data === 'string' ? data : data.url;
      chrome.tabs.create({ url });
    }
    
    else if (e.target.closest('.deleteBtn')) {
      if (confirm(`Delete alias "${alias}"?`)) {
        try {
          await chrome.storage.local.remove(alias);
          selectedItems.delete(alias);
          showToast(`Deleted "${alias}"`);
          loadAliases();
        } catch (error) {
          showToast('Failed to delete alias', 'error');
        }
      }
    }
  });
}

// Update bulk actions visibility
function updateBulkActions() {
  const bulkActions = document.getElementById("bulkActions");
  const selectedCount = document.getElementById("selectedCount");
  
  if (selectedItems.size > 0) {
    bulkActions.classList.remove('hidden');
    selectedCount.textContent = selectedItems.size;
  } else {
    bulkActions.classList.add('hidden');
  }
}

// Load all aliases
function loadAliases() {
  chrome.storage.local.get(null, (data) => {
    // Remove internal keys
    delete data._stats;
    delete data._metadata;
    
    allData = data;
    renderTable(data);
  });
}

// Export functionality
function exportData(selectedOnly = false) {
  const dataToExport = selectedOnly 
    ? Object.fromEntries(Object.entries(allData).filter(([alias]) => selectedItems.has(alias)))
    : allData;
  
  const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shortlinks-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  showToast(`Exported ${Object.keys(dataToExport).length} aliases`);
}

// Search functionality
document.getElementById("searchInput").addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase();
  const filtered = Object.fromEntries(
    Object.entries(allData).filter(([alias, data]) => {
      const url = typeof data === 'string' ? data : data.url;
      const description = typeof data === 'object' ? data.description : '';
      
      return alias.toLowerCase().includes(query) || 
             url.toLowerCase().includes(query) ||
             description.toLowerCase().includes(query);
    })
  );
  renderTable(filtered);
});

// Bulk actions
document.getElementById("bulkDelete").addEventListener("click", async () => {
  if (selectedItems.size === 0) return;
  
  if (confirm(`Delete ${selectedItems.size} selected aliases?`)) {
    try {
      const aliasesToDelete = Array.from(selectedItems);
      await chrome.storage.local.remove(aliasesToDelete);
      
      selectedItems.clear();
      showToast(`Deleted ${aliasesToDelete.length} aliases`);
      loadAliases();
    } catch (error) {
      showToast('Failed to delete aliases', 'error');
    }
  }
});

document.getElementById("bulkExport").addEventListener("click", () => {
  exportData(true);
});

document.getElementById("exportBtn").addEventListener("click", () => {
  exportData(false);
});

// Load data on page load
document.addEventListener("DOMContentLoaded", loadAliases);