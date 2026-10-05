import type { Comment, PassengerPhoto, Trip } from "../types";

export const whatsappUrl = "https://wa.me/542615458242";
export const commentsEmail = "stglorena@hotmail.com";
export const companyAddress =
  "Las Heras 418, Galeria del Sol, local 28. Ciudad de Mendoza, Mendoza.";
export const mapsUrl = "https://maps.app.goo.gl/9Rv9w8jvXLCsnZaM9";
export const receiptSystemUrl =
  "https://docs.google.com/spreadsheets/d/17GlSfT7Yb3uPvkxuUnWNn7cF5nJKjOKCZS_c4i52i9k/edit?gid=708542243#gid=708542243";

export const initialTrips: Trip[] = [
  {
    id: "mendoza-aventura",
    title: "Mendoza aventura",
    description:
      "Escapada grupal con bodegas, paisajes cordilleranos, city tour y asistencia permanente.",
    imageUrl:
      "https://images.unsplash.com/photo-1589909202802-8f4aadce1849?auto=format&fit=crop&w=1200&q=80",
    pdfUrl: "/pdfs/mendoza-aventura.pdf",
    featured: true,
  },
  {
    id: "norte-magico",
    title: "Norte magico",
    description:
      "Salta y Jujuy en un recorrido lleno de colores, cultura local, peñas y excursiones imperdibles.",
    imageUrl:
      "https://images.unsplash.com/photo-1601042879364-f3947d3f9c16?auto=format&fit=crop&w=1200&q=80",
    pdfUrl: "/pdfs/norte-magico.pdf",
    featured: true,
  },
  {
    id: "bariloche-grupal",
    title: "Bariloche grupal",
    description:
      "Naturaleza patagonica, lagos, cerros y coordinacion completa para viajar tranquilo.",
    imageUrl:
      "https://images.unsplash.com/photo-1598791503410-0c0872a3edb1?auto=format&fit=crop&w=1200&q=80",
    pdfUrl: "/pdfs/bariloche-grupal.pdf",
    featured: true,
  },
];

export const initialPassengerPhotos: PassengerPhoto[] = [
  {
    id: "pasajeros-mendoza",
    title: "Grupo en Mendoza",
    description: "Pasajeros disfrutando una salida organizada por STG.",
    imageUrl:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "pasajeros-ruta",
    title: "Viaje grupal",
    description: "Momentos compartidos durante una experiencia de turismo.",
    imageUrl:
      "https://images.unsplash.com/photo-1503220317375-aaad61436b1b?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "pasajeros-amigos",
    title: "Pasajeros STG",
    description: "Fotos enviadas por pasajeros despues del viaje.",
    imageUrl:
      "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "pasajeros-destino",
    title: "Destino compartido",
    description: "Recuerdos de salidas y excursiones.",
    imageUrl:
      "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=900&q=80",
  },
];

export const passengerComments: Comment[] = [
  {
    name: "Carla M.",
    trip: "Mendoza aventura",
    text: "Todo estuvo organizado de principio a fin. Viajamos relajados y volvimos con ganas de repetir.",
  },
  {
    name: "Lucas R.",
    trip: "Norte magico",
    text: "La coordinacion fue excelente y el grupo muy lindo. Se nota la experiencia en cada detalle.",
  },
  {
    name: "Sofia G.",
    trip: "Bariloche grupal",
    text: "Me senti acompanada todo el viaje. Muy buena comunicacion antes, durante y despues.",
  },
];
