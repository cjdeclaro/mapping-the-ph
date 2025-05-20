var filterregionname = "ALL";

const regionFilter = document.getElementById("filterRegion");
const provinceFilter = document.getElementById("filterProvince");
const cityFilter = document.getElementById("filterCity");

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
    const response = await fetch("data/info.json");
    const data = await response.json();
    const regionNames = data.regions.map(region => region.name);
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
    const response = await fetch(`data/${regionname}/info.json`);
    const data = await response.json();
    const provinceNames = data.regions.map(region => region.name);
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
    const response = await fetch(`data/${filterregionname}/${provincename}/info.json`);
    const data = await response.json();
    const cityNames = data.regions.map(region => region.name);
    populateSelect(cityFilter, cityNames);
  } catch (error) {
    console.error("Failed to load cities:", error);
  }
}
