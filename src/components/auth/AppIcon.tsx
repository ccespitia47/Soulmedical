import type { AppOption } from "./LoginModal";

type AppIconProps = {
  id: AppOption["id"];
  className?: string;
};

/**
 * Iconos de línea, modernos y consistentes (mismo grosor y remate),
 * dibujados a mano para cada aplicación. Reemplazan a los emoji.
 *  - soulforms  → formulario clínico con línea de pulso
 *  - consientify → escudo con check (consentimiento otorgado)
 */
export default function AppIcon({ id, className }: AppIconProps) {
  if (id === "soulforms") {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M8 4.5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-12a2 2 0 0 0-2-2h-1" />
        <rect x="9" y="3" width="6" height="3.2" rx="1" />
        <path d="M7.6 13.4h2.1l1.3-2.9 1.9 5 1-2.1h2.5" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3.2 19 6v5c0 4.2-2.9 7.4-7 9-4.1-1.6-7-4.8-7-9V6z" />
      <path d="M9 11.7l2.1 2.1L15.3 9.6" />
    </svg>
  );
}
