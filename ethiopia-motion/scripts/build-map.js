/**
 * build-map.js
 * Projects Natural Earth 1:50m country boundaries (via the public-domain
 * `world-atlas` TopoJSON) into 1920x1080 SVG path data.
 *
 * Because every country is decoded from the SAME TopoJSON topology, countries
 * that share a border share the exact same arc coordinates. Ethiopia's outline
 * is therefore coincident with the outlines of Eritrea, Djibouti, Somalia,
 * Somaliland, Kenya, South Sudan and Sudan to the last decimal - no slivers,
 * no gaps, no overlaps once Ethiopia is lifted out of the continent.
 */
const fs = require('fs');
const path = require('path');
const topojson = require('topojson-client');
const d3 = require('d3-geo');

const W = 1920;
const H = 1080;
const PAD = 56;               // vertical breathing room around the continent
const ETHIOPIA_ID = '231';

// ISO 3166-1 numeric codes for Africa (Natural Earth admin-0).
// Remote outliers (Mauritius 480, Seychelles 690, Saint Helena 654) are left
// out so the framing stays tight on the continent itself.
const AFRICA_IDS = new Set([
  '012', // Algeria
  '024', // Angola
  '072', // Botswana
  '108', // Burundi
  '120', // Cameroon
  '132', // Cabo Verde
  '140', // Central African Rep.
  '148', // Chad
  '174', // Comoros
  '178', // Congo
  '180', // Dem. Rep. Congo
  '204', // Benin
  '226', // Eq. Guinea
  '231', // Ethiopia
  '232', // Eritrea
  '262', // Djibouti
  '266', // Gabon
  '270', // Gambia
  '288', // Ghana
  '324', // Guinea
  '624', // Guinea-Bissau
  '384', // Cote d'Ivoire
  '404', // Kenya
  '426', // Lesotho
  '430', // Liberia
  '434', // Libya
  '450', // Madagascar
  '454', // Malawi
  '466', // Mali
  '478', // Mauritania
  '504', // Morocco
  '508', // Mozambique
  '516', // Namibia
  '562', // Niger
  '566', // Nigeria
  '646', // Rwanda
  '678', // Sao Tome and Principe
  '686', // Senegal
  '694', // Sierra Leone
  '706', // Somalia
  '710', // South Africa
  '716', // Zimbabwe
  '728', // South Sudan
  '729', // Sudan
  '748', // Eswatini
  '768', // Togo
  '788', // Tunisia
  '800', // Uganda
  '834', // Tanzania
  '854', // Burkina Faso
  '894', // Zambia
  '818', // Egypt
  '732', // Western Sahara
]);
// Natural Earth carries Somaliland as a de-facto entity with no ISO code.
const AFRICA_NAMES = new Set(['Somaliland']);

const topo = require('world-atlas/countries-50m.json');
const all = topojson.feature(topo, topo.objects.countries).features;

const africa = all.filter(
  (f) => AFRICA_IDS.has(String(f.id)) || AFRICA_NAMES.has(f.properties.name)
);

const missing = [...AFRICA_IDS].filter(
  (id) => !africa.some((f) => String(f.id) === id)
);
if (missing.length) console.warn('WARN: ids not found in topology:', missing);

// Natural Earth attaches far-flung dependencies to their parent country
// (South Africa carries the sub-Antarctic Prince Edward Islands ~1800km
// offshore, for instance). Left in, they inflate the fitted bounding box and
// shrink the continent. Drop any polygon ring whose centre falls outside the
// African window; mainland and near-shore boundaries are untouched.
const LON = [-26, 53];
const LAT = [-36, 38];
const dropped = [];

function ringCentre(ring) {
  let x = 0, y = 0;
  for (const [lon, lat] of ring) { x += lon; y += lat; }
  return [x / ring.length, y / ring.length];
}
function inAfrica(poly) {
  const [lon, lat] = ringCentre(poly[0]);
  return lon >= LON[0] && lon <= LON[1] && lat >= LAT[0] && lat <= LAT[1];
}
for (const f of africa) {
  if (f.geometry.type !== 'MultiPolygon') continue;
  const keep = f.geometry.coordinates.filter(inAfrica);
  if (keep.length === f.geometry.coordinates.length) continue;
  const lost = f.geometry.coordinates.filter((p) => !inAfrica(p));
  for (const p of lost) {
    const [lon, lat] = ringCentre(p[0]);
    dropped.push(`${f.properties.name} @ ${lon.toFixed(1)},${lat.toFixed(1)}`);
  }
  f.geometry.coordinates = keep;
}
if (dropped.length) console.log('outlying islands dropped :', dropped.join('; '));

const ethiopia = africa.find((f) => String(f.id) === ETHIOPIA_ID);
if (!ethiopia) throw new Error('Ethiopia (231) not found in topology');

// Albers-style equal-area conic tuned to Africa's latitude span.
const projection = d3
  .geoConicEqualArea()
  .parallels([-18, 32])
  .rotate([-20, 0])
  .center([0, 2]);

const collection = { type: 'FeatureCollection', features: africa };
projection.fitExtent(
  [
    [PAD, PAD],
    [W - PAD, H - PAD],
  ],
  collection
);

/** geoPath context that rounds to 2dp - keeps the emitted SVG small. */
function roundingContext(digits = 2) {
  const parts = [];
  const r = (n) => +n.toFixed(digits);
  return {
    toString: () => parts.join(''),
    moveTo: (x, y) => parts.push(`M${r(x)},${r(y)}`),
    lineTo: (x, y) => parts.push(`L${r(x)},${r(y)}`),
    arc: () => {},
    closePath: () => parts.push('Z'),
  };
}
function toPath(feature) {
  const ctx = roundingContext();
  d3.geoPath(projection, ctx)(feature);
  return ctx.toString();
}

const geoPath = d3.geoPath(projection);
const [[x0, y0], [x1, y1]] = geoPath.bounds(ethiopia);
const [cx, cy] = geoPath.centroid(ethiopia);

const out = {
  width: W,
  height: H,
  projection: 'geoConicEqualArea parallels[-18,32] rotate[-20,0]',
  source: 'Natural Earth 1:50m via world-atlas (public domain)',
  ethiopia: {
    id: ETHIOPIA_ID,
    d: toPath(ethiopia),
    bbox: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
    centroid: { x: cx, y: cy },
  },
  countries: africa
    .filter((f) => String(f.id) !== ETHIOPIA_ID)
    .map((f) => ({
      id: String(f.id),
      name: f.properties.name,
      d: toPath(f),
    })),
};

const srcDir = path.join(__dirname, '..', 'src');
const dest = path.join(srcDir, 'africa.json');
fs.writeFileSync(dest, JSON.stringify(out));
// Also emit a plain <script>-loadable copy so index.html works over file://
// with no web server and no fetch().
fs.writeFileSync(
  path.join(srcDir, 'africa.js'),
  'window.AFRICA_DATA = ' + JSON.stringify(out) + ';\n'
);

console.log(`countries rendered : ${out.countries.length + 1} (incl. Ethiopia)`);
console.log(
  `Ethiopia bbox      : x=${x0.toFixed(1)} y=${y0.toFixed(1)} ` +
    `w=${(x1 - x0).toFixed(1)} h=${(y1 - y0).toFixed(1)}`
);
console.log(`Ethiopia centroid  : ${cx.toFixed(1)}, ${cy.toFixed(1)}`);
console.log(`wrote ${dest} (${(fs.statSync(dest).size / 1024).toFixed(0)} KB)`);
