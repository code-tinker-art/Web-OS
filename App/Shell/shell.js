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
    function printLine(content, type = 'out') {
        let isHTML = false;
        if (/span/.test(content))
            isHTML = true;

        const line = document.createElement('div');
        line.className = 'sh-line';
        const span = document.createElement('span');
        span.className = `sh-line-${type}`;
        if (isHTML)
            span.innerHTML = content;
        else
            span.textContent = content;
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

    cmd('help', () => {
        const cmds = [
            ['help', 'Show this message'],
            ['clear', 'Clear the terminal'],
            ['pwd', 'Print working directory'],
            ['ls [path]', 'List directory contents'],
            ['cd <path>', 'Change directory'],
            ['mkdir <name>', 'Create a new folder'],
            ['touch <name.ext>', 'Create a new file'],
            ['rm <name>', 'Delete a file or folder'],
            ['cat <file>', 'Read file contents'],
            ['write <file> <txt>', 'Write text to a file'],
            ['mv <old> <new>', 'Rename a file or folder'],
            ['open <app>', 'Launch a registered app'],
            ['apps', 'List registered apps'],
            ['whoami', 'Print current user'],
            ['setprompt', 'Change shell prompt'],
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

    cmd('clear', () => { outputEl.innerHTML = ''; });

    cmd('pwd', () => {
        printLine('/WebOS PC' + (cwd ? '/' + cwd : ''));
    });

    cmd('ls', (args) => {
        const targetPath = args.length > 0 ? resolvePath(args.join(' ')) : cwd;
        const f = fs();
        if (!f) return printLine('filesystem not available', 'err');
        const folder = f.travelTo(targetPath);
        if (!folder) return printLine(`ls: cannot access '${args.join(' ')}': No such directory`, 'err');

        if (folder.children.length === 0) return printLine('(empty)', 'out');

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
                span.textContent = child.name + (child.extName ? '.' + child.extName : '');
            }
            grid.appendChild(span);
        });
        outputEl.appendChild(grid);
        scrollBottom();
    });

    cmd('cd', (args) => {
        const targetInput = args.join(' ');
        if (!targetInput || targetInput === '~') { cwd = ''; renderPrompt(promptEl); return; }
        const target = resolvePath(targetInput);
        const f = fs();
        if (!f) return printLine('filesystem not available', 'err');
        const folder = f.travelTo(target);
        if (!folder || folder.type !== 'folder') return printLine(`cd: no such directory: ${targetInput}`, 'err');
        cwd = target;
        renderPrompt(promptEl);
    });

    cmd('mkdir', (args) => {
        const folderName = args.join(' ');
        if (!folderName) return printLine('usage: mkdir <name>', 'err');
        const f = fs();
        if (!f) return printLine('filesystem not available', 'err');
        f.addFolder(folderName, cwd);
        printLine(`created folder '${folderName}'`, 'success');
    });

    cmd('touch', (args) => {
        const fullName = args.join(' ');
        if (!fullName) return printLine('usage: touch <name.ext>', 'err');
        const f = fs();
        if (!f) return printLine('filesystem not available', 'err');
        const parts = fullName.split('.');
        const ext = parts.length > 1 ? parts.pop() : 'txt';
        const name = parts.join('.');
        f.addFile(name, ext, '', cwd);
        printLine(`created file '${name}.${ext}'`, 'success');
    });

    cmd('rm', (args) => {
        const target = args.join(' ');
        if (!target) return printLine('usage: rm <name>', 'err');
        const f = fs();
        const folder = f?.travelTo(cwd);
        if (!folder) return printLine('filesystem error', 'err');

        const idx = folder.children.findIndex(c =>
            c.name === target || (c.name + '.' + c.extName) === target
        );
        if (idx === -1) return printLine(`rm: '${target}': No such file or directory`, 'err');
        folder.children.splice(idx, 1);
        printLine(`removed '${target}'`, 'success');
    });

    cmd('cat', (args) => {
        const target = args.join(' ');
        if (!target) return printLine('usage: cat <file>', 'err');
        const f = fs();
        const folder = f?.travelTo(cwd);
        const file = folder?.children.find(c =>
            c.type === 'file' && (c.name === target || (c.name + '.' + c.extName) === target)
        );
        if (!file) return printLine(`cat: ${target}: No such file`, 'err');

        const box = document.createElement('div');
        box.className = 'sh-cat-box';
        box.textContent = file.content || '(empty file)';
        outputEl.appendChild(box);
        scrollBottom();
    });

    cmd('write', (args) => {
        if (args.length < 2) return printLine('usage: write <file> <text...>', 'err');
        const f = fs();
        const folder = f?.travelTo(cwd);
        const fileName = args[0];
        const content = args.slice(1).join(' ');

        const file = folder?.children.find(c =>
            c.type === 'file' && (c.name === fileName || (c.name + '.' + c.extName) === fileName)
        );
        if (!file) return printLine(`write: ${fileName}: No such file`, 'err');
        file.content = content;
        printLine(`wrote to '${fileName}'`, 'success');
    });

    cmd('mv', (args) => {
        if (args.length < 2) return printLine('usage: mv <old> <new>', 'err');
        const f = fs();
        const folder = f?.travelTo(cwd);
        const item = folder?.children.find(c =>
            c.name === args[0] || (c.name + '.' + c.extName) === args[0]
        );
        if (!item) return printLine(`mv: '${args[0]}': No such file or directory`, 'err');
        item.name = args[1];
        printLine(`renamed '${args[0]}' → '${args[1]}'`, 'success');
    });

    cmd('open', (args) => {
        if (!args[0]) return printLine('usage: open <appname>', 'err');
        const k = kernel();
        const appName = args.join(' ');
        k?.open(appName);
        printLine(`launching '${appName}'...`, 'info');
    });

    cmd('apps', () => {
        const k = kernel();
        const { apps } = k?.getApp() || { apps: [] };
        if (!apps.length) return printLine('no apps registered', 'out');
        apps.forEach(name => printLine(`  <span style="color:var(--sh-cyan)">▸</span> ${name}`));
    });

    cmd('whoami', () => printLine(username));

    // setprompt
    cmd('setprompt', (args) => {
        if (args.length < 2) return printLine('usage: setprompt <username> <hostname>', 'err');
        // If they used quotes, the parser already handled it. 
        // We just take the first two processed arguments.
        username = args[0];
        hostname = args[1];
        renderPrompt(promptEl);
        printLine(`prompt updated to <span style="color:var(--sh-green)">${username}@${hostname}</span>`, 'success');
    });

    cmd('neofetch', () => {
        const k = kernel();
        const { apps } = k?.getApp() || { apps: [] };
        const info = [
            ['OS', 'WebOS 0.0.7'],
            ['Shell', `wsh (WebOS Shell)`],
            ['User', `${username}@${hostname}`],
            ['cwd', '/WebOS PC' + (cwd ? '/' + cwd : '')],
            ['Apps', apps.length + ' registered'],
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
            printRaw(`<div style="display:flex;gap:16px;align-items:baseline"><span style="font-size:10px;line-height:1.2">${logoCol}</span><span style="color:var(--sh-cyan);min-width:52px">${key}</span><span style="color:var(--sh-text)">${val}</span></div>`);
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
            printLine(`wsh: command not found: <span style="color:var(--sh-yellow)">${name}</span>`, 'err');
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
        }
    });

    container.addEventListener('click', () => { if (!booting) inputEl.focus(); });
    runBoot();
})();