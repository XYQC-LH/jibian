const { getApiBaseUrl } = require("../config/env");

function request(options) {
  const app = getApp();
  const token = app.globalData.accessToken || wx.getStorageSync("jibian_access_token");
  const url = /^https?:\/\//.test(options.url)
    ? options.url
    : `${getApiBaseUrl()}${options.url}`;

  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: options.method || "GET",
      data: options.data || {},
      header: {
        "content-type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.header || {})
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
          return;
        }
        if (res.statusCode === 401 || res.statusCode === 403) {
          app.globalData.accessToken = "";
          wx.removeStorageSync("jibian_access_token");
        }
        reject(new Error((res.data && (res.data.message || res.data.error)) || "请求失败"));
      },
      fail(err) {
        reject(err);
      }
    });
  });
}

module.exports = { request };
