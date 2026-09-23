// ==============================================================================
// DRAG & DROP - LEFT PANEL ITEMS
// ==============================================================================
function initLeftPanelDragAndDrop() {
    const leftPanelMainList = document.querySelector('.left-panel-main-list');
    if (!leftPanelMainList) return;

    let dragItem = null;
    let dragItemId = null;
    let dragItemType = null;
    let dragItemPinId = null;
    let dragGhost = null;
    let dropTargetEl = null;
    let dropMode = null;
    let dropAbove = false;
    let dropIndicator = null;
    let dragFolderId = null;

    function isFolderContext() {
        return typeof currentOpenFolderId !== 'undefined' && !!currentOpenFolderId;
    }

    function getFolderIdForElement(el) {
        if (isFolderContext()) return currentOpenFolderId;
        if (!el) return null;
        const parent = el.getAttribute('data-parent-folder');
        return parent && parent !== 'root' ? parent : null;
    }

    function getActivePinListForFolder(folderId) {
        return folderId ? getFolderPinnedItems(folderId) : getPinnedItems();
    }

    function saveActivePinListForFolder(folderId, list) {
        if (folderId) {
            const map = getFolderPinnedItemsMap();
            map[folderId] = list;
            saveFolderPinnedItemsMap(map);
        } else {
            savePinnedItems(list);
        }
    }

    function isActivePinned(pinId) {
        return getActivePinListForFolder(dragFolderId).includes(pinId);
    }

    function parseItemMetadata(item) {
        const view = item.getAttribute('data-view');
        if (!view) return null;
        if (view === 'all-songs')
            return {
                id: 'all-songs',
                type: 'special',
                pinId: 'all-songs'
            };
        if (view === 'favorites')
            return {
                id: 'favorites',
                type: 'special',
                pinId: 'favorites'
            };
        if (view.startsWith('playlist-'))
            return {
                id: view.replace('playlist-', ''),
                type: 'playlist',
                pinId: view
            };
        if (view.startsWith('folder-'))
            return {
                id: view.replace('folder-', ''),
                type: 'folder',
                pinId: view
            };
        if (view.startsWith('a') && view.length === 13)
            return {
                id: view,
                type: 'album',
                pinId: view
            };
        if (view.startsWith('r') && view.length === 13)
            return {
                id: view,
                type: 'artist',
                pinId: view
            };
        return null;
    }

    function isDescendantFolder(rootId, candidateId) {
        if (rootId === candidateId) return true;
        const folders = getFolders();
        const stack = [rootId];
        const seen = new Set();
        while (stack.length > 0) {
            const current = stack.pop();
            if (seen.has(current)) continue;
            seen.add(current);
            const folder = folders.find((f) => f.id === current);
            if (!folder) continue;
            for (const child of folder.children) {
                if (child.type !== 'folder') continue;
                if (child.id === candidateId) return true;
                stack.push(child.id);
            }
        }
        return false;
    }

    function clearDropState() {
        if (dropTargetEl) {
            dropTargetEl.classList.remove('drag-hover');
            dropTargetEl.classList.remove('drag-folder-hover');
        }
        dropTargetEl = null;
        dropMode = null;
        if (dropIndicator) {
            dropIndicator.remove();
            dropIndicator = null;
        }
    }

    function updateDropTarget(mouseX, mouseY) {
        clearDropState();

        const el = document.elementFromPoint(mouseX, mouseY);
        const targetItem = el ? el.closest('.left-panel-main-item') : null;
        if (!targetItem || targetItem === dragItem) return;

        const meta = parseItemMetadata(targetItem);
        if (!meta) return;

        if (meta.type === 'folder' && !dragFolderId) {
            if (isActivePinned(dragItemPinId)) return;
            if (dragItemType === 'folder' && isDescendantFolder(dragItemId, meta.id)) return;

            targetItem.classList.add('drag-folder-hover');
            dropTargetEl = targetItem;
            dropMode = 'folder';
            return;
        }

        if (isActivePinned(meta.pinId)) {
            dropTargetEl = targetItem;
            dropMode = 'pin';

            const rect = targetItem.getBoundingClientRect();
            dropAbove = mouseY < rect.top + rect.height / 2;

            dropIndicator = document.createElement('div');
            dropIndicator.className = 'pinned-drop-indicator';
            const parent = targetItem.parentNode;
            if (dropAbove) {
                parent.insertBefore(dropIndicator, targetItem);
            } else {
                parent.insertBefore(dropIndicator, targetItem.nextSibling);
            }
        }
    }

    function onMouseMove(e) {
        if (!dragGhost) return;
        dragGhost.style.left = e.clientX + 14 + 'px';
        dragGhost.style.top = e.clientY + 14 + 'px';
        updateDropTarget(e.clientX, e.clientY);
    }

    function onMouseUp(e) {
        const finalTarget = dropTargetEl;
        const finalMode = dropMode;
        const finalAbove = dropAbove;

        if (dragGhost) {
            dragGhost.remove();
            dragGhost = null;
        }

        const draggedId = dragItemId;
        const draggedType = dragItemType;
        const draggedPinId = dragItemPinId;

        if (dragItem) {
            dragItem.style.opacity = '';
            dragItem.style.cursor = '';
        }

        clearDropState();

        document.body.classList.remove('no-select');
        document.body.classList.remove('dragging-song');
        document.body.style.cursor = '';

        const draggedFolderId = dragFolderId;

        dragItem = null;
        dragItemId = null;
        dragItemType = null;
        dragItemPinId = null;
        dragFolderId = null;

        if (!finalTarget || !draggedId) return;

        const meta = parseItemMetadata(finalTarget);
        if (!meta) return;

        if (finalMode === 'folder') {
            if (isActivePinned(draggedPinId)) {
                showNotification('Unpin the item before moving it into a folder', 'warning', 2000);
                return;
            }

            const isMovable = draggedType === 'playlist' || draggedType === 'folder';
            const asShortcut = !isMovable;

            const applied = addToFolder(meta.id, draggedId, draggedType, asShortcut);
            if (applied) {
                const folder = getFolders().find((f) => f.id === meta.id);
                if (asShortcut) {
                    showNotification(
                        `Added ${CONTEXT_MENU_TYPE_LABELS[draggedType] || 'Item'} shortcut to "${
                            folder ? folder.name : 'folder'
                        }"`,
                        'success',
                        2000
                    );
                } else {
                    showNotification(
                        `Moved ${CONTEXT_MENU_TYPE_LABELS[draggedType] || 'Item'} to "${
                            folder ? folder.name : 'folder'
                        }"`,
                        'success',
                        2000
                    );
                }
                renderFoldersView();
                renderLeftPanelMainList();
                updateScrollbarById('left-panel-main-content');
                if (currentOpenFolderId) renderFolderContents(currentOpenFolderId);
            } else {
                showNotification('Item already in that folder', 'warning', 2000);
            }
            return;
        }

        if (finalMode === 'pin' && draggedPinId) {
            let pinned = [...getActivePinListForFolder(draggedFolderId)];
            const wasPinned = pinned.includes(draggedPinId);

            if (!wasPinned) {
                pinned.push(draggedPinId);
            }

            let reordered = pinned;
            if (draggedPinId !== meta.pinId) {
                reordered = pinned.filter((id) => id !== draggedPinId);
                const targetIndex = reordered.indexOf(meta.pinId);
                const insertAt = targetIndex === -1 ? reordered.length : finalAbove ? targetIndex : targetIndex + 1;
                reordered.splice(insertAt, 0, draggedPinId);
            }

            saveActivePinListForFolder(draggedFolderId, reordered);

            if (!wasPinned && dragItem) {
                const label = dragItem.querySelector('.main-item-title')?.textContent || 'Item';
                showNotification(`"${label}" pinned`, 'success', 2000);
            }

            if (draggedFolderId && currentOpenFolderId === draggedFolderId) {
                renderFolderContents(draggedFolderId);
            } else if (leftPanelVirtualState.enabled) {
                leftPanelVirtualState.currentItems = getLeftPanelItemsArray();
                renderLeftPanelVisibleItems(false);
            } else {
                renderLeftPanelMainList();
            }

            updateScrollbarById('left-panel-main-content');
        }
    }

    leftPanelMainList.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        const item = e.target.closest('.left-panel-main-item');
        if (!item) return;

        const meta = parseItemMetadata(item);
        if (!meta) return;

        let hasMoved = false;
        const startX = e.clientX;
        const startY = e.clientY;

        const onMove = (moveEvent) => {
            if (!hasMoved) {
                if (Math.abs(moveEvent.clientX - startX) < 5 && Math.abs(moveEvent.clientY - startY) < 5) return;
                hasMoved = true;

                dragItem = item;
                dragItemId = meta.id;
                dragItemType = meta.type;
                dragItemPinId = meta.pinId;
                dragFolderId = getFolderIdForElement(item);

                const titleText = item.querySelector('.main-item-title')?.textContent || 'Item';

                dragGhost = document.createElement('div');
                dragGhost.className = 'drag-song-tooltip';
                dragGhost.innerHTML = `<span class="drag-song-title">${escapeHtml(
                    titleText
                )}</span><span class="drag-song-artist">${escapeHtml(
                    CONTEXT_MENU_TYPE_LABELS[meta.type] || 'Item'
                )}</span>`;
                dragGhost.style.position = 'fixed';
                dragGhost.style.zIndex = '100000';
                dragGhost.style.pointerEvents = 'none';
                dragGhost.style.left = moveEvent.clientX + 14 + 'px';
                dragGhost.style.top = moveEvent.clientY + 14 + 'px';
                document.body.appendChild(dragGhost);

                item.style.opacity = '0.4';
                item.style.cursor = 'grabbing';
                document.body.classList.add('no-select');
                document.body.classList.add('dragging-song');
                document.body.style.cursor = 'not-allowed';

                const draggedIsPinned = isActivePinned(meta.pinId);
                const inFolder = !!dragFolderId;

                document.querySelectorAll('.left-panel-main-item').forEach((el) => {
                    if (el === item) return;
                    const elMeta = parseItemMetadata(el);
                    if (!elMeta) return;
                    const isFolder = elMeta.type === 'folder';
                    const isPinnedTarget = isActivePinned(elMeta.pinId);

                    if (draggedIsPinned) {
                        if (!isPinnedTarget) el.classList.add('drag-invalid');
                    } else if (inFolder) {
                        if (!isPinnedTarget) el.classList.add('drag-invalid');
                    } else {
                        if (!isFolder && !isPinnedTarget) el.classList.add('drag-invalid');
                    }
                });
            }

            onMouseMove(moveEvent);
        };

        const onUp = (upEvent) => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            window.removeEventListener('blur', onBlurCleanupLeft);

            if (!hasMoved) return;

            document
                .querySelectorAll('.left-panel-main-item.drag-invalid')
                .forEach((el) => el.classList.remove('drag-invalid'));
            onMouseUp(upEvent);
        };

        const onBlurCleanupLeft = () => {
            if (!hasMoved) return;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            if (dragGhost) {
                dragGhost.remove();
                dragGhost = null;
            }
            document
                .querySelectorAll('.left-panel-main-item.drag-invalid')
                .forEach((el) => el.classList.remove('drag-invalid'));
            document
                .querySelectorAll('.left-panel-main-item.drag-hover, .left-panel-main-item.drag-folder-hover')
                .forEach((el) => {
                    el.classList.remove('drag-hover', 'drag-folder-hover');
                });
            leftPanelElement.classList.remove('drag-panel-hover');
            document.body.classList.remove('no-select');
            document.body.classList.remove('dragging-song');
            document.body.style.cursor = '';
            dragItem = null;
            dragItemId = null;
            dragItemType = null;
            dragItemPinId = null;
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        window.addEventListener('blur', onBlurCleanupLeft, {
            once: true
        });
    });
}
