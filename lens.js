// ------------------------ SETTINGS ------------------------

// the lens oval, for both the blur and the chromatic aberration
const LENS_WIDTH = 0.7;  // ratio   how far the oval reaches across from the middle, of the screen's width
const LENS_HEIGHT = 0.6; // ratio   how far the oval reaches up and down from the middle, of the screen's height
const LENS_START = 0.4;  // ratio   how far out on the oval things start blurring and splitting
const LENS_FULL = 0.7;  // ratio   how far out on the oval things are fully blurred and split

const LENS_OFFSET = 5; // px      how far red and blue split apart when fully out on the oval
const LENS_BLUR = 2.5; // px      how blurred things are fully out on the oval, less further in



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



// how far red and blue move
function lensSplit(x, y, strength) {
    const amount = lensAmount(x, y) * strength;
    if (amount === 0) return { x: 0, y: 0 };
    const angle = lensAngle(x, y);
    return { x: Math.cos(angle) * LENS_OFFSET * amount, y: Math.sin(angle) * LENS_OFFSET * amount };
}

// move smoothly
function smoothOffset(offset) {
    const SVG = "http://www.w3.org/2000/svg";
    const input  = offset.getAttribute("in");
    const result = offset.getAttribute("result");
    const parent = offset.parentNode;

    function add(tag, attributes) {
        const element = document.createElementNS(SVG, tag);
        setLensAttributes(element, attributes);
        parent.insertBefore(element, offset);
        return element;
    }

    // across, down, both or neither
    const moves = [0, 1, 2, 3].map(function (corner) {
        return add("feOffset", { in: input, dx: 0, dy: 0, result: result + "-corner-" + corner });
    });

    // blend them
    const blends = [
        add("feComposite", { in: result + "-corner-0", in2: result + "-corner-1", operator: "arithmetic", k1: 0, k2: 1, k3: 0, k4: 0, result: result + "-blend-0" }),
        add("feComposite", { in: result + "-blend-0",  in2: result + "-corner-2", operator: "arithmetic", k1: 0, k2: 1, k3: 0, k4: 0, result: result + "-blend-1" }),
        add("feComposite", { in: result + "-blend-1",  in2: result + "-corner-3", operator: "arithmetic", k1: 0, k2: 1, k3: 0, k4: 0, result: result })
    ];
    offset.remove();

    return function (dx, dy) {
        const x = Math.floor(dx), y = Math.floor(dy);
        const fx = dx - x, fy = dy - y; // how far toward the next pixel over and down

        setLensAttributes(moves[0], { dx: x,     dy: y     });
        setLensAttributes(moves[1], { dx: x + 1, dy: y     });
        setLensAttributes(moves[2], { dx: x,     dy: y + 1 });
        setLensAttributes(moves[3], { dx: x + 1, dy: y + 1 });

        // each corner weighted by how close the real move is to it
        setLensAttributes(blends[0], { k2: (1 - fx) * (1 - fy), k3: fx * (1 - fy) });
        setLensAttributes(blends[1], { k2: 1,                   k3: (1 - fx) * fy });
        setLensAttributes(blends[2], { k2: 1,                   k3: fx * fy       });
    };
}



// ------------------------ BOXES ------------------------

const lensBoxes   = document.querySelectorAll(".category");
const boxLensDefs = document.getElementById("lens-filters");

function setLensAttributes(element, attributes) {
    for (const name in attributes) element.setAttribute(name, attributes[name]);
}

// red, green and blue of a css color
function colorChannels(color) {
    const swatch = document.createElement("canvas").getContext("2d");
    swatch.fillStyle = color;
    swatch.fillRect(0, 0, 1, 1);
    const data = swatch.getImageData(0, 0, 1, 1).data;
    return [data[0] / 255, data[1] / 255, data[2] / 255];
}

// create lens
function makeBoxLens(i, background) {
    const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
    filter.id = "box-lens-" + i;
    setLensAttributes(filter, { x: "-20%", y: "-50%", width: "140%", height: "200%", "color-interpolation-filters": "sRGB" });

    // darkness of one channel
    function darkness(channel) {
        const row = [0, 0, 0, 1, 0];
        row[channel] = -1 / Math.max(0.01, background.channels[channel]);
        return "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  " + row.join(" ");
    }

    filter.innerHTML =
        '<feMorphology in="SourceAlpha" operator="dilate" radius="' + Math.ceil(LENS_OFFSET + 1) + '" result="base-area" />' +
        '<feFlood flood-color="' + background.color + '" />' +
        '<feComposite in2="base-area" operator="in" result="base" />' +
        '<feColorMatrix in="SourceGraphic" type="matrix" values="' + darkness(0) + '" result="dark-red" />' +
        '<feColorMatrix in="SourceGraphic" type="matrix" values="' + darkness(1) + '" result="dark-green" />' +
        '<feColorMatrix in="SourceGraphic" type="matrix" values="' + darkness(2) + '" result="dark-blue" />' +
        '<feOffset class="lens-red" in="dark-red" dx="0" dy="0" result="moved-red" />' +
        '<feFlood flood-color="#0ff" />' +
        '<feComposite in2="moved-red" operator="in" result="ink-red" />' +
        '<feFlood flood-color="#f0f" />' +
        '<feComposite in2="dark-green" operator="in" result="ink-green" />' +
        '<feOffset class="lens-blue" in="dark-blue" dx="0" dy="0" result="moved-blue" />' +
        '<feFlood flood-color="#ff0" />' +
        '<feComposite in2="moved-blue" operator="in" result="ink-blue" />' +
        '<feBlend in="ink-red"   in2="base"           mode="multiply" result="with-red" />' +
        '<feBlend in="ink-green" in2="with-red"       mode="multiply" result="with-red-green" />' +
        '<feBlend in="ink-blue"  in2="with-red-green" mode="multiply" />';
    boxLensDefs.appendChild(filter);
    return { red: smoothOffset(filter.querySelector(".lens-red")), blue: smoothOffset(filter.querySelector(".lens-blue")) };
}

const boxLenses = (function () {
    const color = getComputedStyle(document.documentElement).getPropertyValue("--background").trim();
    const background = { color: color, channels: colorChannels(color) };
    return Array.prototype.map.call(lensBoxes, function (box, i) { return makeBoxLens(i, background); });
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
let introStrength = 1; // fades out as name moves to topbar
function setIntroLens(strength) {
    if (strength === introStrength) return;
    introStrength = strength;
    introBlur.style.opacity = strength;
    introBlur.style.display = strength > 0 ? "" : "none";
}



// ------------------------ RUNNING CODE ------------------------

function lensFrame() {
    updateBoxLenses();
    requestAnimationFrame(lensFrame);
}
requestAnimationFrame(lensFrame);
placeLensBlur();
