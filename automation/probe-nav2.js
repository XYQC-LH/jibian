const automator = require("miniprogram-automator");

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
  try {
    const mp = await automator.connect({ wsEndpoint: "ws://127.0.0.1:9420" });
    await mp.reLaunch("/pages/home/index");
    await sleep(3000);
    const page = await mp.currentPage();
    console.log("page:", page.path);
    const nav = await page.$("bottom-nav");
    console.log("bottom-nav 组件:", nav ? "存在 OK" : "缺失");
    const homeCards = await page.$$(".home-card");
    console.log("首页卡片:", homeCards.length, "个");
    await mp.disconnect();
    process.exit(0);
  } catch (e) {
    console.log("fail:", e.message);
    process.exit(1);
  }
})();
