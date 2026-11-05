const assert = require("node:assert/strict");
const { PDFDocument } = require("pdf-lib");
const { chromium } = require("playwright");
const base = process.env.STG_TEST_BASE_URL || "http://localhost:3010";
const user = {
  id: "10000000-0000-4000-8000-000000000001",
  email: "qa@example.test",
  aud: "authenticated",
  role: "authenticated",
  created_at: new Date().toISOString(),
};
const encode = (value) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");
const session = {
  access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, role: "authenticated" })}.${encode("test-signature")}`,
  refresh_token: "test-refresh-token",
  expires_in: 3600,
  token_type: "bearer",
  user,
};

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.STG_BROWSER_EXECUTABLE || undefined,
  });
  try {
    const page = await browser.newPage();
    let logins = 0,
      checks = 0,
      contentFails = false,
      authFails = false;
    const contentRequests = [];
    const flyers = new Map();
    let flyerRequests = 0;
    await page.addInitScript(() => {
      window.loginFlashed = false;
      const observer = new MutationObserver(() => {
        if (document.querySelector('input[name="username"]'))
          window.loginFlashed = true;
      });
      observer.observe(document, { childList: true, subtree: true });
    });
    await page.route("**/auth/v1/**", async (route) => {
      const req = route.request(),
        path = new URL(req.url()).pathname;
      const headers = {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "*",
      };
      if (req.method() === "OPTIONS")
        return route.fulfill({ status: 204, headers });
      if (path.endsWith("/token")) {
        logins++;
        return route.fulfill({ headers, json: session });
      }
      if (path.endsWith("/user")) return route.fulfill({ headers, json: user });
      if (path.endsWith("/logout")) return route.fulfill({ headers, json: {} });
      throw new Error("Unexpected Auth route");
    });
    await page.route("**/api/admin/session", async (route) => {
      checks++;
      await new Promise((resolve) => setTimeout(resolve, 350));
      return route.fulfill({
        status: authFails ? 503 : 200,
        json: authFails ? { error: "Temporalmente no disponible" } : user,
      });
    });
    await page.route("**/api/content/**", (route) => {
      contentRequests.push(new URL(route.request().url()).pathname);
      return route.fulfill({
        status: contentFails ? 503 : 200,
        json: contentFails
          ? { error: "Contenido temporalmente no disponible" }
          : [],
      });
    });
    await page.route("**/api/receipts**", (route) =>
      route.fulfill({
        json: {
          receipts: [],
          total: 0,
          page: 1,
          pageSize: 20,
          numbering: { nextNumber: 1, initialized: true },
        },
      }),
    );
    await page.route(/\/api\/flyers(?:\/[^/]+)?$/, (route) => {
      flyerRequests++;
      const request = route.request();
      const id = new URL(request.url()).pathname.split("/").pop();
      if (request.method() === "GET")
        return route.fulfill({ json: Array.from(flyers.values()) });
      if (request.method() === "DELETE") {
        flyers.delete(id);
        return route.fulfill({ status: 204 });
      }
      const body = request.postDataJSON();
      const record = {
        id: request.method() === "POST" ? body.id : id,
        data: request.method() === "POST" ? body.data : body,
        updatedAt: new Date().toISOString(),
      };
      flyers.set(record.id, record);
      return route.fulfill({ json: record });
    });
    await page.goto(`${base}/admin`);
    await page.locator('input[name="username"]').fill(user.email);
    await page.locator('input[name="password"]').fill("test-password-not-real");
    await page.getByRole("button", { name: "Entrar al panel" }).click();
    await page
      .getByRole("heading", { name: "Panel de administración" })
      .waitFor();
    const checksAfterLogin = checks;
    assert.deepEqual(
      contentRequests,
      [],
      "Admin home should only load the menu",
    );
    assert.equal(flyerRequests, 0);
    const homeTrips = page
      .getByRole("region", { name: "Contenido de la web" })
      .getByRole("link", { name: /^Viajes/ });
    await homeTrips.click();
    await page
      .getByRole("heading", { name: "Gestión de viajes STG" })
      .waitFor();
    await page.getByText("Datos sincronizados con Supabase.").waitFor();
    assert.deepEqual(contentRequests, ["/api/content/trips"]);
    await page
      .locator("#admin-trip-form input")
      .first()
      .fill("Borrador que debe conservarse");
    await page.evaluate(() => {
      window.loginFlashed = false;
    });
    const navigation = page.getByRole("navigation", {
      name: "Secciones de administración",
    });
    await navigation
      .getByRole("link", { name: "Recibos", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Generar recibo", exact: true })
      .waitFor();
    await page.getByRole("link", { name: "Volver a administración" }).click();
    await page
      .getByRole("heading", { name: "Panel de administración" })
      .waitFor();
    assert.deepEqual(contentRequests, ["/api/content/trips"]);
    await homeTrips.click();
    await page
      .getByRole("heading", { name: "Gestión de viajes STG" })
      .waitFor();
    assert.equal(
      await page.locator("#admin-trip-form input").first().inputValue(),
      "Borrador que debe conservarse",
    );
    assert.equal(
      checks,
      checksAfterLogin,
      "Internal navigation must preserve the validated workspace",
    );
    assert.equal(logins, 1, "Only one login for both sections");
    assert.equal(
      await page.evaluate(() => window.loginFlashed),
      false,
      "No login may be rendered during navigation",
    );
    await navigation
      .getByRole("link", { name: "Folletos", exact: true })
      .click();
    await page.getByRole("heading", { name: "Nuevo folleto" }).waitFor();
    await page
      .getByLabel("Nombre del viaje", { exact: true })
      .fill("Mar del Plata");
    await page.getByLabel("Días", { exact: true }).fill("7");
    await page.getByLabel("Noches", { exact: true }).fill("5");
    await page.getByLabel("Tipo de asiento").selectOption("Semicama");
    await page.getByLabel("Empresa de transporte").fill("El Rayo");
    const hotel = page.getByRole("group", { name: "Hotel 01" });
    await hotel.getByLabel("Nombre").fill("Hotel Bristol");
    await hotel.getByLabel("Fecha").fill("2026-12-15");
    await hotel.getByLabel("Precio (ARS)").fill("150000,50");
    await page.getByRole("button", { name: "Guardar folleto" }).click();
    await page.getByText("Folleto guardado.", { exact: true }).waitFor();
    const [saved] = flyers.values();
    assert.deepEqual(saved.data.hotels, [
      { name: "Hotel Bristol", date: "2026-12-15", price: "150000.50" },
      null,
      null,
      null,
    ]);
    await page
      .locator(".flyer-art img")
      .first()
      .evaluate((img) => img.decode());
    await page.emulateMedia({ media: "print" });
    const printed = page.locator(".flyer-print-sheet .flyer-art");
    assert.equal(await printed.count(), 4);
    for (const copy of await printed.all()) {
      assert.equal(await copy.locator(".flyer-hotels li").count(), 4);
      assert.equal(
        await copy.locator(".flyer-hotel-name").nth(1).textContent(),
        "",
      );
      assert.match(await copy.textContent(), /7 días y 5 noches/);
      assert.match(await copy.textContent(), /150\.000,50/);
    }
    const document = await PDFDocument.load(
      await page.pdf({ preferCSSPageSize: true }),
    );
    assert.equal(document.getPageCount(), 1);
    const { width, height } = document.getPage(0).getSize();
    assert.ok(Math.abs(width - 595.28) < 1 && Math.abs(height - 841.89) < 1);
    await page.emulateMedia({ media: null });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    );
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.reload();
    const library = page.getByRole("region", { name: "Folletos guardados" });
    await library.getByText("Mar del Plata", { exact: true }).waitFor();
    await library.getByRole("button", { name: "Editar" }).click();
    await page
      .getByLabel("Nombre del viaje", { exact: true })
      .fill("Costa Atlántica");
    await page.getByRole("button", { name: "Guardar folleto" }).click();
    await library.getByText("Costa Atlántica", { exact: true }).waitFor();
    assert.equal(flyers.size, 1);
    await library.getByRole("button", { name: "Eliminar" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Eliminar" })
      .click();
    await library.getByText("Todavía no hay folletos guardados.").waitFor();
    assert.equal(flyers.size, 0);

    // Restoring a session must not depend on unrelated public content requests.
    contentFails = true;
    await page.goto(`${base}/admin/recibos`);
    await page.reload();
    await page
      .getByRole("button", { name: "Generar recibo", exact: true })
      .waitFor();
    assert.equal(
      await page.evaluate(() => window.loginFlashed),
      false,
      "Restoration must show checking, not login",
    );
    assert.equal(logins, 1);
    authFails = true;
    await page.reload();
    await page
      .getByText(
        "No se pudo comprobar tu sesión. Revisá la conexión y volvé a intentar.",
      )
      .waitFor();
    assert.equal(
      await page.locator('input[name="username"]').count(),
      0,
      "An unavailable server is not a signed-out session",
    );
    authFails = false;
    await page.getByRole("button", { name: "Reintentar", exact: true }).click();
    await page
      .getByRole("button", { name: "Generar recibo", exact: true })
      .waitFor();
    await page.getByRole("button", { name: /Cerrar sesi/ }).click();
    await page.locator('input[name="username"]').waitFor();
    console.log(
      "PASS: lazy admin home, preserved trip draft and session, flyer CRUD and one A4 page with four copies, auth outage recovery and logout. Auth/API mocked.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
