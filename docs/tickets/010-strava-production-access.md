# TICKET-010: Strava Production Access Request

**Related:** ADR 016, PRD Section 3.2 (Authentication)  
**Feature:** Authentication & Deployment  
**Status:** In Progress  
**Created:** 2026-02-07

## Problem

The Strava OAuth app has reached its connected athlete limit (default is 1 athlete). Users are receiving "Error 403: limit of connected athletes exceeded" when attempting to authenticate. To support multiple users, we need to request production access from Strava, which will increase the limit to unlimited athletes.

## Solution

Submit a production access request to Strava through their Developer Program form. Before submitting, ensure all app settings are perfect and complete, including privacy policy, app description, and website URL.

## Implementation Checklist

### 1. Verify Current Strava App Settings
**Status:** ⏳ Pending Manual Verification

**Action**: Visit [Strava API Settings](https://www.strava.com/settings/api) and verify:

- [ ] **App Name**: Clear and professional (e.g., "CityCells" or "CityCells: Malmö")
- [ ] **Category**: Appropriate category selected (likely "Fitness" or "Training")
- [ ] **Website**: Set to production URL (e.g., `https://citycells.vercel.app`)
- [ ] **Application Description**: Clear description of what the app does
- [ ] **Authorization Callback Domain**: Matches deployment domain (e.g., `citycells.vercel.app`)
- [ ] **Privacy Policy URL**: Set to `https://citycells.vercel.app/privacy` (or production URL)
- [ ] **Terms of Service URL**: Check if required, set if needed
- [ ] **App Icon**: Set if available

**Current Settings** (to be filled during verification):
- App Name: _TBD_
- Category: _TBD_
- Website: _TBD_
- Description: _TBD_
- Callback Domain: _TBD_
- Privacy Policy URL: _TBD_
- Terms of Service URL: _TBD_

### 2. Create Privacy Policy
**Status:** ✅ Complete

- [x] Created `docs/privacy-policy.md` with comprehensive privacy policy
- [x] Created `src/app/privacy/page.tsx` to serve privacy policy at `/privacy`
- [x] Added Privacy Policy link to HamburgerMenu component
- [x] Privacy policy covers:
  - Data collection (Strava OAuth)
  - Data storage (client-side SQLite)
  - Data usage (activity analysis, progress tracking)
  - User rights (revoke access, delete data)
  - Third-party services (Strava, Vercel)
  - GDPR compliance

**Privacy Policy URL**: `https://citycells.vercel.app/privacy` (update with actual production URL)

### 3. Check Terms of Service Requirement
**Status:** ✅ Template Created

- [x] Created `/terms` page template (`src/app/terms/page.tsx`)
- [ ] Check Strava API settings to see if Terms of Service URL is required
- [ ] If required, update terms page with complete content
- [ ] Update Strava settings with Terms of Service URL: `https://citycells.vercel.app/terms` (update with actual URL)

### 4. Update App Description
**Status:** ⏳ Pending Manual Update

**Action**: Update app description in Strava settings to be clear and professional.

**Suggested Description**:
```
CityCells is a mobile-first web application that gamifies exploring Malmö by challenging users to walk around the borders of its 136 sub-areas (delområden). The app visualizes Strava activities over city sub-areas, automatically matches walks to areas, and tracks progress with quality scoring (Platinum/Gold/Silver/Bronze tiers). All data is stored locally on the user's device - we never store user data on our servers. The app uses read-only access to Strava activities to analyze GPS tracks and calculate completion scores.
```

### 5. Verify Website URL
**Status:** ⏳ Pending

- [ ] Confirm production deployment URL (e.g., `https://citycells.vercel.app`)
- [ ] Verify the URL is accessible and app loads correctly
- [ ] Verify OAuth callback works at production URL
- [ ] Update Strava settings with production website URL

### 6. Prepare Production Access Request Form
**Status:** ⏳ Pending

**Form URL**: https://share.hsforms.com/1VXSwPUYqSH6IxK0y51FjHwcnkd8

**Information to Prepare**:

- **App Name**: CityCells (or CityCells: Malmö)
- **App Description**: (Use description from step 4)
- **Website URL**: `https://citycells.vercel.app` (update with actual URL)
- **Privacy Policy URL**: `https://citycells.vercel.app/privacy` (update with actual URL)
- **Terms of Service URL**: (if required)
- **Use Case**: Gamify walking exploration of Malmö's 136 sub-areas by tracking progress via Strava activities
- **Expected Users**: Initially targeting Malmö residents and visitors interested in exploring the city on foot
- **Data Usage**: Read-only access to Strava activities for GPS analysis and progress tracking. All data stored locally on user's device.
- **Why Production Access**: App has reached the default 1-athlete limit and needs to support multiple users

### 7. Submit Production Access Request
**Status:** ⏳ Pending Manual Submission

- [ ] Fill out Strava Developer Program form with prepared information
- [ ] Submit the form
- [ ] Document submission date: _TBD_
- [ ] Document any confirmation/reference number: _TBD_

**Timeline**: Strava typically responds within 1-3 weeks

### 8. Monitor Response
**Status:** ⏳ Pending

- [ ] Monitor email for Strava response
- [ ] If approved: Verify limit increase in Strava API settings
- [ ] If rejected: Document reason and plan next steps
- [ ] If clarification needed: Respond promptly

## Files Created/Modified

| File | Status | Purpose |
|------|--------|---------|
| `docs/privacy-policy.md` | ✅ Created | Privacy policy document |
| `src/app/privacy/page.tsx` | ✅ Created | Privacy policy page route |
| `src/app/terms/page.tsx` | ✅ Created | Terms of service page template |
| `src/components/HamburgerMenu/HamburgerMenu.tsx` | ✅ Modified | Added Privacy Policy link to menu |
| `docs/tickets/010-strava-production-access.md` | ✅ Created | This ticket |
| `docs/features/authentication.md` | ✅ Updated | Added production access info |
| `docs/ADR/016-vercel-deployment.md` | ✅ Updated | Added note about athlete limits |

## Verification Checklist

Before submitting the form, verify:

- [ ] App name is clear and professional
- [ ] App description accurately describes functionality
- [ ] Website URL points to working production deployment
- [ ] Privacy policy URL is accessible and complete
- [ ] Terms of service URL is set (if required)
- [ ] Authorization callback domain matches production URL
- [ ] App icon is set (if available)
- [ ] Category is appropriate
- [ ] All form responses are prepared and professional

## Success Criteria

- [ ] Production access request submitted successfully
- [ ] All app settings verified and complete
- [ ] Privacy policy accessible at production URL
- [ ] Terms of service accessible (if required)
- [ ] Documentation created for tracking submission
- [ ] Response received from Strava (approval or feedback)
- [ ] If approved: Athlete limit increased in Strava settings

## Notes

- The actual submission is a manual step that cannot be automated
- All app settings must be perfect before submitting (Strava reviews these)
- Privacy policy is required for production apps
- Response time is typically 1-3 weeks
- If approved, the limit will be increased automatically in Strava settings
- Current limit: 1 athlete (default)
- Target limit: Unlimited (production access)

## Related Documentation

- [ADR 016: Vercel Deployment Platform](../ADR/016-vercel-deployment.md)
- [Authentication Feature Documentation](../features/authentication.md)
- [Strava API Documentation](https://developers.strava.com/docs/)
