// ------------------------ CANVAS ------------------------

// over the intro's canvas
const particleCanvas = document.createElement("canvas");
particleCanvas.id = "particles";
document.getElementById("scene").after(particleCanvas);

let gl = particleCanvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false });

// if gpu is lost, draw on 2d canvas instead
particleCanvas.addEventListener("webglcontextlost", function () {
    gl = null;
    sizeCanvas();
});



// ------------------------ SHADERS ------------------------

// used by both vertex shaders
const SHADER_COMMON = `
uniform vec2 u_screen;      // window size in pixels
uniform float u_ratio;      // canvas pixels per pixel
uniform vec4 u_lens;        // oval width, oval height
uniform float u_lensOffset; // how far colors split fully out on the oval
uniform float u_side;       // which way each color moves: red 1, green 0, blue -1

// how far red and blue move (same as lensSplit in oval.js)
vec2 lensSplit(vec2 p) {
    vec2 fromMiddle = p - u_screen * 0.5;
    float onOval = length(fromMiddle / (u_lens.xy * u_screen)); // how far out on the oval
    float amount = clamp((onOval - u_lens.z) / max(0.0001, u_lens.w - u_lens.z), 0.0, 1.0);
    float reach = length(fromMiddle);
    return reach > 0.0 ? fromMiddle / reach * u_lensOffset * amount : vec2(0.0);
}

// pixels to where webgl draws, -1 to 1 with up positive
vec4 toClip(vec2 p) {
    vec2 clip = p / u_screen * 2.0 - 1.0;
    return vec4(clip.x, -clip.y, 0.0, 1.0);
}
`;

// trail segments
const TRAIL_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 a_corner; // x: 0-1. y: -1 or 1 depending on side of the line
layout(location = 1) in vec4 a_ends;   // start and end of segment
layout(location = 2) in vec2 a_left;   // age of the start and end of trail
uniform float u_width;
out float v_left;
out vec2 v_offset;
out float v_radius;
` + SHADER_COMMON + `
void main() {
    vec2 a = a_ends.xy;
    vec2 b = a_ends.zw;
    vec2 along = b - a;
    float size = length(along);
    vec2 direction = size > 0.0 ? along / size : vec2(1.0, 0.0);
    vec2 normal = vec2(-direction.y, direction.x);

    float halfWidth = u_width * 0.5 + 1.0 / u_ratio;
    vec2 p = mix(a, b, a_corner.x) + normal * a_corner.y * halfWidth + lensSplit((a + b) * 0.5) * u_side;

    v_left = mix(a_left.x, a_left.y, a_corner.x);
    v_offset = vec2(a_corner.y * halfWidth, 0.0);
    v_radius = u_width * 0.5;
    gl_Position = toClip(p);
}
`;

// point
const POINT_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 a_corner; // -1 to 1
layout(location = 1) in vec3 a_point;  // position
uniform float u_radius;
out float v_left;
out vec2 v_offset;
out float v_radius;
` + SHADER_COMMON + `
void main() {
    float radius = u_radius * a_point.z;
    v_offset = a_corner * (radius + 1.0 / u_ratio);
    v_radius = radius;
    v_left = 1.0;
    gl_Position = toClip(a_point.xy + lensSplit(a_point.xy) * u_side + v_offset);
}
`;

// color of each pixel
const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in float v_left;
in vec2 v_offset;
in float v_radius;
uniform vec4 u_color;
uniform float u_alpha;
uniform float u_soft;   // 0-1 for softness/fading out
uniform float u_cutoff; // old parts of trails are not drawn
uniform float u_ratio;
out vec4 color;
void main() {
    if (v_left <= u_cutoff) discard;

    // how much of this pixel is covered
    float fromMiddle = length(v_offset);
    float covered = u_soft > 0.5
        ? clamp(1.0 - fromMiddle / v_radius, 0.0, 1.0)
        : clamp((v_radius - fromMiddle) * u_ratio + 0.5, 0.0, 1.0) * clamp(v_radius * u_ratio * 2.0, 0.0, 1.0);
    color = vec4(u_color.rgb, u_color.a * u_alpha * v_left * covered);
}
`;

// compile a shader
function makeShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
}

// link vertex shader to the fragment shader, and find its uniforms
function makeProgram(vertexSource) {
    const program = gl.createProgram();
    gl.attachShader(program, makeShader(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, makeShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));

    const uniforms = {};
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < count; i++) {
        const name = gl.getActiveUniform(program, i).name;
        uniforms[name] = gl.getUniformLocation(program, name);
    }
    return { program, uniforms };
}

// corner of shape of something drawn
function makeShape(corners, attributeSizes) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    // corners
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(corners), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // numbers for each segment or point
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const floats = attributeSizes.reduce(function (sum, size) { return sum + size; }, 0);
    let offset = 0;
    attributeSizes.forEach(function (size, i) {
        gl.enableVertexAttribArray(1 + i);
        gl.vertexAttribPointer(1 + i, size, gl.FLOAT, false, floats * 4, offset * 4);
        gl.vertexAttribDivisor(1 + i, 1);
        offset += size;
    });

    gl.bindVertexArray(null);
    return { vao, buffer, floats, data: new Float32Array(0) };
}

let trailProgram = null;
let pointProgram = null;
let trailShape = null;
let pointShape = null;
if (gl !== null) {
    try {
        trailProgram = makeProgram(TRAIL_VERTEX_SHADER);
        pointProgram = makeProgram(POINT_VERTEX_SHADER);
        trailShape = makeShape([0, -1, 0, 1, 1, -1, 1, 1], [4, 2]);
        pointShape = makeShape([-1, -1, 1, -1, -1, 1, 1, 1], [3]);
    } catch (error) {
        gl = null; // draw on 2d canvas
    }
}



// ------------------------ DRAWING ------------------------

// css color -> r, g, b, a
function colorValues(color) {
    const swatch = document.createElement("canvas").getContext("2d");
    swatch.fillStyle = color;
    swatch.fillRect(0, 0, 1, 1);
    const data = swatch.getImageData(0, 0, 1, 1).data;
    return [data[0] / 255, data[1] / 255, data[2] / 255, data[3] / 255];
}

// rgb parts of a color
function channelValues(color) {
    const [r, g, b, a] = colorValues(color);
    return [[r, 0, 0, a], [0, g, 0, a], [0, 0, b, a]];
}

let particleColors = null;
function readParticleColors() {
    particleColors = {
        background:     colorValues(colors.background),
        glow:           colorValues(colors.glow),
        glowChannels:  channelValues(colors.glow),
        trailChannels: channelValues(colors.trail),
        textChannels:  channelValues(colors.text)
    };
}

// ensure a shape's length fit its segments/points
function makeRoom(shape, count) {
    const needed = count * shape.floats;
    if (shape.data.length < needed) shape.data = new Float32Array(Math.ceil(needed * 1.5));
    return shape.data;
}

// send data to the gpu
function uploadShape(shape, floats) {
    gl.bindBuffer(gl.ARRAY_BUFFER, shape.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, shape.data.subarray(0, floats), gl.STREAM_DRAW);
}

// every trail segment on the screen
function fillTrails(burstTime) {
    let most = 0;
    for (const point of points) most += point.trail.length;
    const data = makeRoom(trailShape, most);

    const { x: cx, y: cy, z: cz, right, up, forward, focal } = camera;
    let n = 0;
    for (const point of points) {
        const trail = point.trail;
        let previousX = 0, previousY = 0, previousLeft = 0, previousShown = false;

        // each position in the trail, and where the point is now
        for (let i = 0; i <= trail.length; i++) {
            const p    = i < trail.length ? trail[i]      : point.world;
            const time = i < trail.length ? trail[i].time : burstTime;

            const rx = p.x - cx, ry = p.y - cy, rz = p.z - cz;
            const depth = rx*forward.x + ry*forward.y + rz*forward.z;
            const shown = depth >= NEAR_CLIP;
            const x = width  / 2 + focal * (rx*right.x + ry*right.y + rz*right.z) / depth;
            const y = height / 2 - focal * (rx*up.x    + ry*up.y    + rz*up.z   ) / depth;
            const left = 1 - (burstTime - time) / TRAIL_DURATION;

            if (i > 0 && shown && previousShown && previousLeft + left > 0) {
                data[n++] = previousX;
                data[n++] = previousY;
                data[n++] = x;
                data[n++] = y;
                data[n++] = previousLeft;
                data[n++] = left;
            }
            previousX = x;
            previousY = y;
            previousLeft = left;
            previousShown = shown;
        }
    }

    uploadShape(trailShape, n);
    return n / trailShape.floats;
}

// every point on the screen
function fillPoints() {
    const data = makeRoom(pointShape, points.length);
    let n = 0;
    for (const point of points) {
        if (!point.visible) continue;
        data[n++] = point.x;
        data[n++] = point.y;
        data[n++] = clamp(0.3, 4, camera.homeDistance / point.depth); // same as drawPoints in intro.js
    }

    uploadShape(pointShape, n);
    return n / pointShape.floats;
}

// set a program's uniforms
function setUniforms(program, values) {
    for (const name in values) {
        const location = program.uniforms[name];
        if (location === undefined) continue; // not used by this program
        const value = values[name];
        if      (typeof value === "number") gl.uniform1f (location, value);
        else if (value.length === 2)        gl.uniform2fv(location, value);
        else                                gl.uniform4fv(location, value);
    }
}

// draw this many of the same shape
function drawShape(program, shape, count, shared, values) {
    if (count === 0) return;
    gl.useProgram(program.program);
    setUniforms(program, shared);
    setUniforms(program, values);
    gl.bindVertexArray(shape.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
}

// draw points and trails
function drawParticlesGL(burstTime) {
    if (particleColors === null) readParticleColors();
    particleCanvas.style.display = "block";

    // background
    const background = particleColors.background;
    gl.viewport(0, 0, particleCanvas.width, particleCanvas.height);
    gl.clearColor(background[0], background[1], background[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // add light
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    const segmentCount = fillTrails(burstTime);
    const shownCount = fillPoints();
    const screenSize = Math.sqrt(width * height);
    const shared = {
        u_screen: [width, height],
        u_ratio: particleCanvas.width / width,
        u_lens: [LENS_WIDTH, LENS_HEIGHT, LENS_START, LENS_FULL],
        u_lensOffset: LENS_OFFSET * introStrength
    };

    // glow along trails
    drawShape(trailProgram, trailShape, segmentCount, shared, {
        u_width: TRAIL_GLOW_SIZE * screenSize, u_soft: 1, u_cutoff: 1 - TRAIL_GLOW_STEPS / TRAIL_FADE_STEPS,
        u_alpha: TRAIL_GLOW_STRENGTH, u_side: 0, u_color: particleColors.glow
    });

    // trail lines
    particleColors.trailChannels.forEach(function (color, channel) {
        drawShape(trailProgram, trailShape, segmentCount, shared, {
            u_width: TRAIL_WIDTH, u_soft: 0, u_cutoff: 0,
            u_alpha: TRAIL_ALPHA, u_side: 1 - channel, u_color: color
        });
    });

    // glow around points
    if (POINT_GLOW_SIZE > 0 && POINT_GLOW_STRENGTH > 0) {
        particleColors.glowChannels.forEach(function (color, channel) {
            drawShape(pointProgram, pointShape, shownCount, shared, {
                u_radius: POINT_GLOW_SIZE * screenSize, u_soft: 1, u_cutoff: -1,
                u_alpha: POINT_GLOW_STRENGTH, u_side: 1 - channel, u_color: color
            });
        });
    }

    // points
    particleColors.textChannels.forEach(function (color, channel) {
        drawShape(pointProgram, pointShape, shownCount, shared, {
            u_radius: POINT_RADIUS * screenSize, u_soft: 0, u_cutoff: -1,
            u_alpha: 1, u_side: 1 - channel, u_color: color
        });
    });
}
