const { getStatusBarHeight } = require("../../utils/system");
const api = require("../../services/api");

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

Page({
  data: {
    statusBarHeight: 0,
    rewardCredits: 30,
    inviteCode: "",
    inviteCount: 0,
    rewardedCount: 0,
    pendingCount: 0,
    creditsEarned: 0,
    canBindInviter: false,
    bindCode: "",
    loading: true,
    binding: false
  },

  onLoad() {
    this.setData({
      statusBarHeight: getStatusBarHeight()
    });
  },

  onShow() {
    this.loadInviteStats();
  },

  goBack() {
    wx.navigateBack();
  },

  async loadInviteStats() {
    const app = getApp();
    this.setData({ loading: true });

    try {
      await app.ensureLogin();
      const stats = await api.getMyInvite();
      this.setData({
        rewardCredits: numberValue(stats.reward_credits) || 30,
        inviteCode: stats.invite_code || "",
        inviteCount: numberValue(stats.invite_count),
        rewardedCount: numberValue(stats.rewarded_count),
        pendingCount: numberValue(stats.pending_count),
        creditsEarned: numberValue(stats.credits_earned),
        canBindInviter: Boolean(stats.can_bind_inviter),
        loading: false
      });
    } catch (err) {
      console.warn("[invite stats failed]", err);
      this.setData({ loading: false });
      wx.showToast({
        title: err.message || "邀请信息加载失败",
        icon: "none"
      });
    }
  },

  copyInviteCode() {
    if (!this.data.inviteCode) {
      wx.showToast({
        title: "邀请码生成中",
        icon: "none"
      });
      return;
    }

    wx.setClipboardData({
      data: this.data.inviteCode,
      success: () => {
        wx.showToast({
          title: "邀请码已复制",
          icon: "success"
        });
      }
    });
  },

  inputBindCode(event) {
    this.setData({
      bindCode: String(event.detail.value || "").trim().toUpperCase()
    });
  },

  async bindInviteCode() {
    const bindCode = this.data.bindCode;
    if (!bindCode) {
      wx.showToast({
        title: "请输入好友邀请码",
        icon: "none"
      });
      return;
    }

    this.setData({ binding: true });
    try {
      await getApp().ensureLogin();
      const result = await api.bindInviteCode(bindCode);
      if (result.status === "bound") {
        wx.showToast({
          title: "绑定成功",
          icon: "success"
        });
        this.setData({ bindCode: "" });
        this.loadInviteStats();
        return;
      }

      wx.showToast({
        title: result.status === "invalid" ? "邀请码无效" : "暂不能绑定邀请",
        icon: "none"
      });
    } catch (err) {
      console.warn("[bind invite failed]", err);
      wx.showToast({
        title: err.message || "绑定失败",
        icon: "none"
      });
    } finally {
      this.setData({ binding: false });
    }
  },

  onShareAppMessage() {
    const query = this.data.inviteCode ? `?invite_code=${encodeURIComponent(this.data.inviteCode)}` : "";
    return {
      title: "来即变，一张照片变出新玩法",
      path: `/pages/home/index${query}`
    };
  },

  onShareTimeline() {
    return {
      title: "即变 - 一张图,变出新玩法",
      query: this.data.inviteCode ? `invite_code=${encodeURIComponent(this.data.inviteCode)}` : ""
    };
  }
});
