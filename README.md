# GoAlias - Smart Alias Manager with AI Search 🎯

![GoAlias Logo/Banner - Placeholder Image]
*(Here, you'd embed a screenshot or animated GIF showcasing GoAlias in action within the Omnibox and on the management page, adhering to the "Sketchy Minimal" style.)*

GoAlias is a powerful and intuitive Chrome extension that transforms your address bar into an intelligent command center for navigating your saved websites. Say goodbye to bookmark clutter and slow searching – with GoAlias, you find the right information instantly, by **meaning**, not just by exact keywords.

🚀 **Free and Open Source.** Boost your productivity with zero cost and full transparency!

## ✨ Key Features

*   **⚡️ Instant AI-Enhanced Saving:** One click is all it takes! GoAlias automatically suggests a smart alias and relevant keywords for the current page, powered by on-device AI. No more manual tagging.
*   **🧠 Three Intelligent Omnibox Search Modes (`go <query>`):**
    *   **Direct Alias (`go my-dashboard`):** Navigate instantly by typing the exact alias.
    *   **AI Semantic Search (`go ai last month reports`):** Finds websites related to your query by context and meaning, even if you don't recall the precise title or keywords.
    *   **Fuzzy Keyword Search (`go fz dashboard metrics`):** Locates relevant aliases with partial matches and even typos.
    *   **Smart Search (Default):** Automatically determines the best search mode if you don't specify `ai` or `fz`.
*   **📂 Intuitive Alias Manager:**
    *   A visually appealing **Bento Grid** dashboard for easy overview and organization.
    *   **Bookmark Folder Filtering:** Quickly find aliases grouped by their original Chrome bookmark folders.
    *   **Fuzzy Search (Fuse.js powered):** Fast and accurate search across all aliases, even with slight misspellings.
    *   **Bulk Management:** Easily edit, delete, and export your aliases.
    *   **Folder Deletion Mode:** Conveniently remove all aliases associated with a specific bookmark folder directly from the manager.
*   **🔗 Seamless Chrome Bookmark Sync:**
    *   Import all your existing Chrome bookmarks, converting them into smart GoAlias entries.
    *   Automatic alias and keyword generation during sync (with an option for AI-powered enhancement for all imported bookmarks).
*   **📈 Detailed Usage Statistics:** Track how often you use different search modes and aliases to refine your workflow and optimize your saved links.
*   **🛡️ Privacy First:** All AI computations (for generating descriptions and keywords) are performed locally on your device. Your data never leaves your browser and is not sent to any third-party servers.

## 🌟 Who is GoAlias for?

*   **Productivity Enthusiasts:** Shave seconds off every navigation, saving hours over time!
*   **Developers & Analysts:** Get instant access to dozens of internal dashboards, documentation, and tools.
*   **Everyday Users:** Declutter your bookmarks and make web navigation truly intuitive.
*   **Teams:** Enhance collaboration with shared alias lists (future feature).

## 🛠️ How to Install

GoAlias is available as a Chrome extension.

1.  **Download the archive:** [Link to `.zip` release on GitHub] (Will be available upon release)
2.  **Unzip the archive** to a convenient location on your computer.
3.  Open Google Chrome and navigate to `chrome://extensions/`.
4.  Enable **"Developer mode"** in the top-right corner.
5.  Click the **"Load unpacked"** button.
6.  Select the folder where you unzipped GoAlias.
7.  That's it! The GoAlias extension will appear in your list. You can pin its icon to your Chrome toolbar for quick access.

## 🚀 Getting Started

1.  **Save your first alias:**
    *   Go to any important webpage.
    *   Click the GoAlias icon in your Chrome toolbar.
    *   GoAlias will automatically suggest an alias and keywords. Refine them if needed, or click "🧠 Generate AI" for smarter suggestions.
    *   Click "✅ Save".
2.  **Navigate quickly:**
    *   Open your Omnibox (Chrome's address bar).
    *   Type `go` (or your configured keyword) followed by a space.
    *   Start typing your alias, or use `go ai <query>` for semantic search, or `go fz <words>` for fuzzy search.
    *   Select the desired suggestion and press Enter!
3.  **Manage your aliases:**
    *   Click the GoAlias icon, then "⚙️ Manage Aliases".
    *   Use the search, bookmark folder filters, and Bento Grid layout to organize and interact with your saved sites.
    *   Activate "🗑️ Delete folders" mode to easily clean up groups of imported bookmarks.

## 🤝 Contributing

GoAlias is an Open Source project, and we welcome all contributions!

*   Report bugs and suggest new features via [Issues](https://github.com/xamrayev/goalias/issues).
*   Submit code improvements through [Pull Requests](https://github.com/xamrayev/goalias/pulls).

## 📄 License

This project is licensed under the [MIT License](LICENSE).
