// Feature properties the app itself manages (grouping + symbology) — kept
// out of the user-facing attribute table and label-field pickers, which
// should only ever show attributes the user actually cares about.
export const SYSTEM_PROPS = [
  'layerId', 'color', 'opacity', 'lineWidth', 'pointRadius',
  'dashed', 'pointShape', 'labelField', 'label',
];
