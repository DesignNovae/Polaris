/**
 * Reproducible product screenshots for docs/ and the README.
 *
 * Drives a headless Chrome over the DevTools Protocol - no Playwright or
 * Puppeteer dependency. Real time is used rather than Chrome's
 * --virtual-time-budget because the landing page animates with GSAP and Lenis,
 * and virtual time fast-forwards past the scroll-triggered reveals, capturing
 * half-faded text and unfinished counters.
 *
 * Every target is a public /demo route, so captures use seeded data and never
 * put a real student's email, name, or plan into a committed image.
 *
 * Usage:
 *   npm run dev                    # in another terminal
 *   node scripts/screenshots.mjs   # add --scale 2 for retina, --only roadmap
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import path from "node:path";

const ARGV = process.argv.slice(2);
const argOf = (flag, fallback) => {
  const i = ARGV.indexOf(flag);
  return i === -1 ? fallback : ARGV[i + 1];
};

const BASE = argOf("--base", "http://localhost:3000");
const OUT_DIR = path.resolve("docs/screenshots");
const SCALE = Number(argOf("--scale", "1"));
const ONLY = argOf("--only", null);
const PORT = 9333;

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

/**
 * Dev-only chrome that must not appear in a product screenshot: the Next.js
 * dev-tools bubble, and any route-announcer text.
 */
const HIDE_DEV_CHROME = `
  nextjs-portal, [data-nextjs-toast], #__next-route-announcer__,
  [data-nextjs-dev-tools-button] { display: none !important; }
`;

/**
 * Helpers injected into the page before capture.
 *
 * The workspace shell opens the docked Strategist panel by default. At 1440px
 * that panel overlaps the workspace header, so every workspace capture closes
 * it first and shows the Strategist on its own route instead.
 */
const PAGE_HELPERS = `
  window.__shot = {
    clickText(text) {
      const el = [...document.querySelectorAll("button, a")]
        .find((n) => n.textContent.trim() === text);
      if (el) el.click();
      return !!el;
    },
    closeSidePanel() {
      const open = document.querySelector('[placeholder*="Ask anything about your path"]');
      if (!open) return false;
      // The toggle is named by title=, not aria-label=.
      const toggle = document.querySelector('[title="Open the Strategist"]');
      if (toggle) toggle.click();
      return true;
    },
  };
`;

/** width/height are CSS pixels; settle is the real-time wait after load. */
const TARGETS = [
  {
    name: "polaris-overview",
    path: "/",
    settle: 4500,
    caption: "Landing hero",
  },
  {
    name: "roadmap",
    path: "/demo",
    settle: 4000,
    prep: "window.__shot.closeSidePanel()",
    // Scroll past the plan header so the mission tree is the subject.
    wheel: { dy: 420 },
    caption: "Adaptive roadmap",
  },
  {
    name: "strategist",
    path: "/demo/strategist",
    settle: 3500,
    caption: "Grounded Strategist",
  },
  {
    name: "universities",
    path: "/demo/universities",
    settle: 3500,
    prep: "window.__shot.closeSidePanel()",
    caption: "University intelligence + acceptance model",
  },
  {
    name: "action-lab",
    path: "/demo/action-lab",
    settle: 3500,
    prep: "window.__shot.closeSidePanel()",
    caption: "Action Lab",
  },
  {
    name: "resources",
    path: "/demo/resources",
    settle: 3500,
    prep: "window.__shot.closeSidePanel()",
    caption: "Resource hub",
  },
  {
    name: "connections",
    path: "/demo/connections",
    settle: 3500,
    prep: "window.__shot.closeSidePanel()",
    caption: "Connected progress",
  },
];

function findChrome() {
  const hit = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!hit) {
    throw new Error(
      `Chrome not found. Set CHROME_PATH. Tried:\n  ${CHROME_CANDIDATES.join("\n  ")}`,
    );
  }
  return hit;
}

/** Minimal CDP client: one websocket, id-matched request/response. */
function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  const listeners = new Map();
  let nextId = 1;

  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
      return;
    }
    const handlers = listeners.get(msg.method);
    if (handlers) for (const fn of handlers) fn(msg.params);
  });

  const ready = new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", () => reject(new Error("CDP socket failed")), { once: true });
  });

  return {
    ready,
    send(method, params = {}) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    once(method) {
      return new Promise((resolve) => {
        const fn = (params) => {
          listeners.get(method).delete(fn);
          resolve(params);
        };
        if (!listeners.has(method)) listeners.set(method, new Set());
        listeners.get(method).add(fn);
      });
    },
    close: () => ws.close(),
  };
}

/** Chrome 111+ requires PUT (not GET) on /json/new. */
async function httpJson(url, method = "GET") {
  const res = await fetch(url, { method });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

/** Chrome's debug port is not open the instant the process starts. */
async function waitForChrome(deadlineMs = 20000) {
  const started = Date.now();
  for (;;) {
    try {
      return await httpJson(`http://127.0.0.1:${PORT}/json/version`);
    } catch {
      if (Date.now() - started > deadlineMs) throw new Error("Chrome debug port never opened");
      await sleep(250);
    }
  }
}

async function assertDevServer() {
  try {
    const res = await fetch(BASE, { redirect: "manual" });
    if (res.status >= 500) throw new Error(`dev server returned ${res.status}`);
  } catch (err) {
    throw new Error(`No dev server at ${BASE}. Start it with \`npm run dev\`. (${err.message})`);
  }
}

async function capture(client, target, width, height) {
  await client.send("Page.enable");
  await client.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: SCALE,
    mobile: false,
  });

  const loaded = client.once("Page.loadEventFired");
  await client.send("Page.navigate", { url: `${BASE}${target.path}` });
  await Promise.race([loaded, sleep(20000)]);

  await client.send("Runtime.evaluate", {
    expression: `(() => {
      const s = document.createElement("style");
      s.textContent = ${JSON.stringify(HIDE_DEV_CHROME)};
      document.head.appendChild(s);
    })();
    ${PAGE_HELPERS}`,
  });

  await sleep(target.settle);

  if (target.prep) {
    await client.send("Runtime.evaluate", { expression: target.prep, awaitPromise: true });
    await sleep(target.afterPrep ?? 1500);
  }

  if (target.wheel) {
    await client.send("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x: target.wheel.x ?? Math.round(width / 2),
      y: target.wheel.y ?? Math.round(height / 2),
      deltaX: 0,
      deltaY: target.wheel.dy,
      pointerType: "mouse",
    });
    await sleep(1500);
  }

  const { data } = await client.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  const file = path.join(OUT_DIR, `${target.name}.png`);
  writeFileSync(file, Buffer.from(data, "base64"));
  return file;
}

async function main() {
  await assertDevServer();
  mkdirSync(OUT_DIR, { recursive: true });

  const chrome = spawn(
    findChrome(),
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      `--remote-debugging-port=${PORT}`,
      "--user-data-dir=" + path.join(process.env.TEMP || "/tmp", "polaris-shots"),
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  let failures = 0;
  try {
    await waitForChrome();
    const targets = ONLY ? TARGETS.filter((t) => t.name === ONLY) : TARGETS;
    if (targets.length === 0) throw new Error(`No target named "${ONLY}"`);

    for (const target of targets) {
      const width = target.width ?? 1440;
      const height = target.height ?? 900;
      const tab = await httpJson(
        `http://127.0.0.1:${PORT}/json/new?${encodeURIComponent("about:blank")}`,
        "PUT",
      );
      const client = connect(tab.webSocketDebuggerUrl);
      await client.ready;
      try {
        const file = await capture(client, target, width, height);
        console.log(`  ok  ${target.name.padEnd(20)} ${target.path}  ->  ${path.basename(file)}`);
      } catch (err) {
        failures++;
        console.error(`  FAIL ${target.name}: ${err.message}`);
      } finally {
        client.close();
        await fetch(`http://127.0.0.1:${PORT}/json/close/${tab.id}`).catch(() => {});
      }
    }
  } finally {
    chrome.kill();
  }

  console.log(failures === 0 ? "\nAll screenshots captured." : `\n${failures} failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
