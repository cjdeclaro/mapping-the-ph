 // Constants
const OWNER = "cjdeclaro";
const REPO = "2025-election-results-web-scrape";
const CONCURRENCY_LIMIT = 50;

const DB_NAME = "ElectionResultsCache";
const STORE_NAME = "CityData";
const DB_VERSION = 1;

/** IndexedDB helpers */
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

function getFromCache(key) {
  return openIndexedDB().then((db) =>
    new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    })
  ).catch(() => undefined); // Return undefined if DB access fails
}

function saveToCache(key, data) {
  return openIndexedDB().then((db) =>
    new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(data, key);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    })
  ).catch(() => {}); // Silent fail on DB write error
}

function clearIndexedDBCache() {
  return openIndexedDB().then((db) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    console.log("IndexedDB cache cleared.");
  });
}

/** Build GitHub raw URL for city data */
function buildCityDataUrl(region, province, city) {
  return `https://raw.githubusercontent.com/${OWNER}/${REPO}/refs/heads/main/data/minified_local/${region.toUpperCase()}/${province.toUpperCase()}/${city.toUpperCase()}.json`;
}

/** Fetch city data with cache fallback */
async function getDataFromCity(region, province, city) {
  const cacheKey = `${region}|${province}|${city}`;

  const cachedData = await getFromCache(cacheKey);
  if (cachedData !== undefined && cachedData !== null) {
    return cachedData;
  }

  const url = buildCityDataUrl(region, province, city);
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`City data not found for ${city}`);

    const cityData = await response.json();
    await saveToCache(cacheKey, cityData);
    return cityData;
  } catch (err) {
    console.error(`Error fetching city data for "${city}":`, err.message);
    return null;
  }
}

function findBarangayData(cityData, barangayName) {
  if (!cityData?.data) return null;
  const brgy = cityData.data.find(
    (b) => b.barangayName.toUpperCase() === barangayName.toUpperCase()
  );
  return brgy ? calculateBarangayResults(brgy.data) : null;
}

function normalizeString(str) {
  return str.trim().replace(/�/g, "ñ").toUpperCase().replace(/\s+/g, " ");
}

async function loadBarangayData() {
  const loadingEl = document.getElementById("loading");
  const mapEl = document.getElementById("map");
  const renderBtn = document.getElementById("render-btn");

  mapEl.classList.remove("d-none");
  renderBtn.classList.add("d-none");
  loadingEl.classList.remove("d-none");

  const regionFilter = normalizeString(document.getElementById("filterRegion").value);
  const provinceFilter = normalizeString(document.getElementById("filterProvince").value);
  const cityFilter = normalizeString(document.getElementById("filterCity").value);
  const filterResult = document.getElementById("filterResult").value;

  const results = [];
  const cityDataCache = {};

  try {
    const geoData = await fetch("res/Barangays.json").then((res) => res.json());
    const queue = [...geoData.features];

    const processFeature = async (feature) => {
      const props = feature.properties;
      let { REGION: region, PROVINCE: province, NAME_2: city, NAME_3: barangay } = props;

      if (region.toUpperCase() !== "METROPOLITAN MANILA") {
        const match = region.match(/\(([^)]+)\)/);
        region = match ? match[1] : region;
      }
      if (city.includes("City")) city = "City of " + city.replace(" City", "");
      if (barangay.endsWith("Poblacion") && barangay !== "Poblacion") {
        barangay = barangay.replace("Poblacion", "Pob.");
      }

      region = normalizeString(region);
      province = normalizeString(province);
      city = normalizeString(city);
      barangay = normalizeString(barangay);

      props._name = `${barangay}, ${city}, ${province}`;

      const matchesRegion = regionFilter === "ALL" || regionFilter === region;
      const matchesProvince = provinceFilter === "ALL" || provinceFilter === province;
      const matchesCity = cityFilter === "ALL" || cityFilter === city;
      if (!(matchesRegion && matchesProvince && matchesCity)) return;

      const cacheKey = `${region}|${province}|${city}`;
      try {
        if (!cityDataCache[cacheKey]) {
          cityDataCache[cacheKey] = await getDataFromCity(region, province, city);
        }

        const cityData = cityDataCache[cacheKey];
        if (cityData) {
          const result = findBarangayData(cityData, barangay);
          if (result) {
            const top = result.voteTally[filterResult][0];
            props._winner = top.name || "";
            props._votes = top.votes || 0;
          } else {
            props._winner = "No Data";
            props._votes = 0;
          }
        } else {
          props._winner = "";
          props._votes = 0;
        }
        results.push(feature);
      } catch (error) {
        console.error("Processing error:", { region, province, city, barangay }, error);
        props._winner = "Error";
        props._votes = 0;
      }
    };

    while (queue.length > 0) {
      const batch = queue.splice(0, CONCURRENCY_LIMIT);
      await Promise.all(batch.map(processFeature));
      renderMap(results, filterResult); // Partial render for visible progress
    }

  } catch (err) {
    console.error("Failed to load GeoJSON data:", err);
  } finally {
    renderBtn.classList.remove("d-none");
    loadingEl.classList.add("d-none");
  }
}
