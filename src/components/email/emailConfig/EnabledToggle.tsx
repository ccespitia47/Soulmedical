type EnabledToggleProps = {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
};

export default function EnabledToggle({ enabled, onChange }: EnabledToggleProps) {
  return (
    <label
      className="mb-6 flex cursor-pointer items-center gap-2.5 rounded-[10px] border-2 p-4"
      style={{
        background: enabled ? "#e6faf7" : "#f9fafb",
        borderColor: enabled ? "#00c2a8" : "#e2e8f0",
      }}
    >
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-[18px] w-[18px] cursor-pointer"
      />
      <div>
        <div className="text-sm font-semibold text-gray-900">
          Activar notificación por email
        </div>
        <div className="mt-0.5 text-xs text-gray-500">
          Se enviará un email automáticamente cuando alguien complete este
          formulario
        </div>
      </div>
    </label>
  );
}
