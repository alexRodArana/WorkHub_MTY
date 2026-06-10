import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const playwrightPackagePath = process.env.PLAYWRIGHT_PACKAGE_PATH ?? '/tmp/workhub-browser/node_modules/playwright';

let chromium;
try {
  ({ chromium } = require(playwrightPackagePath));
} catch {
  throw new Error(
    `Playwright is required to capture screenshots. Install it outside the repo, for example: ` +
    `mkdir -p /tmp/workhub-browser && cd /tmp/workhub-browser && npm init -y && npm install playwright && npx playwright install chromium. ` +
    `Current package path: ${playwrightPackagePath}`
  );
}

const FRONT_URL = process.env.FRONT_URL ?? 'http://127.0.0.1:5173';
const API_URL = process.env.API_URL ?? 'http://127.0.0.1:3000';
const OUTPUT_DIR = path.resolve('docs/evidence/calidad-m5/screenshots');
const SESSION_KEY = 'workhub_session';
const DEMO_PASSWORD = 'WorkHubDemo123!';

const accounts = {
  employee: { email: 'ana.garcia@lumina.demo', password: DEMO_PASSWORD },
  admin: { email: 'admin.demo@lumina.demo', password: DEMO_PASSWORD },
  guard: { email: 'guardia.demo@lumina.demo', password: DEMO_PASSWORD },
};

async function login(account) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(account),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Login failed for ${account.email}: ${response.status} ${body}`);
  }

  return response.json();
}

async function createContext(browser, session, viewport = { width: 1440, height: 930 }) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });

  const storedSession = {
    access_token: session.access_token,
    token_type: session.token_type,
    expires_in: session.expires_in,
    login_timestamp: Date.now() / 1000,
    user: { ...session.user, profile_photo_url: null },
  };

  await context.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    [SESSION_KEY, storedSession],
  );

  return context;
}

async function settle(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1800);
  await page.keyboard.press('Escape').catch(() => undefined);
}

async function capture(page, route, filename) {
  await page.goto(`${FRONT_URL}${route}`);
  await settle(page);
  await page.screenshot({
    path: path.join(OUTPUT_DIR, filename),
    fullPage: false,
  });
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const sessions = {
    employee: await login(accounts.employee),
    admin: await login(accounts.admin),
    guard: await login(accounts.guard),
  };

  const browser = await chromium.launch({ headless: true });

  try {
    const publicContext = await browser.newContext({ viewport: { width: 1440, height: 930 }, reducedMotion: 'reduce' });
    const publicPage = await publicContext.newPage();
    await capture(publicPage, '/login', '01-login.png');
    await publicContext.close();

    const employeeContext = await createContext(browser, sessions.employee);
    const employeePage = await employeeContext.newPage();
    await capture(employeePage, '/dashboard', '02-empleado-dashboard.png');
    await capture(employeePage, '/nueva-reserva', '03-nueva-reserva-mapa.png');
    await capture(employeePage, '/mis-reservas', '04-mis-reservas-checkout.png');
    await capture(employeePage, '/logros', '05-logros-badges.png');
    await capture(employeePage, '/perfil', '06-perfil-vehiculos.png');
    await employeeContext.close();

    const adminContext = await createContext(browser, sessions.admin);
    const adminPage = await adminContext.newPage();
    await capture(adminPage, '/admin', '07-admin-dashboard-kpis.png');
    await capture(adminPage, '/admin/gestion', '08-admin-gestion-bloqueo.png');
    await capture(adminPage, '/admin/bloqueos', '09-admin-bloqueos-activos.png');
    await adminContext.close();

    const guardContext = await createContext(browser, sessions.guard);
    const guardPage = await guardContext.newPage();
    await capture(guardPage, '/guardia', '10-guardia-estacionamiento.png');
    await guardContext.close();

    const mobileContext = await createContext(browser, sessions.employee, { width: 390, height: 844 });
    const mobilePage = await mobileContext.newPage();
    await capture(mobilePage, '/nueva-reserva', '11-mobile-nueva-reserva.png');
    await mobileContext.close();
  } finally {
    await browser.close();
  }

  console.log(`Screenshots saved in ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
