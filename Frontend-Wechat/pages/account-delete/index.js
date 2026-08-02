const { getStatusBarHeight } = require("../../utils/system");
const api = require("../../services/api");

Page({
  data: {
    statusBarHeight: 0,
    step: "confirm",
    isPhoneBound: false,
    maskedPhone: ""
  },

  onLoad() {
    this.setData({
      statusBarHeight: getStatusBarHeight()
    });
  },

  onShow() {
    this.syncAccount();
  },

  syncAccount() {
    const account = getApp().globalData.account;

    this.setData({
      isPhoneBound: account.phoneBound,
      maskedPhone: account.maskedPhone
    });
  },

  goBack() {
    wx.navigateBack();
  },

  goVerify() {
    this.setData({
      step: this.data.isPhoneBound ? "verify" : "unbound"
    });
  },

  cancelDelete() {
    wx.navigateBack();
  },

  confirmDelete() {
    wx.showLoading({
      title: "注销中"
    });

    api.requestAccountDeletion().then(() => {
      getApp().submitAccountDeletion();
      wx.hideLoading();
      wx.showToast({
        title: "账号已注销",
        icon: "success"
      });
      this.setData({
        step: "success"
      });
    }).catch((err) => {
      wx.hideLoading();
      wx.showToast({
        title: (err && err.message) || "提交失败，请稍后重试",
        icon: "none"
      });
    });
  },

  finish() {
    wx.reLaunch({
      url: "/pages/home/index"
    });
  }
});
