import React from 'react';
import { WorkflowPlaceholder } from '@/components/WorkflowPlaceholder';

export default function BeaconsScreen() {
  return (
    <WorkflowPlaceholder
      title="Beacon Library"
      icon="map-marker-multiple"
      description="Catalog every beacon with type, condition, photo evidence, and geotag. Required for statutory survey records."
      features={[
        'Beacon types: concrete, iron pin, stone, natural feature',
        'Condition tracking with timestamped history',
        'Geotagged photo evidence per beacon',
        'Voice notes for field observations',
        'Auto-link to parent parcel',
        'Export for Form No. 4 deed plan preparation',
      ]}
    />
  );
}
