const automator = require("miniprogram-automator");

const WS_ENDPOINT = "ws://127.0.0.1:9420";
const DEFAULT_TIMEOUT = 30000;

let results = { pass: 0, fail: 0 };
const failures = [];

function assert(condition, name, detail = "") {
  if (condition) {
    results.pass += 1;
    console.log(`  PASS  ${name}`);
  } else {
    results.fail += 1;
    failures.push({ name, detail });
    console.log(`  FAIL  ${name} ${detail}`);
  }
}

async function tapByText(page, text, selector = "view") {
  const elements = await page.$$(selector);
  for (const el of elements) {
    const txt = await el.text();
    if (txt.includes(text)) {
      await el.tap();
      return el;
    }
  }
  return null;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  let miniProgram;
  try {
    miniProgram = await automator.connect({ wsEndpoint: WS_ENDPOINT });
  } catch (e) {
    console.error("连接失败，请确认开发者工具已开启服务端口并运行 cli auto:", e.message);
    process.exit(1);
  }
  console.log("已连接开发者工具自动化通道\n");

  // ============ 1. 首页 ============
  console.log("== 首页 ==");
  await miniProgram.reLaunch("/pages/home/index");
  await sleep(1500);
  let page = await miniProgram.currentPage();
  assert(page.path === "pages/home/index", "首页路由正确", `实际: ${page.path}`);

  const title = await page.$(".home-title");
  const titleText = title ? await title.text() : "";
  assert(titleText.includes("今天想变成什么样"), "首页标题渲染", titleText);

  const creditPill = await page.$(".credit-pill");
  assert(!!creditPill, "积分入口存在");
  if (creditPill) {
    const creditText = await creditPill.text();
    assert(/\d+/.test(creditText), "积分余额显示", creditText);
  }

  const homeCards = await page.$$(".home-card");
  assert(homeCards.length > 0, "首页模板卡片渲染", `数量: ${homeCards.length}`);

  // 分类切换
  const chipHot = await tapByText(page, "热门", ".category-chip");
  assert(!!chipHot, "点击热门分类");
  await sleep(500);
  const sectionsAfterHot = await page.$$(".home-section");
  assert(sectionsAfterHot.length > 0, "热门分类加载区块", `区块数: ${sectionsAfterHot.length}`);

  const chipAnime = await tapByText(page, "风格", ".category-chip");
  assert(!!chipAnime, "点击风格分类");
  await sleep(500);
  const sectionsAfterAnime = await page.$$(".home-section");
  assert(sectionsAfterAnime.length > 0, "风格分类加载区块", `区块数: ${sectionsAfterAnime.length}`);

  // 跳转玩法列表
  await miniProgram.reLaunch("/pages/templates/index");
  await sleep(1200);
  page = await miniProgram.currentPage();
  assert(page.path === "pages/templates/index", "跳转玩法列表", `实际: ${page.path}`);

  // ============ 2. 玩法列表 ============
  console.log("== 玩法列表 ==");
  const tplCount = await page.$(".templates-section-count");
  const tplCountText = tplCount ? await tplCount.text() : "";
  assert(/\d+ 个效果/.test(tplCountText), "模板数量文案", tplCountText);

  const tplCards = await page.$$(".templates-card");
  assert(tplCards.length > 0, "模板卡片渲染", `数量: ${tplCards.length}`);

  // 点击第一个模板跳转创建页
  const firstCard = tplCards[0];
  if (firstCard) {
    const cardName = await firstCard.text();
    try {
      await firstCard.scrollIntoView();
      await sleep(300);
    } catch (e) {
      // 部分版本不支持 scrollIntoView，忽略
    }
    await firstCard.tap();
    await sleep(3000);
    page = await miniProgram.currentPage();
    assert(page.path === "pages/create/index", "点击模板跳转创建页", `实际: ${page.path}`);
    console.log(`  模板: ${cardName.split("\n")[0].trim()}`);
  }

  // ============ 3. 创建页 ============
  console.log("== 创建页 ==");
  await miniProgram.reLaunch("/pages/create/index");
  await sleep(1500);
  page = await miniProgram.currentPage();
  assert(page.path === "pages/create/index", "创建页直达可用", `实际: ${page.path}`);
  const uploadArea = await page.$(".photo-slot");
  assert(!!uploadArea, "上传区域存在");

  // ============ 4. 灵感页 ============
  console.log("== 灵感页 ==");
  await miniProgram.reLaunch("/pages/inspiration/index");
  await sleep(1500);
  page = await miniProgram.currentPage();
  assert(page.path === "pages/inspiration/index", "灵感页直达可用", `实际: ${page.path}`);

  // ============ 5. 我的 ============
  console.log("== 我的 ==");
  await miniProgram.reLaunch("/pages/profile/index");
  await sleep(1500);
  page = await miniProgram.currentPage();
  assert(page.path === "pages/profile/index", "我的页路由正确", `实际: ${page.path}`);

  const userName = await page.$(".user-name");
  const userNameText = userName ? await userName.text() : "";
  assert(userNameText.length > 0, "用户卡片渲染", userNameText);

  const quickCards = await page.$$(".quick-card");
  assert(quickCards.length > 0, "快捷入口渲染", `数量: ${quickCards.length}`);

  // ============ 6. 设置页 ============
  console.log("== 设置 ==");
  await miniProgram.reLaunch("/pages/settings/index");
  await sleep(1500);
  page = await miniProgram.currentPage();
  assert(page.path === "pages/settings/index", "设置页直达可用", `实际: ${page.path}`);

  // ============ 汇总 ============
  console.log(`\n===== 结果: ${results.pass} 通过 / ${results.fail} 失败 =====`);
  if (failures.length) {
    console.log("\n失败明细:");
    failures.forEach((f) => console.log(`  - ${f.name}: ${f.detail}`));
  }

  try {
    await miniProgram.disconnect();
  } catch (e) {
    // ignore
  }
  process.exit(results.fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("测试执行异常:", e);
  process.exit(1);
});
