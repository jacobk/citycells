import MetricCard from '@/components/Docs/MetricCard';
import { METRICS_CONTENT } from '@/lib/metrics-content';

const METRIC_ORDER = [
  'border-traced',
  'area-enclosed',
  'path-precision',
  'route-efficiency',
];

export default function MetricsOverviewPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900">Metric Breakdown</h1>
        <p className="text-sm text-gray-600">
          Learn how each score is calculated and how to improve future walks.
        </p>
      </header>

      <section className="grid gap-4">
        {METRIC_ORDER.map((slug) => {
          const metric = METRICS_CONTENT[slug];

          return <MetricCard key={metric.slug} metric={metric} />;
        })}
      </section>
    </div>
  );
}
