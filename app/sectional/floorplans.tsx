import React from 'react';
import { WorkflowPlaceholder } from '@/components/WorkflowPlaceholder';

export default function FloorPlansScreen() {
  return (
    <WorkflowPlaceholder
      title="Floor Plans"
      icon="drawing"
      description="Sketch floor plans directly on the device with snap-to-grid. Each plan attaches to its unit and exports with the sectional plan submission."
      features={[
        'Touch drawing with snap-to-grid (0.1m)',
        'Pre-loaded symbols (doors, windows, walls)',
        'Auto dimension lines',
        'Photo-to-plan tracing (overlay reference)',
        'Floor plan per unit, per floor',
        'Export to DXF / PDF',
      ]}
    />
  );
}
