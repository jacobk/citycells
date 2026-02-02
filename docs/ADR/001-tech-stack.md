# 001 - Tech Stack and Architecture

**Status:** Accepted  
**Date:** 2026-02-02  
**Context:**  
We are building "CityCells", a mobile-web application to gamify walking around the borders of Malmö's 136 sub-areas. The app needs to:
1. Display a responsive, interactive map on mobile devices.
2. Authenticate users via Strava to retrieve activity data.
3. Perform geospatial analysis (checking if a walk follows a border) on the client or server.
4. Be easy to maintain and deploy.

**Decision:**  
We will use the following technology stack:

*   **Framework:** **Next.js 14 (App Router)**.
    *   *Why:* Provides a unified architecture for both the React frontend and the API routes needed for Strava OAuth. Excellent performance and Vercel deployment integration.
*   **Language:** **TypeScript**.
    *   *Why:* Essential for managing the complexity of GeoJSON data structures and external API types (Strava).
*   **Map Rendering:** **React-Leaflet** (Leaflet.js) + **OpenStreetMap**.
    *   *Why:* Lightweight, free, and robust enough for 2D polygon overlays. Mapbox was considered but deemed unnecessary for the MVP.
*   **Styling:** **Tailwind CSS**.
    *   *Why:* Speed of development, mobile-first utility classes, and small bundle size.
*   **Geospatial Analysis:** **Turf.js**.
    *   *Why:* The standard for geospatial analysis in JavaScript. Allows us to perform "buffer" and "intersection" calculations directly in the browser or Node.js environment.
*   **State Management:** React Context / Local State (initially).
    *   *Why:* The app's state (user, activities, progress) is simple enough not to require Redux or Zustand for the MVP.

**Consequences:**  
*   **Positive:** Rapid development cycle, type safety prevents data errors, "Serverless" architecture keeps costs low (free tier Vercel).
*   **Negative:** Leaflet requires some client-side specific handling in Next.js (SS issues), which requires careful component structuring.
