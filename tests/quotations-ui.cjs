const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require("playwright");
const base = process.env.STG_TEST_BASE_URL || "http://localhost:3010";
const output = process.env.STG_TEST_OUTPUT_DIR || ".artifacts";
fs.mkdirSync(output, { recursive: true });
const user = {
  id: "10000000-0000-4000-8000-000000000001",
  email: "qa@example.test",
  aud: "authenticated",
  role: "authenticated",
  created_at: new Date().toISOString(),
};
const encode = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, role: "authenticated" })}.${encode("test-signature")}`;
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.STG_BROWSER_EXECUTABLE || undefined,
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1100 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let posts = 0,
      previewCount = 0,
      firstRequestId,
      record;
    await page.route("**/auth/v1/**", (r) =>
      r.fulfill({
        json: {
          access_token: token,
          refresh_token: "test-refresh",
          expires_in: 3600,
          token_type: "bearer",
          user,
        },
        headers: { "access-control-allow-origin": "*" },
      }),
    );
    await page.route("**/api/admin/session", (r) => r.fulfill({ json: user }));
    await page.route("**/api/content/**", (r) => r.fulfill({ json: [] }));
    await page.route("**/api/exchange-rate", (r) =>
      r.fulfill({
        json: {
          value: "1520",
          updatedAt: new Date().toISOString(),
          fetchedAt: new Date().toISOString(),
          source: "DolarAPI",
          side: "venta",
        },
      }),
    );
    await page.route("**/api/quotations**", (r) => {
      const request = r.request(),
        url = new URL(request.url());
      if (url.pathname.endsWith("/preview")) {
        previewCount++;
        assert.equal(posts, 0);
        return r.fulfill({
          contentType: "application/pdf",
          body: "%PDF-1.4\n%%EOF",
        });
      }
      if (url.pathname.endsWith("/pdf"))
        return r.fulfill({
          contentType: "application/pdf",
          body: "%PDF-1.4\n%%EOF",
        });
      if (request.method() === "POST") {
        posts++;
        const input = request.postDataJSON();
        if (posts === 1) {
          firstRequestId = input.requestId;
          assert.equal(input.data.exchangeRate, "1520.000000");
          assert.equal(input.data.nights, 7);
          assert.equal(input.data.hotels.length, 2);
          assert.equal(input.data.legs.length, 2);
          assert.equal(input.data.roundTrip, true);
          record = {
            id: "20000000-0000-4000-8000-000000000001",
            number: 1,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 259200000).toISOString(),
            data: input.data,
          };
          return r.fulfill({
            status: 503,
            json: { error: "Simulated lost response" },
          });
        }
        assert.equal(input.requestId, firstRequestId);
        return r.fulfill({ json: { quotation: record, replayed: true } });
      }
      const rows =
        record &&
        (!url.searchParams.get("q") ||
          record.data.passenger.includes(url.searchParams.get("q")))
          ? [record]
          : [];
      return r.fulfill({
        json: { quotations: rows, total: rows.length, page: 1, pageSize: 20 },
      });
    });
    await page.goto(`${base}/admin/cotizaciones`);
    await page.getByLabel("Correo electrónico").fill(user.email);
    await page
      .getByLabel("Contrasena", { exact: true })
      .fill("local-test-only");
    await page.getByRole("button", { name: "Entrar al panel" }).click();
    await page
      .getByRole("heading", { name: "Cotizaciones", exact: true })
      .waitFor();
    await page
      .getByLabel("Pasajero / familia", { exact: true })
      .fill("Familia Salattino");
    await page.getByLabel("Cantidad de pasajeros", { exact: true }).fill("4");
    await page.getByLabel("Destino", { exact: true }).fill("Río de Janeiro");
    await page
      .getByLabel("Fecha de salida", { exact: true })
      .fill("2027-01-15");
    await page
      .getByLabel("Fecha de regreso", { exact: true })
      .fill("2027-01-22");
    assert.equal(
      await page.getByLabel("Cantidad de noches", { exact: true }).inputValue(),
      "7",
    );
    await page.getByLabel("Precio total", { exact: true }).fill("2480");
    await page.getByLabel("Moneda", { exact: true }).selectOption("USD");
    await page
      .getByRole("button", { name: "Usar dólar oficial actual" })
      .click();
    await page
      .getByText("Dólar oficial de venta. Podés modificarlo.")
      .waitFor();
    await page
      .getByLabel("Régimen de pensión", { exact: true })
      .selectOption("Media pensión");
    await page.getByLabel("Modalidad", { exact: true }).selectOption("Mixto");
    await page.getByLabel("Origen tramo 1", { exact: true }).fill("Mendoza");
    await page
      .getByLabel("Destino tramo 1", { exact: true })
      .fill("Buenos Aires");
    await page.getByRole("button", { name: "Agregar tramo de ida" }).click();
    await page
      .getByLabel("Origen tramo 2", { exact: true })
      .fill("Buenos Aires");
    await page
      .getByLabel("Destino tramo 2", { exact: true })
      .fill("Río de Janeiro");
    assert.equal(
      await page.getByTestId("return-routes").innerText(),
      "Aéreo: Río de Janeiro → Buenos Aires\nAéreo: Buenos Aires → Mendoza",
    );
    await page
      .getByLabel("Hospedaje 1", { exact: true })
      .fill("Hotel Atlântico Copacabana 4*");
    await page.getByLabel("Precio hospedaje 1", { exact: true }).fill("2480");
    await page.getByRole("button", { name: "Agregar hospedaje" }).click();
    await page
      .getByLabel("Hospedaje 2", { exact: true })
      .fill("Windsor Plaza 4*");
    await page.getByLabel("Precio hospedaje 2", { exact: true }).fill("2260");
    await page
      .getByLabel("Carry-on (cantidad total)", { exact: true })
      .fill("4");
    await page
      .getByLabel("Equipaje en bodega (cantidad total)", { exact: true })
      .fill("2");
    await page
      .getByLabel("Asistencia al viajero", { exact: true })
      .selectOption("yes");
    await page
      .getByLabel("Nombre de la asistencia", { exact: true })
      .fill("Plan Regional Plus");
    await page.getByLabel("Traslados", { exact: true }).selectOption("yes");
    await page
      .getByLabel("Detalle de traslados", { exact: true })
      .fill("Aeropuerto - hotel");
    await page.getByLabel("Excursiones", { exact: true }).selectOption("yes");
    await page
      .getByLabel("Excursiones incluidas", { exact: true })
      .fill("City Tour + Cristo Redentor");
    await page
      .getByLabel("Aclaraciones y condiciones", { exact: true })
      .fill("Sujeto a disponibilidad al reservar.");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `${output}/cotizaciones-escritorio.png`,
      fullPage: true,
    });
    const popupWait = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Vista previa A4" }).click();
    const popup = await popupWait;
    await page
      .getByRole("button", { name: "Guardar cotización y PDF" })
      .waitFor({ state: "visible" });
    await page.waitForFunction(
      () => !document.querySelector('button[type="submit"]')?.disabled,
    );
    assert.equal(previewCount, 1);
    assert.equal(posts, 0);
    await popup.close();
    await page
      .getByRole("button", { name: "Guardar cotización y PDF" })
      .click();
    await page.getByRole("button", { name: "Reintentar guardado" }).waitFor();
    assert.equal(
      await page.getByLabel("Pasajero / familia", { exact: true }).isDisabled(),
      true,
    );
    await page.getByRole("button", { name: "Reintentar guardado" }).click();
    await page
      .getByText("Cotización 000001 guardada para Familia Salattino.")
      .waitFor();
    assert.equal(posts, 2);
    const downloadWait = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Descargar PDF", exact: true })
      .click();
    assert.equal(
      (await downloadWait).suggestedFilename(),
      "Cotizacion_000001_Familia_Salattino.pdf",
    );
    await page
      .getByRole("button", { name: "Historial de cotizaciones", exact: true })
      .click();
    await page.getByRole("button", { name: "Usar como base" }).waitFor();
    await page.getByRole("button", { name: "Usar como base" }).click();
    assert.equal(
      await page.getByLabel("Pasajero / familia", { exact: true }).inputValue(),
      "Familia Salattino",
    );
    await page
      .getByLabel("Incluir hospedaje", { exact: true })
      .selectOption("no");
    assert.equal(
      await page.getByLabel("Hospedaje 1", { exact: true }).count(),
      0,
    );
    await page.getByLabel("Modalidad", { exact: true }).selectOption("Clásico");
    assert.equal(
      await page.getByLabel("Origen tramo 2", { exact: true }).count(),
      0,
    );
    await page.getByLabel("Recorrido", { exact: true }).selectOption("one");
    assert.equal(await page.getByTestId("return-routes").count(), 0);
    await page.getByLabel("Moneda", { exact: true }).selectOption("ARS");
    assert.equal(
      await page.getByLabel("Cotización a ARS", { exact: true }).inputValue(),
      "1",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.bringToFront();
    await page
      .getByLabel("Aclaraciones y condiciones", { exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${output}/cotizaciones-movil-final.png` });
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, 0);
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "Sin desbordamiento horizontal en móvil",
    );
    await page.screenshot({
      path: `${output}/cotizaciones-movil.png`,
      fullPage: false,
    });
    assert.deepEqual(errors, []);
    console.log(
      "Cotizaciones UI: acceso, ida/vuelta, múltiples hoteles, cotización USD/ARS, vista previa, reintento, PDF, historial y móvil OK.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
