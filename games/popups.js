function setUpPopups(storageKey) {
    const help = document.getElementById("help");

    function close(popup) {
        if (popup.hidden) return;
        popup.hidden = true;

        // how to play is remembered
        if (popup === help) try { localStorage.setItem(storageKey, "true"); } catch (error) {}
    }

    // open/close
    function setUp(popup, button) {
        // open
        button.addEventListener("click", function () {
            button.blur();
            popup.hidden = false;
        });

        // close
        popup.querySelector(".popup-close").addEventListener("click", function () { close(popup); }); // click close button
        popup.addEventListener("click", function (event) {
            if (event.target === popup) close(popup); // click outside the box
        });
    }

    // set up help and settings button
    setUp(help,                                document.querySelector(".help-button")    );
    setUp(document.getElementById("settings"), document.querySelector(".settings-button"));

    // escape key closes popup
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") document.querySelectorAll(".popup").forEach(close);
    });

    // first visit
    let seen = false;
    try { seen = localStorage.getItem(storageKey) === "true"; } catch (error) {}
    if (!seen) help.hidden = false;
}
