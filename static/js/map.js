const map = L.map('map').setView([5.6045, -0.1872], 16);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

const infoBox = document.getElementById('infoBox');
let zones = [];
let currentZone = null;
let audios = {}; // store preloaded audio elements

// Utility: fade volume smoothly
function fadeAudio(audio, targetVolume, duration = 1000) {
  const step = (targetVolume - audio.volume) / (duration / 50);
  const interval = setInterval(() => {
    audio.volume = Math.min(Math.max(audio.volume + step, 0), 1);
    if ((step < 0 && audio.volume <= targetVolume) || (step > 0 && audio.volume >= targetVolume)) {
      clearInterval(interval);
      audio.volume = targetVolume;
      if (targetVolume === 0) audio.pause();
    }
  }, 50);
}

// Load zones and preload audios
fetch("/static/data/zones.geojson")
  .then(res => res.json())
  .then(data => {
    zones = data.features;

    zones.forEach(feature => {
      // Draw polygons
      L.geoJSON(feature, {
        style: { color: "#007bff", fillOpacity: 0.3 },
        onEachFeature: (f, layer) => layer.bindPopup(f.properties.name)
      }).addTo(map);

      // Preload audio if defined
      if (feature.properties.audio) {
        const audio = new Audio(feature.properties.audio);
        audio.loop = true; // loop while in zone
        audio.volume = 0;  // start silent
        audios[feature.properties.name] = audio;
      }
    });
  });

// Watch user location
navigator.geolocation.watchPosition(
  pos => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    const userPoint = turf.point([lon, lat]);
    L.circleMarker([lat, lon], { radius: 6, color: "red" }).addTo(map);
    map.setView([lat, lon]);

    let insideZone = null;

    zones.forEach(feature => {
      if (turf.booleanPointInPolygon(userPoint, feature)) {
        insideZone = feature;
      }
    });

    if (insideZone && insideZone.properties.name !== currentZone) {
      const newZoneName = insideZone.properties.name;
      const newZone = audios[newZoneName];
      const oldZone = audios[currentZone];

      infoBox.innerText = insideZone.properties.message;
      infoBox.style.display = "block";

      // Handle audio transitions
      if (oldZone && oldZone !== newZone) fadeAudio(oldZone, 0);
      if (newZone) {
        newZone.currentTime = 0;
        newZone.play().catch(() => console.log("Autoplay blocked until user interacts."));
        fadeAudio(newZone, 1);
      }

      currentZone = newZoneName;
    } else if (!insideZone && currentZone) {
      const leavingAudio = audios[currentZone];
      if (leavingAudio) fadeAudio(leavingAudio, 0);
      currentZone = null;
      infoBox.style.display = "none";
    }
  },
  err => console.error(err),
  { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
);
