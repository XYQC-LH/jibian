const { getMenuButtonRightGap, getStatusBarHeight } = require("../../utils/system");
const api = require("../../services/api");
const { saveImageToAlbum } = require("../../utils/saveImage");

function buildItems(records) {
  return records.map((record) => ({
    ...record,
    image: record.result || record.cover
  }));
}

function buildCreations(creations) {
  return creations.map((item) => ({
    id: item.id,
    title: item.title,
    image: item.cover_url || item.cover_storage_key || ""
  }));
}

Page({
  data: {
    statusBarHeight: 0,
    menuButtonRightGap: 0,
    items: [],
    selectedIds: [],
    allSelected: false
  },

  onLoad() {
    this.setData({
      statusBarHeight: getStatusBarHeight(),
      menuButtonRightGap: getMenuButtonRightGap()
    });
  },

  onShow() {
    this.loadCreations();
  },

  loadCreations() {
    api.listUserCreations().then((creations) => {
      const items = buildCreations(creations);
      this.applyItems(items, items.length ? [items[0].id] : []);
    }).catch((err) => {
      console.warn("[creations fallback]", err);
      const items = buildItems(getApp().globalData.generatedRecords);
      this.applyItems(items, items.length ? [items[0].id] : []);
    });
  },

  applyItems(items, selectedIds) {
    this.setData({
      items: items.map((item) => ({
        ...item,
        selected: selectedIds.includes(item.id)
      })),
      selectedIds,
      allSelected: items.length > 0 && selectedIds.length === items.length
    });
  },

  refreshSelection(selectedIds) {
    this.applyItems(this.data.items, selectedIds);
  },

  goBack() {
    wx.navigateBack();
  },

  toggleItem(event) {
    const { id } = event.currentTarget.dataset;
    const selectedIds = this.data.selectedIds.includes(id)
      ? this.data.selectedIds.filter((item) => item !== id)
      : [...this.data.selectedIds, id];

    this.refreshSelection(selectedIds);
  },

  toggleAll() {
    const selectedIds = this.data.allSelected ? [] : this.data.items.map((item) => item.id);

    this.refreshSelection(selectedIds);
  },

  shareSelected() {
    wx.showToast({
      title: this.data.selectedIds.length ? "已准备分享" : "先选择作品",
      icon: "none"
    });
  },

  downloadSelected() {
    if (!this.data.selectedIds.length) {
      wx.showToast({ title: "先选择作品", icon: "none" });
      return;
    }

    const selected = this.data.items.filter((item) => this.data.selectedIds.includes(item.id));
    wx.showLoading({ title: "保存中" });
    selected.reduce(
      (chain, item) => chain.then(() => saveImageToAlbum(item.image)),
      Promise.resolve()
    ).then(() => {
      wx.hideLoading();
      wx.showToast({ title: "已保存", icon: "success" });
    }).catch((err) => {
      wx.hideLoading();
      wx.showToast({ title: (err && err.message) || "保存失败", icon: "none" });
    });
  },

  deleteSelected() {
    if (!this.data.selectedIds.length) {
      wx.showToast({
        title: "先选择作品",
        icon: "none"
      });
      return;
    }

    wx.showModal({
      title: "删除作品",
      content: "将从作品库移除已选择的作品。",
      confirmText: "删除",
      confirmColor: "#FF2D55",
      success: (res) => {
        if (!res.confirm) {
          return;
        }

        const ids = this.data.selectedIds;

        wx.showLoading({
          title: "删除中"
        });
        Promise.all(ids.map((id) => api.deleteUserCreation(id))).then(() => {
          wx.hideLoading();
          getApp().removeGeneratedRecords(ids);
          this.loadCreations();
          wx.showToast({
            title: "已删除",
            icon: "success"
          });
        }).catch((err) => {
          wx.hideLoading();
          wx.showToast({
            title: (err && err.message) || "删除失败，请稍后重试",
            icon: "none"
          });
        });
      }
    });
  }
});
