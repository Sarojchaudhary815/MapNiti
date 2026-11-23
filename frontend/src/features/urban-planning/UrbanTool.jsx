import React from 'react';
import { Map, TrendingUp, Waypoints, SearchCode } from 'lucide-react';
import ModuleTools from '../analysis/ModuleTools';

const TOOLS = [
  { id: 'urban-lulc', icon: Map, color: 'text-emerald-500' },
  { id: 'urban-growth', icon: TrendingUp, color: 'text-blue-500' },
  { id: 'urban-roads', icon: Waypoints, color: 'text-orange-500' },
  { id: 'urban-suitability', icon: SearchCode, color: 'text-purple-500' },
];

export default function UrbanTool(props) {
  return <ModuleTools title="Urban Planning" subtitle="Land use · growth · roads · suitability" accent="#2563eb" tools={TOOLS} {...props} />;
}
