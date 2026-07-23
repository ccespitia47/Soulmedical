import VaccinationConsentForm from "../components/consents/VaccinationConsentForm";

type ConsentimientosPageProps = {
  /** Vuelve al inicio de Consientify. */
  onBack?: () => void;
};

// Hoja "Consentimientos": punto de entrada del módulo de consentimientos.
// Por ahora muestra el Consentimiento de Vacunación; aquí se podrán añadir más
// tipos de consentimiento en el futuro.
export default function ConsentimientosPage({ onBack }: ConsentimientosPageProps) {
  return <VaccinationConsentForm onBack={onBack} />;
}
