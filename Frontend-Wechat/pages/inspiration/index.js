const templateService = require("../../services/templateService");
const { syncTabBar } = require("../../components/bottom-nav/tabs");
const { getMenuButtonRightGap, getStatusBarHeight } = require("../../utils/system");

const LOCAL_CATEGORIES = ["热门", "风格", "头像", "写真", "角色"];

function resolveCategory(category) {
  return category === "职场" ? "风格" : category;
}

function decorateTemplates(category, favoriteIds) {
  const favoriteIdSet = new Set(favoriteIds);
  const items = templateService.filterTemplates(resolveCategory(category)).map((item) => ({
    ...item,
    favorite: favoriteIdSet.has(item.id)
  }));

  // 双列瀑布流：按奇偶索引分列，配合 widthFix 让卡片高度随图片比例自然错落
  const left = [];
  const right = [];
  items.forEach((item, index) => {
    if (index % 2 === 0) {
      left.push(item);
    } else {
      right.push(item);
    }
  });

  return { left, right };
}

Page({
  data: {
    statusBarHeight: 0,
    menuButtonRightGap: 0,
    activeCategory: "热门",
    categories: LOCAL_CATEGORIES,
    columns: { left: [], right: [] }
  },

  onLoad() {
    this.setData({
      statusBarHeight: getStatusBarHeight(),
      menuButtonRightGap: getMenuButtonRightGap()
    });
  },

  onShow() {
    syncTabBar(this, "inspiration");
    this.refreshTemplates();
    templateService.refreshFavoriteTemplateIds().then(() => this.refreshTemplates());
    templateService.loadTemplates().then(() => this.refreshTemplates());
    this.loadCategories();
  },

  loadCategories() {
    templateService.loadCategories().then((items) => {
      const remote = (Array.isArray(items) ? items : []).map((item) => item.name).filter(Boolean);
      const categories = remote.length ? remote : LOCAL_CATEGORIES;

      this.setData({
        categories,
        activeCategory: categories.includes(this.data.activeCategory) ? this.data.activeCategory : categories[0]
      });
      this.refreshTemplates(this.data.activeCategory);
    });
  },

  refreshTemplates(category = this.data.activeCategory) {
    this.setData({
      activeCategory: category,
      columns: decorateTemplates(category, getApp().globalData.favoriteTemplateIds)
    });
  },

  selectCategory(event) {
    const { category } = event.currentTarget.dataset;

    this.refreshTemplates(category);
  },

  toggleFavorite(event) {
    const { id } = event.currentTarget.dataset;
    const app = getApp();
    const beforeIds = app.globalData.favoriteTemplateIds.slice();
    const isFavorite = beforeIds.includes(id);
    const nextIds = isFavorite
      ? beforeIds.filter((item) => item !== id)
      : [id, ...beforeIds];

    // 本地先行更新，失败时回滚
    app.setFavoriteTemplateIds(nextIds);
    this.setData({
      columns: decorateTemplates(this.data.activeCategory, nextIds)
    });

    app.syncFavoriteTemplate(id, !isFavorite, beforeIds).catch((err) => {
      console.warn("[favorite sync failed]", err);
      this.setData({
        columns: decorateTemplates(this.data.activeCategory, beforeIds)
      });
      wx.showToast({
        title: err.message || "操作失败",
        icon: "none"
      });
    });
  },

  goCreate(event) {
    const { id } = event.currentTarget.dataset;

    wx.navigateTo({
      url: `/pages/create/index?id=${id}`
    });
  },

  onShareAppMessage() {
    return {
      title: "即变灵感 - 选个玩法马上变",
      path: "/pages/inspiration/index"
    };
  },

  onShareTimeline() {
    return {
      title: "即变灵感 - 选个玩法马上变"
    };
  }
});
