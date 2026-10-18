// ------------------------ SETTINGS ------------------------

// the lens oval, for both the blur and the chromatic aberration
const LENS_WIDTH = 0.7;  // ratio   how far the oval reaches across from the middle, of the screen's width
const LENS_HEIGHT = 0.6; // ratio   how far the oval reaches up and down from the middle, of the screen's height
const LENS_START = 0.3;  // ratio   how far out on the oval things start blurring and splitting
const LENS_FULL = 0.65;  // ratio   how far out on the oval things are fully blurred and split

const LENS_OFFSET = 3;       // px      how far red and blue split apart from green when fully out on the oval
const LENS_MAP_SCALE = 0.25; // ratio   size of the map of how far things split, compared to the screen
const LENS_BLUR = 2.5;       // px      how blurred things are fully out on the oval, less further in



// ------------------------ LENS ------------------------

// how split things are
function lensAmount(x, y) {
    const across = (x - window.innerWidth  / 2) / (LENS_WIDTH  * window.innerWidth);
    const down   = (y - window.innerHeight / 2) / (LENS_HEIGHT * window.innerHeight);
    const distance = Math.hypot(across, down);
    if (LENS_FULL <= LENS_START) return distance >= LENS_START ? 1 : 0;
    return Math.min(1, Math.max(0, (distance - LENS_START) / (LENS_FULL - LENS_START)));
}

// which way things split
function lensAngle(x, y) {
    return Math.atan2(y - window.innerHeight / 2, x - window.innerWidth / 2);
}



// ------------------------ SCREEN FILTER ------------------------

const screenLens = document.getElementById("screen-lens");

// same filter for intr
const introLens = screenLens.cloneNode(true);
introLens.id = "intro-lens";
introLens.querySelectorAll("[id]").forEach(function (element) { element.removeAttribute("id"); });
introLens.querySelector(".lens-background").setAttribute("class", "lens-intro-background");
screenLens.parentNode.appendChild(introLens);

const lensFilters = [screenLens, introLens];
const lensMaps    = lensFilters.map(function (filter) { return filter.querySelector("feImage"); });
const lensMoves   = lensFilters.map(function (filter) { return filter.querySelectorAll("feDisplacementMap"); }); // out, then in
let introStrength = 1; // how strong intro's lens is, fades out as name moves to topbar

// how far red and blue move
function setLensMoves(moves, strength) {
    moves[0].setAttribute("scale", -2 * LENS_OFFSET * strength);
    moves[1].setAttribute("scale",  2 * LENS_OFFSET * strength);
}

// how far each spot on the screen moves
function drawLensMap() {
    const width  = Math.max(1, Math.round(window.innerWidth  * LENS_MAP_SCALE));
    const height = Math.max(1, Math.round(window.innerHeight * LENS_MAP_SCALE));
    const map = document.createElement("canvas");
    map.width  = width;
    map.height = height;
    const mapCtx = map.getContext("2d");
    const pixels = mapCtx.createImageData(width, height);

    for (let row = 0; row < height; row++) {
        for (let column = 0; column < width; column++) {
            // spot on the screen for this pixel
            const x = (column + 0.5) / LENS_MAP_SCALE;
            const y = (row    + 0.5) / LENS_MAP_SCALE;
            const amount = lensAmount(x, y);
            const angle  = lensAngle(x, y);

            const i = (row * width + column) * 4;
            pixels.data[i    ] = Math.round(255 * (0.5 + 0.5 * Math.cos(angle) * amount));
            pixels.data[i + 1] = Math.round(255 * (0.5 + 0.5 * Math.sin(angle) * amount));
            pixels.data[i + 2] = 0;
            pixels.data[i + 3] = 255;
        }
    }
    mapCtx.putImageData(pixels, 0, 0);

    // strech over the whole screen
    const url = map.toDataURL();
    const margin = LENS_OFFSET + 2;
    lensFilters.forEach(function (filter, i) {
        const lensMap = lensMaps[i];
        lensMap.setAttribute("href", url);
        lensMap.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", url); // older Safari
        lensMap.setAttribute("x", 0);
        lensMap.setAttribute("y", 0);
        lensMap.setAttribute("width",  window.innerWidth);
        lensMap.setAttribute("height", window.innerHeight);

        filter.setAttribute("x", -margin);
        filter.setAttribute("y", -margin);
        filter.setAttribute("width",  window.innerWidth  + 2 * margin);
        filter.setAttribute("height", window.innerHeight + 2 * margin);
    });

    setLensMoves(lensMoves[0], 1);
    setLensMoves(lensMoves[1], introStrength);
}



// ------------------------ BLUR ------------------------

// same blur over the intro
const introBlur = document.getElementById("lens").cloneNode(true);
introBlur.id = "intro-lens-blur";
document.getElementById("scene").after(introBlur);

// blur the same oval
function placeLensBlur() {
    [document.getElementById("lens"), introBlur].forEach(function (lens) {
        lens.style.setProperty("--lens-width",  LENS_WIDTH  * 100 + "%");
        lens.style.setProperty("--lens-height", LENS_HEIGHT * 100 + "%");

        const layers = lens.children;
        for (let i = 0; i < layers.length; i++) {
            const along = layers.length === 1 ? 0 : i / (layers.length - 1);
            layers[i].style.setProperty("--start", (LENS_START + (LENS_FULL - LENS_START) * along) * 100 + "%");
            layers[i].style.setProperty("--blur", LENS_BLUR * (i + 1) / layers.length + "px");
        }
    });
}



// ------------------------ FOR INTRO.JS ------------------------

// how strong lens is over the intro
function setIntroLens(strength) {
    if (strength === introStrength) return;
    introStrength = strength;

    const scene = document.getElementById("scene");
    scene.style.filter = strength > 0 ? "url(#intro-lens)" : "";
    setLensMoves(lensMoves[1], strength);
    introBlur.style.opacity = strength;
    introBlur.style.display = strength > 0 ? "" : "none";
}



// ------------------------ RUNNING CODE ------------------------

window.addEventListener("resize", drawLensMap);
drawLensMap();
placeLensBlur();
document.getElementById("scene").style.filter = "url(#intro-lens)"; // intro starts with lens on
