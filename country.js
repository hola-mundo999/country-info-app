let button = document.getElementById("search-btn");
let searchInput = document.getElementById("search-input");
let loading = document.getElementById("loading");
let errorEl = document.getElementById("error");

// ── FEATURE 1: Suggestion buttons ──
let suggestionBtns = document.querySelectorAll(".suggestion-btn");

suggestionBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
        // remove emoji and extra spaces from button text
        let countryName = btn.textContent.replace(/[^\w\s]/g, "").trim();
        searchInput.value = countryName;
        getCountryInfo(countryName);
    });
});

// ── FEATURE 3: Loading helpers ──
function showLoading() {
    loading.classList.add("visible");
    errorEl.classList.remove("visible");
    errorEl.textContent = "";
}

function hideLoading() {
    loading.classList.remove("visible");
}

// ── FEATURE 4: Local Storage history ──
function saveToHistory(countryName) {
    // get existing history or empty array
    let history = JSON.parse(localStorage.getItem("searchHistory")) || [];

    // dont save duplicates
    if (!history.includes(countryName)) {
        history.unshift(countryName);         // add to beginning
        if (history.length > 5) history.pop(); // keep max 5
        localStorage.setItem("searchHistory", JSON.stringify(history));
    }

    renderHistory();
}

function renderHistory() {
    let historyDiv = document.getElementById("history");
    let history    = JSON.parse(localStorage.getItem("searchHistory")) || [];

    // if no history show empty message
    if (history.length === 0) {
        historyDiv.innerHTML = `<p class="history-empty">No searches yet — try searching a country above.</p>`;
        return;
    }

    // build chips
    historyDiv.innerHTML = "";
    history.forEach((name) => {
        let chip = document.createElement("div");
        chip.classList.add("history-chip");
        chip.textContent = name;
        chip.addEventListener("click", () => {
            searchInput.value = name;
            getCountryInfo(name);
        });
        historyDiv.appendChild(chip);
    });
}

// clear history button
document.getElementById("clear-history").addEventListener("click", () => {
    localStorage.removeItem("searchHistory");
    renderHistory();
});

// ── MAIN FETCH FUNCTION ──
async function getCountryInfo(countryName) {
    showLoading();

    try {
        let response = await fetch(`https://restcountries.com/v3.1/name/${countryName}`);

        if (!response.ok) {
            throw new Error("Country not found");
        }

        let data    = await response.json();
        let country = data[0];

        // display data
        document.getElementById("country-name").textContent     = country.name?.common || countryName;
        document.getElementById("country-official").textContent = country.name?.official || countryName;
        document.getElementById("capital").textContent          = country.capital?.[0] || 'N/A';
        document.getElementById("population").textContent       = (country.population || 0).toLocaleString();
        document.getElementById("region").textContent           = country.region || 'Global';
        document.getElementById("flag").src                     = country.flags?.png || country.flags?.svg || '';

        // ── FEATURE 2: Currency ──
        let currencyData = country.currencies ? Object.values(country.currencies)[0] : null;
        document.getElementById("currency").textContent = currencyData ? `${currencyData.name || ''} (${currencyData.symbol || ''})` : 'N/A';

        // show card
        document.getElementById("country-card").classList.add("visible");

        // save to history
        saveToHistory(country.name.common);

    } catch (error) {
        errorEl.textContent = "❌ " + error.message;
        errorEl.classList.add("visible");
    } finally {
        hideLoading();
    }
}

// ── SEARCH BUTTON ──
button.addEventListener("click", () => {
    let countryName = searchInput.value.trim();
    if (!countryName) {
        errorEl.textContent = "❌ Please enter a country name";
        errorEl.classList.add("visible");
        return;
    }
    getCountryInfo(countryName);
});

// ── ENTER KEY also searches ──
searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") button.click();
});

// ── load history on page load ──
renderHistory();