import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
const check = process.argv.includes("--check");
const root = new URL("../", import.meta.url);
const read = path => readFileSync(new URL(path, root), "utf8");
const hash = value => createHash("sha256").update(value).digest("hex");
const originals = {
  "vendor/threeui-gallery/koi/KoiStudies.tsx": "0137430b7dbf48588e1ec0ca926fda2cd342949aa70adb42eebeac4bb9f1f775",
  "public/synthralos-halftone.html": "32cf6493414a209eb02c607a4b2383021f731411a9aa19a28e49673f84107e21",
  "public/threeui/threeui.css": "efe4447139f1358dd8e9be68edf6fa46cbefbd1de423a4d6c439ca61d2c8eccf",
};
for (const [path, expected] of Object.entries(originals)) if (hash(read(path)) !== expected) throw Error(`Hash mismatch: ${path}`);
const emit = (path, content) => {
  if (check) { if (read(path) !== content) throw Error(`Generated file drift: ${path}`); }
  else writeFileSync(new URL(path, root), content);
};
let html = read("public/synthralos-halftone.html");
// Module imagery replaces koi media; the authored masks and reveal engine remain.
html = html.replace(/const IMAGE_DATA = \[[\s\S]*?\];/, "const IMAGE_DATA = [];")
  .replace(/const VIDEO_DATA = \[[\s\S]*?\];/, "const VIDEO_DATA = [];")
  .replace("card.image.src = IMAGE_DATA[card.id];", "// Module image arrives from the host.")
  .replace("card.video.src = VIDEO_DATA[card.id];", "// No koi video in the module view.")
  .replace("card.video.load();", "// Preserve the canvas mask animation without a video source.");
// The user requested one module card, with no deck cycling.
html = html.replace(/\n      <div\s+class="stack-shell"\s+data-card-id="1"[\s\S]*?(?=\n    <\/div>\n    <p class="interaction-hint")/, "");
if ((html.match(/class="stack-shell"/g) || []).length !== 1) throw Error("Single-card extraction failed");
html = html.replace("let order = [2, 1, 0];", "let order = [0];")
  .replace("const sendToBack = (card, vectorX = 1, vectorY = 0) => {", "const sendToBack = (card, vectorX = 1, vectorY = 0) => { if (cards.length === 1) return;")
  .replace("const bringPreviousToFront = () => {", "const bringPreviousToFront = () => { if (cards.length === 1) return;")
  .replace("const handlePointerDown = (card, event) => {", "const handlePointerDown = (card, event) => { if (cards.length === 1) return;");
// Preserve all original media, CSS geometry, reveal masks and interaction functions.
html = html.replace("</head>", `<style>${read("components/threeui/koi-polaris.css")}</style></head>`);
// The requested compact stack excludes the full-page shader backdrop.
html = html.replace("      mountFluidPastels();", "      // Full-page backdrop is omitted in the compact Polaris stack.");
html = html.replace('      scene.classList.add("reveal-enabled");', read("components/threeui/koi-polaris-extension.js") + '\n      scene.classList.add("reveal-enabled");');
html = html.replace('{ color: "#24261f", position: 0 }', '{ color: "#2c1810", position: 0 }').replace('{ color: "#4a433d", position: 1 }', '{ color: "#684734", position: 1 }');
emit("public/threeui/polaris-koi.html", html);
let component = read("vendor/threeui-gallery/koi/KoiStudies.tsx");
component = component.replace('"/synthralos-halftone.html"', '"/threeui/polaris-koi.html"')
  .replace("Interactive stack of three Japanese koi studies", "Polaris module details")
  .replace("Koi Studies — Interactive Card Stack", "Polaris — Interactive Module Studies")
  .replaceAll("#10100e", "transparent");
emit("components/threeui/KoiStudies.generated.tsx", '"use client";\n// Generated from the verified component. URL, labels and background adapted for Polaris.\n' + component);
console.log("Verified all three KoiStudies source hashes and generated Polaris extension.");
