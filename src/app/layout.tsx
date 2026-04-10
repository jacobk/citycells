import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Application metadata
 * WHY: Proper metadata improves SEO, social sharing, and PWA experience.
 * @see docs/ADR/018-branding-design-system.md
 */
export const metadata: Metadata = {
  title: "CityCells - Malmö Explorer",
  description: "Track your mission to walk every sub-area of Malmö. Connect your Strava account and explore the city one cell at a time.",
  keywords: ["Malmö", "walking", "Strava", "exploration", "fitness", "map"],
  authors: [{ name: "CityCells" }],
  
  // Favicon configuration
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '32x32' },
    ],
    apple: '/apple-touch-icon.png',
    other: [
      { rel: 'icon', url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { rel: 'icon', url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  
  // PWA manifest
  manifest: '/site.webmanifest',
  
  // Open Graph for social sharing
  openGraph: {
    title: "CityCells - Malmö Explorer",
    description: "Track your mission to walk every sub-area of Malmö",
    type: "website",
    locale: "en_US",
  },
};

/**
 * Viewport configuration
 * WHY: Theme color adapts to light/dark mode preference for native browser chrome theming.
 */
export const viewport: Viewport = {
  // WHY: width/initialScale ensure proper mobile layout; viewportFit 'cover'
  // fills the screen on devices with safe-area insets (e.g., iPhone notch). See TICKET-032.
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#7c3aed' },
    { media: '(prefers-color-scheme: dark)', color: '#a78bfa' },
  ],
};

/**
 * Inline script to apply theme before first paint (prevents FOUC).
 * WHY: This script runs synchronously before React hydration, ensuring
 * the correct theme is applied immediately and avoiding a flash of the wrong theme.
 * 
 * @see docs/tickets/022-dark-mode-toggle.md
 * @see docs/PRD/001-mvp-mobile-walker.md Section 3.14
 */
const themeScript = `
(function() {
  try {
    var theme = localStorage.getItem('citycells-theme') || 'system';
    var isDark = theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
`;

/**
 * Inline script to unregister any previously installed service worker.
 * WHY: Service worker was removed from the app. Existing users may still have
 * a stale SW registered that intercepts requests. This cleans it up.
 */
const swCleanupScript = `
(function() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(regs) {
      regs.forEach(function(r) { r.unregister(); });
    });
    if (typeof caches !== 'undefined') {
      caches.keys().then(function(names) {
        names.forEach(function(n) { caches.delete(n); });
      });
    }
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* WHY: Inline script prevents flash of wrong theme (FOUC) by applying 
            .dark class before React hydrates. Must be in <head> to run early. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: swCleanupScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
