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

  // ── M5 · Redes: Modelo OSI ───────────────────────────────────────────────
  {
    id: 80,
    module: 5,
    term: "Modelo OSI",
    short: "Modelo de referencia que divide la comunicación de red en 7 capas independientes.",
    detail:
      "El **modelo OSI** (*Open Systems Interconnection*) estandariza cómo viajan los datos en **7 capas**, de abajo (física) hacia arriba (aplicación). Cada capa presta un servicio a la superior y se apoya en la inferior, de forma que un problema o ataque se puede aislar por capa.\n" +
      "> 💡 Mnemotecnia (de capa 1 a 7): **F**ísica · **E**nlace · **R**ed · **T**ransporte · **S**esión · **P**resentación · **A**plicación.",
    examples: [
      "Un cable y voltajes son capa 1 (física); una IP es capa 3 (red).",
      "Aislar un fallo: si hace ping (capa 3) pero no carga la web (capa 7), el problema es de capa superior.",
    ],
    related: ["Encapsulamiento", "TCP/IP", "Ataques por capa"],
  },
  {
    id: 81,
    module: 5,
    term: "Encapsulamiento y PDU",
    short: "Proceso por el que cada capa envuelve los datos con su propia cabecera.",
    detail:
      "Al bajar por la pila, cada capa añade su **cabecera** (y a veces cola) a los datos: esto es el **encapsulamiento**. La unidad de datos resultante (**PDU**) cambia de nombre por capa:\n" +
      "| Capa | PDU | Direccionamiento |\n" +
      "|---|---|---|\n" +
      "| Aplicación (7) | Datos | — |\n" +
      "| Transporte (4) | Segmento (TCP) / Datagrama (UDP) | Puerto |\n" +
      "| Red (3) | Paquete | Dirección IP |\n" +
      "| Enlace (2) | Trama | Dirección MAC |\n" +
      "El receptor hace el proceso inverso (**desencapsulamiento**).",
    examples: [
      "Una petición HTTP se vuelve segmento TCP → paquete IP → trama Ethernet.",
      "El switch lee la trama (MAC); el router lee el paquete (IP).",
    ],
    related: ["Modelo OSI", "Dirección IPv4 vs IPv6", "TCP vs UDP"],
  },
  {
    id: 82,
    module: 5,
    term: "Ataques por capa OSI",
    short: "Cada capa tiene amenazas características; pensar por capa ayuda a defender.",
    detail:
      "Mapear ataques al modelo OSI orienta las defensas:\n" +
      "| Capa | Ataque típico | Defensa |\n" +
      "|---|---|---|\n" +
      "| 2 Enlace | ARP spoofing, MAC flooding | Dynamic ARP Inspection, port security |\n" +
      "| 3 Red | IP spoofing, DDoS | Filtrado, anti-DDoS |\n" +
      "| 4 Transporte | SYN flood, escaneo de puertos | SYN cookies, firewall |\n" +
      "| 7 Aplicación | SQLi, XSS, phishing | WAF, validación, formación |\n" +
      "> ⚠️ La mayoría de los ataques modernos golpean la **capa 7** (aplicación), la más expuesta.",
    examples: [
      "Un ARP spoofing (capa 2) permite un MITM en la red local.",
      "Un SYN flood (capa 4) agota la tabla de conexiones del servidor.",
    ],
    related: ["Modelo OSI", "DDoS", "MITM"],
  },
  {
    id: 83,
    module: 5,
    term: "Capa de enlace vs capa de red",
    short: "La capa 2 mueve tramas en la red local (MAC); la capa 3 enruta paquetes entre redes (IP).",
    detail:
      "La **capa 2 (enlace)** entrega tramas dentro del **mismo segmento** usando **direcciones MAC** (físicas, del fabricante) y la maneja el **switch**. La **capa 3 (red)** lleva paquetes **entre redes distintas** usando **direcciones IP** (lógicas) y la maneja el **router**.",
    examples: [
      "Dos PCs del mismo WiFi se hablan por MAC (capa 2).",
      "Para salir a Internet, el router enruta por IP (capa 3).",
    ],
    related: ["Encapsulamiento", "Dirección IPv4 vs IPv6", "Modelo OSI"],
  },

  // ── M6 · TCP/IP y Protocolos ─────────────────────────────────────────────
  {
    id: 90,
    module: 6,
    term: "TCP vs UDP",
    short: "TCP es fiable y orientado a conexión; UDP es rápido y sin conexión.",
    detail:
      "Son los dos protocolos de **transporte** (capa 4). La elección es un trade-off **fiabilidad vs velocidad**:\n" +
      "| | TCP | UDP |\n" +
      "|---|---|---|\n" +
      "| Conexión | Sí (handshake) | No |\n" +
      "| Fiabilidad | Garantiza entrega y orden | Sin garantías |\n" +
      "| Velocidad | Mayor overhead | Más rápido y ligero |\n" +
      "| Usos | Web, SSH, correo | DNS, VoIP, streaming, juegos |",
    examples: [
      "Descargar un archivo usa TCP (no puede faltar un byte).",
      "Una videollamada usa UDP (mejor perder un frame que esperar).",
    ],
    related: ["Three-way handshake", "Puertos y sockets", "DNS"],
  },
  {
    id: 91,
    module: 6,
    term: "Three-way handshake",
    short: "El saludo de 3 pasos con que TCP establece una conexión: SYN, SYN-ACK, ACK.",
    detail:
      "Antes de enviar datos, TCP sincroniza ambos extremos en **3 pasos**:\n" +
      "• **SYN** — el cliente propone conexión y un número de secuencia inicial.\n" +
      "• **SYN-ACK** — el servidor acepta y responde con el suyo.\n" +
      "• **ACK** — el cliente confirma; la conexión queda establecida.\n" +
      "> ⚠️ Un **SYN flood** abusa de este proceso: envía miles de SYN sin completar el ACK para agotar los recursos del servidor.",
    examples: [
      "Cada conexión HTTPS empieza con un three-way handshake.",
      "nmap puede dejar handshakes a medias (SYN scan) para escanear con sigilo.",
    ],
    related: ["TCP vs UDP", "Puertos y sockets", "Ataques por capa OSI"],
  },
  {
    id: 92,
    module: 6,
    term: "Puertos y sockets",
    short: "El puerto identifica un servicio dentro de un host; IP + puerto forman un socket.",
    detail:
      "Un **puerto** (0-65535) indica a qué **servicio** va el tráfico dentro de una máquina. La combinación **IP:puerto** es un **socket**. Se agrupan en:\n" +
      "| Rango | Tipo | Ejemplos |\n" +
      "|---|---|---|\n" +
      "| 0-1023 | Bien conocidos | 80 HTTP, 443 HTTPS, 22 SSH, 53 DNS |\n" +
      "| 1024-49151 | Registrados | 3306 MySQL, 3389 RDP |\n" +
      "| 49152-65535 | Dinámicos | puertos efímeros del cliente |\n" +
      "> 💡 Conocer los **puertos esenciales** acelera el reconocimiento y el triage de un escaneo.",
    examples: [
      "192.168.1.10:443 es el socket de un servidor web HTTPS.",
      "Ver el puerto 3389 abierto sugiere RDP expuesto (riesgo).",
    ],
    related: ["TCP vs UDP", "DNS", "Three-way handshake"],
  },
  {
    id: 93,
    module: 6,
    term: "DNS",
    short: "La 'agenda de Internet': traduce nombres de dominio a direcciones IP.",
    detail:
      "El **DNS** (*Domain Name System*) resuelve `alphalog.io` → `IP`. La resolución es jerárquica: **resolver → raíz → TLD (.io) → servidor autoritativo**, con caché en cada paso. Suele ir sobre **UDP/53** (TCP para respuestas grandes).\n" +
      "> ⚠️ Vectores comunes: **DNS spoofing/cache poisoning** (respuestas falsas), **DNS tunneling** (exfiltrar datos) y **DDoS de amplificación**. Mitigaciones: **DNSSEC**, **DoH/DoT**.",
    examples: [
      "Escribir una web dispara una consulta DNS antes del handshake TCP.",
      "Malware usando DNS tunneling para sacar datos evitando el firewall.",
    ],
    related: ["Puertos y sockets", "TCP vs UDP", "Vector de ataque"],
  },
  {
    id: 94,
    module: 6,
    term: "Modelo TCP/IP",
    short: "El modelo práctico de Internet: 4 capas que condensan las 7 del OSI.",
    detail:
      "El **modelo TCP/IP** es el que realmente usa Internet. Sus **4 capas** mapean al OSI:\n" +
      "| TCP/IP | OSI equivalente | Ejemplos |\n" +
      "|---|---|---|\n" +
      "| Aplicación | 5-6-7 | HTTP, DNS, SSH |\n" +
      "| Transporte | 4 | TCP, UDP |\n" +
      "| Internet | 3 | IP, ICMP |\n" +
      "| Acceso a red | 1-2 | Ethernet, WiFi |",
    examples: [
      "El OSI es teórico/didáctico; el TCP/IP es el operativo.",
      "HTTPS = capa aplicación sobre TCP (transporte) sobre IP (internet).",
    ],
    related: ["Modelo OSI", "TCP vs UDP", "DNS"],
  },

  // ── M7 · Direccionamiento IP y Subnetting ────────────────────────────────
  {
    id: 100,
    module: 7,
    term: "Dirección IPv4 vs IPv6",
    short: "IPv4 usa 32 bits (~4.300 millones); IPv6 usa 128 bits (prácticamente infinitas).",
    detail:
      "Una **dirección IP** identifica un host en la red. **IPv4** son 32 bits en 4 octetos decimales (`192.168.1.1`); su agotamiento motivó **IPv6**, de 128 bits en hexadecimal (`2001:db8::1`). IPv6 elimina la necesidad de NAT por su enorme espacio.",
    examples: [
      "IPv4: 192.168.1.20 — IPv6: fe80::1ff:fe23:4567:890a.",
      "IPv4 se agotó; los ISP migran gradualmente a IPv6.",
    ],
    related: ["IP privada vs pública", "Subnetting y CIDR", "NAT/PAT"],
  },
  {
    id: 101,
    module: 7,
    term: "IP privada vs pública",
    short: "Las privadas viven dentro de la LAN; las públicas son enrutables en Internet.",
    detail:
      "Las **IP privadas** (RFC 1918) no se enrutan en Internet y se reutilizan en cada red local; las **públicas** son únicas y visibles. El **NAT** traduce entre ambas.\n" +
      "| Rango privado | Tamaño |\n" +
      "|---|---|\n" +
      "| 10.0.0.0/8 | ~16,7 M |\n" +
      "| 172.16.0.0/12 | ~1 M |\n" +
      "| 192.168.0.0/16 | ~65 K |",
    examples: [
      "Tu PC en casa: privada 192.168.1.x; tu router muestra una pública al ISP.",
      "Muchos hosts privados comparten una IP pública vía NAT.",
    ],
    related: ["NAT/PAT", "Dirección IPv4 vs IPv6", "DHCP"],
  },
  {
    id: 102,
    module: 7,
    term: "Subnetting y CIDR",
    short: "Dividir una red en subredes más pequeñas; CIDR expresa la máscara como /N.",
    detail:
      "El **subnetting** parte una red en **subredes** para mejorar organización, rendimiento y **seguridad** (aislar segmentos). **CIDR** (`/24`) indica cuántos bits son de red: `/24` = máscara `255.255.255.0` = 256 direcciones (254 usables).\n" +
      "> 💡 Cuanto **mayor** el número tras la `/`, **más pequeña** la subred (más bits de red, menos de host).",
    examples: [
      "192.168.1.0/24 → 254 hosts usables.",
      "Separar servidores y usuarios en subredes distintas reduce el movimiento lateral.",
    ],
    related: ["DMZ y segmentación", "IP privada vs pública", "NAT/PAT"],
  },
  {
    id: 103,
    module: 7,
    term: "NAT y PAT",
    short: "Traducen direcciones privadas a públicas; PAT multiplexa muchas IP en una usando puertos.",
    detail:
      "El **NAT** (*Network Address Translation*) reescribe la IP privada de origen por una pública al salir a Internet. El **PAT** (NAT *overload*) permite que **muchos hosts compartan una sola IP pública** distinguiéndolos por **puerto**. Es lo que usa cualquier router doméstico.",
    examples: [
      "10 dispositivos de casa navegan con una única IP pública (PAT).",
      "El NAT también oculta la topología interna (beneficio colateral de seguridad).",
    ],
    related: ["IP privada vs pública", "DHCP", "Puertos y sockets"],
  },
  {
    id: 104,
    module: 7,
    term: "DMZ y segmentación de red",
    short: "Aislar zonas de la red para que un compromiso no se propague a todo.",
    detail:
      "La **segmentación** divide la red en zonas con controles entre ellas. Una **DMZ** (*zona desmilitarizada*) es una subred intermedia donde se ubican los servicios **expuestos a Internet** (web, correo), separados de la red interna por firewalls.\n" +
      "> 💡 Si comprometen el servidor web de la DMZ, **no** tiene línea directa a la red interna sensible.",
    examples: [
      "Servidor web público en la DMZ; base de datos en la red interna.",
      "Microsegmentación + Zero Trust para limitar el movimiento lateral.",
    ],
    related: ["Subnetting y CIDR", "Defensa en profundidad", "Mínimo privilegio"],
  },

  // ── M8 · Análisis de Tráfico (Wireshark) ─────────────────────────────────
  {
    id: 110,
    module: 8,
    term: "Captura de paquetes y PCAP",
    short: "Interceptar y guardar el tráfico de red para inspeccionarlo paquete a paquete.",
    detail:
      "Capturar tráfico (*packet sniffing*) registra los paquetes que pasan por una interfaz en **modo promiscuo**. El formato estándar de guardado es **PCAP** (`.pcap`/`.pcapng`), que herramientas como **Wireshark** abren para análisis e investigación forense.",
    examples: [
      "Guardar un .pcap durante un incidente para analizarlo después.",
      "Reproducir una sesión sospechosa desde una captura.",
    ],
    related: ["Filtros de captura vs display", "tcpdump y tshark", "Detección de anomalías en tráfico"],
  },
  {
    id: 111,
    module: 8,
    term: "Filtros de captura vs display",
    short: "Los de captura deciden qué se graba; los de display, qué se muestra de lo grabado.",
    detail:
      "Wireshark distingue dos filtros con **sintaxis diferente**:\n" +
      "| Tipo | Cuándo actúa | Sintaxis | Ejemplo |\n" +
      "|---|---|---|---|\n" +
      "| Captura | Antes de grabar | BPF | `tcp port 80` |\n" +
      "| Display | Sobre lo ya grabado | Wireshark | `http.request.method == \"POST\"` |\n" +
      "> 💡 Filtra en **captura** para reducir volumen; filtra en **display** para investigar sin perder datos.",
    examples: [
      "Captura: `host 10.0.0.5` para grabar solo a ese equipo.",
      "Display: `ip.addr == 10.0.0.5 && dns` para ver su DNS.",
    ],
    related: ["Captura de paquetes y PCAP", "tcpdump y tshark", "Puertos y sockets"],
  },
  {
    id: 112,
    module: 8,
    term: "tcpdump y tshark",
    short: "Las versiones de línea de comandos para capturar y analizar tráfico sin interfaz gráfica.",
    detail:
      "Cuando no hay GUI (servidores, SSH), se usan herramientas CLI: **tcpdump** (clásica, sintaxis BPF) y **tshark** (el Wireshark de terminal). Son ideales para **capturar en remoto** y guardar un `.pcap` que luego se abre en Wireshark.",
    examples: [
      "`tcpdump -i eth0 -w captura.pcap` graba la interfaz a un archivo.",
      "`tshark -r captura.pcap -Y http` filtra HTTP de una captura.",
    ],
    related: ["Captura de paquetes y PCAP", "Filtros de captura vs display"],
  },
  {
    id: 113,
    module: 8,
    term: "Detección de anomalías en tráfico",
    short: "Reconocer patrones de ataque o exfiltración dentro del tráfico capturado.",
    detail:
      "El análisis de tráfico revela actividad maliciosa por sus **patrones**:\n" +
      "• **Escaneo de puertos** — muchos SYN a puertos distintos desde un origen.\n" +
      "• **Exfiltración** — transferencias grandes o regulares hacia una IP externa.\n" +
      "• **Beaconing C2** — conexiones periódicas idénticas a un mismo destino.\n" +
      "• **Texto en claro** — credenciales viajando sin cifrar (HTTP, FTP, Telnet).",
    examples: [
      "Detectar un nmap por la ráfaga de SYN a múltiples puertos.",
      "Ver una contraseña FTP en claro dentro de la captura.",
    ],
    related: ["Captura de paquetes y PCAP", "IoC (Indicador de Compromiso)", "Ataques por capa OSI"],
  },

  // ── M9 · Seguridad WiFi ──────────────────────────────────────────────────
  {
    id: 120,
    module: 9,
    term: "Estándares de seguridad WiFi",
    short: "La evolución del cifrado inalámbrico: WEP → WPA → WPA2 → WPA3.",
    detail:
      "El cifrado WiFi mejoró por generaciones al irse rompiendo el anterior:\n" +
      "| Estándar | Cifrado | Estado |\n" +
      "|---|---|---|\n" +
      "| WEP | RC4 | Roto (inseguro) |\n" +
      "| WPA | TKIP | Obsoleto |\n" +
      "| WPA2 | AES-CCMP | Estándar actual (vulnerable a KRACK) |\n" +
      "| WPA3 | AES + SAE | Recomendado |\n" +
      "> ⚠️ **WEP** se rompe en minutos: nunca usarlo. **WPA3** mitiga el cracking offline del handshake con **SAE** (*Dragonfly*).",
    examples: [
      "Una red WEP puede crackearse capturando suficientes IV.",
      "WPA3 protege incluso con contraseñas débiles gracias a SAE.",
    ],
    related: ["Cracking del handshake WPA2-PSK", "802.1X / WPA2-Enterprise", "Evil Twin y Rogue AP"],
  },
  {
    id: 121,
    module: 9,
    term: "Evil Twin y Rogue AP",
    short: "Un punto de acceso falso que suplanta a uno legítimo para interceptar a las víctimas.",
    detail:
      "Un **Rogue AP** es un punto de acceso no autorizado en la red. El **Evil Twin** es su variante de ingeniería social: **clona el SSID** de una red de confianza (mismo nombre, señal más fuerte) para que las víctimas se conecten y poder hacer **MITM** o robar credenciales con un portal cautivo falso.",
    examples: [
      "Un AP 'WiFi_Cafe_Gratis' clonado en una cafetería captura el tráfico.",
      "Portal cautivo falso que pide la contraseña del correo.",
    ],
    related: ["Ataque de deautenticación", "MITM", "Estándares de seguridad WiFi"],
  },
  {
    id: 122,
    module: 9,
    term: "Ataque de deautenticación",
    short: "Forzar la desconexión de clientes WiFi enviando tramas de deauth falsificadas.",
    detail:
      "Las tramas de gestión **deauth** de 802.11 no están autenticadas (salvo con 802.11w/PMF), así que un atacante puede **expulsar** a un cliente de su red. Se usa para forzar una **reconexión** (y capturar el handshake WPA2) o para empujar a la víctima hacia un **Evil Twin**.\n" +
      "> ⚠️ Mitigación: habilitar **802.11w (PMF, Protected Management Frames)**, obligatorio en WPA3.",
    examples: [
      "Lanzar deauth para capturar el 4-way handshake y crackearlo offline.",
      "Echar a un cliente de la red real para que caiga en el AP falso.",
    ],
    related: ["Evil Twin y Rogue AP", "Cracking del handshake WPA2-PSK", "Estándares de seguridad WiFi"],
  },
  {
    id: 123,
    module: 9,
    term: "Cracking del handshake WPA2-PSK",
    short: "Capturar el 4-way handshake y atacarlo offline por diccionario/fuerza bruta.",
    detail:
      "En WPA2-Personal, la contraseña no viaja por el aire, pero el **4-way handshake** que se intercambia al conectar **deriva** de ella. Capturándolo (a menudo tras un deauth) se ataca **offline** probando contraseñas con `hashcat`/`aircrack-ng`. Por eso la **longitud y aleatoriedad** de la PSK es crítica.\n" +
      "> 💡 WPA3 frustra este ataque: su handshake **SAE** no permite el crackeo offline del material capturado.",
    examples: [
      "Capturar el handshake con airodump-ng y crackearlo con un diccionario.",
      "Una passphrase larga y aleatoria hace inviable el ataque por diccionario.",
    ],
    related: ["Ataque de deautenticación", "Estándares de seguridad WiFi", "Exploit y Payload"],
  },
  {
    id: 124,
    module: 9,
    term: "802.1X / WPA2-Enterprise",
    short: "Autenticación WiFi por usuario (no por contraseña compartida) mediante un servidor RADIUS.",
    detail:
      "**WPA2/WPA3-Enterprise** usa **802.1X**: cada usuario se autentica con **credenciales o certificados** propios contra un servidor **RADIUS** (vía EAP), en vez de una **PSK** compartida. Elimina el riesgo de la contraseña única y permite **revocar accesos** individualmente.",
    examples: [
      "El WiFi corporativo donde inicias sesión con tu usuario de dominio.",
      "Revocar el acceso de un empleado sin cambiar la clave de todos.",
    ],
    related: ["Estándares de seguridad WiFi", "AAA (Autenticación, Autorización, Accounting)", "Mínimo privilegio"],
  },

  // ── M10 · Linux: Fundamentos ─────────────────────────────────────────────
  {
    id: 130,
    module: 10,
    term: "Jerarquía del sistema de archivos (FHS)",
    short: "Linux organiza todo bajo una única raíz '/', con directorios estándar por función.",
    detail:
      "El **FHS** (*Filesystem Hierarchy Standard*) define dónde vive cada cosa. No hay 'unidades C:'; todo cuelga de **`/`**:\n" +
      "| Ruta | Contenido |\n" +
      "|---|---|\n" +
      "| /etc | Configuración del sistema |\n" +
      "| /home | Carpetas de los usuarios |\n" +
      "| /var | Datos variables (logs en /var/log) |\n" +
      "| /bin /usr/bin | Binarios/ejecutables |\n" +
      "| /tmp | Temporales |\n" +
      "> 💡 Los logs de seguridad suelen estar en **/var/log** (`auth.log`, `syslog`).",
    examples: [
      "cat /etc/passwd lista las cuentas del sistema.",
      "tail -f /var/log/auth.log sigue los intentos de login en vivo.",
    ],
    related: ["La shell", "Permisos rwx", "Streams y redirección"],
  },
  {
    id: 131,
    module: 10,
    term: "La shell",
    short: "El intérprete de comandos que traduce lo que escribes en acciones del sistema.",
    detail:
      "La **shell** (normalmente **Bash**) es el programa que lee tus comandos y los ejecuta. Es la interfaz central del trabajo en seguridad: rápida, scriptable y presente en cualquier servidor. El **prompt** (`$` usuario normal, `#` root) indica con qué privilegios operas.\n" +
      "> ⚠️ Un `#` significa que eres **root**: máximo cuidado, cualquier error es total.",
    examples: [
      "whoami muestra tu usuario actual.",
      "which bash revela la ruta del intérprete en uso.",
    ],
    related: ["Jerarquía del sistema de archivos (FHS)", "Streams y redirección", "Shebang y ejecución"],
  },
  {
    id: 132,
    module: 10,
    term: "Todo es un archivo",
    short: "En Linux, dispositivos, procesos y conexiones se representan como archivos.",
    detail:
      "Filosofía Unix: **casi todo se maneja como un archivo**, lo que unifica las herramientas. Discos (`/dev/sda`), información de procesos (`/proc`) y dispositivos son rutas que se leen/escriben con los mismos comandos que un fichero de texto.",
    examples: [
      "cat /proc/cpuinfo muestra info del procesador como si fuera un archivo.",
      "Escribir en /dev/null descarta la salida.",
    ],
    related: ["La shell", "Streams y redirección"],
  },
  {
    id: 133,
    module: 10,
    term: "Distribuciones para seguridad",
    short: "Distros de Linux que ya traen el arsenal de herramientas de pentesting preinstalado.",
    detail:
      "Una **distro** combina el kernel Linux con un conjunto de software. Para seguridad ofensiva destacan **Kali Linux** (la referencia, mantenida por OffSec) y **Parrot OS**, que incluyen cientos de herramientas (nmap, Burp, Metasploit). Para uso diario o servidores se usan **Debian/Ubuntu**.\n" +
      "> 💡 Kali está pensada como **herramienta de trabajo**, no como SO de uso diario.",
    examples: [
      "Arrancar Kali en una VM para un laboratorio de pentest.",
      "Parrot Security como alternativa más ligera a Kali.",
    ],
    related: ["La shell", "Jerarquía del sistema de archivos (FHS)"],
  },
  {
    id: 134,
    module: 10,
    term: "Streams y redirección",
    short: "Cada comando tiene entrada (stdin), salida (stdout) y errores (stderr) redirigibles.",
    detail:
      "Los **tres flujos estándar** permiten encadenar y guardar resultados:\n" +
      "• **stdin (0)** — entrada · **stdout (1)** — salida · **stderr (2)** — errores.\n" +
      "Operadores: `>` guarda en archivo (sobrescribe), `>>` añade, `|` conecta la salida de un comando con la entrada del siguiente.\n" +
      "> 💡 El **pipe** (`|`) es la base del poder de la línea de comandos: combinar herramientas pequeñas.",
    examples: [
      "ls -la > listado.txt guarda el resultado en un archivo.",
      "cat /etc/passwd | grep root filtra solo la línea de root.",
    ],
    related: ["La shell", "El trío grep/awk/sed", "Pipes y automatización"],
  },

  // ── M11 · Bash Scripting ─────────────────────────────────────────────────
  {
    id: 140,
    module: 11,
    term: "Shebang y ejecución",
    short: "La primera línea '#!' indica qué intérprete corre el script.",
    detail:
      "Un script empieza con un **shebang** que define su intérprete, y necesita permiso de ejecución para correr como programa:\n" +
      "#!/bin/bash\n" +
      "echo \"Hola, mundo\"\n" +
      "Luego se le da permiso y se ejecuta:\n" +
      "chmod +x script.sh\n" +
      "./script.sh",
    examples: [
      "#!/bin/bash al inicio fuerza el uso de Bash.",
      "chmod +x recon.sh && ./recon.sh ejecuta el script.",
    ],
    related: ["Variables y argumentos", "La shell", "Permisos rwx"],
  },
  {
    id: 141,
    module: 11,
    term: "Variables y argumentos",
    short: "Guardan datos y reciben parámetros de entrada del usuario o de otro proceso.",
    detail:
      "Las **variables** almacenan valores (`nombre=\"valor\"`, se leen con `$nombre`). Los **argumentos** posicionales que recibe el script son `$1`, `$2`, … y `$@` (todos):\n" +
      "objetivo=$1\n" +
      "echo \"Escaneando $objetivo\"\n" +
      "> 💡 Sin comillas, los espacios rompen los valores: **entrecomilla siempre** las variables (`\"$var\"`).",
    examples: [
      "host=$1 toma el primer argumento de la línea de comandos.",
      "echo \"Hay $# argumentos\" cuenta los parámetros recibidos.",
    ],
    related: ["Shebang y ejecución", "Condicionales y loops"],
  },
  {
    id: 142,
    module: 11,
    term: "Condicionales y loops",
    short: "Dan lógica al script: decidir (if) y repetir (for/while).",
    detail:
      "Permiten automatizar tareas repetitivas, como iterar sobre una lista de hosts o puertos:\n" +
      "for ip in $(cat hosts.txt); do\n" +
      "  ping -c1 $ip\n" +
      "done\n" +
      "Los condicionales evalúan con `[ ... ]`: existencia de archivos, comparaciones, códigos de salida.",
    examples: [
      "Un for que recorre IPs de un archivo y las pinguea.",
      "if [ -f archivo ]; then ... comprueba si un archivo existe.",
    ],
    related: ["Variables y argumentos", "Pipes y automatización"],
  },
  {
    id: 143,
    module: 11,
    term: "El trío grep / awk / sed",
    short: "Las tres herramientas clásicas para buscar, extraer y transformar texto.",
    detail:
      "Procesar texto (logs, salidas, listas) es el 80% del scripting de seguridad:\n" +
      "| Herramienta | Hace |\n" +
      "|---|---|\n" +
      "| grep | Busca/filtra líneas por patrón |\n" +
      "| awk | Extrae columnas y procesa campos |\n" +
      "| sed | Edita/sustituye texto en flujo |\n" +
      "Combinadas con pipes son extremadamente potentes.",
    examples: [
      "grep \"Failed password\" auth.log | awk '{print $11}' extrae IPs de logins fallidos.",
      "sed 's/http/https/g' redirecciona en un archivo.",
    ],
    related: ["Streams y redirección", "Pipes y automatización"],
  },
  {
    id: 144,
    module: 11,
    term: "Pipes y automatización",
    short: "Encadenar comandos para construir auditorías y herramientas reproducibles.",
    detail:
      "El **pipe** (`|`) conecta herramientas simples en flujos potentes; combinado con scripts permite **automatizar auditorías** (escaneos, parseo de resultados, reportes). La meta: convertir un proceso manual en un comando repetible.",
    examples: [
      "cat ips.txt | while read ip; do nmap -sV $ip; done escanea una lista.",
      "Un script que corre nmap, filtra puertos abiertos y genera un informe.",
    ],
    related: ["El trío grep / awk / sed", "Condicionales y loops", "Streams y redirección"],
  },

  // ── M12 · Linux: Permisos y Hardening ────────────────────────────────────
  {
    id: 150,
    module: 12,
    term: "Permisos rwx",
    short: "Cada archivo tiene permisos de lectura/escritura/ejecución para dueño, grupo y otros.",
    detail:
      "Los permisos se aplican a tres clases (**usuario / grupo / otros**) y tres acciones (**r**ead, **w**rite, e**x**ecute). Se expresan en octal:\n" +
      "| Octal | Permiso | Significado |\n" +
      "|---|---|---|\n" +
      "| 4 | r-- | Lectura |\n" +
      "| 6 | rw- | Lectura + escritura |\n" +
      "| 7 | rwx | Todo |\n" +
      "Se cambian con chmod:\n" +
      "chmod 750 script.sh\n" +
      "> ⚠️ `chmod 777` (todos pueden todo) es una mala práctica clásica de seguridad.",
    examples: [
      "ls -l muestra los permisos como -rwxr-x---.",
      "chmod u+x da permiso de ejecución solo al dueño.",
    ],
    related: ["Propietario y grupo", "Bits especiales SUID/SGID", "Hardening y CIS Benchmarks"],
  },
  {
    id: 151,
    module: 12,
    term: "Propietario y grupo",
    short: "Todo archivo pertenece a un usuario y a un grupo, que determinan qué permisos aplican.",
    detail:
      "Cada archivo tiene un **dueño** y un **grupo**. `chown` cambia el propietario y `chgrp`/`chown :grupo` el grupo. El modelo de grupos permite dar acceso a varios usuarios sin abrir el archivo a 'otros'.\n" +
      "chown root:admins config.conf",
    examples: [
      "chown www-data:www-data /var/www asigna los archivos al usuario del servidor web.",
      "Un grupo 'devs' con acceso compartido a un directorio de proyecto.",
    ],
    related: ["Permisos rwx", "Gestión de usuarios y sudo"],
  },
  {
    id: 152,
    module: 12,
    term: "Bits especiales SUID/SGID/sticky",
    short: "Permisos avanzados que cambian con qué identidad se ejecuta un binario o cómo se comparte un directorio.",
    detail:
      "Tres bits especiales con gran impacto en seguridad:\n" +
      "• **SUID** — el binario corre con los permisos de su **dueño** (no del que lo lanza). Si es root, es vía clásica de **escalada de privilegios**.\n" +
      "• **SGID** — corre con el grupo del archivo / hereda grupo en directorios.\n" +
      "• **Sticky bit** — en /tmp, solo el dueño puede borrar sus archivos.\n" +
      "> ⚠️ Buscar binarios SUID es de lo primero que hace un atacante:\n" +
      "find / -perm -4000 2>/dev/null",
    examples: [
      "passwd es SUID root para poder modificar /etc/shadow.",
      "Un SUID mal configurado permite obtener una shell de root.",
    ],
    related: ["Permisos rwx", "Gestión de usuarios y sudo", "Hardening y CIS Benchmarks"],
  },
  {
    id: 153,
    module: 12,
    term: "Gestión de usuarios y sudo",
    short: "sudo concede privilegios elevados puntuales sin compartir la contraseña de root.",
    detail:
      "En vez de iniciar sesión como root, los usuarios usan **sudo** para ejecutar comandos concretos con privilegios, dejando **traza auditable** (`/var/log/auth.log`). La config vive en `/etc/sudoers` (editar con `visudo`).\n" +
      "> ⚠️ Reglas sudo demasiado amplias (`ALL=(ALL) NOPASSWD: ALL`) son un riesgo de escalada.",
    examples: [
      "sudo apt update ejecuta solo ese comando como root.",
      "sudo -l lista qué te permite ejecutar sudo (recon de privesc).",
    ],
    related: ["Bits especiales SUID/SGID", "Permisos rwx", "Mínimo privilegio"],
  },
  {
    id: 154,
    module: 12,
    term: "Hardening y CIS Benchmarks",
    short: "Endurecer un sistema reduciendo su superficie y siguiendo guías de configuración segura.",
    detail:
      "El **hardening** elimina lo innecesario y aplica configuración segura: cerrar servicios, deshabilitar root por SSH, actualizar, mínimo privilegio. Los **CIS Benchmarks** son guías consensuadas y verificables por sistema (Linux, Windows, cloud). **SELinux/AppArmor** añaden control de acceso obligatorio (MAC).",
    examples: [
      "Deshabilitar PermitRootLogin en sshd_config.",
      "Aplicar el CIS Benchmark de Ubuntu y auditar con Lynis.",
    ],
    related: ["Gestión de usuarios y sudo", "Bits especiales SUID/SGID", "CIS Controls"],
  },

  // ── M13 · Windows: Seguridad ─────────────────────────────────────────────
  {
    id: 160,
    module: 13,
    term: "Registro de Windows",
    short: "Base de datos jerárquica con toda la configuración del sistema y las aplicaciones.",
    detail:
      "El **Registro** guarda ajustes en árboles (*hives*). Los más relevantes:\n" +
      "| Hive | Contenido |\n" +
      "|---|---|\n" +
      "| HKLM | Configuración global del equipo |\n" +
      "| HKCU | Config del usuario actual |\n" +
      "> ⚠️ Las claves **Run** (`HKCU\\...\\Run`) son un mecanismo clásico de **persistencia** de malware.",
    examples: [
      "Revisar claves Run para detectar autostart malicioso.",
      "reg query para inspeccionar el registro desde consola.",
    ],
    related: ["Servicios y procesos", "Event Viewer y logs", "Group Policy (GPO)"],
  },
  {
    id: 161,
    module: 13,
    term: "Servicios y procesos",
    short: "Los servicios son programas en segundo plano; abusar de ellos da persistencia y privilegios.",
    detail:
      "Un **servicio** corre en background, a menudo con privilegios altos (**SYSTEM**). Los atacantes los usan para **persistencia** y **escalada**. Saber inventariar procesos/servicios es clave en respuesta a incidentes.",
    examples: [
      "tasklist y Get-Process listan los procesos en ejecución.",
      "Un servicio con ruta sin comillas explotable para escalar a SYSTEM.",
    ],
    related: ["Registro de Windows", "Event Viewer y logs"],
  },
  {
    id: 162,
    module: 13,
    term: "Event Viewer y Event IDs",
    short: "El visor de eventos centraliza los logs; ciertos Event IDs son oro para la detección.",
    detail:
      "Windows registra todo en el **Visor de eventos** (Security, System, Application). Para seguridad, algunos **Event IDs** son críticos:\n" +
      "| Event ID | Significado |\n" +
      "|---|---|\n" +
      "| 4624 | Inicio de sesión exitoso |\n" +
      "| 4625 | Inicio de sesión fallido |\n" +
      "| 4688 | Creación de proceso |\n" +
      "| 4672 | Privilegios especiales asignados |\n" +
      "> 💡 Una ráfaga de **4625** seguida de un **4624** sugiere fuerza bruta exitosa.",
    examples: [
      "Correlacionar 4625 repetidos para detectar password spraying.",
      "Get-WinEvent para consultar logs desde PowerShell.",
    ],
    related: ["Servicios y procesos", "Defender, AMSI y ETW", "Pipeline de detección en Windows"],
  },
  {
    id: 163,
    module: 13,
    term: "Group Policy (GPO)",
    short: "Mecanismo centralizado para aplicar configuración y políticas de seguridad en un dominio.",
    detail:
      "Las **GPO** (*Group Policy Objects*) permiten imponer ajustes a miles de equipos/usuarios desde Active Directory: políticas de contraseñas, restricción de software, hardening. Son la principal herramienta de administración segura en entornos Windows.",
    examples: [
      "Forzar bloqueo de pantalla y complejidad de contraseña por GPO.",
      "Deshabilitar macros de Office en toda la organización vía GPO.",
    ],
    related: ["Registro de Windows", "Active Directory: dominio, bosque y OU"],
  },
  {
    id: 164,
    module: 13,
    term: "Defender, AMSI y ETW",
    short: "La tríada de telemetría y defensa nativa de Windows que los atacantes intentan evadir.",
    detail:
      "Tres tecnologías clave de defensa:\n" +
      "• **Windows Defender** — el antivirus/EDR integrado.\n" +
      "• **AMSI** (*Antimalware Scan Interface*) — inspecciona scripts (PowerShell, macros) **en memoria**, antes de ejecutarse.\n" +
      "• **ETW** (*Event Tracing for Windows*) — telemetría profunda del SO que alimenta a los EDR.\n" +
      "> ⚠️ El **AMSI bypass** y el *patching* de ETW son técnicas ofensivas comunes; protegerlos (tamper protection) es esencial.",
    examples: [
      "AMSI bloquea un script de PowerShell malicioso ofuscado.",
      "Un EDR usa ETW para detectar inyección de procesos.",
    ],
    related: ["Event Viewer y Event IDs", "PowerShell ofensivo", "Pipeline de detección en Windows"],
  },

  // ── M14 · Active Directory ───────────────────────────────────────────────
  {
    id: 170,
    module: 14,
    term: "Active Directory: dominio, bosque y OU",
    short: "El directorio que centraliza usuarios, equipos y permisos de una red Windows.",
    detail:
      "**Active Directory (AD)** es la columna vertebral de las redes corporativas Windows. Su jerarquía:\n" +
      "• **Dominio** — unidad administrativa (usuarios, equipos).\n" +
      "• **Bosque** — conjunto de dominios que comparten esquema; el **límite de seguridad** real.\n" +
      "• **OU (Unidad Organizativa)** — contenedor para organizar y aplicar GPO.\n" +
      "El **Controlador de Dominio (DC)** es el servidor que autentica; comprometerlo es 'game over'.",
    examples: [
      "Una empresa con dominio corp.local y OUs por departamento.",
      "Comprometer el DC = control total del dominio.",
    ],
    related: ["Kerberos", "LDAP", "Ataques a Active Directory"],
  },
  {
    id: 171,
    module: 14,
    term: "Kerberos",
    short: "El protocolo de autenticación de AD basado en tickets, sin enviar la contraseña por la red.",
    detail:
      "**Kerberos** autentica mediante **tickets** emitidos por el **KDC** (en el DC). Tras validar al usuario, recibe un **TGT** (*Ticket Granting Ticket*); con él pide **TGS** para servicios concretos. La contraseña nunca viaja, pero el modelo de tickets habilita ataques específicos (Kerberoasting, Golden Ticket).\n" +
      "> 💡 Ver el diagrama 'Autenticación Kerberos' más abajo para el flujo completo.",
    examples: [
      "Al iniciar sesión en el dominio, el usuario obtiene un TGT.",
      "Un Golden Ticket falsifica TGTs si se roba la cuenta krbtgt.",
    ],
    related: ["Active Directory: dominio, bosque y OU", "Ataques a Active Directory", "LDAP"],
  },
  {
    id: 172,
    module: 14,
    term: "LDAP",
    short: "El protocolo para consultar y modificar el directorio (usuarios, grupos, equipos).",
    detail:
      "**LDAP** (*Lightweight Directory Access Protocol*) es el lenguaje de consultas de AD. Pentesters y administradores lo usan para **enumerar** el dominio: usuarios, grupos privilegiados, políticas. Herramientas como **BloodHound** abusan de LDAP para mapear rutas de ataque.",
    examples: [
      "ldapsearch para enumerar usuarios del dominio.",
      "BloodHound recolecta datos LDAP y grafica caminos a Domain Admin.",
    ],
    related: ["Active Directory: dominio, bosque y OU", "Kerberos", "Ataques a Active Directory"],
  },
  {
    id: 173,
    module: 14,
    term: "Ataques a Active Directory",
    short: "Técnicas para escalar de un usuario común a control total del dominio.",
    detail:
      "AD concentra el riesgo: comprometer el dominio da acceso a todo. Ataques emblemáticos:\n" +
      "| Ataque | Idea | Defensa |\n" +
      "|---|---|---|\n" +
      "| Kerberoasting | Crackear tickets de cuentas de servicio | Contraseñas largas, gMSA |\n" +
      "| Pass-the-Hash | Autenticarse con el hash, sin la clave | Credential Guard, LAPS |\n" +
      "| DCSync | Pedir hashes replicando como un DC | Restringir permisos de replicación |\n" +
      "| Golden Ticket | Falsificar TGTs con la clave krbtgt | Rotar krbtgt, proteger el DC |\n" +
      "> ⚠️ La mayoría se apoya en **mínimo privilegio** débil y cuentas de servicio mal gestionadas.",
    examples: [
      "Kerberoasting sobre una cuenta de servicio con contraseña débil.",
      "DCSync con Mimikatz para volcar todos los hashes del dominio.",
    ],
    related: ["Kerberos", "LDAP", "Mínimo privilegio"],
  },

  // ── M15 · PowerShell para Seguridad ──────────────────────────────────────
  {
    id: 180,
    module: 15,
    term: "Cmdlets (verbo-sustantivo)",
    short: "Los comandos de PowerShell siguen el patrón predecible Verbo-Sustantivo.",
    detail:
      "Un **cmdlet** usa la convención **Verbo-Sustantivo** (`Get-Process`, `Set-Service`, `New-Item`), lo que hace el lenguaje fácil de descubrir. `Get-Help` y `Get-Command` permiten explorar:\n" +
      "Get-Command -Verb Get\n" +
      "Get-Help Get-Process -Examples",
    examples: [
      "Get-Process lista procesos; Stop-Process los detiene.",
      "Get-Service muestra el estado de los servicios.",
    ],
    related: ["El pipeline de objetos", "PowerShell defensivo"],
  },
  {
    id: 181,
    module: 15,
    term: "El pipeline de objetos",
    short: "A diferencia de Bash (texto), PowerShell pasa objetos completos entre comandos.",
    detail:
      "El gran diferenciador: el pipe de PowerShell transporta **objetos .NET**, no texto plano. Así se filtran y ordenan por **propiedades** sin parsear cadenas:\n" +
      "Get-Process | Where-Object { $_.CPU -gt 100 } | Sort-Object CPU\n" +
      "> 💡 Esto hace el scripting más robusto que el parseo de texto con grep/awk.",
    examples: [
      "Get-Service | Where-Object Status -eq 'Running' filtra por propiedad.",
      "Ordenar procesos por uso de memoria sin tocar texto.",
    ],
    related: ["Cmdlets (verbo-sustantivo)", "PowerShell defensivo"],
  },
  {
    id: 182,
    module: 15,
    term: "PowerShell defensivo",
    short: "Auditar y endurecer el propio PowerShell con logging y modos restringidos.",
    detail:
      "PowerShell es tan potente que también es un objetivo de defensa. Controles clave:\n" +
      "• **Script Block Logging** — registra el código ejecutado (Event ID 4104).\n" +
      "• **Transcription** — guarda transcripciones de las sesiones.\n" +
      "• **Constrained Language Mode** — limita las capacidades peligrosas.\n" +
      "• **AMSI** — inspecciona scripts en memoria.\n" +
      "Juntos dan visibilidad y frenan el abuso ofensivo.",
    examples: [
      "Activar Script Block Logging por GPO para auditar todo.",
      "Revisar Event ID 4104 para ver scripts ejecutados.",
    ],
    related: ["Defender, AMSI y ETW", "El pipeline de objetos", "PowerShell ofensivo"],
  },
  {
    id: 183,
    module: 15,
    term: "PowerShell ofensivo",
    short: "El mismo poder usado por atacantes para 'vivir de la tierra' sin tocar disco.",
    detail:
      "PowerShell es ideal para *Living off the Land*: ya viene instalado y permite operar **en memoria**. Frameworks como **PowerShell Empire** dan C2; técnicas como **AMSI bypass** y **ofuscación** evaden defensas. Por eso el logging defensivo (módulo anterior) es crítico.\n" +
      "> ⚠️ Detectar abuso de PowerShell (descargas en memoria, EncodedCommand) es una señal de alerta clave.",
    examples: [
      "IEX (New-Object Net.WebClient).DownloadString(...) ejecuta código en memoria.",
      "powershell -enc <base64> oculta el comando real.",
    ],
    related: ["PowerShell defensivo", "Defender, AMSI y ETW", "Ataques a Active Directory"],
  },
];

export function definitionsByModule(moduleId: number): ConceptDefinition[] {
  return DEFINITIONS.filter((d) => d.module === moduleId);
}

export function getDefinition(id: number): ConceptDefinition | undefined {
  return DEFINITIONS.find((d) => d.id === id);
}
