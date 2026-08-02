const { getStatusBarHeight } = require("../../utils/system");

function buildAccountRows() {
  const account = getApp().globalData.account;

  return [
    {
      title: "手机号绑定",
      desc: account.phoneBound ? "已用于订单通知和账号找回" : "绑定后可用于订单通知和账号找回",
      value: account.phoneBound ? account.maskedPhone : "未绑定",
      target: "phone-bind"
    },
    { title: "注销账号", desc: "清除账号与本地作品记录", value: "", target: "account-delete" }
  ];
}

const detailMap = {
  "隐私与授权": {
    rows: [
      { title: "相册权限", desc: "允许从相册中选择照片", value: "已授权" },
      { title: "变图提示", desc: "仅用于本次人物玩法变图", value: "开启" }
    ]
  },
  "服务条款": {
    rows: [
      { title: "用户服务协议", desc: "查看即变小程序使用规则", value: "" },
      { title: "隐私政策", desc: "了解照片、订单和本地缓存说明", value: "" }
    ]
  },
  "帮助与反馈": {
    rows: [
      { title: "联系邮箱", desc: "用于效果问题、扣费异常、投诉举报和退款申请", value: "825175944@qq.com", target: "copy", copyText: "825175944@qq.com" },
      { title: "客服 QQ", desc: "请附上任务 ID、截图和问题说明", value: "825175944", target: "copy", copyText: "825175944" }
    ]
  },
  "关于即变": {
    rows: [
      { title: "产品定位", desc: "人物玩法变图工具", value: "体验版" },
      { title: "当前版本", desc: "微信小程序本地开发版本", value: "0.1.0" }
    ]
  }
};

function resolveDetail(title) {
  if (title === "账号与安全") {
    return {
      rows: buildAccountRows()
    };
  }

  return detailMap[title] || {
    rows: [
      { title, desc: "当前无需额外配置，如需处理请联系客服邮箱", value: "825175944@qq.com", target: "copy", copyText: "825175944@qq.com" }
    ]
  };
}

Page({
  data: {
    statusBarHeight: 0,
    title: "",
    rows: []
  },

  onLoad(query) {
    const title = decodeURIComponent(query.title || "设置详情");

    this.setData({
      statusBarHeight: getStatusBarHeight()
    });

    this.refreshDetail(title);
  },

  onShow() {
    if (this.data.title) {
      this.refreshDetail(this.data.title);
    }
  },

  refreshDetail(title) {
    const detail = resolveDetail(title);

    this.setData({
      title,
      rows: detail.rows
    });
  },

  goBack() {
    wx.navigateBack();
  },

  tapRow(event) {
    const { title, target } = event.currentTarget.dataset;
    const routeMap = {
      "phone-bind": "/pages/phone-bind/index",
      "account-delete": "/pages/account-delete/index"
    };

    if (routeMap[target]) {
      wx.navigateTo({
        url: routeMap[target]
      });
      return;
    }

    if (target === "copy") {
      const row = this.data.rows.find((item) => item.title === title);
      wx.setClipboardData({
        data: row && row.copyText ? row.copyText : row && row.value ? row.value : "",
        success: () => {
          wx.showToast({
            title: "已复制",
            icon: "success"
          });
        }
      });
      return;
    }

    wx.showToast({
      title: "请联系客服处理",
      icon: "none"
    });
  }
});
