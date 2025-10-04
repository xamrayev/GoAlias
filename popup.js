// popup.js

import { debounce } from './utils.js';

// Вспомогательная функция для применения i18n к статическим элементам HTML
function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.dataset.i18n;
        element.textContent = chrome.i18n.getMessage(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.dataset.i18nPlaceholder; // Исправлено: camelCase
        element.placeholder = chrome.i18n.getMessage(key);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
        const key = element.dataset.i18nTitle; // Исправлено: camelCase
        element.title = chrome.i18n.getMessage(key);
    });
    // Для <title> в head
    const titleElement = document.querySelector('head title');
    if (titleElement && titleElement.dataset.i18n) {
        titleElement.textContent = chrome.i18n.getMessage(titleElement.dataset.i18n);
    }
}


document.addEventListener('DOMContentLoaded', async () => {
    applyI18n(); // <-- Применяем переводы сразу после загрузки DOM

    const popupTitle = document.getElementById('popupTitle');
    const urlInput = document.getElementById('url');
    const aliasInput = document.getElementById('alias');
    const descriptionInput = document.getElementById('description');
    const keywordsInput = document.getElementById('keywords');
    const saveButton = document.getElementById('saveButton');
    const updateButton = document.getElementById('updateButton');
    const deleteButton = document.getElementById('deleteButton');
    const manageButton = document.getElementById('manageButton');
    const generateAiButton = document.getElementById('generateAiButton');
    const aiLoadingIndicator = document.getElementById('aiLoadingIndicator');
    const statusMessage = document.getElementById('statusMessage');
    const aliasError = document.getElementById('alias-error');

    let currentTab;
    let existingAliasKey = null;
    let existingAliasData = null;

    const updateUIForExistingAlias = (aliasKey, aliasData) => {
        // Используем getMessage с параметром %s
        popupTitle.textContent = chrome.i18n.getMessage("popupTitleEditAlias", [aliasKey]);
        aliasInput.value = aliasKey;
        descriptionInput.value = aliasData.description || '';
        keywordsInput.value = aliasData.keywords.join(', ') || '';

        saveButton.style.display = 'none';
        updateButton.style.display = 'inline-block';
        deleteButton.style.display = 'inline-block';
        
        statusMessage.textContent = chrome.i18n.getMessage("statusPageSavedAs", [aliasKey]);
        statusMessage.className = 'sketchy-status-message sketchy-status-info';
    };

    const updateUIForNewAlias = () => {
        popupTitle.textContent = chrome.i18n.getMessage("popupTitleSavePage");
        aliasInput.value = '';
        descriptionInput.value = currentTab.title || '';
        keywordsInput.value = '';

        saveButton.style.display = 'inline-block';
        updateButton.style.display = 'none';
        deleteButton.style.display = 'none';

        statusMessage.textContent = chrome.i18n.getMessage("statusEnterAliasOrGenerate");
        statusMessage.className = 'sketchy-status-message sketchy-status-info';
    };

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        currentTab = tab;
        urlInput.value = tab.url;

        const aliases = await chrome.runtime.sendMessage({ action: 'getAliases' });
        for (const alias in aliases) {
            if (aliases[alias].url === tab.url) {
                existingAliasKey = alias;
                existingAliasData = aliases[alias];
                break;
            }
        }

        if (existingAliasKey) {
            updateUIForExistingAlias(existingAliasKey, existingAliasData);
        } else {
            updateUIForNewAlias();
        }
        
    } catch (error) {
        console.error('Error fetching tab info or aliases:', error);
        statusMessage.textContent = chrome.i18n.getMessage("statusCriticalError", [error.message]);
        statusMessage.className = 'sketchy-status-message sketchy-status-error';
        descriptionInput.value = chrome.i18n.getMessage("placeholderDescription");
        urlInput.value = chrome.i18n.getMessage("statusErrorURL"); // Хотя это readonly, можно показать сообщение
    }

    generateAiButton.addEventListener('click', async () => {
        if (!currentTab) {
            statusMessage.textContent = chrome.i18n.getMessage("statusCriticalError", [chrome.i18n.getMessage("noCurrentTabError")]); // Адаптировать текст ошибки
            statusMessage.className = 'sketchy-status-message sketchy-status-error';
            return;
        }

        generateAiButton.textContent = chrome.i18n.getMessage("buttonGenerating");
        statusMessage.textContent = chrome.i18n.getMessage("statusGeneratingAI");
        statusMessage.className = 'sketchy-status-message sketchy-status-info';
        generateAiButton.disabled = true;
        aiLoadingIndicator.style.display = 'inline-block';

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'generateContentForPopup',
                tabId: currentTab.id,
                url: currentTab.url,
                title: currentTab.title
            });

            if (response && response.success) {
                keywordsInput.value = response.keywords.join(', ');
                aliasInput.value = response.suggestedAlias;
                
                statusMessage.textContent = chrome.i18n.getMessage("statusAIReady");
                statusMessage.className = 'sketchy-status-message sketchy-status-success';
            } else {
                console.error('Failed to generate AI content:', response.error);
                keywordsInput.value = '';
                aliasInput.value = '';
                statusMessage.textContent = chrome.i18n.getMessage("statusAIError", [response.error || 'unknown error']);
                statusMessage.className = 'sketchy-status-message sketchy-status-error';
            }
        } catch (error) {
            console.error('Error during AI generation:', error);
            statusMessage.textContent = chrome.i18n.getMessage("statusUnexpectedError", [error.message]);
            statusMessage.className = 'sketchy-status-message sketchy-status-error';
        } finally {
            generateAiButton.disabled = false;
            generateAiButton.textContent = chrome.i18n.getMessage("buttonGenerateAI");
            aiLoadingIndicator.style.display = 'none';
        }
    });

    const validateInputs = async (alias) => {
        aliasError.textContent = '';
        if (!alias) {
            aliasError.textContent = chrome.i18n.getMessage("errorAliasEmpty");
            return false;
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(alias)) {
            aliasError.textContent = chrome.i18n.getMessage("errorAliasInvalidChars");
            return false;
        }
        if (!urlInput.value.trim()) {
            statusMessage.textContent = chrome.i18n.getMessage("statusErrorURL");
            statusMessage.className = 'sketchy-status-message sketchy-status-error';
            return false;
        }

        const aliases = await chrome.runtime.sendMessage({ action: 'getAliases' });
        if (aliases[alias] && alias !== existingAliasKey) { 
            aliasError.textContent = chrome.i18n.getMessage("statusAliasExists", [alias]);
            return false;
        }
        return true;
    };

    saveButton.addEventListener('click', async () => {
        const alias = aliasInput.value.trim();
        if (!(await validateInputs(alias))) return;

        const data = {
            url: urlInput.value.trim(),
            description: descriptionInput.value.trim(),
            keywords: keywordsInput.value.split(',').map(k => k.trim()).filter(k => k),
            tags: [], 
            created: new Date().toISOString(),
            usageCount: 0,
            lastUsed: null
        };

        try {
            const response = await chrome.runtime.sendMessage({ action: 'saveAlias', alias, data });
            if (response.success) {
                statusMessage.textContent = chrome.i18n.getMessage("statusAliasSaved", [alias]);
                statusMessage.className = 'sketchy-status-message sketchy-status-success';
                setTimeout(() => window.close(), 1500);
            } else {
                statusMessage.textContent = chrome.i18n.getMessage("statusSaveError", [response.error]);
                statusMessage.className = 'sketchy-status-message sketchy-status-error';
            }
        } catch (error) {
            console.error('Error saving alias:', error);
            statusMessage.textContent = chrome.i18n.getMessage("statusUnexpectedError", [error.message]);
            statusMessage.className = 'sketchy-status-message sketchy-status-error';
        }
    });

    updateButton.addEventListener('click', async () => {
        const alias = aliasInput.value.trim();
        if (!(await validateInputs(alias))) return;

        if (alias !== existingAliasKey) {
            await chrome.runtime.sendMessage({ action: 'deleteAlias', alias: existingAliasKey });
            existingAliasKey = null; 
        }

        const data = {
            url: urlInput.value.trim(),
            description: descriptionInput.value.trim(),
            keywords: keywordsInput.value.split(',').map(k => k.trim()).filter(k => k),
            tags: existingAliasData ? existingAliasData.tags : [],
            created: existingAliasData ? existingAliasData.created : new Date().toISOString(),
            usageCount: existingAliasData ? existingAliasData.usageCount : 0,
            lastUsed: new Date().toISOString()
        };

        try {
            const action = (alias === existingAliasKey) ? 'updateAlias' : 'saveAlias'; 
            const response = await chrome.runtime.sendMessage({ action: action, alias: alias, data: data });

            if (response.success) {
                statusMessage.textContent = chrome.i18n.getMessage("statusAliasUpdated", [alias]);
                statusMessage.className = 'sketchy-status-message sketchy-status-success';
                existingAliasKey = alias;
                existingAliasData = data;
                updateUIForExistingAlias(existingAliasKey, existingAliasData);
            } else {
                statusMessage.textContent = chrome.i18n.getMessage("statusUpdateError", [response.error]);
                statusMessage.className = 'sketchy-status-message sketchy-status-error';
            }
        } catch (error) {
            console.error('Error updating alias:', error);
            statusMessage.textContent = chrome.i18n.getMessage("statusUnexpectedError", [error.message]);
            statusMessage.className = 'sketchy-status-message sketchy-status-error';
        }
    });

    deleteButton.addEventListener('click', async () => {
        if (!existingAliasKey) {
            statusMessage.textContent = chrome.i18n.getMessage("statusNoAliasToDelete");
            statusMessage.className = 'sketchy-status-message sketchy-status-error';
            return;
        }

        try {
            const response = await chrome.runtime.sendMessage({ action: 'deleteAlias', alias: existingAliasKey });
            if (response.success) {
                statusMessage.textContent = chrome.i18n.getMessage("statusAliasDeleted", [existingAliasKey]);
                statusMessage.className = 'sketchy-status-message sketchy-status-success';
                existingAliasKey = null;
                existingAliasData = null;
                updateUIForNewAlias();
            } else {
                statusMessage.textContent = chrome.i18n.getMessage("statusDeleteError", [response.error]);
                statusMessage.className = 'sketchy-status-message sketchy-status-error';
            }
        } catch (error) {
            console.error('Error deleting alias:', error);
            statusMessage.textContent = chrome.i18n.getMessage("statusUnexpectedError", [error.message]);
            statusMessage.className = 'sketchy-status-message sketchy-status-error';
        }
    });

    manageButton.addEventListener('click', async () => {
        await chrome.runtime.sendMessage({ action: 'openOptionsPage' });
    });
});