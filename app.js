const TAG_ORDER = [
  "男", "女",
  "アニソン", "邦ロック", "洋ロック", "Jバラード", "洋バラード",
  "ボカロ", "声優", "歌謡曲", "ロキノン", "四つ打ち", "エロゲソン",
  "エクストリーム", "歪み", "0セリフ有り",
];

const MOTIVATION_ORDER = ["1モチベ高", "2今日の山場"];

const PURPOSE_ORDER = [
  "00声出し", "0セリフ練", "1極める", "2歪み練習",
  "ハイトーン", "ファルセ練習", "低音練習", "テンポチェンジ",
  "声の表情", "アンニュイ", "yamavo", "遠藤正明アレンジ", "スコアアタック",
];

const UNKNOWN_ARTIST = "アーティスト不明";

const SORT_MODES = [
  { field: "artist", dir: "asc", label: "アーティスト順" },
  { field: "updated", dir: "desc", label: "更新日時 新しい順" },
  { field: "updated", dir: "asc", label: "更新日時 古い順" },
];

const state = {
  songs: [],
  view: "songs", // "songs" | "artists"
  query: "",
  sortIndex: 0,
  filters: {
    tags: new Set(),
    motivation: new Set(),
    purpose: new Set(),
  },
};

const els = {
  homeLink: document.getElementById("homeLink"),
  search: document.getElementById("search"),
  sortButton: document.getElementById("sortButton"),
  motivationFilters: document.getElementById("motivationFilters"),
  tagFilters: document.getElementById("tagFilters"),
  purposeFilters: document.getElementById("purposeFilters"),
  songList: document.getElementById("songList"),
  artistList: document.getElementById("artistList"),
  count: document.getElementById("count"),
  tabSongs: document.getElementById("tabSongs"),
  tabArtists: document.getElementById("tabArtists"),
  memoButton: document.getElementById("memoButton"),
  memoOverlay: document.getElementById("memoOverlay"),
  memoClose: document.getElementById("memoClose"),
  memoText: document.getElementById("memoText"),
};

const stripTagPrefix = (tag) => tag.replace(/^\d+/, "");
const byArtistThenTitle = (a, b) => {
  if (!a.artist && b.artist) return 1;
  if (a.artist && !b.artist) return -1;
  return a.artist.localeCompare(b.artist, "ja") || a.title.localeCompare(b.title, "ja");
};

function currentSort() {
  return SORT_MODES[state.sortIndex];
}

function sortSongs(songs) {
  const sort = currentSort();
  if (sort.field === "artist") {
    return songs.slice().sort(byArtistThenTitle);
  }
  return songs.slice().sort((a, b) => {
    const ta = a.updatedAt ? Date.parse(a.updatedAt) : 0;
    const tb = b.updatedAt ? Date.parse(b.updatedAt) : 0;
    return sort.dir === "asc" ? ta - tb : tb - ta;
  });
}

Promise.all([
  fetch("data/songs.json").then((r) => r.json()),
  fetch("data/pinned_memo.json").then((r) => r.json()),
]).then(([songs, memo]) => {
  state.songs = songs;
  els.memoText.textContent = memo.text || "（メモなし）";
  els.sortButton.textContent = currentSort().label;
  renderFilters();
  render();
});

function renderFilters() {
  renderFilterRow(els.tagFilters, "tags", TAG_ORDER);
  renderFilterRow(els.motivationFilters, "motivation", MOTIVATION_ORDER);
  renderFilterRow(els.purposeFilters, "purpose", PURPOSE_ORDER);
}

function renderFilterRow(container, field, preferredOrder) {
  const present = new Set(state.songs.flatMap((s) => s[field]));
  const ordered = preferredOrder.filter((t) => present.has(t));
  const rest = [...present].filter((t) => !preferredOrder.includes(t)).sort();
  buildChipRow(container, [...ordered, ...rest], field);
}

function buildChipRow(container, values, field) {
  const selectedSet = state.filters[field];
  container.innerHTML = "";
  for (const value of values) {
    const chip = document.createElement("button");
    chip.className = "tag-chip";
    if (selectedSet.has(value)) chip.classList.add("active");
    chip.textContent = stripTagPrefix(value);
    chip.addEventListener("click", () => {
      if (selectedSet.has(value)) {
        selectedSet.delete(value);
      } else {
        selectedSet.add(value);
      }
      chip.classList.toggle("active");
      render();
    });
    container.appendChild(chip);
  }
}

function matchesQuery(song, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    song.title.toLowerCase().includes(q) ||
    song.artist.toLowerCase().includes(q)
  );
}

function matchesFilter(song, field) {
  const selected = state.filters[field];
  if (selected.size === 0) return true;
  return [...selected].every((v) => song[field].includes(v));
}

function filteredSongs() {
  const results = state.songs.filter(
    (s) =>
      matchesQuery(s, state.query) &&
      matchesFilter(s, "tags") &&
      matchesFilter(s, "motivation") &&
      matchesFilter(s, "purpose")
  );
  return sortSongs(results);
}

function render() {
  if (state.view === "songs") {
    renderSongs();
  } else {
    renderArtists();
  }
}

function renderSongs() {
  const results = filteredSongs();
  els.count.textContent = `${results.length} / ${state.songs.length}曲`;
  els.songList.innerHTML = "";

  if (results.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "該当する曲がありません";
    els.songList.appendChild(empty);
    return;
  }

  for (const song of results) {
    els.songList.appendChild(buildSongCard(song));
  }
}

function buildSongCard(song) {
  const card = document.createElement("div");
  card.className = "song-card";

  const title = document.createElement("div");
  title.className = "song-title";
  title.textContent = song.title;

  const artist = document.createElement("div");
  artist.className = "song-artist";
  artist.textContent = song.artist || UNKNOWN_ARTIST;
  if (song.artist) {
    artist.addEventListener("click", () => jumpToArtist(song.artist));
  }

  const meta = document.createElement("div");
  meta.className = "song-meta";

  if (song.key !== null) {
    const keyBadge = document.createElement("span");
    keyBadge.className = "badge key";
    keyBadge.textContent = `キー ${song.key > 0 ? "+" : ""}${song.key}`;
    meta.appendChild(keyBadge);
  }

  for (const tag of song.tags) {
    const badge = document.createElement("span");
    badge.className = "badge tag-link";
    if (tag === "男") badge.classList.add("male");
    if (tag === "女") badge.classList.add("female");
    badge.textContent = stripTagPrefix(tag);
    badge.addEventListener("click", () => jumpToFilter("tags", tag));
    meta.appendChild(badge);
  }

  for (const purpose of song.purpose) {
    const badge = document.createElement("span");
    badge.className = "badge tag-link";
    badge.textContent = stripTagPrefix(purpose);
    badge.addEventListener("click", () => jumpToFilter("purpose", purpose));
    meta.appendChild(badge);
  }

  card.append(title, artist, meta);
  return card;
}

function renderArtists() {
  const counts = new Map();
  for (const song of state.songs) {
    const key = song.artist || UNKNOWN_ARTIST;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const artists = [...counts.keys()].sort((a, b) => {
    if (a === UNKNOWN_ARTIST) return 1;
    if (b === UNKNOWN_ARTIST) return -1;
    return a.localeCompare(b, "ja");
  });

  els.count.textContent = `${artists.length}組`;
  els.artistList.innerHTML = "";

  for (const artist of artists) {
    const card = document.createElement("div");
    card.className = "artist-card";

    const name = document.createElement("span");
    name.className = "artist-name";
    name.textContent = artist;

    const count = document.createElement("span");
    count.className = "artist-count";
    count.textContent = `${counts.get(artist)}曲`;

    card.append(name, count);
    card.addEventListener("click", () => jumpToArtist(artist));
    els.artistList.appendChild(card);
  }
}

function applyView(view, query) {
  state.view = view;
  state.query = query;
  els.search.value = query;
  els.tabSongs.classList.toggle("active", view === "songs");
  els.tabArtists.classList.toggle("active", view === "artists");
  els.songList.hidden = view !== "songs";
  els.artistList.hidden = view !== "artists";
  render();
}

function navigate(view, query = state.query) {
  applyView(view, query);
  history.pushState({ view, query }, "");
}

function clearFilters() {
  state.filters.tags.clear();
  state.filters.motivation.clear();
  state.filters.purpose.clear();
  renderFilters();
}

function goHome() {
  clearFilters();
  navigate("songs", "");
}

function jumpToArtist(artist) {
  clearFilters();
  navigate("songs", artist);
}

function jumpToFilter(field, value) {
  clearFilters();
  state.filters[field].add(value);
  renderFilters();
  navigate("songs", "");
}

window.addEventListener("popstate", (e) => {
  const s = e.state || { view: "songs", query: "" };
  applyView(s.view, s.query);
});

history.replaceState({ view: state.view, query: state.query }, "");

els.search.addEventListener("input", (e) => {
  state.query = e.target.value;
  render();
});

els.sortButton.addEventListener("click", () => {
  state.sortIndex = (state.sortIndex + 1) % SORT_MODES.length;
  els.sortButton.textContent = currentSort().label;
  render();
});

els.homeLink.addEventListener("click", goHome);
els.tabSongs.addEventListener("click", goHome);
els.tabArtists.addEventListener("click", () => navigate("artists"));

els.memoButton.addEventListener("click", () => {
  els.memoOverlay.hidden = false;
});
els.memoClose.addEventListener("click", () => {
  els.memoOverlay.hidden = true;
});
els.memoOverlay.addEventListener("click", (e) => {
  if (e.target === els.memoOverlay) els.memoOverlay.hidden = true;
});
