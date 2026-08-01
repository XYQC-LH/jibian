const templateService = require("../../services/templateService");

const categories = templateService.getCategories();

Page({
  data: {
    activeCategory: "热门",
    categories,
    creditBalance: 0,
    templates: templateService.filterTemplates("热门")
  },

  remoteItems: null,

  onShow() {
    this.refreshTemplates();
    this.setData({
      creditBalance: getApp().globalData.credits
    });
    this.loadTemplates();
  },

  refreshTemplates(category = this.data.activeCategory) {
    const templates = this.remoteItems
      ? this.remoteItems.filter((item) => category === "热门" || item.category === category)
      : templateService.filterTemplates(category);

    this.setData({
      activeCategory: category,
      templates
    });
  },

  loadTemplates() {
    templateService.loadTemplates().then((items) => {
      this.remoteItems = templateService.isUsingFallback() ? null : items;
      this.refreshTemplates();
    });
  },

  selectCategory(event) {
    const { category } = event.currentTarget.dataset;

    this.refreshTemplates(category);
  },

  goCreate(event) {
    const { id } = event.currentTarget.dataset;

    wx.redirectTo({
      url: `/pages/create/index?id=${id}`
    });
  },

  goProfile() {
    wx.navigateTo({
      url: "/pages/profile/index"
    });
  },

  onShareAppMessage() {
    return {
      title: "即变玩法库 - 选个模板开变",
      path: "/pages/templates/index"
    };
  },

  onShareTimeline() {
    return {
      title: "即变玩法库 - 选个模板开变"
    };
  }
});
