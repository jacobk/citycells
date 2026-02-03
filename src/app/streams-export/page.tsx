import { cookies } from 'next/headers';

export default async function StreamsExportPage() {
  if (process.env.NODE_ENV !== 'development') {
    return (
      <main className="p-6 space-y-4">
        <h1 className="text-xl font-semibold">Stream Export Helper</h1>
        <p className="text-sm text-gray-600">
          This helper is only available in development mode.
        </p>
      </main>
    );
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get('strava_access_token')?.value ?? '';
  const refreshToken = cookieStore.get('strava_refresh_token')?.value ?? '';
  const expiresAt = cookieStore.get('strava_expires_at')?.value ?? '';

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Stream Export Helper</h1>
      <p className="text-sm text-gray-600">
        Use these tokens to run the stream export script locally. Keep them private.
      </p>

      <section className="space-y-2">
        <div className="text-sm font-semibold">Access Token</div>
        <pre className="text-xs bg-gray-100 p-3 rounded break-all">{accessToken || 'Missing access token'}</pre>
      </section>

      <section className="space-y-2">
        <div className="text-sm font-semibold">Refresh Token</div>
        <pre className="text-xs bg-gray-100 p-3 rounded break-all">{refreshToken || 'Missing refresh token'}</pre>
      </section>

      <section className="space-y-2">
        <div className="text-sm font-semibold">Expires At (ms)</div>
        <pre className="text-xs bg-gray-100 p-3 rounded break-all">{expiresAt || 'Missing expiration'}</pre>
      </section>

      <section className="space-y-2">
        <div className="text-sm font-semibold">Export Routes</div>
        <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
          <li>/api/activities/streams/export</li>
          <li>/api/activities/streams/export?id=ACTIVITY_ID</li>
        </ul>
      </section>
    </main>
  );
}
