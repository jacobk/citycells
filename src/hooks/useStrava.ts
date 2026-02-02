import { useState, useEffect } from 'react';
import { getCookie } from 'cookies-next';

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
  start_latlng: [number, number];
}

export function useStrava() {
  const [athlete, setAthlete] = useState<StravaAthlete | null>(null);
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for cookie
    const athleteCookie = getCookie('strava_athlete');
    if (athleteCookie) {
      try {
        const parsed = JSON.parse(athleteCookie as string);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAthlete(parsed);
        
        // Fetch activities if logged in
        fetch('/api/activities')
          .then(res => res.json())
          .then(data => {
            if (Array.isArray(data)) {
              setActivities(data);
            }
          })
          .catch(err => console.error("Failed to fetch activities", err))
          .finally(() => setLoading(false));
      } catch {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const login = () => {
    window.location.href = '/api/auth/login';
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setAthlete(null);
    setActivities([]);
    window.location.reload();
  };

  return {
    athlete,
    activities,
    loading,
    login,
    logout
  };
}
