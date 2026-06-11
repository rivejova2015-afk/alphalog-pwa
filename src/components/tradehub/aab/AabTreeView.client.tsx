"use client";

import { useMemo } from "react";

interface AccountSummary {
  id: string;
  name: string;
  currency: string;
  status: string;
  operation_state: string | null;
  phase_status: string | null;
  role: string | null;
}

interface CopyGroupNode {
  id: string;
  account_id: string;
  role: "master" | "slave";
  status: "active" | "paused" | "read_only";
  risk_pct: number;
  account?: AccountSummary | null;
}

interface CopyGroupLink {
  id: string;
  parent_account_id: string;
  child_account_id: string;
  copy_multiplier: number;
  link_type: "solid" | "shadow";
}

interface TreeNode {
  node: CopyGroupNode;
  children: TreeNode[];
  linkFromParent?: CopyGroupLink;
  multiplierPath: number;
}

export default function AabTreeView({
  nodes,
  links,
  selectedNodeId,
  onSelectNode,
}: {
  nodes: CopyGroupNode[];
  links: CopyGroupLink[];
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
}) {
  const tree = useMemo(() => {
    const nodeMap = new Map(nodes.map((n) => [n.account_id, n]));
    const linksByParent = new Map<string, CopyGroupLink[]>();

    links.forEach((link) => {
      if (!linksByParent.has(link.parent_account_id)) {
        linksByParent.set(link.parent_account_id, []);
      }
      linksByParent.get(link.parent_account_id)?.push(link);
    });

    const rootNode = nodes.find((n) => n.role === "master" && n.status === "active") || nodes.find((n) => n.role === "master") || null;

    if (!rootNode) {
      return { root: null, orphans: nodes };
    }

    const visited = new Set<string>();

    const buildTree = (accountId: string, multiplierPath: number): TreeNode | null => {
      if (visited.has(accountId)) return null;
      visited.add(accountId);

      const node = nodeMap.get(accountId);
      if (!node) return null;

      const childLinks = linksByParent.get(accountId) || [];
      const children = childLinks
        .map((link) => {
          const childMultiplier = multiplierPath * (Number(link.copy_multiplier) || 1);
          const childTree = buildTree(link.child_account_id, childMultiplier);
          if (!childTree) return null;
          return {
            ...childTree,
            linkFromParent: link,
            multiplierPath: childMultiplier,
          };
        })
        .filter(Boolean) as TreeNode[];

      return { node, children, multiplierPath };
    };

    const rootTree = buildTree(rootNode.account_id, 1);
    const orphanNodes = nodes.filter((n) => !visited.has(n.account_id));

    return { root: rootTree, orphans: orphanNodes };
  }, [nodes, links]);

  const renderNode = (treeNode: TreeNode, depth = 0) => {
    const account = treeNode.node.account;
    const isSelected = selectedNodeId === treeNode.node.id;
    const link = treeNode.linkFromParent;
    const linkLabel = link ? `${link.link_type === "solid" ? "Solid" : "Shadow"} ×${link.copy_multiplier}` : null;
    const hasChildren = treeNode.children.length > 0;

    return (
      <div
        key={treeNode.node.id}
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={hasChildren ? true : undefined}
        className="space-y-2"
      >
        <button
          onClick={() => onSelectNode(treeNode.node.id)}
          className={`w-full text-left border rounded-xl px-4 py-3 transition ${
            isSelected ? "border-emerald-400 bg-emerald-500/10" : "border-slate-700 bg-slate-900/60"
          }`}
          style={{ marginLeft: depth * 16 }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-100">{account?.name || "Cuenta"}</div>
              <div className="text-xs text-slate-400">
                {treeNode.node.role.toUpperCase()} • {treeNode.node.status} • Risk {treeNode.node.risk_pct}%
              </div>
            </div>
            <div className="text-right text-xs text-slate-400">
              <div>Multiplier path: ×{treeNode.multiplierPath.toFixed(3)}</div>
              {linkLabel && <div>{linkLabel}</div>}
            </div>
          </div>
        </button>

        {hasChildren && (
          <div role="group" className="space-y-2">
            {treeNode.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {!tree.root && (
        <div className="text-sm text-slate-400">No hay master activo. Agrega un nodo master para iniciar el árbol.</div>
      )}
      {tree.root && (
        <div role="tree" aria-label="Árbol de cuentas del CopyGroup">
          {renderNode(tree.root)}
        </div>
      )}

      {tree.orphans.length > 0 && (
        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-3">
          <div className="text-xs uppercase text-slate-400 mb-2">Nodos sin conexión</div>
          <div className="space-y-2">
            {tree.orphans.map((node) => (
              <button
                key={node.id}
                onClick={() => onSelectNode(node.id)}
                className={`w-full text-left border rounded-lg px-3 py-2 transition ${
                  selectedNodeId === node.id ? "border-emerald-400 bg-emerald-500/10" : "border-slate-700 bg-slate-900/60"
                }`}
              >
                <div className="text-sm text-slate-100">{node.account?.name || "Cuenta"}</div>
                <div className="text-xs text-slate-400">{node.role.toUpperCase()} • {node.status}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
