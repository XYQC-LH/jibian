const automator = require("miniprogram-automator");

(async () => {
  try {
    const mp = await automator.connect({ wsEndpoint: "ws://127.0.0.1:9420" });
    console.log("CONNECTED");
    const page = await mp.reLaunch("/pages/home/index");
    console.log("page:", page.path);
    const title = await page.$(".home-title");
    console.log("title:", title ? await title.text() : "NOT FOUND");
    await mp.disconnect();
    process.exit(0);
  } catch (e) {
    console.log("fail:", e.message);
    process.exit(1);
  }
})();
