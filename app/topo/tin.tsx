import React from 'react';
import { WorkflowPlaceholder } from '@/components/WorkflowPlaceholder';

export default function TinScreen() {
  return (
    <WorkflowPlaceholder
      title="TIN Surface"
      icon="triangle-outline"
      description="Triangulated Irregular Network from surveyed points. Live preview of the surface model with breakline support."
      features={[
        'Delaunay triangulation (Delaunator)',
        'Breakline enforcement (roads, ridges, water)',
        'Live 3D preview with Three.js',
        'Surface statistics (min/max/mean elevation)',
        'Volume computation against a datum',
        'Export to LandXML for desktop CAD',
      ]}
    />
  );
}
