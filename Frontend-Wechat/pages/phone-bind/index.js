const { getStatusBarHeight } = require("../../utils/system");
const api = require("../../services/api");

Page({
  data: {
    statusBarHeight: 0,
    bound: false,
    maskedPhone: ""
  },

  onLoad() {
    this.setData({
      statusBarHeight: getStatusBarHeight()
    });
  },

  onShow() {
    const account = getApp().globalData.account;

    this.setData({
      bound: account.phoneBound,
      maskedPhone: account.maskedPhone
    });
  },

  goBack() {
    wx.navigateBack();
  },

  bindWechatPhone(event) {
    const code = event.detail && event.detail.code;
    if (!code) {
      wx.showToast({
        title: "未授权手机号",
        icon: "none"
      });
      return;
    }

    const app = getApp();

    api.bindPhone({ code }).then((res) => {
      const account = app.setAccount({
        phone: res.phone || "",
        phoneBound: true
      });

      this.setData({
        bound: true,
        maskedPhone: account.maskedPhone
      });

      wx.showToast({
        title: "绑定成功",
        icon: "success"
      });

      setTimeout(() => {
        wx.navigateBack();
      }, 800);
    }).catch((err) => {
      console.warn("[phone bind failed]", err);
      wx.showToast({
        title: err.message || "绑定失败",
        icon: "none"
      });
    });
  },

  finish() {
    wx.navigateBack();
  }
});
