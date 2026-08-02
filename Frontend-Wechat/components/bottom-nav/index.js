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
        home: "/pages/home/index",
        inspiration: "/pages/inspiration/index",
        create: "/pages/create/index",
        gallery: "/pages/gallery/index",
        profile: "/pages/profile/index"
      };

      if (key === this.properties.active) {
        return;
      }

      wx.switchTab({ url: routeMap[key] || routeMap.gallery });
    }
  }
});
