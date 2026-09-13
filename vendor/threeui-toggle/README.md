# ThreeUI Shader Toggle source

`source-bundle.md` preserves the complete 14-file bundle supplied by the user.
The shader and renderer source hashes were verified against the bundle metadata.

The runtime adaptation is in `components/threeui/pro-badge/`:

- Removes the GLSL thumb and its contact shadow, as requested.
- Fits the authored capsule to a 64 × 28 px badge instead of a demo stage.
- Freezes animation time for reduced motion and hidden documents.
- Uses a local mode type without importing unused switch components.

`components/app/ProBadge.tsx` renders a noninteractive PRO label over the shader,
with copper color grading, a fallback surface, and context restoration handling.
