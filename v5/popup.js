// popup.js

document.addEventListener('DOMContentLoaded', async () => {
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
    const aiLoadingIndicator = document.getElementById('aiLoadingIndicator'); // НОВЫЙ ЭЛЕМЕНТ
    const statusMessage = document.getElementById('statusMessage');
    const aliasError = document.getElementById('alias-error');

    let currentTab;
    let existingAliasKey = null;
    let existingAliasData = null;

    const updateUIForExistingAlias = (aliasKey, aliasData) => {
        popupTitle.textContent = `🌐 GoAlias - Изменить алиас "${aliasKey}"`;
        aliasInput.value = aliasKey;
        descriptionInput.value = aliasData.description || '';
        keywordsInput.value = aliasData.keywords.join(', ') || '';

        saveButton.style.display = 'none';
        updateButton.style.display = 'inline-block';
        deleteButton.style.display = 'inline-block';
        
        statusMessage.textContent = `Страница уже сохранена как "${aliasKey}". Вы можете обновить или удалить.`;
        statusMessage.className = 'sketchy-status-message sketchy-status-info';
    };

    const updateUIForNewAlias = () => {
        popupTitle.textContent = '🌐 GoAlias - Сохранить страницу';
        aliasInput.value = '';
        descriptionInput.value = currentTab.title || '';
        keywordsInput.value = '';

        saveButton.style.display = 'inline-block';
        updateButton.style.display = 'none';
        deleteButton.style.display = 'none';

        statusMessage.textContent = 'Введите алиас или нажмите "Сгенерировать AI".';
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
        statusMessage.textContent = `Критическая ошибка: ${error.message}.`;
        statusMessage.className = 'sketchy-status-message sketchy-status-error';
        descriptionInput.value = 'Ошибка загрузки контента. Введите описание вручную.';
        urlInput.value = 'Не удалось получить URL.';
    }

    generateAiButton.addEventListener('click', async () => {
        if (!currentTab) {
            statusMessage.textContent = 'Не удалось получить текущую вкладку.';
            statusMessage.className = 'sketchy-status-message sketchy-status-error';
            return;
        }

        statusMessage.textContent = 'Генерация алиаса и ключевых слов с помощью AI...';
        statusMessage.className = 'sketchy-status-message sketchy-status-info';
        generateAiButton.disabled = true;
        aiLoadingIndicator.style.display = 'inline-block';

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'generateContentForPopup',
                tabId: currentTab.id, // <-- ИСПРАВЛЕНО: передаем tab.id для content script
                url: currentTab.url,
                title: currentTab.title
            });

            if (response && response.success) {
                keywordsInput.value = response.keywords.join(', ');
                aliasInput.value = response.suggestedAlias;
                
                statusMessage.textContent = 'Алиас и ключевые слова сгенерированы AI!';
                statusMessage.className = 'sketchy-status-message sketchy-status-success';
            } else {
                console.error('Failed to generate AI content:', response.error);
                keywordsInput.value = '';
                aliasInput.value = '';
                statusMessage.textContent = `Ошибка AI: ${response?.error || 'неизвестная ошибка'}. Введите алиас и ключевые слова вручную.`;
                statusMessage.className = 'sketchy-status-message sketchy-status-error';
            }
        } catch (error) {
            console.error('Error during AI generation:', error);
            statusMessage.textContent = `Непредвиденная ошибка AI: ${error.message}.`;
            statusMessage.className = 'sketchy-status-message sketchy-status-error';
        } finally {
            generateAiButton.disabled = false;
            aiLoadingIndicator.style.display = 'none';
        }
    });



    // --- Generic validation function ---
    const validateInputs = async (alias) => {
        aliasError.textContent = '';
        if (!alias) {
            aliasError.textContent = 'Алиас не может быть пустым.';
            return false;
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(alias)) {
            aliasError.textContent = 'Алиас может содержать только латинские буквы, цифры, дефисы и подчеркивания.';
            return false;
        }
        if (!urlInput.value.trim()) {
            statusMessage.textContent = 'URL не может быть пустым.';
            statusMessage.className = 'sketchy-status-message sketchy-status-error';
            return false;
        }

        const aliases = await chrome.runtime.sendMessage({ action: 'getAliases' });
        if (aliases[alias] && alias !== existingAliasKey) { 
            aliasError.textContent = `Алиас "${alias}" уже существует. Выберите другой.`;
            return false;
        }
        return true;
    };


    // --- Save Button Logic ---
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
                statusMessage.textContent = `Алиас "${alias}" успешно сохранен!`;
                statusMessage.className = 'sketchy-status-message sketchy-status-success';
                setTimeout(() => window.close(), 1500);
            } else {
                statusMessage.textContent = `Ошибка сохранения: ${response.error}`;
                statusMessage.className = 'sketchy-status-message sketchy-status-error';
            }
        } catch (error) {
            console.error('Error saving alias:', error);
            statusMessage.textContent = `Непредвиденная ошибка: ${error.message}`;
            statusMessage.className = 'sketchy-status-message sketchy-status-error';
        }
    });

    // --- Update Button Logic ---
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
                statusMessage.textContent = `Алиас "${alias}" успешно обновлен!`;
                statusMessage.className = 'sketchy-status-message sketchy-status-success';
                existingAliasKey = alias;
                existingAliasData = data;
                updateUIForExistingAlias(existingAliasKey, existingAliasData);
            } else {
                statusMessage.textContent = `Ошибка обновления: ${response.error}`;
                statusMessage.className = 'sketchy-status-message sketchy-status-error';
            }
        } catch (error) {
            console.error('Error updating alias:', error);
            statusMessage.textContent = `Непредвиденная ошибка: ${error.message}`;
            statusMessage.className = 'sketchy-status-message sketchy-status-error';
        }
    });

    // --- Delete Button Logic ---
    deleteButton.addEventListener('click', async () => {
        if (!existingAliasKey) {
            statusMessage.textContent = 'Нет алиаса для удаления.';
            statusMessage.className = 'sketchy-status-message sketchy-status-error';
            return;
        }

        try {
            const response = await chrome.runtime.sendMessage({ action: 'deleteAlias', alias: existingAliasKey });
            if (response.success) {
                statusMessage.textContent = `Алиас "${existingAliasKey}" успешно удален!`;
                statusMessage.className = 'sketchy-status-message sketchy-status-success';
                existingAliasKey = null;
                existingAliasData = null;
                updateUIForNewAlias();
            } else {
                statusMessage.textContent = `Ошибка удаления: ${response.error}`;
                statusMessage.className = 'sketchy-status-message sketchy-status-error';
            }
        } catch (error) {
            console.error('Error deleting alias:', error);
            statusMessage.textContent = `Непредвиденная ошибка: ${error.message}`;
            statusMessage.className = 'sketchy-status-message sketchy-status-error';
        }
    });

    // --- Manage Aliases Button Logic ---
    manageButton.addEventListener('click', async () => {
        await chrome.runtime.sendMessage({ action: 'openOptionsPage' });
    });
});