const { getStatusBarHeight } = require("../../utils/system");
const api = require("../../services/api");

const ledgerTitles = {
  charge: "生成消耗",
  refund: "失败返还",
  redeem: "兑换码到账",
  recharge: "积分充值",
  adjustment: "系统调整"
};

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatAmount(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) {
    return "0";
  }
  return value > 0 ? `+${value}` : String(value);
}

function mapLedger(item) {
  const amount = Number(item.amount);
  const failed = !Number.isFinite(amount);

  return {
    title: ledgerTitles[item.type] || item.type || "积分变动",
    time: formatTime(item.created_at),
    amount: failed ? "0" : formatAmount(amount),
    status: failed ? "异常" : "成功",
    failed
  };
}

Page({
  data: {
    statusBarHeight: 0,
    totalCredits: 0,
    records: []
  },

  onLoad() {
    this.setData({
      statusBarHeight: getStatusBarHeight()
    });
  },

  async onShow() {
    const app = getApp();
    await app.ensureLogin();

    try {
      const [balance, ledger] = await Promise.all([
        api.getCreditBalance(),
        api.getCreditLedger()
      ]);
      const records = Array.isArray(ledger) ? ledger.map(mapLedger) : [];
      this.setData({
        totalCredits: app.setCredits(balance.balance),
        records
      });
    } catch (err) {
      wx.showToast({
        title: (err && err.message) || "积分明细加载失败",
        icon: "none"
      });
    }
  },

  goBack() {
    wx.navigateBack();
  }
});
