/* sMV Digital Jukebox Prototype v2
   - YouTube video plays in center (large)
   - Right library uses thumbnails + loads into same player
   - Record spins while playing, stops when paused
   - Clicking record toggles play/pause
   - Playlist filter buttons repopulate the library
*/

const CONFIG = {
  // Put your real Power Station playlist ID here when ready:
  // Example: "PLxxxxxxxxxxxxxxxxxxxxxxxx"
  powerStationPlaylistId: "",

  // If you have a live stream video ID later, drop it here:
  liveStreamVideoId: "",
};

// Accepts a YouTube video ID ("J7jlx50LEj4") or a full URL and returns the 11-char ID.
function extractYouTubeId(input) {
  if (!input) return "";
  const s = String(input).trim();

  // Already an ID?
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;

  // Full URL cases
  try {
    const url = new URL(s);

    // watch?v=ID
    const v = url.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

    // youtu.be/ID
    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.replace("/", "").slice(0, 11);
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }

    // /embed/ID
    const embedMatch = url.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
    if (embedMatch) return embedMatch[1];
  } catch (e) {
    // Not a URL; fall through
  }

  // "watch?v=ID" fragment or other text containing v=ID
  const m = s.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];

  return "";
}

const GROUPS = {
  all: [
    { title: "Karaoke Star", id: "yG9wva7HXNk", sub: "Vocal Training" },
    { title: "Pour It Out", id: "P5bYISMcgEo", sub: "Vocal Training" },
    { title: "Popping Up", id: "YwMTFUi8zng", sub: "Vocal Training" },
    { title: "Listen to My Words", id: "-nPDgB8NYUQ", sub: "Vocal Training" },
    // add more here
  ],
  karaoke: [
    { title: "Karaoke Star", id: "yG9wva7HXNk", sub: "Flagship" },
    { title: "Pour It Out", id: "P5bYISMcgEo", sub: "Vocal Training" },
    { title: "Popping Up", id: "YwMTFUi8zng", sub: "Vocal Training" },
    { title: "Listen to My Words", id: "-nPDgB8NYUQ", sub: "Vocal Training" },
  ],
  power: [
    // These can be mixes or related videos; for now we reuse:
    { title: "Power Station (coming soon)", id: "yG9wva7HXNk", sub: "Placeholder" },
  ],
  new: [
    { title: "New Drops (coming soon)", id: "P5bYISMcgEo", sub: "Placeholder" },
  ],
  live: [
    { title: "Live / Radio (coming soon)", id: "YwMTFUi8zng", sub: "Placeholder" },
  ]
};

let currentFilter = "all";
let currentList = [...GROUPS[currentFilter]];
let currentVideoId = extractYouTubeId(currentList[0]?.id) || "";
let currentVideoTitle = currentList[0]?.title || "—";

const libEl = document.getElementById("videoLibrary");
const nowPlayingTitleEl = document.getElementById("nowPlayingTitle");
const statusHintEl = document.getElementById("statusHint");
const searchInput = document.getElementById("searchInput");
const recordBtn = document.getElementById("recordBtn");
const openBtn = document.getElementById("openOnYouTubeBtn");
const powerStationBtn = document.getElementById("powerStationBtn");

function ytThumb(id){ return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`; }

function setHint(msg){
  statusHintEl.textContent = msg;
}

function setNowPlaying(title){
  nowPlayingTitleEl.textContent = title || "—";
}

function renderLibrary(list){
  libEl.innerHTML = list.map(v => `
    <div class="videoTile ${v.id === currentVideoId ? "isActive" : ""}" data-id="${v.id}" data-title="${escapeHtml(v.title)}">
      <div class="videoThumb"><img src="${ytThumb(extractYouTubeId(v.id) || v.id)}" alt="${escapeHtml(v.title)}"></div>
      <div class="videoMeta">
        <div class="videoTitle">${escapeHtml(v.title)}</div>
        <div class="videoSub">${escapeHtml(v.sub || "")}</div>
      </div>
    </div>
  `).join("");
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, s => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[s]));
}

function applyFilter(filterKey){
  currentFilter = filterKey;
  currentList = [...(GROUPS[filterKey] || GROUPS.all)];
  const q = (searchInput.value || "").trim().toLowerCase();
  const list = q ? currentList.filter(v => v.title.toLowerCase().includes(q)) : currentList;

  // keep current selection if it exists in the new list
  if(!list.some(v => extractYouTubeId(v.id) === currentVideoId)){
    currentVideoId = list[0]?.id || "";
    currentVideoTitle = list[0]?.title || "—";
    setNowPlaying(currentVideoTitle);
  }
  renderLibrary(list);
}

function applySearch(){
  const q = (searchInput.value || "").trim().toLowerCase();
  const base = [...(GROUPS[currentFilter] || GROUPS.all)];
  const list = q ? base.filter(v => v.title.toLowerCase().includes(q)) : base;
  renderLibrary(list);
}

document.querySelectorAll(".pill").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".pill").forEach(b => b.classList.remove("isActive"));
    btn.classList.add("isActive");
    applyFilter(btn.dataset.filter);
  });
});

searchInput.addEventListener("input", () => applySearch());

libEl.addEventListener("click", (e) => {
  const tile = e.target.closest(".videoTile");
  if(!tile) return;
  const id = tile.dataset.id;
  const title = tile.dataset.title || "—";
  loadVideoById(id, title);
});

/* -------------------- YouTube Player (IFrame API) -------------------- */

let player = null;
let ytReady = false;

window.onYouTubeIframeAPIReady = function(){
  player = new YT.Player("ytPlayer", {
    videoId: currentVideoId || "",
    playerVars: {
      rel: 0,
      modestbranding: 1,
      playsinline: 1
    },
    events: {
      onReady: () => {
        ytReady = true;
        setNowPlaying(currentVideoTitle);
        setHint("Ready. Pick a song on the right.");
      },
      onStateChange: onPlayerStateChange
    }
  });
};

function onPlayerStateChange(event){
  // YT.PlayerState: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
  const s = event.data;

  if(s === YT.PlayerState.PLAYING){
    recordBtn.classList.add("isSpinning");
    setHint("Playing… click the record to pause.");
  }else if(s === YT.PlayerState.PAUSED){
    recordBtn.classList.remove("isSpinning");
    setHint("Paused. Click the record to play.");
  }else if(s === YT.PlayerState.ENDED){
    recordBtn.classList.remove("isSpinning");
    setHint("Ended. Pick another track.");
  }else if(s === YT.PlayerState.BUFFERING){
    setHint("Buffering…");
  }
}

function loadVideoById(id, title){
  const vid = extractYouTubeId(id);
  if(!vid){
    setHint("That video link/ID can’t be embedded. Try another.");
    return;
  }
  currentVideoId = vid;
  currentVideoTitle = decodeHtml(title);
  setNowPlaying(currentVideoTitle);

  // update active tile styling
  document.querySelectorAll(".videoTile").forEach(t => t.classList.toggle("isActive", t.dataset.id === id));

  if(ytReady && player && typeof player.loadVideoById === "function"){
    player.loadVideoById(vid);
  }else{
    setHint("Player not ready yet…");
  }
}

function decodeHtml(str){
  const txt = document.createElement("textarea");
  txt.innerHTML = str;
  return txt.value;
}

/* Record button toggles play/pause */
recordBtn.addEventListener("click", () => {
  if(!ytReady || !player) return;

  const state = player.getPlayerState();
  if(state === YT.PlayerState.PLAYING){
    player.pauseVideo();
  }else{
    // If nothing loaded yet, load the first
    if(!currentVideoId){
      currentVideoId = extractYouTubeId((GROUPS[currentFilter]?.[0]?.id) || (GROUPS.all?.[0]?.id) || "");
    }
    player.playVideo();
  }
});

/* Open current video on YouTube */
openBtn.addEventListener("click", () => {
  if(!currentVideoId) return;
  window.open(`https://www.youtube.com/watch?v=${currentVideoId}`, "_blank", "noopener,noreferrer");
});

/* Power Station button loads playlist into same player area */
powerStationBtn.addEventListener("click", () => {
  if(!ytReady || !player) return;

  const pl = (CONFIG.powerStationPlaylistId || "").trim();
  const liveId = (CONFIG.liveStreamVideoId || "").trim();

  if(pl){
    // Use cuePlaylist + play for reliable behavior
    player.cuePlaylist({ listType: "playlist", list: pl });
    player.playVideo();
    setNowPlaying("Power Station Playlist");
    setHint("Power Station playlist loaded.");
    return;
  }

  if(liveId){
    loadVideoById(liveId, "Live Stream");
    return;
  }

  // fallback (no playlist configured yet)
  setHint("Power Station playlist not set yet. Add CONFIG.powerStationPlaylistId in app.js.");
});

/* -------------------- Fake EQ Visualizer in banner -------------------- */

const eqCanvas = document.getElementById("eqCanvas");
const eqCtx = eqCanvas.getContext("2d", { alpha: true });

function resizeEQ(){
  const dpr = window.devicePixelRatio || 1;
  const rect = eqCanvas.getBoundingClientRect();
  eqCanvas.width = Math.max(1, Math.floor(rect.width * dpr));
  eqCanvas.height = Math.max(1, Math.floor(rect.height * dpr));
  eqCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resizeEQ);
resizeEQ();

let t = 0;

function drawEQ(){
  const rect = eqCanvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;

  eqCtx.clearRect(0,0,w,h);

  // subtle glow band
  const grad = eqCtx.createLinearGradient(0,0,w,0);
  grad.addColorStop(0, "rgba(120,60,255,.18)");
  grad.addColorStop(.5,"rgba(0,200,255,.18)");
  grad.addColorStop(1, "rgba(255,80,200,.14)");
  eqCtx.fillStyle = grad;
  eqCtx.fillRect(0,0,w,h);

  const bars = 78;
  const gap = 3;
  const barW = (w - gap*(bars+1)) / bars;
  const mid = h * 0.70;
  const maxAmp = h * 0.42;

  for(let i=0;i<bars;i++){
    const x = gap + i*(barW+gap);

    const phase = (i / bars) * Math.PI * 2;
    const wave =
      Math.sin(t + phase*1.2) * 0.55 +
      Math.sin(t*0.72 + phase*2.6) * 0.28;

    const jitter = (Math.random() - 0.5) * 0.08;
    const amp = (0.18 + (wave + 1)/2 * 0.82 + jitter) * maxAmp;

    const y = mid - amp;
    eqCtx.fillStyle = "rgba(255,255,255,.35)";
    eqCtx.fillRect(x, y, barW, amp);

    eqCtx.fillStyle = "rgba(255,255,255,.55)";
    eqCtx.fillRect(x, y, barW, 2);
  }

  t += 0.06;
  requestAnimationFrame(drawEQ);
}
drawEQ();

/* First render */
applyFilter("all");
setNowPlaying(currentVideoTitle);
