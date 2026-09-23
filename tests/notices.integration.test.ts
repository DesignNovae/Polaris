import test from "node:test";
import assert from "node:assert/strict";
import { MongoClient } from "mongodb";
import { randomUUID } from "node:crypto";
import { emptyNotice } from "@/lib/notices/schema";
import {
  listNotices,
  saveNotice,
  markNoticeRead,
  unreadCount,
  getNotice,
} from "@/lib/notices/service";

// Explicit opt-in: a disposable database, never the application database.
test(
  "notice persistence, audience isolation, read receipts and publication lifecycle",
  { skip: process.env.NOTICES_INTEGRATION !== "1" },
  async () => {
    assert.ok(
      process.env.NOTICES_TEST_URI,
      "NOTICES_TEST_URI must point to a dedicated test server",
    );
    const client = new MongoClient(process.env.NOTICES_TEST_URI!, {
      serverSelectionTimeoutMS: 15000,
    });
    const name = `pnqa_${randomUUID().replaceAll("-", "")}`;
    assert.match(name, /^pnqa_[a-f0-9]{32}$/);
    await client.connect();
    const db = client.db(name);
    const student = {
      id: "test-student",
      role: "student" as const,
      plan: "pro" as const,
    };
    const other = { ...student, id: "test-other" };
    const admin = {
      id: "test-admin",
      role: "admin" as const,
      plan: "elite" as const,
    };
    let created = false;
    try {
      const input = {
        ...emptyNotice(),
        title: "Integration test notice",
        summary: "Private test data in an isolated database.",
        body: "This is never delivered to Polaris users.",
        audience: { roles: ["student" as const], plans: ["pro" as const] },
      };
      const draft = await saveNotice(input, admin.id, undefined, undefined, db);
      created = true;
      assert.equal(
        (await listNotices(student, false, 0, db)).notices.length,
        0,
      );
      assert.equal((await listNotices(admin, true, 0, db)).notices.length, 1);
      const published = await saveNotice(
        { ...input, status: "published" },
        admin.id,
        draft.id,
        draft.revision,
        db,
      );
      assert.equal(await unreadCount(student, db), 1);
      assert.equal(
        (await listNotices({ ...student, plan: "free" }, false, 0, db)).notices
          .length,
        0,
      );
      assert.equal(
        (await listNotices({ ...student, role: "parent" }, false, 0, db))
          .notices.length,
        0,
      );
      await assert.rejects(
        getNotice(draft.id, { ...student, role: "parent" }, false, db),
        /not found/,
      );
      await markNoticeRead(published.id, published.revision, student, db);
      await markNoticeRead(published.id, published.revision, student, db);
      assert.equal(await unreadCount(student, db), 0);
      assert.equal(await unreadCount(other, db), 1);
      assert.equal(
        (await listNotices(student, false, 0, db)).notices[0].read,
        true,
      );
      const updated = await saveNotice(
        { ...input, status: "published", title: "An updated notice" },
        admin.id,
        published.id,
        published.revision,
        db,
      );
      assert.equal(await unreadCount(student, db), 1);
      await assert.rejects(
        saveNotice(input, admin.id, published.id, published.revision, db),
        /another session/,
      );
      await assert.rejects(
        markNoticeRead(updated.id, published.revision, student, db),
        /updated/,
      );
      await saveNotice(
        { ...input, status: "archived" },
        admin.id,
        updated.id,
        updated.revision,
        db,
      );
      assert.equal(await unreadCount(student, db), 0);
      await assert.rejects(
        getNotice(updated.id, student, false, db),
        /not found/,
      );
      await assert.rejects(
        saveNotice(
          {
            ...input,
            status: "published",
            expiresAt: "2000-01-01T00:00:00.000Z",
          },
          admin.id,
          undefined,
          undefined,
          db,
        ),
        /future/,
      );
    } finally {
      // The name was generated and validated above; the production Polaris DB is never selected.
      try {
        if (created) await db.dropDatabase();
      } finally {
        await client.close();
      }
    }
  },
);
