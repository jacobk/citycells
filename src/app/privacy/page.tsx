import Link from 'next/link';

/**
 * Privacy Policy Page
 * 
 * Displays the privacy policy for CityCells.
 * WHY: Required for Strava production access - privacy policy must be publicly accessible.
 */
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
        <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
        <p className="text-sm text-gray-600 mb-8"><strong>Last Updated:</strong> February 7, 2026</p>
        
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Introduction</h2>
          <p className="mb-4">
            CityCells (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our application.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Information We Collect</h2>
          
          <h3 className="text-xl font-semibold mb-3">Strava Data</h3>
          <p className="mb-4">
            CityCells uses Strava OAuth 2.0 to access your Strava account data. We request the following permissions:
          </p>
          <ul className="list-disc list-inside mb-4 space-y-2">
            <li><strong>Read access</strong> to your basic profile information (name, profile picture)</li>
            <li><strong>Read access</strong> to your activities (including private activities)</li>
            <li><strong>Read access</strong> to activity streams (GPS coordinates, time, distance)</li>
          </ul>

          <h3 className="text-xl font-semibold mb-3">Data Storage</h3>
          <p className="mb-4">
            All data is stored <strong>locally on your device</strong> using browser-based SQLite (IndexedDB). We do not store your data on our servers. Specifically:
          </p>
          <ul className="list-disc list-inside mb-4 space-y-2">
            <li><strong>Authentication tokens</strong>: Stored locally in your browser (HTTP-only cookies and IndexedDB)</li>
            <li><strong>Activity data</strong>: Cached locally in SQLite database on your device</li>
            <li><strong>Analysis results</strong>: Stored locally with your activity data</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">How We Use Your Data</h2>
          <p className="mb-4">
            We use your Strava data solely for the following purposes:
          </p>
          <ol className="list-decimal list-inside mb-4 space-y-2">
            <li><strong>Activity Analysis</strong>: To analyze your walking activities and match them to Malmö sub-areas</li>
            <li><strong>Progress Tracking</strong>: To calculate completion scores and track your progress through the 136 sub-areas</li>
            <li><strong>Visualization</strong>: To display your activities on the map and show which areas you&apos;ve completed</li>
          </ol>
          <p className="mb-4">
            We do <strong>not</strong>:
          </p>
          <ul className="list-disc list-inside mb-4 space-y-2">
            <li>Share your data with third parties</li>
            <li>Sell your data</li>
            <li>Use your data for advertising</li>
            <li>Store your data on our servers</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Data Security</h2>
          <ul className="list-disc list-inside mb-4 space-y-2">
            <li>All data remains on your device (client-side storage)</li>
            <li>OAuth tokens are stored securely using HTTP-only cookies and IndexedDB</li>
            <li>No data is transmitted to our servers except for:
              <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                <li>OAuth authentication flow (handled by Strava)</li>
                <li>API requests to Strava to fetch your activities (using your tokens)</li>
              </ul>
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Your Rights</h2>
          <p className="mb-4">You have the right to:</p>
          <ul className="list-disc list-inside mb-4 space-y-2">
            <li><strong>Revoke access</strong>: You can revoke CityCells&apos; access to your Strava account at any time through <a href="https://www.strava.com/settings/apps" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Strava&apos;s connected apps settings</a></li>
            <li><strong>Delete local data</strong>: You can clear your browser&apos;s IndexedDB storage to remove all locally stored data</li>
            <li><strong>Log out</strong>: Use the &quot;Sign Out&quot; button in the app to clear authentication tokens</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Third-Party Services</h2>
          
          <h3 className="text-xl font-semibold mb-3">Strava</h3>
          <p className="mb-4">
            CityCells integrates with Strava&apos;s API. Your use of Strava is subject to <a href="https://www.strava.com/legal/privacy" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Strava&apos;s Privacy Policy</a>. We only access data that you explicitly authorize through Strava&apos;s OAuth consent screen.
          </p>

          <h3 className="text-xl font-semibold mb-3">Vercel (Hosting)</h3>
          <p className="mb-4">
            The application is hosted on Vercel. Vercel may collect standard web server logs (IP addresses, request timestamps) as part of their hosting service. See <a href="https://vercel.com/legal/privacy-policy" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Vercel&apos;s Privacy Policy</a> for details.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Changes to This Policy</h2>
          <p className="mb-4">
            We may update this Privacy Policy from time to time. We will notify you of any changes by updating the &quot;Last Updated&quot; date at the top of this policy.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Contact</h2>
          <p className="mb-4">
            If you have questions about this Privacy Policy, please contact us through the project repository or your preferred method of communication.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Data Retention</h2>
          <p className="mb-4">
            Since all data is stored locally on your device:
          </p>
          <ul className="list-disc list-inside mb-4 space-y-2">
            <li>Data persists until you clear your browser&apos;s IndexedDB storage</li>
            <li>Authentication tokens expire according to Strava&apos;s token expiration policy</li>
            <li>You can delete all data at any time by clearing browser storage</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">GDPR Compliance</h2>
          <p className="mb-4">
            If you are located in the European Economic Area (EEA), you have certain data protection rights under the General Data Protection Regulation (GDPR):
          </p>
          <ul className="list-disc list-inside mb-4 space-y-2">
            <li>Right to access your personal data</li>
            <li>Right to rectification</li>
            <li>Right to erasure (&quot;right to be forgotten&quot;)</li>
            <li>Right to restrict processing</li>
            <li>Right to data portability</li>
            <li>Right to object to processing</li>
          </ul>
          <p className="mb-4">
            Since all data is stored locally on your device, you have full control over your data. To exercise any of these rights, simply clear your browser&apos;s IndexedDB storage or revoke access through Strava&apos;s settings.
          </p>
        </section>

        <div className="mt-12 pt-8 border-t">
          <Link href="/" className="text-blue-600 hover:underline">← Back to CityCells</Link>
          
          {/* WHY: "Powered by Strava" branding per Strava API Brand Guidelines - separate from app name */}
          <div className="mt-6 text-xs text-gray-500 text-center">
            Powered by{' '}
            <a 
              href="https://www.strava.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="font-medium hover:underline"
              style={{ color: '#FC5200' }}
            >
              Strava
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
