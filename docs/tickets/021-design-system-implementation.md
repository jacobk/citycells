# Ticket 021: Design System Implementation

**Status:** Blocked
**Blocked By:** [Ticket 020 - Brand Assets](./020-branding-visual-identity.md)
**Feature:** Branding & Visual Identity
**PRD Reference:** [PRD-001 Section 3.14](../PRD/001-mvp-mobile-walker.md#314-branding--visual-identity-added-2026-02-16)
**ADR Reference:** [ADR-018 Modern Branding & Design System](../ADR/018-branding-design-system.md)

## Context

Integrate the brand assets (from Ticket 020) and implement the design system using Tailwind and Shadcn/UI. This ticket transforms the app from a prototype look to a polished, "modern sleek" product.

## Files to Read First
- `tailwind.config.ts` (Configuration to update)
- `src/app/layout.tsx` (Metadata and font injection)
- `src/app/globals.css` (Global styles)
- `docs/features/branding-visual-identity.md` (Feature details)
- `public/branding/` (Assets from Ticket 020)

## Implementation Plan

### 1. Install & Configure Shadcn/UI
- [ ] Run `npx shadcn@latest init` and follow prompts.
- [ ] Configure `components.json` for project structure.

### 2. Update Tailwind Config
- [ ] Add semantic color tokens to `tailwind.config.ts`:
  ```ts
  colors: {
    primary: '#7c3aed',    // Violet - matches Platinum tier
    secondary: '#f1f5f9',  // Slate-100
    accent: '#d946ef',     // Fuchsia
    destructive: '#ef4444' // Red
  }
  ```
- [ ] Configure CSS variables in `globals.css` if using Shadcn's theming approach.

### 3. Typography
- [ ] Add `Geist Sans` font (or `Inter` as fallback) to `src/app/layout.tsx`.
- [ ] Update `tailwind.config.ts` `fontFamily` if needed.

### 4. Integrate Brand Assets
- [ ] Update `src/app/layout.tsx` metadata:
  - Title: `"CityCells - Malmö Explorer"`
  - Description: Update to reflect the app's purpose.
  - Favicon links pointing to new assets.
- [ ] Create `src/components/Brand.tsx` component that renders the logo SVG.
- [ ] Use `Brand` component in appropriate locations (e.g., header, loading screen).

### 5. UI Polish
- [ ] Replace hardcoded hex values in `globals.css` with new CSS variables/tokens.
- [ ] Verify buttons, cards, and panels use the new primary/accent colors.
- [ ] Ensure consistent border-radius (`rounded-md` or `rounded-lg`).

## Acceptance Criteria
- [ ] Browser tab shows "CityCells - Malmö Explorer" title.
- [ ] Correct favicon appears in browser tab.
- [ ] Primary buttons use Violet brand color (`#7c3aed`).
- [ ] Font is consistent (Geist/Inter) across the app.
- [ ] No "Create Next App" text remains in metadata.
- [ ] `Brand` component exists and renders the logo.

## Refactoring & Debt
- **DRY:** Centralize all brand colors in Tailwind config; remove hardcoded hex values scattered in components.
- **Maintainability:** `Brand` component becomes single source of truth for logo usage.
- **Modularity:** Shadcn/UI components are copy-pasted into `src/components/ui/`, making them easy to customize without affecting the library.

## Testing
- [ ] Visual inspection: App looks "modern and sleek".
- [ ] `npm run build` passes without errors.
- [ ] `npm run lint` passes.
