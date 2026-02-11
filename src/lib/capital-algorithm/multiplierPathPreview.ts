// Multiplier Path Preview
// Simula el resultado de los multipliers en CopyGroups sin ejecutar nada.
// Devuelve la estructura resultante para mostrar en el panel derecho.

export interface Node {
  id: string;
  label: string;
  multiplier: number;
  children?: Node[];
}

export function simulateMultiplierPath(root: Node, masterSize: number): Node {
  function apply(node: Node, size: number): Node {
    const newSize = size * node.multiplier;
    return {
      ...node,
      simulatedSize: newSize,
      children: node.children?.map(child => apply(child, newSize)) || []
    };
  }
  return apply(root, masterSize);
}
