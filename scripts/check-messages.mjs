// Pastikan messages/id.json & en.json memiliki kunci yang sama (toggle EN tidak menyisakan string ID).
import fs from "node:fs";
const flat = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? flat(v, `${p}${k}.`) : [`${p}${k}`]));
const id = new Set(flat(JSON.parse(fs.readFileSync("messages/id.json", "utf8"))));
const en = new Set(flat(JSON.parse(fs.readFileSync("messages/en.json", "utf8"))));
const a = [...id].filter((k) => !en.has(k)), b = [...en].filter((k) => !id.has(k));
if (a.length || b.length) { console.error("Hilang di en:", a, "\nHilang di id:", b); process.exit(1); }
console.log(`✓ ${id.size} kunci, id & en sinkron`);
