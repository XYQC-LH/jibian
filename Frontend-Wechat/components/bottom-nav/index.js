const { tabs } = require("./tabs");

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
      const target = tabs.find((item) => item.key === key);

      if (key === this.properties.active) {
        return;
      }

      wx.switchTab({ url: target ? target.url : "/pages/gallery/index" });
    }
  }
});
