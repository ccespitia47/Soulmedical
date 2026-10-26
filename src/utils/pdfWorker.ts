import { pdfjs } from "react-pdf";
// Vite `?url` sirve el worker desde el bundle local. Sin esto, react-pdf
// intenta cargarlo desde unpkg.com y el navegador lo bloquea por CORS.
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
