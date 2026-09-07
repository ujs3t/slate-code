// bridge.js for Slate application
console.log("Slate bridge loaded.");

function applyTopSafeAreaProtection() {
    let sbHeight = 36;
    try {
        if (window.AndroidNative && window.AndroidNative.getStatusBarHeight) {
            sbHeight = window.AndroidNative.getStatusBarHeight() || 36;
        }
    } catch(e) {}
    document.documentElement.style.setProperty('--android-status-bar-height', sbHeight + 'px');
}

applyTopSafeAreaProtection();
document.addEventListener("DOMContentLoaded", applyTopSafeAreaProtection);
window.addEventListener("resize", applyTopSafeAreaProtection);

window.handleAndroidBack = function() {
    const playerContainer = document.getElementById("player-container");
    const isPlayerVisible = document.body.classList.contains("player-open") || (playerContainer && playerContainer.style.display !== "none");
    if (isPlayerVisible) {
        if (typeof window.closePlayer === "function") {
            window.closePlayer();
            return true;
        }
    }

    const modalOverlay = document.getElementById("modalOverlay");
    if (modalOverlay && modalOverlay.classList.contains("active")) {
        modalOverlay.classList.remove("active");
        return true;
    }

    if (document.body.classList.contains("downloads-open")) {
        document.body.classList.remove("downloads-open");
        return true;
    }

    if (document.body.classList.contains("eps-open")) {
        document.body.classList.remove("eps-open");
        return true;
    }

    if (document.body.classList.contains("details-open")) {
        document.body.classList.remove("details-open");
        return true;
    }

    if (document.body.classList.contains("list-open")) {
        document.body.classList.remove("list-open");
        return true;
    }

    const searchResults = document.getElementById("searchResults");
    const searchScreen = document.querySelector(".search-screen");
    if ((searchResults && searchResults.classList.contains("active")) || 
        (searchScreen && (searchScreen.classList.contains("has-results") || searchScreen.classList.contains("search-focused")))) {
        if (typeof window.closeSearchMode === "function") {
            window.closeSearchMode();
        } else {
            searchResults?.classList.remove("active");
            searchScreen?.classList.remove("has-results", "search-focused");
            const searchInput = document.getElementById("searchInput");
            if (searchInput) {
                searchInput.value = "";
                searchInput.blur();
            }
        }
        return true;
    }

    if (window.AndroidNative && window.AndroidNative.exitApp) {
        window.AndroidNative.exitApp();
    }
    return false;
};
