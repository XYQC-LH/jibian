const templateService = require("../../services/templateService");
const { getStatusBarHeight } = require("../../utils/system");

function buildFavorites(ids) {
  const idSet = new Set(ids);

  return templateService.getCurrentTemplates().filter((item) => idSet.has(item.id));
}

function getLocalFavorites() {
  return buildFavorites(getApp().globalData.favoriteTemplateIds);
}

Page({
  data: {
    statusBarHeight: 0,
    favorites: []
  },

  onLoad() {
    this.setData({
      statusBarHeight: getStatusBarHeight()
    });
  },

  async onShow() {
    const app = getApp();

    this.setData({
      favorites: buildFavorites(app.globalData.favoriteTemplateIds)
    });

    await app.ensureLogin();
    await templateService.loadTemplates();

    try {
      const items = await templateService.listFavoriteTemplates();

      this.setData({
        favorites: Array.isArray(items) ? items : this.data.favorites
      });
    } catch (err) {
      console.warn("[favorites failed]", err);
      this.setData({
        favorites: buildFavorites(app.globalData.favoriteTemplateIds)
      });
    }
  },

  goBack() {
    wx.navigateBack();
  },

  goCreate(event) {
    const { id } = event.currentTarget.dataset;

    wx.navigateTo({
      url: `/pages/create/index?id=${id}`
    });
  },

  removeFavorite(event) {
    const { id } = event.currentTarget.dataset;
    const app = getApp();
    const beforeIds = app.globalData.favoriteTemplateIds.slice();

    app.setFavoriteTemplateIds(beforeIds.filter((item) => item !== id));
    this.setData({ favorites: getLocalFavorites() });

    app.syncFavoriteTemplate(id, false, beforeIds).catch((err) => {
      console.warn("[favorite remove failed]", err);
      this.setData({ favorites: buildFavorites(beforeIds) });
      wx.showToast({
        title: err.message || "操作失败",
        icon: "none"
      });
    });
  },

  goInspiration() {
    wx.navigateTo({
      url: "/pages/inspiration/index"
    });
  }
});
