const { chromium } = require("playwright");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const output = process.env.STG_TEST_OUTPUT_DIR || ".artifacts";
fs.mkdirSync(output, { recursive: true });
const baseUrl = process.env.STG_TEST_BASE_URL || "http://localhost:3010";
const userId = "10000000-0000-4000-8000-000000000001";
const receiptId = "20000000-0000-4000-8000-000000000001";
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const accessToken = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600, role: "authenticated", aud: "authenticated" })}.test-only`;

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.STG_BROWSER_EXECUTABLE || undefined,
  });
  const page = await browser.newPage({
    viewport: { width: 1536, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let receipts = [];
  let savedBody;
  let quoteFail = false;
  await page.route("**/auth/v1/**", async (route) => {
    if (route.request().method() === "OPTIONS")
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
        },
      });
    return route.fulfill({
      json: {
        access_token: accessToken,
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: "test-refresh",
        user: {
          id: userId,
          email: "qa@example.test",
          aud: "authenticated",
          role: "authenticated",
          created_at: new Date().toISOString(),
        },
      },
      headers: { "access-control-allow-origin": "*" },
    });
  });
  await page.route("**/api/content/**", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/admin/session", (route) =>
    route.fulfill({ json: { id: userId, email: "qa@example.test" } }),
  );
  await page.route("**/api/exchange-rate", (route) =>
    quoteFail
      ? route.fulfill({
          status: 502,
          json: {
            error: "Cotización no disponible. Podés ingresarla manualmente.",
          },
        })
      : route.fulfill({
          json: {
            value: "1540",
            updatedAt: new Date().toISOString(),
            fetchedAt: new Date().toISOString(),
            source: "DolarAPI",
            side: "venta",
          },
        }),
  );
  await page.route("**/api/receipts**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/pdf"))
      return route.fulfill({
        contentType: "application/pdf",
        body: fs.readFileSync("assets/receipts/template-v1.pdf"),
      });
    if (url.pathname.endsWith("/share"))
      return route.fulfill({
        status: 409,
        json: {
          error:
            "Para compartir enlaces necesitás publicar la web. Descargá el PDF y adjuntalo.",
        },
      });
    if (route.request().method() === "POST") {
      savedBody = route.request().postDataJSON();
      const receipt = {
        ...savedBody,
        id: receiptId,
        number: 1,
        totalArs: "15500.00",
        createdAt: new Date().toISOString(),
        templateVersion: "v1",
      };
      receipts = [receipt];
      return route.fulfill({ status: 201, json: { receipt, replayed: false } });
    }
    return route.fulfill({
      json: {
        receipts,
        total: receipts.length,
        page: 1,
        pageSize: 20,
        numbering: { initialized: true, nextNumber: receipts.length + 1 },
      },
    });
  });
  try {
    await page.goto(`${baseUrl}/admin/recibos`);
    await page.getByLabel("Correo electrónico").fill("qa@example.test");
    await page.getByLabel("Contrasena").fill("not-a-real-password");
    await page.getByRole("button", { name: "Entrar al panel" }).click();
    await page
      .getByRole("heading", { name: "Recibos de viaje", exact: true })
      .waitFor();
    await page.getByLabel("Cliente", { exact: true }).fill("Cliente de prueba");
    await page
      .getByRole("combobox", { name: /Moneda/ })
      .first()
      .selectOption("USD");
    await page.getByLabel("Cotización en ARS").waitFor();
    await page.waitForFunction(
      () =>
        document.querySelector('input[aria-describedby="rate-help"]')?.value ===
        "1540",
    );
    await page.getByLabel("Importe recibido").fill("10");
    await page.getByLabel("Cotización en ARS").fill("1550");
    await page.getByLabel("N.º de reserva").fill("00125");
    await page.getByLabel("Cantidad de pasajeros").fill("2");
    await page.getByLabel("Fecha de viaje", { exact: true }).fill("2027-02-21");
    await page.getByLabel("Destino / viaje", { exact: true }).fill("Bariloche");
    assert.match(
      await page.locator("form").first().innerText(),
      /ARS 15\.500,00/,
    );
    await page.screenshot({
      path: `${output}/recibos-escritorio.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Generar recibo", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Recibo 000001 emitido correctamente" })
      .waitFor();
    assert.equal(savedBody.rateSource, "manual");
    assert.equal(savedBody.exchangeRate, "1550.000000");
    assert.equal(
      await page.getByLabel("Cliente", { exact: true }).inputValue(),
      "",
    );
    assert.equal(await page.getByLabel("Cotización en ARS").inputValue(), "1");
    await page.locator("tbody tr").first().waitFor();
    assert.equal(await page.locator("tbody tr").count(), 1);
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page
        .getByRole("button", { name: "Descargar recibo 000001" })
        .first()
        .click(),
    ]);
    assert.equal(
      download.suggestedFilename(),
      "Recibo_000001_Cliente_de_prueba.pdf",
    );
    await page
      .getByRole("button", { name: "Compartir recibo 000001" })
      .first()
      .click();
    await page
      .getByRole("heading", { name: "Enviar el comprobante" })
      .waitFor();
    await page
      .getByRole("button", { name: "Crear enlace para enviar" })
      .click();
    await page
      .getByText(
        "Para compartir enlaces necesitás publicar la web. Descargá el PDF y adjuntalo.",
        { exact: true },
      )
      .waitFor();
    await page.getByRole("button", { name: "Cerrar compartir" }).click();
    await page
      .getByRole("button", { name: "Descargar recibo 000001" })
      .first()
      .click();
    quoteFail = true;
    await page
      .getByRole("combobox", { name: /Moneda/ })
      .first()
      .selectOption("USD");
    await page
      .getByText("Cotización no disponible. Podés ingresarla manualmente.", {
        exact: true,
      })
      .waitFor();
    await page.getByLabel("Cotización en ARS").fill("1540");
    assert.equal(
      await page
        .getByRole("button", { name: "Generar recibo", exact: true })
        .isEnabled(),
      true,
    );
    await page
      .getByRole("combobox", { name: /Moneda/ })
      .first()
      .selectOption("ARS");
    assert.equal(await page.getByLabel("Cotización en ARS").inputValue(), "1");
    assert.equal(
      await page.getByLabel("Cotización en ARS").getAttribute("readonly"),
      "",
    );
    await page.screenshot({
      path: `${output}/recibos-historial.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: `${output}/recibos-movil.png`,
      fullPage: true,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      "Mobile body should not overflow horizontally",
    );
    await page.getByRole("link", { name: "Volver a administración" }).click();
    await page
      .getByRole("heading", { name: "Gestion de viajes STG" })
      .waitFor();
    await page.goto(baseUrl);
    await page
      .getByRole("heading", {
        name: "Viajes organizados con criterio, cercania y acompanamiento real.",
      })
      .waitFor();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: admin login UI, USD quote, manual override, ARS reset, submission, history, PDF download, sharing fallback, responsive layout, existing admin and public home. API/auth mocked; no real user data or messages were sent.",
    );
  } catch (error) {
    await page.screenshot({ path: `${output}/ui-failure.png`, fullPage: true });
    console.error(error);
    console.error("Page errors:", errors);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
