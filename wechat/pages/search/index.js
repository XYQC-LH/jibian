const { templates } = require("../../data/templates");
const { getMenuButtonRightGap, getStatusBarHeight } = require("../../utils/system");
const api = require("../../services/api");

function searchTemplates(keyword) {
  const query = keyword.trim().toLowerCase();

  if (!query) {
    return templates.slice(0, 8);
  }

  return templates.filter((item) => (
    item.name.toLowerCase().includes(query)
    || item.category.toLowerCase().includes(query)
    || item.description.toLowerCase().includes(query)
  ));
}

Page({
  data: {
    statusBarHeight: 0,
    menuButtonRightGap: 0,
    keyword: "",
    results: searchTemplates(""),
    hotWords: ["头像", "写真", "古风", "街拍", "电影"]
  },

  onLoad() {
    this.setData({
      statusBarHeight: getStatusBarHeight(),
      menuButtonRightGap: getMenuButtonRightGap()
    });
    this.loadTemplates();
  },

  loadTemplates() {
    const templateStore = require("../../data/templates");

    api.listTemplates().then((items) => {
      if (!Array.isArray(items) || !items.length) {
        throw new Error("模板列表为空");
      }

      templateStore.setRemoteTemplates(items);
      this.setData({
        results: searchTemplates(this.data.keyword)
      });
    }).catch((err) => {
      console.warn("[templates fallback]", err);
      templateStore.resetTemplates();
      this.setData({
        results: searchTemplates(this.data.keyword)
      });
    });
  },

  goBack() {
    wx.navigateBack();
  },

  inputKeyword(event) {
    const keyword = event.detail.value;

    this.setData({
      keyword,
      results: searchTemplates(keyword)
    });
  },

  clearKeyword() {
    this.setData({
      keyword: "",
      results: searchTemplates("")
    });
  },

  selectHotWord(event) {
    const { word } = event.currentTarget.dataset;

    this.setData({
      keyword: word,
      results: searchTemplates(word)
    });
  },

  goCreate(event) {
    const { id } = event.currentTarget.dataset;

    wx.navigateTo({
      url: `/pages/create/index?id=${id}`
    });
  }
});
