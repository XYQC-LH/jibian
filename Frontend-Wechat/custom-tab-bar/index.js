const tabs = [
  { key: "home", label: "首页", pagePath: "pages/home/index", url: "/pages/home/index" },
  { key: "inspiration", label: "灵感", pagePath: "pages/inspiration/index", url: "/pages/inspiration/index" },
  { key: "create", label: "即变", pagePath: "pages/create/index", url: "/pages/create/index" },
  { key: "gallery", label: "图库", pagePath: "pages/gallery/index", url: "/pages/gallery/index" },
  { key: "profile", label: "我的", pagePath: "pages/profile/index", url: "/pages/profile/index" }
];

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
      const index = tabs.findIndex((tab) => tab.pagePath === route);
      if (index >= 0 && index !== this.data.selected) {
        this.setData({ selected: index });
      }
    },

    handleTap(event) {
      const { index } = event.currentTarget.dataset;
      if (index === this.data.selected) {
        return;
      }
      wx.switchTab({ url: tabs[index].url });
    }
  }
});
