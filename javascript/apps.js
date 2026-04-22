const MAX_WIDTH = "100vw";
const MAX_HEIGHT = "92vh";
export const apps = {
    "tester app": {
        name: "tester app",
        width: "130px",
        height: "100px",
        minWidth: "130px",
        minHeight: "100px",
        maxWidth: "180px",
        maxHeight: "150px",
        htmlPath: "/App/App_tester/test.html",
        cssPath: "",
        jsPath: "/App/App_tester/test.js",
        classId: "testerApp",
        addDragListener: true,
        resizable: true
    },
    "file explorer": {
        name: "file explorer",
        width: "500px",
        height: "340px",
        minWidth: "360px",
        minHeight: "260px",
        maxWidth: MAX_WIDTH,
        maxHeight: MAX_HEIGHT,
        htmlPath: "/App/File_explorer/file_explorer.html",
        cssPath: "/App/File_explorer/file_explorer.css",
        jsPath: "/App/File_explorer/file_explorer.js",
        classId: "file-explorer",
        addDragListener: true,
        resizable: true
    },
    "shell": {
        name: "shell",
        width: "600px",
        height: "380px",
        minWidth: "400px",
        minHeight: "260px",
        maxWidth: MAX_WIDTH,
        maxHeight: MAX_HEIGHT,
        htmlPath: "/App/Shell/shell.html",
        cssPath: "/App/Shell/shell.css",
        jsPath: "/App/Shell/shell.js",
        classId: "shell",
        addDragListener: true,
        resizable: true
    }
};
