import { quotationDraftSchema } from "../src/features/quotations/domain";
export function exampleQuotation() {
  return quotationDraftSchema.parse({
    passenger: "Familia Salattino",
    passengers: 4,
    destination: "Río de Janeiro, Brasil",
    startDate: "2027-01-15",
    endDate: "2027-01-22",
    amount: "2480",
    currency: "USD",
    exchangeRate: "1520",
    validityHours: 72,
    board: "Media pensión",
    carryOn: 4,
    checkedBags: 2,
    baggageNotes:
      "Bodega: piezas de hasta 23 kg.\nEl equipaje puede variar según tramo/tarifa.",
    transport: "Mixto",
    roundTrip: false,
    legs: [
      { mode: "Aéreo", from: "Mendoza", to: "Buenos Aires" },
      { mode: "Aéreo", from: "Buenos Aires", to: "Río de Janeiro" },
      { mode: "Bus", from: "Aeropuerto", to: "Hotel" },
    ],
    lodging: true,
    nights: 7,
    hotels: [
      {
        name: "Hotel Atlântico Copacabana 4*",
        board: "Media pensión",
        price: "2480",
      },
      {
        name: "Windsor Plaza Copacabana 4*",
        board: "Solo desayuno",
        price: "2260",
      },
    ],
    assistance: true,
    assistanceName: "Plan Regional Plus",
    assistanceNotes: "Cobertura durante toda la estadía.",
    transfers: true,
    transferNotes:
      "Aeropuerto - hotel incluidos.\nHorarios sujetos a la confirmación de los vuelos.",
    excursions: true,
    excursionDetails:
      "City Tour + Cristo Redentor.\nNo incluye entradas ni consumos no detallados.",
    notes:
      "Aquí podés incluir notas, condiciones especiales, formas de pago, políticas de cancelación u otra información relevante para el pasajero.",
  });
}
