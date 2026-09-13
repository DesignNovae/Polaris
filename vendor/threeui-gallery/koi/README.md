# KoiStudies integration

The verified component is archived here. The byte-exact canonical HTML is served
at `public/synthralos-halftone.html`; shared CSS is `public/threeui/threeui.css`.
All three SHA-256 hashes are checked by `scripts/sync-threeui-koi.mjs --check`.

The generator makes a separate Polaris document and component. The requested
compact version retains the card geometry, pointer tilt and pixel-mask reveals.
The latest requested version uses a printed composition of the selected module's
3D icon in place of koi media. It extracts one card and disables
deck cycling and drag navigation. It omits the full-page shader and orbital
backdrop. Scoped CSS and a source extension add the selected module's name,
description, Explore action and a small accessible close icon inside that card.
Visible controls are native host elements aligned to rectangles reported by the
card renderer, so closing and navigation do not rely on iframe pointer delivery.

The rotating GalleryHeading publishes its own projected card geometry for native
host buttons. Each button opens the corresponding module stack. Parent/iframe
messages validate the sending window; navigation destinations come from the
host's fixed module data. The stack mounts only while the dialog is open.

Regenerate with `node scripts/sync-threeui-koi.mjs`. Never hand-edit generated HTML.
