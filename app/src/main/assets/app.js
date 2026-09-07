let appStarted = false;
function startApp() {
    if (appStarted || !document.body) return;
    appStarted = true;
    document.body.classList.add("loaded");
    setTimeout(() => {
        document.body.classList.add("ready");
    }, 2200);
    setTimeout(() => {
        const loader = document.getElementById("loader-wrapper");
        if (loader) {
            loader.style.display = "none";
            loader.style.pointerEvents = "none";
        }
    }, 650);
}
if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(startApp, 50);
} else {
    document.addEventListener("DOMContentLoaded", startApp);
    window.addEventListener("load", startApp);
}
setTimeout(startApp, 400);

const HISTORY_KEY = "albox_history";
const FAV_KEY = "albox_favorites";
const PERF_KEY = "albox_perf_mode";
const SUB_SETTINGS_KEY = "albox_sub_settings";
const CUSTOM_FONT_KEY = "albox_custom_font";
const SKIP_INTRO_KEY = "skip_intro";
const SKIP_OUTRO_KEY = "skip_outro";
const SKIP_CUTS_KEY = "skip_cuts";

function loadPerfMode() {
    const isPerf = localStorage.getItem(PERF_KEY) === "true";
    if (isPerf && document.body) {
        document.body.classList.add("perf-mode");
    }
    const perfEl = document.getElementById("perfToggle");
    if (perfEl) perfEl.checked = isPerf;

    const skipIntroEl = document.getElementById("skipIntroToggle");
    if (skipIntroEl) skipIntroEl.checked = localStorage.getItem(SKIP_INTRO_KEY) === "true";
    const skipOutroEl = document.getElementById("skipOutroToggle");
    if (skipOutroEl) skipOutroEl.checked = localStorage.getItem(SKIP_OUTRO_KEY) === "true";
    const skipCutsEl = document.getElementById("skipCutsToggle");
    if (skipCutsEl) skipCutsEl.checked = localStorage.getItem(SKIP_CUTS_KEY) === "true";
}

function extractSeriesName(title) {
    if (!title) return "";
    let s = String(title).trim();
    if (s.includes(" - ")) {
        s = s.split(" - ")[0].trim();
    } else if (s.includes(" : ")) {
        s = s.split(" : ")[0].trim();
    }
    s = s.replace(/^S\d+E\d+\s*[-_:]\s*/i, "")
         .replace(/\s*[-_:]?\s*S\d+E\d+$/i, "")
         .replace(/\s*[-_:]?\s*(الحلقة|حلقة|ep|episode)\s*\d+$/i, "")
         .trim();
    return s;
}

function getShowKey(item) {
    if (!item) return "";
    
    const sName = extractSeriesName(item.title || "");
    const cleanName = sName.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, "");
    if (cleanName.length > 1) {
        return "show_name_" + cleanName;
    }
    
    const normShowId = String(item.showId || "").replace(/^local_/, "");
    const normEpId = String(item.epId || item.id || "").replace(/^local_/, "");
    if (normShowId && normShowId !== normEpId && !normShowId.startsWith("local_")) {
        return "show_id_" + normShowId;
    }
    
    return "ep_" + normEpId;
}

function getHistory() {
    let list = [];
    try {
        if (window.AndroidNative && window.AndroidNative.getHistoryJson) {
            const nativeStr = window.AndroidNative.getHistoryJson();
            if (nativeStr) list = JSON.parse(nativeStr);
        } else {
            list = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
        }
    } catch (e) {
        list = [];
    }
    if (!Array.isArray(list)) return [];

    const seen = new Set();
    const cleanHistory = [];
    for (const item of list) {
        if (!item || (!item.epId && !item.id)) continue;
        const key = getShowKey(item);
        if (!seen.has(key)) {
            seen.add(key);
            cleanHistory.push(item);
        }
    }
    return cleanHistory;
}

function saveHistory(item) {
    if (!item || (!item.epId && !item.id)) return;
    const normEpId = String(item.epId || item.id).replace(/^local_/, "");
    item.epId = normEpId;
    
    const itemKey = getShowKey(item);
    let history = getHistory();

    const existingIndex = history.findIndex(h => getShowKey(h) === itemKey);
    const existingItem = existingIndex > -1 ? history[existingIndex] : null;

    if (!item.image && existingItem && existingItem.image) {
        item.image = existingItem.image;
    }
    if (!item.image) {
        item.image = localStorage.getItem("slate_ep_poster_" + normEpId) || localStorage.getItem("slate_download_poster_" + normEpId) || "";
    }
    if (!item.image && window.downloadManager) {
        const dlItem = window.downloadManager.items.get(normEpId) || window.downloadManager.items.get(String(item.epId));
        if (dlItem && dlItem.poster) item.image = dlItem.poster;
    }
    if (!item.image && (item.showId || (existingItem && existingItem.showId))) {
        const sId = item.showId || (existingItem && existingItem.showId);
        item.image = localStorage.getItem("slate_show_poster_" + String(sId)) || "";
    }

    if (existingItem && existingItem.showId && String(existingItem.showId) !== String(existingItem.epId) && !String(existingItem.showId).startsWith("local_")) {
        if (!item.showId || item.showId === item.epId || String(item.showId).startsWith("local_")) {
            item.showId = existingItem.showId;
        }
    }

    if (item.image) {
        try {
            localStorage.setItem("slate_ep_poster_" + normEpId, item.image);
            localStorage.setItem("slate_download_poster_" + normEpId, item.image);
            if (item.showId) localStorage.setItem("slate_show_poster_" + String(item.showId), item.image);
        } catch (e) {}
    }

    history = history.filter(h => getShowKey(h) !== itemKey);
    history.unshift(item);
    if (history.length > 50) history.pop();

    const jsonStr = JSON.stringify(history);
    localStorage.setItem(HISTORY_KEY, jsonStr);
    try {
        if (window.AndroidNative && window.AndroidNative.saveHistoryJson) {
            window.AndroidNative.saveHistoryJson(jsonStr);
        }
    } catch (e) {}
}

function deleteHistoryItem(epId) {
    if (!epId) return;
    const normEpId = String(epId).replace(/^local_/, "");
    let history = getHistory();
    const target = history.find(h => {
        const normH = String(h.epId || h.id || "").replace(/^local_/, "");
        return normH === normEpId || String(h.epId) === String(epId);
    });
    const targetKey = target ? getShowKey(target) : null;

    history = history.filter(h => {
        const normH = String(h.epId || h.id || "").replace(/^local_/, "");
        const normShow = String(h.showId || "").replace(/^local_/, "");
        if (normH === normEpId || normShow === normEpId || String(h.epId) === String(epId)) return false;
        if (targetKey && getShowKey(h) === targetKey) return false;
        return true;
    });

    const jsonStr = JSON.stringify(history);
    localStorage.setItem(HISTORY_KEY, jsonStr);
    try {
        if (window.AndroidNative && window.AndroidNative.saveHistoryJson) {
            window.AndroidNative.saveHistoryJson(jsonStr);
        }
    } catch (e) {}
}

function removeHistoryCard(epId) {
    deleteHistoryItem(epId);
    const card = document.querySelector(`[data-history-epid="${epId}"]`);
    if (card) {
        card.style.transform = 'scale(0.8)';
        card.style.opacity = '0';
        card.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
        setTimeout(() => {
            card.remove();
            const listGrid = document.getElementById("listGrid");
            const remaining = listGrid ? listGrid.querySelectorAll('.list-card') : [];
            if (remaining.length === 0 && listGrid) {
                listGrid.innerHTML = '<div class="empty-text">لم تشاهد أي شيء بعد.</div>';
            }
        }, 200);
    }
    showToast("تم الحذف من سجل المشاهدة");
}

function getHistoryItem(epId) {
    if (!epId) return null;
    const normEpId = String(epId).replace(/^local_/, "");
    return getHistory().find(h => {
        const normH = String(h.epId || h.id || "").replace(/^local_/, "");
        return normH === normEpId || String(h.epId) === String(epId);
    });
}

function getHistoryShow(showId) {
    if (!showId) return null;
    const normShowId = String(showId).replace(/^local_/, "");
    return getHistory().find(h => {
        const normShow = String(h.showId || "").replace(/^local_/, "");
        if (normShow === normShowId || String(h.showId) === String(showId)) return true;
        if (typeof currentItem !== "undefined" && currentItem && currentItem.title) {
            const currentShowKey = getShowKey({ title: currentItem.title, showId: showId });
            if (getShowKey(h) === currentShowKey) return true;
        }
        return false;
    });
}

function getFavorites() {
    try {
        if (window.AndroidNative && window.AndroidNative.getFavoritesJson) {
            const nativeStr = window.AndroidNative.getFavoritesJson();
            if (nativeStr) return JSON.parse(nativeStr);
        }
    } catch (e) {}
    return JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
}

function toggleFavorite(item) {
    let favs = getFavorites();
    const index = favs.findIndex(f => f.id === item.id);
    if (index > -1) favs.splice(index, 1);
    else favs.unshift({ id: item.id, title: item.title, image: item.style.image });
    const jsonStr = JSON.stringify(favs);
    localStorage.setItem(FAV_KEY, jsonStr);
    try {
        if (window.AndroidNative && window.AndroidNative.saveFavoritesJson) {
            window.AndroidNative.saveFavoritesJson(jsonStr);
        }
    } catch (e) {}
    updateFavButton(item.id);
}

function isFavorite(id) { return getFavorites().some(f => f.id === id); }

function updateFavButton(id) {
    const btn = document.getElementById("favButton");
    if (isFavorite(id)) btn.classList.add("active");
    else btn.classList.remove("active");
}

function formatNumbers(num) {
    const n = parseInt(num || 0);
    if (isNaN(n)) return "0";
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    return n.toLocaleString("en-US");
}

const root = document.documentElement;
const subOverlay = document.getElementById("subOverlay");
const subTextEl = document.getElementById("subText");

function saveSubSettings() {
    const settings = {
        size: root.style.getPropertyValue("--sub-size").trim() || "20px",
        bg: root.style.getPropertyValue("--sub-bg").trim() || "rgba(0,0,0,0.6)",
        color: root.style.getPropertyValue("--sub-color").trim() || "#ffffff",
        font: root.style.getPropertyValue("--sub-font").trim() || "'Readex Pro', sans-serif",
        stroke: root.style.getPropertyValue("--sub-stroke").trim() || "none",
        pos: subOverlay.style.bottom.replace("px", "") || "80"
    };
    localStorage.setItem(SUB_SETTINGS_KEY, JSON.stringify(settings));
}

function loadSubSettings() {
    const saved = JSON.parse(localStorage.getItem(SUB_SETTINGS_KEY) || "{}");
    if (Object.keys(saved).length === 0) return;

    if (saved.size) {
        root.style.setProperty("--sub-size", saved.size);
        const sizeSlider = document.getElementById("sizeSlider");
        if (sizeSlider) sizeSlider.value = parseInt(saved.size);
        const sizeValue = document.getElementById("sizeValue");
        if (sizeValue) sizeValue.innerText = saved.size;
    }

    if (saved.bg) {
        root.style.setProperty("--sub-bg", saved.bg);
        document.querySelectorAll("#bgOptions .opt-btn").forEach(b => {
            b.classList.toggle("active", b.dataset.bg === saved.bg);
        });
    }

    if (saved.color) {
        root.style.setProperty("--sub-color", saved.color);
        document.querySelectorAll("#colorOptions .opt-color").forEach(b => {
            b.classList.toggle("active", b.dataset.color === saved.color);
        });
    }

    if (saved.font) {
        root.style.setProperty("--sub-font", saved.font);
        const fontSelect = document.getElementById("fontSelect");
        if (fontSelect) {
            let optionExists = Array.from(fontSelect.options).some(opt => opt.value === saved.font);
            if (!optionExists && saved.font === "'CustomUploadedFont', sans-serif") {
                loadCustomFont();
            }
            fontSelect.value = saved.font;
        }
    }

    if (saved.stroke) {
        root.style.setProperty("--sub-stroke", saved.stroke);
        const strokeToggle = document.getElementById("strokeToggle");
        if (strokeToggle) strokeToggle.checked = (saved.stroke !== "none");
    }

    if (saved.pos && subOverlay) {
        subOverlay.style.bottom = saved.pos + "px";
        const posSlider = document.getElementById("posSlider");
        if (posSlider) posSlider.value = parseInt(saved.pos);
    }
}

function applyCustomFont(fontUrl, fontName) {
    let styleTag = document.getElementById("custom-font-style");
    if (!styleTag) {
        styleTag = document.createElement("style");
        styleTag.id = "custom-font-style";
        document.head.appendChild(styleTag);
    }
    styleTag.innerHTML = "@font-face { font-family: 'CustomUploadedFont'; src: url(" + fontUrl + "); }";

    const fontSelect = document.getElementById("fontSelect");
    if (fontSelect) {
        let customOpt = Array.from(fontSelect.options).find(opt => opt.value === "'CustomUploadedFont', sans-serif");
        if (!customOpt) {
            customOpt = document.createElement("option");
            customOpt.value = "'CustomUploadedFont', sans-serif";
            fontSelect.appendChild(customOpt);
        }
        customOpt.text = fontName || "خط مخصص";
    }
}

function loadCustomFont() {
    const fontUrl = localStorage.getItem(CUSTOM_FONT_KEY + "_url");
    const fontName = localStorage.getItem(CUSTOM_FONT_KEY + "_name");
    if (fontUrl) {
        applyCustomFont(fontUrl, fontName);
    }
}

const fontUpload = document.getElementById("fontUpload");
if (fontUpload) {
    fontUpload.addEventListener("change", function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(evt) {
            const fontUrl = evt.target.result;
            try {
                localStorage.setItem(CUSTOM_FONT_KEY + "_url", fontUrl);
                localStorage.setItem(CUSTOM_FONT_KEY + "_name", file.name);
                applyCustomFont(fontUrl, file.name);

                const fsEl = document.getElementById("fontSelect");
                if (fsEl) fsEl.value = "'CustomUploadedFont', sans-serif";
                root.style.setProperty("--sub-font", "'CustomUploadedFont', sans-serif");
                saveSubSettings();
                alert("تم رفع الخط بنجاح!");
            } catch (err) {
                alert("حجم الخط كبير جداً للمتصفح. يرجى اختيار خط أصغر.");
            }
        };
        reader.readAsDataURL(file);
    });
}

const listScreen = document.getElementById("list-screen");
const listTitle = document.getElementById("listTitle");
const listGrid = document.getElementById("listGrid");
const listLoader = document.getElementById("listLoader");

async function openListScreen(type) {
    listGrid.innerHTML = "";
    listGrid.style.opacity = "0";
    listLoader.classList.remove("hidden");
    document.body.classList.add("list-open");
    
    await new Promise(r => setTimeout(r, 50));

    const checkSvg = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>';

    if (type === "fav") {
        listTitle.textContent = "المفضلة";
        const favs = getFavorites();
        if (favs.length === 0) {
            listLoader.classList.add("hidden");
            listGrid.style.opacity = "1";
            listGrid.innerHTML = '<div class="empty-text">لا يوجد محتوى في المفضلة بعد.</div>';
            return;
        }
        favs.forEach(f => {
            const card = document.createElement("div");
            card.className = "list-card";
            card.innerHTML = '<img src="' + f.image + '" onerror="this.src=\'https://via.placeholder.com/140x210\'"><div class="list-card-title">' + f.title + '</div>';
            card.addEventListener("click", () => openDetails(f.id, f.title, f.image));
            listGrid.appendChild(card);
        });
    } else {
        listTitle.textContent = "سجل المشاهدة";
        const history = getHistory();
        if (history.length === 0) {
            listLoader.classList.add("hidden");
            listGrid.style.opacity = "1";
            listGrid.innerHTML = '<div class="empty-text">لم تشاهد أي شيء بعد.</div>';
            return;
        }

        const posterMapByShowId = new Map();
        const posterMapBySeriesName = new Map();

        history.forEach(item => {
            const p = item.image;
            if (p && typeof p === "string" && p.trim().length > 0) {
                if (item.showId) posterMapByShowId.set(String(item.showId), p);
                const sName = extractSeriesName(item.title);
                if (sName) posterMapBySeriesName.set(sName.toLowerCase(), p);
            }
        });

        if (window.downloadManager && window.downloadManager.items) {
            window.downloadManager.items.forEach(dl => {
                const p = dl.poster;
                if (p && typeof p === "string" && p.trim().length > 0) {
                    const normEp = String(dl.id).replace(/^local_/, "");
                    localStorage.setItem("slate_download_poster_" + normEp, p);
                    localStorage.setItem("slate_ep_poster_" + normEp, p);
                    const sName = downloadManager.getSeriesName ? downloadManager.getSeriesName(dl) : extractSeriesName(dl.title);
                    if (sName) posterMapBySeriesName.set(sName.toLowerCase(), p);
                }
            });
        }

        history.forEach(h => {
            const normEpId = String(h.epId || h.id || "").replace(/^local_/, "");
            const progress = (h.currentTime && h.duration > 0) ? Math.min(100, Math.round((h.currentTime / h.duration) * 100)) : 0;
            const isCompleted = progress > 90;

            let posterSrc = h.image || "";
            if (!posterSrc) {
                posterSrc = localStorage.getItem("slate_ep_poster_" + normEpId) || localStorage.getItem("slate_download_poster_" + normEpId) || "";
            }
            if (!posterSrc && window.downloadManager) {
                const dlItem = window.downloadManager.items.get(normEpId) || window.downloadManager.items.get(String(h.epId));
                if (dlItem && dlItem.poster) posterSrc = dlItem.poster;
            }
            if (!posterSrc && h.showId) {
                posterSrc = posterMapByShowId.get(String(h.showId)) || localStorage.getItem("slate_show_poster_" + String(h.showId)) || "";
            }
            if (!posterSrc) {
                const sName = extractSeriesName(h.title);
                if (sName) posterSrc = posterMapBySeriesName.get(sName.toLowerCase()) || "";
            }

            if (posterSrc) {
                h.image = posterSrc;
                try {
                    localStorage.setItem("slate_ep_poster_" + normEpId, posterSrc);
                    if (h.showId) localStorage.setItem("slate_show_poster_" + String(h.showId), posterSrc);
                } catch (e) {}
            }

            const card = document.createElement("div");
            card.className = "list-card history-card ios-glow";
            card.setAttribute("data-history-epid", normEpId);

            let innerHtml = `
                <div class="list-card-poster-wrap">
                    ${posterSrc ? `<img src="${posterSrc}" alt="${h.title || ''}" onerror="this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='flex';">` : ''}
                    <div class="list-card-placeholder" style="${posterSrc ? 'display:none;' : ''}">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
                        </svg>
                    </div>
                    <button class="history-delete-btn" title="حذف من السجل" onclick="event.stopPropagation(); removeHistoryCard('${normEpId}')">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    ${isCompleted ? '<div class="list-card-watched">' + checkSvg + '</div>' : ''}
                    ${!isCompleted && progress > 0 ? `<div class="list-card-progress"><div class="list-card-progress-fill" style="width:${progress}%"></div></div>` : ''}
                </div>
                <div class="list-card-title">${h.title || 'فيديو'}</div>
            `;
            card.innerHTML = innerHtml;
            card.addEventListener("click", () => {
                if (window.downloadManager && (window.downloadManager.items.has(normEpId) || window.downloadManager.items.has(String(h.epId)))) {
                    openPlayer(h.title, normEpId, posterSrc);
                } else if (h.showId && String(h.showId) !== normEpId) {
                    openDetails(h.showId, h.title, posterSrc);
                } else {
                    openPlayer(h.title, normEpId, posterSrc);
                }
            });
            listGrid.appendChild(card);
        });
    }

    const imgPromises = [];
    listGrid.querySelectorAll("img").forEach(img => {
        if (!img.complete) {
            imgPromises.push(new Promise(resolve => {
                img.onload = resolve;
                img.onerror = resolve;
            }));
        }
    });

    await Promise.all(imgPromises);
    listLoader.classList.add("hidden");
    listGrid.style.opacity = "1";
}

document.getElementById("favBtn")?.addEventListener("click", () => openListScreen("fav"));
document.getElementById("historyBtn")?.addEventListener("click", () => openListScreen("history"));
document.getElementById("listBackBtn")?.addEventListener("click", () => document.body.classList.remove("list-open"));

function formatDuration(sec) {
    if (!sec || isNaN(sec)) return "";
    const mins = Math.round(sec / 60);
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hrs > 0) return hrs + "س " + remMins + "د";
    return mins + "د";
}

const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");
const scrollInner = document.getElementById("scrollInner");
const searchClearBtn = document.getElementById("searchClearBtn");
let debounceTimer;

let lastSearchOpenTime = 0;

function openSearchMode() {
    document.querySelector(".search-screen")?.classList.add("search-focused");
    lastSearchOpenTime = Date.now();
}
window.openSearchMode = openSearchMode;

function closeSearchMode() {
    if (searchInput) {
        searchInput.value = "";
        searchInput.blur();
    }
    if (searchClearBtn) searchClearBtn.style.display = "none";
    if (searchResults) searchResults.classList.remove("active");
    document.querySelector(".search-screen")?.classList.remove("has-results", "search-focused");
    if (scrollInner) scrollInner.innerHTML = "";
}
window.closeSearchMode = closeSearchMode;

window.__onNativeKeyboardChanged = function(visible, heightDp) {
    const isKeyboardOpen = visible || (heightDp > 40);
    const kh = isKeyboardOpen ? (heightDp || 280) : 0;
    document.documentElement.style.setProperty('--keyboard-height', kh + 'px');
    
    if (isKeyboardOpen) {
        document.body.classList.add("keyboard-visible");
    } else {
        document.body.classList.remove("keyboard-visible");
    }
};

if (searchClearBtn) {
    searchClearBtn.addEventListener("click", function(e) {
        e.stopPropagation();
        if (searchInput) {
            searchInput.value = "";
            searchInput.focus();
        }
        searchClearBtn.style.display = "none";
        if (searchResults) searchResults.classList.remove("active");
        document.querySelector(".search-screen")?.classList.remove("has-results");
        if (scrollInner) scrollInner.innerHTML = "";
    });
}

const searchContainer = document.querySelector(".search-container");
const searchWrapper = document.querySelector(".search-wrapper");

if (searchWrapper) {
    searchWrapper.addEventListener("click", function(e) {
        e.stopPropagation();
    });
}

if (searchContainer) {
    searchContainer.addEventListener("click", function(e) {
        e.stopPropagation();
        if (e.target !== searchClearBtn && !searchClearBtn?.contains(e.target)) {
            openSearchMode();
            if (searchInput && document.activeElement !== searchInput) {
                searchInput.focus();
            }
        }
    });
}

if (searchInput) {
    searchInput.addEventListener("focus", function() {
        openSearchMode();
    });

    searchInput.addEventListener("input", function(e) {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();
        
        if (searchClearBtn) {
            searchClearBtn.style.display = query.length > 0 ? "flex" : "none";
        }

        if (query.length === 0) {
            if (searchResults) searchResults.classList.remove("active");
            document.querySelector(".search-screen")?.classList.remove("has-results");
            if (scrollInner) scrollInner.innerHTML = "";
            return;
        }

        openSearchMode();
        if (scrollInner) scrollInner.innerHTML = '<div style="text-align: center; color: #8E8E93; padding: 25px;"><div class="loader-spinner" style="margin: 0 auto 10px; scale: 0.7;"><div class="loader-dot"></div><div class="loader-dot"></div><div class="loader-dot"></div><div class="loader-dot"></div><div class="loader-dot"></div></div>جاري البحث...</div>';
        if (searchResults) searchResults.classList.add("active");
        document.querySelector(".search-screen")?.classList.add("has-results");

        debounceTimer = setTimeout(async () => {
            try {
                const res = await fetch("/search?term=" + encodeURIComponent(query));
                const data = await res.json();
                const results = data.results || data.data || data.shows || data.items || (Array.isArray(data) ? data : []);
                displayResults(results);
            } catch (err) {
                if (scrollInner) scrollInner.innerHTML = '<div style="text-align: center; color: #FF3B30; padding: 20px;">فشل الاتصال بالخادم. حاول مجدداً.</div>';
                if (searchResults) searchResults.classList.add("active");
                document.querySelector(".search-screen")?.classList.add("has-results");
            }
        }, 300);
    });

    searchInput.addEventListener("keydown", function(e) {
        if (e.key === "Enter") {
            searchInput.blur();
        }
    });
}

document.addEventListener("click", function(e) {
    if (Date.now() - lastSearchOpenTime < 500) {
        return; // Prevent ghost clicks / immediate close
    }
    if (document.body.classList.contains("details-open") ||
        document.body.classList.contains("list-open") ||
        document.body.classList.contains("eps-open") ||
        document.body.classList.contains("downloads-open")) {
        return;
    }
    if (!e.target.closest(".search-wrapper")) {
        if (searchInput && searchInput.value.trim().length === 0) {
            closeSearchMode();
        } else {
            if (searchResults) searchResults.classList.remove("active");
            document.querySelector(".search-screen")?.classList.remove("has-results");
        }
    }
});

function displayResults(results) {
    scrollInner.innerHTML = "";
    if (!results || results.length === 0) {
        scrollInner.innerHTML = '<div style="text-align: center; color: #8E8E93; padding: 30px 15px;">لا توجد نتائج مطابقة</div>';
        searchResults.classList.add("active");
        document.querySelector(".search-screen")?.classList.add("has-results");
        return;
    }
    results.forEach(item => {
        const resultItem = document.createElement("div");
        resultItem.classList.add("result-item");
        const posterUrl = (item.style && item.style.image) ? item.style.image : (item.poster || "https://via.placeholder.com/55x82");
        const metaType = (item.type === "SERIES" || item.type === "series" || item.type === "show") ? "مسلسل" : "فيلم";
        const isSeries = (item.type === "SERIES" || item.type === "series" || item.type === "show");
        const typeClass = isSeries ? "type-badge-series" : "type-badge-movie";
        const metaYear = item.year ? '<span class="result-year">' + item.year + '</span>' : "";
        
        resultItem.innerHTML = `
            <img src="${posterUrl}" class="result-poster" onerror="this.src='https://via.placeholder.com/55x82'">
            <div class="result-info">
                <div class="result-title">${item.title || "بدون عنوان"}</div>
                <div class="result-meta-container">
                    ${metaYear}
                    <span class="result-badge ${typeClass}">${metaType}</span>
                </div>
            </div>
            <div class="result-action-icon">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
            </div>
        `;
        
        resultItem.addEventListener("click", () => {
            closeSearchMode();
            openDetails(item.id, item.title, posterUrl);
        });
        scrollInner.appendChild(resultItem);
    });
    searchResults.classList.add("active");
    document.querySelector(".search-screen")?.classList.add("has-results");
}

function extractSeasonsAndEpisodes(data) {
    const seasons = [];
    const episodes = [];

    if (!data || !data.sections) return { seasons, episodes };

    data.sections.forEach(sec => {
        const secType = String(sec.section_type || "").toLowerCase();
        const secTitle = String(sec.title || "").toLowerCase();

        (sec.data || []).forEach(item => {
            const itemType = String(item.type || "").toLowerCase();

            if (itemType === "season" || secType.includes("season") || secTitle.includes("مواسم") || secTitle.includes("seasons")) {
                if (!seasons.some(s => String(s.id) === String(item.id) || s.title === item.title)) {
                    seasons.push(item);
                }
            } else if (itemType === "episode" || secType.includes("episode") || secTitle.includes("حلقات") || secTitle.includes("episodes")) {
                if (!episodes.some(e => String(e.id) === String(item.id))) {
                    episodes.push(item);
                }
            }
        });
    });

    if (seasons.length === 0 && episodes.length === 0) {
        data.sections.forEach(sec => {
            const secTitle = String(sec.title || "").toLowerCase();
            if (!secTitle.includes("مقترحات") && !secTitle.includes("suggestions")) {
                (sec.data || []).forEach(item => {
                    if (item.id && !episodes.some(e => String(e.id) === String(item.id))) {
                        episodes.push(item);
                    }
                });
            }
        });
    }

    return { seasons, episodes };
}

const detailsContent = document.getElementById("detailsContent");
const detailsLoader = document.getElementById("detailsLoader");
let currentItem = null;

async function openDetails(id, fallbackTitle, fallbackImg) {
    if (searchInput) searchInput.blur();
    if (searchResults) searchResults.classList.remove("active");
    document.querySelector(".search-screen")?.classList.remove("has-results", "search-focused");

    const detailsScreen = document.getElementById("details-screen");
    if (detailsScreen) detailsScreen.scrollTop = 0;

    currentItem = { id: id, title: fallbackTitle, style: { image: fallbackImg } };
    document.body.classList.remove("list-open");
    document.body.classList.add("details-open");
    detailsContent.classList.remove("visible");
    detailsLoader.classList.remove("hidden");

    document.getElementById("detailsBackdrop").src = "";
    document.getElementById("detailsPoster").src = "";

    try {
        const res = await fetch("/details?id=" + id);
        const data = await res.json();
        const info = data.post_info || {};

        const backdropUrl = info.background_image || info.image || fallbackImg;
        const posterUrl = info.image || fallbackImg;

        const imgPromises = [
            new Promise((resolve) => { 
                const img = new Image(); 
                img.onload = resolve; 
                img.onerror = resolve; 
                img.src = backdropUrl; 
            }),
            new Promise((resolve) => { 
                const img = new Image(); 
                img.onload = resolve; 
                img.onerror = resolve; 
                img.src = posterUrl; 
            })
        ];

        await Promise.all(imgPromises);

        document.getElementById("detailsBackdrop").src = backdropUrl;
        document.getElementById("detailsPoster").src = posterUrl;
        if (posterUrl) {
            try {
                localStorage.setItem("slate_show_poster_" + String(id), posterUrl);
            } catch (e) {}
        }
        if (currentItem && currentItem.style) {
            currentItem.style.image = posterUrl;
        }
        document.getElementById("detailsTitle").textContent = info.title || fallbackTitle;
        document.getElementById("detailsYear").textContent = new Date(parseInt(info.release_date)).getFullYear() || "";
        document.getElementById("detailsType").textContent = info.type === "SERIES" ? "مسلسل" : "فيلم";
        
        const durationBadge = document.getElementById("detailsDuration");
        if (info.type === "SERIES") {
            durationBadge.style.display = "none";
        } else {
            durationBadge.style.display = "inline-flex";
            durationBadge.textContent = formatDuration(info.length);
        }

        document.getElementById("detailsRating").textContent = info.rating?.value || "9.1";
        document.getElementById("detailsPlot").textContent = info.description || "لا يوجد وصف متاح حالياً.";
        document.getElementById("detailsViews").textContent = formatNumbers(info.views);
        document.getElementById("detailsLikes").textContent = formatNumbers(info.likes);

        const suggestionsList = document.getElementById("suggestionsList");
        suggestionsList.innerHTML = "";
        let suggestions = [];
        (data.sections || []).forEach(sec => {
            if (sec.title === "مقترحات" || sec.section_type === "normalPoster") suggestions = sec.data || [];
        });
        suggestions.slice(0, 10).forEach(sugg => {
            const card = document.createElement("div");
            card.classList.add("suggestion-card");
            card.innerHTML = '<img src="' + sugg.style?.image + '" class="suggestion-poster" onerror="this.src=\'https://via.placeholder.com/120x180\'"><div class="suggestion-title">' + sugg.title + '</div><div class="suggestion-year"></div>';
            card.addEventListener("click", () => openDetails(sugg.id, sugg.title, sugg.style?.image));
            suggestionsList.appendChild(card);
        });

        currentItem.type = info.type;
        currentItem.episode_id = info.episode_id;
        
        const parsed = extractSeasonsAndEpisodes(data);
        currentItem.seasons = parsed.seasons;
        currentItem.episodes = parsed.episodes;

        updateFavButton(id);

    } catch (err) {
        console.error(err);
    } finally {
        detailsLoader.classList.add("hidden");
        detailsContent.classList.add("visible");
    }
}

document.getElementById("favButton").addEventListener("click", () => {
    if (currentItem) toggleFavorite(currentItem);
});

document.getElementById("backButton").addEventListener("click", () => document.body.classList.remove("details-open", "eps-open"));

const epAnimeTitle = document.getElementById("epAnimeTitle");
const seasonsTabs = document.getElementById("seasonsTabs");
const episodesList = document.getElementById("episodesList");
const playButton = document.getElementById("playButton");

let currentPlayingSeasonId = null;
let currentPlayingSeasonTitle = null;

playButton.addEventListener("click", () => {
    if (!currentItem) return;

    if (currentItem.type === "MOVIE") {
        openPlayer(currentItem.title, currentItem.episode_id);
    } else if (currentItem.seasons.length > 0) {
        document.body.classList.add("eps-open");
        epAnimeTitle.textContent = currentItem.title;
        seasonsTabs.innerHTML = "";
        
        const watchedShow = getHistoryShow(currentItem.id);
        let activeSeasonId = currentItem.seasons[0].id;
        let activeSeasonIndex = 0;

        if (watchedShow && watchedShow.seasonId) {
            const foundIndex = currentItem.seasons.findIndex(s => s.id === watchedShow.seasonId);
            if (foundIndex !== -1) {
                activeSeasonIndex = foundIndex;
                activeSeasonId = watchedShow.seasonId;
            }
        }

        currentItem.seasons.forEach((season, index) => {
            const tab = document.createElement("div");
            tab.classList.add("season-tab");
            if (index === activeSeasonIndex) tab.classList.add("active");
            tab.textContent = season.title;
            tab.addEventListener("click", () => {
                document.querySelectorAll(".season-tab").forEach(t => t.classList.remove("active"));
                tab.classList.add("active");
                currentPlayingSeasonId = season.id;
                currentPlayingSeasonTitle = season.title;
                loadEpisodes(currentItem.id, season.id, watchedShow && watchedShow.seasonId === season.id ? watchedShow.epId : null);
            });
            seasonsTabs.appendChild(tab);
        });

        currentPlayingSeasonId = activeSeasonId;
        currentPlayingSeasonTitle = currentItem.seasons[activeSeasonIndex].title;

        const watchedEpId = (watchedShow && watchedShow.seasonId === activeSeasonId) ? watchedShow.epId : null;
        loadEpisodes(currentItem.id, activeSeasonId, watchedEpId);
    } else if (currentItem.episodes.length > 0) {
        document.body.classList.add("eps-open");
        epAnimeTitle.textContent = currentItem.title;
        seasonsTabs.innerHTML = "";
        renderEpisodes(currentItem.episodes);
    } else if (currentItem.episode_id) {
        openPlayer(currentItem.title, currentItem.episode_id);
    } else {
        alert("لا توجد حلقات أو روابط مشاهدة متاحة لهذا المحتوى.");
    }
});

function cleanEpisodeTitle(title) {
    if (!title) return "";
    let str = String(title).trim();
    
    str = str.replace(/الحلقة\s+episode\s*-\s*(\d+)\s+الحلقة\s+episode\s+\1/gi, "الحلقة $1");
    str = str.replace(/الحلقة\s+episode\s*-\s*(\d+)\s+الحلقة\s+episode\s*-\s*\1/gi, "الحلقة $1");
    str = str.replace(/الحلقة\s+(\d+)\s+الحلقة\s+\1/gi, "الحلقة $1");
    str = str.replace(/episode\s+(\d+)\s+episode\s+\1/gi, "الحلقة $1");
    str = str.replace(/الحلقة\s+الحلقة/g, "الحلقة");
    str = str.replace(/الحلقة\s+episode/gi, "الحلقة");
    str = str.replace(/episode\s*-\s*(\d+)/gi, "الحلقة $1");
    str = str.replace(/episode\s*(\d+)/gi, "الحلقة $1");
    str = str.replace(/الحلقة\s*-\s*(\d+)/g, "الحلقة $1");
    str = str.replace(/\s+/g, ' ').trim();
    
    if (/^\d+$/.test(str)) {
        str = "الحلقة " + str;
    }
    
    return str;
}

function renderEpisodes(episodes, watchedEpId = null) {
    try {
        window.currentSeasonEpisodes = episodes || [];
        episodesList.innerHTML = "";
        if (!episodes || episodes.length === 0) {
            episodesList.innerHTML = '<div style="color:#8E8E93;text-align:center;width:100%;grid-column:1/-1;padding:30px 0;">لا توجد حلقات متاحة.</div>';
            return;
        }
        const history = getHistory();
        const checkSvg = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>';

        episodes.forEach((ep, index) => {
            try {
                const watched = history.find(h => String(h.epId || h.id) === String(ep.id));
                const progress = (watched && watched.duration > 0) ? (watched.currentTime / watched.duration) * 100 : 0;
                const isCompleted = progress > 90;

                const existingDl = (window.downloadManager && window.downloadManager.items) ? (window.downloadManager.items.get(ep.id) || window.downloadManager.items.get(String(ep.id))) : null;
                const isNativeDownloaded = window.AndroidNative && window.AndroidNative.isDownloaded ? window.AndroidNative.isDownloaded(String(ep.id)) : false;
                let dlBtnClass = "ep-download-btn";
                let dlBtnIcon = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>';

                if (isNativeDownloaded || (existingDl && existingDl.status === "completed")) {
                    dlBtnClass += " completed";
                    dlBtnIcon = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>';
                } else if (existingDl && (existingDl.status === "downloading" || existingDl.status === "queued")) {
                    dlBtnClass += " downloading";
                }

                const card = document.createElement("div");
                card.classList.add("episode-card", "ios-glow");
                
                if (watchedEpId && String(ep.id) === String(watchedEpId) && !isCompleted) {
                    card.classList.add("currently-watching");
                }

                const cleanEpTitle = cleanEpisodeTitle(ep.title || (index + 1));
                const posterImg = (currentItem && currentItem.style && currentItem.style.image) ? currentItem.style.image : '';

                card.innerHTML = '<div class="ep-thumb" style="' + (posterImg ? 'background-image: url(\'' + posterImg + '\')' : '') + '">' +
                    (isCompleted ? '<div class="ep-watched">' + checkSvg + '</div>' : "") +
                    '<div class="ep-progress"><div class="ep-progress-fill" style="width:' + progress + '%"></div></div>' +
                    '</div>' +
                    '<div class="ep-info">' +
                    '<div class="ep-num">' + cleanEpTitle + '</div>' +
                    '<div class="ep-name">' + (ep.description || "حلقة") + '</div>' +
                    '</div>' +
                    '<button class="' + dlBtnClass + ' ios-glow" title="تحميل ' + cleanEpTitle + '">' +
                    dlBtnIcon +
                    '</button>';

                card.addEventListener("click", () => openPlayer(currentItem ? currentItem.title + " - " + cleanEpTitle : cleanEpTitle, ep.id));

                const dlBtn = card.querySelector(".ep-download-btn");
                if (dlBtn) {
                    dlBtn.addEventListener("click", (e) => {
                        e.stopPropagation();
                        if (typeof downloadEpisode === "function") {
                            downloadEpisode(ep, currentItem ? currentItem.title : "مسلسل", currentPlayingSeasonTitle);
                        } else if (window.downloadEpisode) {
                            window.downloadEpisode(ep, currentItem ? currentItem.title : "مسلسل", currentPlayingSeasonTitle);
                        }
                    });
                }

                episodesList.appendChild(card);
                
                if (watchedEpId && String(ep.id) === String(watchedEpId) && !isCompleted) {
                    setTimeout(() => {
                        card.scrollIntoView({ behavior: "smooth", block: "center" });
                    }, 300);
                }
            } catch (errItem) {
                console.error("Error rendering episode item:", errItem);
            }
        });
    } catch (errMain) {
        console.error("Error in renderEpisodes:", errMain);
        episodesList.innerHTML = '<div style="color:#FF3B30;text-align:center;width:100%;grid-column:1/-1;padding:30px 0;">حدث خطأ أثناء عرض الحلقات.</div>';
    }
}

async function loadEpisodes(showId, seasonId, watchedEpId = null) {
    episodesList.innerHTML = '<div style="color:#8E8E93;text-align:center;width:100%;grid-column:1/-1;padding:30px 0;">جاري التحميل...</div>';
    try {
        const res = await fetch("/details?id=" + showId + "&season_id=" + seasonId);
        const data = await res.json();
        const parsed = extractSeasonsAndEpisodes(data);
        let episodes = parsed.episodes;
        
        if (episodes.length === 0 && data.sections) {
            data.sections.forEach(sec => {
                if (sec.data && sec.data.length > 0 && sec.title !== "مقترحات") {
                    sec.data.forEach(item => {
                        if (item.id && !episodes.some(e => String(e.id) === String(item.id))) {
                            episodes.push(item);
                        }
                    });
                }
            });
        }
        renderEpisodes(episodes, watchedEpId);
    } catch (e) {
        console.error("loadEpisodes error:", e);
        episodesList.innerHTML = '<div style="color:#FF3B30;text-align:center;width:100%;grid-column:1/-1;padding:30px 0;">فشل تحميل الحلقات.</div>';
    }
}

document.getElementById("epBackButton")?.addEventListener("click", () => document.body.classList.remove("eps-open"));

const modalOverlay = document.getElementById("modalOverlay");
const modalBox = document.getElementById("modalBox");
document.getElementById("searchMenuBtn")?.addEventListener("click", () => {
    if (modalOverlay) modalOverlay.classList.add("active");
    if (modalBox) modalBox.style.transformOrigin = "top left";
    const sSec = document.getElementById("settingsSection");
    if (sSec) sSec.style.display = "block";
});
document.getElementById("detailsMenuBtn")?.addEventListener("click", () => {
    if (modalOverlay) modalOverlay.classList.add("active");
    if (modalBox) modalBox.style.transformOrigin = "top left";
    const sSec = document.getElementById("settingsSection");
    if (sSec) sSec.style.display = "block";
});
document.getElementById("modalCloseBtn")?.addEventListener("click", () => modalOverlay?.classList.remove("active"));
if (modalOverlay) {
    modalOverlay.addEventListener("click", (e) => { if (e.target === modalOverlay) modalOverlay.classList.remove("active"); });
}

document.getElementById("perfToggle")?.addEventListener("change", (e) => {
    if (e.target.checked) {
        document.body.classList.add("perf-mode");
        localStorage.setItem(PERF_KEY, "true");
    } else {
        document.body.classList.remove("perf-mode");
        localStorage.setItem(PERF_KEY, "false");
    }
});

document.getElementById("skipIntroToggle")?.addEventListener("change", (e) => {
    localStorage.setItem(SKIP_INTRO_KEY, e.target.checked);
});
document.getElementById("skipOutroToggle")?.addEventListener("change", (e) => {
    localStorage.setItem(SKIP_OUTRO_KEY, e.target.checked);
});
document.getElementById("skipCutsToggle")?.addEventListener("change", (e) => {
    localStorage.setItem(SKIP_CUTS_KEY, e.target.checked);
});

(function() {
    const originalFetch = window.fetch;

    window.CapacitorHttp = {
        get: function(options) {
            return new Promise((resolve, reject) => {
                const url = options.url;
                const headers = options.headers || {};
                const callId = 'req_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();

                if (!window.__nativeHttpCallbacks) {
                    window.__nativeHttpCallbacks = {};
                }

                const timeout = setTimeout(() => {
                    if (window.__nativeHttpCallbacks[callId]) {
                        delete window.__nativeHttpCallbacks[callId];
                        reject(new Error("تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت."));
                    }
                }, 15000);

                window.__nativeHttpCallbacks[callId] = function(success, status, data, error) {
                    clearTimeout(timeout);
                    delete window.__nativeHttpCallbacks[callId];
                    if (success) {
                        try {
                            const parsed = (typeof data === 'string') ? JSON.parse(data) : data;
                            resolve({ status: status, data: parsed });
                        } catch (e) {
                            resolve({ status: status, data: data });
                        }
                    } else {
                        reject(new Error(error || "تعذر الاتصال بالخادم."));
                    }
                };

                if (window.AndroidNative && window.AndroidNative.httpGet) {
                    try {
                        window.AndroidNative.httpGet(callId, url, JSON.stringify(headers));
                    } catch (e) {
                        clearTimeout(timeout);
                        delete window.__nativeHttpCallbacks[callId];
                        fallbackFetch();
                    }
                } else {
                    fallbackFetch();
                }

                function fallbackFetch() {
                    const controller = new AbortController();
                    const fetchTimeout = setTimeout(() => controller.abort(), 15000);
                    originalFetch(url, { headers: { ...headers, "User-Agent": "Mozilla/5.0" }, signal: controller.signal })
                        .then(r => r.json())
                        .then(d => {
                            clearTimeout(fetchTimeout);
                            resolve({ status: 200, data: d });
                        })
                        .catch(err => {
                            clearTimeout(fetchTimeout);
                            reject(new Error("تعذر الاتصال بالخادم."));
                        });
                }
            });
        }
    };

    window.__nativeHttpCallback = function(callId, success, status, data, error) {
        if (window.__nativeHttpCallbacks && window.__nativeHttpCallbacks[callId]) {
            window.__nativeHttpCallbacks[callId](success, status, data, error);
        }
    };

    window.fetch = async function(url, options) {
        if (typeof url === 'string') {
            let directUrl = url;
            let isAlbox = false;
            let isSubtitle = false;

            if (url.startsWith('/search')) {
                const query = new URLSearchParams(url.split('?')[1] || '').get('term') || '';
                directUrl = `https://cinema.albox.co/api/v4/search?term=${encodeURIComponent(query)}&page_number=1&page_size=10`;
                isAlbox = true;
            } else if (url.startsWith('/details')) {
                const params = new URLSearchParams(url.split('?')[1] || '');
                const showId = params.get('id') || '';
                const seasonId = params.get('season_id');
                directUrl = `https://cinema.albox.co/api/v4/shows/shows/dynamic/${showId}`;
                if (seasonId) directUrl += `?season_id=${seasonId}`;
                isAlbox = true;
            } else if (url.startsWith('/files')) {
                const epId = new URLSearchParams(url.split('?')[1] || '').get('ep_id') || '';
                directUrl = `https://cinema.albox.co/api/v4/shows/episodes/${epId}/files`;
                isAlbox = true;
            } else if (url.startsWith('/subtitle')) {
                const subUrl = new URLSearchParams(url.split('?')[1] || '').get('url') || '';
                directUrl = decodeURIComponent(subUrl);
                isSubtitle = true;
            } else if (url.includes('cinema.albox.co')) {
                isAlbox = true;
            }

            if (isAlbox || isSubtitle) {
                try {
                    const res = await window.CapacitorHttp.get({
                        url: directUrl,
                        headers: { "User-Agent": "Mozilla/5.0" }
                    });
                    const responseData = res.data;
                    const responseText = (typeof responseData === 'string') ? responseData : JSON.stringify(responseData);
                    return {
                        ok: res.status >= 200 && res.status < 300,
                        status: res.status,
                        json: async () => (typeof responseData === 'object' ? responseData : JSON.parse(responseText)),
                        text: async () => responseText,
                        blob: async () => new Blob([responseText], { type: isSubtitle ? 'text/vtt' : 'application/json' })
                    };
                } catch (err) {
                    showRegionErrorToast(err.message || "تعذر الاتصال بالمكتبة. الخدمة قد تطلب التواجد داخل العراق.");
                    throw err;
                }
            }
        }
        return originalFetch.apply(this, arguments);
    };

    function showRegionErrorToast(msg) {
        let toast = document.getElementById('region-error-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'region-error-toast';
            toast.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:#FF3B30;color:#fff;padding:12px 24px;border-radius:25px;font-size:14px;font-weight:600;z-index:9999;box-shadow:0 4px 15px rgba(0,0,0,0.5);text-align:center;max-width:90%;font-family:inherit;transition:opacity 0.3s;pointer-events:none;';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.opacity = '1';
        clearTimeout(window.__toastTimer);
        window.__toastTimer = setTimeout(() => {
            if (toast) toast.style.opacity = '0';
        }, 4000);
    }
})();
