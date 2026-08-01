const { getMenuButtonRightGap, getStatusBarHeight } = require("../../utils/system");

const plans = [
  { id: "month", name: "连续包月", price: "¥15", origin: "约0.5元/天" },
  { id: "year", name: "连续包年", price: "¥108", origin: "低至 ¥0.27/天" },
  { id: "season", name: "连续包季", price: "¥40", origin: "约0.44元/天" }
];

Page({
  data: {
    statusBarHeight: 0,
    menuButtonRightGap: 0,
    activePlan: "year",
    agreed: true,
    plans
  },

  onLoad() {
    this.setData({
      statusBarHeight: getStatusBarHeight(),
      menuButtonRightGap: getMenuButtonRightGap()
    });
  },

  goBack() {
    wx.navigateBack();
  },

  goCredits() {
    wx.redirectTo({
      url: "/pages/credits/index"
    });
  },

  selectPlan(event) {
    const { id } = event.currentTarget.dataset;

    this.setData({
      activePlan: id
    });
  },

  toggleAgreement() {
    this.setData({
      agreed: !this.data.agreed
    });
  },

  subscribe() {
    if (!this.data.agreed) {
      wx.showToast({
        title: "请先同意会员协议",
        icon: "none"
      });
      return;
    }

    wx.showToast({
      title: "订阅后续接支付",
      icon: "none"
    });
  }
});
