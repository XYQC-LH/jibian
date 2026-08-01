const templateService = require("../../services/templateService");
const { getStatusBarHeight } = require("../../utils/system");
const api = require("../../services/api");

const templateLabels = {
  "pearl-portrait": "珠光",
  "street-boyfriend": "街拍",
  "gufeng-mood": "古风",
  "private-photo": "写真",
  "japanese-clean": "日系",
  "vintage-film": "复古胶片",
  "dream-glow": "梦幻",
  "cinematic-portrait": "电影",
  "forest-avatar": "森系",
  "city-night": "夜景",
  "light-shadow": "光影",
  "dark-texture": "暗调"
};

function toTemplateNavItems(activeId) {
  const allTemplates = templateService.getCurrentTemplates();
  const activeIndex = Math.max(allTemplates.findIndex((template) => template.id === activeId), 0);
  const startIndex = activeIndex > 0 ? activeIndex - 1 : 0;
  const orderedTemplates = allTemplates.slice(startIndex).concat(allTemplates.slice(0, startIndex));

  return orderedTemplates.map((template) => ({
    id: template.id,
    label: templateLabels[template.id] || template.name
  }));
}

Page({
  data: {
    statusBarHeight: 0,
    template: templateService.getCurrentTemplates()[0],
    templateNavItems: toTemplateNavItems(templateService.getCurrentTemplates()[0].id),
    templates: templateService.getCurrentTemplates(),
    ratios: ["原图", "1:1", "3:4", "9:16", "4:3"],
    selectedRatio: "3:4",
    imagePath: "",
    previewImage: templateService.getCurrentTemplates()[0].cover,
    generating: false,
    progress: 0
  },

  progressTimer: null,
  pollTimer: null,

  onLoad(query) {
    const template = templateService.findTemplate(query.id);
    const imagePath = getApp().globalData.draftImage;

    getApp().globalData.selectedTemplateId = template.id;
    this.setData({
      statusBarHeight: getStatusBarHeight(),
      template,
      templateNavItems: toTemplateNavItems(template.id),
      imagePath,
      previewImage: template.cover
    });
    this.loadTemplates(query.id);
  },

  loadTemplates(activeId) {
    templateService.loadTemplates().then(() => {
      this.applyTemplate(templateService.findTemplate(activeId));
    });
  },

  applyTemplate(template) {
    getApp().globalData.selectedTemplateId = template.id;
    this.setData({
      template,
      templateNavItems: toTemplateNavItems(template.id),
      templates: templateService.getCurrentTemplates(),
      previewImage: template.cover
    });
  },

  onUnload() {
    this.clearProgress();
    this.clearPolling();
  },

  chooseImage() {
    if (this.data.generating) {
      return;
    }

    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success: (res) => {
        const imagePath = res.tempFiles[0].tempFilePath;
        getApp().globalData.draftImage = imagePath;
        this.setData({
          imagePath
        });
      },
      fail() {}
    });
  },

  removeImage() {
    if (this.data.generating) {
      return;
    }

    getApp().globalData.draftImage = "";
    this.setData({
      imagePath: ""
    });
  },

  selectTemplate(event) {
    if (this.data.generating) {
      return;
    }

    const { id } = event.currentTarget.dataset;
    this.applyTemplate(templateService.findTemplate(id));
  },

  selectRatio(event) {
    if (this.data.generating) {
      return;
    }

    this.setData({
      selectedRatio: event.currentTarget.dataset.ratio
    });
  },

  goBack() {
    wx.navigateBack({
      fail: () => {
        wx.redirectTo({
          url: "/pages/home/index"
        });
      }
    });
  },

  openTemplatePicker() {
    if (this.data.generating) {
      return;
    }

    wx.navigateTo({
      url: "/pages/templates/index"
    });
  },

  async startGenerate() {
    if (this.data.generating) {
      return;
    }

    if (!this.data.imagePath) {
      this.chooseImage();
      return;
    }

    const app = getApp();
    await app.ensureLogin();

    if (app.globalData.credits < this.data.template.price) {
      wx.showModal({
        title: "积分不足",
        content: "本地测试将赠送 30 积分，确认后继续开变。",
        confirmText: "领取积分",
        success: (res) => {
          if (res.confirm) {
            app.addCredits(30);
            wx.showToast({
              title: "已到账 30 积分",
              icon: "success"
            });
            this.startGenerate();
          }
        }
      });
      return;
    }

    this.clearProgress();
    this.setData({
      generating: true,
      progress: 8
    });

    try {
      const upload = await api.uploadInputImage(this.data.imagePath);
      const task = await api.createTask({
        template_id: this.data.template.id,
        input_asset_id: upload.asset_id
      });
      app.globalData.currentTaskId = task.task_id;
      this.pollTask(task.task_id, task.poll_interval_ms || 2000);
    } catch (err) {
      console.error("[create task failed]", err);
      this.fallbackGenerate(app);
    }
  },

  fallbackGenerate(app) {
    const price = this.data.template.price || 0;

    if (price > 0 && !app.spendCredits(price)) {
      this.setData({ generating: false, progress: 0 });
      wx.showToast({ title: "积分不足", icon: "none" });
      return;
    }

    const record = app.addGeneratedRecord(this.data.template, {
      ratio: this.data.selectedRatio,
      sourceImage: this.data.imagePath
    });

    this.setData({ progress: 100 });
    setTimeout(() => {
      this.setData({ generating: false });
      wx.navigateTo({ url: `/pages/result/index?recordId=${record.id}` });
    }, 500);
  },

  pollTask(taskId, interval) {
    this.clearPolling();
    const pollOnce = async () => {
      try {
        const task = await api.getTask(taskId);
        this.setData({ progress: task.progress || task.progress_percent || this.data.progress });

        if (task.status === "succeeded") {
          this.clearPolling();
          this.setData({ generating: false, progress: 100 });
          wx.navigateTo({ url: `/pages/result/index?taskId=${taskId}` });
        }

        if (task.status === "failed") {
          this.clearPolling();
          this.setData({ generating: false });
          wx.showToast({ title: task.error_message || task.error || "生成失败", icon: "none" });
        }
      } catch (err) {
        this.clearPolling();
        this.setData({ generating: false });
        wx.showToast({ title: err.message || "查询失败", icon: "none" });
      }
    };

    pollOnce();
    this.pollTimer = setInterval(pollOnce, interval);
  },

  clearPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  },

  clearProgress() {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  },

  onShareAppMessage() {
    return {
      title: `即变 - ${this.data.template.name}`,
      path: `/pages/create/index?id=${this.data.template.id}`,
      imageUrl: this.data.previewImage
    };
  }
});
