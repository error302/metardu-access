import React from 'react';
import { WorkflowPlaceholder } from '@/components/WorkflowPlaceholder';

export default function EarthworksScreen() {
  return (
    <WorkflowPlaceholder
      title="Earthworks Volumes"
      icon="excavator"
      description="Compute cut and fill volumes from cross-sections or grid levels. Essential for road construction and site preparation."
      features={[
        'Cross-section method (average end area)',
        'Grid method with formation level',
        'Cut/Fill volumes per chainage interval',
        'Mass haul diagram',
        'Borrow/spoil volume tracking',
        'Export to .field-session JSON for desktop reporting',
      ]}
    />
  );
}
