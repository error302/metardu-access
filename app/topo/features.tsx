import React from 'react';
import { WorkflowPlaceholder } from '@/components/WorkflowPlaceholder';

export default function FeaturesScreen() {
  return (
    <WorkflowPlaceholder
      title="Feature Codes"
      icon="tag-multiple"
      description="Manage feature codes for topographic survey (TREE, BUILD, ROAD, FENCE, etc.). Auto-applied to points captured via GPS or total station."
      features={[
        'Pre-loaded Kenya standard feature code library',
        'Custom code creation with color and icon',
        'Layer grouping (utilities, vegetation, structures)',
        'Code auto-attached to GPS captures',
        'Bulk edit point codes',
        'Filter by code on the map view',
      ]}
    />
  );
}
