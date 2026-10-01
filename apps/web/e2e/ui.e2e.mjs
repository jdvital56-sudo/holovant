// The ring under a mouse, checked in a real browser against the app's state.
//
// The screen says "click the front card to open it", and a click opened
// nothing: the drag handler captured the pointer on every press, which sends
// the click to the container rather than the card. It went unnoticed because
// the voice opens cards and nobody tested the mouse.
//
// Run against a started server: `pnpm --filter web e2e:ui`.
import { chromium } from "playwright-core";

const CHROME = process.env.HOLOVANT_CHROME || undefined;
const BASE = process.env.HOLOVANT_URL || "http://localhost:3000";
const browser = await chromium.launch({ executablePath: CHROME, headless: false, args: ["--mute-audio"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

const rows = [];
const check = (name, ok, detail = "") => {
  rows.push(ok);
  console.log(`${ok ? "OK  " : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};
const orbit = () => page.evaluate(() => window.__holovant.orbit());

await page.goto(`${BASE}/?e2e`);
await page.waitForTimeout(6000);
const CENTRE = { x: 800, y: 490 };

// 1. A click on the front card opens it.
await page.mouse.click(CENTRE.x, CENTRE.y);
await page.waitForTimeout(1200);
const afterClick = await orbit();
check("клик по передней карточке открывает её", afterClick.expandedId !== null, `открыта: ${afterClick.expandedId}`);

// The open panel must not call live data a sample. It did, on every card but
// two, long after the samples were gone.
const panelText = await page.evaluate(() => document.body.innerText);
check("открытая карточка не называет живые данные образцом", !/sample data/i.test(panelText));

// 2. Escape closes it.
await page.keyboard.press("Escape");
await page.waitForTimeout(1000);
check("Escape закрывает", (await orbit()).expandedId === null);

// 3. A drag turns the ring and opens nothing — the direction that must hold.
const before = (await orbit()).rotation;
await page.mouse.move(CENTRE.x, CENTRE.y);
await page.mouse.down();
for (let i = 1; i <= 12; i++) await page.mouse.move(CENTRE.x - i * 20, CENTRE.y);
await page.mouse.up();
await page.waitForTimeout(1200);
const afterDrag = await orbit();
check("перетаскивание крутит кольцо", afterDrag.rotation !== before, `${before} → ${Math.round(afterDrag.rotation)}`);
check("и ничего не открывает", afterDrag.expandedId === null);

// 4. A click on a side card turns it to the front rather than opening it.
// From a fresh page: after a drag the ring rests wherever it was let go, and
// the card at a given point may by then be the front one.
await page.goto(`${BASE}/?e2e`);
await page.waitForTimeout(6000);
await page.mouse.click(1150, 490);
await page.waitForTimeout(1500);
const side = await orbit();
check("клик по боковой карточке выводит её вперёд", side.selectedId !== null && side.expandedId === null, `выбрана: ${side.selectedId}`);

const passed = rows.filter(Boolean).length;
console.log(JSON.stringify({ passed, total: rows.length }));
await browser.close();
process.exit(passed === rows.length ? 0 : 1);
