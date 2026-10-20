import type { Trip } from "@/types";

type MapDestination = {
  id: string;
  name: string;
  country: string;
  matches: RegExp;
  matchDescription?: boolean;
  longitude: number;
  latitude: number;
  markerX: number;
  markerY: number;
  imageUrl: string;
  demo?: { title: string; description: string };
};

// Same projection as public/maps/latin-america.svg. Leader lines let the
// Argentine markers keep separate 44px touch targets on a 320px-wide screen.
const destinations: MapDestination[] = [
  {
    id: "punta-cana",
    name: "Punta Cana",
    country: "República Dominicana",
    matches: /\bpunta cana\b/,
    longitude: -68.405,
    latitude: 18.58,
    markerX: 65,
    markerY: 18,
    imageUrl: "/images/destinations/punta-cana.webp",
    demo: {
      title: "Punta Cana · Escapada al Caribe",
      description:
        "Playas de arena blanca, mar turquesa y días de descanso. Propuesta de ejemplo: fechas, alojamiento, servicios y tarifa a definir.",
    },
  },
  {
    id: "norte",
    name: "Salta y Jujuy",
    country: "Argentina",
    matches: /\b(salta|jujuy|norte magico)\b/,
    longitude: -65.41,
    latitude: -24.78,
    markerX: 48,
    markerY: 54,
    imageUrl: "/images/destinations/norte.webp",
  },
  {
    id: "rio",
    name: "Río de Janeiro",
    country: "Brasil",
    matches: /\brio de janeiro\b/,
    matchDescription: true,
    longitude: -43.17,
    latitude: -22.91,
    markerX: 92,
    markerY: 50,
    imageUrl: "/logo-stg.png",
  },
  {
    id: "camboriu",
    name: "Camboriú",
    country: "Brasil",
    matches: /\b(camboriu|excursion tropical)\b/,
    longitude: -48.635,
    latitude: -26.99,
    markerX: 89,
    markerY: 65,
    imageUrl: "/images/destinations/camboriu.webp",
    demo: {
      title: "Camboriú · Excursión Tropical",
      description:
        "Una propuesta para disfrutar la costa de Brasil, sus playas y paseos tropicales. Texto de prueba: itinerario, servicios y tarifa a confirmar.",
    },
  },
  {
    id: "carlos-paz",
    name: "Villa Carlos Paz",
    country: "Córdoba, Argentina",
    matches: /\bcarlos paz\b/,
    longitude: -64.497,
    latitude: -31.424,
    markerX: 43,
    markerY: 69,
    imageUrl: "/images/destinations/carlos-paz.webp",
    demo: {
      title: "Carlos Paz · Sierras y descanso",
      description:
        "Paisajes serranos, paseos junto al lago y tiempo para recorrer la ciudad. Propuesta de ejemplo: fechas, alojamiento y tarifa a definir.",
    },
  },
  {
    id: "buenos-aires",
    name: "Buenos Aires",
    country: "Argentina",
    matches: /\bbuenos aires\b/,
    longitude: -58.382,
    latitude: -34.604,
    markerX: 77,
    markerY: 79,
    imageUrl: "/images/destinations/buenos-aires.webp",
    demo: {
      title: "Buenos Aires · Escapada a la ciudad",
      description:
        "Barrios con historia, cultura, gastronomía y paseos por la capital. Texto de prueba: programa, servicios y tarifa a confirmar.",
    },
  },
  {
    id: "mar-del-plata",
    name: "Mar del Plata",
    country: "Buenos Aires, Argentina",
    matches: /\bmar del plata\b/,
    longitude: -57.55,
    latitude: -38.005,
    markerX: 75,
    markerY: 94,
    imageUrl: "/images/destinations/mar-del-plata.webp",
    demo: {
      title: "Mar del Plata · Días de playa",
      description:
        "Una escapada para recorrer la costa, caminar por la rambla y disfrutar del mar. Propuesta de ejemplo: fechas, servicios y tarifa a definir.",
    },
  },
  {
    id: "bariloche",
    name: "Bariloche",
    country: "Argentina",
    matches: /\bbariloche\b/,
    longitude: -71.31,
    latitude: -41.13,
    markerX: 46,
    markerY: 85,
    imageUrl: "/images/destinations/bariloche.webp",
  },
];

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function getMapDestinations(trips: Trip[]) {
  return destinations.flatMap((destination) => {
    // A departure city mentioned in a cruise description is not a city package.
    const trip =
      trips.find(
        (item) => normalize(item.title).trim() === normalize(destination.name),
      ) ??
      trips.find((item) => destination.matches.test(normalize(item.title))) ??
      (destination.matchDescription
        ? trips.find((item) =>
            destination.matches.test(normalize(item.description)),
          )
        : undefined);
    if (trip) return [{ ...destination, trip, isDemo: false }];
    if (!destination.demo) return [];
    return [
      {
        ...destination,
        trip: {
          id: `map-demo-${destination.id}`,
          title: destination.demo.title,
          description: destination.demo.description,
          imageUrl: destination.imageUrl,
          pdfUrl: "",
        },
        isDemo: true,
      },
    ];
  });
}
