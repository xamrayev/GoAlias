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

async function generateDescription(text) {
  try {
    if (!("Summarizer" in self)) {
      return text.substring(0, 150);
    }

    const status = await Summarizer.availability();
    if (status === "unavailable") {
      return text.substring(0, 150);
    }

    const summarizer = await Summarizer.create({
      type: "tldr",
      format: "plain-text",
      length: "short"
    });

    const description = await summarizer.summarize(text);
    summarizer.destroy();

    return description;
  } catch (error) {
    console.error("Description generation failed:", error);
    return text.substring(0, 150);
  }
}

function showStatus(message, type = 'success') {
  const status = document.getElementById("status");
  const statusText = document.getElementById("statusText");
  
  statusText.textContent = message;
  status.classList.remove('hidden');
  
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
  const cleanTitle = title.replace(/[^\w\s-]/g, '').trim();
  if (cleanTitle) {
    return cleanTitle.split(/\s+/)[0].toLowerCase();
  }
  
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    return domain.split('.')[0];
  } catch {
    return 'link';
  }
}

// Получить текст страницы для генерации описания
async function getPageContent(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const body = document.body.innerText || '';
        const metaDesc = document.querySelector('meta[name="description"]')?.content || '';
        return metaDesc || body.substring(0, 1000);
      }
    });
    
    return results[0]?.result || '';
  } catch (error) {
    console.error('Failed to get page content:', error);
    return '';
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const aliasInput = document.getElementById("alias");
  const saveBtn = document.getElementById("save");
  
  showAIIndicator(true);
  
  try {
    const aiAlias = await summarizeOneWord(tab.title);
    aliasInput.value = aiAlias;
    showAIIndicator(false);
  } catch (error) {
    console.warn("AI generation failed:", error);
    const fallbackAlias = generateFallbackAlias(tab.url, tab.title);
    aliasInput.value = fallbackAlias;
    showAIIndicator(false);
    
    const aiStatus = document.getElementById("aiStatus");
    aiStatus.textContent = "🔧 Using smart fallback generation";
    aiStatus.classList.remove('hidden');
    setTimeout(() => aiStatus.classList.add('hidden'), 3000);
  }

  saveBtn.addEventListener("click", async () => {
    const alias = aliasInput.value.trim();
    if (!alias) {
      showStatus("Please enter an alias", 'error');
      aliasInput.focus();
      return;
    }

    const existing = await chrome.storage.local.get(alias);
    if (existing[alias]) {
      const proceed = confirm(`Alias "${alias}" already exists. Overwrite?`);
      if (!proceed) return;
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = `
      <span style="display: flex; align-items: center; justify-content: center; gap: 8px;">
        <div style="width: 16px; height: 16px; border: 2px solid white; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <span>Generating description...</span>
      </span>
    `;

    try {
      // Получаем контент страницы
      const pageContent = await getPageContent(tab.id);
      
      // Генерируем описание с помощью AI
      let description = '';
      if (pageContent) {
        description = await generateDescription(pageContent);
      } else {
        description = tab.title;
      }
      
      // Сохраняем с описанием
      await chrome.storage.local.set({ 
        [alias]: {
          url: tab.url,
          description: description,
          title: tab.title,
          created: Date.now()
        }
      });
      
      showStatus(`✅ Saved: ${alias}`);
      
      setTimeout(() => {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `
          <svg viewBox="0 0 24 24">
            <path d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12"></path>
          </svg>
          <span>Save Shortlink</span>
        `;
      }, 1000);
      
    } catch (error) {
      console.error('Save failed:', error);
      showStatus("Failed to save alias", 'error');
      saveBtn.disabled = false;
    }
  });

  aliasInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      saveBtn.click();
    }
  });

  document.getElementById("manage").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("manage.html") });
  });
});