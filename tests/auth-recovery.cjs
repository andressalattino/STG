const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const base = process.env.STG_TEST_BASE_URL || "http://localhost:3010";
const project = "https://noumohegwglspdnjjrwj.supabase.co";
const user = {
  id: "10000000-0000-4000-8000-000000000001",
  email: "qa@example.test",
  aud: "authenticated",
  role: "authenticated",
  created_at: new Date().toISOString(),
};
const encode = (value) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");
const access = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, role: "authenticated" })}.${encode("test-signature")}`;
const session = {
  access_token: access,
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
    let verifications = 0;
    let updates = 0;
    let limited = false;
    await page.route("**/auth/v1/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const headers = {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "*",
      };
      if (request.method() === "OPTIONS")
        return route.fulfill({ status: 204, headers });
      if (url.pathname.endsWith("/recover")) {
        assert.equal(request.postDataJSON().email, user.email);
        assert.equal(
          url.searchParams.get("redirect_to"),
          `${base}/admin/recuperar`,
        );
        return route.fulfill({
          status: limited ? 429 : 200,
          headers,
          json: limited
            ? { error_code: "over_email_send_rate_limit", msg: "rate limit" }
            : {},
        });
      }
      if (url.pathname.endsWith("/verify")) {
        verifications++;
        assert.equal(request.postDataJSON().type, "recovery");
        return route.fulfill({ headers, json: session });
      }
      if (url.pathname.endsWith("/user")) {
        if (request.method() === "PUT") {
          updates++;
          assert.equal(request.postDataJSON().password, "test-password-12345");
        }
        return route.fulfill({ headers, json: user });
      }
      if (url.pathname.endsWith("/logout"))
        return route.fulfill({ headers, json: {} });
      throw new Error("Unexpected Auth request");
    });
    await page.goto(`${base}/admin/recuperar`);
    await page.getByLabel("Correo de tu cuenta").fill(user.email);
    await page
      .getByRole("button", { name: "Enviar correo de recuperación" })
      .click();
    await page.getByRole("status").waitFor();
    await page
      .getByLabel("Enlace de recuperación")
      .fill(
        "https://example.invalid/auth/v1/verify?type=recovery&token=123456789012345678901234",
      );
    await page.getByRole("button", { name: "Verificar enlace" }).click();
    await page.locator('p[role="alert"]').waitFor();
    assert.equal(verifications, 0, "Foreign links must never reach Auth");
    await page
      .getByLabel("Enlace de recuperación")
      .fill(
        `${project}/auth/v1/verify?type=recovery&token=123456789012345678901234`,
      );
    await page.getByRole("button", { name: "Verificar enlace" }).click();
    await page.getByText("Cuenta verificada:").waitFor();
    await page
      .getByLabel("Nueva contraseña", { exact: true })
      .fill("test-password-12345");
    await page
      .getByLabel("Repetí la nueva contraseña", { exact: true })
      .fill("other-password-123");
    await page
      .getByRole("button", { name: "Guardar nueva contraseña" })
      .click();
    await page
      .getByText(
        "Las contraseñas deben coincidir y tener entre 12 y 128 caracteres.",
      )
      .waitFor();
    assert.equal(updates, 0);
    await page
      .getByLabel("Repetí la nueva contraseña", { exact: true })
      .fill("test-password-12345");
    await page
      .getByRole("button", { name: "Guardar nueva contraseña" })
      .click();
    await page
      .getByRole("heading", { name: "Contraseña actualizada" })
      .waitFor();
    assert.equal(updates, 1);
    assert.equal(
      await page.evaluate(() => localStorage.getItem("stg-password-recovery")),
      null,
    );
    // The email's redirect can also complete recovery directly; remove its credentials immediately.
    await page.goto("about:blank");
    await page.goto(
      `${base}/admin/recuperar#type=recovery&access_token=${access}&refresh_token=test-refresh-token`,
    );
    await page.getByText("Cuenta verificada:").waitFor();
    assert.equal(new URL(page.url()).hash, "");
    assert.equal(
      verifications,
      1,
      "A redirect session must not reuse the email OTP",
    );
    limited = true;
    await page.goto(`${base}/admin/recuperar`);
    await page.getByLabel("Correo de tu cuenta").fill(user.email);
    await page
      .getByRole("button", { name: "Enviar correo de recuperación" })
      .click();
    await page.getByText(/Supabase alcanzó el límite temporal/).waitFor();
    console.log(
      "PASS: browser recovery request, trusted-link validation, password confirmation/update, redirect token removal, no credential persistence and rate-limit feedback. Auth mocked; no emails or real password changes.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
