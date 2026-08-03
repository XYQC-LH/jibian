const { getMenuButtonRightGap, getStatusBarHeight } = require("../../utils/system");
const { syncTabBar } = require("../../components/bottom-nav/tabs");
const api = require("../../services/api");
const { saveImageToAlbum } = require("../../utils/saveImage");

const SELECT_PRESS_DELAY_MS = 1500;

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
    image: record.image || record.result || record.cover,
    savedAt: record.savedAt || Date.now()
  }));
}

function buildGroups(records, selectedIds = []) {
  const groups = [];

  records.forEach((record) => {
    const title = dayTitle(record.savedAt || Date.now());
    let group = groups.find((item) => item.title === title);

    if (!group) {
      group = { title, items: [] };
      groups.push(group);
    }

    group.items.push({
      ...record,
      image: record.image || record.result || record.cover,
      selected: selectedIds.includes(record.id)
    });
  });

  return groups.map((group) => ({
    ...group,
    allSelected: group.items.length > 0 && group.items.every((item) => item.selected)
  }));
}

function getDefaultSelectedIds(items, selectedId) {
  const selected = items.find((item) => String(item.id) === String(selectedId));
  return selected ? [selected.id] : [];
}

Page({
  selectPressTimer: null,
  selectPressTriggered: false,

  data: {
    statusBarHeight: 0,
    menuButtonRightGap: 0,
    items: [],
    groups: [],
    selectedIds: [],
    allSelected: false,
    isSelecting: false,
    hasRecords: false,
    previewUrls: []
  },

  onLoad() {
    this.setData({
      statusBarHeight: getStatusBarHeight(),
      menuButtonRightGap: getMenuButtonRightGap()
    });
  },

  async onShow() {
    this.clearSelectPressTimer();
    this.selectPressTriggered = false;
    syncTabBar(this, "gallery");
    await this.loadRecords();
  },

  async loadRecords() {
    const app = getApp();
    await app.ensureLogin();

    let records = app.globalData.generatedRecords;
    try {
      const creations = await api.listUserCreations();
      records = creations.map((item) => ({
        id: item.id,
        result: item.cover_url || item.cover_storage_key,
        cover: item.cover_url || item.cover_storage_key,
        image: item.cover_url || item.cover_storage_key,
        savedAt: new Date(item.created_at).getTime()
      }));
    } catch (err) {
      console.warn("[list creations failed]", err);
    }

    this.applyItems(buildItems(records), this.data.selectedIds, this.data.isSelecting);
  },

  onHide() {
    this.clearSelectPressTimer();
    },

  onUnload() {
    this.clearSelectPressTimer();
    },

  clearSelectPressTimer() {
    if (!this.selectPressTimer) {
      return;
    }

    clearTimeout(this.selectPressTimer);
    this.selectPressTimer = null;
  },

  startSelectPress(event) {
    const { id } = event.currentTarget.dataset;
    if (!id || !this.data.hasRecords) {
      return;
    }

    this.clearSelectPressTimer();
    this.selectPressTriggered = false;
    this.selectPressTimer = setTimeout(() => {
      this.selectPressTimer = null;
      this.selectPressTriggered = true;
      this.enterSelectMode(id);
    }, SELECT_PRESS_DELAY_MS);
  },

  cancelSelectPress() {
    this.clearSelectPressTimer();
  },

  previewImage(event) {
    if (this.selectPressTriggered) {
      this.selectPressTriggered = false;
      return;
    }

    const { url } = event.currentTarget.dataset;

    wx.previewImage({
      current: url,
      urls: this.data.previewUrls
    });
  },

  applyItems(items, selectedIds, isSelecting) {
    const nextSelectedIds = selectedIds.filter((id) => items.some((item) => item.id === id));
    const nextItems = items.map((item) => ({
      ...item,
      selected: nextSelectedIds.includes(item.id)
    }));
    const nextIsSelecting = Boolean(isSelecting && nextItems.length);

    this.setData({
      items: nextItems,
      groups: buildGroups(nextItems, nextSelectedIds),
      selectedIds: nextSelectedIds,
      allSelected: nextItems.length > 0 && nextSelectedIds.length === nextItems.length,
      isSelecting: nextIsSelecting,
      hasRecords: nextItems.length > 0,
      previewUrls: nextItems.map((item) => item.image)
    });
  },

  refreshSelection(selectedIds) {
    this.applyItems(this.data.items, Array.from(new Set(selectedIds)), this.data.isSelecting);
  },

  enterSelectMode(selectedId) {
    if (!this.data.hasRecords) {
      return;
    }

    const selectedIds = getDefaultSelectedIds(this.data.items, selectedId);
    if (!selectedIds.length) {
      return;
    }

    this.applyItems(this.data.items, selectedIds, true);
    },

  exitSelectMode() {
    this.applyItems(this.data.items, [], false);
    },

  toggleItem(event) {
    const { id } = event.currentTarget.dataset;
    const item = this.data.items.find((entry) => String(entry.id) === String(id));
    if (!item) {
      return;
    }

    const selectedIds = this.data.selectedIds.includes(item.id)
      ? this.data.selectedIds.filter((selectedId) => selectedId !== item.id)
      : [...this.data.selectedIds, item.id];

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
        Promise.all(ids.map((id) => api.deleteUserCreation(id))).then(async () => {
          wx.hideLoading();
          getApp().removeGeneratedRecords(ids);
          this.exitSelectMode();
          await this.loadRecords();
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
