/* sMV Digital Jukebox - lightweight, GitHub Pages friendly (no build tools). */

const yt = document.getElementById("yt");
const library = document.getElementById("library");
const songTitle = document.getElementById("songTitle");
const songMeta = document.getElementById("songMeta");
const count = document.getElementById("count");
const libTitle = document.getElementById("libTitle");
const record = document.getElementById("record");
const powerLink = document.getElementById("powerLink");

let currentList = [];
let currentIndex = 0;
let isPlaying = false;

// Update these as you decide what to feature.
const LINKS = {
  powerStation: "https://www.youtube.com/@sMVshortMusicVideos", // placeholder
  mixes: "https://www.youtube.com/@sMVshortMusicVideos" // placeholder
};

// --- Playlist logic (filters over SMV_CATALOG for now) ---
function getPlaylist(name){
  const all = (window.SMV_CATALOG || []).filter(v => v.title && v.id);

  if(name === "latest"){
    return all.slice(0, 60); // assumes your exported list is newest-first
  }

  if(name === "altrock"){
    return all.filter(v => /rock|guitar|riff|solo/i.test(v.title)).slice(0, 90);
  }

  if(name === "althiphop"){
    return all.filter(v => /hip hop|rap|bars|flow|mc/i.test(v.title)).slice(0, 90);
  }

  if(name === "power"){
    // Keep the library visible but also point the Power Station button somewhere useful.
    powerLink.href = LINKS.mixes;
    return all.slice(0, 60);
  }

  // default: full catalog
  powerLink.href = LINKS.powerStation;
  return all;
}

function setPlayerVideo(id){
  // Important: must be /embed/ not watch?v=
  yt.src = `https://www.youtube.com/embed/${id}?playsinline=1&rel=0&modestbranding=1&autoplay=0`;
}

function renderLibrary(list){
  library.innerHTML = "";
  currentList = list;
  count.textContent = `${list.length.toLocaleString()} tracks`;

  list.forEach((v, idx) => {
    const div = document.createElement("div");
    div.className = "tile";
    div.innerHTML = `
      <img src="https://img.youtube.com/vi/${v.id}/hqdefault.jpg" alt="">
      <div class="t">${escapeHtml(v.title)}</div>
    `;
    div.onclick = () => {
      currentIndex = idx;
      selectIndex(idx, true);
    };
    library.appendChild(div);
  });

  // select first
  currentIndex = 0;
  selectIndex(0, false);
}

function selectIndex(idx, scrollIntoView){
  const v = currentList[idx];
  if(!v) return;

  // UI state
  [...library.children].forEach((el,i)=> el.classList.toggle("active", i===idx));
  songTitle.textContent = v.title;
  songMeta.textContent = `YouTube ID: ${v.id}`;
  setPlayerVideo(v.id);

  // stop the "spinning" indicator until user presses record
  setPlaying(false);

  if(scrollIntoView){
    library.children[idx]?.scrollIntoView({block:"nearest", inline:"nearest"});
  }
}

function setPlaying(on){
  isPlaying = on;
  record.classList.toggle("spin", on);
  // Note: controlling play/pause inside an iframe reliably requires the YouTube IFrame API.
  // For Gen-1 we keep it simple: the record is a "start/stop vibe" indicator and focuses the player.
}

function toggleRecord(){
  // Simple UX: first click = start vibe + autofocus player; second click = stop vibe.
  // Real play/pause control can be added later with the YouTube IFrame API.
  setPlaying(!isPlaying);
  yt.focus();
}

record.addEventListener("click", toggleRecord);

document.querySelectorAll(".btn[data-pl]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".btn[data-pl]").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const pl = btn.getAttribute("data-pl");
    libTitle.textContent = btn.textContent;
    renderLibrary(getPlaylist(pl));
  });
});

// helpers
function escapeHtml(str){
  return (str || "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"
  }[c]));
}

// boot
powerLink.href = LINKS.powerStation;
renderLibrary(getPlaylist("catalog"));
