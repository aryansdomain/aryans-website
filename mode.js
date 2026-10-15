const MODE_KEY = "mode"; // localStorage storing mode

// get mode picked
let pickedMode = null;
try { pickedMode = localStorage.getItem(MODE_KEY); } catch (error) {}

// picked mode, or dark until one is picked
function currentMode() {
    return pickedMode || "dark";
}

// set colors
function applyMode() {
    document.documentElement.dataset.mode = currentMode();
    window.dispatchEvent(new Event("modechange"));
}
applyMode();

// switch
document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("mode-switch").addEventListener("click", function () {
        pickedMode = currentMode() === "dark" ? "light" : "dark";
        try { localStorage.setItem(MODE_KEY, pickedMode); } catch (error) {}
        applyMode();
    });
});
