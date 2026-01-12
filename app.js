
const CATALOG_URL = "./smv_catalog_clean.json";

const filtersEl = document.getElementById("filters");
const libraryEl = document.getElementById("library");
const recordBtn = document.getElementById("recordBtn");
const playBtn = document.getElementById("playBtn");
const nowPlayingEl = document.getElementById("nowPlaying");

(function initBars(){
  const bars = document.getElementById("bars");
  if (!bars) return;
  bars.innerHTML = "";
  const count = 72;
  for (let i = 0; i < count; i++){
    const b = document.createElement("div");
    b.className = "bar";
    const h = 6 + Math.floor(Math.random() * 14);
    b.style.height = `${h}px`;
    b.style.opacity = `${0.65 + Math.random()*0.35}`;
    bars.appendChild(b);
  }
})();

(function initRecordCenter(){
  const center = document.createElement("div");
  center.className = "recordCenter";
  center.innerHTML = `<img src="power_station_center.svg" alt="Power Station">`;
  recordBtn.appendChild(center);
})();

function cleanTitle(title){
  if (!title) return "";
  return String(title)
    .replace(/\s*#.+$/g, "")
    .replace(/\s*sMV short Music Videos.*$/i, "")
    .replace(/\s*Me T\s*x\s*sMV short Music Videos.*$/i, "")
    .replace(/[“”]/g, '"')
    .trim();
}

const FILTERS = [
  { key: "all", label: "All", match: () => true },
  { key: "mix", label: "Power Station Mix", match: (t) => /mix/i.test(t) },
  { key: "reggae", label: "Reggae", match: (t) => /reggae/i.test(t) },
  { key: "punkpop", label: "Punk Pop", match: (t) => /punk\s*pop|punkpop/i.test(t) },
  { key: "edm", label: "EDM", match: (t) => /\bedm\b/i.test(t) },
  { key: "futurepop", label: "Future Pop", match: (t) => /future\s*pop|futurepop/i.test(t) },
  { key: "country", label: "Country", match: (t) => /country/i.test(t) },
  { key: "altrock", label: "Alt Rock", match: (t) => /alt\s*rock|alternative\s*rock/i.test(t) },
  { key: "althiphop", label: "Alt Hip Hop", match: (t) => /alt\s*hip\s*hop|alternative\s*hip\s*hop|alt\s*hiphop/i.test(t) },
  { key: "latest", label: "Latest Alternative", match: (t) => /latest/i.test(t) },
];

let fullCatalog = [];
let currentList = [];
let currentIndex = 0;
let currentFilter = "all";

let player = null;
let apiReady = false;
let pendingVideoId = null;

window.onYouTubeIframeAPIReady = function(){
  apiReady = true;
  player = new YT.Player("player", {
    height: "100%",
    width: "100%",
    videoId: "",
    playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
    events: {
      onReady: () => {
        if (pendingVideoId){
          player.cueVideoById(pendingVideoId);
          pendingVideoId = null;
        }
      },
      onStateChange: (e) => {
        if (e.data === YT.PlayerState.PLAYING){
          recordBtn.classList.add("spinning");
          playBtn.textContent = "Pause";
        } else if (e.data === YT.PlayerState.PAUSED){
          recordBtn.classList.remove("spinning");
          playBtn.textContent = "Play";
        } else if (e.data === YT.PlayerState.ENDED){
          recordBtn.classList.remove("spinning");
          playBtn.textContent = "Play";
          playNext();
        }
      }
    }
  });
};

function setNowPlaying(){
  const v = currentList[currentIndex];
  nowPlayingEl.textContent = v ? `• Now playing: ${cleanTitle(v.title)}` : "";
}

function cueVideo(id){
  if (!id) return;
  if (apiReady && player && player.cueVideoById){
    player.cueVideoById(id);
  } else {
    pendingVideoId = id;
  }
}

function playVideo(id){
  if (!id) return;
  if (apiReady && player && player.loadVideoById){
    player.loadVideoById(id);
  } else {
    pendingVideoId = id;
  }
}

function togglePlay(){
  if (!apiReady || !player) return;
  const state = player.getPlayerState();
  if (state === YT.PlayerState.PLAYING){
    player.pauseVideo();
  } else {
    const v = currentList[currentIndex];
    if (v && state === YT.PlayerState.UNSTARTED){
      player.loadVideoById(v.id);
      return;
    }
    player.playVideo();
  }
}

recordBtn.addEventListener("click", togglePlay);
playBtn.addEventListener("click", togglePlay);

function playNext(){
  if (!currentList.length) return;
  currentIndex = (currentIndex + 1) % currentList.length;
  setNowPlaying();
  playVideo(currentList[currentIndex].id);
}

function buildFilters(){
  filtersEl.innerHTML = "";
  FILTERS.forEach(f => {
    const btn = document.createElement("button");
    btn.className = "chip" + (f.key === currentFilter ? " active" : "");
    btn.textContent = f.label;
    btn.addEventListener("click", () => {
      currentFilter = f.key;
      [...filtersEl.querySelectorAll(".chip")].forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
      applyFilter();
    });
    filtersEl.appendChild(btn);
  });
}

function applyFilter(){
  const fil = FILTERS.find(x => x.key === currentFilter) || FILTERS[0];
  currentList = fullCatalog.filter(v => fil.match(v.title || ""));
  if (currentList.length === 0) currentList = [...fullCatalog];
  currentIndex = 0;
  renderLibrary();
  setNowPlaying();
  cueVideo(currentList[0]?.id);
}

function renderLibrary(){
  libraryEl.innerHTML = "";
  currentList.forEach((v, idx) => {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.innerHTML = `
      <img src="https://img.youtube.com/vi/${v.id}/hqdefault.jpg" alt="">
      <div class="tileTitle">${cleanTitle(v.title) || "Untitled"}</div>
    `;
    tile.addEventListener("click", () => {
      currentIndex = idx;
      setNowPlaying();
      playVideo(v.id);
    });
    libraryEl.appendChild(tile);
  });
}

async function loadCatalog(){
  const res = await fetch(CATALOG_URL, { cache: "no-store" });
  const data = await res.json();
  fullCatalog = (Array.isArray(data) ? data : []).filter(x => x && x.id);
  buildFilters();
  applyFilter();
}

loadCatalog().catch(err => {
  console.error(err);
  libraryEl.innerHTML = `<div style="padding:14px;color:rgba(255,255,255,.8)">Could not load catalog. Put <b>smv_catalog_clean.json</b> in the same folder.</div>`;
});
