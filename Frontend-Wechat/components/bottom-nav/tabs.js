const tabs = [
  { key: "home", label: "首页", pagePath: "pages/home/index", url: "/pages/home/index", leftRpx: 0 },
  { key: "inspiration", label: "灵感", pagePath: "pages/inspiration/index", url: "/pages/inspiration/index", leftRpx: 150 },
  { key: "create", label: "即变", pagePath: "pages/create/index", url: "/pages/create/index", leftRpx: 300 },
  { key: "gallery", label: "图库", pagePath: "pages/gallery/index", url: "/pages/gallery/index", leftRpx: 450 },
  { key: "profile", label: "我的", pagePath: "pages/profile/index", url: "/pages/profile/index", leftRpx: 600 }
];

function normalizeRoute(value) {
  return String(value || "").replace(/^\//, "");
}

function getTabIndex(value) {
  const route = normalizeRoute(value);

  return tabs.findIndex((tab) => (
    tab.key === value ||
    tab.pagePath === route ||
    normalizeRoute(tab.url) === route
  ));
}

function syncTabBar(page, value) {
  const index = getTabIndex(value);

  if (index < 0 || !page || typeof page.getTabBar !== "function") {
    return;
  }

  const tabBar = page.getTabBar();
  if (tabBar) {
    tabBar.setData({ selected: index });
  }
}

module.exports = { tabs, getTabIndex, syncTabBar };
