const { getMenuButtonRightGap, getStatusBarHeight } = require("../../utils/system");
const api = require("../../services/api");

const fallbackPlans = [
  { id: "month", code: "month", name: "连续包月", price: "¥15", origin: "约0.50元/天", amountFen: 1500, periodDays: 30 },
  { id: "season", code: "season", name: "连续包季", price: "¥40", origin: "约0.44元/天", amountFen: 4000, periodDays: 90 },
  { id: "year", code: "year", name: "连续包年", price: "¥108", origin: "约0.30元/天", amountFen: 10800, periodDays: 365 }
];

function amountFenOf(plan) {
  const amountFen = Number(plan && (plan.amount_fen !== undefined ? plan.amount_fen : plan.amountFen));
  const amountYuan = Number(plan && plan.amount_yuan);

  if (Number.isFinite(amountFen) && amountFen > 0) {
    return Math.round(amountFen);
  }

  return Number.isFinite(amountYuan) && amountYuan > 0 ? Math.round(amountYuan * 100) : 0;
}

function formatPrice(amountFen) {
  const amountYuan = amountFen / 100;

  if (!Number.isFinite(amountYuan) || amountYuan <= 0) {
    return "¥--";
  }

  return amountYuan % 1 === 0 ? `¥${amountYuan.toFixed(0)}` : `¥${amountYuan.toFixed(2)}`;
}

function formatDaily(amountFen, periodDays) {
  if (!amountFen || !periodDays) {
    return "自动续费";
  }

  return `约${(amountFen / 100 / periodDays).toFixed(2)}元/天`;
}

function normalizePlan(plan) {
  const amountFen = amountFenOf(plan);
  const periodDays = Number(plan && (plan.period_days !== undefined ? plan.period_days : plan.periodDays)) || 0;
  const code = String((plan && plan.code) || (plan && plan.id) || "");
  const id = String((plan && plan.id) || code);

  return {
    id,
    code,
    name: (plan && plan.name) || "会员套餐",
    price: formatPrice(amountFen),
    origin: formatDaily(amountFen, periodDays),
    amountFen,
    periodDays
  };
}

function normalizePlans(items) {
  const source = Array.isArray(items) && items.length ? items : fallbackPlans;
  return source.map(normalizePlan);
}

function findPlan(id, planList) {
  const list = Array.isArray(planList) && planList.length ? planList : fallbackPlans;
  return list.find((item) => item.id === id || item.code === id) ||
    list.find((item) => item.code === "year") ||
    list[0];
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildStatusView(status, loading) {
  if (loading) {
    return {
      statusTitle: "正在同步会员状态",
      statusCopy: "正在读取会员有效期和自动续费状态。",
      statusTag: "同步中",
      statusTone: "muted",
      currentPeriodEndText: ""
    };
  }

  const membership = status || {};
  const currentPeriodEndText = formatDate(membership.current_period_end);

  if (membership.active && membership.cancel_at_period_end) {
    return {
      statusTitle: "已取消自动续费",
      statusCopy: currentPeriodEndText ? `会员状态保留至 ${currentPeriodEndText}。` : "会员状态保留至当前周期结束。",
      statusTag: "到期不续",
      statusTone: "warning",
      currentPeriodEndText
    };
  }

  if (membership.active) {
    return {
      statusTitle: "会员已开通",
      statusCopy: currentPeriodEndText ? `当前周期有效至 ${currentPeriodEndText}，到期前自动续费。` : "当前会员状态有效，到期前自动续费。",
      statusTag: "生效中",
      statusTone: "active",
      currentPeriodEndText
    };
  }

  if (["pending", "pending_payment"].includes(membership.status)) {
    return {
      statusTitle: "开通确认中",
      statusCopy: "签约或扣款结果确认中，返回页面后会自动刷新。",
      statusTag: "确认中",
      statusTone: "warning",
      currentPeriodEndText
    };
  }

  if (["expired", "failed", "canceled", "refunded"].includes(membership.status)) {
    return {
      statusTitle: "会员未生效",
      statusCopy: "可选择套餐重新开通自动续费会员。",
      statusTag: "未生效",
      statusTone: "muted",
      currentPeriodEndText
    };
  }

  return {
    statusTitle: "未开通会员",
    statusCopy: "选择套餐后将跳转微信完成连续订阅签约。",
    statusTag: "未开通",
    statusTone: "muted",
    currentPeriodEndText
  };
}

Page({
  data: {
    statusBarHeight: 0,
    menuButtonRightGap: 0,
    activePlan: "year",
    activePrice: "¥108",
    agreed: true,
    loadingPlans: false,
    loadingStatus: false,
    subscribing: false,
    canceling: false,
    subscriptionAvailable: true,
    unavailableReason: "",
    membership: { active: false, status: "none" },
    statusTitle: "正在同步会员状态",
    statusCopy: "正在读取会员有效期和自动续费状态。",
    statusTag: "同步中",
    statusTone: "muted",
    currentPeriodEndText: "",
    plans: fallbackPlans
  },

  onLoad() {
    this.setData({
      statusBarHeight: getStatusBarHeight(),
      menuButtonRightGap: getMenuButtonRightGap()
    });
  },

  onShow() {
    this.refreshMembership();
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
    const current = findPlan(id, this.data.plans);

    this.setData({
      activePlan: current.id,
      activePrice: current.price
    });
  },

  toggleAgreement() {
    this.setData({
      agreed: !this.data.agreed
    });
  },

  async refreshMembership() {
    await Promise.all([
      this.loadPlans(),
      this.loadStatus()
    ]);
  },

  async loadPlans() {
    this.setData({ loadingPlans: true });

    try {
      const remotePlans = await api.listMembershipPlans();
      const plans = normalizePlans(remotePlans);
      const current = findPlan(this.data.activePlan, plans);
      this.setData({
        plans,
        activePlan: current.id,
        activePrice: current.price
      });
    } catch (err) {
      console.warn("[membership plans failed]", err);
      const current = findPlan(this.data.activePlan, this.data.plans);
      this.setData({
        activePlan: current.id,
        activePrice: current.price
      });
    } finally {
      this.setData({ loadingPlans: false });
    }
  },

  async loadStatus() {
    this.setData({
      loadingStatus: true,
      ...buildStatusView(this.data.membership, true)
    });

    try {
      const token = await getApp().ensureLogin();
      if (!token) {
        throw new Error("登录失败");
      }

      const membership = await api.getMembershipStatus();
      const statusView = buildStatusView(membership, false);
      this.setData({
        membership,
        subscriptionAvailable: membership.subscription_available !== false,
        unavailableReason: membership.unavailable_reason || "",
        ...statusView
      });
    } catch (err) {
      console.warn("[membership status failed]", err);
      this.setData({
        membership: { active: false, status: "none" },
        subscriptionAvailable: false,
        unavailableReason: "会员状态暂时无法同步，请稍后再试。",
        ...buildStatusView({ active: false, status: "none" }, false)
      });
    } finally {
      this.setData({ loadingStatus: false });
    }
  },

  async subscribe() {
    if (this.data.subscribing || this.data.canceling) return;

    if (!this.data.agreed) {
      wx.showToast({
        title: "请先同意会员协议",
        icon: "none"
      });
      return;
    }

    if (this.data.membership.active) {
      wx.showToast({
        title: "会员已开通",
        icon: "none"
      });
      return;
    }

    if (!this.data.subscriptionAvailable) {
      wx.showModal({
        title: "会员暂未开放",
        content: this.data.unavailableReason || "当前会员订阅配置未完成，请稍后再试。",
        showCancel: false,
        confirmText: "知道了"
      });
      return;
    }

    const current = findPlan(this.data.activePlan, this.data.plans);
    if (!current) {
      wx.showToast({
        title: "请选择会员套餐",
        icon: "none"
      });
      return;
    }

    this.setData({ subscribing: true });

    try {
      const token = await getApp().ensureLogin();
      if (!token) {
        throw new Error("请先登录后再开通会员");
      }

      const result = await api.createMembershipPreSign(current.id || current.code);
      const miniProgram = result.mini_program || result.miniProgram || {};
      const appId = miniProgram.app_id || miniProgram.appId || miniProgram.appid;
      const path = miniProgram.path || "";
      const extraData = miniProgram.extra_data || miniProgram.extraData || {};

      if (!appId || !path || !extraData.pre_entrustweb_id) {
        throw new Error("签约参数缺失，请稍后再试");
      }

      await new Promise((resolve, reject) => {
        wx.navigateToMiniProgram({
          appId,
          path,
          extraData,
          success: resolve,
          fail: reject
        });
      });

      wx.showToast({
        title: "请在微信完成签约",
        icon: "none"
      });
    } catch (err) {
      const message = err && err.message ? err.message : "会员开通失败";
      wx.showModal({
        title: message.includes("未开放") || message.includes("not enabled") ? "会员暂未开放" : "会员开通未完成",
        content: message,
        showCancel: false,
        confirmText: "知道了"
      });
    } finally {
      this.setData({ subscribing: false });
    }
  },

  cancelAutoRenew() {
    if (this.data.canceling || !this.data.membership.active) return;

    wx.showModal({
      title: "取消自动续费",
      content: "取消后会员状态保留至当前有效期结束，到期不再自动续费。",
      confirmText: "确认取消",
      cancelText: "再想想",
      success: async (res) => {
        if (!res.confirm) return;

        this.setData({ canceling: true });
        try {
          const token = await getApp().ensureLogin();
          if (!token) {
            throw new Error("请先登录后再操作");
          }
          const membership = await api.cancelMembershipAutoRenew();
          this.setData({
            membership,
            ...buildStatusView(membership, false)
          });
          wx.showToast({
            title: "已取消自动续费",
            icon: "success"
          });
        } catch (err) {
          wx.showModal({
            title: "取消失败",
            content: err && err.message ? err.message : "请稍后再试",
            showCancel: false,
            confirmText: "知道了"
          });
        } finally {
          this.setData({ canceling: false });
        }
      }
    });
  }
});
