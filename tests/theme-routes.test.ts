import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  THEMED_ROUTE_SEGMENTS,
  INTENTIONALLY_LIGHT_SEGMENTS,
  isThemedPath,
  leadingSegment,
} from "@/lib/theme/routes";
import { THEME_PREFLIGHT_SCRIPT } from "@/lib/theme/preflight";

/**
 * The theme split used to be two hand-maintained regex literals - one in the
 * provider, one re-escaped inside the pre-hydration script. Shipping /passport,
 * /cohort and /affordability without touching either meant those pages fell
 * through to the marketing branch and reset the workspace to light.
 *
 * These tests make that a build failure instead of a bug report: the first one
 * reads the workspace route group off disk, so a new directory that nobody
 * themed fails here.
 */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function routeDirectories(group: string): string[] {
  return readdirSync(join(repoRoot, "app", group), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    // Route groups "(x)" and parallel/intercepted routes are not path segments.
    .filter((name) => !name.startsWith("(") && !name.startsWith("@"));
}

test("every route in the (app) workspace group follows the workspace theme", () => {
  const missing = routeDirectories("(app)").filter(
    (segment) => !THEMED_ROUTE_SEGMENTS.includes(segment as never),
  );
  assert.deepEqual(
    missing,
    [],
    `These app/(app) routes are not in THEMED_ROUTE_SEGMENTS, so opening them ` +
      `resets the workspace to light: ${missing.join(", ")}. Add them to ` +
      `lib/theme/routes.ts.`,
  );
});

test("the workspace surfaces outside the (app) group are themed too", () => {
  // These live at the top level for their own reasons - a separate shell, a
  // different audience - but they are all signed-in product, not marketing.
  for (const segment of ["account", "admin", "dashboard", "demo", "exams", "monitor", "portal"]) {
    assert.ok(
      THEMED_ROUTE_SEGMENTS.includes(segment as never),
      `/${segment} is a workspace surface and must follow the saved theme`,
    );
  }
});

test("marketing and public routes stay light", () => {
  for (const segment of INTENTIONALLY_LIGHT_SEGMENTS) {
    assert.ok(
      !THEMED_ROUTE_SEGMENTS.includes(segment as never),
      `/${segment} is public and must not follow the workspace theme`,
    );
  }
  assert.ok(!isThemedPath("/"), "the landing page is light by design");
  // The public passport is shared with recommenders; /passport is the builder.
  assert.ok(!isThemedPath("/p/abc-123"));
  assert.ok(isThemedPath("/passport"));
});

test("matching is on the leading segment, at any depth", () => {
  assert.ok(isThemedPath("/roadmap"));
  assert.ok(isThemedPath("/roadmap/"));
  assert.ok(isThemedPath("/roadmap/task-42"));
  assert.ok(isThemedPath("/exams/sat-math"));
  assert.ok(isThemedPath("/demo/passport"));

  // A prefix match must not leak: /roadmapping is not /roadmap.
  assert.ok(!isThemedPath("/roadmapping"));
  assert.ok(!isThemedPath("/passport-help"));
  assert.ok(!isThemedPath("/universities-guide"));
});

test("leadingSegment handles the edges the router can produce", () => {
  assert.equal(leadingSegment("/"), "");
  assert.equal(leadingSegment(""), "");
  assert.equal(leadingSegment("/roadmap"), "roadmap");
  assert.equal(leadingSegment("/roadmap/42"), "roadmap");
});

test("the pre-hydration script matches on exactly the same route list", () => {
  // Proves the two code paths cannot drift: the script embeds the array rather
  // than restating it, and this reads it back out.
  const embedded = THEME_PREFLIGHT_SCRIPT.match(/var themed = (\[[^\]]*\])/);
  assert.ok(embedded, "the preflight script should embed the segment list");
  assert.deepEqual(JSON.parse(embedded[1]), [...THEMED_ROUTE_SEGMENTS]);
});

test("segments are safe to embed in an inline script", () => {
  for (const segment of THEMED_ROUTE_SEGMENTS) {
    assert.match(
      segment,
      /^[a-z0-9-]+$/,
      `"${segment}" needs escaping before it can go in the preflight script`,
    );
  }
  assert.ok(
    !THEME_PREFLIGHT_SCRIPT.includes("</script"),
    "the preflight script must not be able to close its own tag",
  );
});

test("the route list has no duplicates", () => {
  const unique = new Set<string>(THEMED_ROUTE_SEGMENTS);
  assert.equal(unique.size, THEMED_ROUTE_SEGMENTS.length);
});
