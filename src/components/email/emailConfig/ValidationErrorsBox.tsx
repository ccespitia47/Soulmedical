type ValidationErrorsBoxProps = {
  errors: string[];
};

export default function ValidationErrorsBox({ errors }: ValidationErrorsBoxProps) {
  if (errors.length === 0) return null;
  return (
    <div className="mx-6 mb-4 rounded-[10px] border-[1.5px] border-red-200 bg-red-50 px-4 py-3">
      <div className="mb-1.5 text-[13px] font-bold text-red-600">
        ⚠️ Corrige los siguientes errores:
      </div>
      <ul className="m-0 pl-4 text-xs leading-7 text-red-900">
        {errors.map((e, i) => (
          <li key={i}>{e}</li>
        ))}
      </ul>
    </div>
  );
}
