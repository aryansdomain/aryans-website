// ------------------------ SETTINGS ------------------------

const OPEN_TIME = 700;        // time a clicked subbox's border takes to grow to the edges of the screen
const OPEN_BORDER_FADE = 0.7; // how far the box has grown when its border starts fading away
const NAME_FADE = 0.3;        // how far the name has grown when label has faded in

// pages whose title comes there from the corresponding box/subbox
const titlePages = ["about/", "blog/", "projects/IGCSE_IDE/", "games/Wörtel/", "games/Polybends/"];

function titleSpot() {
    const titleTop   = clamp(8,  40,   0.04  * window.innerHeight); // --title-top
    const titleSize  = clamp(24, 35.2, 0.05  * window.innerWidth);  // .topbar-title font size
    const buttonSize = clamp(15, 20,   0.042 * window.innerWidth);  // .back-button font size
    const rowHeight  = Math.max(titleSize * 1.1, buttonSize * (1.2 + 2 * 0.7));
    return {
        y: titleTop + 8 + rowHeight / 2,
        size: titleSize,
        spacing: 0
    };
}



// ------------------------ FOR HOME.JS ------------------------

// grow a subbox out to the edges of the screen, then open the page
function openSubcat(blob) {
    // start on the subbox's border, just outside its body
    const rect = home.getBoundingClientRect();
    const scale = worldCamera.scale;
    const from = {
        x: rect.left + (blob.x - blob.width  / 2) * scale + worldCamera.x - 1,
        y: rect.top  + (blob.y - blob.height / 2) * scale + worldCamera.y - 1,
        width:  blob.width  * scale + 2,
        height: blob.height * scale + 2
    };

    // remove glow
    blob.hoverShapes.glow.style.opacity   = 0;
    blob.hoverShapes.border.style.opacity = 0;

    openPage(from, blob.label, {
        font: blob.text.style.font,
        fontSize: parseFloat(getComputedStyle(blob.text).fontSize) * scale + "px",
        letterSpacing: blob.text.style.letterSpacing
    }, blob.link, true);
}

// grow a box out to the edges of the screen, then open the page
function openElement(box, text, link, scale) {
    // start on the box's border, just outside it
    const rect = box.getBoundingClientRect();
    const from = { x: rect.left - 1, y: rect.top - 1, width: rect.width + 2, height: rect.height + 2 };

    const style = getComputedStyle(text);
    openPage(from, text.textContent.trim(), {
        font: style.font,
        fontSize: parseFloat(style.fontSize) * scale + "px",
        letterSpacing: style.letterSpacing
    }, link, true);
}

// grow the name into the title of about page, then open the page
function openName(link) {
    const rect = nameButton.getBoundingClientRect();

    // size of letters
    const measure = document.createElement("canvas").getContext("2d");
    measure.font = font(TEXT_FONT_FAMILY, 100);
    const ink = measure.measureText(TEXT);
    const size = 100 * topbarTextWidth() / (ink.actualBoundingBoxLeft + ink.actualBoundingBoxRight);

    // fade out name as label fades in
    const scene = document.getElementById("scene");
    scene.style.zIndex = 1003;
    openPage({ x: rect.left, y: rect.top, width: rect.width, height: rect.height }, TEXT, {
        font: font(TEXT_FONT_FAMILY, size),
        fontSize: size + "px",
        letterSpacing: "0px"
    }, link, false, scene);
}

// grow a box from where it is on the screen to the edges of the screen, then open link
let openFrame = null; // the growing box
function openPage(from, text, labelStyle, link, bordered, fadeOut) {
    // where the label goes: the title of the page, or nowhere
    const spot = titlePages.includes(link) ? titleSpot() : null;
    const handoff = spot !== null;
    const startSize    = parseFloat(labelStyle.fontSize);
    const startSpacing = parseFloat(labelStyle.letterSpacing) || 0;

    // box over the old one
    openFrame = document.createElement("div");
    openFrame.className = "open-frame";
    const label = document.createElement("span");
    label.className = "open-label";
    label.style.font = labelStyle.font;
    label.style.fontSize = labelStyle.fontSize;
    label.style.letterSpacing = labelStyle.letterSpacing;
    const light = document.createElement("span");
    const bold  = document.createElement("span"); // fades in over the light one
    light.textContent = text;
    bold.textContent  = text;
    bold.className = "open-label-bold";
    label.append(light, bold);

    if (handoff) {
        label.classList.add("open-label-moving");
        label.style.left = from.x + from.width  / 2 + "px";
        label.style.top  = from.y + from.height / 2 + "px";
    }
    if (fadeOut) label.style.opacity = 0;
    openFrame.appendChild(label);
    document.body.appendChild(openFrame);

    function place(e) {
        openFrame.style.left   = lerp(from.x,      0,                  e) + "px";
        openFrame.style.top    = lerp(from.y,      0,                  e) + "px";
        openFrame.style.width  = lerp(from.width,  window.innerWidth,  e) + "px";
        openFrame.style.height = lerp(from.height, window.innerHeight, e) + "px";
    }
    place(0);

    let start = null;
    function grow(now) {
        if (openFrame === null) return;
        if (start === null) start = now;
        const u = Math.min(1, (now - start) / OPEN_TIME);
        const e = easeOut(u); // fast at first, slowing down
        place(e);

        // border fades away as it reaches the edges of the screen
        const border = bordered ? 1 - smoothstep(Math.max(0, (e - OPEN_BORDER_FADE) / (1 - OPEN_BORDER_FADE))) : 0;
        openFrame.style.borderColor = "color-mix(in srgb, var(--text) " + border * 100 + "%, transparent)";
        if (handoff) {
            // move label from the box to the title of the page
            label.style.left          = lerp(from.x + from.width  / 2, window.innerWidth / 2, e) + "px";
            label.style.top           = lerp(from.y + from.height / 2, spot.y,                e) + "px";
            label.style.fontSize      = lerp(startSize,                spot.size,             e) + "px";
            label.style.letterSpacing = lerp(startSpacing,             spot.spacing,          e) + "px";
            light.style.opacity = fadeOut ? 0 : 1 - e;
            bold.style.opacity  = fadeOut ? 1 :     e;

            // fade out label
            if (fadeOut) {
                const fade = Math.min(1, e / NAME_FADE);
                label.style.opacity   =     fade;
                fadeOut.style.opacity = 1 - fade;
            }
        }
        else label.style.opacity = Math.max(0, 1 - (now - start) / LABEL_TIME); // text fades away as it grows

        if (u < 1) requestAnimationFrame(grow);
        else location.href = link;
    }
    requestAnimationFrame(grow);
}

// name opens the about page 
const nameLink = document.getElementById("name");
if (nameLink !== null) nameLink.addEventListener("click", function (event) {
    event.preventDefault();
    if (openFrame === null) openName(event.currentTarget.getAttribute("href"));
});

// came back to this page from a subcategory's page, take the border away
window.addEventListener("pageshow", function (event) {
    if (!event.persisted || openFrame === null) return;
    openFrame.remove();
    openFrame = null;
    const scene = document.getElementById("scene");
    if (scene !== null) scene.style.visibility = "";
});
