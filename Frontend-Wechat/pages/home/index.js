const api = require("../../services/api");
const templateService = require("../../services/templateService");
const { syncTabBar } = require("../../components/bottom-nav/tabs");

const categories = templateService.getCategories();
const categoryIcons = templateService.getCategoryIcons();

function toCategoryItems(activeCategory) {
  return categories.map((label) => ({
    label,
    icon: categoryIcons[label],
    active: label === activeCategory
  }));
}

function toHomeCards(items) {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    cover: item.cover
  }));
}

// 基于后端模板列表构建首页分区（后端 id 为 uuid，不再依赖 mock 的静态模板 id 分区）
function buildSections(items, category) {
  const trackWidth = (cards) => Math.max(cards.length * 221 - 21, 200);
  const sectionOf = (meta, list) => ({
    ...meta,
    cards: toHomeCards(list),
    trackWidth: trackWidth(list)
  });

  if (category && category !== "热门") {
    const list = items.filter((item) => item.category === category);

    return [sectionOf({
      key: category,
      title: `${category}玩法｜选一个马上开变`,
      icon: categoryIcons[category] || "✦",
      iconClass: category === "头像" ? "avatar" : "style"
    }, list)];
  }

  const sections = [];
  const hot = items.slice(0, 4);

  if (hot.length) {
    sections.push(sectionOf({
      key: "hot",
      title: "热门｜大家都在玩",
      icon: categoryIcons["热门"],
      iconClass: "hot"
    }, hot));
  }

  // 按分类分组，补足最多 3 个分区
  const groupKeys = [];
  const seen = new Set();

  items.forEach((item) => {
    const key = item.category;

    if (!key || key === "热门" || seen.has(key)) {
      return;
    }

    seen.add(key);
    groupKeys.push(key);
  });

  groupKeys.slice(0, 3).forEach((key) => {
    const list = items.filter((item) => item.category === key).slice(0, 4);

    if (!list.length) {
      return;
    }

    sections.push(sectionOf({
      key,
      title: `${key}玩法｜选一个马上开变`,
      icon: categoryIcons[key] || "✦",
      iconClass: key === "头像" ? "avatar" : "style"
    }, list));
  });

  return sections;
}

Page({
  data: {
    creditBalance: 0,
    activeCategory: "热门",
    categories: toCategoryItems("热门"),
    homeBanners: [],
    sections: templateService.getHomeSections("热门")
  },

  remoteItems: null,

  onShow() {
    syncTabBar(this, "home");
    this.refreshSections();
    this.setData({
      creditBalance: getApp().globalData.credits
    });
    this.loadHomeBanners();
    this.loadTemplates();
  },

  refreshSections(category = this.data.activeCategory) {
    const sections = this.remoteItems
      ? buildSections(this.remoteItems, category)
      : templateService.getHomeSections(category);

    this.setData({
      activeCategory: category,
      categories: toCategoryItems(category),
      sections
    });
  },

  loadTemplates() {
    templateService.loadTemplates().then((items) => {
      this.remoteItems = templateService.isUsingFallback() ? null : items;
      this.refreshSections();
    });
  },

  loadHomeBanners() {
    api.getHomeOperation().then((config) => {
      const banners = Array.isArray(config && config.home_banners)
        ? config.home_banners.filter((item) => item && item.image_url && item.template_id)
        : [];

      this.setData({
        homeBanners: banners
      });
    }).catch((err) => {
      console.warn("[operation fallback]", err);
      this.setData({
        homeBanners: []
      });
    });
  },

  selectCategory(event) {
    const { category } = event.currentTarget.dataset;

    this.refreshSections(category);
  },

  goProfile() {
    wx.navigateTo({
      url: "/pages/profile/index"
    });
  },

  goCreate(event) {
    const { id } = event.currentTarget.dataset;

    wx.navigateTo({
      url: `/pages/create/index?id=${id}`
    });
  },

  goHeroBanner(event) {
    const { templateId } = event.currentTarget.dataset;

    if (!templateId) {
      return;
    }

    wx.navigateTo({
      url: `/pages/create/index?id=${encodeURIComponent(templateId)}`
    });
  },

  onShareAppMessage() {
    return {
      title: "即变 - 一张图,变出新玩法",
      path: "/pages/home/index"
    };
  },

  onShareTimeline() {
    return {
      title: "即变 - 一张图,变出新玩法"
    };
  }
});
