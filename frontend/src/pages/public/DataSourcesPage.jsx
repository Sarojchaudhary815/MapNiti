import React from 'react';
import { useNavigate } from 'react-router-dom';
import DataSources from '../../features/resources/DataSources';
import { isAuthenticated } from '../../api/authApi';

export default function DataSourcesPage() {
  const navigate = useNavigate();
  // Tool shortcuts open the analysis workspace (login required).
  const openModule = (module) => {
    if (module === 'ai') { navigate('/ai'); return; }
    navigate(isAuthenticated() ? `/tool?module=${module}` : '/login');
  };
  return <DataSources onOpenModule={openModule} />;
}
