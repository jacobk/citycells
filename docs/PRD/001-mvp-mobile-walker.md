# PRD 001 - MVP Mobile Walker

**Date:** 2026-02-02  
**Status:** In Progress

## 1. Overview
The goal is to create a mobile-first web application that gamifies exploring Malmö by challenging users to walk around the borders of its 136 sub-areas (delområden). Progress is tracked automatically via Strava.

## 2. User Stories
*   **As a user,** I want to see a map of Malmö with all sub-areas outlined, so I know where to walk.
*   **As a user,** I want to log in with my Strava account, so the app can access my walks.
*   **As a user,** I want the app to automatically find my walks tagged with `#malmödelområde` and match them to the areas.
*   **As a user,** I want to clearly see which areas I have completed (Green) and which are pending (Gray).
*   **As a user,** I want to see a progress bar indicating how many total areas I have conquered.

## 3. Functional Requirements

### 3.1 Map Interface
*   Full-screen map view centered on Malmö.
*   Render `malmo_delomraden.geojson` as a polygon layer.
*   Polygons must be clickable (displaying the area name).
*   Current User Location marker (geolocation).

### 3.2 Authentication & Data
*   "Connect with Strava" button using OAuth 2.0.
*   Fetch authenticated user's activities.
*   Filter activities by text search in title/description (Keyword: `#malmödelområde`).

### 3.3 Analysis Logic (The "CityCells" Algorithm)
*   For each eligible activity, fetch the detailed GPS stream (lat/lng points).
*   Create a buffer (validity zone) of **25 meters** around the perimeter of a sub-area.
*   Calculate the length of the activity path that falls *inside* this buffer.
*   **Completion Criteria:** If the intersecting path length is > **75%** of the sub-area's total perimeter, mark as **Complete**.

## 4. Non-Functional Requirements
*   **Mobile First:** UI controls (buttons, drawers) must be touch-friendly and positioned for thumb usage.
*   **Performance:** Map interactions should remain 60fps even with 136 polygons rendered.
*   **Privacy:** Only access read permissions for Strava activities.

## 5. Future Considerations (Not in MVP)
*   "Quality Rating" (Platinum/Gold/Silver) based on adherence accuracy.
*   Leaderboards.
*   Sharing achievements on social media.
