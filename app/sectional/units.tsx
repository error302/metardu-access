import React from 'react';
import { WorkflowPlaceholder } from '@/components/WorkflowPlaceholder';

export default function UnitsScreen() {
  return (
    <WorkflowPlaceholder
      title="Units Registry"
      icon="floor-plan"
      description="Register individual units with floor, area, and exclusive use areas. Each unit gets a unique number for the sectional plan."
      features={[
        'Unit registration with number, floor, and area (sqm)',
        'Exclusive use areas (balcony, parking, garden, storage, terrace)',
        'Floor plan image upload per unit',
        'Bulk unit creation by floor',
        'Unit area auto-totals',
        'Schedule of units export for statutory forms',
      ]}
    />
  );
}
