import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { CHUNK_RECOVERY_SCRIPT } from "../lib/chunk-recovery";

test("missing application chunks reload once across page loads, without looping", () => {
  const saved = new Map<string, string>();
  let reloads = 0;
  function boot(online = true, storageBlocked = false) {
    const listeners = new Map<string, (event: unknown) => void>();
    runInNewContext(CHUNK_RECOVERY_SCRIPT, {
      URL, Date,
      location: { href: "http://localhost:3000/", origin: "http://localhost:3000", reload: () => reloads++ },
      navigator: { onLine: online },
      sessionStorage: {
        getItem: (key: string) => { if (storageBlocked) throw new Error("blocked"); return saved.get(key); },
        setItem: (key: string, value: string) => saved.set(key, value),
      },
      window: { addEventListener: (name: string, handler: (event: unknown) => void) => listeners.set(name, handler) },
    });
    return (name: string, event: unknown) => listeners.get(name)?.(event);
  }
  const chunk = "http://localhost:3000/_next/static/chunks/app/layout-old.js";
  let emit = boot();
  emit("error", { target: { tagName: "SCRIPT", src: "https://example.com/vendor.js" } });
  emit("unhandledrejection", { reason: { name: "TypeError", message: "broken code" } });
  assert.equal(reloads, 0);
  emit("error", { target: { tagName: "SCRIPT", src: chunk } });
  emit("unhandledrejection", { reason: { name: "ChunkLoadError", request: chunk } });
  assert.equal(reloads, 1);
  emit = boot();
  emit("error", { target: { tagName: "SCRIPT", src: chunk } });
  assert.equal(reloads, 1, "another failure after reload must not loop");
  saved.clear();
  emit = boot(false);
  emit("error", { target: { tagName: "SCRIPT", src: chunk } });
  assert.equal(reloads, 1, "offline pages are not reloaded");
  emit = boot(true, true);
  emit("error", { target: { tagName: "SCRIPT", src: chunk } });
  assert.equal(reloads, 1, "blocked storage cannot cause a reload loop");
  emit = boot();
  emit("unhandledrejection", { reason: { name: "ChunkLoadError", message: `Loading chunk failed. (error: ${chunk})` } });
  assert.equal(reloads, 2, "webpack message fallback is recognized");
});
