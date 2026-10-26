import { useEffect, useState } from "react";
import {
  listApiKeysApi,
  createApiKeyApi,
  revokeApiKeyApi,
  type ApiKeyDto,
} from "../services/api";
import ConfirmModal from "../components/common/ConfirmModal";
import Icon from "../components/common/Icon";
import { useTheme } from "../context/ThemeContext";

/**
 * Panel de gestión de API Keys (solo admin).
 *
 * Las keys se usan para que integraciones externas (MCP de Claude, Power BI,
 * SDK propio) hablen con la API sin JWT ni 2FA. El servidor emite la cadena
 * completa UNA sola vez en el response del POST; después solo se ven los
 * metadatos. Por eso el modal post-creación muestra la key con un botón de
 * copiar grande + aviso visible de que es la única vez que se verá.
 */
export default function ApiKeysPage() {
  const { T } = useTheme();
  const [keys, setKeys] = useState<ApiKeyDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [justCreated, setJustCreated] = useState<ApiKeyDto | null>(null);
  const [copied, setCopied] = useState(false);

  const [confirmRevoke, setConfirmRevoke] = useState<ApiKeyDto | null>(null);
  const [revoking, setRevoking] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await listApiKeysApi();
    if (res.data) setKeys(res.data);
    else setErrorMsg(res.error ?? "Error al cargar las API keys");
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      setCreateError("Dale un nombre a la key (ej: 'MCP Claude', 'Power BI prod').");
      return;
    }
    setCreating(true);
    setCreateError("");
    const res = await createApiKeyApi(name);
    setCreating(false);
    if (res.error || !res.data) {
      setCreateError(res.error ?? "No se pudo crear la key");
      return;
    }
    setJustCreated(res.data);
    setShowCreate(false);
    setNewName("");
    load();
  };

  const handleRevoke = async () => {
    if (!confirmRevoke) return;
    setRevoking(true);
    const res = await revokeApiKeyApi(confirmRevoke.id);
    setRevoking(false);
    if (res.error) {
      setErrorMsg(res.error);
      return;
    }
    setConfirmRevoke(null);
    load();
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback silencioso: el usuario puede seleccionar manualmente.
    }
  };

  const maskKey = (key: string) => {
    // Las keys siguen el shape sk_<64 hex chars>. Mostramos prefijo y los
    // últimos 4 para identificarlas sin exponer el valor.
    if (key.length <= 10) return key;
    return `${key.slice(0, 7)}…${key.slice(-4)}`;
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("es-CO", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="min-h-screen px-4 py-6 md:px-8" style={{ background: T.bg }}>
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="m-0 text-2xl font-bold" style={{ color: T.textStrong }}>
              API Keys
            </h1>
            <p className="mt-1 text-sm" style={{ color: T.textMuted }}>
              Claves para integraciones externas (MCP, Power BI, scripts). Solo visibles para administradores.
            </p>
          </div>
          <button
            onClick={() => {
              setShowCreate(true);
              setCreateError("");
              setNewName("");
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg border-none px-4 py-2.5 text-sm font-semibold text-white"
            style={{
              background: "linear-gradient(135deg,#00c2a8,#0891b2)",
              boxShadow: "0 4px 14px rgba(0,194,168,0.35)",
            }}
          >
            <Icon name="plus" size={16} />
            Crear nueva key
          </button>
        </div>

        {/* Error global */}
        {errorMsg && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        {/* Lista */}
        <div
          className="overflow-hidden rounded-xl border"
          style={{ borderColor: T.border, background: T.bgElev }}
        >
          {loading ? (
            <div className="px-6 py-10 text-center text-sm" style={{ color: T.textMuted }}>
              Cargando…
            </div>
          ) : keys.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: T.bgHover }}>
                <Icon name="key" size={22} />
              </div>
              <p className="text-sm font-semibold" style={{ color: T.textStrong }}>
                No hay API keys creadas
              </p>
              <p className="mt-1 text-xs" style={{ color: T.textMuted }}>
                Crea una para conectar el MCP de Claude u otras integraciones.
              </p>
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr
                  className="border-b text-left text-[11px] uppercase tracking-wider"
                  style={{ borderColor: T.border, color: T.textMuted }}
                >
                  <th className="px-5 py-3 font-semibold">Nombre</th>
                  <th className="px-5 py-3 font-semibold">Key</th>
                  <th className="px-5 py-3 font-semibold">Estado</th>
                  <th className="px-5 py-3 font-semibold">Creada</th>
                  <th className="px-5 py-3 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr
                    key={k.id}
                    className="border-b text-sm last:border-b-0"
                    style={{ borderColor: T.border }}
                  >
                    <td className="px-5 py-3 font-semibold" style={{ color: T.textStrong }}>
                      {k.name}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs" style={{ color: T.textMuted }}>
                      {maskKey(k.key)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                        style={{
                          background: k.isActive ? "#ecfdf5" : "#fef2f2",
                          color: k.isActive ? "#059669" : "#b91c1c",
                        }}
                      >
                        {k.isActive ? "Activa" : "Revocada"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs" style={{ color: T.textMuted }}>
                      {formatDate(k.createdAt)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {k.isActive && (
                        <button
                          onClick={() => setConfirmRevoke(k)}
                          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
                        >
                          Revocar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal: crear */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => !creating && setShowCreate(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
            style={{ background: T.bgElev }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="m-0 text-lg font-bold" style={{ color: T.textStrong }}>
              Nueva API Key
            </h2>
            <p className="mt-1 mb-4 text-xs" style={{ color: T.textMuted }}>
              Dale un nombre descriptivo para identificar dónde la vas a usar.
            </p>
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="MCP Claude Code"
              className="mb-3 w-full rounded-lg border-[1.5px] px-3 py-2.5 text-sm outline-none"
              style={{ borderColor: T.border, background: T.bg, color: T.textStrong }}
            />
            {createError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {createError}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreate(false)}
                disabled={creating}
                className="rounded-lg border-[1.5px] bg-transparent px-4 py-2 text-sm font-semibold"
                style={{ borderColor: T.border, color: T.text }}
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="rounded-lg border-none px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg,#00c2a8,#0891b2)",
                }}
              >
                {creating ? "Creando…" : "Crear"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: key recién creada (se muestra una sola vez) */}
      {justCreated && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div
            className="w-full max-w-lg rounded-2xl p-6 shadow-2xl"
            style={{ background: T.bgElev }}
          >
            <div className="mb-3 flex items-center gap-2">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full"
                style={{ background: "#ecfdf5" }}
              >
                <Icon name="check" size={18} />
              </div>
              <h2 className="m-0 text-lg font-bold" style={{ color: T.textStrong }}>
                Key creada
              </h2>
            </div>
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
              ⚠ Copia la key ahora. Por seguridad no la volverás a ver completa después de cerrar este diálogo.
            </div>
            <div
              className="mb-4 rounded-lg border px-3 py-3 font-mono text-[13px] break-all"
              style={{ borderColor: T.border, background: T.bg, color: T.textStrong }}
            >
              {justCreated.key}
            </div>
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => copyToClipboard(justCreated.key)}
                className="inline-flex items-center gap-2 rounded-lg border-[1.5px] bg-white px-3.5 py-2 text-xs font-semibold"
                style={{ borderColor: T.border, color: T.textStrong }}
              >
                <Icon name="copy" size={14} />
                {copied ? "Copiado ✓" : "Copiar al portapapeles"}
              </button>
              <button
                onClick={() => setJustCreated(null)}
                className="rounded-lg border-none bg-[linear-gradient(135deg,#00c2a8,#0891b2)] px-4 py-2 text-sm font-semibold text-white"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: revocar */}
      {confirmRevoke && (
        <ConfirmModal
          title="Revocar API key"
          message={`Vas a revocar "${confirmRevoke.name}". Las integraciones que la usen dejarán de funcionar inmediatamente. Esta acción no se puede deshacer.`}
          confirmLabel={revoking ? "Revocando…" : "Revocar"}
          confirmColor="#ef4444"
          onConfirm={handleRevoke}
          onCancel={() => setConfirmRevoke(null)}
          busy={revoking}
        />
      )}
    </div>
  );
}
