import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const output = path.join(root, "qa-output");
fs.mkdirSync(output, { recursive: true });

const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
});

const context = await browser.newContext({
  viewport: { width: 1840, height: 1024 },
  acceptDownloads: true,
  permissions: ["geolocation"],
  geolocation: { latitude: -1.9536, longitude: 30.0606 },
});
const page = await context.newPage();
await page.addInitScript(() => localStorage.clear());
const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(error.message));

await page.goto("http://127.0.0.1:4178", { waitUntil: "networkidle" });
const initialSampleCount = await page.getByText(/\d+ samples/).count();
const initialFare = await page.getByLabel("Actual amount paid").inputValue();
const initialRoute = await page.locator(".leaflet-overlay-pane path").count();
const initialVehicle = await page.getByLabel("Vehicle").inputValue();
await page.screenshot({
  path: path.join(output, "initial-empty.png"),
  fullPage: true,
});
const startSearch = page.getByLabel("Search start place");
await startSearch.fill("Kimironko");
await page.getByRole("button", { name: /Kimironko/i }).first().waitFor();
await page.getByRole("button", { name: /Kimironko/i }).first().click();
await page.getByRole("button", { name: "Use current location as stop" }).click();
await page.getByText("Confirm device position on the map").waitFor();
await page.getByRole("button", { name: "Use as stop B" }).click();
await page.getByText(/Stop B confirmed at/).waitFor();
const currentLocationWorked = true;
await page.getByText("Measured terrain facts").waitFor();
await page.getByText("Road distance").waitFor();
await page.getByLabel("Actual amount paid").fill("1300");
await page.getByLabel("Vehicle").selectOption("Motorcycle");
await page.getByLabel("Road condition").selectOption("Dry");
await page.getByLabel("Road surface").selectOption("Paved / mixed");
await page.screenshot({
  path: path.join(output, "desktop-locations.png"),
  fullPage: true,
});

await page.getByRole("button", { name: "Normal map" }).click();
await page.getByRole("button", { name: "Terrain map" }).click();
await page.getByRole("button", { name: "Log ride data" }).click();
await page.getByText("KSP-0001", { exact: true }).waitFor();

const downloadPromise = page.waitForEvent("download");
await page.getByRole("button", { name: "Download multi-sheet Excel" }).click();
const download = await downloadPromise;
await download.saveAs(path.join(output, download.suggestedFilename()));

await page.screenshot({
  path: path.join(output, "desktop-locations-logged.png"),
  fullPage: true,
});

await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({
  path: path.join(output, "mobile-locations.png"),
  fullPage: true,
});

const report = {
  title: await page.title(),
  initialScreenEmpty:
    initialSampleCount === 0 &&
    initialFare === "" &&
    initialRoute === 0 &&
    initialVehicle === "",
  autocompleteSelected: /Kimironko/i.test(await startSearch.inputValue()),
  currentLocationSelected: currentLocationWorked,
  tripVisible: await page.getByText("KSP-0001", { exact: true }).isVisible(),
  excelDownloaded: fs.existsSync(
    path.join(output, "kigali-rider-slope-pricing-dataset.xlsx"),
  ),
  bodyScrollWidth: await page.evaluate(() => document.body.scrollWidth),
  viewportWidth: await page.evaluate(() => window.innerWidth),
  consoleErrors,
};
fs.writeFileSync(
  path.join(output, "qa-results.json"),
  JSON.stringify(report, null, 2),
);

await browser.close();
