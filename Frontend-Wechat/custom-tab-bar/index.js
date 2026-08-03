const { getTabIndex, tabs } = require("../components/bottom-nav/tabs");

Component({
  data: {
    tabs,
    selected: 0
  },

  lifetimes: {
    attached() {
      this.updateSelected();
    }
  },

  pageLifetimes: {
    show() {
      this.updateSelected();
    }
  },

  methods: {
    updateSelected() {
      const pages = getCurrentPages();
      const current = pages[pages.length - 1];
      const route = current ? current.route : "";
      const index = getTabIndex(route);
      if (index >= 0 && index !== this.data.selected) {
        this.setData({ selected: index });
      }
    },

    handleTap(event) {
      const index = Number(event.currentTarget.dataset.index);
      if (index === this.data.selected) {
        return;
      }
      if (!tabs[index]) {
        return;
      }
      wx.switchTab({ url: tabs[index].url });
    }
  }
});
