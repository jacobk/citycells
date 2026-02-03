import Link from 'next/link';
import { notFound } from 'next/navigation';

import MetricVisualizationBlock from '@/components/Docs/MetricVisualizationBlock';
import { METRICS_CONTENT } from '@/lib/metrics-content';

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(METRICS_CONTENT).map((slug) => ({ slug }));
}

interface MetricDetailPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function MetricDetailPage({ params }: MetricDetailPageProps) {
  const resolvedParams = await params;
  const metric = METRICS_CONTENT[resolvedParams.slug];

  if (!metric) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Link href="/docs/metrics" className="text-xs font-medium text-blue-600 hover:underline">
          All metrics
        </Link>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-gray-900">{metric.userFriendlyName}</h1>
          <p className="text-sm text-gray-600">{metric.summary}</p>
          <p className="text-xs text-gray-500">Technical name: {metric.technicalName}</p>
        </div>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-700">Why It Matters</h2>
        <p className="text-sm text-gray-700">{metric.whyItMatters}</p>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Interactive Visualization</h2>
          <span className="text-xs text-gray-500">Static example data</span>
        </div>
        <div className="rounded-lg border border-gray-100 bg-white p-3 shadow-sm">
          <MetricVisualizationBlock slug={metric.slug} />
        </div>
        <p className="text-xs text-gray-500">
          Use the controls in the visual to compare strong and weak examples.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-700">How It&apos;s Calculated</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-700">
          {metric.howCalculated.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-700">Tips to Improve</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-gray-700">
          {metric.tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
