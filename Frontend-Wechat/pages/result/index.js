const { findTemplate } = require("../../data/templates");
const { getMenuButtonRightGap, getStatusBarHeight } = require("../../utils/system");
const api = require("../../services/api");
const { saveImageToAlbum } = require("../../utils/saveImage");

Page({
  data: {
    statusBarHeight: 0,
    menuButtonRightGap: 0,
    template: {},
    record: null,
    recordId: "",
    taskId: "",
    resultImage: "",
    sourceImage: "",
    ratio: "",
    scenes: ["头像", "朋友圈", "小红书", "社交展示"]
  },

  async onLoad(query) {
    const app = getApp();
    await app.ensureLogin();

    if (query.taskId) {
      try {
        const task = await api.getTask(query.taskId);
        const template = findTemplate(app.globalData.selectedTemplateId);
        this.setData({
          statusBarHeight: getStatusBarHeight(),
          menuButtonRightGap: getMenuButtonRightGap(),
          template,
          record: null,
          recordId: task.task_id,
          taskId: task.task_id,
          resultImage: task.result ? task.result.url : template.result,
          sourceImage: app.globalData.draftImage,
          ratio: ""
        });
        return;
      } catch (err) {
        console.warn("[task result fallback]", err);
      }

      const template = findTemplate(app.globalData.selectedTemplateId);
      this.setData({
        statusBarHeight: getStatusBarHeight(),
        menuButtonRightGap: getMenuButtonRightGap(),
        template,
        record: null,
        recordId: query.taskId,
        taskId: query.taskId,
        resultImage: template.result,
        sourceImage: app.globalData.draftImage,
        ratio: ""
      });
      return;
    }

    const record = app.getGeneratedRecord(query.recordId || query.id || app.globalData.currentRecordId);
    const template = record
      ? findTemplate(record.templateId || record.id)
      : findTemplate(query.id || app.globalData.selectedTemplateId);

    this.setData({
      statusBarHeight: getStatusBarHeight(),
      menuButtonRightGap: getMenuButtonRightGap(),
      template,
      record,
      recordId: record ? record.id : "",
      taskId: "",
      resultImage: record ? record.result : template.result,
      sourceImage: record ? record.sourceImage : app.globalData.draftImage,
      ratio: record ? record.ratio : ""
    });
  },

  previewResult() {
    if (!this.data.resultImage) {
      return;
    }

    wx.navigateTo({
      url: this.data.taskId
        ? `/pages/preview/index?taskId=${this.data.taskId}&templateId=${this.data.template.id || ""}`
        : `/pages/preview/index?recordId=${this.data.recordId || ""}&templateId=${this.data.template.id || ""}`
    });
  },

  saveResult() {
    if (this.data.taskId) {
      wx.showToast({
        title: "已进图库",
        icon: "success"
      });
      return;
    }

    if (!this.data.record) {
      // 该结果来自模板预览,无真实生成记录,不入图库
      wx.showToast({
        title: "该结果来自预览,请前往生成页制作",
        icon: "none"
      });
      return;
    }

    wx.showToast({
      title: "已进图库",
      icon: "success"
    });
  },

  downloadHd() {
    wx.showLoading({ title: "保存中" });
    saveImageToAlbum(this.data.resultImage).then(() => {
      wx.hideLoading();
      wx.showToast({ title: "已保存", icon: "success" });
    }).catch((err) => {
      wx.hideLoading();
      wx.showToast({ title: (err && err.message) || "保存失败", icon: "none" });
    });
  },

  restart() {
    // 使用 redirectTo 替换当前页,避免连续「再生成」时页面栈无限增长达到 10 层上限
    wx.redirectTo({
      url: `/pages/create/index?id=${this.data.template.id}`
    });
  },

  goGallery() {
    wx.navigateTo({
      url: "/pages/gallery/index"
    });
  },

  onShareAppMessage() {
    return {
      title: `我用即变做了「${this.data.template.name || "新玩法"}」`,
      path: this.data.taskId
        ? `/pages/result/index?taskId=${this.data.taskId}`
        : this.data.recordId
        ? `/pages/result/index?recordId=${this.data.recordId}`
        : "/pages/home/index"
    };
  }
});
