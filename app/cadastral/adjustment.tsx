import React from 'react';
import { WorkflowPlaceholder } from '@/components/WorkflowPlaceholder';

export default function AdjustmentScreen() {
  return (
    <WorkflowPlaceholder
      title="Traverse Adjustment"
      icon="chart-line"
      description="Apply Bowditch, Transit, or Least Squares adjustment to your traverse observations. View misclosures, precision ratios, and adjusted coordinates."
      features={[
        'Bowditch (Compass) rule — proportional to leg length',
        'Transit rule — proportional to latitudes and departures',
        'Least Squares Adjustment with residuals',
        'Angular misclosure detection',
        'Linear misclosure and precision ratio (1:N)',
        'Kenya 3rd order compliance check (≥ 1:5000)',
      ]}
    />
  );
}
