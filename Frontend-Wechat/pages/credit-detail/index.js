const { getStatusBarHeight } = require("../../utils/system");

Page({
  data: {
    statusBarHeight: 0,
    totalCredits: 498,
    records: [
      { title: "充值 328 积分", time: "2026.07.29 23:41", amount: "+328", status: "成功", failed: false },
      { title: "充值 110 积分", time: "2026.07.28 20:16", amount: "+110", status: "成功", failed: false },
      { title: "充值 60 积分", time: "2026.07.27 12:08", amount: "+60", status: "成功", failed: false },
      { title: "充值 50 积分", time: "2026.07.27 10:24", amount: "+0", status: "失败", failed: true }
    ]
  },

  onLoad() {
    this.setData({
      statusBarHeight: getStatusBarHeight()
    });
  },

  goBack() {
    wx.navigateBack();
  }
});
