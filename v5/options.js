// options.js

import { debounce } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    const aliasesList = document.getElementById('aliasesList');
    const loadingMessage = document.getElementById('loadingMessage');
    const noAliasesMessage = document.getElementById('noAliasesMessage');
    const filterInput = document.getElementById('filterInput');
    const exportButton = document.getElementById('exportButton');
    const importButton = document.getElementById('importButton');
    const importFile = document.getElementById('importFile');
    const statusMessageElement = document.getElementById('statusMessage');
    const syncBookmarksButton = document.getElementById('syncBookmarksButton');
    const generateAllAiKeywordsButton = document.getElementById('generateAllAiKeywordsButton');
    const folderFilterButtonsContainer = document.getElementById('folderFilterButtons');
    const deleteAllButton = document.getElementById('deleteAllButton');
    const toggleDeleteFolderModeButton = document.getElementById('toggleDeleteFolderModeButton');
    const totalAliasesCountSpan = document.getElementById('totalAliasesCount');

    // Элементы для статистики Omnibox
    const statTotalLaunches = document.getElementById('statTotalLaunches');
    const statDirectAliasLaunches = document.getElementById('statDirectAliasLaunches');
    const statFuzzySearchLaunches = document.getElementById('statFuzzySearchLaunches');
    const statAiSearchLaunches = document.getElementById('statAiSearchLaunches');
    // const statSmartSearchLaunches = document.getElementById('statSmartSearchLaunches'); // Не используем, т.к. Smart -> другие
    const statGoogleFallbackLaunches = document.getElementById('statGoogleFallbackLaunches');
    const resetStatsButton = document.getElementById('resetStatsButton'); // Кнопка сброса статистики


    // Modal elements
    const editModal = document.getElementById('editModal');
    const closeButtons = editModal.querySelectorAll('.sketchy-dialog-close-button');
    const editAliasNameInput = document.getElementById('editAliasName');
    const editUrlInput = document.getElementById('editUrl');
    const editDescriptionInput = document.getElementById('editDescription');
    const editKeywordsInput = document.getElementById('editKeywords');
    const editTagsInput = document.getElementById('editTags');
    const editSourceInput = document.getElementById('editSource');
    const editBookmarkPathInput = document.getElementById('editBookmarkPath');
    const saveEditButton = document.getElementById('saveEditButton');
    const editErrorElement = document.getElementById('editError');
    const generateAiKeywordsForEditButton = document.getElementById('generateAiKeywordsForEdit');
    const aiKeywordsLoadingIndicator = document.getElementById('aiKeywordsLoadingIndicator');

    let currentAliases = {};
    let editingAliasKey = null;
    let fuse;
    let selectedFolderPath = 'all';
    let isDeleteFolderMode = false;

    const setStatus = (message, type) => {
        statusMessageElement.textContent = message;
        statusMessageElement.className = `sketchy-status-message sketchy-status-${type}`;
        statusMessageElement.style.display = 'block';
    };

    const clearStatus = () => {
        statusMessageElement.textContent = '';
        statusMessageElement.className = 'sketchy-status-message';
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

    // Функция для обновления счетчика алиасов
    const updateAliasesCount = (aliases) => {
        const count = Object.keys(aliases).length;
        totalAliasesCountSpan.textContent = `Всего алиасов: ${count}`;
    };

    // Функция для отображения статистики Omnibox
    
        const renderOmniboxStats = async () => {
        console.log("Attempting to render Omnibox stats...");
        try {
            const stats = await chrome.runtime.sendMessage({ action: 'getStats' });
            console.log('Fetched Omnibox Stats from background:', stats);

            // Проверяем наличие элементов ПЕРЕД присвоением textContent
            if (statTotalLaunches) {
                statTotalLaunches.textContent = stats.totalLaunches || 0;
                console.log('statTotalLaunches element:', statTotalLaunches); // Логируем после обновления
            } else {
                console.warn("statTotalLaunches element is null. Check options.html ID.");
            }
            
            if (statDirectAliasLaunches) {
                statDirectAliasLaunches.textContent = stats.directAliasLaunches || 0;
            } else {
                console.warn("statDirectAliasLaunches element is null. Check options.html ID.");
            }
            
            if (statFuzzySearchLaunches) {
                statFuzzySearchLaunches.textContent = stats.fuzzySearchLaunches || 0;
            } else {
                console.warn("statFuzzySearchLaunches element is null. Check options.html ID.");
            }
            
            if (statAiSearchLaunches) {
                statAiSearchLaunches.textContent = stats.aiSearchLaunches || 0;
            } else {
                console.warn("statAiSearchLaunches element is null. Check options.html ID.");
            }
            
            if (statGoogleFallbackLaunches) {
                statGoogleFallbackLaunches.textContent = stats.googleFallbackLaunches || 0;
            } else {
                console.warn("statGoogleFallbackLaunches element is null. Check options.html ID.");
            }
            
            console.log("Omnibox stats rendered successfully (if no errors follow).");
        } catch (error) {
            console.error('Error rendering Omnibox Stats:', error);
            setStatus(`Ошибка загрузки статистики Omnibox: ${error.message || 'неизвестная ошибка'}.`, 'error');
        }
    };

    // --- Обработчик сброса статистики ---
    resetStatsButton.addEventListener('click', async () => {
        if (confirm('Вы уверены, что хотите сбросить всю статистику Omnibox? Это действие нельзя отменить.')) {
            try {
                const response = await chrome.runtime.sendMessage({ action: 'clearStats' }); // Нужен Action clearStats
                if (response.success) {
                    setStatus('Статистика Omnibox сброшена.', 'success');
                    renderOmniboxStats(); // Обновить отображение статистики
                } else {
                    setStatus(`Ошибка сброса статистики: ${response.error || 'неизвестная ошибка'}.`, 'error');
                }
            } catch (error) {
                console.error('Error clearing stats:', error);
                setStatus(`Непредвиденная ошибка сброса статистики: ${error.message}.`, 'error');
            }
        }
    });


    const renderFolderFilters = async () => {
        const response = await chrome.runtime.sendMessage({ action: 'getBookmarkFolders' });
        if (!response.success) {
            console.error("Error fetching bookmark folders:", response.error);
            return;
        }
        const folders = response.folders;

        folderFilterButtonsContainer.innerHTML = '';

        const allButton = document.createElement('button');
        allButton.className = `sketchy-button sketchy-button-secondary ${selectedFolderPath === 'all' ? 'active' : ''}`;
        allButton.textContent = 'Все';
        allButton.dataset.folderPath = 'all';
        folderFilterButtonsContainer.appendChild(allButton);

        const uncategorizedButton = document.createElement('button');
        uncategorizedButton.className = `sketchy-button sketchy-button-secondary ${selectedFolderPath === '/' ? 'active' : ''}`;
        uncategorizedButton.textContent = 'Без папки';
        uncategorizedButton.dataset.folderPath = '/';
        folderFilterButtonsContainer.appendChild(uncategorizedButton);


        folders.forEach(folderPath => {
            if (folderPath === '/') return;

            const buttonWrapper = document.createElement('div');
            buttonWrapper.className = 'sketchy-folder-button-wrapper';

            const button = document.createElement('button');
            const displayPath = folderPath.split('/').filter(Boolean).pop() || folderPath;
            button.className = `sketchy-button sketchy-button-secondary ${selectedFolderPath === folderPath ? 'active' : ''}`;
            button.textContent = displayPath;
            button.dataset.folderPath = folderPath;
            buttonWrapper.appendChild(button);

            const deleteXButton = document.createElement('button');
            deleteXButton.className = `sketchy-button sketchy-button-danger sketchy-icon-button sketchy-delete-folder-button ${isDeleteFolderMode ? 'active' : ''}`;
            deleteXButton.innerHTML = '✖';
            deleteXButton.dataset.folderPath = folderPath;
            deleteXButton.style.display = isDeleteFolderMode ? 'inline-block' : 'none';
            buttonWrapper.appendChild(deleteXButton);

            folderFilterButtonsContainer.appendChild(buttonWrapper);
        });

        folderFilterButtonsContainer.querySelectorAll('.sketchy-button-secondary').forEach(button => {
            button.addEventListener('click', (event) => {
                if (!isDeleteFolderMode) {
                    folderFilterButtonsContainer.querySelectorAll('.sketchy-button-secondary').forEach(btn => btn.classList.remove('active'));
                    event.target.classList.add('active');
                    selectedFolderPath = event.target.dataset.folderPath;
                    fetchAndRenderAliases();
                }
            });
        });

        folderFilterButtonsContainer.querySelectorAll('.sketchy-delete-folder-button').forEach(button => {
            button.addEventListener('click', async (event) => {
                const folderToDelete = event.target.dataset.folderPath;
                if (confirm(`Вы уверены, что хотите удалить ВСЕ алиасы из папки "${folderToDelete}"? Это действие нельзя отменить.`)) {
                    setStatus(`Удаление алиасов из папки "${folderToDelete}"...`, 'info');
                    event.target.disabled = true;
                    try {
                        const response = await chrome.runtime.sendMessage({ action: 'deleteAllAliasesInFolder', folderPath: folderToDelete });
                        if (response.success) {
                            setStatus(`Удалено ${response.deletedCount} алиасов из папки "${folderToDelete}".`, 'success');
                            await renderFolderFilters();
                            await fetchAndRenderAliases();
                        } else {
                            setStatus(`Ошибка удаления алиасов из папки: ${response.error || 'неизвестная ошибка'}.`, 'error');
                        }
                    } catch (error) {
                        console.error('Error deleting aliases in folder:', error);
                        setStatus(`Непредвиденная ошибка удаления: ${error.message}.`, 'error');
                    }
                }
            });
        });
    };

    toggleDeleteFolderModeButton.addEventListener('click', () => {
        isDeleteFolderMode = !isDeleteFolderMode;
        if (isDeleteFolderMode) {
            toggleDeleteFolderModeButton.classList.add('active');
            toggleDeleteFolderModeButton.textContent = '✅ Режим удаления включен';
        } else {
            toggleDeleteFolderModeButton.classList.remove('active');
            toggleDeleteFolderModeButton.textContent = '🗑️ Удалить папки';
        }

        folderFilterButtonsContainer.querySelectorAll('.sketchy-delete-folder-button').forEach(button => {
            button.style.display = isDeleteFolderMode ? 'inline-block' : 'none';
        });
    });


    const fetchAndRenderAliases = async () => {
        loadingMessage.style.display = 'block';
        aliasesList.innerHTML = '';
        noAliasesMessage.style.display = 'none';
        clearStatus();

        currentAliases = await chrome.runtime.sendMessage({ action: 'getAliases' });
        updateAliasesCount(currentAliases); // ОБНОВЛЯЕМ СЧЕТЧИК ЗДЕСЬ

        loadingMessage.style.display = 'none';

        if (Object.keys(currentAliases).length === 0) {
            noAliasesMessage.textContent = 'Пока нет сохраненных алиасов. Нажмите на иконку GoAlias, чтобы добавить первый!';
            noAliasesMessage.style.display = 'block';
            return;
        }

        let filteredByFolder = Object.entries(currentAliases).filter(([, data]) => {
            if (selectedFolderPath === 'all') {
                return true;
            }
            if (selectedFolderPath === '/') {
                return !data.bookmarkPath || data.bookmarkPath === '/';
            }
            return data.bookmarkPath === selectedFolderPath;
        });


        const aliasesForFuse = filteredByFolder.map(([aliasKey, data]) => ({
            alias: aliasKey,
            url: data.url,
            description: data.description || '',
            keywords: (data.keywords && Array.isArray(data.keywords)) ? data.keywords.join(' ') : '',
            tags: (data.tags && Array.isArray(data.tags)) ? data.tags.join(' ') : '',
            originalData: data
        }));

        const fuseOptions = {
            keys: ['alias', 'description', 'keywords', 'tags', 'url'],
            includeScore: true,
            threshold: 0.4,
            ignoreLocation: true,
            minMatchCharLength: 2,
        };
        fuse = new Fuse(aliasesForFuse, fuseOptions);

        let finalFilteredResults = [];
        const searchTerm = filterInput.value.trim();

        if (searchTerm) {
            const fuseSearchResults = fuse.search(searchTerm);
            finalFilteredResults = fuseSearchResults.map(result => [result.item.alias, result.item.originalData]);
        } else {
            finalFilteredResults = filteredByFolder;
            finalFilteredResults.sort(([, aData], [, bData]) => {
                const aLastUsed = aData.lastUsed ? new Date(aData.lastUsed).getTime() : 0;
                const bLastUsed = bData.lastUsed ? new Date(bData.lastUsed).getTime() : 0;
                if (aLastUsed !== bLastUsed) return bLastUsed - aLastUsed;
                return new Date(bData.created).getTime() - new Date(aData.created).getTime();
            });
        }


        if (finalFilteredResults.length === 0) {
            noAliasesMessage.textContent = filterInput.value.trim() || selectedFolderPath !== 'all' ? 'По вашему запросу или выбранной папке ничего не найдено.' : 'Пока нет сохраненных алиасов.';
            noAliasesMessage.style.display = 'block';
            return;
        }


        finalFilteredResults.forEach(([alias, data]) => {
            const aliasDiv = document.createElement('div');
            aliasDiv.className = 'sketchy-bento-card';
            const formattedLastUsed = data.lastUsed ? new Date(data.lastUsed).toLocaleString() : 'Никогда';
            const displayUrl = data.url.length > 50 ? `${data.url.substring(0, 47)}...` : data.url;
            const sourceIcon = {
                'manual': '📝',
                'bookmark': '🔖',
                'bookmark-ai': '🧠🔖'
            }[data.source || 'manual'];
            const displayBookmarkPath = data.bookmarkPath && data.bookmarkPath !== '/' ? data.bookmarkPath.split('/').filter(Boolean).pop() : 'Без папки';


            aliasDiv.innerHTML = `
                <div class="sketchy-card-header">
                    <span class="sketchy-alias-name">${alias}</span>
                    <div class="sketchy-card-actions">
                        <span class="sketchy-source-indicator" title="Источник: ${data.source || 'manual'} / Папка: ${data.bookmarkPath || '/'}">${sourceIcon} ${displayBookmarkPath}</span>
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

    const debouncedFetchAndRenderAliases = debounce(fetchAndRenderAliases, 300);
    filterInput.addEventListener('input', debouncedFetchAndRenderAliases);


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
            editSourceInput.value = aliasData.source || 'manual';
            editBookmarkPathInput.value = aliasData.bookmarkPath || '/';
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

    generateAiKeywordsForEditButton.addEventListener('click', async () => {
        if (!editingAliasKey) {
            setEditError('Не выбран алиас для генерации.');
            return;
        }

        const currentAliasData = currentAliases[editingAliasKey];
        if (!currentAliasData || !currentAliasData.url) {
            setEditError('Не удалось получить URL для генерации AI-ключевых слов.');
            return;
        }

        editKeywordsInput.value = '';
        aiKeywordsLoadingIndicator.style.display = 'inline-block';
        generateAiKeywordsForEditButton.disabled = true;

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'generateContentForPopup',
                tabId: null,
                url: currentAliasData.url,
                title: currentAliasData.description || currentAliasData.url
            });

            if (response.success) {
                editKeywordsInput.value = response.keywords.join(', ');
                setEditError('AI-ключевые слова сгенерированы!');
                editErrorElement.className = 'sketchy-status-message sketchy-status-success';
            } else {
                setEditError(`Ошибка AI: ${response.error || 'неизвестная ошибка'}.`);
                editErrorElement.className = 'sketchy-status-message sketchy-status-error';
            }
        } catch (error) {
            setEditError(`Непредвиденная ошибка AI: ${error.message}.`);
            editErrorElement.className = 'sketchy-status-message sketchy-status-error';
            console.error('Error during AI generation in options:', error);
        } finally {
            aiKeywordsLoadingIndicator.style.display = 'none';
            generateAiKeywordsForEditButton.disabled = false;
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
        const newSource = editSourceInput.value;
        const newBookmarkPath = editBookmarkPathInput.value;

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
            lastUsed: new Date().toISOString(),
            source: newSource,
            bookmarkPath: newBookmarkPath
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
            await renderFolderFilters();
            await fetchAndRenderAliases(); // Перерендерить список и обновить счетчик
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
                    await renderFolderFilters();
                    await fetchAndRenderAliases(); // Перерендерить список и обновить счетчик
                } else {
                    setStatus('Ошибка при удалении алиаса: ' + response.error, 'error');
                }
            } catch (error) {
                console.error('Error deleting alias:', error);
                setStatus('Непредвиденная ошибка: ' + error.message, 'error');
            }
        }
    };

    syncBookmarksButton.addEventListener('click', async () => {
        setStatus('Синхронизация закладок... это может занять некоторое время.', 'info');
        syncBookmarksButton.disabled = true;
        generateAllAiKeywordsButton.disabled = true;
        deleteAllButton.disabled = true;
        toggleDeleteFolderModeButton.disabled = true;

        try {
            const response = await chrome.runtime.sendMessage({ action: 'syncBookmarks' });
            if (response.success) {
                const addedCount = response.results.filter(r => r.action === 'added').length;
                const updatedCount = response.results.filter(r => r.action === 'updated').length;
                const skippedCount = response.results.filter(r => r.action === 'skipped_existing').length;
                setStatus(`Синхронизация завершена: добавлено ${addedCount}, обновлено ${updatedCount}, пропущено ${skippedCount} алиасов.`, 'success');
                await renderFolderFilters();
                await fetchAndRenderAliases(); // Перерендерить список и обновить счетчик
            } else {
                setStatus(`Ошибка синхронизации закладок: ${response.error || 'неизвестная ошибка'}.`, 'error');
            }
        } catch (error) {
            console.error('Error syncing bookmarks:', error);
            setStatus(`Непредвиденная ошибка синхронизации: ${error.message}.`, 'error');
        } finally {
            syncBookmarksButton.disabled = false;
            generateAllAiKeywordsButton.disabled = false;
            deleteAllButton.disabled = false;
            toggleDeleteFolderModeButton.disabled = false;
        }
    });

    generateAllAiKeywordsButton.addEventListener('click', async () => {
        if (!confirm('Это действие может занять много времени и использовать значительные ресурсы, так как AI будет генерировать ключевые слова для ВСЕХ ваших закладок. Продолжить?')) {
            return;
        }

        setStatus('Генерация AI-ключевых слов для всех закладок... Пожалуйста, не закрывайте страницу.', 'info');
        syncBookmarksButton.disabled = true;
        generateAllAiKeywordsButton.disabled = true;
        deleteAllButton.disabled = true;
        toggleDeleteFolderModeButton.disabled = true;

        try {
            const response = await chrome.runtime.sendMessage({ action: 'generateAIKeywordsForBookmarks' });
            if (response.success) {
                const addedCount = response.results.filter(r => r.action === 'added').length;
                const updatedCount = response.results.filter(r => r.action === 'updated').length;
                const skippedCount = response.results.filter(r => r.action === 'skipped_existing').length;
                setStatus(`AI-ключевые слова сгенерированы: добавлено ${addedCount}, обновлено ${updatedCount}, пропущено ${skippedCount} алиасов.`, 'success');
                await renderFolderFilters();
                await fetchAndRenderAliases(); // Перерендерить список и обновить счетчик
            } else {
                setStatus(`Ошибка генерации AI-ключевых слов: ${response.error || 'неизвестная ошибка'}.`, 'error');
            }
        } catch (error) {
            console.error('Error generating AI keywords for bookmarks:', error);
            setStatus(`Непредвиденная ошибка AI-генерации: ${error.message}.`, 'error');
        } finally {
            syncBookmarksButton.disabled = false;
            generateAllAiKeywordsButton.disabled = false;
            deleteAllButton.disabled = false;
            toggleDeleteFolderModeButton.disabled = false;
        }
    });

    deleteAllButton.addEventListener('click', async () => {
        if (confirm('ВНИМАНИЕ: Вы уверены, что хотите удалить АБСОЛЮТНО ВСЕ алиасы, включая созданные вручную? Это действие нельзя отменить!')) {
            setStatus('Удаление всех алиасов...', 'info');
            syncBookmarksButton.disabled = true;
            generateAllAiKeywordsButton.disabled = true;
            deleteAllButton.disabled = true;
            toggleDeleteFolderModeButton.disabled = true;

            try {
                const response = await chrome.runtime.sendMessage({ action: 'deleteAllAliases' });
                if (response.success) {
                    setStatus('Все алиасы успешно удалены.', 'success');
                    await renderFolderFilters();
                    await fetchAndRenderAliases(); // Перерендерить список и обновить счетчик
                } else {
                    setStatus(`Ошибка удаления всех алиасов: ${response.error || 'неизвестная ошибка'}.`, 'error');
                }
            } catch (error) {
                console.error('Error deleting all aliases:', error);
                setStatus(`Непредвиденная ошибка удаления: ${error.message}.`, 'error');
            } finally {
                syncBookmarksButton.disabled = false;
                generateAllAiKeywordsButton.disabled = false;
                deleteAllButton.disabled = false;
                toggleDeleteFolderModeButton.disabled = false;
            }
        }
    });

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
                            if (!data.source) data.source = 'manual';
                            if (!data.bookmarkPath) data.bookmarkPath = '/';
                            await chrome.runtime.sendMessage({ action: 'saveAlias', alias, data });
                        } else {
                            console.warn(`Skipping invalid alias: ${alias}`, data);
                        }
                    }
                    setStatus('Алиасы успешно импортированы!', 'success');
                    await renderFolderFilters();
                    await fetchAndRenderAliases(); // Перерендерить список и обновить счетчик
                } catch (error) {
                    setStatus('Ошибка при импорте алиасов: ' + error.message, 'error');
                    console.error('Import error:', error);
                }
            };
            reader.readAsText(file);
        }
    });

    await renderFolderFilters();
    fetchAndRenderAliases();
    renderOmniboxStats(); // Инициализируем отображение статистики при загрузке страницы
});