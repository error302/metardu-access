import React from 'react';
import { WorkflowPlaceholder } from '@/components/WorkflowPlaceholder';

export default function DroneScreen() {
  return (
    <WorkflowPlaceholder
      title="Drone / UAV Imagery"
      icon="quadcopter"
      description="Ground Control Point (GCP) management and drone mission planning. Exports to WebODM for photogrammetric processing."
      features={[
        'GCP capture with cm-level GNSS RTK',
        'GCP target marking on photos',
        'Mission planning (waypoint grid)',
        'Flight log import (DJI, Parrot)',
        'RINEX recording for PPK',
        'Export to WebODM / Pix4D project',
      ]}
    />
  );
}
