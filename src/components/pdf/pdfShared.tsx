import { Image, StyleSheet, Text, View } from "@react-pdf/renderer";
import { ISSUER } from "@/lib/issuer";

/**
 * Paleta y estilos compartidos entre los PDFs generados con @react-pdf/renderer
 * (cotizaciones, simulador de declaración). Mantiene el mismo look & feel
 * (colores, tipografía, encabezado del emisor) sin duplicar el StyleSheet en
 * cada documento.
 */
export const COLORS = {
  headerBlue: "#4472C4",
  rowBlue: "#D9E1F2",
  boxBg: "#D9D9D9",
  boxBorder: "#A6A6A6",
  text: "#1F2937",
  muted: "#4B5563",
};

export const pdfSharedStyles = StyleSheet.create({
  page: { paddingHorizontal: 40, paddingTop: 28, paddingBottom: 40, fontSize: 9, color: COLORS.text, fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  logo: { width: 90, height: 90, objectFit: "contain" },
  headerText: { flex: 1, textAlign: "center", paddingHorizontal: 8 },
  companyName: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  companyLine: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  companyMuted: { fontSize: 8, color: COLORS.muted },
});

/** Encabezado del emisor (logo + razón social/tagline/dirección/contacto). */
export function IssuerHeader() {
  return (
    <View style={pdfSharedStyles.headerRow}>
      <Image style={pdfSharedStyles.logo} src={ISSUER.logo} />
      <View style={pdfSharedStyles.headerText}>
        <Text style={pdfSharedStyles.companyName}>{ISSUER.name}</Text>
        <Text style={pdfSharedStyles.companyLine}>{ISSUER.tagline1}</Text>
        <Text style={pdfSharedStyles.companyLine}>{ISSUER.tagline2}</Text>
        <Text style={pdfSharedStyles.companyMuted}>{ISSUER.address}</Text>
        <Text style={pdfSharedStyles.companyMuted}>{ISSUER.contact}</Text>
      </View>
    </View>
  );
}
