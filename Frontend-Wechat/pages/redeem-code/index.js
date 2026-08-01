const { getStatusBarHeight } = require("../../utils/system");
const api = require("../../services/api");

function formatTime(time) {
  const date = new Date(time);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${month}.${day} ${hour}:${minute}`;
}

function decorateRecords(records) {
  return (Array.isArray(records) ? records : []).map((item) => ({
    ...item,
    timeText: formatTime(item.redeemedAt)
  }));
}

Page({
  data: {
    statusBarHeight: 0,
    code: "",
    creditBalance: 0,
    records: []
  },

  onLoad() {
    this.setData({
      statusBarHeight: getStatusBarHeight()
    });
  },

  async onShow() {
    const app = getApp();

    this.setData({
      creditBalance: app.globalData.credits,
      records: decorateRecords(app.globalData.redeemRecords)
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

  inputCode(event) {
    this.setData({
      code: event.detail.value.toUpperCase().trim()
    });
  },

  redeemCode() {
    const code = this.data.code;
    const app = getApp();

    if (!code) {
      wx.showToast({
        title: "请输入兑换码",
        icon: "none"
      });
      return;
    }

    if (app.globalData.redeemRecords.some((item) => item.code === code)) {
      wx.showToast({
        title: "兑换码已使用",
        icon: "none"
      });
      return;
    }

    const beforeCredits = app.globalData.credits;

    api.redeemCode(code).then((res) => {
      const balance = Number(res.balance);
      const amount = Math.max(balance - beforeCredits, 0);

      app.setCredits(balance);
      app.addRedeemRecord(code, amount);

      this.setData({
        code: "",
        creditBalance: balance,
        records: decorateRecords(app.globalData.redeemRecords)
      });

      wx.showToast({
        title: `已到账 ${amount} 积分`,
        icon: "success"
      });
    }).catch((err) => {
      console.warn("[redeem failed]", err);
      wx.showToast({
        title: err.message || "兑换失败",
        icon: "none"
      });
    });
  }
});
