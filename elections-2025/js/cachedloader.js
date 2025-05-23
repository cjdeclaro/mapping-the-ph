// Constants
const OWNER = "cjdeclaro";
const REPO = "2025-election-results-web-scrape";
const CONCURRENCY_LIMIT = 100;

const DB_NAME = "ElectionResultsCache";
const STORE_NAME = "CityData";
const DB_VERSION = 1;

let brgyWinners = [];

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
  ).catch(() => undefined); // Fallback if DB fails
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
  ).catch(() => {}); // Silent fail
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

  // Check IndexedDB
  const cachedData = await getFromCache(cacheKey);
  if (cachedData !== undefined && cachedData !== null) {
    return cachedData;
  }

  const url = buildCityDataUrl(region, province, city);
  try {
    const response = await fetch(url, {
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`City data not found for ${city}`);

    const cityData = await response.json();
    await saveToCache(cacheKey, cityData);
    return cityData;
  } catch (err) {
    if (!err.message.includes("City data not found")) {
      console.error(`Error fetching city data for "${city}":`, err.message);
    }
    return null;
  }
}

function findBarangayData(cityData, barangayName) {
  if (!cityData.data) return null;
  const brgy = cityData.data.find(
    (b) => b.barangayName.toUpperCase() === barangayName.toUpperCase()
  );
  return brgy ? calculateBarangayResults(brgy.data) : null;
}

function normalizeString(str) {
  return str.trim().replace(/�/g, "ñ").toUpperCase().replace(/\s+/g, " ");
}

function countBrgyWinner(name) {
  const existing = brgyWinners.find(entry => entry.name === name);

  if (existing) {
    existing.count += 1;
  } else {
    brgyWinners.push({
      name,
      count: 1
    });
  }
}

function renderLegends(filterResult) {
  const legendsEl = document.getElementById("legends");
  brgyWinners = brgyWinners.sort((a, b) => b.count - a.count);
  brgyWinners.forEach(brgyWinner => {
    legendsEl.innerHTML += `
      <div class="card p-2 m-1 d-flex flex-row align-items-center" style="white-space: nowrap; cursor: pointer; background-color: lightgrey" onclick="highlightByName('${brgyWinner.name}', this)">
        <div class="legendsColor" style="background-color: ${colors[filterResult][brgyWinner.name]};"></div>
        <small class="text-body-secondary ms-1">${brgyWinner.name}</small>
      </div>
    `;
  })
}

/** Main loader */
async function loadBarangayData() {
  brgyWinners = [];

  const loadingEl = document.getElementById("loading");
  const mapEl = document.getElementById("map");
  const renderBtn = document.getElementById("render-btn");
  const legendsEl = document.getElementById("legends");

  legendsEl.innerHTML = "";
  mapEl.classList.remove("d-none");
  renderBtn.classList.add("d-none");
  loadingEl.classList.remove("d-none");

  const regionFilter = normalizeString(document.getElementById("filterRegion").value);
  const provinceFilter = normalizeString(document.getElementById("filterProvince").value);
  const cityFilter = normalizeString(document.getElementById("filterCity").value);
  const filterResult = document.getElementById("filterResult").value;

  const results = [];
  const cityDataCache = {};
  const failedCityCache = new Set();

  try {
    const geoData = await fetch("res/Barangays.json").then((res) => res.json());
    const queue = [...geoData.features];

    let batchCount = 0;

    const processFeature = async (feature) => {
      const props = feature.properties;
      let {
        REGION: region,
        PROVINCE: province,
        NAME_2: city,
        NAME_3: barangay
      } = props;

      // Normalize region/city names
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

      if (failedCityCache.has(cacheKey)) {
        props._voteData = null;
        return;
      }

      try {
        if (!cityDataCache[cacheKey]) {
          const cityData = await getDataFromCity(region, province, city);
          if (cityData) {
            cityDataCache[cacheKey] = cityData;
          } else {
            failedCityCache.add(cacheKey);
            props._voteData = null;
            return;
          }
        }

        const cityData = cityDataCache[cacheKey];
        const voteData = findBarangayData(cityData, barangay);

        if (voteData) {
          countBrgyWinner(voteData.voteTally[filterResult][0].name);
        }

        props._voteData = voteData;
        results.push(feature);
      } catch (error) {
        console.error("Processing error:", {
          region,
          province,
          city,
          barangay
        }, error);
        props._voteData = null;
      }
    };

    while (queue.length > 0) {
      const batch = queue.splice(0, CONCURRENCY_LIMIT);
      await Promise.all(batch.map(processFeature));
      batchCount++;

      // Render every 2 batches
      if (batchCount % 2 === 0) {
        renderMap(results, filterResult);
      }
    }

    // Final render
    renderMap(results, filterResult);

  } catch (err) {
    console.error("Failed to load GeoJSON data:", err);
  } finally {
    if (filterResult != "averageVoterTurnOut") {
      renderLegends(filterResult);
    }
    renderBtn.classList.remove("d-none");
    loadingEl.classList.add("d-none");
  }
}