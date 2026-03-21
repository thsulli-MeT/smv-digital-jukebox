const STORAGE_KEY = "smv-playlist-jukebox-stations";
const DEFAULT_SOURCE_URL = "https://www.youtube.com/@sMVshortMusicVideos/playlists";

const DEFAULT_STATIONS = [
  {
    id: "station-starter-1",
    title: "Starter Station Template",
    description: "Replace this with a real sMV playlist URL after copying one from the channel playlists page.",
    playlistId: "",
    playlistUrl: DEFAULT_SOURCE_URL,
    source: "Built-in template"
  }
];

const stationListEl = document.getElementById("stationList");
const emptyStateEl = document.getElementById("emptyState");
const playlistInputEl = document.getElementById("playlistInput");
const titleInputEl = document.getElementById("titleInput");
const descriptionInputEl = document.getElementById("descriptionInput");
const saveStationBtn = document.getElementById("saveStationBtn");
const statusMessageEl = document.getElementById("statusMessage");
const activeStationNameEl = document.getElementById("activeStationName");
const activePlaylistIdEl = document.getElementById("activePlaylistId");
const activePlaylistUrlEl = document.getElementById("activePlaylistUrl");
const recordBtn = document.getElementById("recordBtn");
const playBtn = document.getElementById("playBtn");

let player = null;
let apiReady = false;
let stations = loadStations();
let activeStationId = stations[0]?.id ?? null;
let pendingPlaylistId = stations.find((station) => station.id === activeStationId)?.playlistId || null;

window.onYouTubeIframeAPIReady = function onYouTubeIframeAPIReady() {
  apiReady = true;
  player = new YT.Player("player", {
    height: "100%",
    width: "100%",
    playerVars: {
      listType: "playlist",
      list: pendingPlaylistId || undefined,
      playsinline: 1,
      rel: 0,
      modestbranding: 1
    },
    events: {
      onReady: () => {
        if (pendingPlaylistId) {
          loadPlaylistIntoPlayer(pendingPlaylistId);
        }
      },
      onStateChange: (event) => {
        if (event.data === YT.PlayerState.PLAYING) {
          recordBtn.classList.add("spinning");
          playBtn.textContent = "Pause";
        } else if (
          event.data === YT.PlayerState.PAUSED ||
          event.data === YT.PlayerState.ENDED ||
          event.data === YT.PlayerState.CUED
        ) {
          recordBtn.classList.remove("spinning");
          playBtn.textContent = "Play";
        }
      }
    }
  });
};

function loadStations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_STATIONS];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [...DEFAULT_STATIONS];
    return parsed.filter(Boolean);
  } catch (error) {
    console.error("Could not load saved stations", error);
    return [...DEFAULT_STATIONS];
  }
}

function saveStations() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stations));
}

function parsePlaylistInput(value) {
  const input = String(value || "").trim();
  if (!input) return null;

  const directIdMatch = input.match(/^[A-Za-z0-9_-]{10,}$/);
  if (directIdMatch) {
    return {
      playlistId: input,
      playlistUrl: `https://www.youtube.com/playlist?list=${input}`
    };
  }

  try {
    const url = new URL(input);
    const listId = url.searchParams.get("list");
    if (!listId) return null;
    return {
      playlistId: listId,
      playlistUrl: url.toString()
    };
  } catch (error) {
    return null;
  }
}

function showStatus(message, isError = false) {
  statusMessageEl.textContent = message;
  statusMessageEl.style.color = isError ? "#ff9d9d" : "var(--good)";
}

function buildStationMarkup(station) {
  const hasPlaylist = Boolean(station.playlistId);
  const sourceLabel = station.source || "Saved station";
  return `
    <div class="stationTop">
      <div>
        <div class="stationTitle">${escapeHtml(station.title || "Untitled station")}</div>
        <div class="stationDesc">${escapeHtml(station.description || "No description yet.")}</div>
      </div>
      <span class="pill">${hasPlaylist ? "Ready" : "Needs URL"}</span>
    </div>
    <div class="stationMeta">
      <span class="pill">${escapeHtml(sourceLabel)}</span>
      <span class="pill">${hasPlaylist ? escapeHtml(station.playlistId) : "Paste a playlist URL"}</span>
    </div>
  `;
}

function renderStations() {
  stationListEl.innerHTML = "";
  const realStations = stations.filter(Boolean);
  emptyStateEl.hidden = realStations.length > 0;

  realStations.forEach((station) => {
    const button = document.createElement("button");
    button.className = `stationBtn${station.id === activeStationId ? " active" : ""}`;
    button.innerHTML = buildStationMarkup(station);
    button.addEventListener("click", () => activateStation(station.id, true));
    stationListEl.appendChild(button);
  });
}

function updateNowPlayingPanel(station) {
  activeStationNameEl.textContent = station?.title || "Select a playlist station";
  activePlaylistIdEl.textContent = station?.playlistId || "—";
  activePlaylistUrlEl.textContent = station?.playlistUrl ? "Open source playlist" : "Open sMV playlists";
  activePlaylistUrlEl.href = station?.playlistUrl || DEFAULT_SOURCE_URL;
}

function loadPlaylistIntoPlayer(playlistId) {
  if (!playlistId) return;
  if (apiReady && player?.loadPlaylist) {
    player.loadPlaylist({
      list: playlistId,
      listType: "playlist",
      index: 0
    });
  } else {
    pendingPlaylistId = playlistId;
  }
}

function activateStation(stationId, autoplay = false) {
  const station = stations.find((item) => item.id === stationId);
  if (!station) return;

  activeStationId = station.id;
  updateNowPlayingPanel(station);
  renderStations();

  if (!station.playlistId) {
    showStatus("This station is only a template right now. Paste a real playlist URL to make it playable.", true);
    return;
  }

  showStatus(`Loaded ${station.title}.`, false);
  loadPlaylistIntoPlayer(station.playlistId);

  if (autoplay && apiReady && player?.playVideo) {
    setTimeout(() => {
      try {
        player.playVideo();
      } catch (error) {
        console.warn("Autoplay was blocked by the browser", error);
      }
    }, 350);
  }
}

function togglePlayback() {
  if (!apiReady || !player) return;
  const state = player.getPlayerState();
  if (state === YT.PlayerState.PLAYING) {
    player.pauseVideo();
  } else {
    player.playVideo();
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createStationFromForm() {
  const parsed = parsePlaylistInput(playlistInputEl.value);
  const title = titleInputEl.value.trim();
  const description = descriptionInputEl.value.trim();

  if (!parsed) {
    showStatus("Paste a valid YouTube playlist URL or playlist ID.", true);
    return;
  }

  const station = {
    id: `station-${Date.now()}`,
    title: title || `sMV Playlist ${stations.length + 1}`,
    description: description || "Saved from the sMV playlist-first jukebox.",
    playlistId: parsed.playlistId,
    playlistUrl: parsed.playlistUrl,
    source: "Saved locally"
  };

  stations = [station, ...stations.filter((item) => item.playlistId !== parsed.playlistId)];
  saveStations();
  playlistInputEl.value = "";
  titleInputEl.value = "";
  descriptionInputEl.value = "";
  showStatus(`Saved ${station.title}.`, false);
  activateStation(station.id, false);
}

recordBtn.addEventListener("click", togglePlayback);
playBtn.addEventListener("click", togglePlayback);
saveStationBtn.addEventListener("click", createStationFromForm);
playlistInputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") createStationFromForm();
});
titleInputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") createStationFromForm();
});
descriptionInputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") createStationFromForm();
});

renderStations();
updateNowPlayingPanel(stations.find((station) => station.id === activeStationId) || null);

if (stations[0]?.playlistId) {
  activeStationId = stations[0].id;
  pendingPlaylistId = stations[0].playlistId;
} else {
  showStatus("Paste an sMV playlist URL to replace the starter template and make the jukebox live.", false);
}
