'use client';

import dynamic from 'next/dynamic';
import type { ReactElement } from 'react';

const BorderTracedVisualization = dynamic(
  () => import('@/components/Docs/MetricVisualizations/BorderTracedVisualization'),
  { ssr: false }
);
const AreaEnclosedVisualization = dynamic(
  () => import('@/components/Docs/MetricVisualizations/AreaEnclosedVisualization'),
  { ssr: false }
);
const PathPrecisionVisualization = dynamic(
  () => import('@/components/Docs/MetricVisualizations/PathPrecisionVisualization'),
  { ssr: false }
);
const RouteEfficiencyVisualization = dynamic(
  () => import('@/components/Docs/MetricVisualizations/RouteEfficiencyVisualization'),
  { ssr: false }
);

const VISUALIZATIONS: Record<string, () => ReactElement> = {
  'border-traced': () => <BorderTracedVisualization />,
  'area-enclosed': () => <AreaEnclosedVisualization />,
  'path-precision': () => <PathPrecisionVisualization />,
  'route-efficiency': () => <RouteEfficiencyVisualization />,
};

interface MetricVisualizationBlockProps {
  slug: string;
}

export default function MetricVisualizationBlock({ slug }: MetricVisualizationBlockProps) {
  const Visualization = VISUALIZATIONS[slug];

  if (!Visualization) {
    return null;
  }

  return <Visualization />;
}
