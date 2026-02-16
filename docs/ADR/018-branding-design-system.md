# ADR 018: Modern Branding & Design System

**Status:** Accepted
**Date:** 2026-02-16
**Deciders:** Product Owner, Lead Engineer
**Consulted:** -

## Context

The current application lacks a cohesive visual identity. The user requested a "modern, sleek" look with improved branding (logo, favicon, title). The current styling relies on default Tailwind classes without a defined design system or consistent tokens.

To achieve a professional appearance and maintain consistency as the app grows, we need a strategy for managing design tokens (colors, typography, spacing) and reusable UI components.

## Decision

We will implement a lightweight Design System using **Tailwind CSS configuration** as the source of truth for design tokens.

Specifics:
1.  **Typography**: Adopt `Geist Sans` (Vercel's font) or `Inter` as the primary typeface for a modern, clean look.
2.  **Color Palette**: Define semantic color tokens in `tailwind.config.ts` (e.g., `primary`, `secondary`, `accent`, `muted`) rather than hardcoded hex values.
3.  **Component Library**: Adopt **shadcn/ui** (which uses Radix UI + Tailwind) for base components (buttons, cards, dialogs) to ensure a high-quality, accessible, and "sleek" baseline without building from scratch.
4.  **Logo & Assets**: Store branding assets (Logo, Isotype) in `public/branding/` and expose them via a `Brand` component for consistent usage.

## Consequences

**Positive:**
- **Consistency**: All UI elements will share the same spacing, colors, and typography.
- **Speed**: `shadcn/ui` provides copy-paste components that are easily customizable, speeding up development of "sleek" UI.
- **Maintainability**: Changing the primary color or font requires a single update in `tailwind.config.ts`.
- **Professionalism**: A defined type scale and color palette immediately elevates the perceived quality of the app.

**Negative:**
- **Learning Curve**: Developers must use the defined semantic tokens (e.g., `bg-primary`) instead of arbitrary colors.
- **Setup**: Initial setup of `shadcn/ui` and token definition requires some boilerplate work.

## References
- [Tailwind CSS Configuration](https://tailwindcss.com/docs/configuration)
- [shadcn/ui Documentation](https://ui.shadcn.com/)
