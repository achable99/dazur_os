import logo from "@/assets/logo.png";

/** Datos fijos del emisor que aparecen en el encabezado de las cotizaciones. */
export const ISSUER = {
  logo,
  name: "DAZUR",
  tagline1: "DUCTERÍA • EXTRACTORES • INYECTORES • HERRERÍA EN GENERAL",
  tagline2: "SERVICIOS DE MANTENIMIENTO EN GENERAL",
  address: "CALLE 53 #351E POR 22 Y 24 COL. CENTRO MÉRIDA, YUCATÁN, MÉXICO",
  contact: "Admon.dazur@outlook.com – Cel. 999-601-2915",
};

/** Datos bancarios que se imprimen en el recuadro inferior derecho. */
export const BANK_INFO = {
  beneficiary: "DANIELA CONCEPCION SANSORES MEDRANO",
  details:
    "FAVOR DE DEPOSITAR A LA CUENTA BANCARIA DEL BANCO: BBVA CON NÚMERO DE CUENTA: 1523462255 Y CLABE INTERBANCARIA: 12910015234622500",
};

/** Valores por defecto del recuadro de NOTA al crear una cotización nueva. */
export const QUOTE_DEFAULTS = {
  city: "Mérida, Yucatán",
  validity: "2 DIAS",
  payment_terms: "60% DE ANTICIPO Y FINIQUITO CONTRAENTREGA",
  delivery_time: "15 DIAS HABILES",
  currency_note: "MONEDA NACIONAL",
};
