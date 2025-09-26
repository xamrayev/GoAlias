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

document.addEventListener("DOMContentLoaded", async () => {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const aliasInput = document.getElementById("alias");

  // Генерация AI alias
  aliasInput.value = await generateAliasAI(tab.url);

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
