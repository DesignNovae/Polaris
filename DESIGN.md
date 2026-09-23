---
name: Polaris Notices and Shared Effects
description: Scoped record of the implemented floating paper, brown glass controls, and transparent Polaris loading.
colors:
  brown: "#8b5e3c"
  copper: "#d99a63"
  sand: "#f1c899"
  paper-ink: "#f6f1e8"
  glass-ink: "#fff4e6"
  dark-stock: "#17130f"
  theme-ink: "rgb(var(--ink))"
  theme-muted: "rgb(var(--ink-dim))"
  theme-card: "rgb(var(--bg-card))"
typography:
  headline:
    fontFamily: "var(--font-libre), Georgia, serif"
    fontSize: "clamp(26px, 3vw, 36px)"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "var(--font-libre), Georgia, serif"
    fontSize: "clamp(23px, 2.5vw, 32px)"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "-0.02em"
  body:
    fontFamily: "var(--font-inter), sans-serif"
    fontSize: "14px"
    lineHeight: 1.85
  label:
    fontFamily: "var(--font-inter), sans-serif"
    fontSize: "13px"
    fontWeight: 500
rounded:
  field: "8px"
  surface: "12px"
  circle: "50%"
spacing:
  compact: "8px"
  control: "12px"
  pair: "16px"
  field: "20px"
  section: "24px"
components:
  glass-button-sm:
    backgroundColor: "{colors.brown}"
    textColor: "{colors.glass-ink}"
    rounded: "{rounded.surface}"
    padding: "6px 12px"
  glass-button-md:
    backgroundColor: "{colors.brown}"
    textColor: "{colors.glass-ink}"
    rounded: "{rounded.surface}"
    padding: "8px 15px"
  glass-button-lg:
    backgroundColor: "{colors.brown}"
    textColor: "{colors.glass-ink}"
    rounded: "{rounded.surface}"
    padding: "10px 22px"
  notice-input:
    backgroundColor: "{colors.theme-card}"
    textColor: "{colors.theme-ink}"
    rounded: "{rounded.field}"
    padding: "11px 12px"
    width: "100%"
  notice-content:
    backgroundColor: "{colors.theme-card}"
    textColor: "{colors.theme-ink}"
    rounded: "{rounded.surface}"
    padding: "clamp(20px, 3vw, 36px)"
  paper-control:
    textColor: "{colors.sand}"
    rounded: "{rounded.circle}"
    width: "40px"
    height: "40px"
  unread-badge:
    backgroundColor: "{colors.brown}"
    textColor: "white"
    rounded: "{rounded.field}"
    padding: "2px 3px"
---

# Design System: Polaris Notices and Shared Effects

## Overview

**Creative North Star: "Floating dark paper, warm copper"**

This is a scoped record of the implemented notices and shared effects, not a replacement identity for Polaris. The notice paper carries the supplied Site of the Year material and motion in brown and copper. Administrative controls retain the incumbent light and dark workspace themes.

Brown glass buttons provide tactile emphasis. A large transparent Polaris orb supplies graphic-only loading feedback, with status text available to assistive technology. Preserve the Polaris name and compass mark.

**Key Characteristics:**
- Dark floating paper with copper artwork and warm readable text.
- Theme-aware administrative surfaces with serif headings and compact sans-serif controls.
- Brown glass CTAs with restrained lift and a moving border highlight.
- Transparent graphic-only loading connected to pending work.

Evidence: `components/notices/`, `components/ui/GlassButton.tsx`, `components/ui/PolarisLoading.tsx`, `components/ui/LoadingActivity.tsx`, `components/ui/effects.module.css`, and `assets/notice-paper-art.js`. Inherited font and theme values come from `app/layout.tsx` and `app/globals.css`. Feature behavior and provenance remain in [NOTICES_AND_EFFECTS.md](docs/NOTICES_AND_EFFECTS.md).

## Colors

The primary family is warm brown and copper; paper text uses sand and warm off-white. Admin surfaces inherit the live theme variables rather than freezing one theme into the feature.

### Primary
- **Brown:** CTA foundations, unread counts, and audience checkbox accents.
- **Copper:** paper artwork, the final title line, framing, and paper control focus.
- **Sand:** paper introduction and navigation text.

### Neutral
- **Paper Ink:** light text on the dark paper.
- **Glass Ink:** warm text inside brown CTAs.
- **Dark Stock:** readable paper fallback.
- **Theme Ink / Theme Muted / Theme Card:** existing foreground, secondary copy, and form/content surfaces. The source theme swaps their values between light and dark modes.

**The Theme Boundary Rule.** Keep admin controls bound to the incumbent theme; preserve the notice paper's dark material in either theme.

## Typography

The surrounding interface inherits Inter; admin and semantic notice headings use Libre Baskerville with Georgia fallback. Body copy stays compact and readable, with the semantic full message limited to (72ch). Labels and control text sit below the heading scale without competing for attention.

The frontmatter records the implemented interface roles, not a universal application type ramp. The paper canvas separately uses Inter Tight for its dynamically fitted title and Inter for message text. Its source texture sizes are rendering coordinates, not CSS sizes for future screens. Mobile paper text becomes larger in the texture when the renderer viewport is below (600px).

## Layout

The notification reader is a native modal dialog across the viewport, preserving the underlying workspace and scroll position. The standalone paper occupies a transparent stage. Desktop paper insets are (25px 72px 16px); at (680px) and below they become (62px 0 66px), reserving space for close and navigation controls.

Admin composition uses an archive, editor, and preview with a (24px) gap. At (1100px) and below, the preview moves below the editor; at (680px) and below the composition becomes one column, paired fields stack, and the archive becomes a bounded scrolling region. The narrow archive exposes pending state through `aria-busy` and a screen-reader status.

**The Floating Reader Rule.** Open notices over the current page as standalone paper; do not add a user-facing notice workspace or card shell around this reader.

## Elevation & Depth

The CTA combines a rotating conic border beam, a near-opaque brown gradient inset, a small shadow, and a one-pixel hover lift. Its interior blur is (8px); the beam completes a cycle in (4s). The notice dialog separates the paper from the current page using a dark translucent backdrop with (9px) blur. Paper bending, inertia, and hover light remain owned by the supplied renderer.

The global loading surface has a transparent background and does not intercept pointer input. Its orb occupies (192px × 192px), and the fixed overlay centers it in the viewport. Full shadow and motion values are captured in the sidecar.

**The Transparent Activity Rule.** Present the global loading orb without a visible label, card, or backdrop; retain its accessible status.

## Shapes

Forms, archive selections, and images use modest rounded corners. Glass buttons and semantic content surfaces share the larger surface radius. Paper navigation controls are circular; the notice artwork remains a rectangular sheet with copper corner marks and a compass identity. These sheet details belong to the paper material and are not a general decoration for admin forms.

## Components

### Glass button

A native button with small, medium, and large variants. Their minimum heights are (32px), (38px), and (44px), with type sizes (12px), (13px), and (14px). Medium is the default. The inset follows the outer curve with a one-pixel border reveal. Hover lifts the control; active returns it to rest. Keyboard focus has a copper-brown outline, and disabled or busy state prevents activation. Busy state replaces the icon with a spinner. Reduced motion stops the beam and spinner animation and removes the transition.

### Fields, audience selection, and content surfaces

Inputs, textareas, and selects use theme card fill, a subtle ink border, and the field radius. Labels remain visible above the field; help text uses muted ink. Audience options use native checkboxes in wrapping rows, with separate role and plan groups. The publication review is a quiet tinted surface. Semantic notice content uses the theme card surface in preview and a dark, square-cornered treatment in the paper fallback.

### Bell and reader controls

The notification bell is a compact icon button with an unread badge. Page controls and notice switching are distinct navigation groups; unavailable directions are disabled. Preserve accessible names for icon controls, native dialog focus, Escape dismissal, and focus restoration. Long notice text continues across paper pages, and a readable semantic fallback remains available when WebGL fails.

### Polaris loading

`PolarisLoadingScreen` places the shared orb at viewport center. `PolarisLoading` offers the same graphic with a polite screen-reader status for component rendering. `LoadingActivity` waits (800ms) before displaying foreground API activity; concurrent work is tracked independently, and background polling is excluded. Feature-owned streaming progress continues after headers arrive. The orb pauses when offscreen or hidden and respects reduced motion.

The sidecar contains standalone HTML/CSS specimens of actual UI primitives. These are design references, not substitutes for the React behavior or the sandboxed WebGL renderers. Generated effect files are built from the supplied source and artwork adapter; do not hand-edit them.

## Do's and Don'ts

### Do:
- Do retain the incumbent light and dark themes around the dark notice paper.
- Do use the shared brown glass button for the implemented primary CTA treatment.
- Do preserve keyboard access, readable fallback content, and reduced-motion behavior.
- Do connect loading feedback to real pending work and keep its status accessible.

### Don't:
- Don't wrap the floating reader in a new notice workspace or card shell.
- Don't give the global orb a visible text label, opaque background, or loading card.
- Don't promote paper texture coordinates or decorative metadata into a whole-app type system.
- Don't edit generated effect assets directly.
