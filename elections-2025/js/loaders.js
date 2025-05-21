var owner = "cjdeclaro";
var repo = "2025-election-results-web-scrape";

async function getDataFromBarangay(region, province, city, barangay) {
  const path = `${region.toUpperCase()}/${province.toUpperCase()}/${city.toUpperCase()}/${barangay.toUpperCase()}`;
  const basePath = `https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/main/data/local/${path}`;

  try {
    const response = await fetch(`${basePath}/info.json`);
    if (!response.ok) throw new Error('Barangay info not found');

    const brgyInfo = await response.json();

    const precinctData = await Promise.all(
      brgyInfo.regions.map(async (precinct) => {
        const url = `${basePath}/${precinct.name}.json`;
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Precinct info not found for ${precinct.name}`);
          return await res.json();
        } catch {
          return null;
        }
      })
    );

    return calculateBarangayResults(precinctData);
  } catch (err) {
    console.error('Error loading barangay or precinct info:', err);
    return null;
  }
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
            const electionResults = await getDataFromBarangay(region, province, city, barangay);
            props._winner = electionResults.voteTally.senatorBrgyVotes[0].name;
            props._votes = electionResults.voteTally.senatorBrgyVotes[0].votes;
          } catch (e) {
            console.error("Error fetching data for:", feature, e);
            props._winner = "";
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
