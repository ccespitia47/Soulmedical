import type { ReactNode } from "react";

type AuthLayoutProps = {
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg";
};

const MAX_WIDTHS: Record<NonNullable<AuthLayoutProps["maxWidth"]>, string> = {
  sm: "max-w-[420px]",
  md: "max-w-[480px]",
  lg: "max-w-[520px]",
};

export default function AuthLayout({ children, maxWidth = "sm" }: AuthLayoutProps) {
  return (
    <div
      className="relative flex min-h-screen w-full items-center justify-center bg-cover bg-center font-sans"
      style={{ backgroundImage: "url('/Imagen_Fondo.jpeg')" }}
    >
      <div className="absolute inset-0 bg-[rgba(8,40,80,0.18)] backdrop-blur-[1px]" />
      <div className={`relative z-10 mx-4 w-full ${MAX_WIDTHS[maxWidth]}`}>{children}</div>
    </div>
  );
}
