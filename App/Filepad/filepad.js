(() => {
    const currentScript = document.currentScript;
    const container = currentScript.parentElement;
    const $ = (sel) => container.querySelector(sel);

    const fpRoot = $('.fp-root');
    const tabBar = $('#fp-tab-bar');
    const body = $('#fp-body');
    const statusTxt = $('#fp-status-text');
    const statusTyp = $('#fp-status-type');
    const sidebar = $('#fp-sidebar');
    const sideTree = $('#fp-sidebar-tree');
    const saveModal = $('#fp-save-modal');
    const warnModal = $('#fp-warn-modal');
    const saveDir = $('#fp-save-dir');
    const saveName = $('#fp-save-name');
    const saveErr = $('#fp-save-err');

    const fs = () => window.WebOS?.fs;
    const kernel = () => window.WebOS?.kernel;

    // ── Window controls ────────────────────────────────────────────────────────
    let isMaximized = false;
    let prevState = {};

    $('.fp-btn-close').onclick = () => attemptCloseAll();
    $('.fp-btn-max').onclick = () => toggleMax();
    $('.fp-btn-min').onclick = () => restore();

    function maximize() {
        if (isMaximized) return;
        prevState = { width: container.style.width, height: container.style.height, top: container.style.top, left: container.style.left };
        const screen = container.parentElement;
        container.style.width = screen.offsetWidth + 'px';
        container.style.height = screen.offsetHeight + 'px';
        container.style.top = '0'; container.style.left = '0';
        fpRoot.style.borderRadius = '0';
        isMaximized = true;
    }
    function restore() {
        if (!isMaximized) return;
        container.style.width = prevState.width;
        container.style.height = prevState.height;
        container.style.top = prevState.top;
        container.style.left = prevState.left;
        fpRoot.style.borderRadius = '';
        isMaximized = false;
    }
    function toggleMax() { isMaximized ? restore() : maximize(); }

    // ── Constants ──────────────────────────────────────────────────────────────
    const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif']);
    const isImageExt = (ext) => IMAGE_EXTS.has((ext || '').toLowerCase());

    // ── Tab state ──────────────────────────────────────────────────────────────
    // Each tab: { id, fileRef, untitledText, isDirty, scrollTop, selStart, selEnd }
    let tabs = [];
    let activeTab = null;
    let tabIdSeq = 0;

    function createTab(fileRef = null) {
        const tab = {
            id: tabIdSeq++,
            fileRef,
            untitledText: '',
            isDirty: false,
            scrollTop: 0,
            selStart: 0,
            selEnd: 0,
        };
        tabs.push(tab);
        return tab;
    }

    function switchTo(tab) {
        // Save scroll/cursor of current active tab before switching
        if (activeTab) {
            const ta = body.querySelector('.fp-textarea');
            if (ta) {
                activeTab.scrollTop = ta.scrollTop;
                activeTab.selStart = ta.selectionStart;
                activeTab.selEnd = ta.selectionEnd;
            }
        }
        activeTab = tab;
        renderTabs();
        renderBody();
    }

    function closeTab(tab) {
        const idx = tabs.indexOf(tab);
        tabs.splice(idx, 1);
        if (tabs.length === 0) {
            // Open a fresh untitled when last tab is closed
            const t = createTab(null);
            switchTo(t);
        } else {
            const next = tabs[Math.min(idx, tabs.length - 1)];
            switchTo(next);
        }
    }

    // ── Tab bar rendering ──────────────────────────────────────────────────────
    function renderTabs() {
        tabBar.innerHTML = '';
        tabs.forEach(tab => {
            const el = document.createElement('div');
            el.className = 'fp-tab' + (tab === activeTab ? ' active' : '');

            const nameSpan = document.createElement('span');
            nameSpan.className = 'fp-tab-name';
            nameSpan.textContent = tabLabel(tab);

            const dot = document.createElement('span');
            dot.className = 'fp-tab-dirty' + (tab.isDirty ? ' visible' : '');
            dot.title = 'Unsaved';

            const closeBtn = document.createElement('span');
            closeBtn.className = 'fp-tab-close';
            closeBtn.textContent = '×';
            closeBtn.title = 'Close';
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (tab.isDirty) {
                    showWarnModal(tab, () => closeTab(tab));
                } else {
                    closeTab(tab);
                }
            });

            el.append(dot, nameSpan, closeBtn);
            el.addEventListener('click', () => switchTo(tab));
            tabBar.appendChild(el);
        });

        // "+" new tab button
        const addBtn = document.createElement('div');
        addBtn.className = 'fp-tab-add';
        addBtn.textContent = '+';
        addBtn.title = 'New tab';
        addBtn.addEventListener('click', () => {
            const t = createTab(null);
            switchTo(t);
        });
        tabBar.appendChild(addBtn);
    }

    function tabLabel(tab) {
        if (!tab.fileRef) return 'Untitled';
        return `${tab.fileRef.name}.${tab.fileRef.extName}`;
    }

    // ── Body rendering ─────────────────────────────────────────────────────────
    function renderBody() {
        if (!activeTab) return;
        const tab = activeTab;
        const ext = tab.fileRef ? (tab.fileRef.extName || '').toLowerCase() : 'txt';

        // Update titlebar icon & status type
        statusTyp.textContent = ext.toUpperCase() || 'TXT';

        if (!tab.fileRef) {
            renderTextEditor(tab);
        } else if (isImageExt(ext)) {
            renderImage(tab);
        } else {
            renderTextEditor(tab);
        }
    }

    // ── Text editor ────────────────────────────────────────────────────────────
    function renderTextEditor(tab) {
        body.innerHTML = '';
        const ta = document.createElement('textarea');
        ta.className = 'fp-textarea';
        ta.value = tab.fileRef ? (tab.fileRef.content || '') : tab.untitledText;
        ta.spellcheck = false;
        ta.scrollTop = tab.scrollTop;

        updateTextStatus(ta.value);

        ta.addEventListener('input', () => {
            if (tab.fileRef) {
                tab.fileRef.content = ta.value;
            } else {
                tab.untitledText = ta.value;
            }
            markDirty(tab);
            updateTextStatus(ta.value);
        });

        body.appendChild(ta);
        ta.focus();
        try { ta.setSelectionRange(tab.selStart, tab.selEnd); } catch (_) { }
    }

    function updateTextStatus(text) {
        const lines = text ? text.split('\n').length : 0;
        const chars = text ? text.length : 0;
        statusTxt.textContent = `${lines} line${lines !== 1 ? 's' : ''} · ${chars} char${chars !== 1 ? 's' : ''}`;
    }

    function flashSaved() {
        statusTxt.classList.remove('fp-saved');
        void statusTxt.offsetWidth;
        statusTxt.classList.add('fp-saved');
    }

    // ── Dirty tracking ─────────────────────────────────────────────────────────
    function markDirty(tab) {
        tab.isDirty = true;
        renderTabs();
    }
    function markClean(tab) {
        tab.isDirty = false;
        renderTabs();
    }

    // ── Image renderer ─────────────────────────────────────────────────────────
    function renderImage(tab) {
        body.innerHTML = '';
        if (tab.fileRef.content) {
            renderImageContent(tab.fileRef.content, tab.fileRef.extName);
        } else {
            renderImageImport(tab.fileRef);
        }
    }

    function renderImageContent(base64, ext) {
        body.innerHTML = '';
        const viewer = document.createElement('div');
        viewer.className = 'fp-image-viewer';
        const img = document.createElement('img');
        const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
        img.src = base64.startsWith('data:') ? base64 : `data:${mime};base64,${base64}`;
        img.onload = () => { statusTxt.textContent = `${img.naturalWidth} × ${img.naturalHeight}px`; };
        img.onerror = () => { statusTxt.textContent = 'Failed to render image'; };
        viewer.appendChild(img);
        body.appendChild(viewer);
    }

    function renderImageImport(fileObj) {
        body.innerHTML = '';
        const wrap = document.createElement('div');
        wrap.className = 'fp-img-import';

        const icon = document.createElement('div');
        icon.className = 'fp-img-import-icon';
        icon.textContent = '⚠';

        const title = document.createElement('div');
        title.className = 'fp-img-import-title';
        title.textContent = 'NO IMAGE DATA';

        const dropZone = document.createElement('div');
        dropZone.className = 'fp-drop-zone';
        dropZone.innerHTML = `<span class="fp-drop-icon">⊕</span><span class="fp-drop-label">Drop image here or Ctrl+V to paste</span>`;

        const divider = document.createElement('div');
        divider.className = 'fp-import-divider';
        divider.textContent = 'or import from FS path';

        const row = document.createElement('div');
        row.className = 'fp-img-import-row';

        const fsInput = document.createElement('input');
        fsInput.className = 'fp-img-url-input';
        fsInput.placeholder = 'e.g. Images/photo.png';
        fsInput.autocomplete = 'off';
        fsInput.spellcheck = false;

        const importBtn = document.createElement('button');
        importBtn.className = 'fp-img-import-btn';
        importBtn.textContent = 'Import';

        const errMsg = document.createElement('div');
        errMsg.className = 'fp-img-err-msg';

        row.append(fsInput, importBtn);
        wrap.append(icon, title, dropZone, divider, row, errMsg);
        body.appendChild(wrap);
        statusTxt.textContent = 'No image data';

        function saveAndRender(base64) {
            fileObj.content = base64;
            fs()?.saveToDisk();
            markClean(activeTab);
            errMsg.textContent = '';
            renderImageContent(base64, fileObj.extName);
        }
        function showErr(msg) { errMsg.textContent = msg; }

        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('fp-drop-zone--over'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('fp-drop-zone--over'));
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('fp-drop-zone--over');
            const file = e.dataTransfer?.files[0];
            if (!file) return showErr('No file dropped');
            if (!file.type.startsWith('image/')) return showErr('Not an image');
            blobToBase64(file).then(saveAndRender).catch(() => showErr('Failed to read file'));
        });

        function onPaste(e) {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    const blob = item.getAsFile();
                    if (blob) { blobToBase64(blob).then(saveAndRender).catch(() => showErr('Clipboard read failed')); return; }
                }
            }
            showErr('No image in clipboard');
        }
        container.addEventListener('paste', onPaste);

        function doFsImport() {
            const val = fsInput.value.trim();
            if (!val) return;
            const srcFile = fs()?.getFile(val);
            if (!srcFile) return showErr(`Not found: ${val}`);
            if (!srcFile.content) return showErr('Source has no content');
            container.removeEventListener('paste', onPaste);
            saveAndRender(srcFile.content);
        }
        importBtn.onclick = doFsImport;
        fsInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doFsImport(); });
    }

    function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('FileReader error'));
            reader.readAsDataURL(blob);
        });
    }

    // ── Save ───────────────────────────────────────────────────────────────────
    function save(tab, afterSave) {
        if (!tab) tab = activeTab;
        if (!tab) return;
        if (!tab.fileRef) {
            showSaveModal(tab, afterSave);
            return;
        }
        fs()?.saveToDisk();
        markClean(tab);
        flashSaved();
        if (afterSave) afterSave();
    }

    // ── Save-as modal ──────────────────────────────────────────────────────────
    let saveModalCallback = null;
    let saveModalTab = null;

    function showSaveModal(tab, cb) {
        saveErr.textContent = '';
        saveDir.value = '';
        saveName.value = '';
        saveModalTab = tab;
        saveModalCallback = cb || null;
        saveModal.classList.remove('hidden');
        setTimeout(() => saveName.focus(), 30);
    }

    function doSaveAs() {
        const dir = saveDir.value.trim();
        const name = saveName.value.trim();
        if (!name) { saveErr.textContent = 'Filename required'; return; }

        const parts = name.split('.');
        const ext = parts.length > 1 ? parts.pop() : 'txt';
        const baseName = parts.join('.');
        const f = fs();
        if (!f) { saveErr.textContent = 'Filesystem unavailable'; return; }

        const folder = f.travelTo(dir);
        if (!folder) { saveErr.textContent = `Directory not found: ${dir || '(root)'}`; return; }
        if (folder.has(baseName)) { saveErr.textContent = 'File already exists'; return; }

        f.addFile(baseName, ext, saveModalTab.untitledText, dir);
        const path = dir ? `${dir}/${baseName}.${ext}` : `${baseName}.${ext}`;
        saveModalTab.fileRef = f.getFile(path);

        saveModal.classList.add('hidden');
        markClean(saveModalTab);
        statusTyp.textContent = ext.toUpperCase();
        flashSaved();
        if (saveModalCallback) { saveModalCallback(); saveModalCallback = null; }
        saveModalTab = null;
    }

    $('#fp-save-confirm').onclick = doSaveAs;
    $('#fp-save-cancel').onclick = () => { saveModal.classList.add('hidden'); saveModalCallback = null; saveModalTab = null; };
    saveDir.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveName.focus(); });
    saveName.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSaveAs(); if (e.key === 'Escape') saveModal.classList.add('hidden'); });

    // ── Unsaved warning modal ──────────────────────────────────────────────────
    let warnCallback = null;
    let warnTab = null;

    function showWarnModal(tab, afterAction) {
        warnTab = tab;
        warnCallback = afterAction;
        warnModal.classList.remove('hidden');
    }

    $('#fp-warn-cancel').onclick = () => { warnModal.classList.add('hidden'); warnCallback = null; warnTab = null; };
    $('#fp-warn-discard').onclick = () => {
        warnModal.classList.add('hidden');
        const cb = warnCallback; warnCallback = null; warnTab = null;
        if (cb) cb();
    };
    $('#fp-warn-save').onclick = () => {
        warnModal.classList.add('hidden');
        const tab = warnTab;
        const cb = warnCallback;
        warnCallback = null; warnTab = null;
        save(tab, cb);
    };

    // Close all — check for any dirty tab
    function attemptCloseAll() {
        const dirtyTabs = tabs.filter(t => t.isDirty);
        if (dirtyTabs.length === 0) { container.remove(); return; }
        // Warn about first dirty tab, then chain
        showWarnModal(dirtyTabs[0], () => {
            dirtyTabs[0].isDirty = false;
            attemptCloseAll();
        });
    }

    // ── Toolbar ────────────────────────────────────────────────────────────────
    $('#fp-btn-new').onclick = () => { const t = createTab(null); switchTo(t); };
    $('#fp-btn-save').onclick = () => save(activeTab);
    $('#fp-btn-open-file').onclick = () => showOpenFilePrompt();
    $('#fp-btn-open-folder').onclick = () => toggleSidebar();

    function showOpenFilePrompt() {
        const path = prompt('Enter file path (e.g. Documents/notes.txt):');
        if (path) openByPath(path.trim());
    }
    function toggleSidebar() {
        sidebar.classList.toggle('hidden');
        if (!sidebar.classList.contains('hidden')) renderSidebarTree();
    }

    // ── Keyboard shortcuts ─────────────────────────────────────────────────────
    container.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            save(activeTab);
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            const t = createTab(null);
            switchTo(t);
        }
        // Ctrl+W — close active tab
        if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
            e.preventDefault();
            if (!activeTab) return;
            if (activeTab.isDirty) {
                showWarnModal(activeTab, () => closeTab(activeTab));
            } else {
                closeTab(activeTab);
            }
        }
        // Ctrl+Tab — next tab
        if (e.ctrlKey && e.key === 'Tab') {
            e.preventDefault();
            const idx = tabs.indexOf(activeTab);
            switchTo(tabs[(idx + 1) % tabs.length]);
        }
    });

    // ── Open by path ───────────────────────────────────────────────────────────
    function openByPath(rawPath) {
        if (!rawPath) return;
        const f = fs();
        if (!f) return;
        const file = f.getFile(rawPath);
        if (!file) {
            statusTxt.textContent = `Not found: ${rawPath}`;
            statusTxt.style.color = 'var(--fp-err)';
            setTimeout(() => { statusTxt.style.color = ''; }, 2000);
            return;
        }
        openFileInTab(file);
    }

    function openFileInTab(fileRef) {
        // Reuse existing tab if already open
        const existing = tabs.find(t => t.fileRef === fileRef);
        if (existing) { switchTo(existing); return; }
        const t = createTab(fileRef);
        switchTo(t);
    }

    // ── Sidebar tree ───────────────────────────────────────────────────────────
    function renderSidebarTree() {
        sideTree.innerHTML = '';
        const f = fs();
        if (!f) return;
        const root = f.travelTo('');
        if (!root) return;
        renderTreeNode(root, sideTree, '');
    }

    function renderTreeNode(folder, parentEl, pathPrefix) {
        folder.children.forEach(child => {
            const row = document.createElement('div');
            const childPath = pathPrefix ? `${pathPrefix}/${child.name}` : child.name;

            if (child.type === 'folder') {
                row.className = 'fp-tree-item fp-tree-item--folder';
                const chev = document.createElement('span');
                chev.className = 'fp-tree-chevron';
                chev.textContent = '▶';
                const label = document.createElement('span');
                label.textContent = `📁 ${child.name}`;
                row.append(chev, label);

                const childContainer = document.createElement('div');
                childContainer.className = 'fp-tree-children';
                childContainer.style.display = 'none';

                let open = false;
                row.onclick = (e) => {
                    e.stopPropagation();
                    open = !open;
                    chev.classList.toggle('open', open);
                    childContainer.style.display = open ? 'block' : 'none';
                    if (open && childContainer.children.length === 0) {
                        renderTreeNode(child, childContainer, childPath);
                    }
                };
                parentEl.appendChild(row);
                parentEl.appendChild(childContainer);
            } else {
                row.className = 'fp-tree-item';
                const ext = child.extName || '';
                const icon = isImageExt(ext) ? '🖼' : '📄';
                row.textContent = `${icon} ${child.name}.${ext}`;
                row.title = `${child.name}.${ext}`;
                row.onclick = (e) => {
                    e.stopPropagation();
                    container.querySelectorAll('.fp-tree-item.active').forEach(el => el.classList.remove('active'));
                    row.classList.add('active');
                    openFileInTab(child);
                };
                parentEl.appendChild(row);
            }
        });
    }

    // ── Init ───────────────────────────────────────────────────────────────────
    function init() {
        const ctx = window.WebOS?.openContext;
        if (ctx?.fileRef) {
            const t = createTab(ctx.fileRef);
            switchTo(t);
        } else {
            const t = createTab(null);
            switchTo(t);
        }
    }

    if (window.WebOS) {
        init();
    } else {
        const t = setInterval(() => { if (window.WebOS) { clearInterval(t); init(); } }, 100);
    }
})();