import Link from 'next/link';

/**
 * Terms of Service Page
 * 
 * Displays the terms of service for CityCells.
 * WHY: May be required for Strava production access - terms of service must be publicly accessible if required.
 * 
 * Note: This page is created as a template. Update with actual terms of service content
 * if Strava requires a Terms of Service URL.
 */
export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
        <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
        <p className="text-sm text-gray-600 mb-8"><strong>Last Updated:</strong> February 7, 2026</p>
        
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Acceptance of Terms</h2>
          <p className="mb-4">
            By accessing and using CityCells, you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the application.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Description of Service</h2>
          <p className="mb-4">
            CityCells is a web application that visualizes Strava activities over city sub-areas (delområden) in Malmö, Sweden. The application gamifies exploring the city by challenging users to walk around the borders of its 136 sub-areas.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">User Responsibilities</h2>
          <p className="mb-4">You agree to:</p>
          <ul className="list-disc list-inside mb-4 space-y-2">
            <li>Use the application in accordance with applicable laws and regulations</li>
            <li>Provide accurate information when connecting your Strava account</li>
            <li>Maintain the security of your Strava account credentials</li>
            <li>Not use the application for any illegal or unauthorized purpose</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Strava Integration</h2>
          <p className="mb-4">
            CityCells integrates with Strava&apos;s API to access your activity data. Your use of Strava is subject to Strava&apos;s Terms of Service and Privacy Policy. You are responsible for ensuring you have the right to authorize CityCells to access your Strava data.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Data Storage</h2>
          <p className="mb-4">
            All data is stored locally on your device. CityCells does not store your personal data on our servers. You are responsible for backing up your data if desired.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Limitation of Liability</h2>
          <p className="mb-4">
            CityCells is provided &quot;as is&quot; without warranties of any kind. We are not responsible for any loss or damage resulting from your use of the application, including but not limited to data loss, inaccurate analysis results, or issues with Strava integration.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Changes to Terms</h2>
          <p className="mb-4">
            We reserve the right to modify these terms at any time. We will notify users of significant changes by updating the &quot;Last Updated&quot; date at the top of this page.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Contact</h2>
          <p className="mb-4">
            If you have questions about these Terms of Service, please contact us through the project repository or your preferred method of communication.
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
