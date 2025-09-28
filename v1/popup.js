
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



document.addEventListener("DOMContentLoaded", async () => {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const aliasInput = document.getElementById("alias");

  // Генерация AI alias
  aliasInput.value = await summarizeOneWord(tab.title);

  document.getElementById("save").addEventListener("click", () => {
    const alias = aliasInput.value.trim();
    if (!alias) return alert("Please enter an alias.");
    chrome.storage.local.set({ [alias]: tab.url }, () => {
      document.getElementById("status").innerText = `Saved: ${alias} -> ${tab.url}`;
    });
  });

  document.getElementById("manage").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("manage.html") });
  });
});
