// ------------------------ SETTINGS ------------------------

const STORAGE_KEY = 'wörtel_intro_seen'

const WORD_LENGTH = 5;
const MAX_GUESSES = 6;
// messages in each language
const TEXT = {
    de: {
        notInList: "Nicht in der Wortliste",
        wins: ["Perfekt", "Super", "Toll", "Genial", "Befriedigend", "Gut"],
        mustBeAt:    function (n, letter) { return n + ". Buchstabe muss " + letter + " sein"; },
        mustContain: function (letter)    { return "Wort muss " + letter + " enthalten"; }
    },
    en: {
        notInList: "Not in word list",
        wins: ["Genius", "Magnificent", "Impressive", "Splendid", "Great", "Phew"],
        mustBeAt:    function (n, letter) { return ["1st", "2nd", "3rd", "4th", "5th"][n - 1] + " letter must be " + letter; },
        mustContain: function (letter)    { return "Guess must contain " + letter; }
    }
};



// ------------------------ UTILITIES ------------------------

// ß as its own character
function toUpper(word) {
    // combined umlauts as one character
    return [...word.normalize('NFC')].map(c => c === 'ß' || c === 'ẞ' ? 'ß' : c.toUpperCase()).join('');
}

// one word per line, uppercase, no blank lines
function parse(text) {
    return text.split(/\r?\n/).map(w => toUpper(w.trim())).filter(Boolean);
}

function randomAnswer() {
    return validAnswers[Math.floor(Math.random() * validAnswers.length)];
}

// tiles in row number i
function rowTiles(i) {
    return document.querySelectorAll('.row')[i].querySelectorAll('.tile');
}



// ------------------------ GAME ------------------------

let targetWord;
let validAnswers = [];
let validGuesses = [];
let currentGuess = "";
let guesses = [];
let results = []; // colors of each guess
let gameOver = false;

async function init() {
    // get answers and guesses
    const [answersText, guessesText] = await Promise.all([
        fetch('answers.txt').then(r => r.text()),
        fetch('guesses.txt').then(r => r.text()),
    ]);
    validAnswers = parse(answersText);
    validGuesses = parse(guessesText);
    targetWord = randomAnswer();

    // make grid
    const grid = document.getElementById('grid');
    for (let i = 0; i < MAX_GUESSES; i++) {
        const row = document.createElement('div');
        row.className = 'row';

        for (let j = 0; j < WORD_LENGTH; j++) {
            const tile = document.createElement('div');
            tile.className = 'tile';
            row.appendChild(tile);
        }
        grid.appendChild(row);
    }

    // keydown
    window.addEventListener('keydown', (e) => {
        // skip shortcuts, but not option or altgr
        if (e.metaKey || (e.ctrlKey && !e.altKey)) return;
        handleInput(e.key);
    });

    // click onscreen key
    document.querySelectorAll('.key').forEach(button => {
        button.addEventListener('click', () => {
            button.blur();
            handleInput(button.dataset.key);
        });
    });
}

// reset
function resetGame() {
    currentGuess = "";
    guesses = [];
    results = [];
    gameOver = false;
    targetWord = randomAnswer();
    updateHardModeToggle(); // can be turned on again

    document.querySelectorAll('.tile').forEach(tile => {
        tile.textContent = "";
        tile.removeAttribute('data-state');
    });

    document.querySelectorAll('.key').forEach(key => key.removeAttribute('data-state'));
    document.getElementById('message-container').innerHTML = "";
}

// show short popup
function showMessage(msg, duration = 1500) {
    const container = document.getElementById('message-container');
    container.innerHTML = "";

    // create element
    const popup = document.createElement('div');
    popup.className = 'popup';
    popup.textContent = msg;
    container.appendChild(popup);

    // fade out and kill
    setTimeout(() => {
        popup.classList.add('fade-out');
        setTimeout(() => { if (popup.parentNode === container) popup.remove(); }, 300);
    }, duration);
}

// update tile display
function updateDisplay() {
    const tiles = rowTiles(guesses.length);
    for (let i = 0; i < WORD_LENGTH; i++) {
        tiles[i].textContent = currentGuess[i] || "";
        if (currentGuess[i]) tiles[i].setAttribute   ('data-state', 'tbd');
        else                 tiles[i].removeAttribute('data-state'       );
    }
}

// keyboard input
function handleInput(key) {
    if (!welcome.hidden || !settings.hidden) return; // a popup is open
    if (gameOver) return;
    key = toUpper(key);
    if (key === 'ENTER') {
        submitGuess();
    } else if (key === 'BACKSPACE') {
        currentGuess = currentGuess.slice(0, -1);
    } else if (/^[A-ZÄÖÜß]$/.test(key)) {
        if (currentGuess.length < WORD_LENGTH) currentGuess += key;
    }
    updateDisplay();
}

// guessing logic
function submitGuess() {
    // invalid guesses
    if (currentGuess.length !== WORD_LENGTH) return;
    if (!validGuesses.includes(currentGuess)) {
        showMessage(TEXT[lang].notInList);
        return;
    }

    // hard mode
    if (hardMode) {
        const problem = hardModeProblem(currentGuess);
        if (problem) {
            showMessage(problem);
            return;
        }
    }

    const tiles = rowTiles(guesses.length);
    const tempTarget = targetWord.split(""); // array of target letters
    const result = new Array(WORD_LENGTH).fill("absent"); // codes for letter colors

    // green
    for (let i = 0; i < WORD_LENGTH; i++) {
        if (currentGuess[i] === tempTarget[i]) {
            result[i] = "correct";
            tempTarget[i] = null;
        }
    }
    // yellow
    for (let i = 0; i < WORD_LENGTH; i++) {
        if (result[i] === "correct") continue;

        const index = tempTarget.indexOf(currentGuess[i]);
        if (index !== -1) {
            result[i] = "present";
            tempTarget[index] = null;
        }
    }

    // update
    result.forEach((state, i) => {
        tiles[i].setAttribute('data-state', state);
        updateKeyUI(currentGuess[i], state);
    });

    // add guess
    guesses.push(currentGuess);
    results.push(result);

    // won or lost
    if (currentGuess === targetWord) {
        gameOver = true;
        setTimeout(() => showMessage(TEXT[lang].wins[guesses.length - 1], 2500), 250);
        setTimeout(resetGame, 3200);
    } else if (guesses.length === MAX_GUESSES) {
        gameOver = true;
        setTimeout(() => showMessage(targetWord, 3500), 250);
        setTimeout(resetGame, 4200);
    }

    currentGuess = "";
}

// hard mode: message for the first revealed hint that the guess does not use
function hardModeProblem(guess) {
    // green letters have to stay
    for (let g = 0; g < guesses.length; g++) {
        for (let i = 0; i < WORD_LENGTH; i++) {
            if (results[g][i] === 'correct' && guess[i] !== guesses[g][i]) return TEXT[lang].mustBeAt(i + 1, guesses[g][i]);
        }
    }

    // green and yellow letters must be in it, as many times as they were revealed
    for (let g = 0; g < guesses.length; g++) {
        for (let i = 0; i < WORD_LENGTH; i++) {
            const letter = guesses[g][i];
            if (results[g][i] === 'absent') continue;

            const revealed = [...guesses[g]].filter((l, j) => l === letter && results[g][j] !== 'absent').length;
            const used     = [...guess].filter(l => l === letter).length;
            if (used < revealed) return TEXT[lang].mustContain(letter);
        }
    }
    return null;
}

// update
function updateKeyUI(letter, state) {
    const key = document.querySelector(`.key[data-key="${letter}"]`);
    if (!key) return;

    const currentState = key.getAttribute('data-state');
    if (currentState === 'correct'                      ) return;
    if (currentState === 'present' && state === 'absent') return;

    key.setAttribute('data-state', state);
}

// language, english unless switched in settings
let lang = 'en';
try { if (localStorage.getItem('wörtel_lang') === 'de') lang = 'de'; } catch (error) {}
setLang(lang);

function setLang(newLang) {
    lang = newLang;
    document.body.dataset.lang = lang; // css shows only this language
    document.documentElement.lang = lang;
    document.querySelectorAll('.lang-switch button').forEach(function (button) {
        button.setAttribute('aria-pressed', button.dataset.lang === lang);
    });
}
document.querySelectorAll('.lang-switch button').forEach(function (button) {
    button.addEventListener('click', function () {
        setLang(button.dataset.lang);
        try { localStorage.setItem('wörtel_lang', lang); } catch (error) {} // saved only when chosen
    });
});

// hard mode
const hardModeToggle = document.querySelector('.hard-mode-toggle');
let hardMode = false;
try { hardMode = localStorage.getItem('wörtel_hard_mode') === 'true'; } catch (error) {}
setHardMode(hardMode);

function setHardMode(on) {
    hardMode = on;
    hardModeToggle.setAttribute('aria-checked', on);
    updateHardModeToggle();
}
hardModeToggle.addEventListener('click', function () {
    setHardMode(!hardMode);
    try { localStorage.setItem('wörtel_hard_mode', hardMode); } catch (error) {} // saved only when chosen
});

// can only be turned on before the first guess, grayed out otherwise
function updateHardModeToggle() {
    hardModeToggle.disabled = !hardMode && guesses.length > 0 && !gameOver;
}

// settings popup
const settings = document.getElementById('settings');
document.querySelector('.settings-button').addEventListener('click', function (event) {
    event.currentTarget.blur();
    updateHardModeToggle();
    settings.hidden = false;
});
settings.querySelector('.settings-close').addEventListener('click', function () { settings.hidden = true; });
settings.addEventListener('click', function (event) {
    if (event.target === settings) settings.hidden = true; // clicked outside the box
});

// welcome popup, first visit only
const welcome = document.getElementById('welcome');
let seenWelcome = false;
try { seenWelcome = localStorage.getItem(STORAGE_KEY) === 'true'; } catch (error) {}
if (!seenWelcome) welcome.hidden = false;

function closeWelcome() {
    welcome.hidden = true;
    try { localStorage.setItem(STORAGE_KEY, 'true'); } catch (error) {}
}
welcome.querySelector('.welcome-close').addEventListener('click', closeWelcome);
welcome.addEventListener('click', function (event) {
    if (event.target === welcome) closeWelcome(); // clicked outside the box
});

// help button opens it again
document.querySelector('.help-button').addEventListener('click', function (event) {
    event.currentTarget.blur();
    welcome.hidden = false;
});

// run
init();
