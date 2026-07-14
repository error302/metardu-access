import React from 'react';
import { WorkflowPlaceholder } from '@/components/WorkflowPlaceholder';

export default function LevelingScreen() {
  return (
    <WorkflowPlaceholder
      title="Engineering Leveling"
      icon="arrow-up-down"
      description="Rise & Fall or Height of Collimation leveling runs. Records backsight, foresight, intermediate sights, with auto closure check."
      features={[
        'Rise & Fall method booking',
        'Height of Collimation method',
        'BS/FS/IS entry with auto-computed rises and falls',
        'Closure check with allowable misclosure formula',
        'Line leveling with multiple setups',
        'Export to .field-session JSON',
      ]}
    />
  );
}
