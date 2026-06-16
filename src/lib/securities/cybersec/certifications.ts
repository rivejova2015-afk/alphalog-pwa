// Recomendador de certificaciones de CyberSec Academy. El usuario elige una RAMA
// de carrera (track) y ve una escalera de certificaciones de nivel 1 (Entrada) a
// 5 (Experto), con precio aproximado en USD, requisitos y detalles del examen.
//
// Espeja el patrón de library.ts (catálogo en código + helpers + tests de
// integridad). Los PRECIOS son aproximados y cambian seguido / varían por región
// y reintentos: la UI muestra un aviso "verificá el precio oficial". El test solo
// valida priceUsd >= 0, no el monto.

export type CertTier = 1 | 2 | 3 | 4 | 5;
export type CertTrack =
  | "foundations" | "offensive" | "defensive" | "dfir"
  | "appsec" | "cloud" | "grc" | "infra";

export interface Certification {
  id: number;
  name: string;          // sigla / nombre corto (ej. "OSCP")
  fullName: string;      // nombre completo
  vendor: string;        // emisor
  track: CertTrack;
  tier: CertTier;        // 1 Entrada → 5 Experto
  priceUsd: number;      // aproximado; 0 = gratis
  priceNote?: string;    // matiz del precio (ej. "por examen", "/mes")
  prerequisites: string; // requisitos / experiencia recomendada
  exam: string;          // formato, duración, aprobación
  domains: string;       // áreas / temario resumido
  url: string;           // página oficial
  desc: string;          // 1 frase
}

export const CERT_TRACKS: { id: CertTrack; label: string; desc: string }[] = [
  { id: "foundations", label: "Generalista / Fundamentos", desc: "Punto de partida transversal: bases de seguridad, redes y conceptos para cualquier rol." },
  { id: "offensive", label: "Red Team / Ofensiva", desc: "Pentesting, explotación y red teaming: romper para luego defender." },
  { id: "defensive", label: "Blue Team (SOC & IR)", desc: "Detección, monitorización, respuesta a incidentes y threat hunting." },
  { id: "dfir", label: "Forense Digital (DFIR)", desc: "Adquisición y análisis de evidencias, forense de disco/memoria/red y análisis de malware." },
  { id: "appsec", label: "AppSec / Web", desc: "Seguridad de aplicaciones web y desarrollo seguro." },
  { id: "cloud", label: "Cloud Security", desc: "Seguridad en AWS, Azure y GCP, contenedores y arquitectura cloud." },
  { id: "grc", label: "GRC / Auditoría / Arquitectura", desc: "Gobernanza, riesgo, cumplimiento, auditoría y arquitectura de seguridad." },
  { id: "infra", label: "Redes & Sistemas", desc: "Infraestructura segura: networking, sistemas y operaciones de red." },
];

export const CERT_TIER_LABELS: Record<CertTier, string> = {
  1: "Entrada", 2: "Asociado", 3: "Profesional", 4: "Avanzado", 5: "Experto",
};

export const CERTIFICATIONS: Certification[] = [
  // ── foundations ──
  { id: 1, name: "ISC2 CC", fullName: "Certified in Cybersecurity", vendor: "ISC2", track: "foundations", tier: 1, priceUsd: 50, priceNote: "examen suele ser gratis con el programa ISC2 CC", prerequisites: "Ninguno. Pensada para principiantes sin experiencia.", exam: "100 preguntas opción múltiple · 2 h · aprueba con 700/1000.", domains: "Principios de seguridad, BC/DR/IR, control de accesos, redes, operaciones.", url: "https://www.isc2.org/certifications/cc", desc: "Certificación de entrada absoluta, ideal como primer paso reconocido." },
  { id: 2, name: "Google Cybersecurity", fullName: "Google Cybersecurity Professional Certificate", vendor: "Google / Coursera", track: "foundations", tier: 1, priceUsd: 49, priceNote: "/mes en Coursera (≈3-6 meses)", prerequisites: "Ninguno. 100% principiante.", exam: "Programa de 8 cursos con proyectos; no es examen único.", domains: "SIEM, Linux, SQL, Python, gestión de riesgos, respuesta a incidentes.", url: "https://www.coursera.org/professional-certificates/google-cybersecurity", desc: "Programa práctico de iniciación con laboratorios y portafolio." },
  { id: 3, name: "Security+", fullName: "CompTIA Security+", vendor: "CompTIA", track: "foundations", tier: 2, priceUsd: 404, prerequisites: "Recomendado Network+ y ~2 años de experiencia en TI/seguridad.", exam: "Máx. 90 preguntas (opción múltiple + PBQ) · 90 min · aprueba con 750/900.", domains: "Amenazas, arquitectura, operaciones, gestión de programas de seguridad.", url: "https://www.comptia.org/certifications/security", desc: "El estándar de facto para entrar al campo; muy pedida en ofertas junior." },
  { id: 4, name: "SSCP", fullName: "Systems Security Certified Practitioner", vendor: "ISC2", track: "foundations", tier: 3, priceUsd: 249, prerequisites: "1 año de experiencia en uno de los dominios (o estatus Associate).", exam: "125 preguntas · 3 h · aprueba con 700/1000.", domains: "Control de accesos, operaciones, criptografía, redes, IR.", url: "https://www.isc2.org/certifications/sscp", desc: "Paso operativo entre Security+ y CISSP, orientado a practicantes técnicos." },
  { id: 5, name: "SecurityX (CASP+)", fullName: "CompTIA SecurityX (antes CASP+)", vendor: "CompTIA", track: "foundations", tier: 4, priceUsd: 509, prerequisites: "~10 años de TI con 5 en seguridad práctica.", exam: "Máx. 90 preguntas (incluye PBQ) · 165 min · aprobado/no aprobado.", domains: "Arquitectura, operaciones de seguridad, ingeniería, gobernanza/riesgo.", url: "https://www.comptia.org/certifications/securityx", desc: "Cima técnica (no de gestión) de la ruta CompTIA." },

  // ── offensive ──
  { id: 6, name: "eJPT", fullName: "eLearnSecurity Junior Penetration Tester", vendor: "INE Security", track: "offensive", tier: 1, priceUsd: 249, prerequisites: "Bases de redes y Linux. Sin experiencia previa de pentest.", exam: "Práctico en laboratorio · 48 h · objetivos verificables.", domains: "Recon, escaneo, explotación básica, pentest web y de red.", url: "https://security.ine.com/certifications/ejpt-certification/", desc: "La mejor primera certificación práctica de pentesting." },
  { id: 7, name: "PNPT", fullName: "Practical Network Penetration Tester", vendor: "TCM Security", track: "offensive", tier: 2, priceUsd: 399, priceNote: "incluye 2 intentos", prerequisites: "Bases de pentest, Active Directory y redes.", exam: "5 días de pentest real + reporte + defensa oral de 15 min.", domains: "OSINT, pentest externo/interno, AD, post-explotación, reporte.", url: "https://certifications.tcm-sec.com/pnpt/", desc: "Examen realista de extremo a extremo con informe y defensa oral." },
  { id: 8, name: "PenTest+", fullName: "CompTIA PenTest+", vendor: "CompTIA", track: "offensive", tier: 2, priceUsd: 404, prerequisites: "Network+/Security+ y 3-4 años de experiencia en seguridad.", exam: "Máx. 85 preguntas (opción múltiple + PBQ) · 165 min.", domains: "Planificación, recon, ataques, herramientas, reporte.", url: "https://www.comptia.org/certifications/pentest", desc: "Alternativa con teoría + práctica y reconocimiento corporativo." },
  { id: 9, name: "CEH", fullName: "Certified Ethical Hacker", vendor: "EC-Council", track: "offensive", tier: 3, priceUsd: 1199, priceNote: "voucher de examen; +elegibilidad", prerequisites: "Curso oficial o 2 años de experiencia en seguridad.", exam: "125 preguntas · 4 h · corte variable (~70%). Opción práctica aparte.", domains: "Footprinting, escaneo, hacking de sistemas/web/red, malware, cloud.", url: "https://www.eccouncil.org/train-certify/certified-ethical-hacker-ceh/", desc: "Muy reconocida por RR.HH.; amplia en cobertura, más teórica." },
  { id: 10, name: "OSCP", fullName: "Offensive Security Certified Professional", vendor: "OffSec", track: "offensive", tier: 3, priceUsd: 1649, priceNote: "curso PEN-200 + examen (90 días de lab)", prerequisites: "Sólidas bases de Linux, redes y scripting (Bash/Python).", exam: "24 h de pentest práctico + 24 h de reporte · 70/100 puntos.", domains: "Explotación manual, escalada de privilegios, pivoting, AD.", url: "https://www.offsec.com/courses/pen-200/", desc: "La certificación de pentest más respetada de la industria." },
  { id: 11, name: "CRTO", fullName: "Certified Red Team Operator", vendor: "Zero-Point Security", track: "offensive", tier: 4, priceUsd: 465, priceNote: "≈£365, incluye laboratorio", prerequisites: "Experiencia en pentest y manejo de C2 (Cobalt Strike).", exam: "Práctico en laboratorio de AD · 48 h con objetivos.", domains: "C2, evasión, abuso de AD, movimiento lateral, persistencia.", url: "https://training.zeropointsecurity.co.uk/courses/red-team-ops", desc: "Estándar moderno de red teaming con Cobalt Strike y evasión." },
  { id: 12, name: "OSEP", fullName: "Offensive Security Experienced Penetration Tester", vendor: "OffSec", track: "offensive", tier: 4, priceUsd: 1649, priceNote: "curso PEN-300 + examen", prerequisites: "OSCP o nivel equivalente; programación intermedia.", exam: "48 h de examen práctico avanzado + reporte.", domains: "Evasión de antivirus/EDR, técnicas avanzadas de AD, C2 propio.", url: "https://www.offsec.com/courses/pen-300/", desc: "Especialización en evasión y técnicas avanzadas de explotación." },
  { id: 13, name: "OSEE", fullName: "Offensive Security Exploitation Expert", vendor: "OffSec", track: "offensive", tier: 5, priceUsd: 5499, priceNote: "curso EXP-401 (presencial/élite)", prerequisites: "Dominio de explotación de Windows, ASM y depuración.", exam: "72 h de examen de desarrollo de exploits avanzados.", domains: "Exploits de Windows, bypass de mitigaciones, kernel, navegador.", url: "https://www.offsec.com/courses/exp-401/", desc: "La cima del desarrollo de exploits; una de las más difíciles que existen." },

  // ── defensive ──
  { id: 14, name: "BTL1", fullName: "Blue Team Level 1", vendor: "Security Blue Team", track: "defensive", tier: 1, priceUsd: 399, prerequisites: "Bases de redes y sistemas. Apto para principiantes en defensa.", exam: "Práctico de 24 h: investigación de un incidente real.", domains: "Phishing, threat intel, forense digital, SIEM, IR.", url: "https://securityblue.team/certifications/blue-team-level-1/", desc: "La mejor certificación práctica de entrada al Blue Team / SOC." },
  { id: 15, name: "CySA+", fullName: "CompTIA Cybersecurity Analyst+", vendor: "CompTIA", track: "defensive", tier: 2, priceUsd: 404, prerequisites: "Security+ y ~4 años de experiencia en seguridad.", exam: "Máx. 85 preguntas (opción múltiple + PBQ) · 165 min.", domains: "Gestión de amenazas/vulnerabilidades, SOC, IR, reporte.", url: "https://www.comptia.org/certifications/cybersecurity-analyst", desc: "Enfoque en análisis defensivo y operaciones de SOC con detección por comportamiento." },
  { id: 16, name: "BTL2", fullName: "Blue Team Level 2", vendor: "Security Blue Team", track: "defensive", tier: 3, priceUsd: 499, prerequisites: "BTL1 o experiencia equivalente en defensa.", exam: "Práctico avanzado de 48 h.", domains: "Threat hunting, malware avanzado, forense de memoria, detección.", url: "https://securityblue.team/certifications/blue-team-level-2/", desc: "Continuación avanzada de BTL1 con hunting y análisis profundo." },
  { id: 17, name: "GCIH", fullName: "GIAC Certified Incident Handler", vendor: "GIAC / SANS", track: "defensive", tier: 3, priceUsd: 979, priceNote: "solo examen; curso SANS aparte (~USD 8k)", prerequisites: "Conocimiento de ataques y respuesta a incidentes.", exam: "106-150 preguntas · 4 h · corte ~70%.", domains: "Manejo de incidentes, técnicas de ataque, contención y erradicación.", url: "https://www.giac.org/certifications/certified-incident-handler-gcih/", desc: "Referencia en respuesta a incidentes, muy valorada en SOC/CSIRT." },
  { id: 18, name: "GMON", fullName: "GIAC Continuous Monitoring Certification", vendor: "GIAC / SANS", track: "defensive", tier: 4, priceUsd: 979, priceNote: "solo examen", prerequisites: "Experiencia en monitorización y arquitectura defensiva.", exam: "82-115 preguntas · 3 h · corte ~70%.", domains: "Seguridad defensiva continua, NSM, detección, hardening.", url: "https://www.giac.org/certifications/continuous-monitoring-gmon/", desc: "Defensa basada en monitorización continua y detección temprana." },
  { id: 19, name: "GSE", fullName: "GIAC Security Expert", vendor: "GIAC / SANS", track: "defensive", tier: 5, priceUsd: 2499, priceNote: "examen escrito + laboratorio práctico", prerequisites: "Varias certificaciones GIAC previas (GSEC, GCIH, GCIA).", exam: "Examen escrito + 2 días de laboratorio práctico (hands-on).", domains: "Dominio amplio: defensa, IR, forense, hardening, redes.", url: "https://www.giac.org/certifications/security-expert-gse/", desc: "La certificación más prestigiosa de GIAC; muy pocos la poseen." },

  // ── dfir ──
  { id: 20, name: "MCFE", fullName: "Magnet Certified Forensics Examiner", vendor: "Magnet Forensics", track: "dfir", tier: 1, priceUsd: 0, priceNote: "examen gratis tras el curso AXIOM", prerequisites: "Curso de Magnet AXIOM (formación previa).", exam: "Examen sobre el uso de Magnet AXIOM en investigaciones.", domains: "Adquisición y análisis con AXIOM, artefactos, reporte.", url: "https://www.magnetforensics.com/training/", desc: "Entrada práctica al forense digital con una de las suites líderes." },
  { id: 21, name: "GCFE", fullName: "GIAC Certified Forensic Examiner", vendor: "GIAC / SANS", track: "dfir", tier: 2, priceUsd: 979, priceNote: "solo examen", prerequisites: "Bases de sistemas Windows y forense.", exam: "82-115 preguntas · 3 h · corte ~70%.", domains: "Forense de Windows, artefactos de usuario, análisis de actividad.", url: "https://www.giac.org/certifications/certified-forensic-examiner-gcfe/", desc: "Forense de endpoints Windows orientado a investigaciones." },
  { id: 22, name: "GCFA", fullName: "GIAC Certified Forensic Analyst", vendor: "GIAC / SANS", track: "dfir", tier: 3, priceUsd: 979, priceNote: "solo examen", prerequisites: "GCFE o experiencia equivalente en forense.", exam: "82-115 preguntas · 3 h · corte ~70%.", domains: "Forense avanzado, threat hunting, respuesta a intrusiones, timeline.", url: "https://www.giac.org/certifications/certified-forensic-analyst-gcfa/", desc: "Análisis forense avanzado e investigación de intrusiones (APT)." },
  { id: 23, name: "GREM", fullName: "GIAC Reverse Engineering Malware", vendor: "GIAC / SANS", track: "dfir", tier: 4, priceUsd: 979, priceNote: "solo examen", prerequisites: "Ensamblador, depuración y bases de malware.", exam: "66-75 preguntas · 2-3 h · corte ~70%.", domains: "Análisis estático/dinámico, desempaquetado, comportamiento de malware.", url: "https://www.giac.org/certifications/reverse-engineering-malware-grem/", desc: "Ingeniería inversa de malware para analistas y forenses." },
  { id: 24, name: "GNFA", fullName: "GIAC Network Forensic Analyst", vendor: "GIAC / SANS", track: "dfir", tier: 4, priceUsd: 979, priceNote: "solo examen", prerequisites: "Sólidas bases de redes y protocolos.", exam: "50-66 preguntas · 2-3 h · corte ~70%.", domains: "Forense de red, análisis de PCAP, NetFlow, detección de C2.", url: "https://www.giac.org/certifications/network-forensic-analyst-gnfa/", desc: "Especialización en evidencias y análisis forense de red." },

  // ── appsec ──
  { id: 25, name: "eWPT", fullName: "eLearnSecurity Web Application Penetration Tester", vendor: "INE Security", track: "appsec", tier: 1, priceUsd: 249, prerequisites: "Bases de HTTP, HTML y vulnerabilidades web.", exam: "Práctico en laboratorio web · 7 días + reporte.", domains: "OWASP, SQLi, XSS, autenticación, sesiones, reporte.", url: "https://security.ine.com/certifications/ewpt-certification/", desc: "Primer paso práctico para especializarse en seguridad web." },
  { id: 26, name: "BSCP", fullName: "Burp Suite Certified Practitioner", vendor: "PortSwigger", track: "appsec", tier: 2, priceUsd: 99, prerequisites: "Completar la Web Security Academy (gratuita) de PortSwigger.", exam: "Práctico de 4 h: explotar 3 apps web reales.", domains: "Todo el OWASP moderno cubierto por la Web Security Academy.", url: "https://portswigger.net/web-security/certification", desc: "Certificación práctica y barata, muy valorada en AppSec." },
  { id: 27, name: "GWAPT", fullName: "GIAC Web Application Penetration Tester", vendor: "GIAC / SANS", track: "appsec", tier: 3, priceUsd: 979, priceNote: "solo examen", prerequisites: "Experiencia en pentest web.", exam: "75 preguntas · 2-4 h · corte ~70%.", domains: "Metodología de pentest web, explotación, herramientas.", url: "https://www.giac.org/certifications/web-application-penetration-tester-gwapt/", desc: "Pentest web con respaldo SANS, reconocida en entornos corporativos." },
  { id: 28, name: "CSSLP", fullName: "Certified Secure Software Lifecycle Professional", vendor: "ISC2", track: "appsec", tier: 4, priceUsd: 599, prerequisites: "4 años de experiencia en el ciclo de vida de desarrollo seguro.", exam: "125 preguntas · 3 h · aprueba con 700/1000.", domains: "Requisitos, diseño, codificación, pruebas y despliegue seguros.", url: "https://www.isc2.org/certifications/csslp", desc: "Enfoque en desarrollo seguro (DevSecOps) a lo largo del SDLC." },
  { id: 29, name: "OSWE", fullName: "Offensive Security Web Expert", vendor: "OffSec", track: "appsec", tier: 5, priceUsd: 1649, priceNote: "curso WEB-300 + examen", prerequisites: "Lectura de código fuente y programación intermedia.", exam: "48 h de examen práctico (whitebox) + reporte.", domains: "Auditoría de código fuente, bypass de autenticación, RCE encadenado.", url: "https://www.offsec.com/courses/web-300/", desc: "Explotación web avanzada de caja blanca; referencia en AppSec ofensiva." },

  // ── cloud ──
  { id: 30, name: "SC-900", fullName: "Microsoft Security, Compliance and Identity Fundamentals", vendor: "Microsoft", track: "cloud", tier: 1, priceUsd: 99, prerequisites: "Ninguno. Nivel fundamentos.", exam: "~40-60 preguntas · 45-60 min · aprueba con 700/1000.", domains: "Conceptos de seguridad, identidad (Entra), cumplimiento en Microsoft.", url: "https://learn.microsoft.com/credentials/certifications/security-compliance-and-identity-fundamentals/", desc: "Entrada a la seguridad en el ecosistema Microsoft/Azure." },
  { id: 31, name: "CCSK", fullName: "Certificate of Cloud Security Knowledge", vendor: "Cloud Security Alliance", track: "cloud", tier: 2, priceUsd: 445, priceNote: "incluye 2 intentos", prerequisites: "Bases de cloud y seguridad.", exam: "60 preguntas a libro abierto · 90 min · aprueba con 80%.", domains: "Arquitectura cloud, gobernanza, gestión de riesgos, controles CSA.", url: "https://cloudsecurityalliance.org/education/ccsk", desc: "Estándar agnóstico de proveedor (CSA) sobre seguridad cloud." },
  { id: 32, name: "AZ-500", fullName: "Microsoft Azure Security Engineer Associate", vendor: "Microsoft", track: "cloud", tier: 2, priceUsd: 165, prerequisites: "Experiencia con Azure (recomendado AZ-104/900).", exam: "40-60 preguntas · 120 min · aprueba con 700/1000.", domains: "Identidad/acceso, protección de plataforma, datos/apps, operaciones.", url: "https://learn.microsoft.com/credentials/certifications/azure-security-engineer/", desc: "Ingeniería de seguridad práctica sobre Azure." },
  { id: 33, name: "AWS Security Specialty", fullName: "AWS Certified Security – Specialty", vendor: "Amazon Web Services", track: "cloud", tier: 3, priceUsd: 300, prerequisites: "2+ años asegurando cargas en AWS; asociado recomendado.", exam: "65 preguntas · 170 min · aprueba con 750/1000.", domains: "Respuesta a incidentes, logging, IAM, protección de datos en AWS.", url: "https://aws.amazon.com/certification/certified-security-specialty/", desc: "Especialidad de seguridad para el ecosistema AWS." },
  { id: 34, name: "CCSP", fullName: "Certified Cloud Security Professional", vendor: "ISC2", track: "cloud", tier: 4, priceUsd: 599, prerequisites: "5 años de TI con 3 en seguridad y 1 en cloud.", exam: "125 preguntas · 3 h · aprueba con 700/1000.", domains: "Arquitectura, datos, plataforma, operaciones y legal en cloud.", url: "https://www.isc2.org/certifications/ccsp", desc: "Certificación de cloud agnóstica y de alto nivel (ISC2)." },
  { id: 35, name: "GPCS", fullName: "GIAC Public Cloud Security", vendor: "GIAC / SANS", track: "cloud", tier: 5, priceUsd: 979, priceNote: "solo examen", prerequisites: "Experiencia multi-cloud (AWS/Azure/GCP).", exam: "75 preguntas · 2-4 h · corte ~70%.", domains: "Seguridad multi-cloud, automatización, hardening, detección.", url: "https://www.giac.org/certifications/public-cloud-security-gpcs/", desc: "Seguridad avanzada y práctica en entornos multi-cloud." },

  // ── grc ──
  { id: 36, name: "ISO 27001 Foundation", fullName: "ISO/IEC 27001 Foundation", vendor: "PECB", track: "grc", tier: 1, priceUsd: 500, priceNote: "curso + examen (varía por partner)", prerequisites: "Ninguno. Introducción a SGSI.", exam: "40 preguntas · 1 h · aprueba con ~70%.", domains: "Conceptos de SGSI, cláusulas de ISO 27001, controles del Anexo A.", url: "https://pecb.com/en/education-and-certification-for-individuals/iso-iec-27001", desc: "Base de los sistemas de gestión de seguridad de la información." },
  { id: 37, name: "ISO 27001 Lead Implementer", fullName: "ISO/IEC 27001 Lead Implementer", vendor: "PECB", track: "grc", tier: 2, priceUsd: 1000, priceNote: "curso 5 días + examen", prerequisites: "Conocimiento de ISO 27001 (nivel Foundation).", exam: "12 preguntas tipo ensayo/escenario · 3 h · corte ~70%.", domains: "Implementación y operación de un SGSI conforme a ISO 27001.", url: "https://pecb.com/en/education-and-certification-for-individuals/iso-iec-27001/iso-iec-27001-lead-implementer", desc: "Para liderar la implantación de un SGSI en una organización." },
  { id: 38, name: "CISA", fullName: "Certified Information Systems Auditor", vendor: "ISACA", track: "grc", tier: 3, priceUsd: 760, priceNote: "USD 575 miembros ISACA", prerequisites: "5 años de auditoría/control de SI (con exenciones).", exam: "150 preguntas · 4 h · aprueba con 450/800.", domains: "Auditoría de SI, gobernanza, adquisición, operaciones, protección.", url: "https://www.isaca.org/credentialing/cisa", desc: "El estándar mundial de auditoría de sistemas de información." },
  { id: 39, name: "CRISC", fullName: "Certified in Risk and Information Systems Control", vendor: "ISACA", track: "grc", tier: 3, priceUsd: 760, priceNote: "USD 575 miembros ISACA", prerequisites: "3 años de experiencia en gestión de riesgos de TI.", exam: "150 preguntas · 4 h · aprueba con 450/800.", domains: "Gobernanza, evaluación, respuesta y monitorización de riesgos de TI.", url: "https://www.isaca.org/credentialing/crisc", desc: "Referencia en gestión de riesgos de TI y control empresarial." },
  { id: 40, name: "CISM", fullName: "Certified Information Security Manager", vendor: "ISACA", track: "grc", tier: 4, priceUsd: 760, priceNote: "USD 575 miembros ISACA", prerequisites: "5 años en gestión de seguridad de la información.", exam: "150 preguntas · 4 h · aprueba con 450/800.", domains: "Gobierno, gestión de riesgos, programa de seguridad e incidentes.", url: "https://www.isaca.org/credentialing/cism", desc: "Orientada a la gestión y el liderazgo de la seguridad (CISO track)." },
  { id: 41, name: "CISSP", fullName: "Certified Information Systems Security Professional", vendor: "ISC2", track: "grc", tier: 5, priceUsd: 749, prerequisites: "5 años de experiencia en 2+ de los 8 dominios CBK.", exam: "100-150 preguntas (CAT) · hasta 3 h · aprueba con 700/1000.", domains: "Los 8 dominios: riesgo, activos, arquitectura, redes, IAM, etc.", url: "https://www.isc2.org/certifications/cissp", desc: "La certificación de gestión de seguridad más reconocida del mundo." },
  { id: 42, name: "ISSAP", fullName: "Information Systems Security Architecture Professional", vendor: "ISC2", track: "grc", tier: 5, priceUsd: 599, prerequisites: "Tener CISSP vigente + 2 años en arquitectura.", exam: "125 preguntas · 3 h · aprueba con 700/1000.", domains: "Arquitectura de seguridad, IAM, infraestructura, criptografía aplicada.", url: "https://www.isc2.org/certifications/issap", desc: "Concentración de CISSP enfocada en arquitectura de seguridad." },

  // ── infra ──
  { id: 43, name: "CCST Cybersecurity", fullName: "Cisco Certified Support Technician — Cybersecurity", vendor: "Cisco", track: "infra", tier: 1, priceUsd: 125, prerequisites: "Ninguno. Nivel de entrada.", exam: "~50 min · opción múltiple.", domains: "Principios de seguridad, amenazas de red, criptografía, control de accesos.", url: "https://www.cisco.com/site/us/en/learn/training-certifications/certifications/cybersecurity/certified-support-technician-cybersecurity/index.html", desc: "Entrada de Cisco a seguridad de redes para roles de soporte." },
  { id: 44, name: "Network+", fullName: "CompTIA Network+", vendor: "CompTIA", track: "infra", tier: 1, priceUsd: 369, prerequisites: "Recomendado ~9-12 meses de experiencia en redes.", exam: "Máx. 90 preguntas (incluye PBQ) · 90 min · aprueba con 720/900.", domains: "Conceptos de red, implementación, operaciones, seguridad, troubleshooting.", url: "https://www.comptia.org/certifications/network", desc: "Base de redes imprescindible antes de especializarse en seguridad." },
  { id: 45, name: "CCNA", fullName: "Cisco Certified Network Associate", vendor: "Cisco", track: "infra", tier: 2, priceUsd: 300, prerequisites: "Recomendado ~1 año con soluciones Cisco.", exam: "~120 min · opción múltiple + simulaciones.", domains: "Fundamentos de red, acceso, conectividad IP, servicios, seguridad, automatización.", url: "https://www.cisco.com/site/us/en/learn/training-certifications/certifications/enterprise/ccna/index.html", desc: "La certificación de redes más reconocida del mercado." },
  { id: 46, name: "CyberOps Associate", fullName: "Cisco Certified CyberOps Associate", vendor: "Cisco", track: "infra", tier: 3, priceUsd: 300, prerequisites: "Bases de redes (nivel CCNA recomendado).", exam: "~120 min · opción múltiple.", domains: "Conceptos de SOC, monitorización, análisis de host/red, IR.", url: "https://www.cisco.com/site/us/en/learn/training-certifications/certifications/cyberops/ccna-cyberops/index.html", desc: "Operaciones de seguridad (SOC) desde la perspectiva de red de Cisco." },
  { id: 47, name: "CCNP Security", fullName: "Cisco Certified Network Professional Security", vendor: "Cisco", track: "infra", tier: 4, priceUsd: 300, priceNote: "por examen (núcleo + concentración)", prerequisites: "Recomendado CCNA y 3-5 años de experiencia.", exam: "Examen núcleo (SCOR) + 1 examen de concentración.", domains: "Firewalls, VPN, acceso seguro, seguridad de red/cloud, automatización.", url: "https://www.cisco.com/site/us/en/learn/training-certifications/certifications/security/ccnp-security/index.html", desc: "Nivel profesional de seguridad de red e infraestructura Cisco." },
  { id: 48, name: "CCIE Security", fullName: "Cisco Certified Internetwork Expert Security", vendor: "Cisco", track: "infra", tier: 5, priceUsd: 1900, priceNote: "laboratorio; + examen escrito aparte", prerequisites: "Amplia experiencia en redes y seguridad de nivel experto.", exam: "Examen escrito de calificación + 8 h de laboratorio práctico.", domains: "Diseño, despliegue y operación experta de seguridad de red.", url: "https://www.cisco.com/site/us/en/learn/training-certifications/certifications/security/ccie-security/index.html", desc: "Uno de los reconocimientos más altos en seguridad de redes." },
];

// Mapeo de las 21 categorías del syllabus a los 8 tracks de carrera.
const CATEGORY_TRACK: Record<string, CertTrack> = {
  "Fundamentos": "foundations",
  "Criptografía": "foundations",
  "Cripto Avanzada": "foundations",
  "AI/ML Security": "foundations",
  "Investigación": "foundations",
  "Especializado": "foundations",
  "Redes": "infra",
  "Sistemas": "infra",
  "Pentesting": "offensive",
  "Social Eng.": "offensive",
  "Exploit Dev Avanzado": "offensive",
  "Hardware & Low-Level": "offensive",
  "Reversing Avanzado": "offensive",
  "Blue Team": "defensive",
  "Malware": "defensive",
  "Forense": "dfir",
  "Web Security": "appsec",
  "Programación": "appsec",
  "Cloud": "cloud",
  "GRC": "grc",
  "Arquitectura de Seguridad": "grc",
};

export const CERT_TRACK_IDS: CertTrack[] = CERT_TRACKS.map((t) => t.id);

// Certs de un track, ordenadas por nivel (tier 1 → 5).
export function certsByTrack(track: CertTrack): Certification[] {
  return CERTIFICATIONS.filter((c) => c.track === track).sort((a, b) => a.tier - b.tier);
}

// Track de carrera para una categoría del syllabus (default 'foundations').
export function trackForCategory(cat: string): CertTrack {
  return CATEGORY_TRACK[cat] ?? "foundations";
}

// Certs recomendadas para un módulo, según su categoría → track.
export function certsByCategory(cat: string): Certification[] {
  return certsByTrack(trackForCategory(cat));
}

export function getCertification(id: number): Certification | undefined {
  return CERTIFICATIONS.find((c) => c.id === id);
}

export function trackLabel(track: CertTrack): string {
  return CERT_TRACKS.find((t) => t.id === track)?.label ?? track;
}
