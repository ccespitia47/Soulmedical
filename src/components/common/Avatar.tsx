/**
 * Avatar moderno con iniciales del usuario en un círculo con degradado.
 * Reemplaza los avatares tipo emoji. Solo presentación.
 */

type AvatarProps = {
  name: string;
  /** Diámetro en px. */
  size?: number;
  /** Color base del degradado (por defecto teal de marca). */
  color?: string;
  className?: string;
};

function getInitials(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Oscurece un color hex para el segundo stop del degradado. */
function darken(hex: string, amount = 0.22): string {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = Math.round(parseInt(n.slice(0, 2), 16) * (1 - amount));
  const g = Math.round(parseInt(n.slice(2, 4), 16) * (1 - amount));
  const b = Math.round(parseInt(n.slice(4, 6), 16) * (1 - amount));
  return `rgb(${r}, ${g}, ${b})`;
}

export default function Avatar({ name, size = 36, color = "#00c2a8", className = "" }: AvatarProps) {
  const initials = getInitials(name);
  return (
    <div
      className={`flex flex-shrink-0 select-none items-center justify-center rounded-full font-bold uppercase leading-none tracking-tight text-white ring-1 ring-white/25 ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.4),
        background: `linear-gradient(135deg, ${color}, ${darken(color)})`,
        boxShadow: `0 4px 10px -3px ${color}66`,
      }}
      title={name}
      aria-label={name}
    >
      {initials}
    </div>
  );
}
