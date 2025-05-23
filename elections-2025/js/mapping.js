let map;
let geoJsonLayer;

/**
 * Initializes the base map and renders the region outlines.
 */
function renderBaseMap() {
  map = L.map('map').setView([13, 122], 6);
  fetch('res/Regions.json')
    .then(response => response.json())
    .then(geojsonData => {
      L.geoJSON(geojsonData, {
        style: {
          color: '#3388ff',
          weight: 1,
          fillOpacity: 0.1
        }
      }).addTo(map);
    })
    .catch(err => console.error('Error loading GeoJSON:', err));
}

/**
 * Determines the fill color for a feature based on its type and voting results.
 */
function getFillColor(feature, category) {
  if (feature.properties.TYPE_3 === "Waterbody") {
    return "#0E87CC";
  }

  const voteData = feature.properties._voteData;

  if (category == "averageVoterTurnOut") {
    const turnout = voteData?.voteTally?.[category];
    const rounded = Math.round(turnout / 10) * 10;
    return turnout ? colors[category][rounded] : "#ccc";
  } else {
    const winner = voteData?.voteTally?.[category]?.[0];
    return winner ? colors[category][winner.name] : "#ccc";
  }
}

/**
 * Creates and returns the event handlers for a given layer and feature.
 */
function createFeatureEvents(feature, layer, category) {
  const name = feature.properties.TYPE_3 === "Waterbody" ?
    `${feature.properties.NAME_3}, ${feature.properties.PROVINCE}` :
    feature.properties._name;

  const voteData = feature.properties._voteData;
  const winner = voteData?.voteTally?.[category]?.[0];
  const winnerName = winner?.name || "";
  const winnerVotes = winner?.votes || 0;
  const fillColor = getFillColor(feature, category);
  const voterTurnOut = voteData?.voteTally?.averageVoterTurnOut || 0;

  let tooltipText = "";
  if (category == "averageVoterTurnOut") {
    tooltipText = `${name}${voterTurnOut ? `: ${voterTurnOut}%` : ''}`;
  } else {
    const magic12 = voteData?.voteTally?.[category]?.slice(0, 12);
    tooltipText = `<strong>${name}</strong><br><br>`;

    magic12.forEach((v, index) => {
      const senatorName = v.name || "Unknown";
      const voteCount = v.votes || 0;

      if (index === 0) {
        tooltipText += `<strong>${senatorName}: ${voteCount} votes</strong><br>`;
      } else {
        tooltipText += `${senatorName}: ${voteCount} votes<br>`;
      }
    });
  }

  layer.on({
    mouseover() {
      layer.setStyle({
        fillColor,
        fillOpacity: 1.0
      });
      layer.bindTooltip(tooltipText)
        .openTooltip();
    },
    mouseout() {
      layer.setStyle({
        fillColor,
        fillOpacity: 0.7
      });
      layer.closeTooltip();
    }
  });
}

/**
 * Renders the map with GeoJSON data and styles/features based on voting results.
 */
function renderMap(results, category) {
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
      color: getFillColor(feature, category),
      weight: 1,
      fillOpacity: 0.7
    }),
    onEachFeature: (feature, layer) => createFeatureEvents(feature, layer, category)
  }).addTo(map);

  // Fit bounds if valid
  if (geoJsonLayer.getBounds().isValid()) {
    map.fitBounds(geoJsonLayer.getBounds());
  }
}