import { randomUUID } from "node:crypto";
import {
  type ContractData,
  contractDraftSchema,
} from "../src/features/contracts/domain";
export function exampleContract(): ContractData {
  return contractDraftSchema.parse({
    destination: "Bariloche - Verano 2027",
    reservationNumber: "STG-2027-0042",
    departure: {
      date: "2027-01-15",
      time: "08:30",
      place: "Mendoza - Terminal de Ómnibus",
    },
    return: {
      date: "2027-01-22",
      time: "19:00",
      place: "Mendoza - Terminal de Ómnibus",
    },
    hotels: [
      {
        id: randomUUID(),
        name: "Hotel del Lago",
        stars: 4,
        checkIn: "2027-01-16",
        checkOut: "2027-01-21",
        rooms: [{ id: randomUUID(), type: "Doble matrimonial", quantity: 1 }],
        meals: ["Media pensión"],
      },
    ],
    excursions: [
      { id: randomUUID(), description: "Circuito Chico con guía y traslado." },
    ],
    transport: [
      {
        id: randomUUID(),
        type: "Aéreo",
        seat: null,
        description:
          "Aerolíneas Argentinas - Mendoza / Bariloche - Ida y vuelta.",
      },
    ],
    passengers: [
      {
        id: randomUUID(),
        name: "María Pérez",
        dni: "30123456",
        birthDate: "1983-05-20",
        phone: "261 555 0101",
      },
      {
        id: randomUUID(),
        name: "Juan García",
        dni: "28987654",
        birthDate: "1981-09-14",
        phone: "",
      },
    ],
    currency: "ARS",
    unitPrice: "149900.50",
    totalOverride: null,
    deposit: "50000",
    exchangeRate: "1",
    rateSource: "ars",
    quoteUpdatedAt: null,
    notes: "Presentarse 30 minutos antes de la salida con DNI vigente.",
  });
}

export function maximumContract(): ContractData {
  const data = exampleContract();
  return contractDraftSchema.parse({
    ...data,
    hotels: [0, 1, 2].map((i) => ({
      ...data.hotels[0],
      id: randomUUID(),
      name: `Hotel Patagonia ${i + 1}`,
      checkIn: ["2027-01-16", "2027-01-17", "2027-01-19"][i],
      checkOut: ["2027-01-17", "2027-01-19", "2027-01-21"][i],
      rooms: [
        { id: randomUUID(), type: "Doble matrimonial", quantity: 2 },
        { id: randomUUID(), type: "Single", quantity: 2 },
      ],
      meals: [["Desayuno"], ["Media pensión"], ["Pensión completa"]][i],
    })),
    passengers: Array.from({ length: 6 }, (_, i) => ({
      ...data.passengers[0],
      id: randomUUID(),
      name: [
        "María del Carmen Pérez",
        "Juan Carlos García",
        "Ana Sofía Rodríguez",
        "Luis Alberto Fernández",
        "Lucía González López",
        "Pedro Martín Sánchez",
      ][i],
      dni: String(30123456 + i),
      phone: i % 2 === 0 ? "261 555 0101" : "",
    })),
    transport: [
      {
        id: randomUUID(),
        type: "Bus",
        seat: "Cama",
        description: "Bus ida y vuelta. Mendoza / Bariloche.",
      },
      ...data.transport,
    ],
    currency: "USD",
    unitPrice: "1200",
    totalOverride: "7000",
    deposit: "1000",
    exchangeRate: "1520",
    rateSource: "manual",
  });
}
