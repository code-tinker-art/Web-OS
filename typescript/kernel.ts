import { AppManager } from "./appManager.js"

export interface App {
    name: string,
    width: string,
    height: string,
    minWidth: string,
    minHeight: string,
    maxWidth: string,
    maxHeight: string,
    htmlPath: string,
    cssPath: string,
    jsPath: string,
    classId: string,
    addDragListener: boolean,
    resizable: boolean
}

export class Kernel {
    private appAndDetails: App[];
    private index: number;
    private apps: string[];
    private parentElem: HTMLElement;
    private appManager: AppManager;

    constructor(selector: string) {
        this.index = 3;
        this.appManager = new AppManager();
        this.parentElem = document.querySelector(selector) as HTMLElement;

        if (!this.parentElem) {
            throw new Error(`Element with selector "${selector}" not found`);
        }

        const rawAppsDetails = localStorage.getItem("webos:appsAndDetails_0007");
        this.appAndDetails = rawAppsDetails ? JSON.parse(rawAppsDetails) : [];

        const rawApps = localStorage.getItem("webos:apps_0007");
        this.apps = rawApps ? JSON.parse(rawApps) : [];
    }

    registerApp(app: App) {
        if (!this.alreadyHasAppDetails(app))
            this.appAndDetails.push(app);
        if (!this.apps.includes(app.name))
            this.apps.push(app.name);
        this.saveToDisk();
    }

    alreadyHasAppDetails(app: App): boolean {
        return this.appAndDetails.some(appDetail => appDetail.name === app.name);
    }

    getApp() {
        return { appAndDetails: this.appAndDetails, apps: this.apps };
    }

    deleteApp(appName: string) {
        this.appAndDetails = this.appAndDetails.filter(app => app.name !== appName);
        this.apps = this.apps.filter(app => app !== appName);
        this.saveToDisk();
    }

    open(appName: string, context: Record<string, any> | null = null) {
        setTimeout(() => {
            if (!this.apps.includes(appName)) {
                console.error("App doesn't exist");
                return;
            }

            let openApp: App | null = null;
            for (let app of this.appAndDetails) {
                if (app.name === appName) { openApp = app; break; }
            }
            if (openApp === null) { console.error("App not found!!"); return; }

            if (context) (window as any).WebOS.openContext = context;

            const div = document.createElement("div");
            div.style.height = openApp.height;
            div.style.width = openApp.width;
            div.style.maxWidth = openApp.maxWidth;
            div.style.maxHeight = openApp.maxHeight;
            div.style.minWidth = openApp.minWidth;
            div.style.minHeight = openApp.minHeight;
            div.style.zIndex = String(this.index);
            div.style.overflow = "clip";
            div.style.position = "absolute";
            div.className = openApp.name;

            const parentW = this.parentElem.offsetWidth;
            const parentH = this.parentElem.offsetHeight;
            const appW = parseInt(openApp.width) || 300;
            const appH = parseInt(openApp.height) || 200;
            const maxLeft = Math.max(0, parentW - appW);
            const maxTop = Math.max(0, parentH - appH);
            div.style.left = `${Math.floor(Math.random() * maxLeft)}px`;
            div.style.top = `${Math.floor(Math.random() * maxTop)}px`;

            if (openApp.resizable) this.addResizeListener(div);
            if (openApp.addDragListener) this.addDragListener(div);

            this.addIndexIncrementation(div);

            this.appManager.loadApp(openApp.htmlPath, openApp.cssPath, openApp.jsPath, div, () => {
                if (openApp!.resizable) {
                    div.querySelectorAll("[data-resize]").forEach(h => div.appendChild(h));
                }
                if (context) (window as any).WebOS.openContext = null;
            });

            this.parentElem.appendChild(div);
        }, 300);
    }

    addIndexIncrementation(div: HTMLDivElement) {
        div.addEventListener("click", () => {
            div.style.zIndex = `${this.index}`;
            this.index++;
        });
    }

    addResizeListener(div: HTMLDivElement) {
        const handles = [
            { position: "top", cursor: "n-resize", left: "4px", top: "0", right: "4px", bottom: "auto", width: "auto", height: "6px" },
            { position: "bottom", cursor: "s-resize", left: "4px", top: "auto", right: "4px", bottom: "0", width: "auto", height: "6px" },
            { position: "left", cursor: "w-resize", left: "0", top: "4px", right: "auto", bottom: "4px", width: "6px", height: "auto" },
            { position: "right", cursor: "e-resize", left: "auto", top: "4px", right: "0", bottom: "4px", width: "6px", height: "auto" },
            { position: "top-left", cursor: "nw-resize", left: "0", top: "0", right: "auto", bottom: "auto", width: "12px", height: "12px" },
            { position: "top-right", cursor: "ne-resize", left: "auto", top: "0", right: "0", bottom: "auto", width: "12px", height: "12px" },
            { position: "bottom-left", cursor: "sw-resize", left: "0", top: "auto", right: "auto", bottom: "0", width: "12px", height: "12px" },
            { position: "bottom-right", cursor: "se-resize", left: "auto", top: "auto", right: "0", bottom: "0", width: "12px", height: "12px" },
        ];

        handles.forEach(({ position, cursor, left, top, right, bottom, width, height }) => {
            const handle = document.createElement("div");
            handle.style.position = "absolute";
            handle.style.left = left;
            handle.style.top = top;
            handle.style.right = right;
            handle.style.bottom = bottom;
            handle.style.width = width;
            handle.style.height = height;
            handle.style.cursor = cursor;
            handle.style.zIndex = "99999";
            handle.style.pointerEvents = "all";
            handle.dataset.resize = position;
            div.appendChild(handle);

            handle.addEventListener("mousedown", (e: MouseEvent) => {
                e.stopPropagation();
                e.preventDefault();

                const startX = e.clientX;
                const startY = e.clientY;
                const startW = div.offsetWidth;
                const startH = div.offsetHeight;
                const startL = div.offsetLeft;
                const startT = div.offsetTop;

                const minW = parseInt(div.style.minWidth) || 100;
                const minH = parseInt(div.style.minHeight) || 100;

                const parseSize = (val: string, fallback: number): number => {
                    if (!val) return fallback;
                    if (val.endsWith("vw")) return (parseFloat(val) / 100) * window.innerWidth;
                    if (val.endsWith("vh")) return (parseFloat(val) / 100) * window.innerHeight;
                    return parseInt(val) || fallback;
                };

                const maxW = parseSize(div.style.maxWidth, Infinity);
                const maxH = parseSize(div.style.maxHeight, Infinity);

                const onMouseMove = (e: MouseEvent) => {
                    const dx = e.clientX - startX;
                    const dy = e.clientY - startY;
                    let newW = startW, newH = startH, newL = startL, newT = startT;
                    if (position.includes("right")) newW = Math.min(maxW, Math.max(minW, startW + dx));
                    if (position.includes("bottom")) newH = Math.min(maxH, Math.max(minH, startH + dy));
                    if (position.includes("left")) {
                        newW = Math.min(maxW, Math.max(minW, startW - dx));
                        newL = startL + (startW - newW);
                    }
                    if (position.includes("top")) {
                        newH = Math.min(maxH, Math.max(minH, startH - dy));
                        newT = startT + (startH - newH);
                    }
                    div.style.width = `${newW}px`;
                    div.style.height = `${newH}px`;
                    div.style.left = `${newL}px`;
                    div.style.top = `${newT}px`;
                };

                const onMouseUp = () => {
                    document.removeEventListener("mousemove", onMouseMove);
                    document.removeEventListener("mouseup", onMouseUp);
                };

                document.addEventListener("mousemove", onMouseMove);
                document.addEventListener("mouseup", onMouseUp);
            });
        });
    }

    addDragListener(div: HTMLDivElement) {
        let isMouseDown = false;
        let offsetX = 0, offsetY = 0;

        const handleMouseMove = (e: MouseEvent) => {
            if (!isMouseDown) return;
            div.style.left = `${e.clientX - offsetX}px`;
            div.style.top = `${e.clientY - offsetY}px`;
        };

        const handleMouseUp = () => {
            isMouseDown = false;
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };

        div.addEventListener("mousedown", (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.dataset.resize) return;
            if (!target.closest("[data-drag]")) return;

            isMouseDown = true;
            offsetX = e.clientX - div.getBoundingClientRect().left;
            offsetY = e.clientY - div.getBoundingClientRect().top;
            div.style.zIndex = `${this.index}`;
            this.index++;
            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);
        });
    }

    private saveToDisk() {
        localStorage.setItem("webos:appsAndDetails_0007", JSON.stringify(this.appAndDetails));
        localStorage.setItem("webos:apps_0007", JSON.stringify(this.apps));
    }
}