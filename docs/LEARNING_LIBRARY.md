# Learning library

The Video Learning tab contains 60 curated lessons: ten each for IELTS Listening, Reading, Writing, Speaking, SAT Math, and SAT Reading and Writing. The 24 original IDs are preserved. All 60 source videos were checked for public availability, embedding permission, and duration when the catalog was built. Two unavailable candidates were replaced before publication. SAT foundations teach underlying skills; the catalog does not label them all as official SAT exam lessons.

## Experience

- Browse all lessons with thumbnails, actual durations, source attribution, exam/skill, editorial level, search, duration filters and sorting. Twelve results appear at a time, with a working Show more control.
- Six curated paths provide an ordered lesson queue and manual completion tracking. A completed path can be revisited.
- Save, Continue watching and Completed use the signed-in account. The player restores its source-clock position; changing filters leaves the active player alone. Selecting another lesson changes both video and signing input.
- Imported YouTube links and local files retain the existing live signing pipeline. Personal imports are transient and are not added to the curated catalog or watch history.
- Recommendations remain inside the curated catalog. The interface distinguishes generated explanations from the deterministic starter fallback; it does not claim to discover fresh videos on every click.

## Data and ownership

`data/learning/catalog.json` stores the verified source metadata and editorial selection. `lib/learning/catalog.ts` defines categories and paths. `components/learning/VideoLearningLibrary.tsx` owns the library/watching flow; the earlier studio export delegates to this component.

`GET/PATCH /api/learning/progress` require the existing Clerk session. MongoDB collection `learning_progress` uses an account/lesson primary key, plus an account lookup index. PATCH validates known catalog IDs, recording bounds and fields; clients cannot supply an owner. Independent fields are updated without replacing saved/completed state. Writes are serialized, with pending changes retained on failure and an explicit retry. Source position is sampled every five seconds and on pause/page exit. No audio, transcript or signing mesh is stored in learning progress.

## Maintain the catalog

These commands read public metadata; they do not download source video/audio. The existing signing Python environment supplies yt-dlp.

```powershell
# Discover candidates for editorial review (never automatically publish search results).
.cache/signing/venv/Scripts/python.exe scripts/learning-catalog-audit.py --search --output .cache/learning/candidates.json
# Recheck the entire current catalog.
.cache/signing/venv/Scripts/python.exe scripts/learning-catalog-audit.py --selection data/learning/catalog.json --output .cache/learning/catalog-check.json
# After editing additions.json, verify that selection, then rebuild only from checked metadata.
.cache/signing/venv/Scripts/python.exe scripts/learning-catalog-audit.py --selection data/learning/additions.json --output .cache/learning/addition-check.json
.cache/signing/venv/Scripts/python.exe scripts/build-learning-catalog.py .cache/learning/catalog-check.json .cache/learning/addition-check.json
```

Select lessons by relevant skill and original teaching source, avoiding duplicates, unsupported lengths, unavailable uploads, and copied reuploads. The builder rejects unavailable/non-embeddable videos and preserves actual metadata. Availability can change after a check; the player retains its retry/replacement controls and hides unavailable entries for the current browsing session.

## Validation

- Production build: compilation, TypeScript, lint and all 58 static pages passed.
- Fifteen targeted tests: library coverage/search/progress input validation plus existing interpreter buffer, media ownership and clock tests.
- Browser: restored Speaking category (10 lessons); saved vocabulary lesson persisted across reload; source position persisted at 1:49; reopening resumed with video at 111.761 s and signing at 111.760 s; manual completion appeared in Completed.
- Independent code review identified three corrected edge cases: unavailable recommendations, matching imported/catalog YouTube IDs, and stale upload responses.
- Desktop/mobile inspection identified a filter-row overflow at narrow desktop widths; the final layout uses two columns there and four only on wide screens.

Metadata availability and motion synchronization are not assessments of teaching quality or ASL accuracy. Signing remains the existing local research implementation; hosted deployments require a separately secured GPU service to run it remotely.
