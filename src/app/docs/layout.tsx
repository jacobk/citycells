import Link from 'next/link';
import type { ReactNode } from 'react';

interface DocsLayoutProps {
  children: ReactNode;
}

export default function DocsLayout({ children }: DocsLayoutProps) {
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link href="/" className="text-sm font-medium text-blue-600 hover:underline">
            Back to map
          </Link>
          <div className="text-sm text-gray-500">Metrics Documentation</div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
