const { getMenuButtonRightGap, getStatusBarHeight } = require("../../utils/system");
const api = require("../../services/api");

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
  data: {
    statusBarHeight: 0,
    menuButtonRightGap: 0,
    groups: [],
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
    const app = getApp();
    await app.ensureLogin();

    let records = app.globalData.generatedRecords;
    try {
      const creations = await api.listUserCreations();
      records = creations.map((item) => ({
        id: item.id,
        result: item.cover_storage_key,
        cover: item.cover_storage_key,
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

  previewImage(event) {
    const { url } = event.currentTarget.dataset;

    wx.previewImage({
      current: url,
      urls: this.data.previewUrls
    });
  },

  goCreate() {
    wx.navigateTo({
      url: "/pages/inspiration/index"
    });
  },

  goManage() {
    if (!this.data.hasRecords) {
      return;
    }

    wx.navigateTo({
      url: "/pages/gallery-manage/index"
    });
  }
});
