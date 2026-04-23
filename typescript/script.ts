import { Kernel, App } from "./kernel.js";
import { apps } from "./apps.js";
import { FileSystem_WebOS } from "./file_system.js"

const kernel = new Kernel(".screen");
const fs: FileSystem_WebOS = new FileSystem_WebOS();
(window as any).WebOS = { kernel, fs };

const input = document.querySelector(".webos_taskbar_input") as HTMLInputElement;
const suggestion = document.querySelector(".suggestion") as HTMLDivElement;
const startBtn = document.getElementById("taskbar-start") as HTMLDivElement;
const startMenu = document.getElementById("start-menu") as HTMLDivElement;
const startApps = document.getElementById("start-menu-apps") as HTMLDivElement;
const clock = document.getElementById("tray-clock") as HTMLSpanElement;
const dateEl = document.getElementById("tray-date") as HTMLSpanElement;

const appList: string[] = [];

for (const key in apps) {
    kernel.registerApp(apps[key] as App);
    appList.push(key);
}

// ── Search ─────────────────────────────────────────────────────────────────
function getMatch(val: string): string {
    if (!val) return "";
    return appList.find(w => w.toLowerCase().startsWith(val.toLowerCase())) || "";
}

input.addEventListener("keydown", (e) => {
    const match = getMatch(input.value);

    if (e.key === "Enter") {
        const target = match || input.value;
        if (appList.includes(target)) {
            kernel.open(target);
            input.value = "";
            suggestion.textContent = "";
        }
    } else if (e.key === "Tab") {
        e.preventDefault();
        if (match) {
            input.value = match;
            suggestion.textContent = match;
        }
    } else if (e.key === "Escape") {
        input.value = "";
        suggestion.textContent = "";
        input.blur();
    }
});

input.addEventListener("input", () => {
    suggestion.textContent = getMatch(input.value);
});

// ── Start menu ─────────────────────────────────────────────────────────────
const APP_ICONS: Record<string, string> = {
    "shell": "⌨",
    "file explorer": "📁",
    "tester app": "🧪",
};

function buildStartMenu() {
    startApps.innerHTML = "";
    appList.forEach(name => {
        const item = document.createElement("div");
        item.className = "start-app-item";
        const icon = document.createElement("div");
        icon.className = "start-app-icon";
        icon.textContent = APP_ICONS[name] || "▪";
        const label = document.createElement("span");
        label.textContent = name;
        item.appendChild(icon);
        item.appendChild(label);
        item.addEventListener("click", () => {
            kernel.open(name);
            closeStartMenu();
        });
        startApps.appendChild(item);
    });
}

function openStartMenu() {
    buildStartMenu();
    startMenu.classList.remove("hidden");
}

function closeStartMenu() {
    startMenu.classList.add("hidden");
}

startBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    startMenu.classList.contains("hidden") ? openStartMenu() : closeStartMenu();
});

document.addEventListener("click", (e) => {
    if (!startMenu.contains(e.target as Node) && e.target !== startBtn) {
        closeStartMenu();
    }
});

// ── Clock ──────────────────────────────────────────────────────────────────
function updateClock() {
    const now = new Date();
    clock.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    dateEl.textContent = now.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
}
updateClock();
setInterval(updateClock, 10000);

(window as any).va = function () {
    ((window as any).vaq = (window as any).vaq || []).push(arguments);
};
(window as any).va('beforeSend', (event: any) => {
    if (event.url.includes('/private')) {
        return null;
    }
    return event;
});

console.log("--STARTING-OS--");

