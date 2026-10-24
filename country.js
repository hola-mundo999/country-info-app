/* Country Explorer — search runs against the bundled dataset in data/countries.json,
   so results are instant and the app has no API key, rate limit or CORS dependency.
   Sources: world-countries (names, currencies, languages, idd, latlng),
   GeoNames (population, area, timezones). Flags via flagcdn.com. */

const DATA_URL = "data/countries.json";

const btn = document.getElementById("search-btn");
const searchInput = document.getElementById("search-input");
const loading = document.getElementById("loading");
const errorEl = document.getElementById("error");
const card = document.getElementById("country-card");
const surpriseBtn = document.getElementById("surprise-btn");

const HISTORY_KEY = "countrySearchHistory";
const HISTORY_MAX = 8;

let datasetPromise = null;
let dataset = null;

/* ── helpers ── */
function showLoading() {
  loading.classList.add("visible");
  hideError();
  btn.disabled = true;
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

function escapeText(value) {
  return String(value ?? "");
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
        return data;
      })
      .catch((error) => {
        datasetPromise = null; // allow a retry on the next search
        throw error;
      });
  }
  return datasetPromise;
}

function startLoadingIfNeeded() {
  if (!dataset) showLoading();
}

/* ── search matching ── */
function findCountry(list, query) {
  const q = query.toLowerCase();
  const common = (c) => c.name.common.toLowerCase();
  const official = (c) => (c.name.official || "").toLowerCase();

  return (
    list.find((c) => common(c) === q) ||
    list.find((c) => official(c) === q) ||
    list.find((c) => common(c).startsWith(q)) ||
    list.find((c) => official(c).startsWith(q)) ||
    list.find((c) => common(c).includes(q)) ||
    list.find((c) => official(c).includes(q)) ||
    null
  );
}

/* ── rendering ── */
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
      ? `${escapeText(currency.name || "")}${currency.symbol ? ` (${currency.symbol})` : ""}`.trim()
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

/* ── main search ── */
async function getCountryInfo(rawQuery) {
  const query = (rawQuery || "").trim();
  if (!query) {
    showError("Please enter a country name.");
    return;
  }

  startLoadingIfNeeded();

  try {
    const list = await loadDataset();
    const country = findCountry(list, query);

    if (!country) {
      throw new Error(`No country matched “${query}”. Check the spelling and try again.`);
    }

    renderCountry(country, query);
    saveToHistory(country.name.common);
    searchInput.value = country.name.common;
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
  startLoadingIfNeeded();
  try {
    const list = await loadDataset();
    const pick = list[Math.floor(Math.random() * list.length)];
    searchInput.value = pick.name.common;
    await getCountryInfo(pick.name.common);
  } catch {
    showError("Couldn’t pick a random country. Try again.");
  } finally {
    hideLoading();
  }
});

/* ── search button + enter key ── */
btn.addEventListener("click", () => getCountryInfo(searchInput.value));

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") getCountryInfo(searchInput.value);
});

searchInput.addEventListener("input", hideError);

/* ── init: warm the dataset in the background, restore history ── */
renderHistory();
loadDataset().catch(() => { /* surfaced when the user searches */ });
