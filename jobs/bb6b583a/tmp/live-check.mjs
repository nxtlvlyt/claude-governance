// e2e audit scratch: verify muddytires.ca is live-serving the gap-#8 deliverables (read-only GETs)
const targets = [
  { name: 'landing', url: 'https://muddytires.ca/' },
  { name: 'map', url: 'https://muddytires.ca/map' },
  { name: 'crown-overlay-js', url: 'https://muddytires.ca/js/crown-land-overlay.js', markers: ['getProvincialRules', 'PROVINCIAL'] },
  { name: 'pois-json', url: 'https://muddytires.ca/pois.json' },
];
for (const t of targets) {
  try {
    const res = await fetch(t.url, { redirect: 'follow' });
    const body = await res.text();
    let markerReport = '';
    if (t.markers) {
      markerReport = ' markers: ' + t.markers.map(m => `${m}=${(body.match(new RegExp(m, 'g')) || []).length}`).join(' ');
    }
    console.log(`${t.name}: HTTP ${res.status} (${body.length} bytes)${markerReport}`);
  } catch (e) {
    console.log(`${t.name}: FETCH-ERROR ${e.message}`);
  }
}
