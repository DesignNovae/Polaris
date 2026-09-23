"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  emptyNotice,
  NOTICE_PLANS,
  NOTICE_ROLES,
  noticeSchema,
  type Notice,
  type NoticeInput,
} from "@/lib/notices/schema";
import { GlassButton } from "@/components/ui/GlassButton";
import { NoticeContent } from "./NoticeContent";
import { NoticePaper } from "./NoticePaper";
import styles from "./notices.module.css";

export function NoticeAdmin() {
  const [items, setItems] = useState<Notice[]>([]);
  const [draft, setDraft] = useState<NoticeInput>(emptyNotice);
  const [editing, setEditing] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState<"paper" | "text">("paper");
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const lock = useRef(false);
  const load = useCallback(async (next = 0) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/notices?page=${next}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load notices");
      setItems(data.notices);
      setPage(next);
      setHasMore(data.hasMore);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not load notices. Try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const protect = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty]);
  function update<K extends keyof NoticeInput>(key: K, value: NoticeInput[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
    setMessage("");
    setConfirmPublish(false);
  }
  function choose(notice: Notice | null) {
    if (dirty && !window.confirm("Discard your unsaved notice changes?"))
      return;
    setEditing(notice);
    setDraft(
      notice
        ? noticeSchema.parse(
            Object.fromEntries(
              Object.keys(emptyNotice()).map((k) => [
                k,
                notice[k as keyof NoticeInput],
              ]),
            ),
          )
        : emptyNotice(),
    );
    setDirty(false);
    setError("");
    setMessage("");
    setConfirmPublish(false);
  }
  async function upload(file: File | undefined, field: "imageUrl" | "logoUrl") {
    if (!file || uploading) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Choose an image smaller than 2 MB.");
      return;
    }
    setUploading(field);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/admin/notices/media", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      update(field, data.url);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Image upload failed. Try again.",
      );
    } finally {
      setUploading(null);
    }
  }
  async function save(status: NoticeInput["status"]) {
    if (lock.current || uploading) return;
    const result = noticeSchema.safeParse({ ...draft, status });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        editing ? `/api/admin/notices/${editing.id}` : "/api/admin/notices",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            editing
              ? { notice: result.data, revision: editing.revision }
              : result.data,
          ),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not save this notice");
      setEditing(data.notice);
      setDraft(result.data);
      setDirty(false);
      setConfirmPublish(false);
      setMessage(
        status === "published"
          ? "Published. Eligible users will see this notice under their notification bell."
          : status === "archived"
            ? "Archived. This notice is no longer visible to users."
            : "Draft saved. Only admins can see it.",
      );
      await load(page);
      window.dispatchEvent(new Event("polaris:notices-read"));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Save failed. Your changes are still here.",
      );
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  const all =
    draft.audience.roles.length === NOTICE_ROLES.length &&
    draft.audience.plans.length === NOTICE_PLANS.length;
  const audienceLabel = all
    ? "All signed-in users"
    : `${draft.audience.roles.join(", ") || "No roles"} · ${draft.audience.plans.join(", ") || "No plans"}`;
  return (
    <div className={styles.admin}>
      <div className={styles.heading}>
        <div>
          <h2>Notice studio</h2>
          <p>Write an update. Choose who sees it. Make it memorable.</p>
        </div>
        <GlassButton
          type="button"
          onClick={() => choose(null)}
          disabled={busy || !!uploading}
        >
          New notice
        </GlassButton>
      </div>
      <div className={styles.adminLayout}>
        <aside className={styles.archive} aria-label="Saved notices" aria-busy={loading}>
          <h3>Your notices</h3>
          {loading ? (
            <span className="sr-only" role="status">Loading notices</span>
          ) : items.length === 0 ? (
            <p>No notices yet. Your first saved draft will appear here.</p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                disabled={busy || !!uploading}
                onClick={() => choose(n)}
                className={editing?.id === n.id ? styles.selected : ""}
              >
                <span>{n.status}</span>
                <strong>{n.title}</strong>
                <small>{new Date(n.updatedAt).toLocaleDateString()}</small>
              </button>
            ))
          )}
          <div className={styles.pagination}>
            <button
              disabled={loading || page === 0}
              onClick={() => load(page - 1)}
            >
              Previous
            </button>
            <button
              disabled={loading || !hasMore}
              onClick={() => load(page + 1)}
            >
              Next
            </button>
          </div>
        </aside>
        <div className={styles.editor}>
          <form onSubmit={(e) => e.preventDefault()}>
            <fieldset disabled={busy || !!uploading} className={styles.fields}>
              <div className={styles.editorHeading}>
                <h3>{editing ? "Edit notice" : "Compose a notice"}</h3>
                <span>
                  {dirty ? "Unsaved changes" : editing?.status || "New draft"}
                </span>
              </div>
              <label>
                Title
                <input
                  required
                  minLength={3}
                  maxLength={120}
                  value={draft.title}
                  onChange={(e) => update("title", e.target.value)}
                  placeholder="What should your audience know?"
                />
              </label>
              <label>
                Short introduction
                <textarea
                  required
                  minLength={3}
                  maxLength={280}
                  rows={2}
                  value={draft.summary}
                  onChange={(e) => update("summary", e.target.value)}
                  placeholder="The key message, in a sentence or two."
                />
                <small>
                  {draft.summary.length}/280 · Shown on the 3D paper
                </small>
              </label>
              <label>
                Full notice
                <textarea
                  required
                  minLength={3}
                  maxLength={12000}
                  rows={7}
                  value={draft.body}
                  onChange={(e) => update("body", e.target.value)}
                  placeholder="Add dates, details, instructions, and anything readers need to act."
                />
              </label>
              <div className={styles.fieldRow}>
                <label>
                  Category
                  <select
                    value={draft.category}
                    onChange={(e) =>
                      update(
                        "category",
                        e.target.value as NoticeInput["category"],
                      )
                    }
                  >
                    {["Announcement", "Academic", "Event", "Maintenance"].map(
                      (v) => (
                        <option key={v}>{v}</option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  Priority
                  <select
                    value={draft.priority}
                    onChange={(e) =>
                      update(
                        "priority",
                        e.target.value as NoticeInput["priority"],
                      )
                    }
                  >
                    <option value="normal">Normal</option>
                    <option value="important">Important</option>
                  </select>
                </label>
              </div>
              <div className={styles.fieldRow}>
                {(["imageUrl", "logoUrl"] as const).map((field) => (
                  <div key={field} className={styles.upload}>
                    <label>
                      {field === "imageUrl" ? "Cover image" : "Publisher logo"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => {
                          void upload(e.target.files?.[0], field);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {draft[field] && (
                      <div className={styles.uploaded}>
                        <Image
                          unoptimized
                          src={draft[field]}
                          alt={
                            field === "imageUrl"
                              ? "Selected cover preview"
                              : "Selected logo preview"
                          }
                          width={48}
                          height={48}
                        />
                        <button type="button" onClick={() => update(field, "")}>
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <small>
                PNG, JPEG or WebP · up to 2 MB each. Location and camera
                metadata are removed.
              </small>
              {draft.imageUrl && (
                <label>
                  Image description
                  <input
                    required
                    maxLength={200}
                    value={draft.imageAlt}
                    onChange={(e) => update("imageAlt", e.target.value)}
                    placeholder="Describe the image for readers who cannot see it."
                  />
                </label>
              )}
              <div className={styles.fieldRow}>
                <label>
                  Action link (optional)
                  <input
                    value={draft.linkUrl}
                    maxLength={2000}
                    onChange={(e) => update("linkUrl", e.target.value)}
                    placeholder="https://… or /action-lab"
                  />
                </label>
                <label>
                  Link label
                  <input
                    value={draft.linkLabel}
                    maxLength={60}
                    onChange={(e) => update("linkLabel", e.target.value)}
                    placeholder="View event details"
                  />
                </label>
              </div>
              <fieldset className={styles.audience}>
                <legend>Who should receive this?</legend>
                <p>
                  Readers must match one selected role and one selected plan.
                </p>
                <div className={styles.options}>
                  {NOTICE_ROLES.map((role) => (
                    <label key={role}>
                      <input
                        type="checkbox"
                        checked={draft.audience.roles.includes(role)}
                        onChange={(e) =>
                          update("audience", {
                            ...draft.audience,
                            roles: e.target.checked
                              ? [...draft.audience.roles, role]
                              : draft.audience.roles.filter((r) => r !== role),
                          })
                        }
                      />
                      {role}
                    </label>
                  ))}
                </div>
                <div className={styles.options}>
                  {NOTICE_PLANS.map((plan) => (
                    <label key={plan}>
                      <input
                        type="checkbox"
                        checked={draft.audience.plans.includes(plan)}
                        onChange={(e) =>
                          update("audience", {
                            ...draft.audience,
                            plans: e.target.checked
                              ? [...draft.audience.plans, plan]
                              : draft.audience.plans.filter((p) => p !== plan),
                          })
                        }
                      />
                      {plan}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label>
                Hide notice after (optional)
                <input
                  type="datetime-local"
                  value={draft.expiresAt ? localDateInput(draft.expiresAt) : ""}
                  onChange={(e) =>
                    update(
                      "expiresAt",
                      e.target.value
                        ? new Date(e.target.value).toISOString()
                        : null,
                    )
                  }
                />
                <small>Uses your local time zone.</small>
              </label>
            </fieldset>
            {uploading && (
              <p role="status">Uploading and processing your image…</p>
            )}
            {error && (
              <p role="alert" className={styles.error}>
                {error}{" "}
                <button type="button" onClick={() => load(page)}>
                  Reload list
                </button>
              </p>
            )}
            {message && (
              <p role="status" className={styles.success}>
                {message}
              </p>
            )}
            <div className={styles.actions}>
              <button
                type="button"
                disabled={busy || !!uploading}
                onClick={() => save("draft")}
              >
                {editing?.status === "published"
                  ? "Unpublish to draft"
                  : "Save draft"}
              </button>
              <GlassButton
                type="button"
                busy={busy}
                disabled={!!uploading}
                onClick={() => {
                  const valid = noticeSchema.safeParse({
                    ...draft,
                    status: "published",
                  });
                  if (!valid.success) setError(valid.error.issues[0].message);
                  else {
                    setError("");
                    setConfirmPublish(true);
                  }
                }}
              >
                {editing?.status === "published"
                  ? "Review update"
                  : "Review & publish"}
              </GlassButton>
              {editing && editing.status !== "archived" && (
                <button
                  type="button"
                  disabled={busy || !!uploading}
                  onClick={() => save("archived")}
                >
                  Archive
                </button>
              )}
            </div>
            {confirmPublish && (
              <div className={styles.publishReview}>
                <strong>Publish to {audienceLabel}?</strong>
                <p>
                  {editing?.status === "published"
                    ? "This update will appear as unread for eligible users."
                    : "The notice will be available under their notification bell immediately."}
                </p>
                <div className={styles.actions}>
                  <GlassButton
                    type="button"
                    busy={busy}
                    onClick={() => save("published")}
                  >
                    Publish notice
                  </GlassButton>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirmPublish(false)}
                  >
                    Keep editing
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
        <aside className={styles.preview} aria-label="Live notice preview">
          <div className={styles.previewBar}>
            <h3>Live preview</h3>
            <div className={styles.tabs}>
              <button
                type="button"
                aria-pressed={preview === "paper"}
                onClick={() => setPreview("paper")}
              >
                3D paper
              </button>
              <button
                type="button"
                aria-pressed={preview === "text"}
                onClick={() => setPreview("text")}
              >
                Text view
              </button>
            </div>
          </div>
          {preview === "paper" ? (
            <NoticePaper notice={draft} />
          ) : (
            <NoticeContent notice={draft} />
          )}
          <p className={styles.caption}>
            The paper includes the full notice. Longer messages continue on
            additional pages.
          </p>
        </aside>
      </div>
    </div>
  );
}
function localDateInput(value: string) {
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
