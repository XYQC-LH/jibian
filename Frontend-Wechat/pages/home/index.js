const api = require("../../services/api");
const templateService = require("../../services/templateService");
const { syncTabBar } = require("../../components/bottom-nav/tabs");

function toHomeCards(items) {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    cover: item.cover
  }));
}

// 基于后端模板列表构建首页分区（后端 id 为 uuid，不再依赖 mock 的静态模板 id 分区）
function buildSections(items) {
  const trackWidth = (cards) => Math.max(cards.length * 221 - 21, 200);
  const sectionOf = (meta, list) => ({
    ...meta,
    cards: toHomeCards(list),
    trackWidth: trackWidth(list)
  });

  const displayNameOf = (key) => (
    templateService.getCategoryDisplayName(key) || `${key}玩法｜选一个马上开变`
  );
  const iconOf = (key) => templateService.getCategoryIcon(key);

  const sections = [];

  // 按分类分组，最多展示 3 个分区
  const groupKeys = [];
  const seen = new Set();

  items.forEach((item) => {
    const key = item.category;

    if (!key || seen.has(key)) {
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
      title: displayNameOf(key),
      icon: iconOf(key),
      iconClass: key === "头像" ? "avatar" : "style"
    }, list));
  });

  return sections;
}

function isChooseMediaCancel(err) {
  return String(err && err.errMsg || "").includes("cancel");
}

Page({
  data: {
    creditBalance: 0,
    homeBanners: [],
    sections: templateService.getHomeSections()
  },

  remoteItems: null,

  onShow() {
    syncTabBar(this, "home");
    this.refreshSections();
    this.setData({
      creditBalance: getApp().globalData.credits
    });
    this.loadHomeBanners();
    this.loadCategories();
    this.loadTemplates();
  },

  loadCategories() {
    templateService.loadCategories().then(() => {
      this.refreshSections();
    });
  },

  refreshSections() {
    const sections = this.remoteItems
      ? buildSections(this.remoteItems)
      : templateService.getHomeSections();

    this.setData({ sections });
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

  goProfile() {
    wx.navigateTo({
      url: "/pages/profile/index"
    });
  },

  goCreate(event) {
    const { id } = event.currentTarget.dataset;

    if (!this.remoteItems) {
      wx.showToast({ title: "模板加载中，请稍后", icon: "none" });
      this.loadTemplates();
      return;
    }

    this.chooseImageAndCreate(id);
  },

  goHeroBanner(event) {
    const { templateId } = event.currentTarget.dataset;

    if (!templateId) {
      return;
    }

    this.chooseImageAndCreate(templateId);
  },

  chooseImageAndCreate(templateId) {
    if (!templateId) {
      return;
    }

    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success: (res) => {
        const imagePath = res.tempFiles && res.tempFiles[0] && res.tempFiles[0].tempFilePath;

        if (!imagePath) {
          wx.showToast({ title: "选择图片失败", icon: "none" });
          return;
        }

        const app = getApp();
        app.globalData.selectedTemplateId = templateId;
        app.globalData.draftImage = imagePath;

        wx.switchTab({
          url: "/pages/create/index"
        });
      },
      fail: (err) => {
        if (isChooseMediaCancel(err)) {
          return;
        }

        wx.showToast({ title: "选择图片失败", icon: "none" });
      }
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
