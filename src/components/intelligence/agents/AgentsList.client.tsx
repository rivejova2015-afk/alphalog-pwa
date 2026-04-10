'use client';

import { useState } from 'react';
import { GitCompare } from 'lucide-react';
import { AgentCard } from './AgentCard';
import { OperationsModal } from './OperationsModal.client';
import { CompareModal } from './CompareModal.client';

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
  const [opsAgent, setOpsAgent] = useState<AgentData | null>(null);
  const [showCompare, setShowCompare] = useState(false);

  const handlePause = (id: string) => {
    // TODO: connect to API route to update agent status
    console.log('Toggle agent:', id);
  };

  return (
    <>
      {/* Compare button */}
      {agents.length > 1 && (
        <div className="flex justify-end mb-3">
          <button
            onClick={() => setShowCompare(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-[#94a3b8] hover:text-[#22d3ee] hover:bg-[#151b28] rounded transition-colors border border-[#1f2937]"
          >
            <GitCompare size={14} />
            Compare All
          </button>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <AgentCard
            key={agent.id}
            {...agent}
            onViewOps={() => setOpsAgent(agent)}
            onPause={() => handlePause(agent.id)}
            onSettings={() => {}}
          />
        ))}
      </div>

      {/* Operations Modal */}
      {opsAgent && (
        <OperationsModal
          agentName={opsAgent.name}
          operations={[]}
          onClose={() => setOpsAgent(null)}
        />
      )}

      {/* Compare Modal */}
      {showCompare && (
        <CompareModal
          agents={agents}
          onClose={() => setShowCompare(false)}
        />
      )}
    </>
  );
}
