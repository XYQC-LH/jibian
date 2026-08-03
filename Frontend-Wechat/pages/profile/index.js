const api = require("../../services/api");
const { syncTabBar } = require("../../components/bottom-nav/tabs");
const { getMenuButtonRightGap, getStatusBarHeight } = require("../../utils/system");

const DEFAULT_AVATAR = "/assets/design/close-up-face.webp";

function normalizeUser(me, app) {
  const fallbackUser = app.globalData.user || {};
  const user = me || fallbackUser;

  return {
    userName: user.nickname || fallbackUser.nickname || "即变用户",
    userAvatar: user.avatarUrl || fallbackUser.avatarUrl || DEFAULT_AVATAR,
    userIdText: `ID:${user.id || fallbackUser.id || app.globalData.accessToken || "123456789"}`
  };
}

Page({
  data: {
    statusBarHeight: 0,
    menuButtonRightGap: 0,
    creditBalance: 0,
    userName: "即变用户",
    userAvatar: DEFAULT_AVATAR,
    userIdText: "ID:123456789",
    quickActions: [
      { label: "收藏玩法", icon: "♡", target: "favorites" },
      { label: "邀请好友", icon: "礼", target: "invite" }
    ]
  },

  onLoad() {
    this.setData({
      statusBarHeight: getStatusBarHeight(),
      menuButtonRightGap: getMenuButtonRightGap()
    });
  },

  async onShow() {
    syncTabBar(this, "profile");
    const app = getApp();

    this.setData({
      creditBalance: app.globalData.credits,
      ...normalizeUser(null, app)
    });

    await app.ensureLogin();

    try {
      const balance = await api.getCreditBalance();

      app.setCredits(balance.balance);
      this.setData({ creditBalance: balance.balance });
    } catch (err) {
      console.warn("[credits failed]", err);
    }

    try {
      const me = await api.getMe();

      app.globalData.user = me;
      wx.setStorageSync("jibian_user", me);
      app.syncAccountFromUser(me);
      this.setData(normalizeUser(me, app));
    } catch (err) {
      console.warn("[me failed]", err);
    }
  },

  goSettings() {
    wx.navigateTo({
      url: "/pages/settings/index"
    });
  },

  recharge() {
    wx.navigateTo({
      url: "/pages/credits/index"
    });
  },

  openQuickAction(event) {
    const { target } = event.currentTarget.dataset;
    const routeMap = {
      favorites: "/pages/favorites/index",
      invite: "/pages/invite/index"
    };

    wx.navigateTo({
      url: routeMap[target] || "/pages/settings/index"
    });
  }
});
