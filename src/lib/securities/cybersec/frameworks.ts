// Frameworks de seguridad como diagramas por fases (Kill Chain, ATT&CK, controles).
// Reemplaza los párrafos de texto plano por contenido estructurado y navegable.

import type { Framework } from "./types";

export const FRAMEWORKS: Framework[] = [
  {
    id: 1,
    module: 1,
    name: "Cyber Kill Chain (Lockheed Martin)",
    kind: "killchain",
    summary:
      "Modela un ataque dirigido en 7 fases secuenciales. Romper cualquier eslabón detiene el ataque — por eso cada fase tiene defensas asociadas.",
    phases: [
      { n: 1, name: "Reconocimiento", desc: "El atacante investiga al objetivo: OSINT, correos, tecnologías, empleados.", defenses: ["Reducir exposición pública", "Monitoreo de marca/OSINT", "Concienciación del personal"] },
      { n: 2, name: "Armamentización", desc: "Crea el arma: un exploit acoplado a un payload (ej. PDF con macro maliciosa).", defenses: ["Threat intelligence", "Análisis de malware", "Detección basada en TTP"] },
      { n: 3, name: "Entrega", desc: "Envía el arma: phishing, USB, web comprometida, servicio expuesto.", defenses: ["Filtrado de correo", "Proxy web", "Bloqueo de USB"] },
      { n: 4, name: "Explotación", desc: "El exploit se ejecuta y aprovecha la vulnerabilidad en el objetivo.", defenses: ["Parcheo", "EDR", "Hardening", "ASLR/DEP"] },
      { n: 5, name: "Instalación", desc: "Instala persistencia: backdoor, tarea programada, servicio.", defenses: ["EDR", "Listas blancas de apps", "Monitoreo de integridad"] },
      { n: 6, name: "Comando y Control (C2)", desc: "El malware llama a casa para recibir órdenes del atacante.", defenses: ["Filtrado DNS", "Detección de C2/beaconing", "Segmentación de red"] },
      { n: 7, name: "Acciones sobre objetivos", desc: "Cumple su meta: exfiltración, cifrado, destrucción, movimiento lateral.", defenses: ["DLP", "Microsegmentación", "Detección de anomalías", "Backups"] },
    ],
  },
  {
    id: 2,
    module: 3,
    name: "MITRE ATT&CK — Tácticas",
    kind: "attack",
    summary:
      "Las tácticas son el *porqué* de cada paso de un adversario (sus objetivos). Cada táctica agrupa muchas técnicas concretas observadas en ataques reales.",
    phases: [
      { n: 1, name: "Acceso inicial", desc: "Conseguir el primer punto de entrada en la red.", defenses: ["Anti-phishing", "MFA", "Parcheo de servicios expuestos"] },
      { n: 2, name: "Ejecución", desc: "Correr código malicioso en el sistema comprometido.", defenses: ["EDR", "Listas blancas", "Bloqueo de scripts"] },
      { n: 3, name: "Persistencia", desc: "Mantener el acceso pese a reinicios o cambios de credenciales.", defenses: ["Monitoreo de autostart", "Auditoría de tareas/servicios"] },
      { n: 4, name: "Escalada de privilegios", desc: "Obtener permisos más altos (admin/SYSTEM/root).", defenses: ["Mínimo privilegio", "Parcheo", "LAPS"] },
      { n: 5, name: "Evasión de defensas", desc: "Evitar ser detectado (borrar logs, deshabilitar AV).", defenses: ["Logs centralizados e inmutables", "Tamper protection del EDR"] },
      { n: 6, name: "Acceso a credenciales", desc: "Robar contraseñas, hashes o tokens.", defenses: ["Credential Guard", "Detección de Mimikatz", "MFA"] },
      { n: 7, name: "Movimiento lateral", desc: "Desplazarse a otros sistemas de la red.", defenses: ["Microsegmentación", "Detección de uso anómalo de cuentas"] },
      { n: 8, name: "Exfiltración / Impacto", desc: "Robar datos o causar daño (cifrado, destrucción).", defenses: ["DLP", "Detección de anomalías de salida", "Backups offline"] },
    ],
  },
  {
    id: 3,
    module: 4,
    name: "NIST CSF 2.0 — Funciones",
    kind: "controls",
    summary:
      "Las 6 funciones del NIST CSF organizan un programa de seguridad completo, desde el gobierno hasta la recuperación. No son secuenciales: operan de forma continua.",
    phases: [
      { n: 1, name: "Govern (Gobernar)", desc: "Estrategia, roles, políticas y gestión del riesgo a nivel organizacional.", defenses: ["Política de seguridad", "Gestión de riesgos", "Roles y responsabilidades"] },
      { n: 2, name: "Identify (Identificar)", desc: "Conocer activos, datos, proveedores y riesgos.", defenses: ["Inventario de activos", "Evaluación de riesgos", "Gestión de la cadena de suministro"] },
      { n: 3, name: "Protect (Proteger)", desc: "Implementar salvaguardas para limitar el impacto.", defenses: ["Control de acceso (MFA)", "Cifrado", "Hardening", "Formación"] },
      { n: 4, name: "Detect (Detectar)", desc: "Descubrir eventos y anomalías de seguridad.", defenses: ["SIEM", "EDR", "Monitoreo continuo"] },
      { n: 5, name: "Respond (Responder)", desc: "Actuar ante un incidente detectado para contenerlo.", defenses: ["Plan de respuesta a incidentes", "Contención", "Comunicación"] },
      { n: 6, name: "Recover (Recuperar)", desc: "Restaurar capacidades y aprender del incidente.", defenses: ["Backups y DR", "Lecciones aprendidas", "Plan de continuidad"] },
    ],
  },
];

export function frameworksByModule(moduleId: number): Framework[] {
  return FRAMEWORKS.filter((f) => f.module === moduleId);
}
