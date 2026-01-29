// STATE
let selectedApps = []; 
let weatherConfig = { useAuto: false, lat: null, lon: null, city: "Select Location" };

// INITIALIZATION
document.addEventListener('DOMContentLoaded', async () => {
    const data = await chrome.storage.local.get(['savedApps', 'weatherConfig', 'wallpaper']);
    
    if (data.savedApps) selectedApps = data.savedApps;
    if (data.weatherConfig) weatherConfig = data.weatherConfig;
    if (data.wallpaper) document.body.style.backgroundImage = `url('${data.wallpaper}')`;

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
    if (weatherConfig.useAuto && "geolocation" in navigator) {
         navigator.geolocation.getCurrentPosition(async pos => {
            await fetchWeather(pos.coords.latitude, pos.coords.longitude);
        }, () => el.textContent = "GPS Denied.");
    } else if (weatherConfig.lat) {
        await fetchWeather(weatherConfig.lat, weatherConfig.lon);
    } else {
        el.textContent = "Tap settings to setup weather";
    }
}

async function fetchWeather(lat, lon) {
    try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const data = await res.json();
        const temp = Math.round(data.current_weather.temperature);
        const condition = getWeatherString(data.current_weather.weathercode);
        document.getElementById('weather').textContent = `${temp}°C · ${condition}`;
    } catch (e) { document.getElementById('weather').textContent = "Weather Error"; }
}

function renderAppList() {
    const appContainer = document.getElementById('app-list');
    const favContainer = document.getElementById('favorites');
    const alphabetContainer = document.getElementById('alphabet-scroll');
    
    appContainer.innerHTML = '';
    favContainer.innerHTML = '';
    alphabetContainer.innerHTML = '';

    if (selectedApps.length === 0) {
        appContainer.innerHTML = '<div style="opacity:0.5; padding:20px;">No apps. Click ⚙ to add some.</div>';
        return;
    }

    selectedApps.sort((a, b) => a.title.localeCompare(b.title));

    // Favorites (First 3)
    selectedApps.slice(0, 3).forEach(app => {
        const a = document.createElement('a');
        a.className = 'fav-item';
        a.textContent = app.title;
        a.href = app.url;
        favContainer.appendChild(a);
    });

    // All Apps
    selectedApps.forEach(app => {
        const a = document.createElement('a');
        a.className = 'app-item';
        a.textContent = app.title;
        a.href = app.url;
        a.dataset.letter = app.title.charAt(0).toUpperCase();
        appContainer.appendChild(a);
    });

    // Alphabet
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

/* --- SETTINGS LOGIC --- */
function initSettings() {
    const modal = document.getElementById('settings-modal');
    
    // Toggle
    const toggle = () => {
        if (modal.classList.contains('hidden')) {
            loadBookmarkTree();
            renderActiveAppsList(); // New: Show active apps management
            modal.classList.remove('hidden');
        } else {
            modal.classList.add('hidden');
            renderAppList();
        }
    };
    document.getElementById('settings-btn').onclick = toggle;
    document.getElementById('close-settings').onclick = toggle;

    // 1. ADD CUSTOM APP
    document.getElementById('btn-add-custom').onclick = () => {
        const nameInput = document.getElementById('custom-name');
        const urlInput = document.getElementById('custom-url');
        const status = document.getElementById('add-status');
        
        const name = nameInput.value.trim();
        let url = urlInput.value.trim();

        if (!name || !url) {
            status.textContent = "Please enter both name and URL.";
            return;
        }

        // Auto-add https:// if missing
        if (!/^https?:\/\//i.test(url)) {
            url = 'https://' + url;
        }

        selectedApps.push({ title: name, url: url });
        chrome.storage.local.set({ savedApps: selectedApps });
        
        nameInput.value = '';
        urlInput.value = '';
        status.textContent = `Added ${name}!`;
        renderActiveAppsList(); // Refresh the list below
    };

    // 2. WALLPAPER & LOCATIONS
    const fileInput = document.getElementById('wallpaper-input');
    document.getElementById('btn-upload-bg').onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            chrome.storage.local.set({ wallpaper: ev.target.result });
            document.body.style.backgroundImage = `url('${ev.target.result}')`;
            document.getElementById('status-msg').textContent = "Wallpaper updated";
        };
        if(e.target.files[0]) reader.readAsDataURL(e.target.files[0]);
    };

    document.getElementById('btn-reset-bg').onclick = () => {
        chrome.storage.local.remove('wallpaper');
        document.body.style.backgroundImage = '';
    };

    document.getElementById('btn-auto-loc').onclick = () => {
        weatherConfig.useAuto = true;
        chrome.storage.local.set({ weatherConfig });
        renderWeather();
        document.getElementById('status-msg').textContent = "Set to Auto GPS";
    };

    document.getElementById('btn-manual-loc').onclick = async () => {
        const q = document.getElementById('manual-loc-input').value;
        if(!q) return;
        const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${q}&count=1&language=en&format=json`);
        const data = await res.json();
        if(data.results?.[0]) {
            const loc = data.results[0];
            weatherConfig = { useAuto:false, lat:loc.latitude, lon:loc.longitude, city:loc.name };
            chrome.storage.local.set({ weatherConfig });
            renderWeather();
            document.getElementById('status-msg').textContent = `Found ${loc.name}`;
        }
    };
}

// Render the list of apps inside Settings so users can delete them
function renderActiveAppsList() {
    const container = document.getElementById('active-apps-list');
    container.innerHTML = '';
    
    // Sort for easier finding
    const sorted = [...selectedApps].sort((a,b) => a.title.localeCompare(b.title));

    sorted.forEach(app => {
        const div = document.createElement('div');
        div.className = 'bm-item';
        div.style.justifyContent = 'space-between';

        const span = document.createElement('span');
        span.textContent = app.title;
        
        const delBtn = document.createElement('button');
        delBtn.textContent = "✕";
        delBtn.style.background = "transparent";
        delBtn.style.color = "#ff5555";
        delBtn.style.padding = "2px 8px";
        
        delBtn.onclick = () => {
            // Remove from array
            selectedApps = selectedApps.filter(a => a.url !== app.url);
            chrome.storage.local.set({ savedApps: selectedApps });
            renderActiveAppsList(); // Re-render this list
            loadBookmarkTree(); // Re-render bookmarks (to uncheck boxes)
        };

        div.appendChild(span);
        div.appendChild(delBtn);
        container.appendChild(div);
    });
}

function loadBookmarkTree() {
    const container = document.getElementById('bookmark-picker');
    container.innerHTML = 'Loading recent...';
    chrome.bookmarks.getRecent(50, (items) => {
        container.innerHTML = '';
        items.forEach(bm => {
            if (!bm.url) return;
            const div = document.createElement('div');
            div.className = 'bm-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            // Check if URL is in selectedApps
            if (selectedApps.some(a => a.url === bm.url)) checkbox.checked = true;
            
            checkbox.onchange = () => {
                if (checkbox.checked) {
                    if (!selectedApps.some(a => a.url === bm.url)) {
                        selectedApps.push({ title: bm.title, url: bm.url });
                    }
                } else {
                    selectedApps = selectedApps.filter(a => a.url !== bm.url);
                }
                chrome.storage.local.set({ savedApps: selectedApps });
                renderActiveAppsList(); // Sync the active list
            };

            const label = document.createElement('span');
            label.textContent = bm.title.length > 25 ? bm.title.substring(0,25)+'...' : bm.title;
            
            div.appendChild(checkbox);
            div.appendChild(label);
            container.appendChild(div);
        });
    });
}

function getWeatherString(code) {
    if (code === 0) return "Clear";
    if (code < 3) return "Clouds";
    if (code < 50) return "Fog";
    if (code < 80) return "Rain";
    if (code < 95) return "Storm";
    return "Snow";
}
