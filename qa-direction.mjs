import { chromium } from "playwright";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});

await page.goto("http://127.0.0.1:4178", { waitUntil: "networkidle" });
await page.getByLabel("start coordinates").fill("-1.9397, 30.0443");
await page
  .getByLabel("start coordinates")
  .locator("xpath=following-sibling::button")
  .click();
await page.getByLabel("stop coordinates").fill("-1.9534, 30.0935");
await page
  .getByLabel("stop coordinates")
  .locator("xpath=following-sibling::button")
  .click();
await page.getByText("Road distance").waitFor();
await page.waitForTimeout(1500);

const metric = async (label) =>
  page.locator(".metric", { hasText: label }).locator("strong").innerText();

const before = {
  start: await page.getByLabel("Search start place").inputValue(),
  stop: await page.getByLabel("Search stop place").inputValue(),
  climb: await metric("Cumulative climb"),
  drop: await metric("Cumulative drop"),
  net: await metric("Net elevation"),
  steepUp: await metric("Steep uphill share"),
  steepDown: await metric("Steep downhill share"),
};

await page.getByRole("button", { name: "Swap start and stop" }).click();
await page.getByText("Route measured").waitFor();
await page.waitForTimeout(1500);

const after = {
  start: await page.getByLabel("Search start place").inputValue(),
  stop: await page.getByLabel("Search stop place").inputValue(),
  climb: await metric("Cumulative climb"),
  drop: await metric("Cumulative drop"),
  net: await metric("Net elevation"),
  steepUp: await metric("Steep uphill share"),
  steepDown: await metric("Steep downhill share"),
};

const numberFrom = (value) => Number(value.replace(/[^\d.-]/g, ""));
console.log(
  JSON.stringify(
    {
      endpointsSwapped: before.start === after.stop && before.stop === after.start,
      netElevationInverted:
        Math.abs(numberFrom(before.net) + numberFrom(after.net)) <= 5,
      directionalMetricsRecomputed:
        before.climb !== after.climb ||
        before.drop !== after.drop ||
        before.steepUp !== after.steepUp ||
        before.steepDown !== after.steepDown,
      before,
      after,
      consoleErrors: errors,
    },
    null,
    2,
  ),
);

await browser.close();
