import { useState } from "react";
import ConsentForm from "../components/consents/ConsentForm";
import { CONSENT_TYPES } from "../components/consents/definitions";
import type { ConsentTipo } from "../components/consents/definitions";
import Icon from "../components/common/Icon";

// Hoja "Consentimientos": punto de entrada del módulo de consentimientos.
// Muestra un selector de tarjetas (una por tipo de `CONSENT_TYPES`) y, al
// elegir una, renderiza el formulario genérico `ConsentForm` para ese tipo.
export default function ConsentimientosPage() {
  const [tipo, setTipo] = useState<ConsentTipo | null>(null);

  if (tipo) {
    return <ConsentForm tipo={tipo} onBack={() => setTipo(null)} />;
  }

  return (
    <div className="min-h-screen px-5 py-8 font-sans sm:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-3">
          <div>
            <h1 className="m-0 text-lg font-bold text-slate-900 dark:text-slate-100">
              Consentimientos
            </h1>
            <p className="m-0 text-xs text-slate-500 dark:text-slate-400">
              Selecciona el tipo de consentimiento a diligenciar
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {CONSENT_TYPES.map((t) => (
            <button
              key={t.tipo}
              type="button"
              onClick={() => setTipo(t.tipo)}
              className="flex flex-col items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-[#00c2a8]/50 hover:shadow-[0_10px_24px_-14px_rgba(0,194,168,0.4)] dark:border-slate-700 dark:bg-slate-900"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#00c2a8]/10 text-[#00c2a8]">
                <Icon name={t.icon} size={22} />
              </span>
              <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
