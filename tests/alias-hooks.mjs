import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Makes the app's TypeScript source loadable by `node --test`.
 *
 * Two things Node's ESM resolver does not do on its own, both of which the
 * project relies on via tsconfig `moduleResolution: "bundler"`:
 *   - the `@/*` path alias, and
 *   - extensionless imports (`./types` rather than `./types.ts`).
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CANDIDATES = ["", ".ts", ".tsx", ".mts", ".js", ".mjs", "/index.ts", "/index.tsx", "/index.js"];

function firstFile(base) {
  for (const suffix of CANDIDATES) {
    const candidate = `${base}${suffix}`;
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // Try the next extension.
    }
  }
  return null;
}

function resolveToFile(specifier, parentURL) {
  if (specifier.startsWith("@/")) return firstFile(path.join(root, specifier.slice(2)));
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) return null;
  if (!parentURL?.startsWith("file:")) return null;
  return firstFile(path.resolve(path.dirname(fileURLToPath(parentURL)), specifier));
}

export async function resolve(specifier, context, nextResolve) {
  const file = resolveToFile(specifier, context.parentURL);
  const resolved = await nextResolve(file ? pathToFileURL(file).href : specifier, context);
  // The bundler imports JSON without an attribute; Node requires one.
  return resolved.url.endsWith(".json")
    ? { ...resolved, importAttributes: { ...resolved.importAttributes, type: "json" } }
    : resolved;
}
