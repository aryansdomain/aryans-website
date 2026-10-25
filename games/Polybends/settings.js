// ------------------------ SETTINGS ------------------------

const SIDEBAR_PIECE_SIZE = 50; // px    size of pieces in sidebar
const SIDEBAR_PIECE_GAP = 50;  // px    space between pieces in sidebar
const CANVAS_PIECE_SIZE = 50;  // px    size of pieces on canvas

const DOT_RADIUS = 8; // px    radius of the rotating dot

const GRID_SIZE = 25;    // px    size of canvas's grid squares
const MIN_ZOOM = 0.25;   //       furthest the canvas zooms out
const MAX_ZOOM = 4;      //       furthest the canvas zooms in
const ZOOM_SPEED = 0.01; //       how fast ctrl-scrolling zooms

const DEFAULT_SIDES = 5; // number of sides at the start
const MAX_SIDES = 12;    // most sides a polybend can have

const ARC_BUTTON_RADIUS = 0.07; // size of the buttons on the preview arcs
const ARC_BUTTON_OFFSET = 0.01;  // how far the buttons are from a side

const UNDO_LIMIT = 100; //  most steps that can be undone

const DOUBLE_TAP_TIME = 300; // ms   longest time between two clicks/taps on a piece to remove it

const SNAP_DISTANCE = 12; // px    how close an arc gets to another arc before snapping
const SNAP_TURN = 20;     // deg   how much the degrees of arcs can differ for snapping to occur



// ------------------------ PAGE ------------------------

const SVG_NS = "http://www.w3.org/2000/svg";

const STORAGE_KEY = "polybends_intro_seen"; // localStorage key

const sidebar       = document.getElementById("sidebar");
const shapeList     = document.getElementById("sidebar-shapes");
const addShape      = document.getElementById("add-shape");
const newShape      = document.getElementById("new-shape");
const addShapeDone  = document.getElementById("add-shape-done");
const mirrorToggle  = document.querySelector(".mirror-toggle");
const canvas        = document.getElementById("canvas");
const undoButton    = document.getElementById("undo");
const redoButton    = document.getElementById("redo");
const clearButton   = document.getElementById("clear");
const dotsToggle    = document.querySelector(".dots-toggle");
const shapePreview  = document.getElementById("shape-preview");
const sidesInput    = document.getElementById("sides");
const snapInput     = document.getElementById("snap");
const roundnessText = document.getElementById("roundness");

// everything on the canvas
const world = document.createElementNS(SVG_NS, "g");
canvas.appendChild(world);
