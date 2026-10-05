const assert = require("node:assert/strict");
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
    await page.route("**/api/content/**", (route) =>
      route.fulfill({
        status: contentFails ? 503 : 200,
        json: contentFails
          ? { error: "Contenido temporalmente no disponible" }
          : [],
      }),
    );
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
    await page.goto(`${base}/admin`);
    await page.locator('input[name="username"]').fill(user.email);
    await page.locator('input[name="password"]').fill("test-password-not-real");
    await page.getByRole("button", { name: "Entrar al panel" }).click();
    await page
      .getByRole("heading", { name: "Gestion de viajes STG" })
      .waitFor();
    const checksAfterLogin = checks;
    await page
      .locator("#admin-trip-form input")
      .first()
      .fill("Borrador que debe conservarse");
    await page.evaluate(() => {
      window.loginFlashed = false;
    });
    await page.getByRole("link", { name: "Abrir sistema de recibos" }).click();
    await page
      .getByRole("button", { name: "Generar recibo", exact: true })
      .waitFor();
    await page.getByRole("link", { name: "Volver a administración" }).click();
    await page
      .getByRole("heading", { name: "Gestion de viajes STG" })
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
      "PASS: one login for admin and receipts, no transient login DOM, preserved editor draft, session restoration despite failed content requests, retryable auth outage and explicit logout. Auth/API mocked; no real credentials or records used.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
