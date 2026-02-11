// Recovery Playbook Node
// Mini-itinerario de misiones de reconstrucción con progreso y checklist.

export interface RecoveryMission {
  id: string;
  label: string;
  completed: boolean;
}

export class RecoveryPlaybook {
  private missions: RecoveryMission[] = [];

  addMission(label: string) {
    this.missions.push({ id: `${label}-${Date.now()}`, label, completed: false });
  }

  completeMission(id: string) {
    const m = this.missions.find(m => m.id === id);
    if (m) m.completed = true;
  }

  getProgress() {
    const total = this.missions.length;
    const done = this.missions.filter(m => m.completed).length;
    return total === 0 ? 0 : done / total;
  }

  getChecklist() {
    return this.missions;
  }
}
