// eslint-disable-next-line @typescript-eslint/no-require-imports
const XlsxPopulate = require('xlsx-populate');

/**
 * Cifra un buffer XLSX en claro aplicando el estándar OOXML AES-256
 * (ECMA-376 4th ed. / ISO/IEC 29500). El resultado es un archivo Excel
 * cifrado nativo: al abrirlo, Excel/LibreOffice piden password.
 *
 * `password` es el que el usuario final tendrá que ingresar (en nuestro
 * flujo, el número de documento).
 */
export async function encryptXlsxOoxml(
  xlsxBuffer: Buffer,
  password: string,
): Promise<Buffer> {
  // Load the XLSX workbook from the plain buffer
  const workbook = await XlsxPopulate.fromDataAsync(xlsxBuffer);

  // Encrypt it with the provided password using OOXML AES-256
  const encryptedData = await workbook.outputAsync({ password });

  return encryptedData;
}
