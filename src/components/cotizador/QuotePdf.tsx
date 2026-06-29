import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { ISSUER, BANK_INFO } from "@/lib/issuer";
import { fmtMXN, longDateEs } from "@/lib/finance";

export type QuoteItemPdf = {
  description: string;
  quantity: number;
  unit: string | null;
  line_total: number;
};

export type QuotePdfData = {
  number: number;
  date: Date;
  city: string;
  showClient: boolean;
  client?: { razon_social: string; nombre_comercial?: string | null; rfc: string } | null;
  items: QuoteItemPdf[];
  subtotal: number;
  iva: number;
  isr: number;
  total: number;
  applyIva: boolean;
  applyIsr: boolean;
  validity?: string | null;
  payment_terms?: string | null;
  delivery_time?: string | null;
  currency_note?: string | null;
  notes?: string | null;
  images?: string[];
};

const COLORS = {
  headerBlue: "#4472C4",
  rowBlue: "#D9E1F2",
  boxBg: "#D9D9D9",
  boxBorder: "#A6A6A6",
  text: "#1F2937",
  muted: "#4B5563",
};

const styles = StyleSheet.create({
  page: { paddingHorizontal: 40, paddingTop: 28, paddingBottom: 40, fontSize: 9, color: COLORS.text, fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  logo: { width: 90, height: 90, objectFit: "contain" },
  headerText: { flex: 1, textAlign: "center", paddingHorizontal: 8 },
  companyName: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  companyLine: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  companyMuted: { fontSize: 8, color: COLORS.muted },
  metaRight: { textAlign: "right", marginTop: 10 },
  metaDate: { fontSize: 9 },
  metaNumber: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 4 },
  clientBox: { marginTop: 12, marginBottom: 4 },
  clientLabel: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  clientLine: { fontSize: 9 },
  table: { marginTop: 14, borderWidth: 1, borderColor: COLORS.boxBorder },
  th: { backgroundColor: COLORS.headerBlue, color: "#FFFFFF", flexDirection: "row" },
  thCell: { fontFamily: "Helvetica-Bold", fontSize: 9, padding: 6 },
  tr: { flexDirection: "row", backgroundColor: COLORS.rowBlue, borderTopWidth: 1, borderTopColor: "#FFFFFF" },
  tdCell: { padding: 6, fontSize: 9 },
  colDesc: { flex: 6 },
  colQty: { flex: 1.6, textAlign: "center" },
  colTotal: { flex: 2, textAlign: "right" },
  totals: { marginTop: 16, alignItems: "flex-end" },
  totalLine: { fontSize: 10, marginBottom: 3 },
  totalStrong: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  boxesRow: { flexDirection: "row", marginTop: 28, gap: 16 },
  box: { flex: 1, backgroundColor: COLORS.boxBg, borderWidth: 1, borderColor: COLORS.boxBorder, padding: 8 },
  boxTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  boxText: { fontSize: 8, lineHeight: 1.4 },
  boxBeneficiary: { fontSize: 9, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 4 },
  imagesPage: { padding: 40 },
  imagesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 20 },
  imageWrap: { width: "46%", borderWidth: 1, borderColor: COLORS.boxBorder, padding: 4 },
  image: { width: "100%", height: 220, objectFit: "contain" },
});

function qtyLabel(quantity: number, unit: string | null): string {
  const q = Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2);
  if (!unit) return q;
  return quantity === 1 ? unit : `${q} ${unit}`;
}

function Header() {
  return (
    <View style={styles.headerRow}>
      <Image style={styles.logo} src={ISSUER.logo} />
      <View style={styles.headerText}>
        <Text style={styles.companyName}>{ISSUER.name}</Text>
        <Text style={styles.companyLine}>{ISSUER.tagline1}</Text>
        <Text style={styles.companyLine}>{ISSUER.tagline2}</Text>
        <Text style={styles.companyMuted}>{ISSUER.address}</Text>
        <Text style={styles.companyMuted}>{ISSUER.contact}</Text>
      </View>
    </View>
  );
}

export default function QuotePdf({ data }: { data: QuotePdfData }) {
  const noteLines = [
    data.validity ? `VIGENCIA DE LA COTIZACION: ${data.validity}` : null,
    data.currency_note ? `PRECIOS: ${data.currency_note}` : null,
    data.payment_terms ? `CONDICIONES DE PAGO: ${data.payment_terms}` : null,
    data.delivery_time ? `PLAZO DE ENTREGA: ${data.delivery_time}` : null,
    data.notes || null,
  ].filter(Boolean) as string[];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Header />

        <View style={styles.metaRight}>
          <Text style={styles.metaDate}>{data.city} A {longDateEs(data.date)}</Text>
          <Text style={styles.metaNumber}>COTIZACION: {data.number}</Text>
        </View>

        {data.showClient && data.client && (
          <View style={styles.clientBox}>
            <Text style={styles.clientLabel}>CLIENTE:</Text>
            <Text style={styles.clientLine}>{data.client.razon_social}</Text>
            {data.client.nombre_comercial ? (
              <Text style={styles.clientLine}>{data.client.nombre_comercial}</Text>
            ) : null}
            <Text style={styles.clientLine}>RFC: {data.client.rfc}</Text>
          </View>
        )}

        <View style={styles.table}>
          <View style={styles.th}>
            <Text style={[styles.thCell, styles.colDesc]}>DESCRIPCIÓN DE PRODUCTO</Text>
            <Text style={[styles.thCell, styles.colQty]}>CANTIDAD</Text>
            <Text style={[styles.thCell, styles.colTotal]}>TOTAL</Text>
          </View>
          {data.items.map((it, idx) => (
            <View style={styles.tr} key={idx} wrap={false}>
              <Text style={[styles.tdCell, styles.colDesc]}>{it.description}</Text>
              <Text style={[styles.tdCell, styles.colQty]}>{qtyLabel(it.quantity, it.unit)}</Text>
              <Text style={[styles.tdCell, styles.colTotal]}>{fmtMXN(it.line_total)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <Text style={styles.totalLine}>SUBTOTAL: {fmtMXN(data.subtotal)}</Text>
          {data.applyIsr && <Text style={styles.totalLine}>ISR: {fmtMXN(data.isr)}</Text>}
          {data.applyIva && <Text style={styles.totalLine}>IVA (16%): {fmtMXN(data.iva)}</Text>}
          <Text style={styles.totalStrong}>TOTAL: {fmtMXN(data.total)}</Text>
        </View>

        <View style={styles.boxesRow}>
          <View style={styles.box}>
            <Text style={styles.boxTitle}>NOTA:</Text>
            {noteLines.map((line, i) => (
              <Text style={styles.boxText} key={i}>{line}</Text>
            ))}
          </View>
          <View style={styles.box}>
            <Text style={styles.boxTitle}>DATOS BANCARIOS:</Text>
            <Text style={styles.boxBeneficiary}>{BANK_INFO.beneficiary}</Text>
            <Text style={styles.boxText}>{BANK_INFO.details}</Text>
          </View>
        </View>
      </Page>

      {data.images && data.images.length > 0 && (
        <Page size="A4" style={styles.imagesPage}>
          <Header />
          <View style={styles.imagesGrid}>
            {data.images.map((src, i) => (
              <View style={styles.imageWrap} key={i} wrap={false}>
                <Image style={styles.image} src={src} />
              </View>
            ))}
          </View>
        </Page>
      )}
    </Document>
  );
}
