/** Compare the local adapter's actual iframe document against the full original. */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { Script } from "node:vm";
import assert from "node:assert/strict";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
const require = createRequire(import.meta.url);
const original = readFileSync(new URL("../vendor/threeui-gallery/src/shaders/neuform-isolated/NeuformIsolatedEffects.tsx", import.meta.url), "utf8");
const local = readFileSync(new URL("../components/threeui/GalleryHeading.generated.tsx", import.meta.url), "utf8");
const html = readFileSync(new URL("../vendor/threeui-gallery/src/shaders/neuform-isolated/sources/gallery-heading.html", import.meta.url), "utf8");
function load(source) {
  const verificationExport = `\nexport function verificationDocument() {
    return buildFocusedDocument({...EFFECTS.galleryHeading,
      transformSource: (source,mode) => transformGalleryHeadingSource(source,mode,GALLERY_HEADING_VARIANTS['vertical-loop'])},'dark');
  }`;
  const code = ts.transpileModule(source + verificationExport, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  const resolve = id => {
    if (id.includes("gallery-heading")) return html;
    // The full registry imports other effects; they are never rendered by this test.
    if (id.endsWith("?raw")) return "";
    return require(id);
  };
  new Function("require", "module", "exports", code)(resolve, module, module.exports);
  return module.exports;
}
const a = load(original), b = load(local);
const props = { variant: "vertical-loop", mode: "dark", font: "didone", weight: "400", headlineSize: 1.25, hue: 0, saturation: 1, brightness: 1 };
assert.equal(renderToStaticMarkup(createElement(b.GalleryHeading, props)), renderToStaticMarkup(createElement(a.GalleryHeading, props)));
const document = b.verificationDocument();
assert.equal(document, a.verificationDocument());
assert.ok(document.includes("axis: 90,"));
assert.ok(document.includes("var FIELD = 'halftone'"));
assert.ok(document.includes("ONE WALL") && document.includes("TWELVE PLATES"));
assert.ok(document.includes("var spin = (t/DUR)*Math.PI*2*-1;"));
for (const match of document.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new Script(match[1]);
console.log("PASS: configured SSR markup and complete iframe document match the full original byte-for-byte; variant, reverse orbit, headline, and script syntax verified.");

const customSource = readFileSync(new URL("../components/threeui/PolarisGalleryHeading.tsx", import.meta.url), "utf8");
const customCode = ts.transpileModule(customSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
const customModule = { exports: {} };
new Function("require", "module", "exports", customCode)(id => {
  if (id.includes("GalleryHeading.generated")) return b;
  if (id.includes("module-icon-renders")) return {};
  if (id.includes("ecosystem-modules")) return { ECOSYSTEM_MODULES: Array.from({length:8},(_,i)=>({name:String(i)})) };
  if (id.endsWith(".module.css")) return {};
  return require(id);
}, customModule, customModule.exports);
const customized = customModule.exports.customizePolarisGallery(html, ["data:image/png;base64,test"]);
assert.ok(customized.includes("ONE CONNECTED") && customized.includes("COMMAND CENTER"));
assert.ok(!customized.includes("TWELVE PLATES"));
assert.ok(customized.includes("ctx.fillStyle = '#faf6f0'"));
assert.ok(customized.includes("var FIELD = 'halftone'") && customized.includes("axis: 90,"));
assert.ok(customized.includes("var spin = (t/DUR)*Math.PI*2*-1;"));
for (const match of customized.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new Script(match[1]);
console.log("PASS: Polaris content, texture composition script syntax, and retained halftone reverse orbit verified.");
