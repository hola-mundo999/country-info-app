/* Country Explorer — searches the bundled dataset in data/countries.json, so results are
   instant and the app has no API key, rate limit or CORS dependency.
   Sources: world-countries (names, currencies, languages, idd, latlng),
   GeoNames (population, area, timezones). Flags via flagcdn.com. */

const DATA_URL = "data/countries.json";

const btn = document.getElementById("search-btn");
const searchInput = document.getElementById("search-input");
const suggestList = document.getElementById("suggest-list");
const loading = document.getElementById("loading");
const errorEl = document.getElementById("error");
const card = document.getElementById("country-card");
const surpriseBtn = document.getElementById("surprise-btn");
const copyLinkBtn = document.getElementById("copy-link");

const HISTORY_KEY = "countrySearchHistory";
const HISTORY_MAX = 8;
const MAX_SUGGESTIONS = 8;

let datasetPromise = null;
let dataset = null;
let searchIndex = [];

let matches = [];
let activeIndex = -1;

/* ── helpers ── */
function showLoading() {
  if (!dataset) {
    loading.classList.add("visible");
    btn.disabled = true;
  }
  hideError();
}

function hideLoading() {
  loading.classList.remove("visible");
  btn.disabled = false;
}

function showError(message) {
  errorEl.textContent = "✕ " + message;
  errorEl.classList.add("visible");
}

function hideError() {
  errorEl.classList.remove("visible");
  errorEl.textContent = "";
}

function formatNumber(n) {
  return Number(n).toLocaleString("en-US");
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&#39;";
    }
  });
}

function norm(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/* ── dataset ── */
function loadDataset() {
  if (dataset) return Promise.resolve(dataset);
  if (!datasetPromise) {
    datasetPromise = fetch(DATA_URL, { cache: "force-cache" })
      .then((response) => {
        if (!response.ok) throw new Error("dataset");
        return response.json();
      })
      .then((data) => {
        dataset = data;
        searchIndex = data.map((country) => ({
          country,
          common: norm(country.name.common),
          official: norm(country.name.official)
        }));
        return data;
      })
      .catch((error) => {
        datasetPromise = null; // allow a retry on the next search
        throw error;
      });
  }
  return datasetPromise;
}

/* ── matching ── */
function scoreEntry(entry, q) {
  if (entry.common === q || entry.official === q) return 0;
  if (entry.common.startsWith(q)) return 1;
  if (entry.official.startsWith(q)) return 2;
  if (entry.common.split(/[\s-]+/).some((word) => word.startsWith(q))) return 3;
  if (entry.official.split(/[\s-]+/).some((word) => word.startsWith(q))) return 4;
  if (entry.common.includes(q)) return 5;
  if (entry.official.includes(q)) return 6;
  return -1;
}

function searchCountries(query) {
  const q = norm(query);
  if (!q) return [];

  const scored = [];
  searchIndex.forEach((entry) => {
    const score = scoreEntry(entry, q);
    if (score >= 0) scored.push({ ...entry, score });
  });

  return scored
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.common.length - b.common.length ||
        a.common.localeCompare(b.common)
    )
    .slice(0, MAX_SUGGESTIONS)
    .map((entry) => entry.country);
}

function findByCode(code) {
  const wanted = norm(code);
  return dataset?.find((country) => country.cca2.toLowerCase() === wanted) || null;
}

/* ── autocomplete ── */
function highlight(name, query) {
  const q = norm(query);
  if (!q) return esc(name);
  const index = norm(name).indexOf(q);
  if (index === -1) return esc(name);
  return (
    esc(name.slice(0, index)) +
    "<mark>" + esc(name.slice(index, index + q.length)) + "</mark>" +
    esc(name.slice(index + q.length))
  );
}

function renderSuggestions() {
  const query = searchInput.value;
  matches = searchCountries(query);
  activeIndex = -1;

  if (!query.trim() || matches.length === 0) {
    closeSuggestions();
    if (query.trim() && matches.length === 0) {
      suggestList.hidden = false;
      suggestList.innerHTML = '<li class="suggest-empty">No country matches that name.</li>';
      searchInput.setAttribute("aria-expanded", "true");
    }
    return;
  }

  suggestList.innerHTML = matches
    .map(
      (country, i) => `
      <li class="suggest-item" role="option" id="suggest-${i}" aria-selected="false" data-code="${esc(country.cca2)}">
        <span class="suggest-flag">${esc(country.flag || "")}</span>
        <span class="suggest-name">${highlight(country.name.common, query)}</span>
        <span class="suggest-region">${esc(country.region || "")}</span>
      </li>`
    )
    .join("");

  suggestList.hidden = false;
  searchInput.setAttribute("aria-expanded", "true");
  searchInput.removeAttribute("aria-activedescendant");
}

function closeSuggestions() {
  suggestList.hidden = true;
  suggestList.innerHTML = "";
  searchInput.setAttribute("aria-expanded", "false");
  searchInput.removeAttribute("aria-activedescendant");
  activeIndex = -1;
}

function moveActive(step) {
  if (!matches.length || suggestList.hidden) return;
  activeIndex = (activeIndex + step + matches.length) % matches.length;

  [...suggestList.children].forEach((item, i) => {
    const selected = i === activeIndex;
    item.setAttribute("aria-selected", String(selected));
    if (selected) {
      item.scrollIntoView({ block: "nearest" });
      searchInput.setAttribute("aria-activedescendant", item.id);
    }
  });
}

function chooseCountry(country) {
  searchInput.value = country.name.common;
  closeSuggestions();
  showCountry(country, country.name.common);
}

/* ── history ── */
function getHistory() {
  try {
    const stored = JSON.parse(localStorage.getItem(HISTORY_KEY));
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function saveToHistory(countryName) {
  let history = getHistory().filter(
    (name) => name.toLowerCase() !== countryName.toLowerCase()
  );
  history.unshift(countryName);
  if (history.length > HISTORY_MAX) history = history.slice(0, HISTORY_MAX);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch { /* storage blocked — history is non-critical */ }
  renderHistory();
}

function renderHistory() {
  const historyDiv = document.getElementById("history");
  const history = getHistory();

  if (history.length === 0) {
    historyDiv.innerHTML = '<p class="history-empty">No searches yet — try searching a country above.</p>';
    return;
  }

  historyDiv.innerHTML = "";
  history.forEach((name) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "history-chip";
    chip.textContent = name;
    chip.addEventListener("click", () => {
      searchInput.value = name;
      getCountryInfo(name);
    });
    historyDiv.appendChild(chip);
  });
}

document.getElementById("clear-history").addEventListener("click", () => {
  try { localStorage.removeItem(HISTORY_KEY); } catch {}
  renderHistory();
});

/* ── card rendering ── */
function setText(id, text) {
  document.getElementById(id).textContent = text;
}

function callingCode(country) {
  const root = country.idd?.root;
  if (!root) return null;
  const suffixes = (country.idd?.suffixes || []).filter(Boolean);
  return suffixes.length === 1 ? root + suffixes[0] : root;
}

function setFlag(country) {
  const img = document.getElementById("flag");
  const cca2 = (country.cca2 || "").toLowerCase();
  img.dataset.stage = "png";
  img.onerror = () => {
    if (img.dataset.stage === "png") {
      img.dataset.stage = "svg";
      img.src = `https://flagcdn.com/${cca2}.svg`;
    } else {
      img.onerror = null;
      img.removeAttribute("src");
      img.alt = `Flag of ${country.name.common} (image unavailable)`;
      const emoji = document.getElementById("flagEmoji");
      if (emoji) emoji.textContent = country.flag || "";
    }
  };
  img.src = cca2 ? `https://flagcdn.com/w320/${cca2}.png` : "";
  img.alt = `Flag of ${country.name.common}`;
}

function renderCountry(country, query) {
  setText("country-name", country.name.common || query);
  setText("country-official", country.name.official || "");
  setText("capital", (country.capital && country.capital[0]) || "N/A");
  setText("population", country.population ? formatNumber(country.population) : "N/A");

  const currency = country.currencies ? Object.values(country.currencies)[0] : null;
  setText(
    "currency",
    currency
      ? `${currency.name || ""}${currency.symbol ? ` (${currency.symbol})` : ""}`.trim()
      : "N/A"
  );

  setText("languages", country.languages ? Object.values(country.languages).join(", ") : "N/A");
  setText("area", country.area ? `${formatNumber(Math.round(country.area))} km²` : "N/A");
  setText("subregion", country.subregion || country.region || "N/A");
  setText("region", country.region || "Global");

  setFlag(country);

  const callingChip = document.getElementById("calling-code");
  const code = callingCode(country);
  callingChip.textContent = code ? `tel ${code}` : "";
  callingChip.hidden = !code;

  const tzChip = document.getElementById("timezone");
  const tz = country.timezones?.[0];
  tzChip.textContent = tz ? tz.replace(/_/g, " ") : "";
  tzChip.hidden = !tz;

  const mapLink = document.getElementById("map-link");
  if (Array.isArray(country.latlng) && country.latlng.length === 2) {
    mapLink.href = `https://www.google.com/maps?q=${country.latlng[0]},${country.latlng[1]}`;
    mapLink.hidden = false;
  } else {
    mapLink.hidden = true;
  }

  card.classList.add("visible");
}

function showCountry(country, query) {
  renderCountry(country, query);
  saveToHistory(country.name.common);
  searchInput.value = country.name.common;
  hideError();

  // keep the URL shareable: /country-info-app/#np
  const nextHash = "#" + country.cca2.toLowerCase();
  if (location.hash !== nextHash) {
    history.replaceState(null, "", nextHash);
  }
}

/* ── lookup ── */
async function getCountryInfo(rawQuery) {
  const query = (rawQuery || "").trim();
  if (!query) {
    showError("Please enter a country name.");
    return;
  }

  showLoading();

  try {
    const list = await loadDataset();
    const best = searchCountries(query)[0];

    if (!best) {
      throw new Error(`No country matched “${query}”. Check the spelling and try again.`);
    }

    showCountry(best, query);
    closeSuggestions();
  } catch (error) {
    if (error && error.message === "dataset") {
      showError("Couldn’t load the country data. Check your connection and try again.");
    } else if (error instanceof TypeError) {
      showError("Couldn’t load the country data. Check your connection and try again.");
    } else {
      showError(error.message || "Something went wrong. Try again.");
    }
  } finally {
    hideLoading();
  }
}

/* ── deep links ── */
async function openFromHash() {
  const code = location.hash.replace(/^#\/?/, "");
  if (!code) return false;

  try {
    await loadDataset();
  } catch {
    return false;
  }

  const country = findByCode(code);
  if (!country) return false;

  searchInput.value = country.name.common;
  renderCountry(country, country.name.common);
  saveToHistory(country.name.common);
  return true;
}

/* ── copy link ── */
copyLinkBtn.addEventListener("click", async () => {
  const url = location.href;
  let ok = false;

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(url);
      ok = true;
    } else {
      const area = document.createElement("textarea");
      area.value = url;
      area.style.position = "fixed";
      area.opacity = "0";
      document.body.appendChild(area);
      area.select();
      ok = document.execCommand("copy");
      area.remove();
    }
  } catch {
    ok = false;
  }

  const original = copyLinkBtn.textContent;
  copyLinkBtn.textContent = ok ? "copied ✓" : "copy failed";
  copyLinkBtn.classList.toggle("copied", ok);
  setTimeout(() => {
    copyLinkBtn.textContent = original;
    copyLinkBtn.classList.remove("copied");
  }, 1600);
});

/* ── suggestions ── */
document.querySelectorAll(".suggestion-btn").forEach((suggestion) => {
  suggestion.addEventListener("click", () => {
    const countryName = suggestion.dataset.country;
    searchInput.value = countryName;
    getCountryInfo(countryName);
  });
});

/* ── surprise me ── */
surpriseBtn.addEventListener("click", async () => {
  showLoading();
  try {
    const list = await loadDataset();
    const pick = list[Math.floor(Math.random() * list.length)];
    showCountry(pick, pick.name.common);
    closeSuggestions();
  } catch {
    showError("Couldn’t pick a random country. Try again.");
  } finally {
    hideLoading();
  }
});

/* ── input events ── */
searchInput.addEventListener("input", () => {
  hideError();
  renderSuggestions();
});

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (suggestList.hidden) renderSuggestions();
    moveActive(1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    moveActive(-1);
  } else if (event.key === "Enter") {
    event.preventDefault();
    if (activeIndex >= 0 && matches[activeIndex]) {
      chooseCountry(matches[activeIndex]);
    } else {
      getCountryInfo(searchInput.value);
    }
  } else if (event.key === "Escape") {
    closeSuggestions();
  }
});

suggestList.addEventListener("mousedown", (event) => {
  event.preventDefault(); // keep focus in the input while clicking an option
  const item = event.target.closest(".suggest-item");
  if (!item) return;
  const country = matches.find((c) => c.cca2 === item.dataset.code);
  if (country) chooseCountry(country);
});

searchInput.addEventListener("blur", () => setTimeout(closeSuggestions, 120));

btn.addEventListener("click", () => getCountryInfo(searchInput.value));

/* ── boot ── */
window.addEventListener("hashchange", () => {
  if (location.hash) openFromHash();
});

(async function boot() {
  renderHistory();
  loadDataset().catch(() => { /* surfaced when the user searches */ });
  await openFromHash();
})();
