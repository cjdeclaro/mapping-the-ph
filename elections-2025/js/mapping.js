let map;
let geoJsonLayer;
let allLayers = [];

/**
 * Initializes the base map and renders the region outlines.
 */
function renderBaseMap() {
  map = L.map('map', {
    maxZoom: 20,
    minZoom: 6,
    zoomControl: false
  }).setView([13, 122], 6);

  fetch('res/Regions.json')
    .then(response => response.json())
    .then(geojsonData => {
      L.geoJSON(geojsonData, {
        style: {
          color: 'white',
          weight: 1,
          fillColor: 'transparent',
          fillOpacity: 0
        }
      }).addTo(map);
    })
    .catch(err => console.error('Error loading GeoJSON:', err));
}

/**
 * Determines the fill color for a feature based on its type and voting results.
 */
function getFillColor(feature, category, filterResultAdvanced) {
  if (feature.properties.TYPE_3 === "Waterbody") {
    return "#0E87CC";
  }

  let filterName = filterResultAdvanced == "perSenator" || filterResultAdvanced == "compareSenator" ? "senatorBrgyVotes" : category;

  const voteData = feature.properties._voteData;

  if (category == "averageVoterTurnOut") {
    const turnout = voteData?.voteTally?.[category];
    const rounded = Math.round(turnout);
    const opacity = rounded >= 100 ? 99 : rounded;
    return turnout ? "#008000" + ('0' + opacity).slice(-2) : "#ccc";
  } else {
    const winner = voteData?.voteTally?.[filterName]?.[0];
    const color = winner ? colors[category][winner.name] : "#ccc";
    const percentage = winner ? winner.percentage : 0;
    const rounded = percentage ? (Math.round(parseFloat(percentage) * 1)) : 0;
    const opacity = rounded >= 100 ? 99 : rounded;
    return winner ? color + ('0' + opacity).slice(-2) : "#ccc";
  }
}

/**
 * Creates and returns the event handlers for a given layer and feature.
 */
function createFeatureEvents(feature, layer, category, tooltipcount = 12) {
  const name = feature.properties.TYPE_3 === "Waterbody" ?
    `${feature.properties.NAME_3}, ${feature.properties.PROVINCE}` :
    feature.properties._name;

  const voteData = feature.properties._voteData;
  const voterTurnOut = voteData?.voteTally?.averageVoterTurnOut || 0;

  let tooltipText = "";
  if (category == "averageVoterTurnOut") {
    tooltipText = `${name}${voterTurnOut ? `: ${voterTurnOut}%` : ''}`;
  } else {
    const magic12 = voteData?.voteTally?.[category]?.slice(0, tooltipcount);
    const votersCount = voteData?.totalBarangayVoters;
    const votersCountText = votersCount ? `${votersCount} Voters` : '';
    tooltipText = `<strong>${name}</strong> ${votersCountText}<br><br>`;

    if (magic12) {
      let totalVotes = 0;
      const colorBars = [];

      magic12.forEach((v, index) => {
        const senatorName = v.name || "Unknown";
        const voteCount = v.votes || 0;
        const percentage = v.percentage || 0;
        const color = colors[category][senatorName];
        totalVotes += voteCount;

        if (index === 0) {
          tooltipText += `<strong style="color: ${color}">${senatorName}: ${voteCount} votes (${percentage}%)</strong><br>`;
          layer.name = senatorName;
          allLayers.push(layer);
        } else {
          tooltipText += `<span style="color: ${color}">${senatorName}: ${voteCount} votes (${percentage}%)</span><br>`;
        }

        colorBars.push({
          "color": color,
          "votes": voteCount
        });
      });

      tooltipText += `<br><div class="d-flex flex-row">`

      colorBars.forEach(v => {
        const width = Math.round((v.votes/totalVotes)*100);
        tooltipText += `<div style='width: ${width}%; height: 10px; background-color: ${v.color}'></div>`
      });

      tooltipText += `</div>`
    } else {
      tooltipText += `No data available`;
    }
  }

  layer.on({
    mouseover() {
      layer.setStyle({
        // fillColor,
        // fillOpacity: 1.0
      });
      layer.bindTooltip(tooltipText)
        .openTooltip();
    },
    mouseout() {
      layer.setStyle({
        // fillColor,
        // fillOpacity: 0.7
      });
      layer.closeTooltip();
    }
  });
}

/**
 * Renders the map with GeoJSON data and styles/features based on voting results.
 */
function renderMap(results, category, filterResultAdvanced = null, tooltipcount = 12) {
  // Initialize map once
  if (!map) {
    map = L.map('map').setView([13, 122], 6);
    setTimeout(() => map.invalidateSize(), 0);
  }

  // Ensure size recalculation
  setTimeout(() => map.invalidateSize(), 0);

  // Remove previous data layer
  if (geoJsonLayer) {
    map.removeLayer(geoJsonLayer);
  }

  // Add updated GeoJSON layer
  geoJsonLayer = L.geoJSON({
    type: "FeatureCollection",
    features: results
  }, {
    style: feature => ({
      color: getFillColor(feature, category, filterResultAdvanced),
      weight: 1,
      fillOpacity: 1
    }),
    onEachFeature: (feature, layer) => createFeatureEvents(feature, layer, category, tooltipcount)
  }).addTo(map);

  // Fit bounds if valid
  if (geoJsonLayer.getBounds().isValid()) {
    map.fitBounds(geoJsonLayer.getBounds());
  }
}

var currentHighlight = "";
var currentElement;

function highlightByName(name, element) {
  if (currentHighlight != "") {
    currentElement.style.backgroundColor = "lightgrey"
  }

  allLayers.forEach(layer => {
    layer.setStyle({
      fillOpacity: 0.7
    });
  });

  if (currentHighlight !== name) {
    allLayers.forEach(layer => {
      if (layer.name !== name) {
        layer.setStyle({
          fillOpacity: 0
        });
      }
    });
    currentElement = element;
    currentHighlight = name;
    element.style.backgroundColor = "white"
  } else {
    currentHighlight = "";
  }
}