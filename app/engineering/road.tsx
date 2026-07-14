import React from 'react';
import { WorkflowPlaceholder } from '@/components/WorkflowPlaceholder';

export default function RoadDesignScreen() {
  return (
    <WorkflowPlaceholder
      title="Road Design"
      icon="road-variant"
      description="Horizontal and vertical alignment design with curve geometry, super-elevation, and setting-out tables."
      features={[
        'Horizontal curves: radius, tangent, arc, chord, deflection angle',
        'Vertical curves: parabolic, K-values',
        'Super-elevation computation',
        'Setting-out table (chord/deflection method)',
        'Design vs as-built comparison',
        'Earthworks: cut/fill volumes by chainage',
      ]}
    />
  );
}
