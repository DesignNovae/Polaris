# ThreeUI GalleryHeading — verified source snapshot

Source: user-supplied complete bundle from https://threeui.com/source-code/gallery-heading.json.
The three registered files under `src/` are byte-exact, including their final newlines.
Their SHA-256 values are pinned in `scripts/sync-threeui-gallery.mjs`.

The original component file also imports unrelated effects absent from this bundle.
The sync script extracts the complete `GalleryHeading` dependency closure using the
TypeScript AST, copies every selected declaration verbatim, and selects only the
original `EFFECTS.galleryHeading` entry. Its generated adapter lives under
`components/threeui/`. The only import adaptation is Vite `?raw` to an equivalent
JSON string containing the exact canonical HTML. Shared CSS is served unchanged
from `public/threeui/threeui.css`; its selectors and asset paths are preserved.

Regenerate: `node scripts/sync-threeui-gallery.mjs`

Check hashes and generated-file drift: `node scripts/sync-threeui-gallery.mjs --check`

Compare configured output against the full original registry:
`node scripts/verify-threeui-gallery.mjs`

The base `GalleryHeading` retains the exact configured output (`vertical-loop`,
`dark`, `didone`, `400`, `1.25`, `0`, `1`, `1`). The landing page now uses the
separate `PolarisGalleryHeading.tsx` customization requested after that integration.
It replaces the stock headline with “ONE CONNECTED / COMMAND CENTER”, uses Polaris
cream stock and rose/espresso headline ink, and composites eight transparent renders
of lit Three.js module meshes onto the original card textures. The twelve halftone
plates, projection, type treatment, hover-driven reverse orbit, runtime messages,
opaque sandbox, and Canvas scaling are preserved. No card labels or drag controller
are added. The generator exports extension points without changing source declarations.

The original GalleryHeading clock does not query reduced-motion preferences and
continues scheduling frames while idle. This integration does not silently change
that behavior. Destroying the iframe tears down the entire isolated document.
