import React from 'react';
import { Sprout, ThermometerSun, Wind, Shovel } from 'lucide-react';
import ModuleTools from '../analysis/ModuleTools';

const TOOLS = [
  { id: 'agri-crop', icon: Sprout, color: 'text-green-600' },
  { id: 'agri-soil', icon: Shovel, color: 'text-amber-600' },
  { id: 'agri-irrigation', icon: Wind, color: 'text-blue-400' },
  { id: 'agri-risk', icon: ThermometerSun, color: 'text-orange-500' },
];

export default function AgricultureTool(props) {
  return <ModuleTools title="Agriculture Tools" subtitle="Crop · soil · irrigation · risk" accent="#059669" tools={TOOLS} {...props} />;
}
