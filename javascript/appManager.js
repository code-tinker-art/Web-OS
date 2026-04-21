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
        try {
            let htmlRes = await fetch(this.htmlPath);
            const html = await htmlRes.text();
            let link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = this.cssPath;
            let script = document.createElement("script");
            script.src = `${this.jsPath}`;
            div.insertAdjacentHTML("afterbegin", html);
            div.append(link, script);
        }
        catch (e) {
            console.error("Error fetching App data:", e);
        }
    }
}
