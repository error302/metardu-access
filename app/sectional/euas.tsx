import React from 'react';
import { WorkflowPlaceholder } from '@/components/WorkflowPlaceholder';

export default function EuasScreen() {
  return (
    <WorkflowPlaceholder
      title="Exclusive Use Areas"
      icon="crop"
      description="Manage Exclusive Use Areas (EUAs) attached to units — balconies, parking bays, gardens, storage, terraces. Required per Sectional Properties Act 2020."
      features={[
        'EUA types: balcony, parking, garden, storage, terrace',
        'Area (sqm) per EUA',
        'Attach EUA to specific unit',
        'Shared EUA allocation (e.g. visitor parking)',
        'EUA schedule for sectional plan',
        'ArdhiSasa JSON export',
      ]}
    />
  );
}
