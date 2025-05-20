async function getDataFromBarangay(region, province, city, barangay) {
  const basePath = 'data/' +
    region.toUpperCase() + '/' +
    province.toUpperCase() + '/' +
    city.toUpperCase() + '/' +
    barangay.toUpperCase();

  try {
    const response = await fetch(basePath + '/info.json');
    if (!response.ok) throw new Error('Barangay info not found');

    const brgyinfo = await response.json();

    const precinctData = await Promise.all(
      brgyinfo.regions.map(async precinct => {
        const url = `${basePath}/${precinct.name}.json`;
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Precinct info not found for ${precinct.name}`);
          const info = await res.json();
          return info;
        } catch {
          return null;
        }
      })
    );

    return calculateBarangayResults(precinctData); // Array of results from calculateBarangayWinner(info)

  } catch (err) {
    console.error('Error loading barangay or precinct info:', err);
    return null; // Or throw error or return empty array, as needed
  }
}

function loadRegions(results) {
  const mappedData = [];
  fetch('res/' + viewLevelMapRes[filter.viewLevel])
    .then(response => response.json())
    .then(async geojsonData => {
      const features = geojsonData.features;
      const CONCURRENCY_LIMIT = 0;

      // Create a queue of all features
      let queue = [...features];

      async function processFeature(feature) {
        const regionnameRaw = feature.properties.REGION;
        let regionname = regionnameRaw;

        const match = regionname.match(/\(([^)]+)\)/);
        regionname = match ? match[1] : null;

        regionname = cleanString(regionname);

        //CHANGE TO FILTER LOGIC
        var regionsToBeRendered = [
          "Region I", "Region II", "Region III", "Region V", "Region VI", "Region VII", "Region VIII",
          "Region IX", "Region X", "Region XI", "Region XII", "Region XIII", "Region IV-A", "Region IV-B", "ARMM", "CAR", "Metropolitan Manila"
        ]

        const regionalResult = results.filter(item => item.barangayInfo.regionname === regionname);

        if (regionsToBeRendered.includes(regionname)) { //CHANGE TO FILTER LOGIC
          try {
            const winner = getAllWinners(regionalResult);
            feature.properties._winner = winner ? winner.senatorialWinner.name : "";
            feature.properties._votes = winner ? winner.senatorialWinner.votes : "";

          } catch (e) {
            console.error("Error fetching data for:", feature, e);
            feature.properties._winner = "";
            feature.properties._votes = 0;
          }
        } else {
          feature.properties._winner = "";
          feature.properties._votes = 0;
        }
        feature.properties._name = regionname;

        mappedData.push(feature);
      }

      // Process features in limited concurrency batches
      while (queue.length > 0) {
        const batch = queue.splice(0, CONCURRENCY_LIMIT);
        await Promise.all(batch.map(feature => processFeature(feature)));
      }

      renderMap(mappedData);
    })
    .catch(err => console.error('Error loading GeoJSON:', err));
}

function loadBarangayData() {
  const results = [];
  fetch('res/Barangays.json')
    .then(response => response.json())
    .then(async barangayData => {
      const features = barangayData.features;
      const CONCURRENCY_LIMIT = 10;

      // Create a queue of all features
      let queue = [...features];

      async function processFeature(feature) {
        const regionnameRaw = feature.properties.REGION;
        const provincenameRaw = feature.properties.PROVINCE;
        const citynameRaw = feature.properties.NAME_2;
        const brgynameRaw = feature.properties.NAME_3;

        let regionname = regionnameRaw;
        let provincename = provincenameRaw;
        let cityname = citynameRaw;
        let brgyname = brgynameRaw;

        if(regionname != "Metropolitan Manila"){
          const match = regionname.match(/\(([^)]+)\)/);
          regionname = match ? match[1] : null;
        }

        cityname = cityname.includes("City") ? "City of " + cityname.replace(" City", "") : cityname;
        brgyname = (brgyname.endsWith("Poblacion") && brgyname !== "Poblacion") ? brgyname.replace("Poblacion",
          "Pob.") : brgyname;

        regionname = cleanString(regionname);
        provincename = cleanString(provincename);
        cityname = cleanString(cityname);
        brgyname = cleanString(brgyname);

        //REMOVE THIS ONCE ALL DATA IS READY
        var regionsToBeRendered = [
          "Region I", "Region II", "Region III", "Region V", "Region VI", "Region VII", "Region VIII",
          "Region IX", "Region X", "Region XI", "Region XII", "Region XIII", "Region IV-A", "Region IV-B", "ARMM", "CAR", "Metropolitan Manila"
        ]

        if (filter.viewLevel === "Barangay") {
          if (regionsToBeRendered.includes(regionname)) { //REMOVE THIS ONCE ALL DATA IS READY
            try {
              const barangayElectionResults = await getDataFromBarangay(regionname, provincename, cityname, brgyname);
              feature.properties._winner = barangayElectionResults.voteTally.senatorBrgyVotes[0].name;
              feature.properties._votes = barangayElectionResults.voteTally.senatorBrgyVotes[0].votes;

            } catch (e) {
              console.error("Error fetching data for:", feature, e);
              feature.properties._winner = "";
              feature.properties._votes = 0;
            }
          } else {
            feature.properties._winner = "";
            feature.properties._votes = 0;
          }
          feature.properties._name = brgyname + ", " + citynameRaw + ", " + provincename;
          results.push(feature);
        } else {
          if (regionsToBeRendered.includes(regionname)) { //REMOVE THIS ONCE ALL DATA IS READY
            try {
              barangayElectionResults = await getDataFromBarangay(regionname, provincename, cityname, brgyname);
              barangayElectionResults.barangayInfo = {
                "regionname": regionname,
                "provincename": provincename,
                "cityname": cityname,
                "brgyname": brgyname
              };
              results.push(barangayElectionResults);
            } catch (e) {
              console.error("Error fetching data for:", feature, e);
            }
          }
        }
      }

      // Process features in limited concurrency batches
      while (queue.length > 0) {
        const batch = queue.splice(0, CONCURRENCY_LIMIT);
        await Promise.all(batch.map(feature => processFeature(feature)));
      }

      loadingElement.classList.add("d-none");
      mapElement.classList.remove("d-none");
      mapfilter.classList.remove("d-none");
      setTimeout(() => map.invalidateSize(), 0);

      if (filter.viewLevel === "Barangay") {
        renderMap(results);
      } else {
        loadRegions(results);
      }
    })
    .catch(err => console.error('Error loading GeoJSON:', err));
}