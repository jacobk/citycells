# Ticket 022: Dark Mode Toggle

**Related:** PRD Section 3.14 (Dark Mode Toggle)  
**Feature:** [Branding & Visual Identity](../features/branding-visual-identity.md)  
**Status:** Ready for Implementation  
**Created:** 2026-02-16

## Context to Load

Files the implementation agent MUST read first:

1. `docs/PRD/001-mvp-mobile-walker.md` Section 3.14 - Dark Mode Toggle requirements
2. `docs/features/branding-visual-identity.md` - Current implementation details
3. `src/app/globals.css` - Existing dark mode CSS variables (`.dark` class)
4. `src/app/layout.tsx` - Root layout where theme class is applied
5. `src/components/HamburgerMenu/HamburgerMenu.tsx` - Where toggle will be added

## Implementation Checklist

### 1. Create Theme Hook

Create `src/hooks/useTheme.ts` to manage theme state:
- Read initial theme from localStorage (key: `citycells-theme`)
- Default to `'system'` if no preference stored
- Expose `theme` state and `setTheme(theme: 'system' | 'light' | 'dark')` function
- Apply `.dark` class to `<html>` element based on preference
- Listen to `prefers-color-scheme` changes when in `'system'` mode

### 2. Add Theme Toggle to Hamburger Menu

Add three-way theme selector to `HamburgerMenu.tsx`:
- Position below "Show Routes" toggle, separated by divider
- Display current theme with icon (sun/moon/monitor)
- Cycle through options on tap, or show dropdown/segmented control

### 3. Persist Theme Preference

- Save to localStorage on change
- Read on initial mount (handle SSR with `useEffect`)
- Prevent flash of wrong theme (consider inline script or CSS approach)

### 4. Update Layout

Modify `src/app/layout.tsx` to:
- Remove `suppressHydrationWarning` if no longer needed
- Ensure theme is applied before first paint (consider inline script in `<head>`)

## Maintainability

Before implementing, review for:

- [x] **Refactor opportunity?** Theme logic should be isolated in a single hook
- [x] **DRY check** - No existing theme logic to consolidate
- [x] **Modularity** - Hook can be reused anywhere theme info is needed
- [ ] **Debt impact** - Reduces debt by completing dark mode feature

## Acceptance Criteria

- [ ] Hamburger menu shows theme toggle with current selection (System/Light/Dark)
- [ ] Selecting "Dark" immediately applies dark theme (`.dark` class on `<html>`)
- [ ] Selecting "Light" immediately applies light theme (removes `.dark` class)
- [ ] Selecting "System" follows `prefers-color-scheme` media query
- [ ] Theme preference persists after page refresh
- [ ] Theme preference persists after closing and reopening browser
- [ ] No flash of wrong theme on page load
- [ ] Build and lint pass

## Files to Modify

| File | Change |
|------|--------|
| NEW: `src/hooks/useTheme.ts` | Theme state management hook |
| `src/components/HamburgerMenu/HamburgerMenu.tsx` | Add theme toggle UI |
| `src/app/layout.tsx` | Theme initialization (may need inline script) |

## Notes

- Do NOT duplicate PRD content - reference Section 3.14
- The `.dark` class and CSS variables already exist in `globals.css`
- Consider using `next-themes` library if complexity warrants it, but simple localStorage + hook should suffice
