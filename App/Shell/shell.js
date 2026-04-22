(() => {
    // ── Scope ──────────────────────────────────────────────────────────────────
    const currentScript = document.currentScript;
    const container = currentScript.parentElement;
    const $ = (sel) => container.querySelector(sel);

    const shRoot = $('.sh-root');
    const outputEl = $('#sh-output');
    const inputEl = $('#sh-input');
    const promptEl = $('#sh-prompt');
    const inputRow = $('#sh-input-row');

    // ── Window controls ────────────────────────────────────────────────────────
    let isMaximized = false;
    let prevState = {};

    $('.sh-btn-close').onclick = () => container.remove();
    $('.sh-btn-max').onclick = () => toggleMax();
    $('.sh-btn-min').onclick = () => restore();

    function maximize() {
        if (isMaximized) return;
        prevState = { width: container.style.width, height: container.style.height, top: container.style.top, left: container.style.left };
        const screen = container.parentElement;
        container.style.width = screen.offsetWidth + 'px';
        container.style.height = screen.offsetHeight + 'px';
        container.style.top = '0';
        container.style.left = '0';
        shRoot.style.borderRadius = '0';
        isMaximized = true;
    }
    function restore() {
        if (!isMaximized) return;
        container.style.width = prevState.width;
        container.style.height = prevState.height;
        container.style.top = prevState.top;
        container.style.left = prevState.left;
        shRoot.style.borderRadius = '';
        isMaximized = false;
    }
    function toggleMax() { isMaximized ? restore() : maximize(); }

    // ── State ──────────────────────────────────────────────────────────────────
    const fs = () => window.WebOS?.fs;
    const kernel = () => window.WebOS?.kernel;
    let cwd = '';          // current directory path ('' = root)
    let username = 'user';
    let hostname = 'webos';
    let cmdHistory = [];
    let histIdx = -1;
    let booting = true;

    // ── Prompt rendering ───────────────────────────────────────────────────────
    function getPathDisplay() {
        return cwd === '' ? '~' : '~/' + cwd;
    }

    function renderPrompt(el) {
        el.innerHTML =
            `<span class="sh-p-user">${username}</span>` +
            `<span class="sh-p-at">@</span>` +
            `<span class="sh-p-host">${hostname}</span>` +
            `<span class="sh-p-colon">:</span>` +
            `<span class="sh-p-path">${getPathDisplay()}</span>` +
            `<span class="sh-p-sym">&nbsp;$</span>`;
    }

    // ── Output helpers ─────────────────────────────────────────────────────────
    function escapeHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function printLine(content, type = 'out') {
        const line = document.createElement('div');
        line.className = 'sh-line';
        const span = document.createElement('span');
        span.className = `sh-line-${type}`;
        span.innerHTML = content;
        line.appendChild(span);
        outputEl.appendChild(line);
        scrollBottom();
    }

    function printPromptLine(cmd) {
        const line = document.createElement('div');
        line.className = 'sh-line';

        const promptSpan = document.createElement('span');
        promptSpan.className = 'sh-line-prompt';
        renderPrompt(promptSpan);

        const cmdSpan = document.createElement('span');
        cmdSpan.className = 'sh-line-cmd';
        cmdSpan.textContent = cmd;

        line.appendChild(promptSpan);
        line.appendChild(cmdSpan);
        outputEl.appendChild(line);
        scrollBottom();
    }

    function printRaw(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        outputEl.appendChild(div);
        scrollBottom();
    }

    function printEmpty() {
        const div = document.createElement('div');
        div.style.height = '0.4em';
        outputEl.appendChild(div);
    }

    function scrollBottom() {
        outputEl.scrollTop = outputEl.scrollHeight;
    }

    // ── Boot sequence ──────────────────────────────────────────────────────────
    const ASCII_LOGO =
        `██╗    ██╗███████╗██████╗  ██████╗ ███████╗
██║    ██║██╔════╝██╔══██╗██╔═══██╗██╔════╝
██║ █╗ ██║█████╗  ██████╔╝██║   ██║███████╗
██║███╗██║██╔══╝  ██╔══██╗██║   ██║╚════██║
╚███╔███╔╝███████╗██████╔╝╚██████╔╝███████║
 ╚══╝╚══╝ ╚══════╝╚═════╝  ╚═════╝ ╚══════╝`;

    const BOOT_LINES = [
        { text: 'Kernel v0.0.7 initializing...', delay: 0 },
        { text: 'Loading filesystem driver............<span class="sh-boot-ok">OK</span>', delay: 120 },
        { text: 'Mounting virtual disk.................<span class="sh-boot-ok">OK</span>', delay: 220 },
        { text: 'Starting app manager..................<span class="sh-boot-ok">OK</span>', delay: 320 },
        { text: 'Spawning shell process................<span class="sh-boot-ok">OK</span>', delay: 420 },
        { text: '<span class="sh-boot-sep">────────────────────────────────────────────</span>', delay: 520 },
        { text: 'Type <span class="sh-p-path">help</span> to see available commands.', delay: 580 },
    ];

    function runBoot() {
        inputRow.style.display = 'none';

        const logoEl = document.createElement('div');
        logoEl.className = 'sh-boot-ascii';
        logoEl.textContent = ASCII_LOGO;
        logoEl.style.opacity = '0';
        logoEl.style.transition = 'opacity 0.4s';
        outputEl.appendChild(logoEl);
        setTimeout(() => { logoEl.style.opacity = '0.85'; }, 50);

        printEmpty();

        BOOT_LINES.forEach(({ text, delay }) => {
            setTimeout(() => {
                const div = document.createElement('div');
                div.className = 'sh-boot-line';
                div.innerHTML = text;
                outputEl.appendChild(div);
                scrollBottom();
            }, delay + 200);
        });

        setTimeout(() => {
            printEmpty();
            inputRow.style.display = 'flex';
            booting = false;
            renderPrompt(promptEl);
            inputEl.focus();
        }, 900);
    }

    // ── Command registry ───────────────────────────────────────────────────────
    const COMMANDS = {};

    function cmd(name, fn) { COMMANDS[name] = fn; }

    // help
    cmd('help', () => {
        const cmds = [
            ['help', 'Show this message'],
            ['clear', 'Clear the terminal'],
            ['pwd', 'Print working directory'],
            ['ls [path]', 'List directory contents'],
            ['cd &lt;path&gt;', 'Change directory (.. to go up)'],
            ['mkdir &lt;name&gt;', 'Create a new folder'],
            ['touch &lt;name.ext&gt;', 'Create a new file'],
            ['rm &lt;name&gt;', 'Delete a file or folder'],
            ['cat &lt;file&gt;', 'Read file contents'],
            ['write &lt;file&gt; &lt;txt&gt;', 'Write text to a file'],
            ['mv &lt;old&gt; &lt;new&gt;', 'Rename a file or folder'],
            ['open &lt;app&gt;', 'Launch a registered app'],
            ['apps', 'List registered apps'],
            ['setprompt &lt;u&gt; &lt;h&gt;', 'Change username and hostname'],
            ['whoami', 'Print current user'],
            ['echo &lt;text&gt;', 'Print text'],
            ['history', 'Show command history'],
            ['neofetch', 'System info'],
        ];
        printRaw(`<div style="padding-left:2px">`);
        cmds.forEach(([name, desc]) => {
            printRaw(
                `<div class="sh-line"><span style="color:var(--sh-cyan);min-width:200px;display:inline-block">${name}</span>` +
                `<span style="color:var(--sh-muted)">${desc}</span></div>`
            );
        });
        printRaw(`</div>`);
    });

    // clear
    cmd('clear', () => { outputEl.innerHTML = ''; });

    // pwd
    cmd('pwd', () => {
        printLine(escapeHtml('/WebOS PC' + (cwd ? '/' + cwd : '')));
    });

    // ls
    cmd('ls', (args) => {
        const targetPath = args[0] !== undefined ? resolvePath(args[0]) : cwd;
        const f = fs();
        if (!f) return printLine('filesystem not available', 'err');
        const folder = f.travelTo(targetPath);
        if (!folder) return printLine(`ls: cannot access '${escapeHtml(args[0])}': No such directory`, 'err');

        if (folder.children.length === 0) {
            return printLine('(empty)', 'out');
        }

        const sorted = [...folder.children].sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'folder' ? -1 : 1;
        });

        const grid = document.createElement('div');
        grid.className = 'sh-ls-grid';
        sorted.forEach(child => {
            const span = document.createElement('span');
            if (child.type === 'folder') {
                span.className = 'sh-ls-folder';
                span.textContent = child.name + '/';
            } else {
                span.className = 'sh-ls-file';
                span.textContent = child.name + '.' + (child.extName || '');
            }
            grid.appendChild(span);
        }); outputEl.appendChild(grid);
        scrollBottom();
    });

    // cd
    cmd('cd', (args) => {
        if (!args[0] || args[0] === '~') { cwd = ''; renderPrompt(promptEl); return; }
        const target = resolvePath(args[0]);
        const f = fs();
        if (!f) return printLine('filesystem not available', 'err');
        const folder = f.travelTo(target);
        if (!folder) return printLine(`cd: no such directory: ${escapeHtml(args[0])}`, 'err');
        cwd = target;
        renderPrompt(promptEl);
    });

    // mkdir
    cmd('mkdir', (args) => {
        if (!args[0]) return printLine('usage: mkdir &lt;name&gt;', 'err');
        const f = fs();
        if (!f) return printLine('filesystem not available', 'err');
        f.addFolder(args[0], cwd);
        printLine(`created folder '${escapeHtml(args[0])}'`, 'success');
    });

    // touch
    cmd('touch', (args) => {
        if (!args[0]) return printLine('usage: touch &lt;name.ext&gt;', 'err');
        const f = fs();
        if (!f) return printLine('filesystem not available', 'err');
        const parts = args[0].split('.');
        const ext = parts.length > 1 ? parts.pop() : 'txt';
        const name = parts.join('.');
        f.addFile(name, ext, '', cwd);
        printLine(`created file '${escapeHtml(name)}.${escapeHtml(ext)}'`, 'success');
    });

    // rm
    cmd('rm', (args) => {
        if (!args[0]) return printLine('usage: rm &lt;name&gt;', 'err');
        const f = fs();
        if (!f) return printLine('filesystem not available', 'err');
        const folder = f.travelTo(cwd);
        if (!folder) return printLine('current directory not found', 'err');
        const idx = folder.children.findIndex(c =>
            c.name === args[0] || c.name + '.' + c.extName === args[0]
        );
        if (idx === -1) return printLine(`rm: '${escapeHtml(args[0])}': No such file or directory`, 'err');
        folder.children.splice(idx, 1);
        printLine(`removed '${escapeHtml(args[0])}'`, 'success');
    });

    // cat
    cmd('cat', (args) => {
        if (!args[0]) return printLine('usage: cat &lt;file&gt;', 'err');
        const f = fs();
        if (!f) return printLine('filesystem not available', 'err');
        const folder = f.travelTo(cwd);
        if (!folder) return printLine('current directory not found', 'err');

        const nameParts = args[0].split('.');
        const ext = nameParts.length > 1 ? nameParts.pop() : null;
        const name = nameParts.join('.');
        const file = folder.children.find(c =>
            c.type === 'file' && c.name === name && (ext === null || c.extName === ext)
        );
        if (!file) return printLine(`cat: ${escapeHtml(args[0])}: No such file`, 'err');

        const box = document.createElement('div');
        box.className = 'sh-cat-box';
        box.textContent = file.content || '(empty file)';
        outputEl.appendChild(box);
        scrollBottom();
    });

    // write
    cmd('write', (args) => {
        if (args.length < 2) return printLine('usage: write &lt;file&gt; &lt;text...&gt;', 'err');
        const f = fs();
        if (!f) return printLine('filesystem not available', 'err');
        const folder = f.travelTo(cwd);
        if (!folder) return printLine('current directory not found', 'err');

        const nameParts = args[0].split('.');
        const ext = nameParts.length > 1 ? nameParts.pop() : null;
        const name = nameParts.join('.');
        const file = folder.children.find(c =>
            c.type === 'file' && c.name === name && (ext === null || c.extName === ext)
        );
        if (!file) return printLine(`write: ${escapeHtml(args[0])}: No such file`, 'err');
        file.content = args.slice(1).join(' ');
        printLine(`wrote to '${escapeHtml(args[0])}'`, 'success');
    });

    // mv (rename)
    cmd('mv', (args) => {
        if (args.length < 2) return printLine('usage: mv &lt;old&gt; &lt;new&gt;', 'err');
        const f = fs();
        if (!f) return printLine('filesystem not available', 'err');
        const folder = f.travelTo(cwd);
        if (!folder) return printLine('current directory not found', 'err');
        const item = folder.children.find(c =>
            c.name === args[0] || c.name + '.' + c.extName === args[0]
        );
        if (!item) return printLine(`mv: '${escapeHtml(args[0])}': No such file or directory`, 'err');
        item.name = args[1];
        printLine(`renamed '${escapeHtml(args[0])}' → '${escapeHtml(args[1])}'`, 'success');
    });

    // open
    cmd('open', (args) => {
        if (!args[0]) return printLine('usage: open &lt;appname&gt;', 'err');
        const k = kernel();
        if (!k) return printLine('kernel not available', 'err');
        const appName = args.join(' ');
        k.open(appName);
        printLine(`launching '${escapeHtml(appName)}'...`, 'info');
    });

    // apps
    cmd('apps', () => {
        const k = kernel();
        if (!k) return printLine('kernel not available', 'err');
        const { apps } = k.getApp();
        if (!apps.length) return printLine('no apps registered', 'out');
        apps.forEach(name => printLine(`  <span style="color:var(--sh-cyan)">▸</span> ${escapeHtml(name)}`));
    });

    // setprompt
    cmd('setprompt', (args) => {
        if (args.length < 2) return printLine('usage: setprompt &lt;username&gt; &lt;hostname&gt;', 'err');
        username = args[0];
        hostname = args[1];
        renderPrompt(promptEl);
        printLine(`prompt updated to <span style="color:var(--sh-green)">${escapeHtml(username)}@${escapeHtml(hostname)}</span>`, 'success');
    });

    // whoami
    cmd('whoami', () => printLine(escapeHtml(username)));

    // echo
    cmd('echo', (args) => printLine(escapeHtml(args.join(' '))));

    // history
    cmd('history', () => {
        if (!cmdHistory.length) return printLine('no history', 'out');
        cmdHistory.forEach((c, i) => {
            printLine(`<span style="color:var(--sh-muted);min-width:28px;display:inline-block">${i + 1}</span> ${escapeHtml(c)}`);
        });
    });

    // neofetch
    cmd('neofetch', () => {
        const f = fs();
        const k = kernel();
        const { apps } = k ? k.getApp() : { apps: [] };
        const fsRoot = f ? f.travelTo('') : null;
        const countItems = (folder) => {
            if (!folder) return 0;
            return folder.children.reduce((n, c) => n + 1 + (c.type === 'folder' ? countItems(c) : 0), 0);
        };
        const totalItems = countItems(fsRoot);

        const info = [
            ['OS', 'WebOS 0.0.7'],
            ['Shell', 'wsh (WebOS Shell)'],
            ['User', escapeHtml(`${username}@${hostname}`)],
            ['cwd', escapeHtml('/WebOS PC' + (cwd ? '/' + cwd : ''))],
            ['Apps', apps.length + ' registered'],
            ['FS', totalItems + ' items'],
        ];

        const logo = [
            `<span style="color:var(--sh-green)"> ██╗    ██╗</span>`,
            `<span style="color:var(--sh-green)"> ██║ █╗ ██║</span>`,
            `<span style="color:var(--sh-green)"> ╚███╔███╔╝</span>`,
            `<span style="color:var(--sh-green)">  ╚══╝╚══╝ </span>`,
        ];

        printEmpty();
        info.forEach(([key, val], i) => {
            const logoCol = logo[i] || '             ';
            printRaw(
                `<div style="display:flex;gap:16px;align-items:baseline">` +
                `<span style="font-size:10px;line-height:1.2">${logoCol}</span>` +
                `<span style="color:var(--sh-cyan);min-width:52px">${key}</span>` +
                `<span style="color:var(--sh-muted)">  </span>` +
                `<span style="color:var(--sh-text)">${val}</span>` +
                `</div>`
            );
        });
        printEmpty();
    });

    // ── Path resolver ──────────────────────────────────────────────────────────
    function resolvePath(input) {
        if (!input || input === '~') return '';
        if (input === '..') {
            if (cwd === '') return '';
            const parts = cwd.split('/');
            parts.pop();
            return parts.join('/');
        }
        if (input.startsWith('~/')) return input.slice(2);
        if (input.startsWith('/')) return input.slice(1);
        return cwd === '' ? input : cwd + '/' + input;
    }

    // ── Command execution ──────────────────────────────────────────────────────
    function execute(raw) {
        const trimmed = raw.trim();
        if (!trimmed) return;

        cmdHistory.push(trimmed);
        histIdx = -1;

        printPromptLine(trimmed);

        const parts = trimmed.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
        const name = parts[0].toLowerCase();
        const args = parts.slice(1).map(a => a.replace(/^"|"$/g, ''));

        if (COMMANDS[name]) {
            COMMANDS[name](args);
        } else {
            printLine(`wsh: command not found: <span style="color:var(--sh-yellow)">${escapeHtml(name)}</span> — type <span style="color:var(--sh-cyan)">help</span> for commands`, 'err');
        }
    }

    // ── Input handling ─────────────────────────────────────────────────────────
    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const val = inputEl.value;
            inputEl.value = '';
            execute(val);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (cmdHistory.length === 0) return;
            if (histIdx === -1) histIdx = cmdHistory.length - 1;
            else if (histIdx > 0) histIdx--;
            inputEl.value = cmdHistory[histIdx];
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (histIdx === -1) return;
            histIdx++;
            if (histIdx >= cmdHistory.length) { histIdx = -1; inputEl.value = ''; }
            else inputEl.value = cmdHistory[histIdx];
        } else if (e.key === 'l' && e.ctrlKey) {
            e.preventDefault();
            outputEl.innerHTML = '';
        } else if (e.key === 'c' && e.ctrlKey) {
            e.preventDefault();
            printPromptLine(inputEl.value + '^C');
            inputEl.value = '';
        }
    });

    // Click anywhere to focus input
    container.addEventListener('click', () => { if (!booting) inputEl.focus(); });

    // ── Init ───────────────────────────────────────────────────────────────────
    runBoot();
})();