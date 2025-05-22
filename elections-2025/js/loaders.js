const OWNER = "cjdeclaro";
const REPO = "2025-election-results-web-scrape";
const CONCURRENCY_LIMIT = 10;

/**
 * Helper to build GitHub raw URL for a given city JSON.
 */
function buildCityDataUrl(region, province, city) {
  const regionPath = region.toUpperCase();
  const provincePath = province.toUpperCase();
  const cityPath = city.toUpperCase();

  return `https://raw.githubusercontent.com/${OWNER}/${REPO}/refs/heads/main/data/minified_local/${regionPath}/${provincePath}/${cityPath}.json`;
}

/**
 * Fetch city JSON data from the GitHub repo.
 */
async function getDataFromCity(region, province, city) {
  const url = buildCityDataUrl(region, province, city);
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`City data not found for ${city}`);
    return await response.json();
  } catch (err) {
    console.error(`Error fetching city data for "${city}":`, err.message);
    return null;
  }
}

/**
 * Find and summarize barangay data within city data.
 */
function findBarangayData(cityData, barangayName) {
  if (!cityData?.data) return null;

  const barangayEntry = cityData.data.find(
    (brgy) => brgy.barangayName.toUpperCase() === barangayName.toUpperCase()
  );

  return barangayEntry ? calculateBarangayResults(barangayEntry.data) : null;
}

/**
 * Standardize input strings.
 */
function normalizeString(str) {
  return str.trim().toUpperCase().replace(/\s+/g, " ");
}

/**
 * Main function to load barangay data and render to map.
 */
function loadBarangayData() {
  const loadingEl = document.getElementById("loading");
  const mapEl = document.getElementById("map");
  const renderBtn = document.getElementById("render-btn");

  renderBtn.classList.add("d-none");
  loadingEl.classList.remove("d-none");

  const regionFilter = normalizeString(document.getElementById("filterRegion").value);
  const provinceFilter = normalizeString(document.getElementById("filterProvince").value);
  const cityFilter = normalizeString(document.getElementById("filterCity").value);

  const results = [];
  const cityDataCache = {};

  fetch("res/Barangays.json")
    .then((response) => response.json())
    .then(async ({ features }) => {
      let queue = [...features];

      async function processFeature(feature) {
        const props = feature.properties;
        let region = props.REGION;
        let province = props.PROVINCE;
        let city = props.NAME_2;
        let barangay = props.NAME_3;

        if (region.toUpperCase() !== "METROPOLITAN MANILA") {
          const match = region.match(/\(([^)]+)\)/);
          region = match ? match[1] : region;
        }

        // Normalize city naming
        if (city.includes("City")) city = "City of " + city.replace(" City", "");
        if (barangay.endsWith("Poblacion") && barangay !== "Poblacion") {
          barangay = barangay.replace("Poblacion", "Pob.");
        }

        // Normalize all strings for matching and path use
        region = normalizeString(region);
        province = normalizeString(province);
        city = normalizeString(city);
        barangay = normalizeString(barangay);

        props._name = `${barangay}, ${props.NAME_2}, ${province}`;

        // Match filters
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
            const electionResults = findBarangayData(cityData, barangay);

            if (electionResults) {
              const topCandidate = electionResults.voteTally?.senatorBrgyVotes?.[0];
              props._winner = topCandidate?.name || "No Winner";
              props._votes = topCandidate?.votes || 0;
            } else {
              props._winner = "No Data";
              props._votes = 0;
            }
          } else {
            props._winner = "City Not Found";
            props._votes = 0;
          }

          results.push(feature);
        } catch (error) {
          console.error("Processing error:", { region, province, city, barangay }, error);
          props._winner = "Error";
          props._votes = 0;
        }
      }

      // Process with concurrency limit
      while (queue.length > 0) {
        const batch = queue.splice(0, CONCURRENCY_LIMIT);
        await Promise.all(batch.map(processFeature));
      }

      // Finish up UI changes
      renderBtn.classList.remove("d-none");
      loadingEl.classList.add("d-none");
      mapEl.classList.remove("d-none");

      renderMap(results);
    })
    .catch((err) => {
      console.error("Failed to load GeoJSON data:", err);
    });
}
