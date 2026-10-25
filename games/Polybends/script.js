// ------------------------ SETTINGS POPUP ------------------------

// show dots switch
let showDots = true;

function setShowDots(on) {
    showDots = on;
    dotsToggle.setAttribute("aria-checked", on);
    document.body.classList.toggle("hide-dots", !on);
}
// save
dotsToggle.addEventListener("click", function () {
    setShowDots(!showDots);
    try { localStorage.setItem("polybends_show_dots", showDots); } catch (error) {}
});

// snap rotation
let snapAngle = 0;
snapInput.addEventListener("input", function () {
    const angle = Number(snapInput.value);
    if (!Number.isFinite(angle) || angle < 0 || angle > 180) return; // in range
    snapAngle = angle;
    try { localStorage.setItem("polybends_snap_angle", snapAngle); } catch (error) {} // save
});
snapInput.addEventListener("change", function () { snapInput.value = snapAngle; }); // reject out of range numbers



// ------------------------ START ------------------------

// restore sidebar and settings from last time
try {
    const saved = JSON.parse(localStorage.getItem("polybends_sidebar"));
    const valid = Array.isArray(saved) && saved.every(function (shape) { // shape is ok
        return shape && Array.isArray(shape.bulges) && shape.bulges.length >= 3 && shape.bulges.length <= MAX_SIDES;
    });
    if (valid) shapes = saved.map(function (shape) { return { bulges: shape.bulges.map(Boolean), reflected: Boolean(shape.reflected) }; });
} catch (error) {}
try { showDots = localStorage.getItem("polybends_show_dots") !== "false"; } catch (error) {}
setShowDots(showDots);
try {
    const saved = Number(localStorage.getItem("polybends_snap_angle"));
    if (Number.isFinite(saved) && saved >= 0 && saved <= 180) snapAngle = saved;
} catch (error) {}
snapInput.value = snapAngle;

// shape
sidesInput.value = bulgesOut.length;
sidesInput.max   = MAX_SIDES;
shapeList.style.gap = SIDEBAR_PIECE_GAP + "px";
drawSidebar();
drawPreview();

// restore canvas from last time
try {
    const stored = JSON.parse(localStorage.getItem("polybends_canvas"));
    if (stored && Array.isArray(stored.saves) && stored.saves.length > 0 && Number.isInteger(stored.step) && stored.step >= 0 && stored.step < stored.saves.length) {
        saves = stored.saves;
        goTo(stored.step);
    }
} catch (error) {
    // the entry is broken, so start again
    saves = [[]];
    step = 0;
    world.replaceChildren();
    updateButtons();
}
updateRoundness();
placeView();

// popups, then fit preview
setUpPopups(STORAGE_KEY);
setUpPopup(newShape, addShape);
addShape.addEventListener("click", fitPreview);
