import React from 'react';
import { WorkflowPlaceholder } from '@/components/WorkflowPlaceholder';

export default function SettingOutScreen() {
  return (
    <WorkflowPlaceholder
      title="Setting Out"
      icon="target"
      description="Stake out design points from coordinates. Connect to a robotic total station for prism tracking and live deviation feedback."
      features={[
        'Design point import (CSV, DXF, LandXML)',
        'Live stake-out with deviation display',
        'Robotic total station integration via Bluetooth',
        'Prism tracking and auto-target',
        'Tolerance alerts (5mm / 10mm configurable)',
        'As-built point capture during stakeout',
      ]}
    />
  );
}
