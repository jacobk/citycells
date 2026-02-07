# Privacy Policy

**Last Updated:** February 7, 2026

## Introduction

CityCells ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our application.

## Information We Collect

### Strava Data

CityCells uses Strava OAuth 2.0 to access your Strava account data. We request the following permissions:

- **Read access** to your basic profile information (name, profile picture)
- **Read access** to your activities** (including private activities)
- **Read access** to activity streams** (GPS coordinates, time, distance)

### Data Storage

All data is stored **locally on your device** using browser-based SQLite (IndexedDB). We do not store your data on our servers. Specifically:

- **Authentication tokens**: Stored locally in your browser (HTTP-only cookies and IndexedDB)
- **Activity data**: Cached locally in SQLite database on your device
- **Analysis results**: Stored locally with your activity data

## How We Use Your Data

We use your Strava data solely for the following purposes:

1. **Activity Analysis**: To analyze your walking activities and match them to Malmö sub-areas
2. **Progress Tracking**: To calculate completion scores and track your progress through the 136 sub-areas
3. **Visualization**: To display your activities on the map and show which areas you've completed

We do **not**:
- Share your data with third parties
- Sell your data
- Use your data for advertising
- Store your data on our servers

## Data Security

- All data remains on your device (client-side storage)
- OAuth tokens are stored securely using HTTP-only cookies and IndexedDB
- No data is transmitted to our servers except for:
  - OAuth authentication flow (handled by Strava)
  - API requests to Strava to fetch your activities (using your tokens)

## Your Rights

You have the right to:

- **Revoke access**: You can revoke CityCells' access to your Strava account at any time through [Strava's connected apps settings](https://www.strava.com/settings/apps)
- **Delete local data**: You can clear your browser's IndexedDB storage to remove all locally stored data
- **Log out**: Use the "Sign Out" button in the app to clear authentication tokens

## Third-Party Services

### Strava

CityCells integrates with Strava's API. Your use of Strava is subject to [Strava's Privacy Policy](https://www.strava.com/legal/privacy). We only access data that you explicitly authorize through Strava's OAuth consent screen.

### Vercel (Hosting)

The application is hosted on Vercel. Vercel may collect standard web server logs (IP addresses, request timestamps) as part of their hosting service. See [Vercel's Privacy Policy](https://vercel.com/legal/privacy-policy) for details.

## Changes to This Policy

We may update this Privacy Policy from time to time. We will notify you of any changes by updating the "Last Updated" date at the top of this policy.

## Contact

If you have questions about this Privacy Policy, please contact us through the project repository or your preferred method of communication.

## Data Retention

Since all data is stored locally on your device:
- Data persists until you clear your browser's IndexedDB storage
- Authentication tokens expire according to Strava's token expiration policy
- You can delete all data at any time by clearing browser storage

## GDPR Compliance

If you are located in the European Economic Area (EEA), you have certain data protection rights under the General Data Protection Regulation (GDPR):

- Right to access your personal data
- Right to rectification
- Right to erasure ("right to be forgotten")
- Right to restrict processing
- Right to data portability
- Right to object to processing

Since all data is stored locally on your device, you have full control over your data. To exercise any of these rights, simply clear your browser's IndexedDB storage or revoke access through Strava's settings.
