type Entity = Folder | File;

export class File {
    public type: "file" = "file";
    constructor(
        public name = "new file",
        public extName = "txt",
        public content = ""
    ) { }
}

export class Folder {
    public type: "folder" = "folder";
    public children: Entity[] = [];

    constructor(public name = "New Folder") { }

    add(newElement: Entity) {
        this.children.push(newElement);
    }

    has(name: string): boolean {
        return this.children.some(c => c.name === name);
    }
}

export class FileSystem_WebOS {
    #paths: Folder;

    constructor() {
        const savedData = localStorage.getItem("webos:file_system_0007");
        if (savedData) {
            const parsed = JSON.parse(savedData);
            this.#paths = this.reconstruct(parsed) as Folder;
        } else {
            this.#paths = new Folder("WebOS PC");
        }
    }

    private reconstruct(data: any): Entity {
        if (data.type === "file") {
            return new File(data.name, data.extName, data.content);
        } else {
            const folder = new Folder(data.name);
            folder.children = (data.children || []).map((child: any) => this.reconstruct(child));
            return folder;
        }
    }

    printTree() {
        const render = (node: Entity, prefix = "", isLast = true) => {
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
        if (!folder) return;
        if (!folder.has(name)) {
            folder.add(new File(name, ext, content));
            this.saveToDisk();
        } else {
            console.error("File already exists");
        }
    }

    addFolder(name = "", directory = "") {
        const folder = this.travelTo(directory);
        if (!folder) return;
        if (!folder.has(name)) {
            folder.add(new Folder(name));
            this.saveToDisk();
        } else {
            console.error("Folder already exists");
        }
    }

    saveToDisk() {
        localStorage.setItem("webos:file_system_0007", JSON.stringify(this.#paths));
    }

    travelTo(directory = ""): Folder | null {
        if (directory === "" || directory === "/") return this.#paths;

        const parts = directory.split("/").filter(p => p !== "");
        let current: Folder = this.#paths;

        for (const part of parts) {
            const next = current.children.find(
                c => c.type === "folder" && c.name === part
            ) as Folder;

            if (!next) {
                console.error(`Folder "${part}" not found`);
                return null;
            }
            current = next;
        }
        return current;
    }

    getFile(path = ""): File | null {
        const parts = path.split("/").filter(p => p !== "");
        const fileName = parts.pop();
        if (!fileName) return null;

        const folder = this.travelTo(parts.join("/"));
        if (!folder) return null;

        const file = folder.children.find(
            c => c.type === "file" && (c.name === fileName || `${c.name}.${(c as File).extName}` === fileName)
        );
        return file ? (file as File) : null;
    }
}