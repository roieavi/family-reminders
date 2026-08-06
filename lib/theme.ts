export const THEME_STORAGE_KEY = "theme";

export type Theme = "light" | "dark";

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch (e) {
    return "light";
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (e) {}
}

// Runs before hydration (see app/layout.tsx) so a user who previously chose
// dark doesn't see a light flash. Everyone else defaults to light, even if
// their OS is set to dark - that default is what fixes the reported bug.
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    if (localStorage.getItem("${THEME_STORAGE_KEY}") === "dark") {
      document.documentElement.classList.add("dark");
    }
  } catch (e) {}
})();
`;
