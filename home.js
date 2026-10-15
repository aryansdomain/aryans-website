const home = document.getElementById("home");

// init
function showHome() {
    if (home.classList.contains("shown")) return;
    home.classList.add("shown");
    startWheel();
}
