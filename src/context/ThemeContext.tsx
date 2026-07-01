import { createContext, useContext, useState } from "react";

export type Theme = "dark" | "midnight" | "light";
export type Density = "compact" | "regular" | "comfy";

export interface ThemeTokens {
  bg: string;
  bgElev: string;
  bgHover: string;
  border: string;
  text: string;
  textStrong: string;
  textMuted: string;
  label: string;
  badgeBg: string;
  badgeText: string;
  inputBg: string;
  inputBorder: string;
  placeholder: string;
  kbdBg: string;
  kbdText: string;
  nestBorder: string;
}

export interface DensityTokens {
  rowPad: string;
  nestPad: string;
  fs: number;
  fsProj: number;
  gap: number;
  avatarSize: number;
}

/**
 * Tokens estáticos que apuntan a CSS variables. Los valores reales viven en
 * index.css bajo [data-theme="..."], el navegador los resuelve según el theme
 * activo. Cambiar de theme NO crea un objeto nuevo: solo cambia data-theme.
 */
const T: ThemeTokens = {
  bg: "var(--theme-bg)",
  bgElev: "var(--theme-bg-elev)",
  bgHover: "var(--theme-bg-hover)",
  border: "var(--theme-border)",
  text: "var(--theme-text)",
  textStrong: "var(--theme-text-strong)",
  textMuted: "var(--theme-text-muted)",
  label: "var(--theme-label)",
  badgeBg: "var(--theme-badge-bg)",
  badgeText: "var(--theme-badge-text)",
  inputBg: "var(--theme-input-bg)",
  inputBorder: "var(--theme-input-border)",
  placeholder: "var(--theme-placeholder)",
  kbdBg: "var(--theme-kbd-bg)",
  kbdText: "var(--theme-kbd-text)",
  nestBorder: "var(--theme-nest-border)",
};

export const THEMES: Record<Theme, ThemeTokens> = {
  light: T,
  dark: T,
  midnight: T,
};

export const DENSITY: Record<Density, DensityTokens> = {
  compact: { rowPad: "6px 8px",   nestPad: "5px 8px",   fs: 11.5, fsProj: 12,   gap: 8,  avatarSize: 13 },
  regular: { rowPad: "8px 10px",  nestPad: "6px 8px",   fs: 12,   fsProj: 12.5, gap: 9,  avatarSize: 14 },
  comfy:   { rowPad: "10px 12px", nestPad: "8px 10px",  fs: 12.5, fsProj: 13.5, gap: 11, avatarSize: 16 },
};

export const ACCENT = "#00c2a8";

interface ThemeContextValue {
  theme: Theme;
  density: Density;
  T: ThemeTokens;
  D: DensityTokens;
  setTheme: (t: Theme) => void;
  setDensity: (d: Density) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [density, setDensity] = useState<Density>("regular");

  return (
    <ThemeContext.Provider
      value={{ theme, density, T, D: DENSITY[density], setTheme, setDensity }}
    >
      <div
        data-theme={theme}
        className="min-h-screen font-sans transition-colors"
        style={{ background: T.bg, color: T.text }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
