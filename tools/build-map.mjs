// Builds assets/img/world-map.svg — a lightweight, offline world map used by the
// International Network section. Highlighted countries are limited to confirmed
// network markets (United States, Philippines, Poland). Add others only after
// confirmation, and never highlight countries involved in armed conflict.
import { readFileSync, writeFileSync } from 'node:fs';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature, merge } from 'topojson-client';

const topo = JSON.parse(readFileSync(new URL('../node_modules/world-atlas/countries-110m.json', import.meta.url)));
const W = 1000, H = 520;

const all = topo.objects.countries.geometries.filter((g) => g.id !== '010'); // drop Antarctica
const land = merge(topo, all);
const projection = geoNaturalEarth1().fitExtent([[10, 10], [W - 10, H - 10]], { type: 'Sphere' });
// shift slightly so the Antarctica gap does not waste space
projection.translate([projection.translate()[0], projection.translate()[1] + 28]).scale(projection.scale() * 1.06);
const path = geoPath(projection).digits(1);

const HIGHLIGHT = { '840': 'us', '608': 'ph', '616': 'pl' };
const highlighted = all
  .filter((g) => HIGHLIGHT[g.id])
  .map((g) => `<path class="map-country" data-country="${HIGHLIGHT[g.id]}" d="${path(feature(topo, g))}"/>`)
  .join('');

// graticule-free, subtle; marker coordinates are exported for the arc layer
const markers = {
  us: projection([-81.6557, 30.3322]), // Jacksonville, FL
  ph: projection([120.9842, 14.5995]), // Manila
  pl: projection([21.0122, 52.2297]), // Warsaw
};

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" data-markers='${JSON.stringify(
  Object.fromEntries(Object.entries(markers).map(([k, v]) => [k, v.map((n) => +n.toFixed(1))]))
)}'><path class="map-land" d="${path(land)}"/>${highlighted}</svg>`;

writeFileSync(new URL('../assets/img/world-map.svg', import.meta.url), svg);
console.log('world-map.svg', (svg.length / 1024).toFixed(1) + 'KB', markers);
