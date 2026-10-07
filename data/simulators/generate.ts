// Deterministic synthetic data: the material library, the three preset scenarios and the hall measured from the Blender export. Run: node data/simulators/generate.ts
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { MATERIALS, SCENARIOS } from "../../packages/domain/src/index.ts";
const root = new URL("../../", import.meta.url).pathname, out = root + "data/generated/";
mkdirSync(out, { recursive: true });
writeFileSync(out + "materials.json", JSON.stringify(MATERIALS));
writeFileSync(out + "scenarios.json", JSON.stringify(SCENARIOS));
cpSync(root + "model/exports/analysis.json", out + "hall.json");
console.log("generated", MATERIALS.length, "materials,", SCENARIOS.length, "scenarios");
