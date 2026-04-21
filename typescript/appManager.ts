export class AppManager {
    private htmlPath: string;
    private cssPath: string;
    private jsPath: string;
    constructor() {
        this.htmlPath = "";
        this.cssPath = "";
        this.jsPath = "";
    }

    loadApp(htmlPath: string, cssPath: string, jsPath: string, div: HTMLDivElement, onLoad?: () => void) {
        this.htmlPath = htmlPath;
        if (cssPath !== "") this.cssPath = cssPath;
        this.jsPath = jsPath;
        setTimeout(async () => {
            await this.#loadAndMergeApps(div);
            onLoad?.();
        }, 300)
    }

    async #loadAndMergeApps(div: HTMLDivElement) {

        try {
            let htmlRes = await fetch(this.htmlPath);
            const html = await htmlRes.text();

            let link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = this.cssPath;

            let script = document.createElement("script");
            script.src = `${this.jsPath}`
            //script.type = "module";

            div.insertAdjacentHTML("afterbegin", html);
            div.append(link, script);

        } catch (e) {
            console.error("Error fetching App data:", e);
        }
        
    }
}