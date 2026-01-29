// STATE
let selectedApps = []; 
let weatherConfig = { useAuto: false, lat: null, lon: null, city: "Select Location" };

// INITIALIZATION
document.addEventListener('DOMContentLoaded', async () => {
    // Load Saved Data
    const data = await chrome.storage.local.get(['savedApps', 'weatherConfig', 'wallpaper']);
    
    if (data.savedApps) selectedApps = data.savedApps;
    if (data.weatherConfig) weatherConfig = data.weatherConfig;
    
    // Apply Wallpaper immediately
    if (data.wallpaper) {
        document.body.style.backgroundImage = `url('${data.wallpaper}')`;
    }

    renderClock();
    renderWeather();
    renderAppList();
    initSettings();
    setInterval(renderClock, 1000);
});

/* --- CORE FEATURES --- */
function renderClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('clock').textContent = `${hours}:${minutes}`;
    
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    document.getElementById('date').textContent = now.toLocaleDateString('en-GB', options);
}

async function renderWeather() {
    const el = document.getElementById('weather');
    
    if (weatherConfig.useAuto) {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(async pos => {
                await fetchWeather(pos.coords.latitude, pos.coords.longitude);
            }, () => el.textContent = "GPS Denied. Tap to set manually.");
            return;
        }
    }

    if (weatherConfig.lat && weatherConfig.lon) {
        await fetchWeather(weatherConfig.lat, weatherConfig.lon);
    } else {
        el.textContent = "Tap to setup weather";
    }
}

async function fetchWeather(lat, lon) {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
        const res = await fetch(url);
        const data = await res.json();
        const temp = Math.round(data.current_weather.temperature);
        const condition = getWeatherString(data.current_weather.weathercode);
        document.getElementById('weather').textContent = `${temp}°C · ${condition}`;
    } catch (e) {
        console.error(e);
        document.getElementById('weather').textContent = "Weather Error";
    }
}

function renderAppList() {
    const appContainer = document.getElementById('app-list');
    const favContainer = document.getElementById('favorites');
    const alphabetContainer = document.getElementById('alphabet-scroll');
    
    appContainer.innerHTML = '';
    favContainer.innerHTML = '';
    alphabetContainer.innerHTML = '';

    if (selectedApps.length === 0) {
        appContainer.innerHTML = '<div style="opacity:0.5; padding:20px;">No apps selected. Click ⚙ below.</div>';
        return;
    }

    selectedApps.sort((a, b) => a.title.localeCompare(b.title));

    // Render Favorites (First 3)
    const favs = selectedApps.slice(0, 3);
    favs.forEach(app => {
        const a = document.createElement('a');
        a.className = 'fav-item';
        a.textContent = app.title;
        a.href = app.url;
        favContainer.appendChild(a);
    });

    // Render All
    selectedApps.forEach(app => {
        const a = document.createElement('a');
        a.className = 'app-item';
        a.textContent = app.title;
        a.href = app.url;
        a.dataset.letter = app.title.charAt(0).toUpperCase();
        appContainer.appendChild(a);
    });

    // Render Alphabet
    const letters = [...new Set(selectedApps.map(a => a.title.charAt(0).toUpperCase()))];
    letters.sort();
    letters.forEach(char => {
        const div = document.createElement('div');
        div.className = 'letter';
        div.textContent = char;
        div.onclick = () => {
            const target = document.querySelector(`.app-item[data-letter="${char}"]`);
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        };
        alphabetContainer.appendChild(div);
    });
}

/* --- SETTINGS, WALLPAPER & BOOKMARKS --- */
function initSettings() {
    const modal = document.getElementById('settings-modal');
    const btn = document.getElementById('settings-btn');
    const close = document.getElementById('close-settings');
    const weatherEl = document.getElementById('weather');

    // UI Toggles
    const toggle = () => {
        if (modal.classList.contains('hidden')) {
            loadBookmarkTree();
            modal.classList.remove('hidden');
        } else {
            modal.classList.add('hidden');
            renderAppList();
            renderWeather();
        }
    };

    btn.onclick = toggle;
    close.onclick = toggle;
    weatherEl.onclick = toggle;

    // --- Wallpaper Logic ---
    const fileInput = document.getElementById('wallpaper-input');
    const uploadBtn = document.getElementById('btn-upload-bg');
    const resetBtn = document.getElementById('btn-reset-bg');
    const bgStatus = document.getElementById('bg-status');

    uploadBtn.onclick = () => fileInput.click();

    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        bgStatus.textContent = "Processing...";
        const reader = new FileReader();
        
        reader.onload = function(event) {
            const base64String = event.target.result;
            // Save to storage
            chrome.storage.local.set({ wallpaper: base64String }, () => {
                document.body.style.backgroundImage = `url('${base64String}')`;
                bgStatus.textContent = "Wallpaper set!";
            });
        };
        reader.readAsDataURL(file);
    };

    resetBtn.onclick = () => {
        chrome.storage.local.remove('wallpaper', () => {
            document.body.style.backgroundImage = '';
            bgStatus.textContent = "Reset to dark theme.";
        });
    };

    // --- Location Logic ---
    document.getElementById('btn-auto-loc').onclick = () => {
        weatherConfig.useAuto = true;
        chrome.storage.local.set({ weatherConfig });
        document.getElementById('loc-status').textContent = "Set to Auto (GPS)";
    };

    document.getElementById('btn-manual-loc').onclick = async () => {
        const query = document.getElementById('manual-loc-input').value;
        if (!query) return;
        const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=1&language=en&format=json`);
        const data = await res.json();
        
        if (data.results && data.results.length > 0) {
            const loc = data.results[0];
            weatherConfig = { useAuto: false, lat: loc.latitude, lon: loc.longitude, city: loc.name };
            chrome.storage.local.set({ weatherConfig });
            document.getElementById('loc-status').textContent = `Found: ${loc.name}, ${loc.country}`;
        } else {
            document.getElementById('loc-status').textContent = "City not found.";
        }
    };
}

function loadBookmarkTree() {
    const container = document.getElementById('bookmark-picker');
    container.innerHTML = 'Loading...';
    chrome.bookmarks.getRecent(100, (items) => {
        container.innerHTML = '';
        items.forEach(bm => {
            if (!bm.url) return;
            const div = document.createElement('div');
            div.className = 'bm-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            if (selectedApps.find(a => a.url === bm.url)) checkbox.checked = true;
            
            checkbox.onchange = () => {
                if (checkbox.checked) {
                    if (!selectedApps.find(a => a.url === bm.url)) selectedApps.push({ title: bm.title, url: bm.url });
                } else {
                    selectedApps = selectedApps.filter(a => a.url !== bm.url);
                }
                chrome.storage.local.set({ savedApps: selectedApps });
            };

            const label = document.createElement('span');
            label.textContent = bm.title.length > 30 ? bm.title.substring(0,30)+'...' : bm.title;
            
            div.appendChild(checkbox);
            div.appendChild(label);
            container.appendChild(div);
        });
    });
}

function getWeatherString(code) {
    if (code === 0) return "Clear Sky";
    if (code < 3) return "Partly Cloudy";
    if (code < 50) return "Foggy";
    if (code < 60) return "Drizzle";
    if (code < 80) return "Rain";
    if (code < 85) return "Showers";
    if (code < 95) return "Thunderstorm";
    return "Snow/Other";
}
