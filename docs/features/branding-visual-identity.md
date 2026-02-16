# Feature: Branding & Visual Identity

**Status:** Implemented
**Last Updated:** 2026-02-16
**PRD Reference:** [PRD-001 Section 3.14](../PRD/001-mvp-mobile-walker.md#314-branding--visual-identity-added-2026-02-16)
**ADR Reference:** [ADR-018 Modern Branding & Design System](../ADR/018-branding-design-system.md)

## 1. Overview

This feature establishes a professional, cohesive visual identity for CityCells. It moves the application from a raw "developer prototype" look to a polished, user-ready product ("modern sleek"). It involves implementing a formal Design System (via Tailwind & Shadcn/UI), updating all brand assets (logo, favicons), and refining the core UI typography and color palette.

## 2. User Stories

*   **As a user,** I want the app to look professional and trustworthy, so I feel comfortable connecting my Strava account.
*   **As a user,** I want to easily identify the app in my browser tabs and home screen via a distinct icon.
*   **As a developer,** I want a consistent set of design tokens (colors, spacing, typography) so I can build new features without inventing styles.
*   **As a user,** I want to toggle between light, dark, and system theme modes so I can use my preferred visual style regardless of my device settings.

## 3. Rationale

The current application uses default Tailwind styles and lacks a unique identity. "CityCells" implies a geometric, map-based concept, but the UI doesn't reflect this.
By adopting **Shadcn/UI** and a **custom Tailwind configuration**, we can achieve a "sleek" look with minimal effort while ensuring consistency.
The decision to use a **violet/purple primary theme** aligns with the highest achievement tier (Platinum), subtly encouraging users towards that goal.

## 4. Design System Specification

### Typography
*   **Font Family:** `Geist Sans` (or `Inter`)
*   **Weights:** Regular (400), Medium (500), Bold (700)

### Color Palette (Tailwind Tokens)
*   **Primary:** Violet-600 (`#7c3aed`) -> Matches Platinum Tier
*   **Secondary:** Slate-100 (`#f1f5f9`)
*   **Accent:** Fuchsia-500 (`#d946ef`) -> Matches Silver/Gold transition
*   **Destructive:** Red-500 (`#ef4444`)

### Assets
*   **Logo:** SVG mark representing "Cells" (polygons).
*   **Favicon:** Generated via RealFaviconGenerator or similar, supporting dark/light modes if possible.

## 5. Implementation Details

### 5.1 Completed (TICKET-020, TICKET-021)
*   [x] Install `shadcn/ui` dependencies (cva, clsx, tailwind-merge, lucide-react, tw-animate-css).
*   [x] Configure CSS design tokens in `globals.css` with brand colors (oklch format).
*   [x] Add `Geist` font to `layout.tsx` (already present from Next.js setup).
*   [x] Generate and place favicon assets in `public/` and `public/branding/`.
*   [x] Create `Brand` component (`src/components/Brand/`) for logo usage.
*   [x] Update `metadata` in `layout.tsx` with title, description, favicon links.
*   [x] Implement dark mode CSS variables (`.dark` class).
*   [x] Update components to use brand colors (ProfileCard, HamburgerMenu, AreaDetailsPanel).

### 5.2 Completed (TICKET-022)
*   [x] Add dark mode toggle to Hamburger Menu (System / Light / Dark).
*   [x] Implement theme persistence via localStorage (`citycells-theme` key).
*   [x] Add `useTheme` hook (`src/hooks/useTheme.ts`) to manage `.dark` class on `<html>` element.
*   [x] Add inline script in `layout.tsx` to prevent flash of wrong theme (FOUC).
*   [x] Update HamburgerMenu to use design system tokens for dark mode support.

## 6. Current Limitations

*   **Map Tiles in Dark Mode:** Map tiles are inverted via CSS filter. A custom Mapbox dark style would provide better results but is out of scope for MVP.
