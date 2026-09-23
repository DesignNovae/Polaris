import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { runInNewContext } from "node:vm";
import sharp from "sharp";
import {
  emptyNotice,
  noticeSchema,
  canReadNotice,
  safeNoticeLink,
} from "@/lib/notices/schema";
import { normaliseNoticeImage } from "@/lib/notices/media";
import { requireSameOrigin, readLimitedBody } from "@/lib/notices/request";

const notice = {
  ...emptyNotice(),
  title: "Exam timetable",
  summary: "Your upcoming exam dates.",
  body: "Find your scheduled exams in Action Lab.",
  status: "published" as const,
  audience: { roles: ["student" as const], plans: ["pro" as const] },
};
const user = {
  id: "student-1",
  role: "student" as const,
  plan: "pro" as const,
};
test("notice audience requires both role and effective plan", () => {
  assert.equal(canReadNotice(notice, user), true);
  assert.equal(canReadNotice(notice, { ...user, role: "parent" }), false);
  assert.equal(canReadNotice(notice, { ...user, plan: "free" }), false);
  assert.equal(canReadNotice(notice, { ...user, role: "admin" }), false);
});
test("drafts, archived and expired notices are never delivered", () => {
  for (const status of ["draft", "archived"] as const)
    assert.equal(canReadNotice({ ...notice, status }, user), false);
  const expiresAt = "2026-01-01T00:00:00.000Z";
  assert.equal(
    canReadNotice({ ...notice, expiresAt }, user, Date.parse(expiresAt)),
    false,
  );
  assert.equal(
    canReadNotice({ ...notice, expiresAt }, user, Date.parse(expiresAt) - 1),
    true,
  );
});
test("publishing rejects empty audiences, unsafe links and untrusted image URLs", () => {
  assert.equal(noticeSchema.safeParse(notice).success, true);
  for (const link of [
    "javascript:alert(1)",
    "data:text/html,hello",
    "//evil.example",
    "/\\evil.example",
    "https://user:pass@example.com",
    "http://example.com",
  ])
    assert.equal(safeNoticeLink(link), false, link);
  assert.equal(safeNoticeLink("/action-lab#learn"), true);
  assert.equal(safeNoticeLink("https://example.com/event"), true);
  assert.equal(
    noticeSchema.safeParse({
      ...notice,
      audience: { roles: [], plans: ["pro"] },
    }).success,
    false,
  );
  assert.equal(
    noticeSchema.safeParse({
      ...notice,
      logoUrl: "https://tracker.example/logo.png",
    }).success,
    false,
  );
  assert.equal(
    noticeSchema.safeParse({
      ...notice,
      imageUrl: "/api/notices/media/123456789012345678901234",
    }).success,
    false,
    "Cover images need alt text",
  );
  assert.equal(
    noticeSchema.safeParse({ ...notice, linkUrl: "/roadmap" }).success,
    false,
    "Action links need meaningful labels",
  );
  assert.equal(
    noticeSchema.safeParse({ ...notice, authorId: "spoofed" }).success,
    false,
  );
});
test("notice writes reject cross-site requests", () => {
  assert.throws(
    () =>
      requireSameOrigin(
        new Request("https://polaris.example/api/admin/notices", {
          headers: { origin: "https://attacker.example" },
        }),
      ),
    /Cross-site/,
  );
  assert.throws(
    () =>
      requireSameOrigin(
        new Request("https://polaris.example/api/admin/notices", {
          headers: { "sec-fetch-site": "cross-site" },
        }),
      ),
    /Cross-site/,
  );
  assert.doesNotThrow(() =>
    requireSameOrigin(
      new Request("https://polaris.example/api/admin/notices", {
        headers: { origin: "https://polaris.example" },
      }),
    ),
  );
});
test("body limits apply even without Content-Length", async () => {
  await assert.rejects(
    readLimitedBody(
      new Request("https://polaris.example", {
        method: "POST",
        body: "abcdef",
      }),
      5,
    ),
    /too large/,
  );
  assert.equal(
    (
      await readLimitedBody(
        new Request("https://polaris.example", { method: "POST", body: "abc" }),
        5,
      )
    ).toString(),
    "abc",
  );
});
test("notice uploads resize and strip metadata; reject SVG and invalid bytes", async () => {
  const source = await sharp({
    create: { width: 2000, height: 1000, channels: 3, background: "#8b5e3c" },
  })
    .jpeg()
    .withMetadata()
    .toBuffer();
  const result = await normaliseNoticeImage(source);
  const meta = await sharp(result).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.width, 1600);
  assert.equal(meta.height, 800);
  assert.equal(meta.exif, undefined);
  await assert.rejects(
    normaliseNoticeImage(
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>',
      ),
    ),
    /valid, still/,
  );
  await assert.rejects(
    normaliseNoticeImage(Buffer.from("not an image")),
    /valid, still/,
  );
  await assert.rejects(
    normaliseNoticeImage(Buffer.alloc(2097153)),
    /smaller than 2 MB/,
  );
});
test("all supplied ThreeUI sources retain their verified hashes", () => {
  const base = "vendor/threeui/notice-effects/";
  const entries = JSON.parse(readFileSync(base + "manifest.json", "utf8")) as {
    path: string;
    sha256: string;
  }[];
  assert.ok(entries.length >= 10);
  for (const entry of entries)
    assert.equal(
      createHash("sha256")
        .update(readFileSync(base + entry.path))
        .digest("hex"),
      entry.sha256,
      entry.path,
    );
});

test("paper pagination retains a maximum-length notice at desktop and phone sizes", () => {
  const source = readFileSync("assets/notice-paper-art.js", "utf8");
  for (const width of [390, 1440]) {
    const printed: { text: string; y: number; font: string }[] = [];
    const ctx = new Proxy(
      { font: "", fillStyle: "", textAlign: "" },
      {
        get(target, key) {
          if (key in target) return target[key as keyof typeof target];
          if (key === "measureText")
            return (text: string) => ({
              width:
                text.length *
                (Number(target.font.match(/([\d.]+)px/)?.[1]) || 35) *
                0.6,
            });
          if (key === "fillText")
            return (text: string, _x: number, y: number) =>
              printed.push({ text, y, font: target.font });
          if (key === "createLinearGradient" || key === "createRadialGradient")
            return () => ({ addColorStop() {} });
          return () => {};
        },
      },
    );
    const body =
      "Detailed academic update with dates and instructions. "
        .repeat(250)
        .slice(0, 11980) + " FINAL_SENTINEL";
    const actual = runInNewContext(
      source +
        `
      polarisNotice={title:'W'.repeat(120),summary:'A summary. ',body,category:'Academic',date:'2026-09-23'};
      drawGame(ctx);
      const pageCount=polarisPages;
      for(let p=1;p<pageCount;p++){polarisPage=p;drawGame(ctx);}
      pageCount;
    `,
      {
        ctx,
        body,
        window: { innerWidth: width },
        TW: 1200,
        TH: 1656,
        MONO: "monospace",
        track() {},
        rr() {},
      },
    );
    assert.ok(actual > 1);
    const bodyText = printed.filter(
      (line) =>
        line.font.startsWith("400 ") && line.font.endsWith("Inter, sans-serif"),
    );
    assert.ok(
      bodyText.every((line) => line.y < 1360),
      "Body text stays above the footer",
    );
    assert.equal(
      bodyText
        .map((line) => line.text)
        .join("")
        .replace(/\s/g, ""),
      ("A summary. " + body).replace(/\s/g, ""),
    );
  }
});
