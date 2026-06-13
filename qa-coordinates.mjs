import { chromium } from "playwright";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});

await page.goto("http://127.0.0.1:4178", { waitUntil: "networkidle" });

await page.getByLabel("start coordinates").fill("-1.9500, 30.0580");
await page
  .getByLabel("start coordinates")
  .locator("xpath=following-sibling::button")
  .click();
await page.getByLabel("stop coordinates").fill("-1.9350 30.0800");
await page
  .getByLabel("stop coordinates")
  .locator("xpath=following-sibling::button")
  .click();
await page.getByText("Road distance").waitFor();

const initialStart = await page.getByLabel("Search start place").inputValue();
const initialStop = await page.getByLabel("Search stop place").inputValue();

const dragResults = await page.evaluate(() => {
  const markers = [...document.querySelectorAll(".leaflet-marker-icon.custom-pin")];
  if (markers.length < 2) return { startDragged: false, stopDragged: false };
  for (const marker of markers) {
    marker.dispatchEvent(
      new MouseEvent("mousedown", {
        bubbles: true,
        clientX: marker.getBoundingClientRect().x + 10,
        clientY: marker.getBoundingClientRect().y + 10,
        buttons: 1,
      }),
    );
    marker.dispatchEvent(
      new MouseEvent("mousemove", {
        bubbles: true,
        clientX: marker.getBoundingClientRect().x + 35,
        clientY: marker.getBoundingClientRect().y + 25,
        buttons: 1,
      }),
    );
    marker.dispatchEvent(
      new MouseEvent("mouseup", {
        bubbles: true,
        clientX: marker.getBoundingClientRect().x + 35,
        clientY: marker.getBoundingClientRect().y + 25,
      }),
    );
  }
  return { startDragged: true, stopDragged: true };
});

await page.waitForTimeout(1200);
const finalStart = await page.getByLabel("Search start place").inputValue();
const finalStop = await page.getByLabel("Search stop place").inputValue();

console.log(
  JSON.stringify(
    {
      coordinatesPlaced:
        initialStart.includes("-1.950000") && initialStop.includes("-1.935000"),
      draggableMarkersPresent:
        (await page.locator(".leaflet-marker-draggable.custom-pin").count()) === 2,
      dragEventsAttempted: dragResults,
      startChangedAfterDrag: finalStart !== initialStart,
      stopChangedAfterDrag: finalStop !== initialStop,
      consoleErrors: errors,
    },
    null,
    2,
  ),
);

await browser.close();
