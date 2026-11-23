import React from 'react';
import { useNavigate } from 'react-router-dom';
import AiAssistant from '../../features/ai/AiAssistant';
import { openInCodeLab } from './LearnPage';

export default function AiPage() {
  const navigate = useNavigate();
  return (
    <div className="h-[calc(100vh-65px)]">
      <AiAssistant onOpenCodeLab={(lang, code) => openInCodeLab(navigate, lang, code)} />
    </div>
  );
}
