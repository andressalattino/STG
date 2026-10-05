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
    let rows = [],
      firstRequestId,
      posts = 0,
      lastStats;
    await page.route("**/auth/v1/**", (route) =>
      route.fulfill({
        json: {
          access_token: token,
          refresh_token: "test-refresh-token",
          expires_in: 3600,
          token_type: "bearer",
          user,
        },
        headers: { "access-control-allow-origin": "*" },
      }),
    );
    await page.route("**/api/admin/session", (route) =>
      route.fulfill({ json: user }),
    );
    await page.route("**/api/content/**", (route) =>
      route.fulfill({ json: [] }),
    );
    await page.route("**/api/expenses**", (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname.endsWith("/void")) {
        const reason = request.postDataJSON().reason;
        rows[0] = {
          ...rows[0],
          voidedAt: new Date().toISOString(),
          voidReason: reason,
        };
        return route.fulfill({ json: { expense: rows[0] } });
      }
      if (request.method() === "POST") {
        const input = request.postDataJSON();
        posts++;
        if (posts === 1) {
          firstRequestId = input.requestId;
          rows = [
            {
              ...input,
              id: "20000000-0000-4000-8000-000000000001",
              totalArs: "15400.00",
              createdAt: new Date().toISOString(),
              voidedAt: null,
              voidReason: null,
            },
          ];
          return route.fulfill({
            status: 503,
            json: { error: "Simulated response lost after save" },
          });
        }
        assert.equal(input.requestId, firstRequestId);
        assert.equal(input.exchangeRate, "1540.000000");
        return route.fulfill({ json: { expense: rows[0], replayed: true } });
      }
      const visible = rows.filter(
        (r) =>
          url.searchParams.get("status") === "all" ||
          (url.searchParams.get("status") === "voided"
            ? !!r.voidedAt
            : !r.voidedAt),
      );
      return route.fulfill({
        json: {
          expenses: visible,
          total: visible.length,
          page: 1,
          pageSize: 20,
        },
      });
    });
    await page.route("**/api/statistics**", (route) => {
      const query = new URL(route.request().url()).searchParams;
      lastStats = Object.fromEntries(query);
      const amount = rows.some((r) => !r.voidedAt) ? "15400.00" : "0.00";
      return route.fulfill({
        json: {
          ...lastStats,
          group: lastStats.group === "auto" ? "day" : lastStats.group,
          income: "40000.00",
          expenses: amount,
          balance: (40000 - Number(amount)).toFixed(2),
          points: [
            {
              date: lastStats.from,
              income: "10000.00",
              expenses: amount,
              balance: (10000 - Number(amount)).toFixed(2),
            },
            {
              date: lastStats.to,
              income: "30000.00",
              expenses: "0.00",
              balance: "30000.00",
            },
          ],
        },
      });
    });
    await page.goto(`${base}/admin/egresos`);
    await page.locator('input[name="username"]').fill(user.email);
    await page.locator('input[name="password"]').fill("test-only-password");
    await page.getByRole("button", { name: "Entrar al panel" }).click();
    await page.getByRole("heading", { name: "Egresos y pagos" }).waitFor();
    await page.getByLabel("Fecha de pago", { exact: true }).fill("2026-10-01");
    await page.getByLabel("Pagado a", { exact: true }).fill("Hotel de prueba");
    await page.getByLabel("Concepto", { exact: true }).fill("Seña hotel");
    await page.getByLabel("Moneda", { exact: true }).selectOption("USD");
    await page.getByLabel("Importe", { exact: true }).fill("10");
    await page.getByLabel("Cotización en ARS", { exact: true }).fill("1540");
    await page
      .getByRole("button", { name: "Guardar egreso", exact: true })
      .click();
    await page.getByRole("button", { name: "Reintentar guardado" }).waitFor();
    assert.equal(
      await page.getByLabel("Pagado a", { exact: true }).isDisabled(),
      true,
    );
    await page.getByRole("button", { name: "Reintentar guardado" }).click();
    await page
      .getByText("Egreso guardado correctamente.", { exact: true })
      .waitFor();
    await page.locator("tbody tr").first().waitFor();
    assert.equal(await page.locator("tbody tr").count(), 1);
    assert.equal(
      await page.getByLabel("Cotización en ARS", { exact: true }).inputValue(),
      "1",
    );
    await page.screenshot({
      path: `${output}/egresos-escritorio.png`,
      fullPage: true,
    });
    await page.getByRole("link", { name: "Estadísticas", exact: true }).click();
    await page
      .getByRole("heading", { name: "Estadísticas", exact: true })
      .waitFor();
    await page.getByLabel("Desde", { exact: true }).fill("2026-10-01");
    await page.getByLabel("Hasta", { exact: true }).fill("2026-10-02");
    await page.getByRole("button", { name: "Aplicar período" }).click();
    await page.getByText("$ 24.600,00", { exact: true }).waitFor();
    assert.equal(lastStats.from, "2026-10-01");
    assert.equal(lastStats.to, "2026-10-02");
    assert.equal(await page.locator('svg[role="img"]').count(), 2);
    await page
      .getByText("Ver detalle de los gráficos", { exact: true })
      .click();
    await page.getByRole("cell", { name: "-5.400,00", exact: true }).waitFor();
    await page.screenshot({
      path: `${output}/estadisticas-escritorio.png`,
      fullPage: true,
    });
    await page.getByLabel("Agrupar por", { exact: true }).selectOption("month");
    await page.getByRole("button", { name: "Aplicar período" }).click();
    await page.getByText(/Agrupado por mes/).waitFor();
    assert.equal(lastStats.group, "month");
    await page.getByRole("button", { name: "Este año", exact: true }).click();
    await page
      .getByRole("button", { name: "Actualizar estadísticas" })
      .waitFor({ state: "visible" });
    assert.ok(
      (await page.getByLabel("Desde", { exact: true }).inputValue()).endsWith(
        "-01-01",
      ),
    );
    await page.getByLabel("Desde", { exact: true }).fill("2027-01-01");
    await page.getByLabel("Hasta", { exact: true }).fill("2026-01-01");
    await page.getByRole("button", { name: "Aplicar período" }).click();
    await page
      .getByText("La fecha inicial debe ser anterior o igual a la final.", {
        exact: true,
      })
      .waitFor();
    await page.getByRole("link", { name: "Egresos", exact: true }).click();
    await page
      .getByRole("button", { name: "Anular egreso: Seña hotel" })
      .click();
    await page
      .getByLabel("Motivo de anulación", { exact: true })
      .fill("Prueba duplicada");
    await page.getByRole("button", { name: "Confirmar anulación" }).click();
    await page
      .getByText("Egreso anulado. Ya no se incluye en las estadísticas.", {
        exact: true,
      })
      .waitFor();
    await page.getByRole("link", { name: "Estadísticas", exact: true }).click();
    await page.getByText("$ 0,00", { exact: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: `${output}/estadisticas-movil.png`,
      fullPage: true,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    );
    await page.getByRole("link", { name: "Egresos", exact: true }).click();
    await page.getByRole("heading", { name: "Egresos y pagos" }).waitFor();
    await page.screenshot({
      path: `${output}/egresos-movil.png`,
      fullPage: true,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: expenses ARS/USD, uncertain retry preserves request ID, one history row, cancellation, statistics totals, negative balance, date/group controls, navigation and mobile layout. API/Auth mocked; no real financial records created.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
