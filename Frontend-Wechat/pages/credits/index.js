const { getMenuButtonRightGap, getStatusBarHeight } = require("../../utils/system");
const api = require("../../services/api");

const packages = [
  { id: "starter", price: "¥5.99", amount: 60, label: "60 积分", badge: "" },
  { id: "basic", price: "¥19.9", amount: 210, label: "210 积分", badge: "" },
  { id: "value", price: "¥29.9", amount: 328, label: "328 积分", badge: "送25%" },
  { id: "plus", price: "¥49.9", amount: 560, label: "560 积分", badge: "" },
  { id: "pro", price: "¥99", amount: 1150, label: "1150 积分", badge: "" },
  { id: "max", price: "¥299", amount: 3588, label: "3588 积分", badge: "送35%" }
];

function findPackage(id) {
  return packages.find((item) => item.id === id) || packages[2];
}

Page({
  data: {
    statusBarHeight: 0,
    menuButtonRightGap: 0,
    activePackage: "value",
    activePrice: packages[2].price,
    creditBalance: 0,
    packages
  },

  onLoad() {
    this.setData({
      statusBarHeight: getStatusBarHeight(),
      menuButtonRightGap: getMenuButtonRightGap()
    });
  },

  async onShow() {
    const app = getApp();

    this.setData({
      creditBalance: app.globalData.credits
    });

    await app.ensureLogin();

    api.getCreditBalance().then((res) => {
      const creditBalance = app.setCredits(res.balance);

      this.setData({ creditBalance });
    }).catch((err) => {
      console.warn("[getCreditBalance failed]", err);
    });
  },

  goBack() {
    wx.navigateBack();
  },

  goMembership() {
    wx.redirectTo({
      url: "/pages/membership/index"
    });
  },

  goDetail() {
    wx.navigateTo({
      url: "/pages/credit-detail/index"
    });
  },

  goRedeem() {
    wx.navigateTo({
      url: "/pages/redeem-code/index"
    });
  },

  selectPackage(event) {
    const { id } = event.currentTarget.dataset;
    const current = findPackage(id);

    this.setData({
      activePackage: id,
      activePrice: current.price
    });
  },

  confirmRecharge() {
    const current = findPackage(this.data.activePackage);
    const credits = getApp().addCredits(current.amount);

    this.setData({
      creditBalance: credits
    });

    wx.showToast({
      title: `已到账 ${current.amount} 积分`,
      icon: "success"
    });
  }
});
