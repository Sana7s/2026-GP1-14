/* =====================================================================
   BurnCare — pageNames.js
   ---------------------------------------------------------------------
   The name of every page, and the page "above" it, for the breadcrumb
   strip under the header (components/PageCrumb.jsx) and the browser tab.
   To rename a page, change it here only.

   Each line: [web address, page name, page above it (optional)]
   ":id" matches any value, for example a Report ID.
   ===================================================================== */

// The four parts of the website: the first link of the breadcrumb.
const SECTIONS = [
  { prefix: "/patient", name: "Patient", home: "/patient" },
  { prefix: "/staff", name: "Healthcare staff", home: "/staff" },
  { prefix: "/admin", name: "Admin", home: "/admin" },
  { prefix: "/", name: "BurnCare", home: "/" }, // public pages (keep last)
];

const PAGES = [
  // ----- Public pages -----
  ["/", "Home"],
  ["/about", "About Us"],
  ["/guest", "Guest assessment"],
  ["/tbsa", "Burn size calculator"],
  ["/register", "Register"],
  ["/register/patient", "Patient registration", "/register"],
  ["/register/staff", "Staff registration", "/register"],
  ["/login", "Log in"],
  ["/forgot-password", "Reset password", "/login"],

  // ----- Patient pages -----
  ["/patient", "Home"],
  ["/patient/assessment", "New assessment"],
  ["/patient/reports", "My reports"],
  ["/patient/reports/:id", "Report", "/patient/reports"],
  ["/patient/recovery", "Recovery"],
  ["/patient/chat", "Wound-care chat"],
  ["/patient/first-aid", "First aid"],
  ["/patient/profile", "My profile"],
  ["/patient/change-password", "Change password", "/patient/profile"],

  // ----- Healthcare staff pages -----
  ["/staff", "Home"],
  ["/staff/assessment", "New assessment"],
  ["/staff/reports", "Reports"],
  ["/staff/reports/:id", "Report", "/staff/reports"],
  ["/staff/consultations", "Consultations"],
  ["/staff/profile", "My profile"],

  // ----- Admin page -----
  ["/admin", "Dashboard"],
];

// Does a web address match a pattern like "/patient/reports/:id"?
function matches(pattern, path) {
  const want = pattern.split("/");
  const parts = path.split("/");
  return want.length === parts.length && want.every((piece, i) => piece === ":id" || piece === parts[i]);
}

// "/patient/reports/BC-261029-7K4QX" → "Report"; an unknown address → "Page not found"
export function pageNameFor(pathname) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname; // ignore a trailing "/"
  return PAGES.find(([pattern]) => matches(pattern, path))?.[1] ?? "Page not found";
}

// The breadcrumb for an address, e.g. "/patient/reports/BC-261029-7K4QX" →
// [{ name: "Patient", to: "/patient" }, { name: "My reports", to: "/patient/reports" }, { name: "Report" }]
export function breadcrumbFor(pathname) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const section = SECTIONS.find((s) => path === s.prefix || path.startsWith(`${s.prefix}/`) || s.prefix === "/");
  const trail = [];
  let page = PAGES.find(([pattern]) => matches(pattern, path));
  if (!page) return [{ name: section.name, to: section.home }, { name: "Page not found" }];

  trail.unshift({ name: page[1] }); // the page you're on
  while (page[2]) {
    const parentPath = page[2];
    page = PAGES.find(([pattern]) => pattern === parentPath);
    trail.unshift({ name: page[1], to: parentPath });
  }
  trail.unshift({ name: section.name, to: section.home });
  return trail;
}