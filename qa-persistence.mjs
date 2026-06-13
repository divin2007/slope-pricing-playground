import { chromium } from "playwright";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const dist = path.join(process.cwd(), "dist");
const port = 4179;
const url = process.argv[2] || `http://127.0.0.1:${port}`;
const userDataDir = `${process.cwd()}/qa-output/persistence-profile`;
const contentTypes = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
};

const server = http.createServer((request, response) => {
  const requestedPath = request.url === "/" ? "/index.html" : request.url;
  const filePath = path.join(dist, requestedPath.split("?")[0]);
  const safePath = filePath.startsWith(dist) && fs.existsSync(filePath)
    ? filePath
    : path.join(dist, "index.html");
  response.writeHead(200, {
    "Content-Type": contentTypes[path.extname(safePath)] || "application/octet-stream",
  });
  response.end(fs.readFileSync(safePath));
});
await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));

async function openApp() {
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "msedge",
    headless: true,
    viewport: { width: 1440, height: 1000 },
  });
  const page = context.pages()[0] || (await context.newPage());
  await page.goto(url, { waitUntil: "networkidle" });
  return { context, page };
}

let session = await openApp();
await session.page.evaluate(async () => {
  localStorage.clear();
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase("kigali-slope-pricing-playground");
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
});
await session.page.reload({ waitUntil: "networkidle" });

await session.page.evaluate(() => {
  const trip = {
    tripId: "KSP-0001",
    recordedAt: new Date().toISOString(),
    startName: "Nyarugenge",
    stopName: "Kimironko",
    actualFareRwf: 1500,
    distanceKm: 8.2,
    cumulativeClimbM: 171,
    cumulativeDropM: 87,
    averageUphillSlopePct: 4.2,
    maximumAbsoluteSlopePct: 13.4,
    steepRouteRatioPct: 18.7,
    samples: [],
    transitions: [],
  };
  localStorage.setItem("kigali-slope-trips", JSON.stringify([trip]));
});
await session.page.reload({ waitUntil: "networkidle" });
await session.page.getByText("KSP-0001", { exact: true }).waitFor();
await session.page.getByText("Saved in this browser", { exact: true }).waitFor();

await session.page.evaluate(() => localStorage.clear());
await session.page.reload({ waitUntil: "networkidle" });
const survivedReload = await session.page.getByText("KSP-0001", { exact: true }).isVisible();
await session.context.close();

session = await openApp();
const survivedBrowserRestart = await session.page
  .getByText("KSP-0001", { exact: true })
  .isVisible();
const persistenceLabel = await session.page
  .getByText("Saved in this browser", { exact: true })
  .isVisible();
await session.context.close();
await new Promise((resolve) => server.close(resolve));

console.log(
  JSON.stringify(
    { url, survivedReload, survivedBrowserRestart, persistenceLabel },
    null,
    2,
  ),
);
