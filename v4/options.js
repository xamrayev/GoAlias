// options.js (без изменений от предыдущей версии)

document.addEventListener('DOMContentLoaded', async () => {
    const aliasesList = document.getElementById('aliasesList');
    const loadingMessage = document.getElementById('loadingMessage');
    const noAliasesMessage = document.getElementById('noAliasesMessage');
    const filterInput = document.getElementById('filterInput');
    const exportButton = document.getElementById('exportButton');
    const importButton = document.getElementById('importButton');
    const importFile = document.getElementById('importFile');
    const statusMessageElement = document.getElementById('statusMessage');

    // Modal elements
    const editModal = document.getElementById('editModal');
    const closeButtons = editModal.querySelectorAll('.sketchy-dialog-close-button'); // <-- Обновленный класс
    const editAliasNameInput = document.getElementById('editAliasName');
    const editUrlInput = document.getElementById('editUrl');
    const editDescriptionInput = document.getElementById('editDescription');
    const editKeywordsInput = document.getElementById('editKeywords');
    const editTagsInput = document.getElementById('editTags');
    const saveEditButton = document.getElementById('saveEditButton');
    const editErrorElement = document.getElementById('editError');

    let currentAliases = {};
    let editingAliasKey = null;

    const setStatus = (message, type) => {
        statusMessageElement.textContent = message;
        statusMessageElement.className = `sketchy-status-message sketchy-status-${type}`; // <-- Обновленные классы
        statusMessageElement.style.display = 'block';
    };

    const clearStatus = () => {
        statusMessageElement.textContent = '';
        statusMessageElement.className = 'sketchy-status-message'; // <-- Обновленный класс
        statusMessageElement.style.display = 'none';
    };

    const setEditError = (message) => {
        editErrorElement.textContent = message;
        editErrorElement.style.display = 'block';
    };

    const clearEditError = () => {
        editErrorElement.textContent = '';
        editErrorElement.style.display = 'none';
    };

    const fetchAndRenderAliases = async () => {
        loadingMessage.style.display = 'block';
        aliasesList.innerHTML = '';
        noAliasesMessage.style.display = 'none';
        clearStatus();

        currentAliases = await chrome.runtime.sendMessage({ action: 'getAliases' });

        loadingMessage.style.display = 'none';

        if (Object.keys(currentAliases).length === 0) {
            noAliasesMessage.style.display = 'block';
            return;
        }

        const filteredAliases = Object.entries(currentAliases).filter(([alias, data]) => {
            const searchTerm = filterInput.value.toLowerCase();
            return alias.toLowerCase().includes(searchTerm) ||
                   (data.url && data.url.toLowerCase().includes(searchTerm)) ||
                   (data.description && data.description.toLowerCase().includes(searchTerm)) ||
                   (data.keywords && data.keywords.some(k => k.toLowerCase().includes(searchTerm))) ||
                   (data.tags && data.tags.some(t => t.toLowerCase().includes(searchTerm)));
        });

        filteredAliases.sort(([, aData], [, bData]) => {
            const aLastUsed = aData.lastUsed ? new Date(aData.lastUsed).getTime() : 0;
            const bLastUsed = bData.lastUsed ? new Date(bData.lastUsed).getTime() : 0;
            if (aLastUsed !== bLastUsed) return bLastUsed - aLastUsed;
            return new Date(bData.created).getTime() - new Date(aData.created).getTime();
        });


        filteredAliases.forEach(([alias, data]) => {
            const aliasDiv = document.createElement('div');
            aliasDiv.className = 'sketchy-bento-card'; // <-- Обновленный класс для Sketchy Bento Card
            const formattedLastUsed = data.lastUsed ? new Date(data.lastUsed).toLocaleString() : 'Никогда';
            const displayUrl = data.url.length > 50 ? `${data.url.substring(0, 47)}...` : data.url;

            aliasDiv.innerHTML = `
                <div class="sketchy-card-header">
                    <span class="sketchy-alias-name">${alias}</span>
                    <div class="sketchy-card-actions">
                        <button class="sketchy-button sketchy-button-secondary sketchy-icon-button edit-btn" data-alias="${alias}" title="Редактировать">✏️</button>
                        <button class="sketchy-button sketchy-button-text sketchy-icon-button delete-btn" data-alias="${alias}" title="Удалить" style="color: #cc0000;">🗑️</button>
                    </div>
                </div>
                <div class="sketchy-card-body">
                    <a href="${data.url}" target="_blank" class="sketchy-alias-url">${displayUrl}</a>
                    <p class="sketchy-alias-description">📊 ${data.description || 'Нет описания'}</p>
                    <p class="sketchy-alias-keywords">🏷️ ${data.keywords.join(', ') || 'Нет ключевых слов'}</p>
                    <p class="sketchy-alias-tags"># ${data.tags.join(', ') || 'Нет тегов'}</p>
                    <p class="sketchy-alias-stats">📈 Использовано ${data.usageCount} раз • Последнее: ${formattedLastUsed}</p>
                </div>
            `;
            aliasesList.appendChild(aliasDiv);
        });

        aliasesList.querySelectorAll('.edit-btn').forEach(button => {
            button.addEventListener('click', openEditModal);
        });
        aliasesList.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', deleteAlias);
        });
    };

    filterInput.addEventListener('input', fetchAndRenderAliases);

    const openEditModal = (event) => {
        const aliasKey = event.target.dataset.alias;
        editingAliasKey = aliasKey;
        const aliasData = currentAliases[aliasKey];

        if (aliasData) {
            editAliasNameInput.value = aliasKey;
            editUrlInput.value = aliasData.url;
            editDescriptionInput.value = aliasData.description || '';
            editKeywordsInput.value = aliasData.keywords.join(', ') || '';
            editTagsInput.value = aliasData.tags.join(', ') || '';
            clearEditError();
            editModal.style.display = 'flex';
        }
    };

    const closeEditModal = () => {
        editModal.style.display = 'none';
        editingAliasKey = null;
        clearEditError();
    };

    closeButtons.forEach(button => {
        button.addEventListener('click', closeEditModal);
    });

    editModal.addEventListener('click', (event) => {
        if (event.target === editModal) {
            closeEditModal();
        }
    });

    saveEditButton.addEventListener('click', async () => {
        if (!editingAliasKey) return;

        clearEditError();

        const newAliasName = editAliasNameInput.value.trim();
        const newUrl = editUrlInput.value.trim();
        const newDescription = editDescriptionInput.value.trim();
        const newKeywords = editKeywordsInput.value.split(',').map(k => k.trim()).filter(k => k);
        const newTags = editTagsInput.value.split(',').map(t => t.trim()).filter(t => t);

        if (!newAliasName) { setEditError('Алиас не может быть пустым.'); return; }
        if (!/^[a-zA-Z0-9_-]+$/.test(newAliasName)) { setEditError('Алиас может содержать только латинские буквы, цифры, дефисы и подчеркивания.'); return; }
        if (!newUrl) { setEditError('URL не может быть пустым.'); return; }

        const aliasesForConflictCheck = await chrome.runtime.sendMessage({ action: 'getAliases' });
        if (aliasesForConflictCheck[newAliasName] && newAliasName !== editingAliasKey) {
            setEditError(`Алиас "${newAliasName}" уже существует. Выберите другой.`);
            return;
        }

        const originalAliasData = currentAliases[editingAliasKey];
        const updatedData = {
            ...originalAliasData,
            url: newUrl,
            description: newDescription,
            keywords: newKeywords,
            tags: newTags,
            lastUsed: new Date().toISOString()
        };

        try {
            if (newAliasName !== editingAliasKey) {
                await chrome.runtime.sendMessage({ action: 'deleteAlias', alias: editingAliasKey });
                await chrome.runtime.sendMessage({ action: 'saveAlias', alias: newAliasName, data: updatedData });
                setStatus(`Алиас "${editingAliasKey}" переименован в "${newAliasName}" и обновлен!`, 'success');
            } else {
                await chrome.runtime.sendMessage({ action: 'updateAlias', alias: editingAliasKey, data: updatedData });
                setStatus(`Алиас "${editingAliasKey}" обновлен!`, 'success');
            }
            closeEditModal();
            await fetchAndRenderAliases();
        } catch (error) {
            setEditError('Ошибка при обновлении алиаса: ' + error.message);
            console.error('Error saving alias in options:', error);
        }
    });

    const deleteAlias = async (event) => {
        const aliasKey = event.target.dataset.alias;
        if (confirm(`Вы уверены, что хотите удалить алиас "${aliasKey}"?`)) {
            try {
                const response = await chrome.runtime.sendMessage({
                    action: 'deleteAlias',
                    alias: aliasKey
                });
                if (response.success) {
                    setStatus(`Алиас "${aliasKey}" успешно удален.`, 'success');
                    await fetchAndRenderAliases();
                } else {
                    setStatus('Ошибка при удалении алиаса: ' + response.error, 'error');
                }
            } catch (error) {
                console.error('Error deleting alias:', error);
                setStatus('Непредвиденная ошибка: ' + error.message, 'error');
            }
        }
    };

    exportButton.addEventListener('click', async () => {
        const aliasesToExport = await chrome.runtime.sendMessage({ action: 'getAliases' });
        const dataStr = JSON.stringify(aliasesToExport, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'goalias_aliases.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setStatus('Алиасы экспортированы в goalias_aliases.json', 'info');
    });

    importButton.addEventListener('click', () => {
        importFile.click();
    });

    importFile.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const importedAliases = JSON.parse(e.target.result);
                    if (typeof importedAliases !== 'object' || importedAliases === null) {
                        throw new Error("Неверный формат JSON.");
                    }
                    for (const alias in importedAliases) {
                        const data = importedAliases[alias];
                        if (data.url && data.description && Array.isArray(data.keywords)) {
                            if (!Array.isArray(data.tags)) data.tags = [];
                            await chrome.runtime.sendMessage({ action: 'saveAlias', alias, data });
                        } else {
                            console.warn(`Skipping invalid alias: ${alias}`, data);
                        }
                    }
                    setStatus('Алиасы успешно импортированы!', 'success');
                    await fetchAndRenderAliases();
                } catch (error) {
                    setStatus('Ошибка при импорте алиасов: ' + error.message, 'error');
                    console.error('Import error:', error);
                }
            };
            reader.readAsText(file);
        }
    });

    fetchAndRenderAliases();
});