import Link from 'next/link';

import type { MetricContent } from '@/lib/metrics-content';

interface MetricCardProps {
  metric: MetricContent;
}

export default function MetricCard({ metric }: MetricCardProps) {
  return (
    <Link
      href={`/docs/metrics/${metric.slug}`}
      className="block rounded-lg border border-gray-100 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-gray-900">{metric.userFriendlyName}</h2>
          <p className="text-sm text-gray-600">{metric.summary}</p>
        </div>
        <span className="text-xs font-medium text-blue-600">Learn more</span>
      </div>
    </Link>
  );
}
