var owner = "cjdeclaro";
var repo = "2025-election-results-web-scrape";

// New function to fetch data from the consolidated city files
async function getDataFromCity(region, province, city) {
  const regionPath = region.toUpperCase();
  const provincePath = province.toUpperCase();
  const cityPath = city.toUpperCase();
  
  // Path to the consolidated city JSON file
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/main/data/minified_local/${regionPath}/${provincePath}/${cityPath}.json`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`City data not found for ${city}`);
    
    const cityData = await response.json();
    return cityData;
  } catch (err) {
    console.error(`Error loading city data for ${city}:`, err);
    return null;
  }
}

// Function to find barangay data within the city data
function findBarangayData(cityData, barangayName) {
  if (!cityData || !cityData.data) return null;
  
  // Find the barangay in the city data
  const barangayEntry = cityData.data.find(brgy => 
    brgy.barangayName.toUpperCase() === barangayName.toUpperCase()
  );
  
  if (!barangayEntry) return null;
  
  // Calculate the combined results from all precincts in this barangay
  return calculateBarangayResults(barangayEntry.data);
}

function loadBarangayData() {
  const loadingElement = document.getElementById("loading");
  const mapElement = document.getElementById("map");
  const renderBtn = document.getElementById("render-btn");

  renderBtn.classList.add("d-none");
  loadingElement.classList.remove("d-none");

  const regionFilter = document.getElementById("filterRegion").value;
  const provinceFilter = document.getElementById("filterProvince").value;
  const cityFilter = document.getElementById("filterCity").value;

  const results = [];
  const cityDataCache = {}; // Cache to store fetched city data

  fetch('res/Barangays.json')
    .then((response) => response.json())
    .then(async (barangayData) => {
      const features = barangayData.features;
      const CONCURRENCY_LIMIT = 10;
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

        if (city.includes("City")) {
          city = "City of " + city.replace(" City", "");
        }

        if (barangay.endsWith("Poblacion") && barangay !== "Poblacion") {
          barangay = barangay.replace("Poblacion", "Pob.");
        }

        region = cleanString(region);
        province = cleanString(province);
        city = cleanString(city);
        barangay = cleanString(barangay);

        props._name = `${barangay}, ${props.NAME_2}, ${province}`;

        const matchesRegion = regionFilter === "ALL" || regionFilter.toUpperCase() === region.toUpperCase();
        const matchesProvince = provinceFilter === "ALL" || provinceFilter.toUpperCase() === province.toUpperCase();
        const matchesCity = cityFilter === "ALL" || cityFilter.toUpperCase() === city.toUpperCase();

        if (matchesRegion && matchesProvince && matchesCity) {
          try {
            // Create a cache key for this city
            const cacheKey = `${region}|${province}|${city}`;
            
            // Check if we've already fetched this city's data
            if (!cityDataCache[cacheKey]) {
              cityDataCache[cacheKey] = await getDataFromCity(region, province, city);
            }
            
            const cityData = cityDataCache[cacheKey];
            if (cityData) {
              // Find the specific barangay data within the city data
              const electionResults = findBarangayData(cityData, barangay);
              
              if (electionResults) {
                props._winner = electionResults.voteTally.senatorBrgyVotes[0].name;
                props._votes = electionResults.voteTally.senatorBrgyVotes[0].votes;
              } else {
                props._winner = "No Data";
                props._votes = 0;
              }
            } else {
              props._winner = "City Not Found";
              props._votes = 0;
            }
          } catch (e) {
            console.error("Error fetching data for:", feature, e);
            props._winner = "Error";
            props._votes = 0;
          }

          results.push(feature);
        }
      }

      while (queue.length > 0) {
        const batch = queue.splice(0, CONCURRENCY_LIMIT);
        await Promise.all(batch.map(processFeature));
      }

      renderBtn.classList.remove("d-none");
      loadingElement.classList.add("d-none");
      mapElement.classList.remove("d-none");

      renderMap(results);
    })
    .catch((err) => {
      console.error('Error loading GeoJSON:', err);
    });
}