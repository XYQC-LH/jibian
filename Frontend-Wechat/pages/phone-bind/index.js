const { getStatusBarHeight } = require("../../utils/system");
const api = require("../../services/api");

Page({
  data: {
    statusBarHeight: 0,
    phone: "",
    code: "",
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
      maskedPhone: account.maskedPhone,
      phone: account.phoneBound ? account.phone : this.data.phone
    });
  },

  goBack() {
    wx.navigateBack();
  },

  inputPhone(event) {
    this.setData({
      phone: event.detail.value
    });
  },

  inputCode(event) {
    this.setData({
      code: event.detail.value
    });
  },

  sendCode() {
    if (!/^1\d{10}$/.test(this.data.phone)) {
      wx.showToast({
        title: "请输入正确手机号",
        icon: "none"
      });
      return;
    }

    wx.showToast({
      title: "验证码已发送",
      icon: "success"
    });
  },

  bindPhone() {
    if (!/^1\d{10}$/.test(this.data.phone) || this.data.code.length < 4) {
      wx.showToast({
        title: "请填写手机号和验证码",
        icon: "none"
      });
      return;
    }

    const app = getApp();

    api.bindPhone(this.data.phone).then((res) => {
      const account = app.setAccount({
        phone: res.phone || this.data.phone,
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
