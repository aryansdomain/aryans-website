// ------------------------ BOXES ------------------------

const lensBoxes   = document.querySelectorAll(".category");
const boxLensDefs = document.getElementById("lens-filters");

const boxLenses = (function () {
    const background = lensBackground();
    return Array.prototype.map.call(lensBoxes, function (box, i) { return makeBoxLens("box-lens-" + i, background, boxLensDefs); });
})();

// split each box
function updateBoxLenses() {
    lensBoxes.forEach(function (box, i) {
        const rect = box.getBoundingClientRect();
        const split = lensSplit(rect.left + rect.width / 2, rect.top + rect.height / 2, 1);

        // no filter when's not split
        if (split.x === 0 && split.y === 0) {
            box.style.filter = "";
            return;
        }
        boxLenses[i].red ( split.x,  split.y);
        boxLenses[i].blue(-split.x, -split.y);
        box.style.filter = "url(#box-lens-" + i + ")";
    });
}



// ------------------------ BLUR ------------------------

// same blur over the intro
const introBlur = document.getElementById("lens").cloneNode(true);
introBlur.id = "intro-lens-blur";
document.getElementById("scene").after(introBlur);



// ------------------------ FOR INTRO.JS ------------------------

// how strong lens is over the intro
let introStrength = 1; // fades out as name moves to topbar
function setIntroLens(strength) {
    if (strength === introStrength) return;
    introStrength = strength;
    introBlur.style.opacity = strength;
    introBlur.style.display = strength > 0 ? "" : "none";
}



// ------------------------ RUNNING CODE ------------------------

function lensFrame() {
    if (introStrength === 0) updateBoxLenses();
    requestAnimationFrame(lensFrame);
}
requestAnimationFrame(lensFrame);
[document.getElementById("lens"), introBlur].forEach(placeLensBlur);
