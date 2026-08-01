const { getStatusBarHeight } = require("../../utils/system");
const api = require("../../services/api");

Page({
  data: {
    statusBarHeight: 0,
    step: "confirm",
    code: "",
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

  inputCode(event) {
    this.setData({
      code: event.detail.value
    });
  },

  sendCode() {
    wx.showToast({
      title: "验证码已发送",
      icon: "success"
    });
  },

  confirmDelete() {
    if (this.data.isPhoneBound && this.data.code.length < 4) {
      wx.showToast({
        title: "请输入验证码",
        icon: "none"
      });
      return;
    }

    wx.showLoading({
      title: "提交中"
    });

    api.requestAccountDeletion().then(() => {
      wx.hideLoading();
      wx.showToast({
        title: "注销申请已提交",
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
