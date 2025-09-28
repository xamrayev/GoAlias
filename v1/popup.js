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

  // Возьмём только первое слово (на случай, если вернётся фраза)
  return summary.split(/\s+/)[0];
}

function showStatus(message, type = 'success') {
  const status = document.getElementById("status");
  const statusText = document.getElementById("statusText");
  
  statusText.textContent = message;
  status.classList.remove('hidden');
  
  // Auto-hide after 3 seconds
  setTimeout(() => {
    status.classList.add('hidden');
  }, 3000);
}

function showAIIndicator(show = true) {
  const indicator = document.getElementById("aiIndicator");
  const statusEl = document.getElementById("aiStatus");
  
  if (show) {
    indicator.classList.remove('hidden');
    statusEl.classList.remove('hidden');
  } else {
    indicator.classList.add('hidden');
    statusEl.classList.add('hidden');
  }
}

function generateFallbackAlias(url, title) {
  // Fallback alias generation when AI fails
  const cleanTitle = title.replace(/[^\w\s-]/g, '').trim();
  if (cleanTitle) {
    return cleanTitle.split(/\s+/)[0].toLowerCase();
  }
  
  // Extract from URL
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    return domain.split('.')[0];
  } catch {
    return 'link';
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const aliasInput = document.getElementById("alias");
  const saveBtn = document.getElementById("save");
  
  // Show AI loading state
  showAIIndicator(true);
  
  try {
    // Try AI generation first
    const aiAlias = await summarizeOneWord(tab.title);
    aliasInput.value = aiAlias;
    showAIIndicator(false);
  } catch (error) {
    console.warn("AI generation failed:", error);
    // Fallback to simple generation
    const fallbackAlias = generateFallbackAlias(tab.url, tab.title);
    aliasInput.value = fallbackAlias;
    showAIIndicator(false);
    
    // Show subtle warning
    const aiStatus = document.getElementById("aiStatus");
    aiStatus.textContent = "🔧 Using smart fallback generation";
    aiStatus.classList.remove('hidden');
    setTimeout(() => aiStatus.classList.add('hidden'), 3000);
  }

  // Save button handler
  saveBtn.addEventListener("click", async () => {
    const alias = aliasInput.value.trim();
    if (!alias) {
      showStatus("Please enter an alias", 'error');
      aliasInput.focus();
      return;
    }

    // Check if alias already exists
    const existing = await chrome.storage.local.get(alias);
    if (existing[alias]) {
      const proceed = confirm(`Alias "${alias}" already exists. Overwrite?`);
      if (!proceed) return;
    }

    // Disable button during save
    saveBtn.disabled = true;
    saveBtn.innerHTML = `
      <span class="flex items-center justify-center space-x-2">
        <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        <span>Saving...</span>
      </span>
    `;

    try {
      await chrome.storage.local.set({ [alias]: tab.url });
      showStatus(`✅ Saved: ${alias} → ${new URL(tab.url).hostname}`);
      
      // Reset button
      setTimeout(() => {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `
          <span class="flex items-center justify-center space-x-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12"></path>
            </svg>
            <span>Save Shortlink</span>
          </span>
        `;
      }, 1000);
      
    } catch (error) {
      showStatus("Failed to save alias", 'error');
      saveBtn.disabled = false;
    }
  });

  // Enter key support
  aliasInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      saveBtn.click();
    }
  });

  // Manage button
  document.getElementById("manage").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("manage.html") });
  });
});