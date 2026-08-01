const automator = require("miniprogram-automator");

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
  try {
    const mp = await automator.connect({ wsEndpoint: "ws://127.0.0.1:9420" });
    console.log("CONNECTED");

    await mp.reLaunch("/pages/home/index");
    await sleep(1500);
    let page = await mp.currentPage();
    console.log("home:", page.path);

    await page.navigateTo("/pages/inspiration/index");
    await sleep(2500);
    page = await mp.currentPage();
    console.log("after navigateTo inspiration:", page.path);

    await mp.disconnect();
    process.exit(0);
  } catch (e) {
    console.log("fail:", e.message);
    process.exit(1);
  }
})();
