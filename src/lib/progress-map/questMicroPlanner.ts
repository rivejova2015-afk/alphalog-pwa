// Quest Micro-Planner
// Convierte el Goal GPS en 3 micro-acciones diarias, visibles solo dentro del Progress Map.

export interface MicroAction {
  id: string;
  label: string;
  completed: boolean;
}

export function getDailyMicroActions(date: Date): MicroAction[] {
  void date;
  // Ejemplo: registro, evidencia, control
  return [
    { id: "registro", label: "Registrar trade", completed: false },
    { id: "evidencia", label: "Subir evidencia", completed: false },
    { id: "control", label: "Control de riesgo", completed: false }
  ];
}
