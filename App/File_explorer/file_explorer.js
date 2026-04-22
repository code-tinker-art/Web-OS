(() => {
    // ── Scope to this instance's container ────────────────────────────────────
    const currentScript = document.currentScript;
    const container = currentScript.parentElement;  // kernel's window div
    const $ = (sel) => container.querySelector(sel);

    const feRoot = $('.fe-root');   // inner styling root, only used for window controls

    $('.fe-btn-close').onclick = () => container.remove();
    $('.fe-btn-max').onclick = () => feToggleMax();
    $('.fe-btn-min').onclick = () => feRestore();

    const fs = () => window.WebOS?.fs;

    // ── Window controls ────────────────────────────────────────────────────────
    let feIsMaximized = false;
    let fePrevState = {}; 

    function feMaximize() {
        if (feIsMaximized) return;
        fePrevState = {
            width: container.style.width,
            height: container.style.height,
            top: container.style.top,
            left: container.style.left,
            borderRadius: feRoot.style.borderRadius
        };
        const screen = container.parentElement;
        container.style.width = screen.offsetWidth + 'px';
        container.style.height = screen.offsetHeight + 'px';
        container.style.top = '0';
        container.style.left = '0';
        feRoot.style.borderRadius = '0';
        feIsMaximized = true;
    }

    function feRestore() {
        if (!feIsMaximized) return;
        container.style.width = fePrevState.width;
        container.style.height = fePrevState.height;
        container.style.top = fePrevState.top;
        container.style.left = fePrevState.left;
        feRoot.style.borderRadius = fePrevState.borderRadius || '';
        feIsMaximized = false;
    }

    function feToggleMax() {
        feIsMaximized ? feRestore() : feMaximize();
    }

    // ── SVG icons ──────────────────────────────────────────────────────────────
    const FOLDER_ICON = `<svg viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 8.5A2.5 2.5 0 015.5 6h7L14 8.5h10.5A2.5 2.5 0 0127 11v11a2.5 2.5 0 01-2.5 2.5h-19A2.5 2.5 0 013 22V8.5z" fill="currentColor" opacity="0.18"/>
    <path d="M3 8.5A2.5 2.5 0 015.5 6h7L14 8.5h10.5A2.5 2.5 0 0127 11v11a2.5 2.5 0 01-2.5 2.5h-19A2.5 2.5 0 013 22V8.5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
  </svg>`;

    const FILE_ICON = (ext = '') => `<svg viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 3.5h10.5L23 9v17.5H7V3.5z" fill="currentColor" opacity="0.1"/>
    <path d="M7 3.5h10.5L23 9v17.5H7V3.5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M17.5 3.5V9H23" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
    <text x="15" y="22" font-size="6" font-family="monospace" fill="currentColor" text-anchor="middle" opacity="0.75">${ext.toUpperCase().slice(0, 4)}</text>
  </svg>`;

    const FOLDER_SM = `<svg viewBox="0 0 13 13" fill="none"><path d="M1 3A1 1 0 012 2h3.2L6 3h4.5A1 1 0 0111.5 4v6a1 1 0 01-1 1H2a1 1 0 01-1-1V3z" fill="currentColor" opacity="0.2"/><path d="M1 3A1 1 0 012 2h3.2L6 3h4.5A1 1 0 0111.5 4v6a1 1 0 01-1 1H2a1 1 0 01-1-1V3z" stroke="currentColor" stroke-width="1"/></svg>`;
    const FILE_SM = `<svg viewBox="0 0 13 13" fill="none"><path d="M2.5 1.5h5L10 4v7.5H2.5V1.5z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/><path d="M7.5 1.5V4H10" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/></svg>`;

    // ── State ──────────────────────────────────────────────────────────────────
    let currentPath = '';
    let navHistory = [''];
    let historyIndex = 0;
    let viewMode = 'grid';
    let selectedItem = null;
    let ctxTarget = null;

    // ── DOM refs (all scoped to this instance) ─────────────────────────────────
    const filesEl = $('#fe-files');
    const breadcrumbEl = $('#fe-breadcrumb');
    const statusEl = $('#fe-statusbar');
    const modal = $('#fe-modal');
    const modalTitle = $('#fe-modal-title');
    const modalInput = $('#fe-modal-input');
    const modalCancel = $('#fe-modal-cancel');
    const modalConfirm = $('#fe-modal-confirm');
    const ctxMenu = $('#fe-ctx-menu');
    const sidebarTree = $('#fe-sidebar-tree');
    const sidebarHome = $('#fe-sidebar-home');
    const backBtn = $('#fe-back');
    const fwdBtn = $('#fe-forward');
    const gridViewBtn = $('#fe-grid-view');
    const listViewBtn = $('#fe-list-view');
    const newFolderBtn = $('#fe-new-folder');
    const newFileBtn = $('#fe-new-file');

    // ── Navigation ─────────────────────────────────────────────────────────────
    function navigate(path) {
        if (path === currentPath) return;
        navHistory = navHistory.slice(0, historyIndex + 1);
        navHistory.push(path);
        historyIndex = navHistory.length - 1;
        currentPath = path;
        render();
    }

    function goBack() {
        if (historyIndex <= 0) return;
        historyIndex--;
        currentPath = navHistory[historyIndex];
        render();
    }

    function goForward() {
        if (historyIndex >= navHistory.length - 1) return;
        historyIndex++;
        currentPath = navHistory[historyIndex];
        render();
    }

    // ── Get current folder ─────────────────────────────────────────────────────
    function getCurrentFolder() {
        const f = fs();
        if (!f) return null;
        return f.travelTo(currentPath);
    }

    // ── Render ─────────────────────────────────────────────────────────────────
    function render() {
        renderBreadcrumb();
        renderFiles();
        renderSidebar();
        renderNavBtns();
    }

    function renderNavBtns() {
        backBtn.style.opacity = historyIndex <= 0 ? '0.3' : '1';
        fwdBtn.style.opacity = historyIndex >= navHistory.length - 1 ? '0.3' : '1';
        backBtn.style.cursor = historyIndex <= 0 ? 'default' : 'pointer';
        fwdBtn.style.cursor = historyIndex >= navHistory.length - 1 ? 'default' : 'pointer';
    }

    function renderBreadcrumb() {
        breadcrumbEl.innerHTML = '';
        const segs = currentPath === '' ? [] : currentPath.split('/');
        const rootSeg = mkEl('span', 'fe-breadcrumb-seg', 'WebOS PC');  // renamed: no clash
        rootSeg.addEventListener('click', () => navigate(''));
        breadcrumbEl.appendChild(rootSeg);
        segs.forEach((seg, i) => {
            const sep = mkEl('span', 'fe-breadcrumb-sep', '/');
            const span = mkEl('span', 'fe-breadcrumb-seg', seg);
            const path = segs.slice(0, i + 1).join('/');
            span.addEventListener('click', () => navigate(path));
            breadcrumbEl.appendChild(sep);
            breadcrumbEl.appendChild(span);
        });
    }

    function renderFiles() {
        filesEl.innerHTML = '';
        filesEl.className = `fe-files ${viewMode}`;
        selectedItem = null;

        const folder = getCurrentFolder();
        const children = folder ? folder.children : [];

        if (children.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'fe-empty';
            empty.innerHTML = `<div class="fe-empty-icon"><svg width="36" height="36" viewBox="0 0 36 36" fill="none"><rect x="4" y="8" width="28" height="22" rx="3" stroke="#555" stroke-width="1.5"/><path d="M4 13h28" stroke="#555" stroke-width="1.5"/><circle cx="9" cy="10.5" r="1" fill="#555"/><circle cx="13" cy="10.5" r="1" fill="#555"/></svg></div>
            <div class="fe-empty-text">This folder is empty</div>`;
            filesEl.appendChild(empty);
            statusEl.textContent = '0 items';
            return;
        }

        const sorted = [...children].sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'folder' ? -1 : 1;
        });

        sorted.forEach(child => {
            const isFolder = child.type === 'folder';
            const ext = isFolder ? '' : child.extName || '';
            const label = isFolder ? child.name : `${child.name}.${ext}`;
            const item = document.createElement('div');

            if (viewMode === 'grid') {
                item.className = `fe-item ${isFolder ? 'folder' : 'file'}`;
                item.innerHTML = `<div class="fe-item-icon">${isFolder ? FOLDER_ICON : FILE_ICON(ext)}</div>
                    <div class="fe-item-name" title="${label}">${label}</div>`;
            } else {
                item.className = `fe-list-item ${isFolder ? 'folder' : 'file'}`;
                item.innerHTML = `<div class="fe-list-icon">${isFolder ? FOLDER_SM : FILE_SM}</div>
                    <div class="fe-list-name">${label}</div>
                    <div class="fe-list-type">${isFolder ? 'folder' : ext || 'file'}</div>`;
            }

            item.addEventListener('click', (e) => { e.stopPropagation(); selectItem(item, child); });
            item.addEventListener('dblclick', () => openItem(child));
            item.addEventListener('contextmenu', (e) => showCtxMenu(e, child));
            filesEl.appendChild(item);
        });

        const folderCount = children.filter(c => c.type === 'folder').length;
        const fileCount = children.filter(c => c.type === 'file').length;
        statusEl.textContent = `${children.length} item${children.length !== 1 ? 's' : ''} — ${folderCount} folder${folderCount !== 1 ? 's' : ''}, ${fileCount} file${fileCount !== 1 ? 's' : ''}`;
    }

    function renderSidebar() {
        sidebarTree.innerHTML = '';
        const f = fs();
        if (!f) return;
        const fsRoot = f.travelTo('');  // renamed: no clash with container
        if (!fsRoot) return;
        fsRoot.children
            .filter(c => c.type === 'folder')
            .forEach(child => {
                const el = mkEl('div', 'fe-sidebar-tree-item' + (currentPath === child.name ? ' active' : ''), '');
                el.innerHTML = FOLDER_SM + `<span style="margin-left:4px;overflow:hidden;text-overflow:ellipsis">${child.name}</span>`;
                el.style.color = 'var(--fe-folder)';
                el.title = child.name;
                el.addEventListener('click', () => navigate(child.name));
                sidebarTree.appendChild(el);
            });
    }

    function selectItem(el, child) {
        container.querySelectorAll('.fe-item.selected, .fe-list-item.selected').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        selectedItem = child;
    }

    function openItem(child) {
        if (child.type === 'folder') {
            const path = currentPath === '' ? child.name : `${currentPath}/${child.name}`;
            navigate(path);
        }
    }

    // ── Context menu ───────────────────────────────────────────────────────────
    function showCtxMenu(e, child) {
        e.preventDefault();
        e.stopPropagation();
        ctxTarget = child;
        const rect = container.getBoundingClientRect();
        ctxMenu.style.left = `${e.clientX - rect.left}px`;
        ctxMenu.style.top = `${e.clientY - rect.top}px`;
        ctxMenu.classList.remove('hidden');
    }

    container.addEventListener('click', () => {
        ctxMenu.classList.add('hidden');
        container.querySelectorAll('.fe-item.selected, .fe-list-item.selected').forEach(e => e.classList.remove('selected'));
        selectedItem = null;
    });

    $('#fe-ctx-open').addEventListener('click', () => {
        if (ctxTarget) openItem(ctxTarget);
        ctxMenu.classList.add('hidden');
    });

    $('#fe-ctx-rename').addEventListener('click', () => {
        if (!ctxTarget) return;
        ctxMenu.classList.add('hidden');
        showModal('Rename', ctxTarget.name, (newName) => {
            if (!newName || newName === ctxTarget.name) return;
            ctxTarget.name = newName;
            render();
        });
    });

    $('#fe-ctx-delete').addEventListener('click', () => {
        if (!ctxTarget) return;
        ctxMenu.classList.add('hidden');
        const folder = getCurrentFolder();
        if (folder) folder.children = folder.children.filter(c => c !== ctxTarget);
        ctxTarget = null;
        render();
    });

    // ── Modal ──────────────────────────────────────────────────────────────────
    let modalCallback = null;

    function showModal(title, defaultVal, cb) {
        modalTitle.textContent = title;
        modalInput.value = defaultVal || '';
        modalCallback = cb;
        modal.classList.remove('hidden');
        setTimeout(() => { modalInput.focus(); modalInput.select(); }, 30);
    }

    modalCancel.addEventListener('click', () => modal.classList.add('hidden'));
    modalConfirm.addEventListener('click', () => {
        const val = modalInput.value.trim();
        modal.classList.add('hidden');
        if (modalCallback && val) modalCallback(val);
    });
    modalInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') modalConfirm.click();
        if (e.key === 'Escape') modal.classList.add('hidden');
    });

    // ── New folder / file ──────────────────────────────────────────────────────
    newFolderBtn.addEventListener('click', () => {
        showModal('New Folder', 'New Folder', (name) => {
            const f = fs();
            if (f) f.addFolder(name, currentPath);
            render();
        });
    });

    newFileBtn.addEventListener('click', () => {
        showModal('New File (name.ext)', 'untitled.txt', (inp) => {
            const parts = inp.split('.');
            const ext = parts.length > 1 ? parts.pop() : 'txt';
            const name = parts.join('.');
            const f = fs();
            if (f) f.addFile(name, ext, '', currentPath);
            render();
        });
    });

    // ── View toggle ────────────────────────────────────────────────────────────
    gridViewBtn.addEventListener('click', () => {
        viewMode = 'grid';
        gridViewBtn.classList.add('active');
        listViewBtn.classList.remove('active');
        renderFiles();
    });
    listViewBtn.addEventListener('click', () => {
        viewMode = 'list';
        listViewBtn.classList.add('active');
        gridViewBtn.classList.remove('active');
        renderFiles();
    });

    // ── Nav buttons ────────────────────────────────────────────────────────────
    backBtn.addEventListener('click', goBack);
    fwdBtn.addEventListener('click', goForward);
    sidebarHome.addEventListener('click', () => navigate(''));

    // ── Helper ─────────────────────────────────────────────────────────────────
    function mkEl(tag, cls, text) {
        const el = document.createElement(tag);
        el.className = cls;
        el.textContent = text;
        return el;
    }

    // ── Seed sample data if fs is empty ───────────────────────────────────────
    function seedIfEmpty() {
        const f = fs();
        if (!f) return;
        const fsRoot = f.travelTo('');
        if (fsRoot && fsRoot.children.length === 0) {
            f.addFolder('Documents');
            f.addFolder('Images');
            f.addFolder('Projects');
            f.addFile('readme', 'txt', 'Welcome to WebOS!', '');
            f.addFile('notes', 'md', '# Notes', 'Documents');
            f.addFile('photo', 'png', '', 'Images');
            f.addFolder('MyApp', 'Projects');
        }
    }

    // ── Init ───────────────────────────────────────────────────────────────────
    function init() { seedIfEmpty(); render(); }

    if (window.WebOS?.fs) {
        init();
    } else {
        const t = setInterval(() => { if (window.WebOS?.fs) { clearInterval(t); init(); } }, 100);
    }
})();