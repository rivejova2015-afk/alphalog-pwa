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
  {
    id: 4,
    module: 5,
    name: "Modelo OSI — 7 capas",
    kind: "layers",
    summary:
      "Las 7 capas del modelo OSI, de la física (1) a la aplicación (7). Cada capa tiene su función, protocolos y amenazas/defensas características.",
    phases: [
      { n: 1, name: "Física", desc: "Transmite bits crudos por el medio (cables, radio, voltajes). Protocolos: Ethernet físico, fibra, RJ45.", defenses: ["Seguridad física", "Control de acceso a puertos", "Protección de cableado"] },
      { n: 2, name: "Enlace de datos", desc: "Entrega tramas en la red local por dirección MAC. Protocolos: Ethernet, ARP, switching, VLAN.", defenses: ["Port security", "Dynamic ARP Inspection", "Segmentación con VLAN"] },
      { n: 3, name: "Red", desc: "Enruta paquetes entre redes por dirección IP. Protocolos: IP, ICMP, routing.", defenses: ["Filtrado de IP", "Anti-DDoS", "ACLs de router"] },
      { n: 4, name: "Transporte", desc: "Entrega extremo a extremo por puertos. Protocolos: TCP (fiable), UDP (rápido).", defenses: ["Firewall stateful", "SYN cookies", "Rate limiting"] },
      { n: 5, name: "Sesión", desc: "Establece, mantiene y cierra sesiones entre aplicaciones.", defenses: ["Gestión segura de sesiones", "Timeouts"] },
      { n: 6, name: "Presentación", desc: "Formato, cifrado y compresión de datos. Aquí actúa TLS/SSL.", defenses: ["TLS/cifrado en tránsito", "Validación de certificados"] },
      { n: 7, name: "Aplicación", desc: "Interfaz con el usuario y los servicios. Protocolos: HTTP/S, DNS, SSH, FTP.", defenses: ["WAF", "Validación de entrada", "Autenticación (MFA)", "Formación anti-phishing"] },
    ],
  },
  {
    id: 5,
    module: 6,
    name: "Modelo TCP/IP — 4 capas",
    kind: "layers",
    summary:
      "El modelo práctico de Internet condensa el OSI en 4 capas. Cada una agrupa protocolos reales y sus controles de seguridad.",
    phases: [
      { n: 1, name: "Acceso a red", desc: "Equivale a OSI 1-2. Medio físico y enlace local. Ethernet, WiFi, ARP.", defenses: ["Port security", "Seguridad WiFi (WPA3)", "Anti-ARP spoofing"] },
      { n: 2, name: "Internet", desc: "Equivale a OSI 3. Direccionamiento y enrutamiento. IP, ICMP.", defenses: ["Filtrado/ACLs", "Anti-spoofing", "Anti-DDoS"] },
      { n: 3, name: "Transporte", desc: "Equivale a OSI 4. Entrega extremo a extremo. TCP, UDP.", defenses: ["Firewall stateful", "SYN cookies"] },
      { n: 4, name: "Aplicación", desc: "Equivale a OSI 5-6-7. Servicios y datos de usuario. HTTP/S, DNS, SSH.", defenses: ["TLS", "WAF", "DNSSEC/DoH", "Autenticación"] },
    ],
  },
  {
    id: 6,
    module: 9,
    name: "Cadena de ataque WiFi (Evil Twin)",
    kind: "flow",
    summary:
      "Secuencia típica de un ataque a una red WiFi WPA2-Personal, paso a paso, con la defensa que corta cada fase.",
    phases: [
      { n: 1, name: "Reconocimiento", desc: "El atacante escanea redes y clientes cercanos (SSID, canal, BSSID) en modo monitor.", defenses: ["Ocultar info innecesaria", "WIDS (detección de intrusos wireless)"] },
      { n: 2, name: "Deautenticación", desc: "Envía tramas deauth para expulsar a un cliente y forzar su reconexión.", defenses: ["802.11w (PMF)", "WPA3 (PMF obligatorio)"] },
      { n: 3, name: "Captura del handshake", desc: "Al reconectar, captura el 4-way handshake WPA2.", defenses: ["WPA3-SAE (sin crackeo offline)", "Passphrase larga y aleatoria"] },
      { n: 4, name: "Cracking offline", desc: "Ataca el handshake por diccionario/fuerza bruta con hashcat/aircrack-ng.", defenses: ["WPA2-Enterprise (802.1X)", "Contraseñas robustas"] },
      { n: 5, name: "Evil Twin / MITM", desc: "Levanta un AP clon del SSID para interceptar tráfico o robar credenciales con portal falso.", defenses: ["Verificar certificados/HTTPS", "Validación del servidor (EAP)", "VPN"] },
    ],
  },
  {
    id: 7,
    module: 13,
    name: "Pipeline de detección en Windows",
    kind: "flow",
    summary:
      "Cómo fluye la telemetría de seguridad de un endpoint Windows hasta convertirse en una alerta accionable. Cada etapa tiene una buena práctica.",
    phases: [
      { n: 1, name: "Event Log nativo", desc: "Windows registra logins, procesos y privilegios (Event IDs 4624/4625/4688).", defenses: ["Auditoría avanzada habilitada", "Retención adecuada de logs"] },
      { n: 2, name: "Sysmon", desc: "Telemetría enriquecida de procesos, red y cambios (creación de procesos, hashes, conexiones).", defenses: ["Config Sysmon curada (p.ej. SwiftOnSecurity)", "Cobertura de ATT&CK"] },
      { n: 3, name: "AMSI / ETW", desc: "Inspección en memoria de scripts y trazas profundas del SO que alimentan al EDR.", defenses: ["Tamper protection", "Anti-AMSI-bypass", "ScriptBlock logging"] },
      { n: 4, name: "Reenvío (WEF)", desc: "Los eventos se centralizan vía Windows Event Forwarding hacia un colector.", defenses: ["Canal seguro", "Colector redundante"] },
      { n: 5, name: "SIEM y alerta", desc: "El SIEM correlaciona, aplica reglas (Sigma) y genera alertas para el SOC.", defenses: ["Reglas mapeadas a ATT&CK", "Reducción de falsos positivos"] },
    ],
  },
  {
    id: 8,
    module: 14,
    name: "Autenticación Kerberos",
    kind: "flow",
    summary:
      "El intercambio de tickets por el que un usuario prueba su identidad en Active Directory sin enviar nunca su contraseña. Entender el flujo explica los ataques.",
    phases: [
      { n: 1, name: "AS-REQ", desc: "El cliente pide autenticación al KDC, presentando un timestamp cifrado con el hash de su contraseña.", defenses: ["Pre-autenticación obligatoria", "Contraseñas fuertes (anti AS-REP roasting)"] },
      { n: 2, name: "AS-REP (TGT)", desc: "El KDC valida y entrega el TGT (Ticket Granting Ticket), cifrado con la clave de krbtgt.", defenses: ["Proteger/rotar la cuenta krbtgt", "Monitoreo de emisión de TGT"] },
      { n: 3, name: "TGS-REQ", desc: "Con el TGT, el cliente solicita un ticket para un servicio concreto (SPN).", defenses: ["gMSA para cuentas de servicio", "Detección de peticiones masivas (Kerberoasting)"] },
      { n: 4, name: "TGS-REP", desc: "El KDC entrega el TGS, cifrado con el hash de la cuenta del servicio.", defenses: ["Cifrado AES (no RC4)", "Contraseñas largas en cuentas de servicio"] },
      { n: 5, name: "AP-REQ", desc: "El cliente presenta el TGS al servicio, que lo valida y concede acceso.", defenses: ["Mínimo privilegio en SPNs", "Auditoría de accesos"] },
    ],
  },
];

export function frameworksByModule(moduleId: number): Framework[] {
  return FRAMEWORKS.filter((f) => f.module === moduleId);
}
