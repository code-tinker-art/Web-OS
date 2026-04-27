(() => {
    const currentScript = document.currentScript;
    const container = currentScript.parentElement;
    const $ = (sel) => container.querySelector(sel);

    const fpRoot = $('.fp-root');
    const tabBar = $('#fp-tab-bar');
    const body = $('#fp-body');
    const statusTxt = $('#fp-status-text');
    const statusTyp = $('#fp-status-type');
    const statusBar = container.querySelector('.fp-statusbar');
    const sidebar = $('#fp-sidebar');
    const sideBody = $('#fp-sidebar-body');
    const sideFolderNm = $('#fp-sidebar-folder-name');
    const saveModal = $('#fp-save-modal');
    const warnModal = $('#fp-warn-modal');
    const saveDir = $('#fp-save-dir');
    const saveName = $('#fp-save-name');
    const saveErr = $('#fp-save-err');
    const warnSub = $('#fp-warn-sub');

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
    let tabs = [];
    let activeTab = null;
    let tabIdSeq = 0;

    function createTab(fileRef = null) {
        const tab = { id: tabIdSeq++, fileRef, untitledText: '', isDirty: false, scrollTop: 0 };
        tabs.push(tab);
        return tab;
    }

    function switchTo(tab) {
        if (activeTab) {
            const ta = body.querySelector('.fp-textarea');
            if (ta) activeTab.scrollTop = ta.scrollTop;
        }
        activeTab = tab;
        renderTabs();
        renderBody();
        refreshSidebarActive();
    }

    function closeTab(tab) {
        const idx = tabs.indexOf(tab);
        if (idx === -1) return;
        tabs.splice(idx, 1);
        if (tabs.length === 0) {
            const t = createTab(null);
            switchTo(t);
        } else {
            switchTo(tabs[Math.min(idx, tabs.length - 1)]);
        }
    }

    // ── Tab bar ────────────────────────────────────────────────────────────────
    function renderTabs() {
        tabBar.innerHTML = '';
        tabs.forEach(tab => {
            const el = document.createElement('div');
            el.className = 'fp-tab' + (tab === activeTab ? ' active' : '');

            const dirty = document.createElement('span');
            dirty.className = 'fp-tab-dirty' + (tab.isDirty ? ' visible' : '');

            const name = document.createElement('span');
            name.className = 'fp-tab-name';
            name.textContent = tabLabel(tab);

            const cls = document.createElement('span');
            cls.className = 'fp-tab-close';
            cls.textContent = '×';
            cls.title = 'Close tab';
            cls.addEventListener('click', (e) => {
                e.stopPropagation();
                if (tab.isDirty) showWarnModal(tab, () => closeTab(tab));
                else closeTab(tab);
            });

            el.append(dirty, name, cls);
            el.addEventListener('click', () => switchTo(tab));
            tabBar.appendChild(el);
        });

        const add = document.createElement('div');
        add.className = 'fp-tab-add';
        add.textContent = '+';
        add.title = 'New tab (Ctrl+N)';
        add.addEventListener('click', () => { const t = createTab(null); switchTo(t); });
        tabBar.appendChild(add);
    }

    function tabLabel(tab) {
        if (!tab.fileRef) return 'Untitled';
        return `${tab.fileRef.name}.${tab.fileRef.extName}`;
    }

    // ── Body ───────────────────────────────────────────────────────────────────
    function renderBody() {
        body.innerHTML = '';
        if (!activeTab) return;
        const tab = activeTab;
        const ext = tab.fileRef ? (tab.fileRef.extName || '').toLowerCase() : '';
        statusTyp.textContent = (ext || 'plain').toUpperCase();

        if (!tab.fileRef) {
            renderTextEditor(tab);
        } else if (isImageExt(ext)) {
            renderImage(tab);
        } else {
            renderTextEditor(tab);
        }
    }

    // ── Text editor with line numbers ──────────────────────────────────────────
    function renderTextEditor(tab) {
        const wrap = document.createElement('div');
        wrap.className = 'fp-editor-wrap';

        const lineNums = document.createElement('div');
        lineNums.className = 'fp-line-numbers';

        const ta = document.createElement('textarea');
        ta.className = 'fp-textarea';
        ta.value = tab.fileRef ? (tab.fileRef.content || '') : tab.untitledText;
        ta.spellcheck = false;

        function updateLineNumbers() {
            const count = ta.value.split('\n').length;
            lineNums.innerHTML = Array.from({ length: count }, (_, i) => i + 1).join('<br>');
        }
        updateLineNumbers();
        updateStatus(ta.value);

        ta.addEventListener('input', () => {
            if (tab.fileRef) tab.fileRef.content = ta.value;
            else tab.untitledText = ta.value;
            updateLineNumbers();
            updateStatus(ta.value);
            markDirty(tab);
        });

        ta.addEventListener('scroll', () => { lineNums.scrollTop = ta.scrollTop; });

        ta.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const s = ta.selectionStart, end = ta.selectionEnd;
                ta.value = ta.value.substring(0, s) + '    ' + ta.value.substring(end);
                ta.selectionStart = ta.selectionEnd = s + 4;
                ta.dispatchEvent(new Event('input'));
            }
        });

        wrap.append(lineNums, ta);
        body.appendChild(wrap);

        requestAnimationFrame(() => {
            ta.scrollTop = tab.scrollTop;
            ta.focus();
        });
    }

    function updateStatus(text) {
        const lines = text ? text.split('\n').length : 1;
        const chars = text ? text.length : 0;
        statusTxt.textContent = `Ln ${lines}, Col 1  ·  ${chars} chars`;
    }

    function flashSaved() {
        statusBar.classList.remove('saved');
        void statusBar.offsetWidth;
        statusBar.classList.add('saved');
        setTimeout(() => statusBar.classList.remove('saved'), 1200);
    }

    // ── Dirty ──────────────────────────────────────────────────────────────────
    function markDirty(tab) { tab.isDirty = true; renderTabs(); }
    function markClean(tab) { tab.isDirty = false; renderTabs(); }

    // ── Image ──────────────────────────────────────────────────────────────────
    function renderImage(tab) {
        if (tab.fileRef.content) renderImageContent(tab.fileRef.content, tab.fileRef.extName);
        else renderImageImport(tab.fileRef);
    }

    function renderImageContent(base64, ext) {
        body.innerHTML = '';
        const viewer = document.createElement('div');
        viewer.className = 'fp-image-viewer';
        const img = document.createElement('img');
        const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
        img.src = base64.startsWith('data:') ? base64 : `data:${mime};base64,${base64}`;
        img.onload = () => { statusTxt.textContent = `${img.naturalWidth} × ${img.naturalHeight}px`; };
        img.onerror = () => { statusTxt.textContent = 'Failed to render'; };
        viewer.appendChild(img);
        body.appendChild(viewer);
    }

    function renderImageImport(fileObj) {
        body.innerHTML = '';
        const outer = document.createElement('div');
        outer.className = 'fp-img-import';
        const inner = document.createElement('div');
        inner.className = 'fp-img-import-inner';

        const icon = document.createElement('div');
        icon.className = 'fp-img-import-icon'; icon.textContent = '⚠';
        const title = document.createElement('div');
        title.className = 'fp-img-import-title'; title.textContent = 'NO IMAGE DATA';

        const dropZone = document.createElement('div');
        dropZone.className = 'fp-drop-zone';
        dropZone.innerHTML = `<span style="font-size:20px;opacity:0.3">⊕</span><span class="fp-drop-label">Drop image here · Ctrl+V to paste</span>`;

        const divider = document.createElement('div');
        divider.className = 'fp-import-divider'; divider.textContent = 'or import from FS path';

        const row = document.createElement('div');
        row.className = 'fp-img-import-row';
        const fsInput = document.createElement('input');
        fsInput.className = 'fp-img-url-input'; fsInput.placeholder = 'e.g. Images/photo.png';
        fsInput.autocomplete = 'off'; fsInput.spellcheck = false;
        const importBtn = document.createElement('button');
        importBtn.className = 'fp-img-import-btn'; importBtn.textContent = 'Import';
        row.append(fsInput, importBtn);

        const errMsg = document.createElement('div');
        errMsg.className = 'fp-img-err-msg';

        inner.append(icon, title, dropZone, divider, row, errMsg);
        outer.appendChild(inner);
        body.appendChild(outer);
        statusTxt.textContent = 'No image data';

        function saveAndRender(base64) {
            fileObj.content = base64;
            fs()?.saveToDisk();
            if (activeTab) markClean(activeTab);
            renderImageContent(base64, fileObj.extName);
        }
        function showErr(msg) { errMsg.textContent = msg; }

        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('fp-drop-zone--over'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('fp-drop-zone--over'));
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault(); dropZone.classList.remove('fp-drop-zone--over');
            const file = e.dataTransfer?.files[0];
            if (!file) return showErr('No file dropped');
            if (!file.type.startsWith('image/')) return showErr('Not an image file');
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
            const src = fs()?.getFile(val);
            if (!src) return showErr(`Not found: ${val}`);
            if (!src.content) return showErr('Source file has no content');
            container.removeEventListener('paste', onPaste);
            saveAndRender(src.content);
        }
        importBtn.onclick = doFsImport;
        fsInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doFsImport(); });
    }

    function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result);
            r.onerror = () => reject(new Error('FileReader error'));
            r.readAsDataURL(blob);
        });
    }

    // ── Save ───────────────────────────────────────────────────────────────────
    function save(tab, afterSave) {
        if (!tab) return;
        if (!tab.fileRef) { showSaveModal(tab, afterSave); return; }
        fs()?.saveToDisk();
        markClean(tab);
        flashSaved();
        if (afterSave) afterSave();
    }

    // ── Save-as modal ──────────────────────────────────────────────────────────
    let saveModalCb = null;
    let saveModalTab = null;

    function showSaveModal(tab, cb) {
        saveErr.textContent = '';
        saveDir.value = ''; saveName.value = '';
        saveModalTab = tab; saveModalCb = cb || null;
        saveModal.classList.remove('hidden');
        setTimeout(() => saveName.focus(), 30);
    }

    function doSaveAs() {
        const dir = saveDir.value.trim();
        const raw = saveName.value.trim();
        if (!raw) { saveErr.textContent = 'Filename is required'; return; }
        const parts = raw.split('.');
        const ext = parts.length > 1 ? parts.pop() : 'txt';
        const base = parts.join('.');
        const f = fs();
        if (!f) { saveErr.textContent = 'Filesystem unavailable'; return; }
        const folder = f.travelTo(dir);
        if (!folder) { saveErr.textContent = `Directory not found: ${dir || 'root'}`; return; }
        if (folder.has(base)) { saveErr.textContent = 'File already exists'; return; }
        f.addFile(base, ext, saveModalTab.untitledText, dir);
        const path = dir ? `${dir}/${base}.${ext}` : `${base}.${ext}`;
        saveModalTab.fileRef = f.getFile(path);
        saveModal.classList.add('hidden');
        markClean(saveModalTab);
        statusTyp.textContent = ext.toUpperCase();
        flashSaved();
        renderTabs();
        renderSidebarTree();
        if (saveModalCb) { saveModalCb(); saveModalCb = null; }
        saveModalTab = null;
    }

    $('#fp-save-confirm').onclick = doSaveAs;
    $('#fp-save-cancel').onclick = () => { saveModal.classList.add('hidden'); saveModalCb = null; saveModalTab = null; };
    saveDir.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveName.focus(); });
    saveName.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSaveAs(); if (e.key === 'Escape') saveModal.classList.add('hidden'); });

    // ── Warn modal ─────────────────────────────────────────────────────────────
    let warnCb = null;
    let warnTab = null;

    function showWarnModal(tab, afterAction) {
        warnTab = tab; warnCb = afterAction;
        warnSub.textContent = `"${tabLabel(tab)}" has unsaved changes. Save before closing?`;
        warnModal.classList.remove('hidden');
    }

    $('#fp-warn-cancel').onclick = () => { warnModal.classList.add('hidden'); warnCb = null; warnTab = null; };
    $('#fp-warn-discard').onclick = () => {
        warnModal.classList.add('hidden');
        const cb = warnCb; warnCb = null; warnTab = null;
        if (cb) cb();
    };
    $('#fp-warn-save').onclick = () => {
        warnModal.classList.add('hidden');
        const tab = warnTab; const cb = warnCb;
        warnCb = null; warnTab = null;
        save(tab, cb);
    };

    function attemptCloseAll() {
        const dirty = tabs.filter(t => t.isDirty);
        if (!dirty.length) { container.remove(); return; }
        showWarnModal(dirty[0], () => { dirty[0].isDirty = false; attemptCloseAll(); });
    }

    // ── Activity bar ───────────────────────────────────────────────────────────
    $('#fp-act-explorer').onclick = () => {
        sidebar.classList.toggle('collapsed');
        $('#fp-act-explorer').classList.toggle('active', !sidebar.classList.contains('collapsed'));
    };
    $('#fp-act-new').onclick = () => { const t = createTab(null); switchTo(t); };
    $('#fp-act-save').onclick = () => save(activeTab);

    // ── Sidebar folder state ───────────────────────────────────────────────────
    // openedFolder: Folder object currently shown in explorer (null = nothing opened)
    // openedFolderPath: its FS path string (e.g. 'Documents' or '')
    let openedFolder = null;
    let openedFolderPath = null;

    function openFolder(folderObj, folderPath) {
        openedFolder = folderObj;
        openedFolderPath = folderPath;
        sideFolderNm.textContent = folderObj.name.toUpperCase();
        renderSidebarTree();
    }

    function closeFolder() {
        openedFolder = null;
        openedFolderPath = null;
        sideFolderNm.textContent = 'NO FOLDER OPENED';
        renderSidebarNoFolder();
    }

    // ── Sidebar rendering ──────────────────────────────────────────────────────
    function renderSidebarNoFolder() {
        sideBody.innerHTML = '';

        const prompt = document.createElement('div');
        prompt.className = 'fp-sidebar-prompt';

        const msg = document.createElement('div');
        msg.className = 'fp-sidebar-prompt-msg';
        msg.textContent = 'No folder opened';

        const sub = document.createElement('div');
        sub.className = 'fp-sidebar-prompt-sub';
        sub.textContent = 'Open a folder to browse files';

        const row = document.createElement('div');
        row.className = 'fp-sidebar-open';

        const input = document.createElement('input');
        input.className = 'fp-sidebar-input';
        input.placeholder = 'Folder path (blank = root)';
        input.autocomplete = 'off';
        input.spellcheck = false;

        const btn = document.createElement('button');
        btn.className = 'fp-sidebar-open-btn';
        btn.textContent = 'Open';

        function doOpenFolder() {
            const val = input.value.trim();
            const f = fs();
            if (!f) return;
            const folder = f.travelTo(val);
            if (!folder) {
                sub.textContent = `Not found: "${val || 'root'}"`;
                sub.style.color = 'var(--fp-err)';
                return;
            }
            openFolder(folder, val);
        }

        btn.onclick = doOpenFolder;
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doOpenFolder(); });

        row.append(input, btn);
        prompt.append(msg, sub, row);
        sideBody.appendChild(prompt);
        setTimeout(() => input.focus(), 60);
    }

    function renderSidebarTree() {
        sideBody.innerHTML = '';
        if (!openedFolder) { renderSidebarNoFolder(); return; }

        const treeEl = document.createElement('div');
        treeEl.className = 'fp-sidebar-tree';
        sideBody.appendChild(treeEl);

        renderTreeChildren(openedFolder, treeEl, openedFolderPath, 0);
    }

    function renderTreeChildren(folder, parentEl, pathPrefix, depth) {
        const sorted = [...folder.children].sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'folder' ? -1 : 1;
        });
        sorted.forEach(child => renderTreeItem(child, parentEl, pathPrefix, depth));
    }

    function renderTreeItem(child, parentEl, pathPrefix, depth) {
        const childPath = pathPrefix ? `${pathPrefix}/${child.name}` : child.name;
        const row = document.createElement('div');
        row.className = 'fp-tree-row' + (child.type === 'folder' ? ' fp-tree-row--folder' : '');
        row.dataset.path = childPath;

        const indent = document.createElement('div');
        indent.className = 'fp-tree-indent';
        indent.style.paddingLeft = `${depth * 12 + 6}px`;

        if (child.type === 'folder') {
            const chev = document.createElement('span');
            chev.className = 'fp-tree-chevron';
            chev.textContent = '▶';

            const icon = document.createElement('span');
            icon.className = 'fp-tree-icon';
            icon.textContent = '📁';

            const label = document.createElement('span');
            label.className = 'fp-tree-label';
            label.textContent = child.name;

            indent.append(chev, icon, label);
            row.appendChild(indent);
            parentEl.appendChild(row);

            const childContainer = document.createElement('div');
            parentEl.appendChild(childContainer);
            let open = false;

            row.addEventListener('click', (e) => {
                e.stopPropagation();
                open = !open;
                chev.classList.toggle('open', open);
                childContainer.innerHTML = '';
                if (open) renderTreeChildren(child, childContainer, childPath, depth + 1);
            });
        } else {
            const ext = child.extName || '';
            const icon = document.createElement('span');
            icon.className = 'fp-tree-icon';
            icon.textContent = isImageExt(ext) ? '🖼' : '📄';

            const label = document.createElement('span');
            label.className = 'fp-tree-label';
            label.textContent = `${child.name}.${ext}`;

            indent.append(icon, label);
            row.appendChild(indent);

            row.addEventListener('click', (e) => {
                e.stopPropagation();
                sideBody.querySelectorAll('.fp-tree-row.active').forEach(r => r.classList.remove('active'));
                row.classList.add('active');
                openFileInTab(child);
            });

            parentEl.appendChild(row);
        }
    }

    function refreshSidebarActive() {
        if (!openedFolder || !activeTab?.fileRef) return;
        sideBody.querySelectorAll('.fp-tree-row.active').forEach(r => r.classList.remove('active'));
        sideBody.querySelectorAll('.fp-tree-row').forEach(r => {
            const label = r.querySelector('.fp-tree-label');
            const f = activeTab.fileRef;
            if (label?.textContent === `${f.name}.${f.extName}`) r.classList.add('active');
        });
    }

    // Sidebar buttons
    $('#fp-sidebar-refresh').addEventListener('click', renderSidebarTree);
    $('#fp-sidebar-close-folder').addEventListener('click', closeFolder);

    // ── Open file in tab ───────────────────────────────────────────────────────
    function openFileInTab(fileRef) {
        const existing = tabs.find(t => t.fileRef === fileRef);
        if (existing) { switchTo(existing); return; }
        const t = createTab(fileRef);
        switchTo(t);
    }

    // ── Keyboard shortcuts ─────────────────────────────────────────────────────
    container.addEventListener('keydown', (e) => {
        const mod = e.ctrlKey || e.metaKey;
        if (mod && e.key === 's') { e.preventDefault(); save(activeTab); }
        if (mod && e.key === 'n') { e.preventDefault(); const t = createTab(null); switchTo(t); }
        if (mod && e.key === 'w') {
            e.preventDefault();
            if (!activeTab) return;
            if (activeTab.isDirty) showWarnModal(activeTab, () => closeTab(activeTab));
            else closeTab(activeTab);
        }
        if (mod && e.key === 'Tab') {
            e.preventDefault();
            const idx = tabs.indexOf(activeTab);
            switchTo(tabs[(idx + 1) % tabs.length]);
        }
    });

    // ── Init ───────────────────────────────────────────────────────────────────
    function init() {
        renderSidebarNoFolder();
        const ctx = window.WebOS?.openContext;
        if (ctx?.fileRef) {
            const t = createTab(ctx.fileRef);
            switchTo(t);
        } else {
            const t = createTab(null);
            switchTo(t);
        }
    }

    if (window.WebOS) init();
    else {
        const poll = setInterval(() => { if (window.WebOS) { clearInterval(poll); init(); } }, 100);
    }
})();