// Glosario de conceptos por módulo — da contenido real a cada tópico del syllabus
// (antes solo keywords sueltas). Datos puros, sin red. Piloto: Fundamentos M1-M4.
// `detail` admite el markdown enriquecido del renderer (negritas, tablas, callouts).

import type { ConceptDefinition } from "./types";

export const DEFINITIONS: ConceptDefinition[] = [
  // ── M1 · Fundamentos de Ciberseguridad ──────────────────────────────────
  {
    id: 1,
    module: 1,
    term: "Ciberseguridad",
    short: "Práctica de proteger sistemas, redes, datos y personas frente a ataques digitales.",
    detail:
      "La **ciberseguridad** no es solo tecnología: es la combinación de **tecnología, procesos y personas** para preservar la **confidencialidad, integridad y disponibilidad** (la tríada CIA) de la información.\n" +
      "> 💡 No existe la seguridad absoluta. El objetivo es **gestionar el riesgo** a un nivel aceptable, no eliminarlo por completo.\n" +
      "Se apoya en tres pilares prácticos:\n" +
      "• **Prevención** — reducir la probabilidad de que ocurra un incidente (hardening, parches, formación).\n" +
      "• **Detección** — descubrir lo que ya pasó o está pasando (logs, SIEM, EDR).\n" +
      "• **Respuesta** — contener, erradicar y recuperarse de un incidente.",
    examples: [
      "Un firewall que filtra tráfico malicioso entrante (prevención).",
      "Un SOC que detecta un inicio de sesión imposible desde otro país (detección).",
      "Restaurar desde backups tras un ransomware (respuesta y recuperación).",
    ],
    related: ["Tríada CIA", "Gestión de riesgos", "Defensa en profundidad"],
  },
  {
    id: 2,
    module: 1,
    term: "Superficie de ataque",
    short: "Suma de todos los puntos por donde un atacante podría intentar entrar o extraer datos.",
    detail:
      "La **superficie de ataque** es el conjunto de todos los **vectores** expuestos: puertos abiertos, APIs, formularios web, empleados susceptibles a phishing, dependencias de software, dispositivos IoT, etc.\n" +
      "Se divide en tres dominios:\n" +
      "| Dominio | Ejemplos |\n" +
      "|---|---|\n" +
      "| Digital | Puertos, APIs, subdominios, credenciales filtradas |\n" +
      "| Física | Accesos, USB, equipos sin cifrar |\n" +
      "| Humana | Phishing, ingeniería social, insiders |\n" +
      "> ⚠️ Reducir la superficie de ataque (cerrar lo que no se usa) suele dar más seguridad que añadir defensas nuevas.",
    examples: [
      "Un servidor con RDP expuesto a Internet amplía la superficie digital.",
      "Un empleado que reutiliza contraseñas amplía la superficie humana.",
    ],
    related: ["Vector de ataque", "Hardening", "Mínimo privilegio"],
  },
  {
    id: 3,
    module: 1,
    term: "Vector de ataque",
    short: "Camino o método concreto que usa un atacante para comprometer un objetivo.",
    detail:
      "Un **vector de ataque** es el *cómo*: el medio específico de entrada. Los más comunes hoy son el **phishing**, la **explotación de vulnerabilidades** sin parchear, las **credenciales robadas** y la **cadena de suministro** (software de terceros comprometido).",
    examples: [
      "Correo de phishing con un adjunto malicioso.",
      "Explotar una CVE en un servicio expuesto.",
      "Inyectar código en una dependencia npm (supply chain).",
    ],
    related: ["Superficie de ataque", "Phishing", "Exploit"],
  },
  {
    id: 4,
    module: 1,
    term: "Actor de amenaza",
    short: "Persona o grupo con la intención y capacidad de causar un daño digital.",
    detail:
      "Se clasifican por **motivación** y **capacidad**:\n" +
      "• **Script kiddies** — bajo nivel, usan herramientas ajenas.\n" +
      "• **Hacktivistas** — motivados ideológicamente.\n" +
      "• **Cibercriminales** — buscan dinero (ransomware, fraude).\n" +
      "• **APT (Amenazas Persistentes Avanzadas)** — patrocinadas por estados, sigilosas y bien financiadas.\n" +
      "• **Insiders** — amenaza interna, intencional o accidental.",
    examples: [
      "Un grupo de ransomware como LockBit (cibercrimen).",
      "APT29 / Cozy Bear (estado-nación).",
      "Un empleado descontento que filtra datos (insider).",
    ],
    related: ["APT", "Insider", "TTP"],
  },
  {
    id: 5,
    module: 1,
    term: "Defensa en profundidad",
    short: "Estrategia de capas múltiples de seguridad para que ningún fallo único sea catastrófico.",
    detail:
      "La **defensa en profundidad** (*defense in depth*) asume que **cualquier control puede fallar**, así que se superponen capas: perímetro, red, host, aplicación, datos e identidad. Si una capa cae, las siguientes contienen el daño.\n" +
      "> 💡 Analogía: un castillo no confía solo en la muralla; tiene foso, muralla, torres, puertas y guardias.",
    examples: [
      "MFA + EDR + segmentación de red + backups cifrados, todo junto.",
      "Aunque caiga el firewall, el host sigue protegido por su EDR.",
    ],
    related: ["Mínimo privilegio", "Segmentación", "Zero Trust"],
  },
  {
    id: 6,
    module: 1,
    term: "OSINT",
    short: "Inteligencia de fuentes abiertas: recopilar información pública sobre un objetivo.",
    detail:
      "**OSINT** (*Open Source Intelligence*) es la fase de **reconocimiento** que usa fuentes públicas: redes sociales, registros DNS/WHOIS, filtraciones, metadatos de documentos, Shodan, GitHub. Es la primera fase del Kill Chain y la base de un buen phishing dirigido.",
    examples: [
      "Buscar subdominios y correos de una empresa antes de un pentest.",
      "Encontrar credenciales filtradas en un volcado de datos público.",
    ],
    related: ["Reconocimiento", "Cyber Kill Chain", "Vector de ataque"],
  },

  // ── M2 · Tríada CIA y Principios ─────────────────────────────────────────
  {
    id: 20,
    module: 2,
    term: "Confidencialidad",
    short: "Garantizar que la información solo sea accesible para quien está autorizado.",
    detail:
      "La **confidencialidad** evita la divulgación no autorizada. Se logra con **cifrado** (en reposo y en tránsito), **control de acceso** y **clasificación de datos**. Su opuesto es una *brecha de datos*.",
    examples: [
      "Cifrar un disco con BitLocker/LUKS.",
      "TLS protegiendo el tráfico HTTPS.",
      "Permisos que impiden que un becario lea la nómina.",
    ],
    related: ["Cifrado", "Control de acceso", "Tríada CIA"],
  },
  {
    id: 21,
    module: 2,
    term: "Integridad",
    short: "Garantizar que la información no se altere de forma no autorizada o accidental.",
    detail:
      "La **integridad** asegura que los datos son **exactos y completos**. Se verifica con **funciones hash** (SHA-256), **firmas digitales** y **checksums**. Una alteración no detectada rompe la integridad.",
    examples: [
      "Comparar el hash SHA-256 de una descarga con el publicado.",
      "Una firma digital que prueba que un documento no fue modificado.",
    ],
    related: ["Hashing", "Firma digital", "No repudio"],
  },
  {
    id: 22,
    module: 2,
    term: "Disponibilidad",
    short: "Garantizar que los sistemas y datos estén accesibles cuando se necesiten.",
    detail:
      "La **disponibilidad** se mide en *uptime* (ej. 99,9%) y se protege con **redundancia**, **backups**, **balanceo de carga** y **mitigación de DDoS**. Un ataque de denegación de servicio ataca directamente este pilar.",
    examples: [
      "Réplicas y failover automático de una base de datos.",
      "Un CDN/anti-DDoS absorbiendo un ataque volumétrico.",
    ],
    related: ["DDoS", "Redundancia", "Backups"],
  },
  {
    id: 23,
    module: 2,
    term: "AAA (Autenticación, Autorización, Accounting)",
    short: "El marco de control de acceso: quién eres, qué puedes hacer y qué hiciste.",
    detail:
      "| Pilar | Pregunta | Ejemplo |\n" +
      "|---|---|---|\n" +
      "| Autenticación | ¿Quién eres? | Contraseña + MFA |\n" +
      "| Autorización | ¿Qué puedes hacer? | Roles/permisos (RBAC) |\n" +
      "| Accounting | ¿Qué hiciste? | Logs de auditoría |\n" +
      "> 💡 Autenticar no es autorizar: identificarte no implica que tengas permiso para todo.",
    examples: [
      "Iniciar sesión con MFA (autenticación).",
      "Un rol 'editor' que puede publicar pero no borrar (autorización).",
      "Un log que registra quién accedió a qué y cuándo (accounting).",
    ],
    related: ["MFA", "Mínimo privilegio", "RBAC"],
  },
  {
    id: 24,
    module: 2,
    term: "No repudio",
    short: "Imposibilidad de negar haber realizado una acción.",
    detail:
      "El **no repudio** garantiza que el autor de una acción no pueda negarla después. Se logra con **firmas digitales** y **logs de auditoría** robustos. Es clave en transacciones legales y financieras.",
    examples: [
      "Una firma digital que vincula un contrato a una persona.",
      "Logs inmutables que prueban quién aprobó un pago.",
    ],
    related: ["Firma digital", "Integridad", "Accounting"],
  },
  {
    id: 25,
    module: 2,
    term: "Principio de mínimo privilegio",
    short: "Dar a cada usuario o proceso solo los permisos estrictamente necesarios.",
    detail:
      "El **mínimo privilegio** (*least privilege*) reduce el daño potencial de una cuenta comprometida: si un atacante roba una cuenta limitada, su alcance también es limitado. Complementa a **Zero Trust** ('nunca confíes, siempre verifica').",
    examples: [
      "Un servicio web que corre sin permisos de administrador.",
      "Acceso temporal *just-in-time* en vez de admin permanente.",
    ],
    related: ["Zero Trust", "Defensa en profundidad", "AAA"],
  },

  // ── M3 · Amenazas, Ataques y Malware ─────────────────────────────────────
  {
    id: 40,
    module: 3,
    term: "Amenaza, Vulnerabilidad y Riesgo",
    short: "Tres conceptos que se confunden: el peligro, la debilidad y la probabilidad×impacto.",
    detail:
      "| Concepto | Definición | Ejemplo |\n" +
      "|---|---|---|\n" +
      "| Amenaza | Evento potencial que causa daño | Un grupo de ransomware |\n" +
      "| Vulnerabilidad | Debilidad explotable | Servidor sin parchear |\n" +
      "| Riesgo | Probabilidad × Impacto | Alta chance de cifrado de datos |\n" +
      "> 💡 **Riesgo = Amenaza × Vulnerabilidad × Impacto.** Sin vulnerabilidad explotable, una amenaza no se materializa.",
    examples: [
      "Amenaza: actor de ransomware. Vulnerabilidad: RDP expuesto. Riesgo: cifrado de toda la red.",
    ],
    related: ["CVE", "CVSS", "Gestión de riesgos"],
  },
  {
    id: 41,
    module: 3,
    term: "Exploit y Payload",
    short: "El exploit abre la puerta (aprovecha la vulnerabilidad); el payload es lo que se ejecuta dentro.",
    detail:
      "Un **exploit** es el código o técnica que **aprovecha una vulnerabilidad** para lograr ejecución o acceso. El **payload** es la **acción posterior**: una reverse shell, un dropper de malware, exfiltración, etc.\n" +
      "> ⚠️ Una misma vulnerabilidad puede explotarse con muchos payloads distintos según el objetivo del atacante.",
    examples: [
      "Exploit: desbordamiento de búfer. Payload: reverse shell a la máquina del atacante.",
      "msfvenom genera payloads para un exploit de Metasploit.",
    ],
    related: ["Vulnerabilidad", "Zero-day", "Reverse shell"],
  },
  {
    id: 42,
    module: 3,
    term: "Zero-day",
    short: "Vulnerabilidad desconocida para el fabricante, sin parche disponible.",
    detail:
      "Un **zero-day** (día cero) es un fallo que **el proveedor aún no conoce ni ha corregido**, por lo que no hay parche. Son muy valiosos en el mercado negro y para APTs, porque las defensas basadas en firmas no los detectan.",
    examples: [
      "Log4Shell (2021) fue explotada masivamente antes de existir parche.",
      "Cadenas de zero-days usadas en spyware como Pegasus.",
    ],
    related: ["Exploit", "CVE", "APT"],
  },
  {
    id: 43,
    module: 3,
    term: "CVE y CVSS",
    short: "CVE identifica una vulnerabilidad concreta; CVSS la puntúa de 0 a 10 por severidad.",
    detail:
      "**CVE** (*Common Vulnerabilities and Exposures*) es un **identificador único** (ej. `CVE-2021-44228`). **CVSS** (*Common Vulnerability Scoring System*) le asigna una **puntuación 0-10**:\n" +
      "| Rango CVSS | Severidad |\n" +
      "|---|---|\n" +
      "| 0.1 – 3.9 | Baja |\n" +
      "| 4.0 – 6.9 | Media |\n" +
      "| 7.0 – 8.9 | Alta |\n" +
      "| 9.0 – 10.0 | Crítica |\n" +
      "Se usan para **priorizar parches**: primero lo crítico y explotable.",
    examples: [
      "CVE-2021-44228 (Log4Shell) tuvo CVSS 10.0 (crítica).",
      "Priorizar el parcheo de una CVSS 9.8 sobre una 4.2.",
    ],
    related: ["Vulnerabilidad", "Gestión de parches", "KEV"],
  },
  {
    id: 44,
    module: 3,
    term: "IoC (Indicador de Compromiso)",
    short: "Evidencia forense de que un sistema fue (o está siendo) atacado.",
    detail:
      "Un **IoC** es una pista observable de actividad maliciosa: hashes de archivos, IPs/dominios de C2, claves de registro, nombres de procesos. Alimentan reglas de detección (SIEM, YARA, Sigma).\n" +
      "> 💡 Los IoC son la base **inferior** de la *Pyramid of Pain*: fáciles de cambiar para el atacante. Los **TTP** son lo más difícil de cambiar.",
    examples: [
      "Un hash SHA-256 de un binario de malware conocido.",
      "Una IP de comando y control (C2) en una lista de bloqueo.",
    ],
    related: ["TTP", "YARA", "Threat hunting"],
  },
  {
    id: 45,
    module: 3,
    term: "TTP (Tácticas, Técnicas y Procedimientos)",
    short: "El comportamiento de un atacante: qué busca, cómo lo hace y con qué pasos.",
    detail:
      "Las **TTP** describen el *modus operandi* de un adversario y son el lenguaje de **MITRE ATT&CK**:\n" +
      "• **Táctica** — el *objetivo* (ej. Acceso inicial, Persistencia).\n" +
      "• **Técnica** — el *cómo* (ej. Spear phishing).\n" +
      "• **Procedimiento** — la *implementación concreta* de ese grupo.\n" +
      "> 💡 Detectar por TTP es mucho más robusto que por IoC: el atacante puede cambiar una IP en segundos, pero cambiar su comportamiento le cuesta mucho más.",
    examples: [
      "Táctica: Persistencia → Técnica: Scheduled Task → Procedimiento: tarea creada por APT específica.",
    ],
    related: ["MITRE ATT&CK", "IoC", "Actor de amenaza"],
  },
  {
    id: 46,
    module: 3,
    term: "Ransomware",
    short: "Malware que cifra datos y exige un rescate, hoy a menudo con doble extorsión.",
    detail:
      "El **ransomware** cifra los archivos de la víctima y pide pago (cripto) por la clave. El modelo moderno usa **doble extorsión**: además de cifrar, **exfiltran** los datos y amenazan con publicarlos. Muchos operan como **RaaS** (*Ransomware as a Service*).",
    examples: [
      "WannaCry (2017) se propagó con el exploit EternalBlue.",
      "LockBit / BlackCat operando como RaaS con afiliados.",
    ],
    related: ["Malware", "Backups", "Doble extorsión"],
  },

  // ── M4 · Frameworks y Estándares ─────────────────────────────────────────
  {
    id: 60,
    module: 4,
    term: "NIST Cybersecurity Framework (CSF)",
    short: "Marco voluntario que organiza la seguridad en funciones de alto nivel.",
    detail:
      "El **NIST CSF 2.0** estructura un programa de seguridad en **6 funciones**: **Govern, Identify, Protect, Detect, Respond, Recover**. Es agnóstico de tecnología y sirve para comunicar el estado de seguridad a la dirección.\n" +
      "> 💡 No es certificable (a diferencia de ISO 27001); es un marco de **buenas prácticas** y autoevaluación.",
    examples: [
      "Mapear los controles de la empresa a las 6 funciones del CSF.",
      "Usar el CSF para reportar madurez de seguridad al directorio.",
    ],
    related: ["ISO 27001", "CIS Controls", "Gestión de riesgos"],
  },
  {
    id: 61,
    module: 4,
    term: "ISO/IEC 27001",
    short: "Norma internacional certificable para un Sistema de Gestión de Seguridad de la Información (SGSI).",
    detail:
      "**ISO 27001** define los requisitos de un **SGSI**: un sistema de gestión basado en el ciclo **PDCA** (Planificar-Hacer-Verificar-Actuar) y en la **gestión de riesgos**. Su **Anexo A** lista controles de referencia. A diferencia del NIST CSF, **es certificable** por un auditor acreditado.",
    examples: [
      "Una empresa SaaS que se certifica ISO 27001 para ganar clientes enterprise.",
      "Declaración de Aplicabilidad (SoA) justificando qué controles aplican.",
    ],
    related: ["NIST CSF", "GRC", "Auditoría"],
  },
  {
    id: 62,
    module: 4,
    term: "CIS Controls",
    short: "Lista priorizada de 18 controles defensivos concretos y accionables.",
    detail:
      "Los **CIS Controls v8** son **18 controles** ordenados por impacto, agrupados en **Grupos de Implementación (IG1-IG3)** según el tamaño/riesgo de la organización. Son muy prácticos: dicen *qué hacer primero* (inventario de activos, gestión de vulnerabilidades, MFA, backups).",
    examples: [
      "IG1 como higiene básica para una PyME.",
      "Control 1 (inventario de activos) antes que defensas avanzadas.",
    ],
    related: ["NIST CSF", "Hardening", "Gestión de vulnerabilidades"],
  },
  {
    id: 63,
    module: 4,
    term: "MITRE ATT&CK",
    short: "Base de conocimiento global de tácticas y técnicas reales de los adversarios.",
    detail:
      "**MITRE ATT&CK** es una **matriz** que cataloga las **TTP** observadas en ataques reales, organizadas por **tácticas** (columnas, el *porqué*) y **técnicas** (celdas, el *cómo*). Es el lenguaje común entre Red Team, Blue Team y Threat Intelligence para mapear detecciones y simular adversarios.",
    examples: [
      "Mapear las alertas del SOC a técnicas ATT&CK para medir cobertura.",
      "Un Red Team emulando las TTP de un grupo APT concreto.",
    ],
    related: ["TTP", "Threat hunting", "Cyber Kill Chain"],
  },
  {
    id: 64,
    module: 4,
    term: "Gestión de riesgos",
    short: "Proceso de identificar, evaluar y tratar los riesgos de seguridad de forma priorizada.",
    detail:
      "La **gestión de riesgos** decide *dónde invertir*. Tras evaluar cada riesgo (probabilidad × impacto), se elige una **estrategia de tratamiento**:\n" +
      "• **Mitigar** — reducirlo con controles.\n" +
      "• **Transferir** — ej. contratar un ciberseguro.\n" +
      "• **Aceptar** — asumirlo si es bajo o el control cuesta más que el daño.\n" +
      "• **Evitar** — eliminar la actividad que lo genera.",
    examples: [
      "Aceptar un riesgo bajo cuyo control sería más caro que el impacto.",
      "Transferir el riesgo de fraude con un seguro cibernético.",
    ],
    related: ["Riesgo", "NIST CSF", "ISO 27001"],
  },
];

export function definitionsByModule(moduleId: number): ConceptDefinition[] {
  return DEFINITIONS.filter((d) => d.module === moduleId);
}

export function getDefinition(id: number): ConceptDefinition | undefined {
  return DEFINITIONS.find((d) => d.id === id);
}
