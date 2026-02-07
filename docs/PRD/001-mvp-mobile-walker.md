# PRD 001 - MVP Mobile Walker

**Date:** 2026-02-02 (Updated: 2026-02-07)  
**Status:** In Progress

*Latest update: Persistent Strava Authentication (ADR 013) - tokens stored in SQLite for seamless returning user experience*

## 1. Overview

The goal is to create a mobile-first web application that gamifies exploring Malmö by challenging users to walk around the borders of its 136 sub-areas (delområden). Progress is tracked automatically via Strava.

## 2. User Stories

### Core Stories
*   **As a user,** I want to see a map of Malmö with all sub-areas outlined, so I know where to walk.
*   **As a user,** I want to log in with my Strava account, so the app can access my walks.
*   **As a user,** I want my Strava connection to persist across browser sessions, so I don't have to re-authenticate every time I open the app.
*   **As a user,** I want the app to automatically find my walks tagged with `#malmödelområde` and match them to the areas.
*   **As a user,** I want to clearly see which areas I have completed and their quality tier (Platinum/Gold/Silver/Bronze).
*   **As a user,** I want to see a progress bar indicating how many total areas I have conquered.

### Quality & Scoring Stories
*   **As a user,** I want to see a detailed score breakdown for each area, so I understand how to improve.
*   **As a user,** I want to hover over an area to quickly see my score and tier.
*   **As a user,** I want to tap an area to see full details including all my walks for that area.
*   **As a user,** I want to mark obstacle detours as "exempt" so my score isn't penalized for unavoidable obstacles.

### Metrics Documentation Stories (Updated: 2026-02-03)
*   **As a user,** I want to click on any metric to see a detailed explanation of what it measures.
*   **As a user,** I want to see visual illustrations of how each metric is calculated, so I understand the math intuitively.
*   **As a user,** I want user-friendly metric names that summarize what I did (e.g., "Border Traced" instead of "Perimeter Coverage").
*   **As a user,** I want to see examples of good vs. poor scores for each metric, so I know what to aim for.
*   **As a user,** I want tips on how to improve each metric, so I can get better scores on future walks.

### Sub-Area List & Navigation Stories (Added: 2026-02-04)
*   **As a user,** I want to see a list of all sub-areas sorted by circumference, so I can find short walks to complete.
*   **As a user,** I want to see which areas I've walked directly in the list view, so I can quickly identify remaining areas.
*   **As a user,** I want to drill into an area from the list to see all registered walks for that area.
*   **As a user,** I want breadcrumb navigation to return from area details to the list.
*   **As a user,** I want a hamburger menu to access different app sections without cluttering the map interface.

### Subarea Visual Context Stories (Added: 2026-02-07)
*   **As a user,** I want to see a mini-map of the selected subarea in the details panel, so I can study the area and plan my walking route.
*   **As a user,** I want to see streets and paths in the mini-map, so I can find walkable routes along the boundary.
*   **As a user,** I want to pan and zoom the mini-map, so I can explore different parts of the boundary in detail.
*   **As a user,** I want to see the circumference distance when hovering over an area, so I can quickly estimate how long a walk would take.
*   **As a user,** I want to see an estimated walk time alongside the circumference, so I can plan my walks around my available time.

### Re-Analysis Stories (Added: 2026-02-06)
*   **As a user,** I want to re-analyze my cached walks so that scores stay correct when the app's scoring formula changes.
*   **As a user,** I want to re-fetch and re-analyze my walks so that scores reflect the latest GPS data from Strava (e.g., after editing privacy zones or correcting an activity).
*   **As a user,** I want a re-analyze control in my profile popup so I can refresh all my walk scores in one place.
*   **As a user,** I want to choose between re-scoring only (fast) and full re-fetch plus re-score when source data may have changed.

### Offline Support Stories (Added: 2026-02-07)
*   **As a user,** I want the app to work well offline so I can check my progress and plan walks when I have no connection (e.g. in the field).
*   **As a user,** I want to open the app when offline (after I have used it at least once) so I can view the map, sub-areas, and my progress without internet.
*   **As a user,** I want to navigate the app and view area details when offline, so I can browse which areas I have completed and their scores without connectivity.
*   **As a user,** I want a clear indication when I am offline so I understand why syncing or external links are unavailable.

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

**Strava Data Limitations:**
*   `summary_polyline` may be truncated near the start/end due to privacy zones.
*   Use Strava `distance` for total walk length and efficiency denominators (see ADR 005).
*   Use `start_latlng` and `end_latlng` for loop detection when available (see ADR 005).

### 3.3 Analysis Logic (The "CityCells" Algorithm)

*Reference: ADR 002 (Exclusive Matching), ADR 003 (Multi-Metric Scoring)*

For each eligible activity:
1.  Decode Strava `summary_polyline` for GPS points and use Strava metadata for accuracy.
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

### 3.4 Area Status Visualization (Updated: 2026-02-04)

*Reference: ADR 010 (Map Visual Design System)*

Display completed areas using a **sequential heat map color gradient** for improved visibility and accessibility:

#### Base Map
*   Use a **grayscale/muted base map** (CSS filter or CartoDB Positron tiles) to reduce visual competition with data overlays.

#### Area Fill Colors (Vibrant Purple-Pink Gradient)

| Tier        | Fill Color     | Hex       | Opacity | Border Hex |
|-------------|----------------|-----------|---------|------------|
| Platinum    | Deep Violet    | `#7c3aed` | 0.65    | `#6d28d9`  |
| Gold        | Vibrant Purple | `#a855f7` | 0.60    | `#9333ea`  |
| Silver      | Magenta Pink   | `#d946ef` | 0.55    | `#c026d3`  |
| Bronze      | Soft Pink      | `#f0abfc` | 0.50    | `#e879f9`  |
| Not Started | None           | —         | —       | `#64748b`  |

*   Bold purple-to-pink gradient: higher scores = richer, deeper violet
*   High saturation colors that pop against grayscale base map
*   Meets WCAG 2.1 3:1+ contrast ratio between adjacent tiers

#### Walking Route Visualization (Updated: 2026-02-07)

**Default State:** Routes are **hidden by default** to reduce visual clutter. A toggle control allows users to show/hide walking routes.

**Toggle Control:**
*   Location: Map controls area (e.g., alongside zoom controls or in hamburger menu)
*   Label: "Show Walk Routes" or route icon
*   Default: OFF

**When Visible — Deviation-Based Coloring:**

| Condition | Color | Hex | Description |
|-----------|-------|-----|-------------|
| Within 25m buffer | Green | `#22c55e` | On-track, following boundary |
| Outside 25m buffer | Red | `#ef4444` | Deviation from boundary |

| Element | Width | Opacity |
|---------|-------|---------|
| Route Segment | 3px | 0.85 |

*   Binary threshold coloring: green = on boundary, red = deviation
*   Thinner lines reduce visual clutter (3px vs. previous 7px glow layer)
*   Routes render **above area fills** so they are visible on completed areas
*   Uses stream data (ADR 006) for full path visibility including privacy zone segments

#### Tier Medal Icons

*   Display tier medal icons at the centroid of each completed area
*   Icons: 🏆 (Platinum), 🥇 (Gold), 🥈 (Silver), 🥉 (Bronze)
*   Visible at zoom level 13+, scale with zoom
*   Custom SVG icons preferred for cross-platform consistency

### 3.5 Hover Interaction (Updated: 2026-02-07)

**Desktop:** Mouse hover over area.  
**Mobile:** Long-press (500ms) on area.

Display floating tooltip with:
*   Area name (e.g., "Västra Hamnen")
*   **Circumference with estimated walk time** (e.g., "2.3 km (~28 min)")
*   Tier badge icon (colored circle or medal)
*   Quality score (e.g., "Score: 0.82")
*   Number of matched walks (e.g., "3 walks")
*   Best walk date and Strava link

**Walk Time Estimate:** Calculated at 5 km/h average walking pace (12 minutes per km).

Tooltip dismisses on mouse-out (desktop) or tap elsewhere (mobile).

### 3.6 Area Details Panel (Updated: 2026-02-07)

**Trigger:** Click/tap on any area (completed or not).

**Panel Type:** Slide-up bottom sheet (mobile-friendly).

**Content Structure:**

#### Header
*   Area name (large)
*   Tier badge and quality score (if completed)
*   "Not yet walked" indicator (if incomplete)

#### Mini-Map (Added: 2026-02-07)

*Reference: ADR 012 (Details Panel Mini-Map)*

*   **Location:** Below header, above score breakdown
*   **Dimensions:** Full panel width, ~200px height (responsive)
*   **Purpose:** Enable users to study the area and plan walking routes
*   **Base Map:** Full street-level tiles (same provider as main map) showing streets, paths, landmarks
*   **Boundary Overlay:** Subarea polygon with prominent stroke and low-opacity tier-colored fill (streets visible through fill)
*   **Interactivity:** Pan and zoom enabled for detailed exploration
*   **Bounds:** Auto-fit to polygon with padding on initial load

#### Score Breakdown (if completed)

Each metric name is a clickable link to its documentation page (see Section 3.9).

| Metric | User-Friendly Name | Value | Weight |
|--------|-------------------|-------|--------|
| Perimeter Coverage | Border Traced | 78% | 40% |
| Area Coverage | Area Enclosed | 65% | 25% |
| Alignment (RMSE) | Path Precision | 12m | 20% |
| Efficiency | Route Efficiency | 89% | 15% |
| **Quality Score** | — | **0.76** | — |

#### Area & Perimeter Info
*   Total area: X m² (or km² for large areas)
*   Enclosed area: X m² (from your best walk)
*   **Sub-area Circumference**: Total perimeter length of the sub-area (X.XX km)
*   **Total Walk Length**: Complete distance of the walk (X.XX km, from Strava distance when available)
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

### 3.9 Metrics Documentation (Updated: 2026-02-03)

*Reference: ADR 007 (Interactive Metrics Documentation)*

Provide in-app documentation for each analysis metric accessible via clickable links.

**User-Friendly Metric Names:**

| Technical Name | Display Name | Slug |
|----------------|--------------|------|
| Perimeter Coverage | Border Traced | `border-traced` |
| Area Coverage | Area Enclosed | `area-enclosed` |
| Alignment Score | Path Precision | `path-precision` |
| Efficiency | Route Efficiency | `route-efficiency` |

**Documentation Pages:**

*   **Location:** `/docs/metrics/` with subpages for each metric
*   **Access:** Click metric name or info icon in Area Details Panel
*   **Content per page:**
    *   Plain English summary (1-2 sentences)
    *   "Why It Matters" motivation section
    *   Interactive D3 visualization demonstrating the calculation
    *   Step-by-step calculation breakdown
    *   Visual examples (good vs. poor scores)
    *   Tips to improve

**Interactive Visualizations (D3.js):**

All visualizations are **mobile-first** (touch-optimized) and use **static example data** to clearly illustrate algorithms.

| Metric | Visualization Type |
|--------|-------------------|
| Border Traced | Animated path tracing with 25m buffer zone |
| Area Enclosed | Polygon intersection with toggle for open/closed paths |
| Path Precision | Heat map of distance from border with RMSE animation |
| Route Efficiency | Side-by-side efficient vs. inefficient path comparison |

### 3.8 Data Persistence

*Reference: ADR 004 (SQLite Storage)*

*   All data stored locally in browser using sql.js (SQLite in WebAssembly).
*   Data persists to IndexedDB across sessions.
*   Analysis results cached—no re-analysis on page reload.
*   Export database feature for backup (downloads `.db` file).
*   Import database feature to restore from backup.

### 3.11 Offline Support (Added: 2026-02-07)

*Reference: ADR 014 (Offline Support Strategy)*

Once the map, sub-areas, and user progress have been loaded at least once (with network), the app shall work offline for read-only use.

*   **App shell:** Service Worker caches HTML, JS, CSS, and WASM so the app can load when offline.
*   **Map:** Map tiles are cached on use (Cache API via Service Worker); GeoJSON/sub-area boundaries available from DB or cached static file.
*   **Navigation:** User can open the app, view the map, open the sub-area list, open area details, and view progress/stats without network.
*   **Offline indicator:** Show a clear indicator (e.g. banner or icon) when the app is offline.
*   **Graceful degradation:** When offline, do not attempt Strava API calls; disable or hide sync/re-fetch actions; external links (e.g. Strava activity) may be shown with a note that they require connectivity.
*   **Out of scope for MVP:** Full tile precache for Malmö; offline write queue; background sync on reconnect.

### 3.10 Sub-Area List View (Added: 2026-02-04, Updated: 2026-02-04)

*Reference: ADR 009 (UI Navigation Layout)*

Provide a browsable list of all sub-areas with sorting and filtering capabilities.

#### Hamburger Menu

**Location:** Floating button in top-left corner of screen.

**Design:**
*   Circular button with hamburger icon (three horizontal lines)
*   Semi-transparent background matching app theme
*   Positioned above map but below modals (z-index 400-450)

**Menu Options:**
*   **Areas** - Opens sub-area list in bottom sheet
*   **Stats** - Opens existing ProgressDashboard (right drawer)

**Mutual Exclusivity:** Opening the hamburger menu automatically collapses the profile card if expanded.

#### Profile Card (Collapsible)

**Location:** Floating button in top-right corner of screen.

**States:**

| State | Appearance | Default |
|-------|------------|---------|
| Collapsed | Avatar image only (48x48px circular button) | Yes |
| Expanded | Full card with athlete name, progress bar, logout button | No |

**Behavior:**
*   **Tap collapsed avatar** → Expands to full profile card
*   **Tap expanded card or avatar** → Collapses back to avatar only
*   **Tap outside** → Collapses profile card
*   **Open hamburger menu** → Automatically collapses profile card

**Mutual Exclusivity:** Expanding the profile card automatically closes the hamburger menu if open. Only one overlay can be active at a time.

**Re-Analyze (Added: 2026-02-06):**
*   **Location:** Inside the expanded profile card (user-profile popup).
*   **Options:** User can choose:
    *   **Re-score all** — Re-run the analysis algorithm on existing cached GPS data for all walks (no Strava API calls; fast). Use when the app's scoring formula has been updated.
    *   **Re-fetch & re-score all** — Re-fetch stream data from Strava for all walks, then re-run analysis and overwrite cached results. Use when source data may have changed (e.g., privacy zones, activity edits).
*   **Behavior:** Show progress/loading state during re-analysis; on completion, refresh map and panels so new scores and tiers appear immediately. Surface errors (e.g., API failure) so user can retry or choose re-score only.
*   **Per-walk re-analyze:** From area details or walk list, user can trigger re-score or full re-analyze for a single walk. Same two modes apply.
*   *Reference: ADR 011 (Re-Analysis Strategy)*

#### Sub-Area List Panel

**Trigger:** Select "Areas" from hamburger menu.

**Panel Type:** Slide-up bottom sheet (same as Area Details Panel).

**Sorting Options:**
*   Circumference (shortest first / longest first)
*   Name (A-Z)
*   Completion status (walked first / unwalked first)
*   Area size (smallest first / largest first)

**Default Sort:** Circumference ascending (shortest walks first).

**List Item Display:**

| Element | Description |
|---------|-------------|
| Area Name | Primary text, left-aligned |
| Circumference | Secondary text, e.g., "2.3 km" |
| Status Indicator | Tier badge (colored circle) if completed, empty circle if not |
| Walk Count | If completed, shows "3 walks" in muted text |

**Interaction:**
*   Tap any list item → Panel transitions to Area Details view
*   Breadcrumbs appear: "Areas" (link) > "Area Name" (current)
*   Tap "Areas" breadcrumb → Returns to list, preserving sort selection

#### Breadcrumb Navigation

**Display:** Below panel header, above content.

**Format:** `Areas > Västra Hamnen`

**Behavior:**
*   "Areas" is a clickable link that returns to list view
*   Current area name is plain text (not clickable)
*   Only shown when navigated from list (not when clicking map directly)

## 4. Non-Functional Requirements

*   **Mobile First:** UI controls (buttons, drawers, panels) must be touch-friendly and positioned for thumb usage.
*   **Performance:** Map interactions should remain 60fps even with 136 polygons rendered.
*   **Privacy:** Only access read permissions for Strava activities. All data stays on user's device.
*   **Offline Capable:** After initial load, app works offline for viewing map, sub-areas, progress, and area details; sync and external APIs require network (see ADR 014, Section 3.11).
*   **Responsive:** Details panel adapts to screen size (full sheet on mobile, side panel on desktop).
*   **Deployment:** Application deployed to Vercel platform for public access. OAuth callback requires publicly accessible URL. See ADR 016 for deployment architecture and configuration.

## 5. Future Considerations (Post-MVP)

*   **Leaderboards:** Compare scores with other users (requires server component).
*   **Social Sharing:** Share achievements on social media with generated images.
*   **Route Suggestions:** Suggest optimal walking routes for incomplete areas.
*   **Multi-city Support:** Expand beyond Malmö to other cities.
*   **Sync Across Devices:** Cloud storage for progress (requires authentication backend).
*   **Achievements/Badges:** Gamification elements beyond tiers.
