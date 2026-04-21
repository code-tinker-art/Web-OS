import { Kernel } from "./kernel.js";
import { apps } from "./apps.js";
import { FileSystem_WebOS } from "./file_system.js";
let kernel = new Kernel(".screen");
let fs = new FileSystem_WebOS();
window.WebOS = {
    kernel,
    fs
};
let input = document.querySelector(".webos_taskbar_input");
let suggestion = document.querySelector(".suggestion");
let appList = [];
for (const key in apps) {
    kernel.registerApp(apps[key]);
    appList.push(key);
}
input.addEventListener("keydown", (e) => {
    let match = appList.filter(word => {
        return word.toLowerCase().startsWith(input.value.toLowerCase());
    });
    if (e.key === "Enter") {
        if (appList.includes(input.value)) {
            kernel.open(input.value);
        }
    }
    else if (e.key === "Tab") {
        e.preventDefault();
        if (match.length > 0) {
            input.value = match[0];
            suggestion.textContent = match[0];
        }
        else {
            suggestion.textContent = "";
        }
    }
    suggestion.textContent = match[0];
});
console.log("--STARTING-OS--");
