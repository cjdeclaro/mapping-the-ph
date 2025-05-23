const OWNER = "cjdeclaro";
const REPO = "2025-election-results-web-scrape";
const CONCURRENCY_LIMIT = 50;

const DB_NAME = "ElectionResultsCache";
const STORE_NAME = "CityData";
const DB_VERSION = 1;

let dbPromise = null;

/** IndexedDB helpers */
function openIndexedDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
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
  return dbPromise;
}

function getFromCache(key) {
  return openIndexedDB().then((db) =>
    new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    })
  );
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
  );
}

function buildCityDataUrl(region, province, city) {
  const regionPath = region.toUpperCase();
  const provincePath = province.toUpperCase();
  const cityPath = city.toUpperCase();
  return `https://raw.githubusercontent.com/${OWNER}/${REPO}/refs/heads/main/data/minified_local/${regionPath}/${provincePath}/${cityPath}.json`;
}

async function getDataFromCity(region, province, city) {
  const cacheKey = `${region}|${province}|${city}`;
  const cachedData = await getFromCache(cacheKey);
  if (cachedData !== undefined) {
    return cachedData;
  }

  const url = buildCityDataUrl(region, province, city);
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`City data not found for ${city}`);
    const cityData = await response.json();
    await saveToCache(cacheKey, cityData);
    return cityData;
  } catch (err) {
    console.error(`Error fetching city data for "${city}":`, err.message);
    await saveToCache(cacheKey, null);
    return null;
  }
}

function findBarangayData(cityData, barangayName) {
  if (!cityData.data) return null;
  const barangayEntry = cityData.data.find(
    (brgy) => brgy.barangayName.toUpperCase() === barangayName.toUpperCase()
  );
  return barangayEntry ? calculateBarangayResults(barangayEntry.data) : null;
}

function normalizeString(str) {
  return str.trim().replace(/�/g, "ñ").toUpperCase().replace(/\s+/g, " ");
}

function normalizeAll(props) {
  let region = props.REGION;
  let province = props.PROVINCE;
  let city = props.NAME_2;
  let barangay = props.NAME_3;

  if (region.toUpperCase() !== "METROPOLITAN MANILA") {
    const match = region.match(/\(([^)]+)\)/);
    region = match ? match[1] : region;
  }

  if (city.includes("City")) city = "City of " + city.replace(" City", "");
  if (barangay.endsWith("Poblacion") && barangay !== "Poblacion") {
    barangay = barangay.replace("Poblacion", "Pob.");
  }

  return {
    region: normalizeString(region),
    province: normalizeString(province),
    city: normalizeString(city),
    barangay: normalizeString(barangay)
  };
}

async function loadBarangayData() {
  const loadingEl = document.getElementById("loading");
  const mapEl = document.getElementById("map");
  const renderBtn = document.getElementById("render-btn");

  renderBtn.classList.add("d-none");
  loadingEl.classList.remove("d-none");

  const regionFilter = normalizeString(document.getElementById("filterRegion").value);
  const provinceFilter = normalizeString(document.getElementById("filterProvince").value);
  const cityFilter = normalizeString(document.getElementById("filterCity").value);
  const filterResult = document.getElementById("filterResult").value;

  const results = [];
  const cityDataCache = {};

  fetch("res/Barangays.json")
    .then((response) => response.json())
    .then(async ({
      features
    }) => {
      const filteredFeatures = features.filter((f) => {
        const {
          region,
          province,
          city
        } = normalizeAll(f.properties);
        return (
          (regionFilter === "ALL" || regionFilter === region) &&
          (provinceFilter === "ALL" || provinceFilter === province) &&
          (cityFilter === "ALL" || cityFilter === city)
        );
      });

      let queue = [...filteredFeatures];

      async function processFeature(feature) {
        const props = feature.properties;
        const {
          region,
          province,
          city,
          barangay
        } = normalizeAll(props);
        props._name = `${barangay}, ${city}, ${province}`;
        const cacheKey = `${region}|${province}|${city}`;

        try {
          if (!cityDataCache[cacheKey]) {
            cityDataCache[cacheKey] = await getDataFromCity(region, province, city);
          }

          const cityData = cityDataCache[cacheKey];
          if (cityData) {
            const electionResults = findBarangayData(cityData, barangay);
            if (electionResults) {
              const topCandidate = electionResults.voteTally[filterResult][0];
              props._winner = topCandidate.name || "";
              props._votes = topCandidate.votes || 0;
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
          console.error("Processing error:", {
            region,
            province,
            city,
            barangay
          }, error);
          props._winner = "Error";
          props._votes = 0;
          results.push(feature);
        }
      }

      async function processAndRenderNextBatch() {
        if (queue.length === 0) {
          renderBtn.classList.remove("d-none");
          loadingEl.classList.add("d-none");
          return;
        }

        const batch = queue.splice(0, CONCURRENCY_LIMIT);
        await Promise.all(batch.map(processFeature));
        renderMap([...results], filterResult); // render progressively

        // Give browser time to paint before next batch
        setTimeout(processAndRenderNextBatch, 0);
      }

      mapEl.classList.remove("d-none");
      processAndRenderNextBatch(); // start batch rendering
    })
    .catch((err) => {
      console.error("Failed to load GeoJSON data:", err);
    });
}

function clearIndexedDBCache() {
  return openIndexedDB().then((db) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    console.log("IndexedDB cache cleared.");
  });
}
