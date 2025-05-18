function renderMap(results) {
  const geoJsonLayer = L.geoJSON({
    type: "FeatureCollection",
    features: results
  }, {
    style: function (feature) {
      const winnerName = feature.properties._winner;
      const fillcolor = feature.properties.TYPE_3 == "Waterbody" ? "#0E87CC" : senatorialColors[
        winnerName];
      return {
        color: fillcolor,
        weight: 1,
        fillOpacity: 0.3
      };
    },
    onEachFeature: function (feature, layer) {
      var name = feature.properties._name;
      if (feature.properties.TYPE_3 == "Waterbody") {
        name = feature.properties.NAME_3 + ", " + feature.properties.PROVINCE;
      }
      name = cleanString(name);
      const winnerName = feature.properties._winner;
      const winnerVotes = feature.properties._votes;
      const fillcolor = feature.properties.TYPE_3 == "Waterbody" ? "#0E87CC" : senatorialColors[
        winnerName];

      layer.on({
        mouseover: function () {
          layer.setStyle({
            fillColor: fillcolor,
            fillOpacity: 0.7
          });
          layer.bindTooltip(name + (winnerName ? ": " + winnerName + " " + winnerVotes + " votes" : ""))
            .openTooltip();
        },
        mouseout: function () {
          layer.setStyle({
            fillColor: fillcolor,
            fillOpacity: 0.3
          });
          layer.closeTooltip();
        }
      });
    }
  }).addTo(map);
}