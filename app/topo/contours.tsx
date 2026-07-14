import React from 'react';
import { WorkflowPlaceholder } from '@/components/WorkflowPlaceholder';

export default function ContoursScreen() {
  return (
    <WorkflowPlaceholder
      title="Contours"
      icon="chart-bell-curve"
      description="Generate contour lines from the TIN surface. Configurable interval (0.5m / 1m / 2m) with index contours every 5th line."
      features={[
        'Configurable contour interval',
        'Index contours (every 5th) with labels',
        'Smoothed contour rendering',
        'Hillshade overlay',
        'Export to DXF / Shapefile',
        'Contour annotation with elevation labels',
      ]}
    />
  );
}
