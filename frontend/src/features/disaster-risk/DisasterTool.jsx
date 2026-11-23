import React from 'react';
import { Flame, Droplets, Mountain, Activity, ShieldAlert, Zap } from 'lucide-react';
import ModuleTools from '../analysis/ModuleTools';

const TOOLS = [
  { id: 'disaster-flood', icon: Droplets, color: 'text-blue-500' },
  { id: 'disaster-wildfire', icon: Flame, color: 'text-orange-600' },
  { id: 'disaster-landslide', icon: Mountain, color: 'text-amber-700' },
  { id: 'disaster-earthquake', icon: Activity, color: 'text-red-500' },
  { id: 'disaster-multi', icon: ShieldAlert, color: 'text-purple-600' },
  { id: 'disaster-impact', icon: Zap, color: 'text-yellow-500' },
];

export default function DisasterTool(props) {
  return <ModuleTools title="Disaster Risk Tools" subtitle="Hazard · exposure · impact" accent="#ea580c" tools={TOOLS} {...props} />;
}
