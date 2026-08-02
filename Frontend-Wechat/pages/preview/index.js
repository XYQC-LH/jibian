const { findTemplate } = require("../../data/templates");
const api = require("../../services/api");
const { saveImageToAlbum } = require("../../utils/saveImage");

const TASK_POLL_INTERVAL = 2000;
const TASK_MAX_ATTEMPTS = 10;

Page({
  data: {
    image: "",
    title: "",
    recordId: "",
    templateId: "",
    toolbarVisible: false
  },

  onLoad(query) {
    const app = getApp();
    const recordKey = query.recordId || query.id || (query.templateId ? "" : app.globalData.currentRecordId);
    const record = recordKey ? app.getGeneratedRecord(recordKey) : null;
    const template = findTemplate(record ? record.templateId : query.templateId || app.globalData.selectedTemplateId);

    this.setData({
      image: record ? record.result : template.result,
      title: record ? record.name : template.name,
      recordId: record ? record.id : "",
      templateId: template.id
    });

    if (!record && query.taskId) {
      this.pollTask(query.taskId);
    } else if (!record && query.creationId) {
      this.loadCreation(query.creationId);
    }
  },

  pollTask(taskId, attempt = 1) {
    api.getTask(taskId).then((task) => {
      if (task && task.status === "failed") {
        wx.showToast({
          title: (task.error_message || "生成失败，请重试").slice(0, 20),
          icon: "none"
        });
        return;
      }

      if (task && task.result && task.result.url) {
        this.setData({
          image: task.result.url
        });
        return;
      }

      if (attempt >= TASK_MAX_ATTEMPTS) {
        wx.showToast({
          title: "生成超时，请稍后再试",
          icon: "none"
        });
        return;
      }

      setTimeout(() => {
        this.pollTask(taskId, attempt + 1);
      }, TASK_POLL_INTERVAL);
    }).catch((err) => {
      wx.showToast({
        title: ((err && err.message) || "任务查询失败").slice(0, 20),
        icon: "none"
      });
    });
  },

  loadCreation(creationId) {
    api.getUserCreation(creationId).then((creation) => {
      if (creation && (creation.cover_url || creation.cover_storage_key)) {
        this.setData({
          image: creation.cover_url || creation.cover_storage_key
        });
      }
    }).catch((err) => {
      wx.showToast({
        title: ((err && err.message) || "作品加载失败").slice(0, 20),
        icon: "none"
      });
    });
  },

  toggleToolbar() {
    this.setData({
      toolbarVisible: !this.data.toolbarVisible
    });
  },

  goBack() {
    wx.navigateBack();
  },

  downloadImage() {
    wx.showLoading({ title: "保存中" });
    saveImageToAlbum(this.data.image).then(() => {
      wx.hideLoading();
      wx.showToast({ title: "已保存", icon: "success" });
    }).catch((err) => {
      wx.hideLoading();
      wx.showToast({ title: (err && err.message) || "保存失败", icon: "none" });
    });
  },

  onShareAppMessage() {
    return {
      title: `即变了一张「${this.data.title || "新作品"}」`,
      path: this.data.recordId
        ? `/pages/result/index?recordId=${this.data.recordId}`
        : `/pages/create/index?id=${this.data.templateId}`
    };
  }
});
