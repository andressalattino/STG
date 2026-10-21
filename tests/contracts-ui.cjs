const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require("playwright");
const base = process.env.STG_TEST_BASE_URL || "http://localhost:3010";
const output = process.env.STG_TEST_OUTPUT_DIR || ".artifacts/contracts/ui";
fs.mkdirSync(output, { recursive: true });
const user = {
  id: "10000000-0000-4000-8000-000000000001",
  email: "qa@example.test",
  aud: "authenticated",
  role: "authenticated",
  created_at: new Date().toISOString(),
};
const encode = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, role: "authenticated" })}.test-signature`;

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.STG_BROWSER_EXECUTABLE || undefined,
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    page.setDefaultTimeout(15000);
    const errors = [],
      records = [];
    let posts = 0,
      lostRequest,
      previewCount = 0,
      rejectOverflow = true,
      receiptRequests = 0,
      listFailure = false;
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/auth/v1/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      return route.fulfill({
        json: path.endsWith("/user")
          ? user
          : {
              access_token: token,
              refresh_token: "test-refresh",
              expires_in: 3600,
              token_type: "bearer",
              user,
            },
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
        },
      });
    });
    await page.route("**/api/admin/session", (r) => r.fulfill({ json: user }));
    await page.route("**/api/content/**", (r) => r.fulfill({ json: [] }));
    await page.route("**/api/receipts**", (r) => {
      receiptRequests++;
      return r.fulfill({
        status: 500,
        json: { error: "Contracts must never create a receipt" },
      });
    });
    await page.route("**/api/exchange-rate", (r) =>
      r.fulfill({
        json: {
          value: "1500",
          updatedAt: new Date().toISOString(),
          fetchedAt: new Date().toISOString(),
          source: "DolarAPI",
          side: "venta",
        },
      }),
    );
    const pdf = fs.readFileSync(".artifacts/contracts/contrato-ejemplo.pdf");
    await page.route("**/api/contracts**", (r) => {
      const request = r.request(),
        url = new URL(request.url());
      if (url.pathname.endsWith("/preview")) {
        previewCount++;
        assert.equal(posts, 0);
        return r.fulfill({ contentType: "application/pdf", body: pdf });
      }
      if (url.pathname.endsWith("/pdf"))
        return r.fulfill({ contentType: "application/pdf", body: pdf });
      if (request.method() === "POST") {
        if (rejectOverflow) {
          rejectOverflow = false;
          return r.fulfill({
            status: 400,
            json: {
              error:
                "El contenido supera una sola hoja A4. Abreviá las observaciones.",
            },
          });
        }
        posts++;
        const input = request.postDataJSON();
        if (posts === 1) {
          lostRequest = input;
          assert.equal(input.previousId, null);
          assert.equal(input.data.reservationNumber, "000042");
          assert.equal(input.data.hotels.length, 2);
          assert.equal(input.data.hotels[0].rooms[0].quantity, 2);
          assert.equal(input.data.passengers.length, 2);
          assert.equal(input.data.currency, "USD");
          assert.equal(input.data.exchangeRate, "1520.000000");
          assert.equal(input.data.rateSource, "manual");
          assert.equal(input.data.totalOverride, "180.00");
          assert.equal(input.data.transport[0].type, "Aéreo");
          assert.equal(input.data.transport[1].seat, "Semicama");
          records.push({
            id: "20000000-0000-4000-8000-000000000001",
            number: 1,
            version: 1,
            previousId: null,
            createdAt: new Date().toISOString(),
            data: input.data,
          });
          return r.fulfill({
            status: 503,
            json: { error: "Simulated lost response" },
          });
        }
        if (posts === 2) {
          assert.deepEqual(input, lostRequest);
          return r.fulfill({ json: { contract: records[0], replayed: true } });
        }
        assert.equal(input.previousId, records[0].id);
        const revision = {
          ...records[0],
          id: "20000000-0000-4000-8000-000000000002",
          version: 2,
          previousId: records[0].id,
          data: input.data,
        };
        records.push(revision);
        return r.fulfill({
          status: 201,
          json: { contract: revision, replayed: false },
        });
      }
      if (listFailure)
        return r.fulfill({
          status: 503,
          json: { error: "Historial temporalmente no disponible" },
        });
      const query = (url.searchParams.get("q") || "").toLowerCase();
      const rows = records
        .filter((row) =>
          [
            String(row.number).padStart(6, "0"),
            row.data.destination,
            ...row.data.passengers.flatMap((p) => [p.name, p.dni]),
          ].some((v) => v.toLowerCase().includes(query)),
        )
        .map((row) => ({ ...row, isLatest: row.version === records.length }))
        .reverse();
      return r.fulfill({
        json: { contracts: rows, total: rows.length, page: 1, pageSize: 20 },
      });
    });
    await page.goto(`${base}/admin/contratos`);
    await page.getByLabel("Correo electrónico").fill(user.email);
    await page
      .getByLabel("Contrasena", { exact: true })
      .fill("test-only-password");
    await page.getByRole("button", { name: "Entrar al panel" }).click();
    await page
      .getByRole("heading", { name: "Contratos", exact: true })
      .waitFor();
    console.log("Contracts UI: login OK");
    await page.getByLabel("Tour / destino").fill("Bariloche familiar");
    await page.getByLabel("N.º de reserva (manual)").fill("000042");
    await page
      .getByLabel("Fecha de salida", { exact: true })
      .fill("2027-01-15");
    await page
      .getByLabel("Fecha de regreso", { exact: true })
      .fill("2027-01-22");
    await page.getByLabel("Hora de salida (opcional)").fill("08:30");
    await page.getByLabel("Lugar de salida").fill("Mendoza - Terminal");
    await page.getByLabel("Lugar de regreso").fill("Mendoza - Terminal");
    for (let i = 1; i <= 2; i++) {
      await page
        .getByRole("button", { name: "Agregar hotel", exact: true })
        .click();
      const h = page.getByRole("group", { name: `Hotel ${i}`, exact: true });
      await h.getByLabel("Nombre del hotel").fill(`Hotel de prueba ${i}`);
      await h
        .getByLabel("Ingreso al hotel")
        .fill(i === 1 ? "2027-01-16" : "2027-01-19");
      await h
        .getByLabel("Egreso del hotel")
        .fill(i === 1 ? "2027-01-19" : "2027-01-21");
      await h.getByLabel("Régimen de comidas").selectOption("Media pensión");
      if (i === 1) {
        await h.getByLabel("Cantidad", { exact: true }).fill("2");
        await h.getByRole("button", { name: "Agregar habitación" }).click();
        await h
          .getByLabel("Tipo de habitación 2")
          .selectOption("Triple matrimonial");
        await h
          .getByLabel("Tipo de habitación 2")
          .selectOption("Triple individual");
        await h
          .getByRole("button", { name: "Quitar habitación 2 del hotel 1" })
          .click();
      } else {
        await h.getByLabel("Régimen de comidas").selectOption("All inclusive");
        assert.equal(
          await h.getByLabel("Régimen de comidas").inputValue(),
          "All inclusive",
        );
      }
    }
    await page
      .getByRole("button", { name: "Agregar hotel", exact: true })
      .click();
    assert.equal(
      await page
        .getByRole("button", { name: "Agregar hotel", exact: true })
        .isDisabled(),
      true,
    );
    await page.getByRole("button", { name: "Quitar hotel 3" }).click();
    for (const [add, label, content] of [
      ["Agregar excursión", "Excursión 1", "Circuito Chico"],
    ]) {
      await page.getByRole("button", { name: add, exact: true }).click();
      await page.getByLabel(label, { exact: true }).fill(content);
    }
    await page
      .getByRole("button", { name: "Agregar transporte", exact: true })
      .click();
    const air = page.getByRole("group", { name: "Transporte 1", exact: true });
    await air.getByLabel("Tipo de transporte").selectOption("Aéreo");
    await air
      .getByLabel("Especificaciones del aéreo")
      .fill("AR1234 - Mendoza / Bariloche");
    await page
      .getByRole("button", { name: "Agregar transporte", exact: true })
      .click();
    const bus = page.getByRole("group", { name: "Transporte 2", exact: true });
    await bus.getByLabel("Servicio de bus").selectOption("Semicama");
    await bus
      .getByLabel("Empresa / recorrido (opcional)")
      .fill("Traslado al hotel");
    await page
      .getByRole("button", { name: "Agregar pasajero", exact: true })
      .click();
    for (let i = 1; i <= 2; i++) {
      const p = page.getByRole("group", { name: `Pasajero ${i}`, exact: true });
      await p
        .getByLabel("Nombre y apellido")
        .fill(i === 1 ? "María Pérez" : "Juan García");
      await p.getByLabel("DNI", { exact: true }).fill(String(30123455 + i));
      await p.getByLabel("Fecha de nacimiento").fill("1985-05-20");
    }
    await page
      .getByRole("button", { name: "Agregar pasajero", exact: true })
      .click();
    await page.getByRole("button", { name: "Quitar pasajero 3" }).click();
    for (let i = 3; i <= 6; i++)
      await page
        .getByRole("button", { name: "Agregar pasajero", exact: true })
        .click();
    assert.equal(
      await page
        .getByRole("button", { name: "Agregar pasajero", exact: true })
        .isDisabled(),
      true,
    );
    for (let i = 6; i >= 3; i--)
      await page
        .getByRole("button", { name: `Quitar pasajero ${i}`, exact: true })
        .click();
    await page.getByLabel("Valor del pasaje por persona").fill("100.25");
    await page.getByLabel("Seña (ARS)", { exact: true }).fill("50");
    assert.match(
      await page.getByTestId("contract-total").innerText(),
      /200,50/,
    );
    assert.match(
      await page.getByTestId("contract-remaining").innerText(),
      /150,50/,
    );
    await page.getByLabel("Efectivo (total)", { exact: true }).fill("190");
    assert.match(
      await page.getByTestId("contract-remaining").innerText(),
      /140,00/,
    );
    await page.getByLabel("Valor del pasaje por persona").fill("110");
    assert.equal(
      await page.getByLabel("Efectivo (total)", { exact: true }).inputValue(),
      "190",
    );
    await page
      .getByRole("button", { name: "Volver al cálculo automático" })
      .click();
    assert.match(
      await page.getByTestId("contract-total").innerText(),
      /220,00/,
    );
    await page.getByLabel("Valor del pasaje por persona").fill("100.25");
    await page.getByLabel("Efectivo (total)", { exact: true }).fill("180");
    await page.getByLabel("Moneda", { exact: true }).selectOption("USD");
    await page.waitForFunction(() =>
      [...document.querySelectorAll("input")].some(
        (input) => input.value === "1500",
      ),
    );
    await page.getByLabel("Cotización USD a ARS").fill("1520");
    console.log("Contracts UI: form filled");
    const popup = page.waitForEvent("popup");
    const previewResponse = page.waitForResponse(
      (r) => r.url().endsWith("/preview") && r.ok(),
    );
    await page.getByRole("button", { name: "Vista previa A4" }).click();
    const preview = await popup;
    await previewResponse;
    await preview.close();
    assert.equal(previewCount, 1);
    console.log("Contracts UI: preview OK");
    await page
      .getByRole("button", { name: "Guardar contrato y PDF", exact: true })
      .click();
    await page.getByText(/El contenido supera una sola hoja A4/).waitFor();
    assert.equal(await page.getByLabel("Tour / destino").isDisabled(), false);
    await page
      .getByRole("button", { name: "Guardar contrato y PDF", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Reintentar el mismo envío", exact: true })
      .waitFor();
    assert.equal(await page.getByLabel("Tour / destino").isDisabled(), true);
    await page
      .getByRole("button", { name: "Reintentar el mismo envío", exact: true })
      .click();
    await page
      .getByText("Contrato 000001 · v1 guardado.", { exact: true })
      .waitFor();
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Descargar PDF", exact: true })
      .click();
    assert.equal(
      (await download).suggestedFilename(),
      "Contrato_000001_v1.pdf",
    );
    await page
      .getByRole("button", { name: "Historial de contratos", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Crear nueva versión", exact: true })
      .click();
    assert.equal(
      await page.getByLabel("N.º de reserva (manual)").inputValue(),
      "000042",
    );
    await page
      .getByLabel("Observaciones", { exact: true })
      .fill("Cambio de habitación acordado con el cliente.");
    await page
      .getByRole("button", { name: "Guardar nueva versión y PDF", exact: true })
      .click();
    await page
      .getByText("Contrato 000001 · v2 guardado.", { exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Historial de contratos", exact: true })
      .click();
    await page.getByText("Versión anterior", { exact: true }).waitFor();
    for (const q of ["000001", "María", "30123456", "Bariloche"]) {
      await page.getByLabel("Buscar contratos").fill(q);
      await page.getByRole("button", { name: "Buscar", exact: true }).click();
      await page.getByRole("cell", { name: /000001 · v2/ }).waitFor();
    }
    listFailure = true;
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    await page.getByRole("button", { name: "Reintentar carga" }).waitFor();
    listFailure = false;
    await page.getByRole("button", { name: "Reintentar carga" }).click();
    await page.getByRole("cell", { name: /000001 · v2/ }).waitFor();
    await page.screenshot({ path: `${output}/historial.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .getByRole("button", { name: "Nuevo contrato", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Agregar hotel", exact: true })
      .click();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      "No mobile horizontal overflow",
    );
    await page.screenshot({
      path: `${output}/formulario-movil.png`,
      fullPage: true,
    });
    assert.equal(receiptRequests, 0);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: contracts login, multi-hotel/room editing, passenger lists, meals, exact totals, editable USD rate, A4 preview, uncertain retry, PDF, immutable revisions, searches and mobile layout. Auth/API mocked; no real contracts or financial records created.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
