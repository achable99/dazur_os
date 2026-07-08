import type { ReactElement } from "react";
import { pdf } from "@react-pdf/renderer";

/**
 * Renders a @react-pdf/renderer <Document> element to a blob and triggers a
 * browser download, then cleans up the temporary object URL. Shared by every
 * PDF download entry point (declaración fiscal, cotizaciones) to avoid
 * duplicating the blob → createObjectURL → <a>.click() → revoke sequence.
 */
export async function downloadPdfDocument(element: ReactElement, filename: string): Promise<void> {
  const blob = await pdf(element).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
