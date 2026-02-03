# PRD 001 - MVP Mobile Walker

**Date:** 2026-02-02 (Updated: 2026-02-03)  
**Status:** In Progress

## 1. Overview

The goal is to create a mobile-first web application that gamifies exploring Malmö by challenging users to walk around the borders of its 136 sub-areas (delområden). Progress is tracked automatically via Strava.

## 2. User Stories

### Core Stories
*   **As a user,** I want to see a map of Malmö with all sub-areas outlined, so I know where to walk.
*   **As a user,** I want to log in with my Strava account, so the app can access my walks.
*   **As a user,** I want the app to automatically find my walks tagged with `#malmödelområde` and match them to the areas.
*   **As a user,** I want to clearly see which areas I have completed and their quality tier (Platinum/Gold/Silver/Bronze).
*   **As a user,** I want to see a progress bar indicating how many total areas I have conquered.

### Quality & Scoring Stories
*   **As a user,** I want to see a detailed score breakdown for each area, so I understand how to improve.
*   **As a user,** I want to hover over an area to quickly see my score and tier.
*   **As a user,** I want to tap an area to see full details including all my walks for that area.
*   **As a user,** I want to mark obstacle detours as "exempt" so my score isn't penalized for unavoidable obstacles.

## 3. Functional Requirements

### 3.1 Map Interface
*   Full-screen map view centered on Malmö.
*   Render `malmo_delomraden.geojson` as a polygon layer.
*   Polygons must be interactive (hover, click).
*   Current User Location marker (geolocation).

### 3.2 Authentication & Data
*   "Connect with Strava" button using OAuth 2.0.
*   Fetch authenticated user's activities.
*   Filter activities by text search in title/description (Keyword: `#malmödelområde`).
*   Store synced activities in local SQLite database (see ADR 004).

### 3.3 Analysis Logic (The "CityCells" Algorithm)

*Reference: ADR 002 (Exclusive Matching), ADR 003 (Multi-Metric Scoring)*

For each eligible activity:
1.  Fetch the detailed GPS stream (lat/lng points) from Strava.
2.  Create a buffer (validity zone) of **25 meters** around the perimeter of each sub-area.
3.  **Exclusive Assignment**: Assign the walk to the *one* sub-area where it has the highest perimeter coverage (must be > 50%).
4.  **Multi-Metric Analysis**: Calculate all metrics (see ADR 003):
    *   Perimeter coverage (%)
    *   Area coverage (m²) - if walk forms a closed loop
    *   RMSE alignment error (meters)
    *   Maximum deviation (meters)
    *   Efficiency (%)
5.  **Deviation Detection**: Identify segments where walker deviated >30m from border.
6.  **Quality Score**: Compute composite score (0.0 - 1.0).
7.  **Tier Assignment**: Assign tier based on score (Platinum ≥0.95, Gold ≥0.85, Silver ≥0.70, Bronze ≥0.50).
8.  **Persistence**: Store analysis results in SQLite.

### 3.4 Area Status Visualization

Display completed areas with tier-colored fill:

| Status      | Fill Color | Hex       | Opacity |
|-------------|------------|-----------|---------|
| Platinum    | Purple     | `#a855f7` | 0.4     |
| Gold        | Gold       | `#eab308` | 0.4     |
| Silver      | Gray       | `#9ca3af` | 0.4     |
| Bronze      | Bronze     | `#cd7f32` | 0.4     |
| Not Started | None       | —         | —       |

*   Unmatched areas: Gray outline only, no fill.
*   Border color matches tier color for completed areas.

### 3.5 Hover Interaction

**Desktop:** Mouse hover over area.  
**Mobile:** Long-press (500ms) on area.

Display floating tooltip with:
*   Area name (e.g., "Västra Hamnen")
*   Tier badge icon (colored circle or medal)
*   Quality score (e.g., "Score: 0.82")
*   Number of matched walks (e.g., "3 walks")
*   Best walk date and Strava link

Tooltip dismisses on mouse-out (desktop) or tap elsewhere (mobile).

### 3.6 Area Details Panel

**Trigger:** Click/tap on any area (completed or not).

**Panel Type:** Slide-up bottom sheet (mobile-friendly).

**Content Structure:**

#### Header
*   Area name (large)
*   Tier badge and quality score (if completed)
*   "Not yet walked" indicator (if incomplete)

#### Score Breakdown (if completed)
| Metric | Value | Weight |
|--------|-------|--------|
| Perimeter Coverage | 78% | 40% |
| Area Coverage | 65% | 25% |
| Alignment (RMSE) | 12m | 20% |
| Efficiency | 89% | 15% |
| **Quality Score** | **0.76** | — |

#### Area & Perimeter Info
*   Total area: X m² (or km² for large areas)
*   Enclosed area: X m² (from your best walk)
*   **Sub-area Circumference**: Total perimeter length of the sub-area (X.XX km)
*   **Total Walk Length**: Complete distance of the walk (X.XX km)
*   **Perimeter Walked**: Length of walk path that falls within the perimeter buffer (X.XX km)
*   **Walk vs Circumference**: Difference between walk length and circumference
    *   Positive values shown as "+X.XX km (detours)" - indicates detours beyond the perimeter
    *   Negative values shown as "-X.XX km (efficient)" - indicates efficient route
*   Loop status: ✓ Closed / ⚠ Open (Xm gap)

#### Walk History
List of all matched walks for this area:
*   Walk name / date
*   Distance walked
*   Individual quality score
*   Link to Strava activity
*   Indicator if this is the current "best" walk

#### Deviations Section (if any detected)
*   List of detected deviations for best walk
*   Each showing:
    *   Border gap bypassed (e.g., "45m of border skipped")
    *   Detour distance (e.g., "120m walked")
    *   Max deviation from border (e.g., "38m max")
    *   Classification (Obstacle avoidance / Shortcut / Drift)
    *   Exemption status (Exempt ✓ / Not exempt)
*   "Mark as Exempt" button for non-exempt deviations
*   "Remove Exemption" button for exempt deviations

### 3.7 Exemption Management

**Mark as Exempt Flow:**
1.  User taps "Mark as Exempt" on a deviation.
2.  Modal appears with reason selection:
    *   Private property
    *   Highway / Major road
    *   Water / River
    *   Construction zone
    *   Fenced area
    *   Other (free text required)
3.  User selects reason and confirms.
4.  Score recalculates immediately.
5.  Deviation shows "Exempt ✓" with reason tooltip.

**Remove Exemption Flow:**
1.  User taps "Remove Exemption" on an exempt deviation.
2.  Confirmation dialog appears.
3.  On confirm, exemption is removed.
4.  Score recalculates immediately.

**Exemption Rules:**
*   Exemptions are per-deviation, per-walk.
*   Exempting a deviation increases effective perimeter coverage.
*   Exempted detour distance is excluded from efficiency calculation.
*   Users can view all exemptions in the details panel.

### 3.8 Data Persistence

*Reference: ADR 004 (SQLite Storage)*

*   All data stored locally in browser using sql.js (SQLite in WebAssembly).
*   Data persists to IndexedDB across sessions.
*   Analysis results cached—no re-analysis on page reload.
*   Export database feature for backup (downloads `.db` file).
*   Import database feature to restore from backup.

## 4. Non-Functional Requirements

*   **Mobile First:** UI controls (buttons, drawers, panels) must be touch-friendly and positioned for thumb usage.
*   **Performance:** Map interactions should remain 60fps even with 136 polygons rendered.
*   **Privacy:** Only access read permissions for Strava activities. All data stays on user's device.
*   **Offline Capable:** After initial sync, app should work offline (viewing progress, not syncing new walks).
*   **Responsive:** Details panel adapts to screen size (full sheet on mobile, side panel on desktop).

## 5. Future Considerations (Post-MVP)

*   **Leaderboards:** Compare scores with other users (requires server component).
*   **Social Sharing:** Share achievements on social media with generated images.
*   **Route Suggestions:** Suggest optimal walking routes for incomplete areas.
*   **Multi-city Support:** Expand beyond Malmö to other cities.
*   **Sync Across Devices:** Cloud storage for progress (requires authentication backend).
*   **Achievements/Badges:** Gamification elements beyond tiers.
