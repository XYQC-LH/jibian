const { getStatusBarHeight } = require("../../utils/system");

Page({
  data: {
    statusBarHeight: 0,
    remindEnabled: true,
    groups: [
      {
        rows: [
          { title: "账号与安全", desc: "手机号、登录方式", value: "", type: "link" }
        ]
      },
      {
        rows: [
          { title: "通知提醒", desc: "作品变好后通知我", value: "", type: "switch" },
          { title: "隐私与授权", desc: "上传照片仅用于本次变图", value: "", type: "link" },
          { title: "清理缓存", desc: "释放本地预览和临时图片", value: "", type: "link" }
        ]
      },
      {
        rows: [
          { title: "服务条款", desc: "协议、隐私与照片使用说明", value: "", type: "link" },
          { title: "帮助与反馈", desc: "问题反馈、联系客服", value: "", type: "link" },
          { title: "关于即变", desc: "人物玩法变图工具", value: "", type: "link" }
        ]
      }
    ]
  },

  onLoad() {
    this.setData({
      statusBarHeight: getStatusBarHeight()
    });
  },

  goBack() {
    wx.navigateBack();
  },

  toggleRemind(event) {
    this.setData({
      remindEnabled: event.detail.value
    });
  },

  tapRow(event) {
    const { title, type } = event.currentTarget.dataset;

    if (type === "switch") {
      return;
    }

    if (title === "清理缓存") {
      getApp().clearDraftCache();
      wx.showToast({
        title: "已清理临时图片",
        icon: "success"
      });
      return;
    }

    wx.navigateTo({
      url: `/pages/settings-detail/index?title=${encodeURIComponent(title)}`
    });
  }
});
