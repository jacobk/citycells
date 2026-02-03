export interface MetricContent {
  slug: string;
  technicalName: string;
  userFriendlyName: string;
  summary: string;
  whyItMatters: string;
  howCalculated: string[];
  tips: string[];
}

export const METRICS_CONTENT: Record<string, MetricContent> = {
  'border-traced': {
    slug: 'border-traced',
    technicalName: 'Perimeter Coverage',
    userFriendlyName: 'Border Traced',
    summary: "Measures what percentage of the area's outline you walked within 25 meters.",
    whyItMatters:
      'Border tracing is the core goal of CityCells. The more of the outline you cover, the more confidently we can say you explored the whole area.',
    howCalculated: [
      'Buffer the area border by 25 meters to allow for GPS and sidewalk offsets.',
      'Measure how much of your path falls inside that buffer.',
      'Divide covered border length by total border length to get a percent.',
    ],
    tips: [
      'Walk as close to the edge as possible instead of cutting through the interior.',
      'Slow down at corners and follow the curve to avoid missing sections.',
      'If you miss a segment, loop back along the border to fill the gap.',
    ],
  },
  'area-enclosed': {
    slug: 'area-enclosed',
    technicalName: 'Area Coverage',
    userFriendlyName: 'Area Enclosed',
    summary: 'Measures how much of the sub-area falls inside your walking loop.',
    whyItMatters:
      'A closed loop proves you fully wrapped the area. If your path does not close, the enclosed area is zero.',
    howCalculated: [
      'Check that your start and end points are within 100 meters (loop closure).',
      'Build a polygon from your closed walking loop.',
      'Calculate the intersection area between your loop and the sub-area.',
      'Divide intersection area by total sub-area size to get a percent.',
    ],
    tips: [
      'Finish near where you started so the loop closes.',
      'Walk a wide loop that wraps the entire sub-area.',
      'Avoid cutting across the middle if you want high coverage.',
    ],
  },
  'path-precision': {
    slug: 'path-precision',
    technicalName: 'Alignment Score (RMSE)',
    userFriendlyName: 'Path Precision',
    summary: 'Measures how close you stayed to the border throughout your walk.',
    whyItMatters:
      'Precision rewards steady, close tracking of the border and penalizes large detours more strongly than small drifts.',
    howCalculated: [
      'For each point, measure distance to the nearest border point.',
      'Square those distances to penalize larger deviations.',
      'Average the squared distances and take the square root (RMSE).',
      'Normalize: an average distance of 50m maps to a score of 0.',
    ],
    tips: [
      'Stay consistently close instead of alternating between near and far.',
      'Correct your path quickly if you drift away from the edge.',
      'Use visible boundary cues like fences or roads to stay aligned.',
    ],
  },
  'route-efficiency': {
    slug: 'route-efficiency',
    technicalName: 'Efficiency',
    userFriendlyName: 'Route Efficiency',
    summary: 'Measures what percentage of your walk was actually along the border.',
    whyItMatters:
      'Efficiency rewards focused border walking and highlights detours that inflate total distance.',
    howCalculated: [
      'Measure how much of your walk aligns with the border buffer.',
      'Divide border-aligned distance by total walk distance.',
      'Express the result as a percentage.',
    ],
    tips: [
      'Avoid long detours away from the border.',
      'Plan a route that stays on the perimeter instead of zig-zagging.',
      'If you must detour, rejoin the border quickly to limit wasted distance.',
    ],
  },
};
