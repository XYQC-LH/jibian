const automator = require("miniprogram-automator");

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
  try {
    const mp = await automator.connect({ wsEndpoint: "ws://127.0.0.1:9420" });
    console.log("CONNECTED");

    const pages = [
      "/pages/home/index",
      "/pages/templates/index",
      "/pages/inspiration/index",
      "/pages/favorites/index",
      "/pages/profile/index",
      "/pages/credits/index",
      "/pages/redeem-code/index",
      "/pages/gallery-manage/index",
      "/pages/account-delete/index",
      "/pages/preview/index"
    ];

    for (const p of pages) {
      try {
        await mp.reLaunch(p);
        await sleep(2000);
        const page = await mp.currentPage();
        console.log((page.path === p.slice(1) ? "OK  " : "MISMATCH ") + p + " => " + page.path);
      } catch (e) {
        console.log("FAIL " + p + " => " + e.message);
      }
    }

    await mp.disconnect();
    process.exit(0);
  } catch (e) {
    console.log("conn fail:", e.message);
    process.exit(1);
  }
})();
