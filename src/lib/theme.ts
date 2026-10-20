export type Theme = "light" | "dark";

export function getTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const saved = localStorage.getItem("pinboard_theme");
  if (saved === "dark" || saved === "light") return saved;
  // If user previously set focus mode theme, carry it over
  const focusSaved = localStorage.getItem("focus_mode_theme");
  if (focusSaved === "dark" || focusSaved === "light") return focusSaved;
  return "dark";
}

export function setTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  localStorage.setItem("pinboard_theme", theme);
  localStorage.setItem("focus_mode_theme", theme);

  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }

  window.dispatchEvent(new CustomEvent("theme-changed", { detail: theme }));
}

export function toggleSiteTheme(): Theme {
  const current = getTheme();
  const next = current === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}
