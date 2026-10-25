// close a popup
function closePopup(popup) {
    if (popup.hidden) return;
    popup.hidden = true;
    popup.dispatchEvent(new Event("popupclose"));
}

// open/close a popup
function setUpPopup(popup, button) {
    // open
    button.addEventListener("click", function () {
        button.blur();
        popup.hidden = false;
    });

    // close
    popup.querySelector(".popup-close").addEventListener("click", function () { closePopup(popup); }); // click close button
    popup.addEventListener("click", function (event) {
        if (event.target === popup) closePopup(popup); // click outside the box
    });
}

// escape key to close
document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") document.querySelectorAll(".popup").forEach(closePopup);
});

// help and settings popups of game
function setUpPopups(storageKey) {
    const help = document.getElementById("help");

    // set up help and settings button
    setUpPopup(help,                                document.querySelector(".help-button")    );
    setUpPopup(document.getElementById("settings"), document.querySelector(".settings-button"));

    // save how to play popup seen
    help.addEventListener("popupclose", function () {
        try { localStorage.setItem(storageKey, "true"); } catch (error) {}
    });

    // first visit
    let seen = false;
    try { seen = localStorage.getItem(storageKey) === "true"; } catch (error) {}
    if (!seen) help.hidden = false;
}
