// ------------------------ SETTINGS ------------------------

const LIQUID_BLUR = 1; // px   how far apart shapes can be and still join



// ------------------------ STATE ------------------------

const SVG_NS = "http://www.w3.org/2000/svg";
const liquidShapes    = document.getElementById("liquid-shapes");
const liquidLabels    = document.getElementById("liquid-labels");

// liquid filter
liquidShapes.setAttribute("filter", "url(#liquid-filter)");
const liquidBlur = document.querySelector("#liquid-filter feGaussianBlur");

// chromatic aberration toward screen edges
const splitRed  = smoothOffset(document.querySelector("#liquid-filter .split-red") )
const splitBlue = smoothOffset(document.querySelector("#liquid-filter .split-blue"));

setLiquidBorderAlpha();



// ------------------------ UTILITIES ------------------------

// silhouette for liquid filter
function makeSilhouette(tag) {
    const shape = document.createElementNS(SVG_NS, tag);
    shape.style.fill = "#000";
    liquidShapes.appendChild(shape);
    return shape;
}

function setAttributes(element, attributes) {
    for (const name in attributes) element.setAttribute(name, attributes[name]);
}



// ------------------------ DRAWING ------------------------

function drawLiquid(origin) {
    const liquidity = Math.max.apply(null, blobs.map(function (blob) { return blob.liquidity; }));
    liquidBlur.setAttribute("stdDeviation", Math.max(0.01, LIQUID_BLUR * liquidity));
    splitByLens(origin);

    // parent, following the ring
    setAttributes(liquidParent.shape, {
        x: origin.x - liquidParent.width / 2,
        y: origin.y - liquidParent.height / 2,
        width: liquidParent.width,
        height: liquidParent.height
    });

    blobs.forEach(function (blob) {
        setAttributes(blob.bodyShape, {
            x: blob.x - blob.width / 2,
            y: blob.y - blob.height / 2,
            width:  blob.width,
            height: blob.height,
            rx: blob.cornerRadius
        });
    });
}

// split the border
function splitByLens(origin) {
    let split = { x: 0, y: 0 };
    [origin].concat(blobs).forEach(function (spot) {
        const x = spot.x * worldCamera.scale + worldCamera.x; // on the screen
        const y = spot.y * worldCamera.scale + worldCamera.y;
        const here = lensSplit(x, y, 1);
        if (Math.hypot(here.x, here.y) > Math.hypot(split.x, split.y)) split = here;
    });
    setSplit(split.x, split.y);
}

// red and blue movement
function setSplit(dx, dy) {
    splitRed ( dx,  dy);
    splitBlue(-dx, -dy);
}

// take away all liquid shapes
function clearLiquid() {
    setSplit(0, 0);
    liquidShapes.replaceChildren();
}
