import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { fmtMXN, longDateEs, pctLabel, ISR_RATE, ISR_PROVISION_RATE } from "@/lib/finance";
import { COLORS, pdfSharedStyles, IssuerHeader } from "@/components/pdf/pdfShared";

export type DeclarationPdfData = {
  isAnnual: boolean;
  periodLabel: string;
  generatedAt: Date;
  ingresosCobrados: number;
  isrBase: number;
  totalPendiente: number;
  ivaTrasladado: number;
  ivaAcreditableBase: number;
  ivaAcreditableAjuste: number;
  ivaAcreditable: number;
  carryIvaFavor: number;
  ivaResultado: number;
  isrRate: number;
  isrCausado: number;
  isrExceeded: boolean;
  isrRetenido: number;
  provisionPropia: number;
  provisionTotal: number;
  isrACargo: number;
  provisionSobrante: number;
  annualBrief: {
    base: number;
    rate: number;
    isr: number;
    exceeded: boolean;
    retenido: number;
    total: number;
    propia: number;
    sobrante: number;
  };
};

const styles = StyleSheet.create({
  titleBlock: { alignItems: "center", marginTop: 16, marginBottom: 12 },
  titleText: { fontSize: 13, fontFamily: "Helvetica-Bold", letterSpacing: 0.5 },
  periodText: { fontSize: 10, fontFamily: "Helvetica-Bold", color: COLORS.muted, marginTop: 4 },
  generatedText: { fontSize: 8, color: COLORS.muted, marginTop: 2 },
  sectionTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 16, marginBottom: 6, textTransform: "uppercase" },
  sectionSpacer: { marginTop: 16 },
  infoBox: { borderWidth: 1, borderColor: COLORS.boxBorder, padding: 8 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  infoRowLast: { flexDirection: "row", justifyContent: "space-between" },
  infoLabel: { fontSize: 9, color: COLORS.muted, flex: 5 },
  infoValue: { fontSize: 9, fontFamily: "Helvetica-Bold", flex: 2, textAlign: "right" },
  infoValueBold: { fontSize: 10, fontFamily: "Helvetica-Bold", flex: 2, textAlign: "right" },
  noteText: { fontSize: 8, color: COLORS.muted, marginTop: 6, lineHeight: 1.4 },
  table: { marginTop: 2, borderWidth: 1, borderColor: COLORS.boxBorder },
  th: { backgroundColor: COLORS.headerBlue, flexDirection: "row" },
  thCell: { fontFamily: "Helvetica-Bold", fontSize: 9, padding: 6, color: "#FFFFFF" },
  tr: { flexDirection: "row", backgroundColor: COLORS.rowBlue, borderTopWidth: 1, borderTopColor: "#FFFFFF" },
  trStrong: { flexDirection: "row", backgroundColor: COLORS.boxBg, borderTopWidth: 1, borderTopColor: COLORS.boxBorder },
  tdCell: { padding: 6, fontSize: 9 },
  tdCellStrong: { padding: 7, fontSize: 10, fontFamily: "Helvetica-Bold" },
  colLabel: { flex: 5 },
  colValue: { flex: 2, textAlign: "right" },
  alertBox: { marginTop: 6, backgroundColor: COLORS.boxBg, borderWidth: 1, borderColor: COLORS.boxBorder, padding: 6 },
  alertText: { fontSize: 8, lineHeight: 1.4 },
  footer: { marginTop: 24, borderTopWidth: 1, borderTopColor: COLORS.boxBorder, paddingTop: 8 },
  footerText: { fontSize: 7.5, color: COLORS.muted, lineHeight: 1.4, textAlign: "center" },
});

function InfoRow({ label, value, bold, last }: { label: string; value: number; bold?: boolean; last?: boolean }) {
  return (
    <View style={last ? styles.infoRowLast : styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={bold ? styles.infoValueBold : styles.infoValue}>{fmtMXN(value)}</Text>
    </View>
  );
}

function KVTable({
  title,
  rows,
  highlight,
}: {
  title: string;
  rows: { label: string; value: number }[];
  highlight: { label: string; value: number };
}) {
  return (
    <View style={styles.table}>
      <View style={styles.th}>
        <Text style={styles.thCell}>{title}</Text>
      </View>
      {rows.map((r, i) => (
        <View style={styles.tr} key={i}>
          <Text style={[styles.tdCell, styles.colLabel]}>{r.label}</Text>
          <Text style={[styles.tdCell, styles.colValue]}>{fmtMXN(r.value)}</Text>
        </View>
      ))}
      <View style={styles.trStrong}>
        <Text style={[styles.tdCellStrong, styles.colLabel]}>{highlight.label}</Text>
        <Text style={[styles.tdCellStrong, styles.colValue]}>{fmtMXN(highlight.value)}</Text>
      </View>
    </View>
  );
}

export default function DeclarationPdf({ data }: { data: DeclarationPdfData }) {
  const ivaRows: { label: string; value: number }[] = [
    { label: "IVA trasladado", value: data.ivaTrasladado },
  ];
  if (data.ivaAcreditableAjuste !== 0) {
    ivaRows.push({ label: "IVA acreditable (base)", value: data.ivaAcreditableBase });
    ivaRows.push({ label: "Ajuste a IVA acreditable", value: data.ivaAcreditableAjuste });
    ivaRows.push({ label: "IVA acreditable total", value: data.ivaAcreditable });
  } else {
    ivaRows.push({ label: "IVA acreditable", value: data.ivaAcreditable });
  }
  if (data.carryIvaFavor > 0) {
    ivaRows.push({ label: "IVA a favor de períodos previos", value: -data.carryIvaFavor });
  }
  const ivaHighlight = data.ivaResultado > 0
    ? { label: "IVA a pagar", value: data.ivaResultado }
    : { label: "IVA a favor", value: Math.abs(data.ivaResultado) };

  const isrRows: { label: string; value: number }[] = [
    { label: `ISR del ${data.isAnnual ? "ejercicio" : "mes"} (${pctLabel(data.isrRate)})`, value: data.isrCausado },
    { label: `Retenido por clientes (${pctLabel(ISR_RATE)} morales)`, value: data.isrRetenido },
    { label: "Provisión propia", value: data.provisionPropia },
    { label: `Total provisionado (${pctLabel(ISR_PROVISION_RATE)})`, value: data.provisionTotal },
    { label: "ISR a cargo (cubierto con provisión propia)", value: data.isrACargo },
  ];
  const isrHighlight = { label: "Provisión ISR sobrante (para anual)", value: data.provisionSobrante };

  return (
    <Document>
      <Page size="A4" style={pdfSharedStyles.page}>
        <IssuerHeader />

        <View style={styles.titleBlock}>
          <Text style={styles.titleText}>
            {data.isAnnual ? "SIMULADOR DE DECLARACIÓN ANUAL" : "SIMULADOR DE DECLARACIÓN MENSUAL"}
          </Text>
          <Text style={styles.periodText}>{data.periodLabel}</Text>
          <Text style={styles.generatedText}>Generado el {longDateEs(data.generatedAt)}</Text>
        </View>

        <Text style={styles.sectionTitle}>Ingresos</Text>
        <View style={styles.infoBox}>
          <InfoRow label="Ingresos cobrados del período (con IVA)" value={data.ingresosCobrados} />
          <InfoRow label="Base gravable cobrada (sin IVA)" value={data.isrBase} />
          <InfoRow label="Pendiente de cobro (informativo)" value={data.totalPendiente} last />
        </View>
        <Text style={styles.noteText}>
          Bajo flujo de efectivo, los ingresos pendientes de cobro se declaran hasta el mes en que efectivamente se cobren.
        </Text>

        <KVTable title="IVA" rows={ivaRows} highlight={ivaHighlight} />

        <View style={styles.sectionSpacer} />
        <KVTable title="ISR (RESICO)" rows={isrRows} highlight={isrHighlight} />
        {data.isrExceeded && (
          <View style={styles.alertBox}>
            <Text style={styles.alertText}>
              La base cobrada rebasa el tope de $3,500,000 de RESICO. Se aplicó la tasa máxima ({pctLabel(ISR_PROVISION_RATE)}).
            </Text>
          </View>
        )}

        {!data.isAnnual && (
          <>
            <Text style={styles.sectionTitle}>Acumulado Anual de ISR</Text>
            <View style={styles.infoBox}>
              <InfoRow label="Base cobrada del ejercicio" value={data.annualBrief.base} />
              <InfoRow
                label={`ISR anual causado (tasa ${pctLabel(data.annualBrief.rate)})`}
                value={data.annualBrief.isr}
              />
              <InfoRow label="Retenido acumulado" value={data.annualBrief.retenido} />
              <InfoRow label="Total provisionado acumulado" value={data.annualBrief.total} />
              <InfoRow label="Provisión sobrante acumulada" value={data.annualBrief.sobrante} bold last />
            </View>
            <Text style={styles.noteText}>
              Llevas provisionado {fmtMXN(data.annualBrief.total)} contra un ISR anual causado de{" "}
              {fmtMXN(data.annualBrief.isr)}
              {data.annualBrief.total >= data.annualBrief.isr
                ? ", suficiente para cubrirlo hasta este punto del ejercicio."
                : ", por debajo de lo requerido: conviene reforzar la provisión."}
            </Text>
          </>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Documento informativo generado por DazurOS. Es una simulación con fines de planeación; no constituye una
            declaración oficial ante el SAT.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
