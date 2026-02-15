import { useState, useEffect, useCallback } from 'react';
import { getCookie } from 'cookies-next';
import {
  initAuthPersistence,
  hasOAuthCallbackParams,
  clearStoredTokens,
} from '@/lib/auth-persistence';

export interface StravaAthlete {
  id: number;
  firstname: string;
  lastname: string;
  profile: string;
}

export interface StravaActivity {
  id: number;
  name: string;
  map: {
    summary_polyline: string;
  };
  // WHY: Both start and end latlng needed for accurate loop detection
  // The summary_polyline is often truncated and missing GPS points at start/end
  start_latlng: [number, number];
  end_latlng?: [number, number]; // May not be present in older activities
  distance?: number; // Actual distance in meters from Strava API
}

/**
 * Authentication state for the hook.
 */
type AuthState = 'loading' | 'authenticated' | 'unauthenticated' | 'restoring';

/**
 * Hook for Strava authentication with persistent session support.
 * WHY: Implements the returning user flow from ADR 013.
 * 
 * Flow:
 * 1. Check for OAuth callback params (post-login redirect)
 * 2. Check strava_athlete cookie for active session
 * 3. If no active session, attempt session restoration from SQLite
 * 4. Fetch activities if authenticated
 */
export function useStrava() {
  const [athlete, setAthlete] = useState<StravaAthlete | null>(null);
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [authState, setAuthState] = useState<AuthState>('loading');

  /**
   * Fetch activities from API.
   * @param afterTimestamp - Optional Unix epoch timestamp (seconds) for incremental sync (TICKET-016)
   *                         If provided, only fetches activities after this time.
   */
  const fetchActivities = useCallback(async (afterTimestamp?: number) => {
    try {
      // WHY: Build URL with optional 'after' parameter for incremental sync (TICKET-016)
      // The API route passes this to Strava's listActivities endpoint
      const url = afterTimestamp 
        ? `/api/activities?after=${afterTimestamp}`
        : '/api/activities';
      
      const res = await fetch(url);
      if (!res.ok) {
        // WHY: 401 means session expired - try to restore or clear
        if (res.status === 401) {
          console.log('[useStrava] Session expired, clearing auth state');
          setAthlete(null);
          setActivities([]);
          setAuthState('unauthenticated');
          return;
        }
        throw new Error(`Failed to fetch activities: ${res.status}`);
      }
      
      const data = await res.json();
      if (Array.isArray(data)) {
        // WHY: For incremental sync, merge new activities with existing ones
        // New activities should appear at the beginning (most recent first from Strava)
        if (afterTimestamp && activities.length > 0) {
          // Merge: new activities + existing, avoiding duplicates
          const existingIds = new Set(activities.map(a => a.id));
          const newActivities = data.filter((a: StravaActivity) => !existingIds.has(a.id));
          if (newActivities.length > 0) {
            console.log(`[useStrava] Incremental sync: ${newActivities.length} new activities`);
            setActivities([...newActivities, ...activities]);
          } else {
            console.log('[useStrava] Incremental sync: no new activities');
          }
        } else {
          setActivities(data);
        }
      }
    } catch (err) {
      console.error('[useStrava] Failed to fetch activities:', err);
    }
  }, [activities]);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        // WHY: Check for OAuth callback params first (just completed login)
        // This handles the redirect from Strava OAuth
        if (hasOAuthCallbackParams()) {
          setAuthState('loading');
          
          // Initialize auth persistence (syncs tokens to SQLite)
          await initAuthPersistence();
          
          // Check cookie for athlete info (set by OAuth callback)
          const athleteCookie = getCookie('strava_athlete');
          if (athleteCookie && mounted) {
            const parsed = JSON.parse(athleteCookie as string);
            setAthlete(parsed);
            setAuthState('authenticated');
            await fetchActivities();
          }
          return;
        }

        // WHY: Check for existing session via cookie
        const athleteCookie = getCookie('strava_athlete');
        
        if (athleteCookie) {
          // Active session exists
          try {
            const parsed = JSON.parse(athleteCookie as string);
            if (mounted) {
              setAthlete(parsed);
              setAuthState('authenticated');
              await fetchActivities();
            }
          } catch {
            if (mounted) setAuthState('unauthenticated');
          }
          return;
        }

        // WHY: No active session - attempt to restore from SQLite
        // This is the "returning user" flow from ADR 013
        setAuthState('restoring');
        
        // Try to restore session if we have stored tokens
        // For now, we need an athlete ID to look up - check if there's a session cookie
        // The session cookie contains just the athlete ID
        const sessionCookie = getCookie('strava_session');
        
        if (sessionCookie) {
          const athleteId = parseInt(sessionCookie as string, 10);
          if (!isNaN(athleteId)) {
            console.log('[useStrava] Attempting session restoration for athlete', athleteId);
            
            const result = await initAuthPersistence(athleteId);
            
            if (result?.success && mounted) {
              // WHY: Session restored - need to get athlete info
              // The restore-session endpoint set cookies, so we should have the session now
              // Refresh the page to get the athlete cookie set properly
              // Or try to fetch activities which will trigger cookie refresh
              
              // Check if athlete cookie is now set
              const newAthleteCookie = getCookie('strava_athlete');
              if (newAthleteCookie) {
                const parsed = JSON.parse(newAthleteCookie as string);
                setAthlete(parsed);
                setAuthState('authenticated');
                await fetchActivities();
                return;
              }
              
              // If no cookie but session restored, we need the athlete data
              // For now, just mark as needing re-auth (the cookie will be set on next full auth)
              console.log('[useStrava] Session restored but no athlete cookie - may need re-auth');
            }
          }
        }
        
        // No session could be restored
        if (mounted) {
          setAuthState('unauthenticated');
        }
        
      } catch (err) {
        console.error('[useStrava] Auth initialization error:', err);
        if (mounted) {
          setAuthState('unauthenticated');
        }
      }
    };

    initAuth();

    return () => {
      mounted = false;
    };
  }, [fetchActivities]);

  const login = useCallback(() => {
    window.location.href = '/api/auth/login';
  }, []);

  const logout = useCallback(async () => {
    try {
      // WHY: Clear server-side cookies first
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      const data = await response.json();
      
      // WHY: Clear SQLite tokens if we have an athlete ID
      if (data.should_clear_sqlite && athlete?.id) {
        await clearStoredTokens(athlete.id);
      }
      
      setAthlete(null);
      setActivities([]);
      setAuthState('unauthenticated');
      
      // WHY: Reload to ensure clean state
      window.location.reload();
    } catch (err) {
      console.error('[useStrava] Logout error:', err);
      // Force reload anyway to clear state
      window.location.reload();
    }
  }, [athlete?.id]);

  return {
    athlete,
    activities,
    loading: authState === 'loading' || authState === 'restoring',
    isRestoring: authState === 'restoring',
    isAuthenticated: authState === 'authenticated',
    login,
    logout,
  };
}
