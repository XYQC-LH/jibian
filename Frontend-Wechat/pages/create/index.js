const templateService = require("../../services/templateService");
const { syncTabBar } = require("../../components/bottom-nav/tabs");
const { getStatusBarHeight } = require("../../utils/system");
const api = require("../../services/api");

const DEFAULT_TEMPLATE_ID = "vintage-film";

const templateKeysByRemoteId = {
  "00000000-0000-4000-8000-000000000001": "pearl-portrait",
  "00000000-0000-4000-8000-000000000002": "street-boyfriend",
  "00000000-0000-4000-8000-000000000003": "gufeng-mood",
  "00000000-0000-4000-8000-000000000004": "private-photo",
  "00000000-0000-4000-8000-000000000005": "japanese-clean",
  "00000000-0000-4000-8000-000000000006": "vintage-film",
  "00000000-0000-4000-8000-000000000007": "dream-glow",
  "00000000-0000-4000-8000-000000000008": "cinematic-portrait",
  "00000000-0000-4000-8000-000000000009": "forest-avatar",
  "00000000-0000-4000-8000-000000000010": "city-night",
  "00000000-0000-4000-8000-000000000011": "light-shadow",
  "00000000-0000-4000-8000-000000000012": "dark-texture"
};

const templateLabels = {
  "pearl-portrait": "漫画",
  "street-boyfriend": "潮玩",
  "gufeng-mood": "古风",
  "private-photo": "写真",
  "japanese-clean": "日系",
  "vintage-film": "复古胶片",
  "dream-glow": "COS",
  "cinematic-portrait": "电影",
  "forest-avatar": "角色",
  "city-night": "夜景",
  "light-shadow": "光影",
  "dark-texture": "趣味"
};

const templateNameKeys = [
  { keyword: "珠光", key: "pearl-portrait" },
  { keyword: "街拍", key: "street-boyfriend" },
  { keyword: "古风", key: "gufeng-mood" },
  { keyword: "私房", key: "private-photo" },
  { keyword: "日系", key: "japanese-clean" },
  { keyword: "复古胶片", key: "vintage-film" },
  { keyword: "梦幻", key: "dream-glow" },
  { keyword: "电影", key: "cinematic-portrait" },
  { keyword: "森系", key: "forest-avatar" },
  { keyword: "夜景", key: "city-night" },
  { keyword: "光影", key: "light-shadow" },
  { keyword: "暗调", key: "dark-texture" }
];

const templateNavOrder = [
  "pearl-portrait",
  "vintage-film",
  "gufeng-mood",
  "street-boyfriend",
  "dream-glow",
  "dark-texture",
  "forest-avatar"
];

const displayNames = {
  "vintage-film": "复古胶片写真",
  "street-boyfriend": "街拍日常"
};

function getTemplateKey(templateOrId) {
  const id = typeof templateOrId === "string" ? templateOrId : templateOrId?.id;
  const name = typeof templateOrId === "object" ? String(templateOrId?.name || "") : "";
  const nameKey = templateNameKeys.find((item) => name.includes(item.keyword));

  if (nameKey) {
    return nameKey.key;
  }

  return templateKeysByRemoteId[id] || id;
}

function findTemplateByKey(key) {
  return templateService.getCurrentTemplates().find((template) => getTemplateKey(template) === key);
}

function findTemplateById(id) {
  return templateService.getCurrentTemplates().find((template) => template.id === id);
}

function resolveTemplate(id) {
  return findTemplateById(id);
}

function getDefaultTemplate() {
  return findTemplateByKey(DEFAULT_TEMPLATE_ID) || templateService.getCurrentTemplates()[0];
}

function getOrderedTemplates() {
  const allTemplates = templateService.getCurrentTemplates();
  const byId = allTemplates.reduce((acc, template) => {
    acc[getTemplateKey(template)] = template;
    return acc;
  }, {});
  const ordered = templateNavOrder.map((id) => byId[id]).filter(Boolean);
  const orderedIds = ordered.reduce((acc, template) => {
    acc[template.id] = true;
    return acc;
  }, {});

  return ordered.concat(allTemplates.filter((template) => !orderedIds[template.id]));
}

function toTemplateNavItems(activeId) {
  const allTemplates = getOrderedTemplates();
  const activeKey = getTemplateKey(activeId);
  const activeIndex = Math.max(allTemplates.findIndex((template) => getTemplateKey(template) === activeKey), 0);
  const startIndex = activeIndex > 0 ? activeIndex - 1 : 0;
  const orderedTemplates = allTemplates.slice(startIndex).concat(allTemplates.slice(0, startIndex));

  return orderedTemplates.map((template) => ({
    id: template.id,
    label: templateLabels[getTemplateKey(template)] || template.name
  }));
}

function getDisplayName(template) {
  return template ? (displayNames[getTemplateKey(template)] || template.name) : "";
}

function toApiRatio(ratio) {
  return ratio === "原图" ? "auto" : ratio;
}

function createIdempotencyKey() {
  return `generate-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

Page({
  data: {
    statusBarHeight: 0,
    template: getDefaultTemplate(),
    selectedTemplateId: getDefaultTemplate().id,
    templateReady: true,
    templateNavItems: toTemplateNavItems(getDefaultTemplate().id),
    templates: templateService.getCurrentTemplates(),
    previewTemplates: getOrderedTemplates(),
    currentIndex: 0,
    ratios: ["原图", "1:1", "3:4", "9:16", "4:3"],
    selectedRatio: "3:4",
    imagePath: "",
    previewImage: getDefaultTemplate().cover,
    previewTitle: getDisplayName(getDefaultTemplate()),
    generating: false,
    progress: 0,
    resultReady: false,
    resultImage: ""
  },

  progressTimer: null,
  pollTimer: null,
  pendingIdempotencyKey: "",
  syncingPreview: false,
  strictTemplateId: "",

  onLoad(query = {}) {
    const app = getApp();
    const explicitId = query.id || app.globalData.selectedTemplateId;
    const requestedId = explicitId || DEFAULT_TEMPLATE_ID;
    const template = explicitId ? resolveTemplate(requestedId) : getDefaultTemplate();
    const imagePath = app.globalData.draftImage || "";

    this.strictTemplateId = explicitId ? requestedId : "";
    if (explicitId) {
      app.globalData.selectedTemplateId = requestedId;
    }
    this.setData({
      statusBarHeight: getStatusBarHeight(),
      selectedTemplateId: requestedId,
      imagePath
    });

    if (template) {
      this.applyTemplate(template);
    } else {
      this.setPendingTemplate(requestedId, imagePath);
    }

    this.loadTemplates(requestedId);
  },

  onShow() {
    syncTabBar(this, "create");
    this.syncDraftFromGlobal();
  },

  loadTemplates(activeId) {
    templateService.loadTemplates().then(() => {
      const app = getApp();
      const requestedId = this.strictTemplateId
        || activeId
        || app.globalData.selectedTemplateId
        || this.data.selectedTemplateId
        || DEFAULT_TEMPLATE_ID;
      const template = this.strictTemplateId
        ? resolveTemplate(requestedId)
        : (resolveTemplate(requestedId) || findTemplateByKey(getTemplateKey(requestedId)) || getDefaultTemplate());

      if (template) {
        this.applyTemplate(template);
        this.syncDraftFromGlobal();
        return;
      }

      this.setPendingTemplate(requestedId, app.globalData.draftImage || this.data.imagePath, "模板不可用");
    });
  },

  syncDraftFromGlobal() {
    const app = getApp();
    const selectedId = app.globalData.selectedTemplateId;
    const imagePath = app.globalData.draftImage || "";
    const currentTemplate = this.data.template;
    const targetTemplate = selectedId ? resolveTemplate(selectedId) : currentTemplate;

    if (selectedId && selectedId !== this.data.selectedTemplateId) {
      this.strictTemplateId = selectedId;
    }

    if (selectedId && !targetTemplate) {
      this.pendingIdempotencyKey = "";
      this.setPendingTemplate(selectedId, imagePath);
      this.loadTemplates(selectedId);
      return;
    }

    if (targetTemplate && (!currentTemplate || targetTemplate.id !== currentTemplate.id)) {
      this.pendingIdempotencyKey = "";
      this.applyTemplate(targetTemplate);
    }

    if (imagePath !== this.data.imagePath) {
      this.pendingIdempotencyKey = "";
      this.setData({ imagePath });
    }
  },

  applyTemplate(template) {
    if (!template) {
      return false;
    }

    const previewTemplates = getOrderedTemplates();
    const currentIndex = Math.max(previewTemplates.findIndex((item) => item.id === template.id), 0);
    const app = getApp();

    this.strictTemplateId = "";
    app.globalData.selectedTemplateId = template.id;

    this.setData({
      template,
      selectedTemplateId: template.id,
      templateReady: true,
      templateNavItems: toTemplateNavItems(template.id),
      templates: templateService.getCurrentTemplates(),
      previewTemplates,
      currentIndex,
      previewImage: template.cover,
      previewTitle: getDisplayName(template)
    });

    return true;
  },

  setPendingTemplate(templateId, imagePath, title = "模板加载中") {
    const nextData = {
      template: null,
      selectedTemplateId: templateId,
      templateReady: false,
      templateNavItems: [],
      templates: templateService.getCurrentTemplates(),
      previewTemplates: [],
      currentIndex: 0,
      previewImage: "",
      previewTitle: title
    };

    if (typeof imagePath === "string") {
      nextData.imagePath = imagePath;
    }

    this.setData(nextData);
  },

  onPreviewChange(event) {
    if (this.data.generating || this.syncingPreview) {
      return;
    }

    const index = Number(event.detail.current);
    const previewTemplates = this.data.previewTemplates || [];
    const nextTemplate = previewTemplates[index];

    if (!nextTemplate) {
      return;
    }

    this.pendingIdempotencyKey = "";
    this.applyTemplate(nextTemplate);
  },

  onNavSelect(event) {
    const { id } = event.currentTarget.dataset;
    const previewTemplates = getOrderedTemplates();
    const index = previewTemplates.findIndex((item) => getTemplateKey(item) === getTemplateKey(id));

    if (index < 0) {
      const template = resolveTemplate(id);

      if (!template) {
        this.strictTemplateId = id;
        this.setPendingTemplate(id, this.data.imagePath);
        this.loadTemplates(id);
        return;
      }

      this.applyTemplate(template);
      return;
    }

    this.syncingPreview = true;
    this.setData({ currentIndex: index });
    this.syncingPreview = false;
    this.pendingIdempotencyKey = "";
    this.applyTemplate(previewTemplates[index]);
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
        this.pendingIdempotencyKey = "";
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
    this.pendingIdempotencyKey = "";
    this.setData({
      imagePath: ""
    });
  },

  generateAgain() {
    if (this.data.generating) {
      return;
    }

    this.setData({
      resultReady: false,
      resultImage: ""
    });
  },

  previewResult() {
    if (!this.data.resultImage) {
      return;
    }

    wx.previewImage({
      urls: [this.data.resultImage],
      current: this.data.resultImage
    });
  },

  downloadResult() {
    const url = this.data.resultImage;

    if (!url) {
      wx.showToast({ title: "暂无结果可下载", icon: "none" });
      return;
    }

    wx.showLoading({ title: "下载中..." });
    wx.downloadFile({
      url,
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode !== 200) {
          wx.showToast({ title: "下载失败", icon: "none" });
          return;
        }
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => {
            wx.showToast({ title: "已保存到相册", icon: "success" });
          },
          fail: (err) => {
            if (String(err && err.errMsg || "").includes("auth")) {
              wx.showModal({
                title: "需要相册权限",
                content: "请在设置中开启保存到相册的权限",
                showCancel: false
              });
              return;
            }
            wx.showToast({ title: "保存失败", icon: "none" });
          }
        });
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: "下载失败", icon: "none" });
      }
    });
  },

  selectTemplate(event) {
    if (this.data.generating) {
      return;
    }

    this.onNavSelect(event);
  },

  selectRatio(event) {
    if (this.data.generating) {
      return;
    }

    this.pendingIdempotencyKey = "";
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

    wx.switchTab({
      url: "/pages/inspiration/index"
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
    const selectedId = app.globalData.selectedTemplateId || this.data.selectedTemplateId;
    const template = this.data.template;

    if (!template || !this.data.templateReady || template.id !== selectedId) {
      wx.showToast({ title: "模板加载中，请稍后", icon: "none" });
      this.loadTemplates(selectedId);
      return;
    }

    await app.ensureLogin();

    if (app.globalData.credits < template.price) {
      wx.showModal({
        title: "积分不足",
        content: "当前积分不足，请先兑换积分或购买权益后再生成。",
        confirmText: "去获取",
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: "/pages/credits/index"
            });
          }
        }
      });
      return;
    }

    this.clearProgress();
    this.setData({
      generating: true,
      progress: 8,
      resultReady: false,
      resultImage: ""
    });

    try {
      this.pendingIdempotencyKey = this.pendingIdempotencyKey || createIdempotencyKey();
      const upload = await api.uploadInputImage(this.data.imagePath);
      const task = await api.createTask({
        template_id: template.id,
        input_asset_id: upload.asset_id,
        ratio: toApiRatio(this.data.selectedRatio),
        idempotency_key: this.pendingIdempotencyKey
      });
      this.pendingIdempotencyKey = "";
      app.globalData.currentTaskId = task.task_id;
      await this.refreshCreditsSilently(app);
      this.pollTask(task.task_id, task.poll_interval_ms || 2000);
    } catch (err) {
      console.error("[create task failed]", err);
      this.setData({ generating: false, progress: 0 });
      this.refreshCreditsSilently(app);
      wx.showToast({ title: err.message || "创建任务失败", icon: "none" });
    }
  },

  pollTask(taskId, interval) {
    this.clearPolling();
    const pollOnce = async () => {
      try {
        const task = await api.getTask(taskId);
        this.setData({ progress: task.progress || task.progress_percent || this.data.progress });

        if (task.status === "succeeded") {
          this.clearPolling();
          const resultUrl = task.result && task.result.url;

          this.setData({
            generating: false,
            progress: 100,
            resultImage: resultUrl || this.data.previewImage,
            resultReady: true
          });
          getApp().globalData.currentTaskId = taskId;
        }

        if (task.status === "failed") {
          this.clearPolling();
          this.setData({ generating: false });
          await this.refreshCreditsSilently(getApp());
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

  async refreshCreditsSilently(app) {
    try {
      const balance = await api.getCreditBalance();
      app.setCredits(balance.balance);
    } catch (err) {
      console.warn("[refresh credits failed]", err);
    }
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
    const template = this.data.template;
    const selectedId = this.data.selectedTemplateId;

    return {
      title: template ? `即变 - ${template.name}` : "即变 - 一张图,变出新玩法",
      path: selectedId ? `/pages/create/index?id=${selectedId}` : "/pages/create/index",
      imageUrl: this.data.previewImage
    };
  }
});
