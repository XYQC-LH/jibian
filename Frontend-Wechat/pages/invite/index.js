const { getStatusBarHeight } = require("../../utils/system");

Page({
  data: {
    statusBarHeight: 0,
    rewardCredits: 30,
    inviteCount: 0
  },

  onLoad() {
    this.setData({
      statusBarHeight: getStatusBarHeight()
    });
  },

  goBack() {
    wx.navigateBack();
  },

  copyInviteCode() {
    wx.setClipboardData({
      data: "JIBIAN2026",
      success: () => {
        wx.showToast({
          title: "邀请码已复制",
          icon: "success"
        });
      }
    });
  },

  onShareAppMessage() {
    return {
      title: "来即变，一张照片变出新玩法",
      path: "/pages/home/index"
    };
  }
});
