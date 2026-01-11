/* sMV Digital Jukebox
   - YouTube IFrame API player
   - Record click toggles play/pause
   - Playlist buttons filter the catalog
   - Auto-plays next track when video ends
*/

const state = {
  catalog: [],
  currentList: [],
  currentIndex: 0,
  playerReady: false,
  playing: false,
  currentFilter: 'catalog'
};

const el = {
  nowPlaying: document.getElementById('nowTitle'),
  library: document.getElementById('library'),
  btnCatalog: document.getElementById('btnCatalog'),
  btnHipHop: document.getElementById('btnHipHop'),
  btnRock: document.getElementById('btnRock'),
  btnPop: document.getElementById('btnPop'),
  btnPower: document.getElementById('btnPower'),
  recordBtn: document.getElementById('recordBtn')
};

function cleanTitle(t){
  if(!t) return '';
  let s = String(t);
  // remove common suffixes
  s = s.replace(/\s*#music\s*#musicvideos?.*$/i,'');
  s = s.replace(/\s*sMV\s*short\s*Music\s*Videos\b.*$/i,'');
  s = s.replace(/\s*\|\s*sMV\b.*$/i,'');
  s = s.replace(/[“”]/g,'"');
  s = s.trim();
  // remove trailing punctuation
  s = s.replace(/[\s\-–—:]+$/,'');
  return s;
}

async function loadCatalog(){
  try{
    const res = await fetch('assets/smv_catalog_clean.json', { cache: 'no-store' });
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.SMV_CATALOG || data.entries || []);
    state.catalog = (list || []).map(x => ({
      id: x.id || x.videoId || x.video_id,
      title: cleanTitle(x.title || x.name || '')
    })).filter(x => x.id);
  }catch(err){
    console.warn('Could not load catalog JSON. Using fallback list.', err);
    state.catalog = [
      { title: 'My Archetype', id: 'jT-sSi0qVzA' },
      { title: 'Leave a Legacy', id: '2HmUn5GlHLY' },
      { title: "I'm Not a DJ", id: '0FEhI1lvaCM' }
    ];
  }
}

function setActiveButtons(activeBtn){
  const btns = [el.btnCatalog, el.btnHipHop, el.btnRock, el.btnPop, el.btnPower];
  btns.forEach(b => b?.classList.remove("active"));
  if(activeBtn) activeBtn.classList.add("active");
}

function applyFilter(kind){
  // Power Station: we try to surface mixes/episodes from the catalog by keyword.
  // If you want this button to open a specific YouTube playlist instead,
  // replace POWER_STATION_URL and uncomment the window.open line.
  const POWER_STATION_URL = "https://www.youtube.com/@sMVshortMusicVideos";
  if(kind === 'power'){
    // window.open(POWER_STATION_URL, '_blank');
    const powerish = state.catalog.filter(v => /power station|mix|episode|radio/i.test(v.title));
    const list = powerish.length ? powerish : state.catalog;
    setList(list);
    if(list[0]) setPlayerVideo(list[0].id, 0);
    setActiveButtons(el.btnPower);
    return;
  }
  state.currentFilter = kind;

  let list = [...state.catalog];

  // Very light keyword-based grouping (works immediately, no extra metadata needed).
  if(kind === 'althiphop'){
    list = list.filter(v => /hip\s*hop|rap|trap|drill/i.test(v.title));
  }
  if(kind === 'altrock'){
    list = list.filter(v => /rock|guitar|alt\s*rock|punk|metal/i.test(v.title));
  }
  if(kind === 'altpop'){
    list = list.filter(v => /pop|alt\s*pop|dance|club|synth/i.test(v.title));
  }

  // If a filter returns empty, fall back to full catalog so the UI never looks broken.
  if(list.length === 0) list = [...state.catalog];

  setList(list);
}

function setList(list){
  state.currentList = list;
  state.currentIndex = 0;
  renderLibrary();
  if(state.currentList[0]){
    loadVideoByIndex(0);
  }
}

function thumbUrl(id){
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

function renderLibrary(){
  el.library.innerHTML = '';
  state.currentList.forEach((v, idx) => {
    const tile = document.createElement('div');
    tile.className = 'tile' + (idx === state.currentIndex ? ' active' : '');
    tile.innerHTML = `
      <img src="${thumbUrl(v.id)}" alt="${(v.title||'Video').replace(/"/g,'&quot;')}">
      <div class="t-title">${escapeHtml(v.title || 'Untitled')}</div>
    `;
    tile.addEventListener('click', () => loadVideoByIndex(idx));
    el.library.appendChild(tile);
  });
}

function escapeHtml(str){
  return String(str||'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

function loadVideoByIndex(idx){
  if(!state.currentList[idx]) return;
  state.currentIndex = idx;
  renderLibrary();

  const v = state.currentList[idx];
  el.nowPlaying.textContent = v.title || 'Now Playing';

  if(state.playerReady && window.ytPlayer){
    window.ytPlayer.loadVideoById(v.id);
    // start spinning immediately; YT may take a moment to begin
    setSpinning(true);
  }else{
    // If player not ready yet, set initial id to load on ready
    window.__pendingVideoId = v.id;
  }
}

function playNext(){
  if(state.currentList.length === 0) return;
  const next = (state.currentIndex + 1) % state.currentList.length;
  loadVideoByIndex(next);
}

function setSpinning(on){
  state.playing = !!on;
  if(state.playing) el.recordBtn.classList.add('spinning');
  else el.recordBtn.classList.remove('spinning');
}

function togglePlayPause(){
  if(!state.playerReady || !window.ytPlayer) return;
  const st = window.ytPlayer.getPlayerState?.();

  // 1 = playing, 2 = paused, 5 = video cued
  if(st === 1){
    window.ytPlayer.pauseVideo();
  }else{
    window.ytPlayer.playVideo();
  }
}

// --- YouTube IFrame API ---
window.onYouTubeIframeAPIReady = function(){
  window.ytPlayer = new YT.Player('player', {
    videoId: (state.currentList[0]?.id || window.__pendingVideoId || 'J7jlx50LEj4'),
    playerVars: {
      playsinline: 1,
      rel: 0,
      modestbranding: 1
    },
    events: {
      onReady: () => {
        state.playerReady = true;
        // If we had a pending id before player was ready
        if(window.__pendingVideoId){
          window.ytPlayer.loadVideoById(window.__pendingVideoId);
          window.__pendingVideoId = null;
        }
      },
      onStateChange: (e) => {
        // 0 ended, 1 playing, 2 paused
        if(e.data === 1) setSpinning(true);
        if(e.data === 2) setSpinning(false);
        if(e.data === 0){
          setSpinning(false);
          playNext();
        }
      }
    }
  });
};

// --- Init ---
(async function init(){
  await loadCatalog();
  setList(state.catalog);

  // Buttons
  el.btnCatalog.addEventListener('click', () => { setActiveButtons(el.btnCatalog); applyFilter('catalog'); });
  el.btnHipHop.addEventListener('click', () => { setActiveButtons(el.btnHipHop); applyFilter('althiphop'); });
  el.btnRock.addEventListener('click', () => { setActiveButtons(el.btnRock); applyFilter('altrock'); });
  el.btnPop.addEventListener('click', () => { setActiveButtons(el.btnPop); applyFilter('altpop'); });
  el.btnPower.addEventListener('click', () => { setActiveButtons(el.btnPower); applyFilter('power'); });

  // Record toggles playback
  el.recordBtn.addEventListener('click', togglePlayPause);

  // Load YouTube API
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);

  setActiveButtons(el.btnCatalog);
})();
