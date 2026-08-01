const { templates } = require("../../data/templates");

const tabs = [
  { key: "home", label: "首页" },
  { key: "inspiration", label: "灵感" },
  { key: "create", label: "即变" },
  { key: "gallery", label: "图库" },
  { key: "profile", label: "我的" }
];

Component({
  properties: {
    active: {
      type: String,
      value: "home"
    }
  },

  data: {
    tabs
  },

  methods: {
    handleTap(event) {
      const { key } = event.currentTarget.dataset;
      const routeMap = {
        inspiration: "/pages/inspiration/index",
        create: `/pages/create/index?id=${templates[0].id}`,
        gallery: "/pages/gallery/index",
        profile: "/pages/profile/index"
      };

      if (key === this.properties.active) {
        return;
      }

      if (key === "home") {
        wx.reLaunch({ url: "/pages/home/index" });
        return;
      }

      wx.reLaunch({ url: routeMap[key] || routeMap.gallery });
    }
  }
});
