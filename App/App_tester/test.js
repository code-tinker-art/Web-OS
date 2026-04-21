(function () {
    console.log("hii")
    let current = document.currentScript;
    let parent = current.parentElement;
    parent.tabIndex = 0;
    let count = 0;
    parent.querySelector("button").addEventListener("click",() => {
        parent.querySelector(".test-h3").textContent = ++count;
    })

    parent.addEventListener("keydown", (e) => {
        if (e.key === "Delete")
            parent.remove()
    });
})()