const { getMenuButtonRightGap, getStatusBarHeight } = require("../../utils/system");
const api = require("../../services/api");
const { saveImageToAlbum } = require("../../utils/saveImage");

function dayStart(time) {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function dayTitle(time) {
  const today = dayStart(Date.now());
  const target = dayStart(time);
  const diff = Math.round((today - target) / 86400000);

  if (diff === 0) {
    return "今天";
  }

  if (diff === 1) {
    return "昨天";
  }

  const date = new Date(time);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function buildItems(records) {
  return records.map((record) => ({
    ...record,
    image: record.result || record.cover,
    savedAt: record.savedAt || Date.now()
  }));
}

function buildCreations(creations) {
  return creations.map((item) => ({
    id: item.id,
    title: item.title,
    image: item.cover_url || item.cover_storage_key || "",
    savedAt: new Date(item.created_at).getTime()
  }));
}

function buildGroups(items, selectedIds) {
  const groups = [];

  items.forEach((item) => {
    const title = dayTitle(item.savedAt || Date.now());
    let group = groups.find((entry) => entry.title === title);

    if (!group) {
      group = { title, items: [] };
      groups.push(group);
    }

    group.items.push({
      ...item,
      selected: selectedIds.includes(item.id)
    });
  });

  return groups.map((group) => ({
    ...group,
    allSelected: group.items.length > 0 && group.items.every((item) => item.selected)
  }));
}

function getDefaultSelectedIds(items, selectedId) {
  if (!items.length) {
    return [];
  }

  if (selectedId) {
    const selected = items.find((item) => String(item.id) === String(selectedId));
    if (selected) {
      return [selected.id];
    }
  }

  return [items[0].id];
}

Page({
  data: {
    statusBarHeight: 0,
    menuButtonRightGap: 0,
    items: [],
    groups: [],
    selectedIds: [],
    allSelected: false,
    initialSelectedId: ""
  },

  onLoad(options = {}) {
    this.setData({
      statusBarHeight: getStatusBarHeight(),
      menuButtonRightGap: getMenuButtonRightGap(),
      initialSelectedId: options.selected_id ? decodeURIComponent(options.selected_id) : ""
    });
  },

  onShow() {
    this.loadCreations();
  },

  loadCreations() {
    api.listUserCreations().then((creations) => {
      const items = buildCreations(creations);
      this.applyItems(items, getDefaultSelectedIds(items, this.data.initialSelectedId));
    }).catch((err) => {
      console.warn("[creations fallback]", err);
      const items = buildItems(getApp().globalData.generatedRecords);
      this.applyItems(items, getDefaultSelectedIds(items, this.data.initialSelectedId));
    });
  },

  applyItems(items, selectedIds) {
    const nextSelectedIds = selectedIds.filter((id) => items.some((item) => item.id === id));
    const nextItems = items.map((item) => ({
      ...item,
      selected: nextSelectedIds.includes(item.id)
    }));

    this.setData({
      items: nextItems,
      groups: buildGroups(nextItems, nextSelectedIds),
      selectedIds: nextSelectedIds,
      allSelected: nextItems.length > 0 && nextSelectedIds.length === nextItems.length
    });
  },

  refreshSelection(selectedIds) {
    this.applyItems(this.data.items, Array.from(new Set(selectedIds)));
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

  toggleGroup(event) {
    const { title } = event.currentTarget.dataset;
    const group = this.data.groups.find((item) => item.title === title);
    if (!group) {
      return;
    }

    const groupIds = group.items.map((item) => item.id);
    const selected = new Set(this.data.selectedIds);

    if (group.allSelected) {
      groupIds.forEach((id) => selected.delete(id));
    } else {
      groupIds.forEach((id) => selected.add(id));
    }

    this.refreshSelection(Array.from(selected));
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
