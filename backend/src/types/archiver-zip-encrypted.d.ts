// Shim minimo para `archiver-zip-encrypted` (sin @types propios).
// El paquete exporta un "format" que se registra en archiver.registerFormat().
declare module 'archiver-zip-encrypted' {
  const registerFormat: unknown;
  export = registerFormat;
}
