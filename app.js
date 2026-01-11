// sMV Digital Jukebox
// - Uses YouTube IFrame API for reliable play/pause + auto-next
// - Autoplay is blocked by many browsers unless user interacts

const state = {
  catalog: [],
  filtered: [],
  currentIndex: 0,
  currentFilter: 'all',
  userStarted: false,
  playerReady: false,
};

const els = {
  nowPlaying: null,
  library: null,
  record: null,
  btnBar: null,
};

let player = null;

function cleanTitle(t) {
  if (!t) return '';
  return t
    .replace(/\s*#\w+/g, '')
    .replace(/\s*\|\s*sMV.*$/i, '')
    .replace(/\s*sMV\s*short\s*music\s*videos\s*/ig, '')
    .replace(/\s*me\s*t\s*x\s*/ig, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function matchesFilter(title, filterName) {
  const t = (title || '').toLowerCase();
  switch (filterName) {
    case 'all':
      return true;
    case 'alt-hip-hop':
      return t.includes('hip hop') || t.includes('hip-hop') || t.includes('trap');
    case 'alt-rock':
      return t.includes('rock');
    case 'alt-pop':
      return t.includes('pop');
    case 'reggae':
      return t.includes('reggae');
    case 'punk-pop':
      return (t.includes('punk') && t.includes('pop')) || t.includes('punk-pop');
    case 'edm':
      return t.includes('edm') || t.includes('electronic') || t.includes('house') || t.includes('techno');
    case 'future-pop':
      return t.includes('future pop') || t.includes('future-pop') || t.includes('futurepop');
    case 'country':
      return t.includes('country');
    case 'mix':
      return t.includes('mix') || t.includes('playlist') || t.includes('radio');
    default:
      return true;
  }
}

function applyFilter(filterName) {
  state.currentFilter = filterName;
  state.filtered = state.catalog.filter(v => matchesFilter(v.title, filterName));
  if (state.filtered.length === 0) {
    // fall back gracefully
    state.filtered = state.catalog.slice(0);
  }
  state.currentIndex = 0;
  renderLibrary();
  loadIndex(0, /*autoplay*/ false);
}

function setNowPlaying(text) {
  if (els.nowPlaying) els.nowPlaying.textContent = text;
}

function highlightTile() {
  const tiles = els.library?.querySelectorAll('.tile');
  if (!tiles) return;
  tiles.forEach((t, i) => t.classList.toggle('active', i === state.currentIndex));
  // keep active in view
  const active = tiles[state.currentIndex];
  if (active) active.scrollIntoView({ block: 'nearest' });
}

function renderLibrary() {
  if (!els.library) return;
  els.library.innerHTML = '';

  state.filtered.forEach((v, i) => {
    const tile = document.createElement('div');
    tile.className = 'tile';

    const img = document.createElement('img');
    img.alt = cleanTitle(v.title);
    img.src = `https://img.youtube.com/vi/${v.id}/hqdefault.jpg`;

    const title = document.createElement('div');
    title.className = 't';
    title.textContent = cleanTitle(v.title) || v.title;

    tile.appendChild(img);
    tile.appendChild(title);

    tile.addEventListener('click', () => {
      state.currentIndex = i;
      loadIndex(i, /*autoplay*/ true);
    });

    els.library.appendChild(tile);
  });

  highlightTile();
}

function spinRecord(isSpinning) {
  if (!els.record) return;
  els.record.classList.toggle('spinning', !!isSpinning);
}

function ensureUserStarted() {
  if (state.userStarted) return;
  state.userStarted = true;
  if (els.overlay) els.overlay.classList.add('hide');
}

function loadIndex(idx, autoplay) {
  if (!state.playerReady || !player) return;
  const v = state.filtered[idx];
  if (!v) return;

  setNowPlaying(`Now Playing: ★ ${cleanTitle(v.title) || v.title}`);
  highlightTile();

  // cue video first; then optionally play
  player.cueVideoById({ videoId: v.id });

  // Some browsers need a short delay before playVideo after cueVideoById
  if (autoplay) {
    ensureUserStarted();
    setTimeout(() => {
      try { player.playVideo(); } catch (e) {}
    }, 120);
  } else {
    spinRecord(false);
  }
}

function nextVideo(autoplay = true) {
  if (!state.filtered.length) return;
  state.currentIndex = (state.currentIndex + 1) % state.filtered.length;
  loadIndex(state.currentIndex, autoplay);
}

function togglePlayPause() {
  if (!state.playerReady || !player) return;
  ensureUserStarted();

  const st = player.getPlayerState();
  // -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
  if (st === 1 || st === 3) {
    player.pauseVideo();
  } else {
    player.playVideo();
  }
}

function onPlayerStateChange(event) {
  const s = event.data;
  if (s === YT.PlayerState.PLAYING) {
    spinRecord(true);
  }
  if (s === YT.PlayerState.PAUSED || s === YT.PlayerState.CUED) {
    spinRecord(false);
  }
  if (s === YT.PlayerState.ENDED) {
    spinRecord(false);
    nextVideo(true);
  }
}

async function loadCatalog() {
  // Prefer the clean JSON (relative file). If missing, fall back to a tiny stub.
  try {
    const res = await fetch('smv_catalog_clean.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('catalog fetch failed');
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('catalog is not an array');
    state.catalog = data.filter(x => x && x.id);
  } catch (e) {
    state.catalog = [
      { title: 'sMV Short Music Videos', id: 'J7jlx50LEj4' },
    ];
  }

  // Default view
  state.filtered = state.catalog.slice(0);
}

function wireUI() {  els.nowPlaying = document.getElementById('nowPlaying');
  els.library = document.getElementById('library');
  els.record = document.getElementById('record');
  els.btnBar = document.getElementById('btnBar');
  els.playBtn = document.getElementById('powerBtn');

  // Record + video area click = play/pause
  els.record?.addEventListener('click', togglePlayPause);

  // Play button (below record)
  els.playBtn?.addEventListener('click', togglePlayPause);

  // Big player area click
  const playerArea = document.getElementById('playerArea');
  playerArea?.addEventListener('click', togglePlayPause);

  // Overlay click also starts

  // Buttons
  const buttons = document.querySelectorAll('[data-filter]');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const f = btn.getAttribute('data-filter') || 'all';
      applyFilter(f);
      buttons.forEach(b => b.classList.toggle('active', b === btn));
    });
  });
}

function createPlayer() {
  player = new YT.Player('ytPlayer', {
    height: '100%',
    width: '100%',
    videoId: (state.filtered[0] && state.filtered[0].id) ? state.filtered[0].id : 'J7jlx50LEj4',
    playerVars: {
      playsinline: 1,
      rel: 0,
      modestbranding: 1,
      autoplay: 0,
      controls: 1,
    },
    events: {
      onReady: () => {
        state.playerReady = true;
        // Cue the first video; user gesture will start playback.
        loadIndex(0, /*autoplay*/ false);
      },
      onStateChange: onPlayerStateChange,
    }
  });
}

// YouTube API hook
window.onYouTubeIframeAPIReady = async function () {
  await loadCatalog();
  wireUI();
  renderLibrary();
  createPlayer();
};

// Load YT IFrame API
(function loadYT(){
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
})();
