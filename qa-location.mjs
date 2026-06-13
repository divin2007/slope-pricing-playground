import { chromium } from "playwright";

const browser = await chromium.launch({ channel: "msedge", headless: true });

const preciseContext = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  permissions: ["geolocation"],
  geolocation: {
    latitude: -1.9536,
    longitude: 30.0606,
    accuracy: 18,
  },
});
const precisePage = await preciseContext.newPage();
const errors = [];
precisePage.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
await precisePage.goto("http://127.0.0.1:4178", { waitUntil: "networkidle" });
await precisePage.getByRole("button", { name: "Use current location as start" }).click();
await precisePage.getByText("Confirm device position on the map").waitFor();
const preciseCircle = await precisePage.locator(".leaflet-overlay-pane path").count();
await precisePage.getByRole("button", { name: "Use as start A" }).click();
await precisePage.getByText(/Start A confirmed at/).waitFor();
const preciseValue = await precisePage.getByLabel("Search start place").inputValue();

const coarseContext = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  permissions: ["geolocation"],
  geolocation: {
    latitude: -1.9536,
    longitude: 30.0606,
    accuracy: 900,
  },
});
const coarsePage = await coarseContext.newPage();
await coarsePage.goto("http://127.0.0.1:4178", { waitUntil: "networkidle" });
await coarsePage.getByRole("button", { name: "Use current location as start" }).click();
await coarsePage.getByText("Confirm device position on the map").waitFor();
const coarseWarning = await coarsePage.getByText(/accuracy ±900 m/).isVisible();
await coarsePage.getByRole("button", { name: "Cancel" }).click();
const coarseValue = await coarsePage.getByLabel("Search start place").inputValue();

console.log(
  JSON.stringify(
    {
      preciseAccepted: preciseValue.includes("±18 m"),
      preciseLabel: preciseValue,
      preciseCircleVisible: preciseCircle > 0,
      coarseAccuracyVisible: coarseWarning,
      coarseCancelled: coarseValue === "",
      consoleErrors: errors,
    },
    null,
    2,
  ),
);

await preciseContext.close();
await coarseContext.close();
await browser.close();
