import React from 'react';
import { WorkflowPlaceholder } from '@/components/WorkflowPlaceholder';

export default function AsBuiltScreen() {
  return (
    <WorkflowPlaceholder
      title="As-Built Verification"
      icon="clipboard-check"
      description="Compare design vs surveyed positions. Reports positional deviations and tolerance compliance for QA/QC handover."
      features={[
        'Side-by-side design vs surveyed coordinates',
        'Positional deviation report',
        'Tolerance compliance flags',
        'Statistical summary (mean, max, RMS)',
        'PDF / Excel QA/QC report export',
        'Photo evidence per as-built point',
      ]}
    />
  );
}
