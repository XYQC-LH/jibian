const { getMenuButtonRightGap, getStatusBarHeight } = require("../../utils/system");
const api = require("../../services/api");

const packages = [
  { id: "starter", price: "¥5.99", amount: 60, label: "60 积分", badge: "" },
  { id: "basic", price: "¥19.90", amount: 210, label: "210 积分", badge: "" },
  { id: "value", price: "¥29.90", amount: 328, label: "328 积分", badge: "送25%" },
  { id: "plus", price: "¥49.90", amount: 560, label: "560 积分", badge: "" },
  { id: "pro", price: "¥99.00", amount: 1150, label: "1150 积分", badge: "" },
  { id: "max", price: "¥299.00", amount: 3588, label: "3588 积分", badge: "送35%" }
];

const PAYMENT_CONFIRM_ATTEMPTS = 8;
const PAYMENT_CONFIRM_INTERVAL_MS = 1500;

function findPackage(id, packageList = packages) {
  return packageList.find((item) => item.id === id) || packageList[0] || packages[2];
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForPaidOrder(outTradeNo) {
  let latest = null;

  for (let attempt = 0; attempt < PAYMENT_CONFIRM_ATTEMPTS; attempt += 1) {
    latest = await api.getWechatPaymentOrder(outTradeNo);

    if (latest.status === "paid") {
      return latest;
    }

    if (latest.status === "failed") {
      throw new Error(latest.failure_reason || "支付失败");
    }

    if (latest.status === "refunded" || latest.status === "refund_processing") {
      throw new Error("订单已进入退款流程");
    }

    if (attempt < PAYMENT_CONFIRM_ATTEMPTS - 1) {
      await sleep(PAYMENT_CONFIRM_INTERVAL_MS);
    }
  }

  return latest;
}

Page({
  data: {
    statusBarHeight: 0,
    menuButtonRightGap: 0,
    activePackage: "value",
    activePrice: packages[2].price,
    activeCredits: packages[2].amount,
    creditBalance: 0,
    paying: false,
    wechatPayEnabled: true,
    paymentUnavailableReason: "",
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

    api.listPaymentPackages().then((items) => {
      if (!Array.isArray(items) || !items.length) return;
      const remotePackages = items.map((item) => ({
        id: item.id,
        price: `¥${Number(item.amount_yuan || 0).toFixed(2)}`,
        amount: Number(item.credits || 0),
        label: item.label || `${item.credits || 0} 积分`,
        badge: item.badge || ""
      }));
      const current = remotePackages.find((item) => item.id === this.data.activePackage) || remotePackages[0];
      this.setData({
        packages: remotePackages,
        activePackage: current.id,
        activePrice: current.price,
        activeCredits: current.amount
      });
    }).catch((err) => {
      console.warn("[payment packages failed]", err);
    });

    api.getWechatPaymentStatus().then((status) => {
      if (!status || typeof status.enabled !== "boolean") return;
      this.setData({
        wechatPayEnabled: status.enabled,
        paymentUnavailableReason: status.enabled ? "" : (status.message || "微信支付暂未开放，请先使用兑换码获取积分。")
      });
    }).catch((err) => {
      console.warn("[payment status failed]", err);
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
    const current = findPackage(id, this.data.packages);

    this.setData({
      activePackage: current.id,
      activePrice: current.price,
      activeCredits: current.amount
    });
  },

  async confirmRecharge() {
    if (this.data.paying) return;

    const app = getApp();
    await app.ensureLogin();

    if (!this.data.wechatPayEnabled) {
      wx.showModal({
        title: "支付暂未开放",
        content: this.data.paymentUnavailableReason || "当前先通过兑换码获取积分，微信支付配置完成后自动开放。",
        confirmText: "去兑换",
        cancelText: "稍后再说",
        success: (res) => {
          if (res.confirm) {
            this.goRedeem();
          }
        }
      });
      return;
    }

    this.setData({ paying: true });

    try {
      const order = await api.createWechatPaymentOrder(this.data.activePackage);
      await new Promise((resolve, reject) => {
        wx.requestPayment({
          ...order.payment,
          success: resolve,
          fail: reject
        });
      });

      const latest = await waitForPaidOrder(order.out_trade_no);
      if (latest && latest.status === "paid") {
        if (latest.balance !== undefined) {
          app.setCredits(latest.balance);
        }
        this.setData({ creditBalance: app.globalData.credits });
        wx.showToast({ title: "积分已到账", icon: "success" });
        return;
      }

      wx.showModal({
        title: "支付确认中",
        content: "微信已返回支付结果，后端仍在确认到账。请稍后查看积分余额或积分明细。",
        showCancel: false,
        confirmText: "知道了"
      });
    } catch (err) {
      const message = err && err.message ? err.message : "支付失败";
      wx.showModal({
        title: message.includes("not enabled") || message.includes("未启用") ? "支付未开放" : "支付未完成",
        content: message.includes("not enabled")
          ? "当前先通过兑换码发放积分，微信支付配置完成后自动开放积分包。"
          : message,
        confirmText: message.includes("not enabled") ? "去兑换" : "知道了",
        showCancel: message.includes("not enabled"),
        success: (res) => {
          if (res.confirm && message.includes("not enabled")) {
            this.goRedeem();
          }
        }
      });
    } finally {
      this.setData({ paying: false });
    }
  }
});
