let player;
let ui;
let controls;
let hls;
let currentChannels = [];
let activeChannelId = null;
let activeCategory = 'All';

const UI = {
    list: document.getElementById('channel-list'),
    search: document.getElementById('search-input'),
    name: document.getElementById('current-channel-name'),
    group: document.getElementById('current-channel-group'),
    error: document.getElementById('error-msg'),
    errorText: document.getElementById('error-text'),
    loader: document.getElementById('loading-overlay'),
    sidebar: document.getElementById('sidebar'),
    video: document.getElementById('video'),
    videoContainer: document.querySelector('.shaka-video-container'),
    toasts: document.getElementById('toast-container'),
    categoryContainer: document.getElementById('category-container')
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
    initPlayer();
    setupEvents();
    await fetchChannels();
}

function setupEvents() {
    UI.search?.addEventListener('input', () => {
        filterAndRender();
    });

    const fullscreenBtn = document.getElementById('fullscreen-btn');
    if (fullscreenBtn) {
        fullscreenBtn.onclick = () => {
            if (UI.videoContainer.requestFullscreen) UI.videoContainer.requestFullscreen();
            else if (UI.videoContainer.webkitRequestFullscreen) UI.videoContainer.webkitRequestFullscreen();
        };
    }
}

function initPlayer() {
    shaka.polyfill.installAll();
    if (!shaka.Player.isBrowserSupported()) {
        notify('Browser not supported', 'error');
        return;
    }

    player = new shaka.Player(UI.video);
    
    // Setup Shaka UI controls
    ui = new shaka.ui.Overlay(player, UI.videoContainer, UI.video);
    controls = ui.getControls();
    
    player.addEventListener('error', (e) => onError(e.detail));
    player.addEventListener('buffering', (e) => UI.loader.classList.toggle('hidden', !e.buffering));

    player.getNetworkingEngine().registerRequestFilter((type, request) => {
        if (!activeChannelId) return;
        let url = request.uris[0];
        if (!url) return;

        const channel = currentChannels.find(c => c.id === activeChannelId);
        if (!channel) return;

        if (url.startsWith(window.location.origin) && !url.includes('/proxy')) {
            const path = url.replace(window.location.origin, '');
            const base = channel.url.substring(0, channel.url.lastIndexOf('/') + 1);
            const corrected = new URL(path.startsWith('/') ? path.substring(1) : path, base).href;
            request.uris[0] = `${window.location.origin}/proxy?id=${activeChannelId}&url=${encodeURIComponent(corrected)}`;
        } else if (url.startsWith('http') && !url.includes('/proxy')) {
            request.uris[0] = `${window.location.origin}/proxy?id=${activeChannelId}&url=${encodeURIComponent(url)}`;
        }
    });
}

async function fetchChannels() {
    try {
        const res = await fetch('/api/channels');
        currentChannels = await res.json();
        renderCategories(currentChannels);
        filterAndRender();
    } catch (err) {
        UI.list.innerHTML = '<div class="p-4 text-xs text-neutral-600">Failed to load channels</div>';
    }
}

function renderCategories(channels) {
    if (!UI.categoryContainer) return;
    const categories = ['All', ...new Set(channels.map(c => c.group).filter(Boolean))];
    
    UI.categoryContainer.innerHTML = '';
    categories.forEach(cat => {
        const btn = document.createElement('button');
        const isActive = activeCategory === cat;
        btn.className = `px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 shrink-0 ${
            isActive 
                ? 'bg-white text-black shadow-md font-bold' 
                : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
        }`;
        btn.textContent = cat;
        btn.onclick = () => {
            activeCategory = cat;
            renderCategories(channels);
            filterAndRender();
        };
        UI.categoryContainer.appendChild(btn);
    });
}

function filterAndRender() {
    const searchVal = UI.search?.value.toLowerCase() || '';
    const filtered = currentChannels.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchVal) || c.group.toLowerCase().includes(searchVal);
        const matchesCategory = activeCategory === 'All' || c.group === activeCategory;
        return matchesSearch && matchesCategory;
    });
    renderChannels(filtered);
}

function renderChannels(channels) {
    UI.list.innerHTML = '';
    if (!channels.length) {
        UI.list.innerHTML = '<div class="p-4 text-xs text-neutral-600">No channels found</div>';
        return;
    }

    const frag = document.createDocumentFragment();
    channels.forEach(c => {
        const el = document.createElement('div');
        const active = activeChannelId === c.id;
        el.className = `group flex items-center gap-3.5 p-3 rounded-xl cursor-pointer transition-all duration-200 border border-transparent ${
            active 
                ? 'bg-neutral-900 border-l-4 border-white pl-2 text-white font-medium shadow-md' 
                : 'hover:bg-neutral-900/50 hover:border-neutral-800/50 text-neutral-300'
        }`;
        
        const fallbackIcon = `<div class="w-full h-full bg-neutral-800 flex items-center justify-center rounded"><svg class="w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg></div>`;
        const imgHtml = c.image ? `<img src="${c.image}" class="w-full h-full object-contain" alt="${c.name}" onerror="this.parentElement.innerHTML='${fallbackIcon}'">` : fallbackIcon;

        el.innerHTML = `
            <div class="w-10 h-7 shrink-0 bg-white rounded flex items-center justify-center overflow-hidden">
                ${imgHtml}
            </div>
            <div class="flex-1 min-w-0">
                <div class="text-xs font-semibold truncate ${active ? 'text-white' : 'text-neutral-300 group-hover:text-white'}">${c.name}</div>
                <div class="text-[10px] text-neutral-500 truncate uppercase tracking-tighter">${c.group}</div>
            </div>
            <div class="text-[8px] font-black opacity-30 uppercase">${c.type}</div>
        `;
        
        el.onclick = () => play(c);
        frag.appendChild(el);
    });
    UI.list.appendChild(frag);
}

async function play(channel) {
    if (activeChannelId === channel.id) return;
    activeChannelId = channel.id;

    // UI Updates
    filterAndRender();
    UI.name.textContent = channel.name;
    UI.group.textContent = channel.group;
    UI.error.classList.add('hidden');
    UI.loader.classList.remove('hidden');

    const proxy = `${window.location.origin}/proxy?id=${channel.id}&url=${encodeURIComponent(channel.url)}`;

    if (hls) hls.destroy();
    if (player) await player.unload();

    try {
        if (channel.type === 'dash' || channel.type === 'dash-clearkey') {
            await playDash(proxy, channel.key);
        } else if (channel.type === 'hls') {
            playHls(proxy);
        } else {
            await player.load(proxy);
        }
        notify(`Streaming ${channel.name}`, 'success');
    } catch (e) {
        onError(e);
    }
}

async function playDash(url, key) {
    player.configure({ drm: { clearKeys: {} } });
    if (key) {
        const match = key.match(/^([0-9a-f]{32}):([0-9a-f]{32})$/i);
        if (match) {
            player.configure({ drm: { clearKeys: { [match[1]]: match[2] } } });
        } else if (key.startsWith('ey')) {
            const d = JSON.parse(atob(key));
            if (d.keys?.[0]) {
                const kid = hex(d.keys[0].kid);
                const k = hex(d.keys[0].k);
                if (kid && k) player.configure({ drm: { clearKeys: { [kid]: k } } });
            }
        }
    }
    await player.load(url);
    UI.video.play().catch(() => {});
}

function playHls(url) {
    if (Hls.isSupported()) {
        hls = new Hls();
        hls.loadSource(url);
        hls.attachMedia(UI.video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => UI.video.play().catch(() => {}));
    } else if (UI.video.canPlayType('application/vnd.apple.mpegurl')) {
        UI.video.src = url;
    }
}

function onError(err) {
    console.error(err);
    UI.error.classList.remove('hidden');
    UI.loader.classList.add('hidden');
    UI.errorText.textContent = `Error: ${err.message || err.code || 'Playback failed'}`;
    notify('Playback failed', 'error');
}

function notify(msg, type = 'info') {
    const el = document.createElement('div');
    const bg = type === 'error' ? 'bg-red-900 border-red-800' : type === 'success' ? 'bg-neutral-100 !text-black border-white' : 'bg-neutral-900 border-neutral-800';
    el.className = `${bg} border px-4 py-3 rounded-lg text-xs font-bold shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-2 pointer-events-auto`;
    el.innerHTML = `<i data-lucide="${type === 'error' ? 'alert-circle' : 'info'}" class="w-4 h-4"></i> ${msg}`;
    UI.toasts.appendChild(el);
    lucide.createIcons();
    setTimeout(() => {
        el.classList.add('animate-out', 'fade-out', 'slide-out-to-bottom-2');
        setTimeout(() => el.remove(), 300);
    }, 3000);
}

function hex(b64u) {
    try {
        let b64 = b64u.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';
        const bin = atob(b64);
        let h = '';
        for (let i = 0; i < bin.length; i++) {
            let s = bin.charCodeAt(i).toString(16);
            h += s.length === 1 ? '0' + s : s;
        }
        return h;
    } catch { return null; }
}
