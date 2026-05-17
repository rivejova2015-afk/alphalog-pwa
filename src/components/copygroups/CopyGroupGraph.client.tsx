"use client";

import { useMemo } from "react";

interface Node {
  id: string;
  account_id: string;
  role: "master" | "slave";
  status: "active" | "paused" | "read_only";
  risk_pct: number;
  account?: { id: string; name: string; currency: string } | null;
}

interface Link {
  id: string;
  parent_account_id: string;
  child_account_id: string;
  copy_multiplier: number;
  link_type: "solid" | "shadow";
}

/**
 * Visualización SVG simple del copy-group graph.
 * Layout: masters arriba en una fila, slaves abajo distribuidos.
 * Click en nodo → onSelectNode(id).
 */
export default function CopyGroupGraph({
  nodes,
  links,
  selectedNodeId,
  onSelectNode,
}: {
  nodes: Node[];
  links: Link[];
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
}) {
  const layout = useMemo(() => computeLayout(nodes, links), [nodes, links]);

  if (nodes.length === 0) {
    return (
      <div className="bg-[#151b28] border border-[#1f2937] rounded-lg p-8 text-center">
        <p className="text-[#475569] text-sm">El grafo está vacío.</p>
        <p className="text-[#2d3748] text-xs mt-1">
          Añade nodos desde el panel de configuración (master + slaves).
        </p>
      </div>
    );
  }

  const width = 720;
  const height = layout.height;

  return (
    <div className="bg-[#151b28] border border-[#1f2937] rounded-lg p-4 overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Diagrama del copy group"
        className="w-full"
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#22d3ee" opacity="0.6" />
          </marker>
        </defs>

        {/* Links */}
        {links.map((l) => {
          const parent = layout.byAccountId.get(l.parent_account_id);
          const child = layout.byAccountId.get(l.child_account_id);
          if (!parent || !child) return null;
          const isShadow = l.link_type === "shadow";
          return (
            <g key={l.id}>
              <line
                x1={parent.x}
                y1={parent.y + 25}
                x2={child.x}
                y2={child.y - 25}
                stroke={isShadow ? "#475569" : "#22d3ee"}
                strokeWidth={isShadow ? 1 : 1.5}
                strokeDasharray={isShadow ? "4,4" : undefined}
                markerEnd="url(#arrow)"
                opacity="0.7"
              />
              <text
                x={(parent.x + child.x) / 2}
                y={(parent.y + child.y) / 2 - 4}
                fill="#94a3b8"
                fontSize="10"
                fontFamily="monospace"
                textAnchor="middle"
              >
                ×{l.copy_multiplier}
              </text>
            </g>
          );
        })}

        {/* Nodes */}
        {layout.nodes.map((n) => {
          const isSelected = selectedNodeId === n.id;
          const isPaused = n.status === "paused";
          const colorByStatus =
            n.status === "active" ? "#34d399"
              : n.status === "paused" ? "#f97316"
                : "#94a3b8";
          return (
            <g
              key={n.id}
              onClick={() => onSelectNode(isSelected ? null : n.id)}
              style={{ cursor: "pointer" }}
            >
              <circle
                cx={n.x}
                cy={n.y}
                r="24"
                fill={isSelected ? colorByStatus : "#151b28"}
                stroke={colorByStatus}
                strokeWidth={isSelected ? 3 : 1.5}
                opacity={isPaused ? 0.5 : 1}
              />
              <text
                x={n.x}
                y={n.y + 4}
                fill={isSelected ? "#0f172a" : colorByStatus}
                fontSize="11"
                fontFamily="monospace"
                textAnchor="middle"
                fontWeight="bold"
              >
                {n.role === "master" ? "M" : "S"}
              </text>
              <text
                x={n.x}
                y={n.y + 42}
                fill="#94a3b8"
                fontSize="10"
                fontFamily="monospace"
                textAnchor="middle"
              >
                {n.label}
              </text>
              <text
                x={n.x}
                y={n.y + 55}
                fill="#475569"
                fontSize="9"
                fontFamily="monospace"
                textAnchor="middle"
              >
                {n.risk_pct.toFixed(1)}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function computeLayout(nodes: Node[], _links: Link[]) {
  const W = 720;
  const ROW_H = 110;
  const masters = nodes.filter((n) => n.role === "master");
  const slaves = nodes.filter((n) => n.role === "slave");

  const positions = new Map<string, { x: number; y: number; id: string; label: string; role: "master" | "slave"; status: Node["status"]; risk_pct: number }>();
  const byAccountId = new Map<string, { x: number; y: number }>();

  const place = (arr: Node[], row: number) => {
    const count = arr.length;
    const gap = W / (count + 1);
    arr.forEach((n, i) => {
      const x = gap * (i + 1);
      const y = row * ROW_H + 60;
      const entry = {
        x, y, id: n.id,
        label: n.account?.name?.slice(0, 12) ?? n.account_id.slice(0, 6),
        role: n.role,
        status: n.status,
        risk_pct: n.risk_pct,
      };
      positions.set(n.id, entry);
      byAccountId.set(n.account_id, { x, y });
    });
  };

  place(masters, 0);
  place(slaves, 1);

  const height = (masters.length > 0 ? 1 : 0) * ROW_H + (slaves.length > 0 ? ROW_H : 0) + 80;

  return {
    nodes: Array.from(positions.values()),
    byAccountId,
    height: Math.max(height, 200),
  };
}
