// Biblioteca de CyberSec Academy — catálogo curado de recursos GRATUITOS y
// legalmente distribuibles en español (open-access, Creative Commons, dominio
// público, documentación oficial y guías de organismos públicos como INCIBE /
// CCN-CERT). NO se incluyen PDFs con copyright; para esos, el usuario sube su
// propia copia vía el gestor de subidas (securities_library_uploads).
//
// Cada entrada apunta a la FUENTE OFICIAL (dominio estable). Verificá el enlace
// antes de depender de él; las guías de organismos rotan rutas ocasionalmente.
// `cat` se alinea con las categorías del syllabus para mapear lecturas a módulos.

export type LibraryFormat = "pdf" | "web";
export type LibraryLevel = "b" | "i" | "a" | "all";

export interface LibraryBook {
  id: number;
  title: string;
  author: string;
  cat: string;          // categoría (alineada al syllabus cuando aplica)
  level: LibraryLevel;  // dificultad orientativa
  format: LibraryFormat;
  url: string;          // fuente oficial gratuita
  license: string;      // licencia / origen
  year?: number;
  desc: string;
}

export const LIBRARY: LibraryBook[] = [
  // ── Programación ──
  {
    id: 1, title: "Pro Git (2ª edición)", author: "Scott Chacon & Ben Straub",
    cat: "Programación", level: "all", format: "pdf",
    url: "https://git-scm.com/book/es/v2", license: "CC BY-NC-SA 3.0",
    desc: "El libro de referencia de Git, completo y en español. Descargable en PDF desde la web oficial.",
  },
  {
    id: 2, title: "El Tutorial de Python (oficial)", author: "Python Software Foundation",
    cat: "Programación", level: "b", format: "web",
    url: "https://docs.python.org/es/3/tutorial/", license: "PSF License",
    desc: "Tutorial oficial de Python traducido al español. La documentación completa se puede descargar en PDF.",
  },
  {
    id: 3, title: "Python para todos", author: "Raúl González Duque",
    cat: "Programación", level: "b", format: "web",
    url: "https://mundogeek.net/tutorial-python/", license: "Libre (distribución gratuita)",
    desc: "Clásico libro introductorio de Python en español, de libre distribución.",
  },
  {
    id: 4, title: "MDN Web Docs (JavaScript y Web)", author: "Mozilla",
    cat: "Programación", level: "all", format: "web",
    url: "https://developer.mozilla.org/es/docs/Web/JavaScript", license: "CC BY-SA 2.5",
    desc: "Referencia abierta de JavaScript, HTML y CSS en español, mantenida por Mozilla.",
  },
  {
    id: 5, title: "Documentación de Django (es)", author: "Django Software Foundation",
    cat: "Programación", level: "i", format: "web",
    url: "https://docs.djangoproject.com/es/stable/", license: "BSD (docs)",
    desc: "Documentación oficial del framework Django, parcialmente traducida al español.",
  },

  // ── Fundamentos / Blue Team ──
  {
    id: 6, title: "Glosario de términos de ciberseguridad", author: "INCIBE",
    cat: "Fundamentos", level: "b", format: "web",
    url: "https://www.incibe.es/incibe-cert/glosario-de-terminos", license: "INCIBE (uso libre)",
    desc: "Glosario de referencia del Instituto Nacional de Ciberseguridad de España.",
  },
  {
    id: 7, title: "Guías de ciberseguridad para empresas", author: "INCIBE",
    cat: "Blue Team", level: "i", format: "pdf",
    url: "https://www.incibe.es/empresas/guias", license: "INCIBE (uso libre)",
    desc: "Colección de guías prácticas en PDF: políticas, gestión de incidentes, protección de datos, etc.",
  },
  {
    id: 8, title: "Recursos de ciberseguridad para ciudadanía", author: "INCIBE",
    cat: "Fundamentos", level: "b", format: "pdf",
    url: "https://www.incibe.es/ciudadania/recursos", license: "INCIBE (uso libre)",
    desc: "Guías y materiales en PDF sobre privacidad, fraude online, redes sociales y dispositivos.",
  },
  {
    id: 9, title: "Guías CCN-STIC", author: "CCN-CERT (Centro Criptológico Nacional)",
    cat: "Sistemas", level: "a", format: "pdf",
    url: "https://www.ccn-cert.cni.es/guias/guias-series-ccn-stic.html", license: "CCN-CERT (uso público)",
    desc: "Serie de guías técnicas de seguridad (hardening, ENS, configuración segura) del CCN español.",
  },

  // ── Redes / Pentesting ──
  {
    id: 10, title: "Guía de referencia de Nmap (es)", author: "Gordon 'Fyodor' Lyon",
    cat: "Redes", level: "i", format: "web",
    url: "https://nmap.org/man/es/", license: "Nmap (documentación libre)",
    desc: "Página de manual de Nmap traducida al español: tipos de escaneo, flags y detección.",
  },

  // ── Web Security ──
  {
    id: 11, title: "OWASP Top 10:2021 (es)", author: "OWASP Foundation",
    cat: "Web Security", level: "i", format: "web",
    url: "https://owasp.org/Top10/es/", license: "CC BY-SA 4.0",
    desc: "Los 10 riesgos más críticos en aplicaciones web, con la traducción oficial al español.",
  },
  {
    id: 12, title: "OWASP Cheat Sheet Series", author: "OWASP Foundation",
    cat: "Web Security", level: "a", format: "web",
    url: "https://cheatsheetseries.owasp.org/", license: "CC BY 3.0",
    desc: "Guías concisas de implementación segura por tema (autenticación, XSS, SQLi, etc.).",
  },
];

export const LIBRARY_CATEGORIES: string[] = [...new Set(LIBRARY.map((b) => b.cat))];

export function libraryByCategory(cat: string): LibraryBook[] {
  return LIBRARY.filter((b) => b.cat === cat);
}

export function getLibraryBook(id: number): LibraryBook | undefined {
  return LIBRARY.find((b) => b.id === id);
}
