// Next.js runs this once per document before hydration. Later homepage visits
// reset through MandegarExperience's mount effect.
const root = document.documentElement;
const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/^\/+|\/+$/g, "");
const homePath = `/${root.lang}`;

if (pathname === homePath || (basePath && pathname === `/${basePath}${homePath}`)) {
  root.dataset.mandegarPreviousScrollRestoration = window.history.scrollRestoration;
  window.history.scrollRestoration = "manual";
  root.setAttribute("data-experience-scroll-lock", "");
  const previousBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = "auto";
  window.scrollTo(0, 0);
  root.style.scrollBehavior = previousBehavior;
}

export {};
