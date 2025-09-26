chrome.omnibox.onInputEntered.addListener((alias) => {
  chrome.storage.local.get(alias, (res) => {
    if (res[alias]) chrome.tabs.update({ url: res[alias] });
    else chrome.tabs.update({ url: "https://www.google.com/search?q=" + alias });
  });
});
