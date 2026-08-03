const { getStatusBarHeight } = require("../../utils/system");
const { syncTabBar } = require("../../components/bottom-nav/tabs");
const api = require("../../services/api");

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

function buildGroups(records) {
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
      image: record.result || record.cover
    });
  });

  return groups;
}

Page({
  selectPressTimer: null,
  selectPressTriggered: false,

  data: {
    statusBarHeight: 0,
    groups: [],
    hasRecords: false,
    previewUrls: []
  },

  onLoad() {
    this.setData({
      statusBarHeight: getStatusBarHeight()
    });
  },

  async onShow() {
    this.clearSelectPressTimer();
    this.selectPressTriggered = false;
    syncTabBar(this, "gallery");
    const app = getApp();
    await app.ensureLogin();

    let records = app.globalData.generatedRecords;
    try {
      const creations = await api.listUserCreations();
      records = creations.map((item) => ({
        id: item.id,
        result: item.cover_url || item.cover_storage_key,
        cover: item.cover_url || item.cover_storage_key,
        savedAt: new Date(item.created_at).getTime()
      }));
    } catch (err) {
      console.warn("[list creations failed]", err);
    }

    this.setData({
      groups: buildGroups(records),
      hasRecords: records.length > 0,
      previewUrls: records.map((item) => item.result || item.cover)
    });
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
      this.goManage(id);
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

  goManage(selectedId) {
    if (!this.data.hasRecords) {
      return;
    }

    const query = selectedId ? `?selected_id=${encodeURIComponent(selectedId)}` : "";

    wx.navigateTo({
      url: `/pages/gallery-manage/index${query}`
    });
  }
});
