'use client';

import { AgentCard } from './AgentCard';

type AgentStatus = 'ACTIVE' | 'PAUSED' | 'ERROR';
type AgentType = 'polymarket' | 'custom_ia';

interface AgentData {
  id: string;
  name: string;
  type: AgentType;
  status: AgentStatus;
  portfolioValue: number;
  winRate: number;
  roi: number;
  sharpeRatio: number;
  maxDrawdown: number;
  lastTradeTime: string;
}

interface AgentsListProps {
  agents: AgentData[];
}

export function AgentsList({ agents }: AgentsListProps) {
  const handleViewOps = (id: string) => {
    console.log('View ops for agent:', id);
  };

  const handlePause = (id: string) => {
    console.log('Toggle agent:', id);
  };

  const handleSettings = (id: string) => {
    console.log('Settings for agent:', id);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {agents.map((agent) => (
        <AgentCard
          key={agent.id}
          {...agent}
          onViewOps={() => handleViewOps(agent.id)}
          onPause={() => handlePause(agent.id)}
          onSettings={() => handleSettings(agent.id)}
        />
      ))}
    </div>
  );
}
