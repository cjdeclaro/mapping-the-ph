// Constants
const OWNER = "cjdeclaro";
const REPO = "2025-election-results-web-scrape";
const CONCURRENCY_LIMIT = 5; // Reduced for better stability
const BATCH_SIZE = 50; // Process in smaller batches

const DB_NAME = "ElectionResultsCache";
const STORE_NAME = "CityData";
const DB_VERSION = 1;

let brgyWinners = [];
let dbConnection = null; // Keep connection open

/** IndexedDB helpers with connection pooling */
async function getDBConnection() {
  if (dbConnection) return dbConnection;
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbConnection = request.result;
      resolve(dbConnection);
    };
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function getFromCache(key) {
  try {
    const db = await getDBConnection();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    return undefined;
  }
}

async function saveToCache(key, data) {
  try {
    const db = await getDBConnection();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(data, key);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    // Silent fail
    return false;
  }
}

async function clearIndexedDBCache() {
  try {
    const db = await getDBConnection();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    console.log("IndexedDB cache cleared.");
  } catch (error) {
    console.error("Failed to clear cache:", error);
  }
}

/** Batch operations for multiple keys */
async function getBatchFromCache(keys) {
  const results = {};
  try {
    const db = await getDBConnection();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      let completed = 0;
      
      keys.forEach(key => {
        const request = store.get(key);
        request.onsuccess = () => {
          if (request.result !== undefined) {
            results[key] = request.result;
          }
          completed++;
          if (completed === keys.length) {
            resolve(results);
          }
        };
        request.onerror = () => {
          completed++;
          if (completed === keys.length) {
            resolve(results);
          }
        };
      });
    });
  } catch (error) {
    return {};
  }
}

/** Build GitHub raw URL for city data */
function buildCityDataUrl(region, province, city) {
  return `https://raw.githubusercontent.com/${OWNER}/${REPO}/refs/heads/main/data/minified_local/${region.toUpperCase()}/${province.toUpperCase()}/${city.toUpperCase()}.json`;
}

/** Batch fetch city data */
async function fetchCityData(region, province, city) {
  const url = buildCityDataUrl(region, province, city);
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    return null;
  }
}

function findBarangayData(cityData, barangayName, filterName = null, filtername2 = null) {
  if (!cityData || !cityData.data) return null;
  const brgy = cityData.data.find(
    (b) => b.barangayName.toUpperCase() === barangayName.toUpperCase()
  );
  return brgy ? calculateBarangayResults(brgy.data, filterName, filtername2) : null;
}

function normalizeString(str) {
  return str.trim().replace(/�/g, "ñ").toUpperCase().replace(/\s+/g, " ");
}

function countBrgyWinner(name) {
  const existing = brgyWinners.find(entry => entry.name === name);
  if (!existing) {
    brgyWinners.push({ name, count: 1 });
  }
}

function renderLegends(filterResult) {
  const legendsEl = document.getElementById("legends");
  brgyWinners = brgyWinners.sort((a, b) => b.count - a.count);
  brgyWinners.forEach(brgyWinner => {
    legendsEl.innerHTML += `
      <div class="glass card p-2 m-1 d-flex flex-row align-items-center" style="white-space: nowrap; cursor: pointer" onclick="highlightByName('${brgyWinner.name}', this)">
        <div class="legendsColor" style="background-color: ${colors[filterResult][brgyWinner.name]};"></div>
        <small class="text-body-secondary ms-1">${brgyWinner.name}</small>
      </div>
    `;
  });
}

/** Main loader with region-by-region processing for "ALL" */
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
  const filterResultAdvanced = document.getElementById("filterResult").value;
  const senatorListFilter = document.getElementById("senatorListFilter").value;
  const senatorListFilter2 = document.getElementById("senatorListFilter2").value;
  const resultCountFilter = document.getElementById("resultCountFilter").value;

  // Name of the Senator choices
  const filterName = filterResultAdvanced == "perSenator" || filterResultAdvanced == "compareSenator" ? senatorListFilter : null;
  const filterName2 = filterResultAdvanced == "compareSenator" ? senatorListFilter2 : null;

  // Assign senatorBrgyVotes as filter
  const filterResult = filterResultAdvanced == "perSenator" || filterResultAdvanced == "compareSenator" ? "senatorBrgyVotes" : filterResultAdvanced;

  const results = [];

  try {
    const geoData = await fetch("res/Barangays.json").then((res) => res.json());
    
    if (regionFilter === "ALL") {
      // Load locations.json to get all regions
      const locations = await fetch("data/locations.json").then((res) => res.json());
      const regions = locations.map(loc => normalizeString(loc.name));
      
      console.log(`Processing ALL regions: ${regions.length} regions found`);
      
      // Process each region separately
      for (let regionIndex = 0; regionIndex < regions.length; regionIndex++) {
        const currentRegion = regions[regionIndex];
        console.log(`Processing region ${regionIndex + 1}/${regions.length}: ${currentRegion}`);
        
        const regionResults = await processRegion(
          geoData, 
          currentRegion, 
          provinceFilter, 
          cityFilter, 
          filterResult,
          filterName,
          filterName2
        );
        
        results.push(...regionResults);
        
        // Render progress every few regions
        if (regionIndex % 3 === 0 || regionIndex === regions.length - 1) {
          renderMap(results, filterResult, filterResultAdvanced, resultCountFilter);
        }
        
        // Allow UI to breathe between regions
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } else {
      // Process single region
      const regionResults = await processRegion(
        geoData, 
        regionFilter, 
        provinceFilter, 
        cityFilter, 
        filterResult,
        filterName,
        filterName2
      );
      results.push(...regionResults);
      
      renderMap(results, filterResult, filterResultAdvanced, resultCountFilter);
    }

    console.log(`Completed processing ${results.length} barangays`);

  } catch (err) {
    console.error("Failed to load data:", err);
  } finally {
    if (filterResult !== "averageVoterTurnOut") {
      renderLegends(filterResult);
    }
    renderBtn.classList.remove("d-none");
    loadingEl.classList.add("d-none");
  }
}

/** Process a single region */
async function processRegion(geoData, targetRegion, provinceFilter, cityFilter, filterResult, filterName, filterName2) {
  // Filter features for this specific region
  const filteredFeatures = geoData.features.filter(feature => {
    const props = feature.properties;
    let { REGION: region, PROVINCE: province, NAME_2: city } = props;

    if (region.toUpperCase() !== "METROPOLITAN MANILA") {
      const match = region.match(/\(([^)]+)\)/);
      region = match ? match[1] : region;
    }
    if (city.includes("City")) city = "City of " + city.replace(" City", "");

    region = normalizeString(region);
    province = normalizeString(province);
    city = normalizeString(city);

    const matchesRegion = region === targetRegion;
    const matchesProvince = provinceFilter === "ALL" || provinceFilter === province;
    const matchesCity = cityFilter === "ALL" || cityFilter === city;
    
    return matchesRegion && matchesProvince && matchesCity;
  });

  console.log(`Processing ${filteredFeatures.length} barangays in region: ${targetRegion}`);

  // Group by city to minimize data fetching
  const citiesMap = new Map();
  filteredFeatures.forEach(feature => {
    const props = feature.properties;
    let { REGION: region, PROVINCE: province, NAME_2: city } = props;

    if (region.toUpperCase() !== "METROPOLITAN MANILA") {
      const match = region.match(/\(([^)]+)\)/);
      region = match ? match[1] : region;
    }
    if (city.includes("City")) city = "City of " + city.replace(" City", "");

    region = normalizeString(region);
    province = normalizeString(province);
    city = normalizeString(city);

    const cityKey = `${region}|${province}|${city}`;
    if (!citiesMap.has(cityKey)) {
      citiesMap.set(cityKey, []);
    }
    citiesMap.get(cityKey).push(feature);
  });

  // Process cities in batches
  const cityKeys = Array.from(citiesMap.keys());
  const cityDataCache = await getBatchFromCache(cityKeys);
  const results = [];

  for (let i = 0; i < cityKeys.length; i += BATCH_SIZE) {
    const batchKeys = cityKeys.slice(i, i + BATCH_SIZE);
    
    // Fetch missing city data with concurrency control
    const semaphore = new Array(CONCURRENCY_LIMIT).fill(Promise.resolve());
    let semaphoreIndex = 0;
    
    const fetchPromises = batchKeys.map(async (cityKey) => {
      // Wait for available slot
      await semaphore[semaphoreIndex];
      const currentIndex = semaphoreIndex;
      semaphoreIndex = (semaphoreIndex + 1) % CONCURRENCY_LIMIT;
      
      try {
        if (cityDataCache[cityKey]) {
          return { cityKey, data: cityDataCache[cityKey] };
        }
        
        const [region, province, city] = cityKey.split('|');
        const data = await fetchCityData(region, province, city);
        if (data) {
          await saveToCache(cityKey, data);
          return { cityKey, data };
        }
        return { cityKey, data: null };
      } finally {
        // Release semaphore slot
        semaphore[currentIndex] = Promise.resolve();
      }
    });

    const fetchResults = await Promise.all(fetchPromises);
    
    // Process barangays for this batch of cities
    fetchResults.forEach(({ cityKey, data: cityData }) => {
      if (!cityData) return;
      
      const features = citiesMap.get(cityKey);
      features.forEach(feature => {
        const props = feature.properties;
        let { NAME_3: barangay } = props;
        
        if (barangay.endsWith("Poblacion") && barangay !== "Poblacion") {
          barangay = barangay.replace("Poblacion", "Pob.");
        }
        barangay = normalizeString(barangay);
        
        const [region, province, city] = cityKey.split('|');
        props._name = `${barangay}, ${city}, ${province}`;

        try {
          const voteData = findBarangayData(cityData, barangay, filterName, filterName2);
          if (voteData) {
            countBrgyWinner(voteData.voteTally[filterResult][0].name);
          }
          props._voteData = voteData;
          results.push(feature);
        } catch (error) {
          console.error("Processing error:", { region, province, city, barangay }, error);
          props._voteData = null;
        }
      });
    });

    // Allow UI to breathe
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  return results;
}