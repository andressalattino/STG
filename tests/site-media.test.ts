import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MediaImage } from "../src/components/Media";
import { TripsPage } from "../src/components/site/TripsPage";
import { getMapDestinations } from "../src/data/map-destinations";
import { initialTrips } from "../src/data/site";
import { canOptimizeImage, imageSource } from "../src/lib/image-sources";

test("trip cards start the first row immediately and render loading indicators before images arrive", () => {
  const html = renderToStaticMarkup(
    createElement(TripsPage, {
      trips: [...initialTrips, { ...initialTrips[0], id: "another-trip" }].map(
        (trip) => ({
          ...trip,
          imageUrl: "https://external.example/poster.jpg",
        }),
      ),
    }),
  );
  assert.equal((html.match(/loading="eager"/g) || []).length, 3);
  assert.equal((html.match(/loading="lazy"/g) || []).length, 1);
  assert.equal((html.match(/aria-busy="true"/g) || []).length, 4);
  assert.equal((html.match(/Cargando imagen/g) || []).length, 4);
});

test("local photos show a loading indicator while IndexedDB resolves; ordinary logos stay unaffected", () => {
  const pending = renderToStaticMarkup(
    createElement(MediaImage, {
      src: "stg-file:local-poster",
      alt: "Afiche de viaje",
      showLoading: true,
      className: "h-full w-full object-contain",
    }),
  );
  assert.match(pending, /aria-busy="true"/);
  assert.match(pending, /Cargando imagen/);
  assert.match(pending, /alt="Afiche de viaje"/);
  const logo = renderToStaticMarkup(
    createElement(MediaImage, {
      src: "/logo-stg.png",
      alt: "STG",
      loading: "eager",
    }),
  );
  assert.doesNotMatch(logo, /Cargando imagen|aria-busy/);
});

test("the requested map destinations have explicit demo cards, and Mendoza has no marker", async () => {
  const available = getMapDestinations(initialTrips);
  assert.equal(
    available.some((item) => item.id === "mendoza"),
    false,
  );
  assert.equal(
    available.find((item) => item.id === "bariloche")?.isDemo,
    false,
  );
  const demos = available.filter((item) => item.isDemo);
  assert.deepEqual(demos.map((item) => item.id).sort(), [
    "buenos-aires",
    "camboriu",
    "carlos-paz",
    "mar-del-plata",
    "punta-cana",
  ]);
  for (const destination of available) {
    assert.equal(destination.trip.pdfUrl === "" || !destination.isDemo, true);
    await access(`public${destination.imageUrl}`);
  }
});

test("the package named Bariloche takes precedence over the starter Bariloche grupal", () => {
  const savedTrip = {
    id: "saved-bariloche",
    title: "Bariloche",
    description: "Programa cargado por STG",
    imageUrl: "stg-file:bariloche-poster",
    pdfUrl: "stg-file:bariloche-program",
  };
  const selected = getMapDestinations([...initialTrips, savedTrip]).find(
    (destination) => destination.id === "bariloche",
  );
  assert.equal(selected?.trip, savedTrip);
  assert.equal(selected?.isDemo, false);
});

test("real packages replace demos; cruise stops and departure cities do not become unrelated packages", () => {
  const cruise = {
    id: "crucero",
    title: "Costa Serena",
    description: "Salida desde Buenos Aires hacia Camboriú y Río de Janeiro.",
    imageUrl: "/logo-stg.png",
    pdfUrl: "",
  };
  const tropical = {
    ...cruise,
    id: "tropical",
    title: "Excursión Tropical · Camboriú",
    description: "Programa confirmado de la excursión.",
  };
  const preview = getMapDestinations([cruise]);
  assert.equal(
    preview.find((item) => item.id === "buenos-aires")?.isDemo,
    true,
  );
  assert.equal(preview.find((item) => item.id === "camboriu")?.isDemo, true);
  assert.equal(preview.find((item) => item.id === "rio")?.trip.id, cruise.id);
  const published = getMapDestinations([cruise, tropical]);
  assert.equal(published.find((item) => item.id === "camboriu")?.isDemo, false);
  assert.equal(
    published.find((item) => item.id === "camboriu")?.trip.id,
    tropical.id,
  );
});

test("nearby map buttons keep distinct 44px touch targets on a 320px screen", () => {
  const available = getMapDestinations([
    ...initialTrips,
    {
      ...initialTrips[0],
      id: "cruise",
      title: "Costa Serena",
      description: "Río de Janeiro",
    },
  ]);
  // 320px viewport minus a scrollbar, section padding, border and map inset.
  const mapWidth = 246;
  const mapHeight = (mapWidth * 35) / 27;
  for (let i = 0; i < available.length; i++) {
    for (const other of available.slice(i + 1)) {
      const current = available[i];
      const dx = (Math.abs(current.markerX - other.markerX) * mapWidth) / 100;
      const dy = (Math.abs(current.markerY - other.markerY) * mapHeight) / 100;
      assert.ok(
        dx >= 44 || dy >= 44,
        `${current.name} and ${other.name} overlap`,
      );
    }
  }
});

test("legacy broken photos resolve locally; blob, SVG and arbitrary image sources remain compatible", () => {
  const broken =
    "https://images.unsplash.com/photo-1598791503410-0c0872a3edb1?auto=format&w=1200";
  assert.equal(imageSource(broken), "/images/destinations/bariloche.webp");
  assert.equal(canOptimizeImage(imageSource(broken)), true);
  assert.equal(canOptimizeImage("/maps/latin-america.svg"), false);
  assert.equal(
    canOptimizeImage("blob:http://localhost:3010/local-file"),
    false,
  );
  assert.equal(canOptimizeImage("https://external.example/photo.jpg"), false);
  assert.equal(
    canOptimizeImage("https://images.unsplash.com/photo-real?w=1200"),
    true,
  );
  assert.equal(
    canOptimizeImage("https://images.unsplash.com.attacker.example/a.jpg"),
    false,
  );
});
