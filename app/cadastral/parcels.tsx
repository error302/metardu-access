import React from 'react';
import { WorkflowPlaceholder } from '@/components/WorkflowPlaceholder';

export default function ParcelsScreen() {
  return (
    <WorkflowPlaceholder
      title="Parcel Definition"
      icon="vector-square"
      description="Define parcels with LR numbers, registry, area, perimeter, and beacon sequence. Each parcel links to a traverse for boundary computation."
      features={[
        'Parcel metadata (LR number, registry, area, perimeter)',
        'Beacon sequence with type (concrete, iron pin, stone, natural)',
        'Beacon condition tracking (good, disturbed, destroyed, missing)',
        'Auto area computation via Shoelace formula',
        'Export to .field-session JSON for deed plan generation on desktop',
        'NLIMS-compatible parcel records',
      ]}
    />
  );
}
