export class AppManager {
    htmlPath;
    cssPath;
    jsPath;
    constructor() {
        this.htmlPath = "";
        this.cssPath = "";
        this.jsPath = "";
    }
    loadApp(htmlPath, cssPath, jsPath, div, onLoad) {
        this.htmlPath = htmlPath;
        if (cssPath !== "")
            this.cssPath = cssPath;
        this.jsPath = jsPath;
        setTimeout(async () => {
            await this.#loadAndMergeApps(div);
            onLoad?.();
        }, 300);
    }
    async #loadAndMergeApps(div) {
        div.style.visibility = "hidden";
        try {
            const htmlRes = await fetch(this.htmlPath);
            const html = await htmlRes.text();
            if (this.cssPath) {
                await new Promise((resolve) => {
                    const link = document.createElement("link");
                    link.rel = "stylesheet";
                    link.href = this.cssPath;
                    link.onload = () => resolve();
                    link.onerror = () => resolve();
                    div.appendChild(link);
                });
            }
            div.insertAdjacentHTML("afterbegin", html);
            await new Promise((resolve) => {
                const script = document.createElement("script");
                script.src = this.jsPath;
                script.onload = () => resolve();
                script.onerror = () => resolve();
                div.appendChild(script);
            });
        }
        catch (e) {
            console.error("Error fetching App data:", e);
        }
        finally {
            div.style.visibility = "visible";
        }
    }
}
