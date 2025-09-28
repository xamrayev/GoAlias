let allData = {};

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2000);
}

async function generateAliasAI(url) {
  try {
    const response = await chrome.ai.suggestText({
      model: "gpt-4o-mini",
      prompt: `Generate a short, meaningful alias for this URL: ${url}`,
      max_output_tokens: 10
    });
    return response.output_text.trim();
  } catch (err) {
    console.error("AI generation failed:", err);
    return null;
  }
}

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

// const text = "JavaScript — это язык программирования, который используется для создания интерактивных веб-страниц.";
// const result = await summarizeOneWord(text);
// console.log(result); // Например: "JavaScript"




function renderTable(data) {
  const tbody = document.querySelector("#aliasTable tbody");
  tbody.innerHTML = "";

  const sortedEntries = Object.entries(data).sort((a, b) => a[0].localeCompare(b[0]));
  const aliasCounts = {};
  for (let [alias] of sortedEntries) aliasCounts[alias] = (aliasCounts[alias] || 0) + 1;

  for (let [alias, url] of sortedEntries) {
    const tr = document.createElement("tr");
    if (aliasCounts[alias] > 1) tr.classList.add("duplicate");

    tr.innerHTML = `
      <td><input type="text" value="${alias}" class="aliasInput"></td>
      <td><input type="text" value="${url}" class="urlInput"></td>
      <td>
        <button class="generateBtn">AI</button>
        <button class="deleteBtn">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);

    const aliasInput = tr.querySelector(".aliasInput");
    const urlInput = tr.querySelector(".urlInput");

    // Автосохранение при потере фокуса
    [aliasInput, urlInput].forEach(input => {
      input.addEventListener("blur", () => {
        const newAlias = aliasInput.value.trim();
        const newUrl = urlInput.value.trim();
        if (!newAlias || !newUrl) { showToast("Alias and URL cannot be empty."); loadAliases(); return; }
        if (newAlias !== alias && allData.hasOwnProperty(newAlias)) { showToast("Alias already exists!"); loadAliases(); return; }
        if (newAlias !== alias) chrome.storage.local.remove(alias);
        chrome.storage.local.set({ [newAlias]: newUrl }, () => { showToast("Saved!"); loadAliases(); });
      });
    });

    // AI генерация alias
    tr.querySelector(".generateBtn").addEventListener("click", async () => {
      if (!urlInput.value.trim()) return showToast("URL is empty!");
      showToast("Generating AI alias...");
      const aiAlias = await generateAliasAI(urlInput.value.trim());
      if (!aiAlias) return showToast("AI generation failed.");
      if (allData.hasOwnProperty(aiAlias)) return showToast("Generated alias already exists!");
      aliasInput.value = aiAlias;
      chrome.storage.local.remove(alias);
      chrome.storage.local.set({ [aiAlias]: urlInput.value.trim() }, () => { showToast(`AI alias saved: ${aiAlias}`); loadAliases(); });
    });

    // Delete с подтверждением
    tr.querySelector(".deleteBtn").addEventListener("click", () => {
      if (confirm(`Are you sure you want to delete alias "${alias}"?`)) {
        chrome.storage.local.remove(alias, () => { showToast(`Deleted "${alias}"`); loadAliases(); });
      }
    });
  }
}

// Загрузка всех alias
function loadAliases() {
  chrome.storage.local.get(null, (data) => { allData = data; renderTable(data); });
}

// Фильтрация
document.getElementById("searchInput").addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase();
  const filtered = Object.fromEntries(
    Object.entries(allData).filter(([alias, url]) => alias.toLowerCase().includes(query) || url.toLowerCase().includes(query))
  );
  renderTable(filtered);
});

document.addEventListener("DOMContentLoaded", loadAliases);
