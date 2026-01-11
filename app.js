
/* sMV Digital Jukebox (Gen-3)
   - Uses SMV_CATALOG from smv_catalog.js
   - Clean titles
   - Chunky "wave" bars travel left->right (not audio-derived)
   - YouTube IFrame API for play/pause control
*/

const $ = (id) => document.getElementById(id);

const recordEl = $("record");
const nowPlayingEl = $("nowPlaying");
const gridEl = $("grid");
const navRowEl = $("navRow");
const searchEl = $("search");
const countNoteEl = $("countNote");
const powerBtn = $("powerBtn");

const EQ_BAR_COUNT = 48;
const EQ_STEP_LEVELS = 7; // chunky
const EQ_MAX_H = 26;

let eqPhase = 0;
let eqAnimating = false;

// ---- Title cleanup (display only)
function cleanTitle(title) {
  return (title || "")
    .replace(/\s*#.+$/g, "") // remove hashtags onward
    .replace(/\s*[-–|]\s*sMV.*$/i, "") // trailing " - sMV ..." or "| sMV ..."
    .replace(/\s*sMV short Music Videos.*$/i, "")
    .replace(/\s*Me T x\s*/i, "")
    .replace(/[“”]/g, '"')
    .trim();
}

// ---- Data
const CATALOG = (typeof SMV_CATALOG !== "undefined" && Array.isArray(SMV_CATALOG)) ? SMV_CATALOG : [];
// default slices for now (swap these later with real playlist exports)
const PLAYLISTS = {
  all: CATALOG,
  latest: CATALOG.slice(0, 60),
  altrock: CATALOG.filter(v => /rock/i.test(v.title)).slice(0, 60),
  althiphop: CATALOG.filter(v => /hip hop|rap/i.test(v.title)).slice(0, 60),
  power: CATALOG.slice(0, 40),
};

const NAV = [
  { key: "all", label: "All" },
  { key: "latest", label: "Latest" },
  { key: "altrock", label: "Alt Rock" },
  { key: "althiphop", label: "Alt Hip Hop" },
  { key: "power", label: "Power Station" },
];

let activeKey = "all";
let activeList = PLAYLISTS[activeKey] || [];
let activeVideo = null;

let ytPlayer = null;
let ytReady = false;
let isPlaying = false;

// ---- EQ bars (left->right wave, chunky steps)
function initEqBars() {
  const wrap = $("eqBars");
  wrap.innerHTML = "";
  for (let i = 0; i < EQ_BAR_COUNT; i++) {
    const b = document.createElement("div");
    b.className = "eqBar";
    b.style.height = "6px";
    wrap.appendChild(b);
  }
}

function quantize(val, levels) {
  const step = 1 / (levels - 1);
  return Math.round(val / step) * step;
}

function tickEq() {
  if (!eqAnimating) return;
  eqPhase += 0.09; // speed
  const bars = $("eqBars").children;

  for (let i = 0; i < bars.length; i++) {
    // traveling wave: phase shifts across index
    const x = (i / EQ_BAR_COUNT) * Math.PI * 2;
    const wave = (Math.sin(eqPhase - x * 2.2) + 1) / 2; // 0..1
    const wobble = (Math.sin(eqPhase * 1.7 + i * 0.35) + 1) / 2;
    let v = (wave * 0.78 + wobble * 0.22);
    v = quantize(v, EQ_STEP_LEVELS);
    const h = 4 + v * (EQ_MAX_H - 4);
    bars[i].style.height = `${h}px`;
    bars[i].style.opacity = (0.65 + v * 0.35).toFixed(2);
  }

  requestAnimationFrame(tickEq);
}

function setEqAnimating(on) {
  if (on && !eqAnimating) {
    eqAnimating = true;
    requestAnimationFrame(tickEq);
  } else if (!on) {
    eqAnimating = false;
  }
}

// ---- UI
function renderNav() {
  navRowEl.innerHTML = "";
  NAV.forEach(item => {
    const btn = document.createElement("div");
    btn.className = "pill" + (item.key === activeKey ? " active" : "");
    btn.textContent = item.label;
    btn.onclick = () => {
      activeKey = item.key;
      document.querySelectorAll(".pill").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      activeList = PLAYLISTS[activeKey] || [];
      searchEl.value = "";
      renderGrid(activeList);
      // auto-load first track if none
      if (activeList[0]) selectVideo(activeList[0]);
    };
    navRowEl.appendChild(btn);
  });
}

function thumbUrl(id) {
  // try maxres first; fall back via onerror handler
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

function renderGrid(list) {
  gridEl.innerHTML = "";
  const q = (searchEl.value || "").trim().toLowerCase();

  const filtered = q
    ? list.filter(v => cleanTitle(v.title).toLowerCase().includes(q))
    : list;

  countNoteEl.textContent = `${filtered.length} tracks`;

  filtered.forEach(v => {
    const tile = document.createElement("div");
    tile.className = "tile";
    const t = cleanTitle(v.title) || "Untitled";
    tile.innerHTML = `
      <img class="thumb" src="${thumbUrl(v.id)}" alt="">
      <div class="tileMeta">
        <div class="tileTitle">${escapeHtml(t)}</div>
        <div class="tileHint">Tap to play</div>
      </div>
    `;

    const img = tile.querySelector("img");
    img.onerror = () => {
      img.onerror = null;
      img.src = `https://img.youtube.com/vi/${v.id}/hqdefault.jpg`;
    };

    tile.onclick = () => selectVideo(v, true);
    gridEl.appendChild(tile);
  });
}

function escapeHtml(str) {
  return (str || "").replace(/[&<>"']/g, (m) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
}

// ---- YouTube IFrame API
function loadYouTubeAPI() {
  return new Promise((resolve) => {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    window.onYouTubeIframeAPIReady = () => resolve();
    document.head.appendChild(tag);
  });
}

function createPlayer(videoId) {
  if (!window.YT || !YT.Player) return;
  if (ytPlayer) {
    ytPlayer.loadVideoById(videoId);
    return;
  }

  ytPlayer = new YT.Player("ytApiMount", {
    width: "100%",
    height: "100%",
    videoId,
    playerVars: {
      autoplay: 1,
      playsinline: 1,
      rel: 0,
      modestbranding: 1,
      enablejsapi: 1
    },
    events: {
      onReady: () => {
        ytReady = true;
        isPlaying = true;
        recordEl.classList.add("recordSpin");
        setEqAnimating(true);
      },
      onStateChange: (e) => {
        // 1 playing, 2 paused, 0 ended
        if (e.data === YT.PlayerState.PLAYING) {
          isPlaying = true;
          recordEl.classList.add("recordSpin");
          setEqAnimating(true);
        }
        if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) {
          isPlaying = false;
          recordEl.classList.remove("recordSpin");
          setEqAnimating(false);
        }
      }
    }
  });
}

function selectVideo(v, autoplay = true) {
  activeVideo = v;
  const label = cleanTitle(v.title) || "Untitled";
  nowPlayingEl.textContent = label;

  // If API isn't ready yet, we still set activeVideo and let init create it.
  if (ytReady && ytPlayer) {
    if (autoplay) ytPlayer.loadVideoById(v.id);
    else ytPlayer.cueVideoById(v.id);
  } else {
    createPlayer(v.id);
  }
}

// ---- Record control
recordEl.addEventListener("click", () => {
  if (!ytPlayer || !ytReady) return;
  if (isPlaying) {
    ytPlayer.pauseVideo();
  } else {
    ytPlayer.playVideo();
  }
});

// ---- Search
searchEl.addEventListener("input", () => renderGrid(activeList));

// ---- Power button
powerBtn.addEventListener("click", () => {
  // You can change this later to your Power Station playlist/stream
  // For now, just opens your YouTube channel in a new tab
  window.open("https://www.youtube.com/@sMVshortMusicVideos", "_blank", "noopener,noreferrer");
});

// ---- Init
(function init() {
  initEqBars();
  renderNav();

  activeList = PLAYLISTS[activeKey] || [];
  renderGrid(activeList);

  // pick first
  if (activeList[0]) {
    nowPlayingEl.textContent = cleanTitle(activeList[0].title);
  }

  loadYouTubeAPI().then(() => {
    if (activeList[0]) selectVideo(activeList[0], true);
  });

  // if catalog is empty, show note
  if (!CATALOG.length) {
    countNoteEl.textContent = "No catalog loaded. Make sure smv_catalog.js is present and loaded before app.js.";
  }
})();
