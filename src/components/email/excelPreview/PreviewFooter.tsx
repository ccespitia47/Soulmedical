type PreviewFooterProps = {
  hasFormValues: boolean;
};

export default function PreviewFooter({ hasFormValues }: PreviewFooterProps) {
  return (
    <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-2.5 text-[11px] text-slate-500">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm border-2 border-[#00c2a8]" />
          Celda con campo mapeado
        </span>
        {!hasFormValues && (
          <span className="italic text-sky-700">
            [Texto entre corchetes] = valor de ejemplo
          </span>
        )}
      </div>
      <span className="text-slate-400">
        El PDF generado tendrá fondo blanco y sin marcas de color
      </span>
    </div>
  );
}
