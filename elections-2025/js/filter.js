var filterregionname = "ALL";

const regionFilter = document.getElementById("filterRegion");
const provinceFilter = document.getElementById("filterProvince");
const cityFilter = document.getElementById("filterCity");

var owner = "cjdeclaro";
var repo = "2025-election-results-web-scrape";

async function getLocationNames( regionName = null, provinceName = null) {
  const response = await fetch('data/locations.json');
  const locations = await response.json();
  if (!regionName) {
    // Return array of region names
    return locations.map(region => region.name);
  }

  const region = locations.find(r => r.name === regionName);
  if (!region) return [];

  if (!provinceName) {
    // Return array of province names in the region
    return region.locations.map(province => province.name);
  }

  const province = region.locations.find(p => p.name === provinceName);
  if (!province) return [];

  // Return array of city names in the province
  return province.locations.map(city => city.name);
}

function createOption(value) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = value;
  return option;
}

function populateSelect(selectElement, values, defaultValue = "ALL") {
  selectElement.innerHTML = "";
  selectElement.appendChild(createOption(defaultValue));
  values.forEach(value => {
    selectElement.appendChild(createOption(value));
  });
}

async function loadRegionOptions() {
  try {
    const regionNames = await getLocationNames();
    populateSelect(regionFilter, regionNames);
  } catch (error) {
    console.error("Failed to load regions:", error);
  }
}

async function loadProvinceOptions(regionname) {
  filterregionname = regionname;
  provinceFilter.disabled = regionname === "ALL";
  cityFilter.disabled = true;

  populateSelect(cityFilter, [], "ALL");

  if (regionname === "ALL") {
    populateSelect(provinceFilter, [], "ALL");
    return;
  }

  try {
    const provinceNames = await getLocationNames(regionname);
    populateSelect(provinceFilter, provinceNames);
  } catch (error) {
    console.error("Failed to load provinces:", error);
  }
}

async function loadCityOptions(provincename) {
  cityFilter.disabled = provincename === "ALL";

  if (provincename === "ALL") {
    populateSelect(cityFilter, [], "ALL");
    return;
  }

  try {
    const cityNames = await getLocationNames(filterregionname, provincename);
    populateSelect(cityFilter, cityNames);
  } catch (error) {
    console.error("Failed to load cities:", error);
  }
}