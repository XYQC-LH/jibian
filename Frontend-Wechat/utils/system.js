function getStatusBarHeight() {
  try {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();

    return info.statusBarHeight || 0;
  } catch (error) {
    return 0;
  }
}

function getMenuButtonRightGap() {
  try {
    if (!wx.getMenuButtonBoundingClientRect) {
      return 0;
    }

    const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const menuButton = wx.getMenuButtonBoundingClientRect();

    return Math.max(0, windowInfo.windowWidth - menuButton.left + 8);
  } catch (error) {
    return 0;
  }
}

module.exports = {
  getStatusBarHeight,
  getMenuButtonRightGap
};
