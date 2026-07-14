import React from 'react';
import { WorkflowPlaceholder } from '@/components/WorkflowPlaceholder';

export default function DevelopmentScreen() {
  return (
    <WorkflowPlaceholder
      title="Sectional Property Development"
      icon="home-city"
      description="Register a sectional property development per the Sectional Properties Act 2020 (Kenya). Captures parent parcel, total units, total floors."
      features={[
        'Development name and parent parcel (LR number)',
        'Total units and total floors',
        'Common property definition',
        'Developer and management company details',
        'Sectional plan schedule generation',
        'ArdhiSasa-compatible submission records',
      ]}
    />
  );
}
