// ------------------------ SETTINGS ------------------------

const LAUNCH_TIME = 250; // ms   time the back button takes to fly to the left before leaving (same as .back-button.launching in style.css)



// ------------------------ BACK BUTTON ------------------------

// fly to the left, then go back
document.querySelectorAll(".back-button").forEach(function (button) {
    button.addEventListener("click", function (event) {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; // opening in a new tab
        event.preventDefault();
        if (button.classList.contains("launching")) return;
        button.classList.add("launching");

        setTimeout(function () {
            // go back in history
            if (button.dataset.back === "history" && document.referrer && new URL(document.referrer).origin === location.origin) history.back();
            else location.href = button.href;
        }, LAUNCH_TIME);
    });
});

// came back to this page, so put the button back
window.addEventListener("pageshow", function (event) {
    if (!event.persisted) return;
    document.querySelectorAll(".back-button").forEach(function (button) {
        button.classList.remove("launching");
    });
});
