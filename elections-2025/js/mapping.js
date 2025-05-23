let map;
let geoJsonLayer;

function renderMap(results, category) {
  // Initialize map only once
  if (!map) {
    map = L.map('map').setView([13, 122], 6);
    setTimeout(() => map.invalidateSize(), 0);
  }

  // Remove previous layer if it exists
  if (geoJsonLayer) {
    map.removeLayer(geoJsonLayer);
  }

  // Add new GeoJSON layer
  geoJsonLayer = L.geoJSON({
    type: "FeatureCollection",
    features: results
  }, {
    style: function (feature) {
      const winnerName = feature.properties._winner;
      const fillcolor = feature.properties.TYPE_3 == "Waterbody" ? "#0E87CC" : colors[winnerName];
      return {
        color: fillcolor,
        weight: 1,
        fillOpacity: 0.7
      };
    },
    onEachFeature: function (feature, layer) {
      var name = feature.properties._name;
      if (feature.properties.TYPE_3 == "Waterbody") {
        name = feature.properties.NAME_3 + ", " + feature.properties.PROVINCE;
      }

      const winnerName = feature.properties._winner;
      const winnerVotes = feature.properties._votes;
      const fillcolor = feature.properties.TYPE_3 == "Waterbody" ? "#0E87CC" : colors[winnerName];

      layer.on({
        mouseover: function () {
          layer.setStyle({
            fillColor: fillcolor,
            fillOpacity: 1.0
          });
          layer.bindTooltip(name + (winnerName ? ": " + winnerName + " " + winnerVotes + " votes" : ""))
            .openTooltip();
        },
        mouseout: function () {
          layer.setStyle({
            fillColor: fillcolor,
            fillOpacity: 0.7
          });
          layer.closeTooltip();
        }
      });
    }
  }).addTo(map);

  if (geoJsonLayer.getBounds().isValid()) {
    map.fitBounds(geoJsonLayer.getBounds());
  }
}
