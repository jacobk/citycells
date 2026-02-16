# PRD 001 - MVP Mobile Walker

**Date:** 2026-02-02 (Updated: 2026-02-16)  
**Status:** In Progress

*Latest update: Distance-to-Boundary Indicator - real-time distance feedback during live walking (Section 3.13)*

## 1. Overview

The goal is to create a mobile-first web application that gamifies exploring Malmö by challenging users to walk around the borders of its 136 sub-areas (delområden). Progress is tracked automatically via Strava.

## 2. User Stories

### Core Stories
*   **As a user,** I want to see a map of Malmö with all sub-areas outlined, so I know where to walk.
*   **As a user,** I want to log in with my Strava account, so the app can access my walks.
*   **As a user,** I want my Strava connection to persist across browser sessions, so I don't have to re-authenticate every time I open the app.
*   **As a user,** I want the app to automatically find my walks tagged with `#malmödelområde` and match them to the areas.
*   **As a user,** I want to clearly see which areas I have completed and their quality tier (Platinum/Gold/Silver/Bronze/Potato).
*   **As a user,** I want to see a progress bar indicating how many total areas I have conquered.
*   **As a user,** I want to see my total walked distance displayed in the status view, so I can track how much I've walked overall.
*   **As a user,** I want to see the total distance of all area perimeters combined, so I know the total challenge distance.
*   **As a user,** I want to see a progress bar showing walked distance vs total perimeter distance (e.g., "walked X km of Y km"), so I can track my distance-based progress.

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

### Live Walking Mode Stories (Added: 2026-02-15, Updated: 2026-02-16)
*   **As a user,** I want to start a live walking session for a selected sub-area, so I can see my real-time position relative to the boundary.
*   **As a user,** I want to see a full-screen map showing the sub-area boundary while walking, so I know exactly where to go.
*   **As a user,** I want my GPS position to update continuously on the map, so I can see how I move relative to the boundary.
*   **As a user,** I want to trigger live walking mode from the area details panel, so I can start walking any area I'm viewing.
*   **As a user,** I want the screen to stay on during active walking (where supported), so I don't have to keep waking my phone.
*   **As a user,** I want to exit walking mode and return to the normal app view when I'm done, so I can review my progress.
*   **As a user,** I want to see my real-time distance from the boundary while walking, so I know how far I need to adjust my path. (Added: 2026-02-16)
*   **As a user,** I want a clear visual indicator when I'm within the 25m tolerance zone, so I know I'm walking correctly. (Added: 2026-02-16)
*   **As a user,** I want my position marker to change color based on my distance from the boundary, so I can see at a glance whether I'm on track. (Added: 2026-02-16)

### Subarea Visual Context Stories (Added: 2026-02-07)
*   **As a user,** I want to see a mini-map of the selected subarea in the details panel, so I can study the area and plan my walking route.
*   **As a user,** I want to see streets and paths in the mini-map, so I can find walkable routes along the boundary.
*   **As a user,** I want to pan and zoom the mini-map, so I can explore different parts of the boundary in detail.
*   **As a user,** I want to see the circumference distance when hovering over an area, so I can quickly estimate how long a walk would take.
*   **As a user,** I want to see an estimated walk time alongside the circumference, so I can plan my walks around my available time.
*   **As a user,** I want to see my matched walk route overlaid on the mini-map in the details panel, so I can compare my actual path to the area boundary.
*   **As a user,** I want to toggle walk route visibility on the mini-map, so I can choose when to see the route overlay.
*   **As a user,** I want to select which walk to view when multiple walks match an area, so I can compare different attempts.

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
7.  **Tier Assignment**: Assign tier based on score (Platinum ≥0.95, Gold ≥0.85, Silver ≥0.70, Bronze ≥0.50, Potato <0.50).
8.  **Persistence**: Store analysis results in SQLite.

### 3.4 Area Status Visualization (Updated: 2026-02-13)

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
| Potato      | Light Tan      | `#d4b896` | 0.40    | `#b8936d`  |
| Not Started | None           | —         | —       | `#64748b`  |

*   Bold purple-to-pink gradient: higher scores = richer, deeper violet
*   Potato tier uses warm tan/brown color to match potato theme and provide clear visual distinction from Not Started (no fill)
*   Warm brown contrasts well with cool purple-pink gradient
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
*   Icons: 🏆 (Platinum), 🥇 (Gold), 🥈 (Silver), 🥉 (Bronze), 🥔 (Potato)
*   Visible at zoom level 13+, scale with zoom
*   Custom SVG icons preferred for cross-platform consistency

### 3.6 Hover Interaction (Updated: 2026-02-07)

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

### 3.7 Area Details Panel (Updated: 2026-02-13)

**Trigger:** Click/tap on any area (completed or not).

**Panel Type:** Slide-up bottom sheet (mobile-friendly).

**Content Structure:**

#### Header
*   Area name (large)
*   Tier badge and quality score (if completed)
*   "Not yet walked" indicator (if incomplete)

#### Mini-Map (Added: 2026-02-07, Updated: 2026-02-13)

*Reference: ADR 012 (Details Panel Mini-Map)*

*   **Location:** Below header, optimized to fill available viewport height
*   **Dimensions:** Full panel width, **dynamic height** filling available space above the fold (minimum ~200px)
*   **Purpose:** Enable users to inspect area boundaries and plan walking routes - **maximize map visibility**
*   **Base Map:** Full street-level tiles (same provider as main map) showing streets, paths, landmarks
*   **Boundary Overlay:** Subarea polygon with prominent stroke and low-opacity tier-colored fill (streets visible through fill)
*   **Interactivity:** Pan and zoom enabled for detailed exploration
*   **Bounds:** Auto-fit to polygon with padding on initial load
*   **Panel Scrolling:** Content below the map (stats, score breakdown, walk history) is scrollable within the panel

#### Area Stats (Added: 2026-02-13)

*   **Location:** Below mini-map, above score breakdown
*   **Content:** Same quick-reference stats from hover tooltip:
    *   Circumference with estimated walk time (e.g., "2.3 km (~28 min)")
*   **Rationale:** Users should see these stats without closing the panel to hover

**Walk Route Visualization (Added: 2026-02-07):**
*   **Toggle Control:** Toggle button above mini-map to show/hide matched walk routes
*   **Default State:** Routes hidden (toggle OFF)
*   **Route Styling:** Same deviation-based coloring as main map (green = within 25m of boundary, red = deviation)
*   **Multiple Walks:** When multiple walks match the area:
    *   All matched walks listed at bottom of card in Walk History section
    *   Walk selection control allows choosing which walk to display on mini-map
    *   Selected walk highlighted in Walk History list
    *   Default selection: Best walk (highest quality score)
*   **Single Walk:** When only one walk matches, it displays automatically when toggle is ON

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

#### Walk History (Updated: 2026-02-07)
List of all matched walks for this area:
*   Walk name / date
*   Distance walked
*   Individual quality score
*   Link to Strava activity
*   Indicator if this is the current "best" walk
*   **Walk Selection (Added: 2026-02-07):** When multiple walks exist, each walk item is selectable to display its route on the mini-map
*   **Visual Indicator:** Selected walk highlighted (e.g., border or background color) to show which route is currently displayed

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

### 3.8 Exemption Management

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

### 3.10 Metrics Documentation (Updated: 2026-02-03)

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

### 3.9 Data Persistence (Updated: 2026-02-15)

*Reference: ADR 004 (SQLite Storage)*

*   All data stored locally in browser using sql.js (SQLite in WebAssembly).
*   Data persists to IndexedDB across sessions.
*   Analysis results cached—no re-analysis on page reload.
*   Export database feature for backup (downloads `.db` file).
*   Import database feature to restore from backup.
*   **Clear All Data** button to reset synced activities and analysis results (preserves auth and area definitions).
*   **Incremental sync**: Only fetch new activities from Strava (using `after` timestamp), providing instant page loads for returning users.

### 3.9.1 Progress Dashboard & Distance Tracking (Added: 2026-02-09, Updated: 2026-02-09)

*Reference: ADR 004 (SQLite Storage), ADR 005 (Strava Privacy Zones)*

The Progress Dashboard displays overall progress statistics including area completion and distance metrics.

#### Distance Metrics Display

**Theoretical Distance (Primary Metric):**
*   Sum of `perimeter_meters` from `areas` table for all **completed** areas (joined via `area_completions`)
*   Represents the "ideal" distance if walking exactly the perimeter of each completed area
*   Display format: "X.XX km" (kilometers with 2 decimal places)
*   Used for progress bar and main distance display

**Total Perimeter Distance (Challenge Target):**
*   Sum of all `perimeter_meters` from `areas` table (all 136 sub-areas)
*   Display format: "X.XX km" (kilometers with 2 decimal places)
*   Represents the total challenge distance if walking every area perimeter

**Actual Walked Distance (Additional Stat):**
*   Sum of all `total_distance_meters` from `walks` table for the authenticated user
*   Display format: "X.XX km" (kilometers with 2 decimal places)
*   Uses Strava's `distance` field (not polyline-calculated) to account for privacy zone truncation (see ADR 005)
*   Includes all walks, including detours, multiple walks per area, and inefficient routes
*   Displayed as secondary metric with difference from theoretical distance

**Distance Difference:**
*   Calculated as: `actualWalkedDistance - theoreticalDistance`
*   Display format: "+X.XX km" (if actual > theoretical) or "-X.XX km" (if actual < theoretical)
*   Shows how much more or less distance was walked compared to the theoretical minimum

**Distance Progress Display:**
*   Primary progress bar uses theoretical distance: `(theoreticalDistance / totalPerimeterDistance) * 100%`
*   Format: "Walked X.XX km of Y.YY km" (theoretical distance vs total perimeter)
*   Separate progress bar showing theoretical distance completion percentage
*   Actual distance and difference displayed as additional statistics below the progress bar
*   Displayed prominently in the Progress Dashboard alongside area completion progress

**Performance Considerations:**
*   Theoretical distance calculated efficiently via SQL JOIN: `SELECT SUM(a.perimeter_meters) FROM areas a INNER JOIN area_completions ac ON a.id = ac.area_id WHERE ac.user_id = ?`
*   Total perimeter distance is static (sum of 136 areas) and should be cached or calculated once
*   Actual distance query uses indexed `user_id` column for efficiency
*   Distance metrics should be calculated when progress changes, not on every render

**Location:** Progress Dashboard (right drawer accessible via hamburger menu → Stats)

### 3.12 Offline Support (Added: 2026-02-07)

*Reference: ADR 014 (Offline Support Strategy)*

Once the map, sub-areas, and user progress have been loaded at least once (with network), the app shall work offline for read-only use.

*   **App shell:** Service Worker caches HTML, JS, CSS, and WASM so the app can load when offline.
*   **Map:** Map tiles are cached on use (Cache API via Service Worker); GeoJSON/sub-area boundaries available from DB or cached static file.
*   **Navigation:** User can open the app, view the map, open the sub-area list, open area details, and view progress/stats without network.
*   **Offline indicator:** Show a clear indicator (e.g. banner or icon) when the app is offline.
*   **Graceful degradation:** When offline, do not attempt Strava API calls; disable or hide sync/re-fetch actions; external links (e.g. Strava activity) may be shown with a note that they require connectivity.
*   **Out of scope for MVP:** Full tile precache for Malmö; offline write queue; background sync on reconnect.

### 3.11 Sub-Area List View (Added: 2026-02-04, Updated: 2026-02-04)

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

### 3.13 Live Walking Mode (Added: 2026-02-15)

*Reference: ADR 017 (Live Walking Mode)*

Provide a real-time navigation view for walking sub-area boundaries.

#### Entry Point

**Location:** Area Details Panel, above the fold (near mini-map section)

**Trigger:** "Start Walking" button

**Availability:** Shown for all sub-areas (completed and incomplete)

#### Walking Mode UI

**Display Type:** Full-screen overlay replacing normal app view

**Map Components:**
*   Full-screen Leaflet map with street tiles
*   Sub-area boundary polygon with prominent stroke (same styling as mini-map)
*   Live user position marker (blue dot with accuracy circle)
*   Auto-center on user position (toggleable)

**Controls:**
*   Exit button (returns to area details panel)
*   Center-on-me button (re-centers map on current position)
*   Zoom controls
*   Optional: Satellite/street toggle (nice-to-have)

#### Geolocation Behavior

**Permissions:**
*   Request location permission on "Start Walking" tap
*   Show explanatory prompt before native permission dialog
*   Handle permission denied gracefully with clear messaging

**Tracking Mode:**
*   Use `watchPosition()` for continuous updates
*   `enableHighAccuracy: true` for GPS precision
*   `maximumAge: 0` for real-time positions (no cache)

**Screen Wake Lock (Chrome/Android):**
*   Request Wake Lock when entering walking mode
*   Release Wake Lock when exiting
*   Show indicator when Wake Lock is active

**iOS Safari Limitation:**
*   Wake Lock not supported
*   Show one-time tip: "Tip: Increase screen timeout in Settings for continuous tracking"

#### Error Handling

| Scenario | Behavior |
|----------|----------|
| Location permission denied | Show error message with instructions to enable in settings |
| GPS unavailable | Show warning, allow map viewing without live position |
| GPS signal lost | Show "Acquiring GPS..." indicator, keep last known position |
| Wake Lock unavailable | Continue without it, no user-facing error |

#### Distance-to-Boundary Indicator (Added: 2026-02-16)

Real-time feedback showing walker's distance from the boundary line.

**Display Location:** Bottom status bar, next to GPS accuracy display

**Numeric Distance:**
*   Show distance in meters: "12m from boundary"
*   Update in real-time with GPS position changes
*   Only display when GPS position is available

**Color-Coded Position Marker:**

| Condition | Marker Color | Hex |
|-----------|--------------|-----|
| Within 25m tolerance | Green | `#22c55e` |
| Outside 25m tolerance | Blue (default) | `#3b82f6` |

*   Position marker (blue dot) color changes based on distance
*   25m threshold matches existing analysis tolerance (ADR 002, ADR 003)

**Status Bar Indicator:**

| Condition | Display | Style |
|-----------|---------|-------|
| Within tolerance | "✓ On track (12m)" | Green text/background |
| Outside tolerance | "23m from boundary" | Neutral text |

**Calculation:**
*   Use existing `distanceToLine()` pattern from `src/lib/analysis.ts`
*   Calculate distance from current position to nearest point on boundary polygon perimeter
*   Recalculate on each GPS position update

#### Exit Behavior

*   Tap exit button → Confirm if tracking > 1 minute
*   Return to Area Details Panel for the same sub-area
*   Clear Watch and release Wake Lock on exit

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
