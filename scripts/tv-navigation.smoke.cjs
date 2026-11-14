const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });
  page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
  await page.goto(
    (process.env.JARVIS_TEST_URL || "http://127.0.0.1:1420/") + "?tv=1",
  );
  await page.waitForTimeout(1800);
  assert.equal(
    await page
      .locator("html")
      .evaluate((el) => el.classList.contains("tv-mode")),
    true,
  );
  assert.ok(
    await page.evaluate(() => document.activeElement.closest("[role=dialog]")),
  );

  // Use an isolated real DOM fixture to verify geometry, scrolling, modals and editing.
  await page.goto(process.env.JARVIS_TEST_URL || "http://127.0.0.1:1420/");
  await page.evaluate(async () => {
    document.body.innerHTML =
      '<div style="display:flex;gap:30px"><button id="a">A</button><button id="b">B</button><button disabled>Disabled</button></div><button id="c" style="margin-top:30px">C</button><textarea id="text"></textarea><div style="height:1200px"></div><button id="far">Far</button>';
    window.stopTV = (
      await import("/src/tv/navigation.js")
    ).installTVNavigation();
  });
  await page.waitForTimeout(100);
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.evaluate(() => document.activeElement.id), "b");
  await page.keyboard.press("Enter");
  await page.evaluate(() => {
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.id = "dialog";
    dialog.style = "position:fixed;inset:100px;background:black;z-index:100";
    dialog.innerHTML =
      '<button id="close">Close</button><button id="approve">Approve</button>';
    document.body.append(dialog);
    document.querySelector("#close").onclick = () => dialog.remove();
    document.querySelector("#close").focus();
  });
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => document.activeElement.id), "close");
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.evaluate(() => document.activeElement.id), "approve");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => document.activeElement.id), "b");
  await page.evaluate(() => {
    const t = document.querySelector("#text");
    t.value = "hello";
    t.focus();
    t.setSelectionRange(2, 2);
  });
  await page.keyboard.press("ArrowLeft");
  assert.equal(
    await page.evaluate(() => document.querySelector("#text").selectionStart),
    1,
  );
  await page.evaluate(() => {
    const t = document.querySelector("#text");
    t.setSelectionRange(5, 5);
  });
  await page.keyboard.press("ArrowDown");
  assert.equal(await page.evaluate(() => document.activeElement.id), "far");
  assert.ok(
    (await page
      .locator("#far")
      .evaluate((el) => el.getBoundingClientRect().bottom)) <= 720,
  );
  console.log(
    "PASS: spatial D-pad movement, disabled exclusion, dialog containment/restore, OK activation, text caret, field escape, offscreen scroll",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
