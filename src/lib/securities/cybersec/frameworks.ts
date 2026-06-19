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
  {
    id: 9,
    module: 18,
    name: "Cadena de confianza PKI",
    kind: "flow",
    summary:
      "Cómo el navegador decide confiar en el certificado de un sitio: la firma sube eslabón a eslabón hasta una CA raíz ya confiable.",
    phases: [
      { n: 1, name: "CA raíz", desc: "Autoridad de máxima confianza; su certificado viene preinstalado en el SO/navegador. Su clave privada se guarda offline.", defenses: ["Clave raíz en HSM offline", "Auditorías estrictas de la CA"] },
      { n: 2, name: "CA intermedia", desc: "Firmada por la raíz, emite los certificados del día a día para aislar y proteger la raíz.", defenses: ["Revocación (CRL/OCSP)", "Separación raíz/intermedia"] },
      { n: 3, name: "Certificado de servidor (leaf)", desc: "El certificado del dominio, firmado por la intermedia; contiene la clave pública del sitio.", defenses: ["Vigencia corta", "Certificate Transparency"] },
      { n: 4, name: "Validación en el cliente", desc: "El navegador verifica firmas, vigencia, revocación y que el dominio coincida, subiendo hasta la raíz.", defenses: ["Comprobar revocación", "HSTS", "Pinning donde aplique"] },
    ],
  },
  {
    id: 10,
    module: 19,
    name: "Handshake TLS 1.3",
    kind: "flow",
    summary:
      "El saludo que establece una conexión HTTPS segura en un solo viaje (1-RTT): negocia cifrado, valida identidad y deriva claves de sesión con forward secrecy.",
    phases: [
      { n: 1, name: "ClientHello", desc: "El cliente propone versiones, cipher suites y envía su parte de la clave (key share ECDHE).", defenses: ["Ofrecer solo TLS 1.2+/AEAD", "Suites con forward secrecy"] },
      { n: 2, name: "ServerHello + certificado", desc: "El servidor elige la suite, envía su key share y su certificado (cadena PKI).", defenses: ["Certificado válido y vigente", "Clave privada protegida"] },
      { n: 3, name: "Verificación del certificado", desc: "El cliente valida la cadena de confianza, el dominio, la vigencia y la revocación.", defenses: ["Validar cadena completa", "OCSP/CRL", "Certificate Transparency"] },
      { n: 4, name: "Derivación de claves", desc: "Ambos derivan la misma clave de sesión simétrica vía ECDHE, con forward secrecy.", defenses: ["Claves efímeras (ECDHE)", "Sin reutilización de nonce"] },
      { n: 5, name: "Finished y datos cifrados", desc: "Se confirma el handshake y el tráfico de aplicación viaja cifrado con AES-GCM.", defenses: ["HSTS", "Cuidado con 0-RTT (replay)"] },
    ],
  },
  {
    id: 11,
    module: 21,
    name: "OWASP Top 10 (2021)",
    kind: "controls",
    summary:
      "Las 10 categorías de riesgo web más críticas según OWASP, ordenadas por prioridad. Cada una con su idea central y su mitigación.",
    phases: [
      { n: 1, name: "A01 — Broken Access Control", desc: "Usuarios acceden a datos/acciones que no les corresponden (IDOR, escalada).", defenses: ["Autorización en servidor por petición", "Denegar por defecto", "Mínimo privilegio"] },
      { n: 2, name: "A02 — Cryptographic Failures", desc: "Datos sensibles mal protegidos: sin cifrar, TLS débil, hashes obsoletos.", defenses: ["TLS moderno", "Cifrado en reposo", "bcrypt/Argon2"] },
      { n: 3, name: "A03 — Injection", desc: "Entrada no confiable interpretada como código (SQLi, XSS, OS command).", defenses: ["Consultas parametrizadas", "Validación de entrada", "Codificación de salida"] },
      { n: 4, name: "A04 — Insecure Design", desc: "El fallo está en el diseño: faltaron controles y threat modeling.", defenses: ["Threat modeling", "Patrones seguros", "Requisitos de seguridad"] },
      { n: 5, name: "A05 — Security Misconfiguration", desc: "Defaults inseguros, errores verbosos, buckets públicos, headers ausentes.", defenses: ["Hardening (CIS)", "Headers de seguridad", "Quitar lo innecesario"] },
      { n: 6, name: "A06 — Vulnerable & Outdated Components", desc: "Dependencias con CVEs conocidas sin parchear (ej. Log4Shell).", defenses: ["Inventario/SBOM", "Escaneo SCA", "Actualización continua"] },
      { n: 7, name: "A07 — Identification & Auth Failures", desc: "Login y sesiones débiles: brute force, tokens predecibles, sin MFA.", defenses: ["MFA", "Rate limiting", "Gestión de sesión segura"] },
      { n: 8, name: "A08 — Software & Data Integrity Failures", desc: "Confiar en código/datos sin verificar integridad (cadena de suministro).", defenses: ["Firmar/verificar artefactos", "Pipeline CI/CD seguro"] },
      { n: 9, name: "A09 — Security Logging & Monitoring Failures", desc: "Sin logs ni alertas, las brechas pasan desapercibidas.", defenses: ["Logging centralizado", "Alertas", "Retención para forense"] },
      { n: 10, name: "A10 — Server-Side Request Forgery", desc: "El servidor es engañado para pedir destinos internos o metadata cloud.", defenses: ["Allowlist de destinos", "Bloquear IPs internas/metadata", "IMDSv2"] },
    ],
  },
  {
    id: 12,
    module: 24,
    name: "Anatomía de un ataque SSRF a la nube",
    kind: "flow",
    summary:
      "Cómo un SSRF escala a robo de credenciales en la nube — el patrón del caso Capital One (2019). Cada paso tiene su defensa.",
    phases: [
      { n: 1, name: "Parámetro con URL", desc: "El atacante encuentra una función que pide una URL provista por el usuario (webhook, importador, miniaturas).", defenses: ["Validar/normalizar URLs", "No aceptar URLs arbitrarias"] },
      { n: 2, name: "Apuntar al interior", desc: "Cambia la URL hacia servicios internos o el endpoint de metadata 169.254.169.254.", defenses: ["Allowlist de destinos", "Bloquear rango link-local/privado"] },
      { n: 3, name: "Leer metadata IAM", desc: "El servidor consulta el endpoint y devuelve credenciales IAM temporales.", defenses: ["IMDSv2 (token obligatorio)", "Rol IAM de mínimo privilegio"] },
      { n: 4, name: "Usar las credenciales", desc: "Con las claves robadas, el atacante accede a recursos cloud (buckets, bases de datos).", defenses: ["Permisos mínimos del rol", "Detección de uso anómalo de credenciales"] },
      { n: 5, name: "Exfiltración", desc: "Descarga datos sensibles desde el almacenamiento accesible.", defenses: ["Cifrado + políticas de acceso", "Alertas de egress", "Logging (CloudTrail)"] },
    ],
  },
  {
    id: 13,
    module: 25,
    name: "Metodología de un pentest",
    kind: "flow",
    summary:
      "Las fases estándar de un test de intrusión, de la recolección de información al reporte. Cada fase mapea a un módulo de esta categoría y tiene su contramedida defensiva.",
    phases: [
      { n: 1, name: "Reconocimiento", desc: "Recolectar información del objetivo (OSINT, dorking, Shodan) de forma pasiva y activa.", defenses: ["Reducir exposición pública", "Monitoreo de marca/OSINT"] },
      { n: 2, name: "Escaneo", desc: "Descubrir hosts, puertos y servicios vivos con Nmap.", defenses: ["Firewall + IDS", "Reducir superficie expuesta"] },
      { n: 3, name: "Enumeración", desc: "Sonsacar detalles de cada servicio (usuarios, shares, versiones).", defenses: ["Cerrar null sessions", "Restringir AXFR/SNMP"] },
      { n: 4, name: "Análisis de vulnerabilidades", desc: "Identificar y priorizar fallos explotables (escáneres + validación).", defenses: ["Gestión de parches", "Hardening (CIS)"] },
      { n: 5, name: "Explotación", desc: "Aprovechar una vulnerabilidad para obtener acceso (Metasploit, exploits web).", defenses: ["EDR/WAF", "Parcheo", "Mínimo privilegio"] },
      { n: 6, name: "Post-explotación", desc: "Escalar privilegios, recolectar credenciales, pivotar y mantener acceso.", defenses: ["Segmentación", "Detección de privesc/lateral", "LAPS"] },
      { n: 7, name: "Reporte", desc: "Documentar hallazgos, impacto y remediación priorizada para el cliente.", defenses: ["Remediar según riesgo", "Re-test de verificación"] },
    ],
  },
  {
    id: 14,
    module: 29,
    name: "Flujo de explotación con Metasploit",
    kind: "flow",
    summary:
      "El ciclo de trabajo en msfconsole desde que se busca un módulo hasta la post-explotación. Cada paso tiene su huella detectable.",
    phases: [
      { n: 1, name: "search", desc: "Buscar un módulo de exploit/auxiliary acorde al servicio y versión hallados.", defenses: ["Ocultar versiones (banners)", "Parcheo al día"] },
      { n: 2, name: "use + info", desc: "Seleccionar el módulo y revisar sus opciones y requisitos.", defenses: ["Reducir servicios expuestos"] },
      { n: 3, name: "set options", desc: "Configurar RHOSTS, LHOST/LPORT y el payload (ej. Meterpreter).", defenses: ["Egress filtering (bloquear reverse shells)"] },
      { n: 4, name: "check", desc: "Verificar si el objetivo es vulnerable sin lanzar el exploit (cuando el módulo lo soporta).", defenses: ["IDS/IPS de red"] },
      { n: 5, name: "exploit", desc: "Lanzar el exploit; si tiene éxito, se abre una sesión.", defenses: ["EDR", "Memoria protegida (DEP/ASLR)"] },
      { n: 6, name: "Meterpreter / post", desc: "Operar la sesión: escalar, volcar credenciales, pivotar, persistir.", defenses: ["Detección de post-explotación", "Monitoreo de procesos"] },
    ],
  },
  {
    id: 15,
    module: 33,
    name: "Pivoting y movimiento lateral",
    kind: "flow",
    summary:
      "Cómo un atacante se expande desde el primer host comprometido hacia el objetivo final dentro de la red. Cada fase se contiene con segmentación y monitoreo.",
    phases: [
      { n: 1, name: "Compromiso inicial", desc: "Se obtiene acceso a un primer host (la 'cabeza de playa').", defenses: ["Hardening del perímetro", "EDR en endpoints"] },
      { n: 2, name: "Túnel / port forward", desc: "Se establece un túnel (SSH, chisel, ligolo) para alcanzar la red interna.", defenses: ["Egress filtering", "Detección de túneles/beaconing"] },
      { n: 3, name: "Descubrir la red interna", desc: "Se escanea y enumera la red ahora alcanzable a través del pivote.", defenses: ["Microsegmentación", "Detección de escaneo interno"] },
      { n: 4, name: "Movimiento lateral", desc: "Se salta a otros hosts con credenciales robadas (PsExec, WMI, WinRM, Pass-the-Hash).", defenses: ["LAPS", "Mínimo privilegio", "Deshabilitar SMBv1"] },
      { n: 5, name: "Alcanzar el objetivo", desc: "Se llega al activo crítico (Domain Controller, base de datos) y se cumple el objetivo.", defenses: ["Tiering de AD", "Monitoreo de cuentas privilegiadas", "Backups"] },
    ],
  },
  {
    id: 16,
    module: 34,
    name: "Los 6 principios de Cialdini",
    kind: "controls",
    summary:
      "Los gatillos psicológicos que todo ingeniero social explota. Reconocerlos es la mejor defensa: cada principio tiene su contramedida.",
    phases: [
      { n: 1, name: "Reciprocidad", desc: "Tendemos a devolver favores; el atacante da algo (ayuda, un regalo) para que sintamos que debemos corresponder.", defenses: ["Desconfiar de favores no solicitados", "Separar el favor de la petición"] },
      { n: 2, name: "Compromiso y coherencia", desc: "Queremos ser consistentes; tras un pequeño 'sí' es más fácil que aceptemos algo mayor.", defenses: ["Reevaluar cada petición por sí sola", "No dejarse arrastrar por un 'sí' previo"] },
      { n: 3, name: "Prueba social", desc: "Imitamos lo que hacen los demás; 'todos en tu equipo ya lo hicieron' presiona a seguir.", defenses: ["Verificar de forma independiente", "No asumir que lo común es legítimo"] },
      { n: 4, name: "Autoridad", desc: "Obedecemos a figuras de poder; suplantan a un directivo, IT o la policía para forzar acción.", defenses: ["Verificar la identidad por un canal aparte", "Las órdenes urgentes piden más verificación, no menos"] },
      { n: 5, name: "Simpatía", desc: "Confiamos en quien nos cae bien; el atacante crea rapport (intereses comunes, halagos).", defenses: ["Separar la simpatía de la decisión", "Aplicar el proceso igual con todos"] },
      { n: 6, name: "Escasez", desc: "Tememos perder oportunidades; 'oferta/plazo limitado' o 'tu cuenta se cierra ya' apuran a actuar sin pensar.", defenses: ["Frenar ante la urgencia", "La presión temporal es una señal de alerta"] },
    ],
  },
  {
    id: 17,
    module: 35,
    name: "Anatomía de una campaña de phishing",
    kind: "flow",
    summary:
      "Las fases por las que pasa una campaña de phishing dirigida, del recon al impacto. Cada etapa tiene su control defensivo.",
    phases: [
      { n: 1, name: "Reconocimiento (OSINT)", desc: "Se recopilan objetivos, roles y contexto (LinkedIn, web, filtraciones) para personalizar el cebo.", defenses: ["Reducir exposición pública", "Concienciación sobre OSINT"] },
      { n: 2, name: "Pretexto y diseño del cebo", desc: "Se crea la historia y la plantilla creíble (factura, reset de contraseña, mensaje del CEO).", defenses: ["Formación en señales de phishing", "Cultura de verificar lo inesperado"] },
      { n: 3, name: "Infraestructura", desc: "Se registra un dominio lookalike y se monta el envío y el portal falso (GoPhish, SET).", defenses: ["Monitoreo de dominios similares", "Bloqueo de dominios recién registrados"] },
      { n: 4, name: "Envío y evasión de filtros", desc: "Se entrega el correo sorteando los filtros (SPF/DKIM/DMARC, URLs ofuscadas, QR).", defenses: ["DMARC (reject)", "Gateway + sandboxing", "Reescritura de URLs"] },
      { n: 5, name: "Captura de credenciales", desc: "La víctima introduce sus credenciales (o MFA) en el portal del atacante.", defenses: ["MFA resistente a phishing (FIDO2)", "Botón de reportar phishing"] },
      { n: 6, name: "Explotación / reporte", desc: "Se usan las credenciales (acceso, BEC, lateral) — o, si es un simulacro, se reportan métricas.", defenses: ["Detección de logins anómalos", "Respuesta a incidentes", "Awareness con métricas"] },
    ],
  },
];

export function frameworksByModule(moduleId: number): Framework[] {
  return FRAMEWORKS.filter((f) => f.module === moduleId);
}
