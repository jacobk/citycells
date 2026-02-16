import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import { OfflineIndicator } from '@/components/OfflineIndicator';

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
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#7c3aed' },
    { media: '(prefers-color-scheme: dark)', color: '#a78bfa' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ServiceWorkerRegistration />
        <OfflineIndicator />
        {children}
      </body>
    </html>
  );
}
