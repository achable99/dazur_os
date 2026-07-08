import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { BANK_INFO } from "@/lib/issuer";
import { fmtMXN, longDateEs } from "@/lib/finance";
import { COLORS, pdfSharedStyles, IssuerHeader } from "@/components/pdf/pdfShared";

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

const styles = StyleSheet.create({
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
      <Page size="A4" style={pdfSharedStyles.page}>
        <IssuerHeader />

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
          <IssuerHeader />
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
