# Notices, buttons, and loading

The notification bell opens a floating 3D paper over the current page. It keeps the current workspace and scroll position, supports Escape and keyboard focus, and has small page controls for longer messages. The demo uses a clearly labeled sample and never sends it to real users.

Vertical dragging and pointer tilt follow the pointer direction. This interaction correction lives in the effect generator; the archived ThreeUI source remains unchanged.

Dragging captures the pointer and never dismisses the notice on release. Outside dismissal requires a separate press and release on the backdrop with no drag; Escape and the close button remain available.

## Publishing a notice

1. Sign in as an administrator and open `/admin/notices`.
2. Add a title, introduction, full message, category, and priority.
3. Optionally upload a cover image and publisher logo, and add an action link.
4. Select recipient roles and plans. A reader must match **one selected role AND one selected plan**. Select everything to reach all signed-in users.
5. Save a draft or review and publish. Optionally set an expiry date. Archive or unpublish to remove a notice from delivery.

Drafts are admin-only. Published notices appear under the bell; its unread count refreshes every minute and when the tab becomes visible. A notice is marked read after its content has been rendered. Published edits become unread again. Read state belongs to each account.

Server routes enforce authentication, administrator permissions, audience matching, expiry, request size limits, and same-origin writes. Optimistic revisions prevent one administrator from silently overwriting another administrator’s edits. Notice images require authenticated access and a matching published notice unless the viewer is an administrator.

## Storage and deployment

The existing MongoDB connection stores `notices`, `notice_reads`, and `notice_media`. Indexes are registered by the existing application startup path. No extra hosted service or environment variable is needed for production.

Uploads accept still JPEG, PNG, and WebP files up to 2 MB and 16 megapixels. Sharp re-encodes them to WebP at a maximum of 1600 pixels and strips camera/location metadata. Unattached uploads expire after 24 hours; images attached to saved notices are retained. Large deployments should review media retention and move storage to a private object store when appropriate.

## Shared effects

- `GlassButton` is the shared brown glass CTA. It is used by primary/accent workspace buttons, the Strategist control, and notice publishing. It preserves native button semantics, disabled state, focus, and reduced motion.
- `PolarisLoadingScreen` renders only the transparent 192px Polaris orb, with a screen-reader status. Root, workspace, demo, admin, and notice route loading boundaries use it.
- Route loading boundaries show the orb while navigation is pending. API requests use the loading state of their own feature, so a roadmap spinner or notice status never competes with a second screen-wide loader.
- `PolarisLoading` provides the same graphic inside a component waiting for data or rendering.

Both renderers run in script-only sandboxed frames. Notice content is passed as bounded text and validated WebP data, never as interpolated HTML. The paper preserves the supplied bending, inertia, hover light, and material; its artwork uses Polaris content and brown accents. Long messages continue across paper pages. A semantic text representation remains available to assistive technology, and WebGL failures show a readable paper fallback. Offscreen/hidden paper frames are unmounted; the orb pauses when hidden or offscreen and respects reduced motion.

## Source provenance

The supplied ThreeUI source is retained unchanged under `vendor/threeui/notice-effects/`. `manifest.json` records its SHA-256 hashes. `scripts/build-notice-effects.mjs` generates the adapted runtime assets in `public/effects/`; `assets/notice-paper-art.js` owns the notice artwork. Do not edit generated files directly.

```bash
node scripts/build-notice-effects.mjs
node --import ./tests/register.mjs --test tests/notices.test.ts
```

The database lifecycle suite is opt-in and requires a **dedicated test server**, never the application database:

```powershell
$env:NOTICES_INTEGRATION = '1'
$env:NOTICES_TEST_URI = 'mongodb://127.0.0.1:27017'
node --import ./tests/register.mjs --test tests/notices.integration.test.ts
```

It creates and removes a randomly named `pnqa_*` database, checking drafts, publishing, role/plan isolation, read receipts, updates, optimistic conflicts, archiving, and expiry validation.

Reference designs: [Glassmorphism CTA](https://threeui.com/buttons/rectangle-buttons/glassmorphism-cta), [Brand Orbs](https://threeui.com/ui-elements/brand-orbs/figma), and [Site of the Year paper](https://threeui.com/three-js/3d-paper/site-of-the-year). Retain the supplied source notices; bundling these files does not grant additional rights to the original designs.
