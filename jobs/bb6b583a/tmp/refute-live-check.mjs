import { createHash } from 'node:crypto';

async function get(url) {
  const res = await fetch(url, { redirect: 'follow' });
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, bytes: buf.length, buf };
}

const base = 'https://muddytires.ca';
const landing = await get(base + '/');
console.log(`landing: HTTP ${landing.status} (${landing.bytes} bytes)`);
const map = await get(base + '/map');
console.log(`map: HTTP ${map.status} (${map.bytes} bytes)`);
const overlay = await get(base + '/js/crown-land-overlay.js');
const text = overlay.buf.toString('utf8');
const gpr = (text.match(/getProvincialRules/g) || []).length;
const prov = (text.match(/PROVINCIAL/g) || []).length;
console.log(`crown-overlay-js: HTTP ${overlay.status} (${overlay.bytes} bytes) getProvincialRules=${gpr} PROVINCIAL=${prov}`);
// git blob hash: sha1("blob <len>\0" + content)
const gitBlob = createHash('sha1')
  .update(`blob ${overlay.buf.length}\0`)
  .update(overlay.buf)
  .digest('hex');
console.log(`crown-overlay-js git-blob-sha1: ${gitBlob}`);
const pois = await get(base + '/pois.json');
console.log(`pois-json: HTTP ${pois.status} (${pois.bytes} bytes)`);
