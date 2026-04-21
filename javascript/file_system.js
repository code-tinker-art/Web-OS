export class File {
    name;
    extName;
    content;
    type = "file";
    constructor(name = "new file", extName = "txt", content = "") {
        this.name = name;
        this.extName = extName;
        this.content = content;
    }
}
export class Folder {
    name;
    type = "folder";
    children = [];
    constructor(name = "New Folder") {
        this.name = name;
    }
    add(newElement) {
        this.children.push(newElement);
    }
}
export class FileSystem_WebOS {
    #paths;
    constructor() {
        const savedData = localStorage.getItem("webos:file_system_0007");
        if (savedData) {
            const parsed = JSON.parse(savedData);
            this.#paths = this.reconstruct(parsed);
        }
        else {
            this.#paths = new Folder("WebOS PC");
        }
    }
    reconstruct(data) {
        if (data.type === "file") {
            return new File(data.name, data.extName, data.content);
        }
        else {
            const folder = new Folder(data.name);
            folder.children = (data.children || []).map((child) => this.reconstruct(child));
            return folder;
        }
    }
    printTree() {
        const render = (node, prefix = "", isLast = true) => {
            const connector = isLast ? "└── " : "├── ";
            const icon = node.type === "folder" ? "📁" : "📄";
            const label = node.type === "file"
                ? `${node.name}.${node.extName}`
                : node.name;
            console.log(`${prefix}${connector}${icon} ${label}`);
            if (node.type === "folder" && node.children.length) {
                const childPrefix = prefix + (isLast ? "    " : "│   ");
                node.children.forEach((child, i) => {
                    render(child, childPrefix, i === node.children.length - 1);
                });
            }
        };
        console.log(`🖥️  ${this.#paths.name}`);
        this.#paths.children.forEach((child, i) => {
            render(child, "", i === this.#paths.children.length - 1);
        });
    }
    addFile(name = "", ext = "", content = "", directory = "") {
        const folder = this.travelTo(directory);
        if (folder) {
            folder.add(new File(name, ext, content));
            this.saveToDisk();
        }
    }
    addFolder(name = "", directory = "") {
        const folder = this.travelTo(directory);
        if (!folder)
            return;
        const exists = folder.children.some(f => f.type === "folder" && f.name === name);
        if (!exists) {
            folder.add(new Folder(name));
            this.saveToDisk();
        }
        else {
            console.error("Folder already exists");
        }
    }
    saveToDisk() {
        localStorage.setItem("webos:file_system_0007", JSON.stringify(this.#paths));
    }
    travelTo(directory = "") {
        if (directory === "" || directory === "/")
            return this.#paths;
        const parts = directory.split("/").filter(p => p !== "");
        let current = this.#paths;
        for (const part of parts) {
            const next = current.children.find(c => c.type === "folder" && c.name === part);
            if (!next) {
                console.error(`Folder "${part}" not found`);
                return null;
            }
            current = next;
        }
        return current;
    }
}
