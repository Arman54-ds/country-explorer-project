const API_URL = "https://countries.dev/countries?full=true";
const elements = {
  search: document.querySelector("#searchInput"),
  clearSearch: document.querySelector("#clearSearch"),
  region: document.querySelector("#regionFilter"),
  sort: document.querySelector("#sortSelect"),
  container: document.querySelector("#countriesContainer"),
  status: document.querySelector("#statusMessage"),
  summary: document.querySelector("#resultsSummary"),
  title: document.querySelector("#resultsTitle"),
  empty: document.querySelector("#emptyState"),
  reset: document.querySelector("#resetFilters"),
  emptyReset: document.querySelector("#emptyReset"),
  details: document.querySelector("#detailsView"),
  detailsContent: document.querySelector("#detailsContent"),
  back: document.querySelector("#backButton"),
  home: document.querySelector("#homeButton"),
  homeLink: document.querySelector("#homeLink"),
  favoritesButton: document.querySelector("#favoritesButton"),
  favoritesCount: document.querySelector("#favoritesCount"),
  themeToggle: document.querySelector("#themeToggle"),
  template: document.querySelector("#countryCardTemplate")
};

let allCountries = [];
let currentView = "all";
let currentCountryCode = null;
let favorites = loadJSON("countryExplorerFavorites", []);
let currentTheme = localStorage.getItem("countryExplorerTheme") || "light";

function loadJSON(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function formatNumber(value) {
  return typeof value === "number" ? new Intl.NumberFormat().format(value) : "Not available";
}

function getCapital(country) {
  return country.capital?.length ? country.capital.join(", ") : "Not available";
}

function getCountryName(country) {
  return country.name?.common || "Unknown country";
}

function getCountryCode(country) {
  return country.cca3 || "";
}

function setStatus(message, type = "loading") {
  elements.status.className = `status-message ${type === "error" ? "error" : ""}`;
  elements.status.replaceChildren();

  if (type === "loading") {
    const spinner = document.createElement("span");
    spinner.className = "spinner";
    spinner.setAttribute("aria-hidden", "true");
    elements.status.append(spinner);
  }

  const text = document.createElement("span");
  text.textContent = message;
  elements.status.append(text);
  elements.status.hidden = false;
}

function hideStatus() {
  elements.status.hidden = true;
}

function normalizeCountry(country) {
    const commonName =
        typeof country.name === "string"
            ? country.name
            : country.name?.common ||
              country.officialName ||
              "Unknown country";

    const officialName =
        typeof country.name === "object"
            ? country.name.official || commonName
            : country.officialName || commonName;

    const alpha2Code = country.cca2 || country.alpha2Code || "";

    const rawFlags = country.flags || {};

    const flagUrl =
        rawFlags.svg ||
        rawFlags.png ||
        (alpha2Code
            ? `https://countries.dev/flags/${alpha2Code.toLowerCase()}.svg`
            : "");

    let currencies = country.currencies || {};

    if (Array.isArray(currencies)) {
        currencies = Object.fromEntries(
            currencies.map((currency, index) => [
                currency.code || currency.name || `currency${index}`,
                {
                    name: currency.name || currency.code || "",
                    symbol: currency.symbol || ""
                }
            ])
        );
    }

    let languages = country.languages || {};

    if (Array.isArray(languages)) {
        languages = Object.fromEntries(
            languages.map((language, index) => [
                language.iso639_1 ||
                    language.iso639_2 ||
                    language.name ||
                    `language${index}`,
                language.name || language.nativeName || ""
            ])
        );
    }

    return {
        ...country,

        name: {
            common: commonName,
            official: officialName
        },

        flags: {
            svg: flagUrl,
            png: rawFlags.png || flagUrl,
            alt: rawFlags.alt || `Flag of ${commonName}`
        },

        cca2: alpha2Code,
        cca3: country.cca3 || country.alpha3Code || "",

        capital: Array.isArray(country.capital)
            ? country.capital
            : country.capital
                ? [country.capital]
                : [],

        region: country.region || "",
        subregion: country.subregion || "",

        continents: country.continents ||
            (country.region ? [country.region] : []),

        population: Number(country.population) || 0,
        area: Number(country.area) || 0,

        currencies,
        languages,

        timezones: country.timezones || [],
        borders: country.borders || [],
        maps: country.maps || {}
    };
}

async function fetchCountries() {
  setStatus("Loading countries…");

  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error("The API returned an unexpected response.");
    }

    allCountries = data.map(normalizecountry).filter(country => country.name.common && country.flags.svg);
    allCountries.sort((a, b) => getCountryName(a).localeCompare(getCountryName(b)));
    hideStatus();
    renderCountries();
    updateFavoritesCount();
    handleInitialRoute();
  } catch (error) {
    console.error("Could not load countries:", error);
    setStatus("Could not load country data. Check your internet connection and try again.", "error");

    const retry = document.createElement("button");
    retry.className = "primary-button";
    retry.type = "button";
    retry.textContent = "Try again";
    retry.addEventListener("click", fetchCountries);
    elements.status.append(" ", retry);
  }
}

function getVisibleCountries() {
  let countries = currentView === "favorites"
    ? allCountries.filter(country => favorites.includes(getCountryCode(country)))
    : [...allCountries];

  const term = elements.search.value.trim().toLocaleLowerCase();
  if (term) {
    countries = countries.filter(country => {
      const name = getCountryName(country).toLocaleLowerCase();
      const officialName = (country.name?.official || "").toLocaleLowerCase();
      const capital = (country.capital || []).join(" ").toLocaleLowerCase();
      return name.includes(term) || officialName.includes(term) || capital.includes(term);
    });
  }

  const region = elements.region.value;
  if (region !== "all") {
    countries = countries.filter(country => country.region === region);
  }

  switch (elements.sort.value) {
    case "name-desc":
      countries.sort((a, b) => getCountryName(b).localeCompare(getCountryName(a)));
      break;
    case "population-desc":
      countries.sort((a, b) => (b.population || 0) - (a.population || 0));
      break;
    case "population-asc":
      countries.sort((a, b) => (a.population || 0) - (b.population || 0));
      break;
    case "area-desc":
      countries.sort((a, b) => (b.area || 0) - (a.area || 0));
      break;
    default:
      countries.sort((a, b) => getCountryName(a).localeCompare(getCountryName(b)));
  }

  return countries;
}

function renderCountries() {
  const countries = getVisibleCountries();
  elements.container.replaceChildren();
  elements.details.hidden = true;
  elements.container.hidden = false;
  elements.empty.hidden = countries.length > 0;
  hideStatus();

  elements.title.textContent = currentView === "favorites" ? "Your favourite countries" : "Countries around the world";
  elements.summary.textContent = `${countries.length} ${countries.length === 1 ? "country" : "countries"} found`;
  elements.clearSearch.hidden = elements.search.value.length === 0;

  const fragment = document.createDocumentFragment();
  countries.forEach(country => fragment.append(createCountryCard(country)));
  elements.container.append(fragment);

  elements.home.classList.toggle("active", currentView === "all");
  elements.favoritesButton.classList.toggle("active", currentView === "favorites");
}

function createCountryCard(country) {
  const card = elements.template.content.firstElementChild.cloneNode(true);
  const flagButton = card.querySelector(".flag-button");
  const flag = card.querySelector(".country-flag");
  const name = getCountryName(country);
  const code = getCountryCode(country);
  const favoriteButton = card.querySelector(".favorite-button");

  flag.src = country.flags.svg;
  flag.alt = country.flags.alt || `Flag of ${name}`;
  flagButton.setAttribute("aria-label", `View details for ${name}`);
  card.querySelector(".country-name").textContent = name;
  card.querySelector(".country-population").textContent = formatNumber(country.population);
  card.querySelector(".country-region").textContent = country.region || "Not available";
  card.querySelector(".country-capital").textContent = getCapital(country);

  const isFavorite = favorites.includes(code);
  favoriteButton.textContent = isFavorite ? "♥" : "♡";
  favoriteButton.classList.toggle("is-favorite", isFavorite);
  favoriteButton.setAttribute("aria-label", isFavorite ? `Remove ${name} from favourites` : `Add ${name} to favourites`);
  favoriteButton.title = isFavorite ? "Remove from favourites" : "Add to favourites";

  flagButton.addEventListener("click", () => showCountryDetails(code));
  card.querySelector(".country-name").addEventListener("click", () => showCountryDetails(code));
  card.querySelector(".country-name").style.cursor = "pointer";
  favoriteButton.addEventListener("click", () => toggleFavorite(code));

  return card;
}

function toggleFavorite(code) {
  if (favorites.includes(code)) {
    favorites = favorites.filter(item => item !== code);
  } else {
    favorites.push(code);
  }

  localStorage.setItem("countryExplorerFavorites", JSON.stringify(favorites));
  updateFavoritesCount();

  if (currentCountryCode === code && !favorites.includes(code)) {
    // Keep the detail page open; the heart state is updated when it is rendered again.
  }

  renderCountries();
  if (currentCountryCode === code && !elements.details.hidden) {
    showCountryDetails(code, false);
  }
}

function updateFavoritesCount() {
  elements.favoritesCount.textContent = String(favorites.length);
}

function getList(values) {
  return values && values.length ? values.join(", ") : "Not available";
}

function getCurrencies(country) {
  if (!country.currencies) return "Not available";
  return Object.values(country.currencies)
    .map(currency => currency.name ? `${currency.name}${currency.symbol ? ` (${currency.symbol})` : ""}` : "")
    .filter(Boolean).join(", ") || "Not available";
}

function getLanguages(country) {
  return country.languages ? Object.values(country.languages).join(", ") : "Not available";
}

function showCountryDetails(code, updateUrl = true) {
  const country = allCountries.find(item => getCountryCode(item) === code);
  if (!country) return;

  currentCountryCode = code;
  currentView = "all";
  elements.container.hidden = true;
  elements.empty.hidden = true;
  elements.details.hidden = false;
  elements.title.textContent = getCountryName(country);
  elements.summary.textContent = "Country details";
  elements.home.classList.add("active");
  elements.favoritesButton.classList.remove("active");

  const layout = document.createElement("div");
  layout.className = "details-layout";

  const flag = document.createElement("img");
  flag.className = "details-flag";
  flag.src = country.flags.svg;
  flag.alt = country.flags.alt || `Flag of ${getCountryName(country)}`;
  flag.loading = "lazy";

  const info = document.createElement("div");
  info.className = "details-info";

  const heading = document.createElement("h2");
  heading.id = "detailsTitle";
  heading.textContent = getCountryName(country);
  info.append(heading);

  const facts = document.createElement("div");
  facts.className = "details-facts";

  const factsList = [
    ["Official name", country.name?.official || "Not available"],
    ["Capital", getCapital(country)],
    ["Population", formatNumber(country.population)],
    ["Region", country.region || "Not available"],
    ["Subregion", country.subregion || "Not available"],
    ["Area", typeof country.area === "number" ? `${formatNumber(country.area)} km²` : "Not available"],
    ["Currencies", getCurrencies(country)],
    ["Languages", getLanguages(country)],
    ["Time zones", getList(country.timezones)],
    ["Continents", getList(country.continents)]
  ];

  factsList.forEach(([label, value]) => {
    const p = document.createElement("p");
    const strong = document.createElement("strong");
    strong.textContent = `${label}: `;
    p.append(strong, document.createTextNode(value));
    facts.append(p);
  });
  info.append(facts);

  const favorite = document.createElement("button");
  favorite.type = "button";
  favorite.className = "primary-button";
  favorite.style.marginTop = "22px";
  favorite.textContent = favorites.includes(code) ? "♥ Remove from favourites" : "♡ Add to favourites";
  favorite.addEventListener("click", () => toggleFavorite(code));
  info.append(favorite);

  const borders = document.createElement("div");
  borders.className = "borders";
  const bordersTitle = document.createElement("strong");
  bordersTitle.textContent = "Bordering countries";
  borders.append(bordersTitle);

  const borderCountries = (country.borders || [])
    .map(borderCode => allCountries.find(item => getCountryCode(item) === borderCode))
    .filter(Boolean);

  if (borderCountries.length === 0) {
    const noBorders = document.createElement("span");
    noBorders.textContent = "No land borders available";
    noBorders.style.color = "var(--muted)";
    borders.append(noBorders);
  } else {
    borderCountries.forEach(borderCountry => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "border-chip";
      button.textContent = getCountryName(borderCountry);
      button.addEventListener("click", () => showCountryDetails(getCountryCode(borderCountry)));
      borders.append(button);
    });
  }
  info.append(borders);
  layout.append(flag, info);
  elements.detailsContent.replaceChildren(layout);

  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set("country", code);
    history.pushState({ country: code }, "", url);
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showHome() {
  currentCountryCode = null;
  currentView = "all";
  const url = new URL(window.location.href);
  url.searchParams.delete("country");
  url.searchParams.delete("view");
  history.pushState({}, "", url);
  renderCountries();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showFavorites() {
  currentCountryCode = null;
  currentView = "favorites";
  const url = new URL(window.location.href);
  url.searchParams.delete("country");
  url.searchParams.set("view", "favorites");
  history.pushState({ view: "favorites" }, "", url);
  renderCountries();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetFilters() {
  elements.search.value = "";
  elements.region.value = "all";
  elements.sort.value = "name-asc";
  currentView = "all";
  currentCountryCode = null;
  renderCountries();
}

function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("countryExplorerTheme", theme);
  const isDark = theme === "dark";
  elements.themeToggle.innerHTML = isDark
    ? '☀️ <span class="theme-label">Light mode</span>'
    : '🌙 <span class="theme-label">Dark mode</span>';
  elements.themeToggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
}

function handleInitialRoute() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("country");
  const view = params.get("view");

  if (code) {
    showCountryDetails(code, false);
  } else if (view === "favorites") {
    currentView = "favorites";
    renderCountries();
  }
}

elements.search.addEventListener("input", renderCountries);
elements.region.addEventListener("change", renderCountries);
elements.sort.addEventListener("change", renderCountries);
elements.clearSearch.addEventListener("click", () => {
  elements.search.value = "";
  renderCountries();
  elements.search.focus();
});
elements.reset.addEventListener("click", resetFilters);
elements.emptyReset.addEventListener("click", resetFilters);
elements.back.addEventListener("click", showHome);
elements.home.addEventListener("click", showHome);
elements.homeLink.addEventListener("click", event => {
  event.preventDefault();
  showHome();
});
elements.favoritesButton.addEventListener("click", showFavorites);
elements.themeToggle.addEventListener("click", () => {
  applyTheme(currentTheme === "dark" ? "light" : "dark");
});

window.addEventListener("popstate", () => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("country");
  if (code) {
    showCountryDetails(code, false);
  } else if (params.get("view") === "favorites") {
    currentCountryCode = null;
    currentView = "favorites";
    renderCountries();
  } else {
    currentCountryCode = null;
    currentView = "all";
    renderCountries();
  }
});

applyTheme(currentTheme);
updateFavoritesCount();
fetchCountries();
