
const PLAYLISTS = {
  catalog: [{ title: "Karaoke Star", id: "J7jlx50LEj4" }],
  latest: [{ title: "Latest Alternative Pick", id: "J7jlx50LEj4" }],
  altrock: [{ title: "Alt Rock Feature", id: "J7jlx50LEj4" }],
  althiphop: [{ title: "Alt Hip Hop Feature", id: "J7jlx50LEj4" }],
  power: [{ title: "Power Station Mix", id: "J7jlx50LEj4" }]
};

const ytPlayer = document.getElementById("ytPlayer");
const library = document.getElementById("library");

function setPlayerVideo(id) {
  ytPlayer.src = `https://www.youtube.com/embed/${id}?playsinline=1&rel=0&modestbranding=1`;
}

function loadPlaylist(name) {
  library.innerHTML = "";
  const list = PLAYLISTS[name] || [];
  list.forEach(v => {
    const div = document.createElement("div");
    div.className = "tile";
    div.innerHTML = `<img src="https://img.youtube.com/vi/${v.id}/hqdefault.jpg"><div>${v.title}</div>`;
    div.onclick = () => setPlayerVideo(v.id);
    library.appendChild(div);
  });
  if (list[0]) setPlayerVideo(list[0].id);
}

loadPlaylist("catalog");
