const API_BASE_URL_KEY = "jibian_api_base_url";

const defaultConfig = {
  apiBaseUrl: "https://api.jibian.art/api"
};

function getApiBaseUrl() {
  const remote = wx.getStorageSync(API_BASE_URL_KEY);

  if (typeof remote === "string" && remote) {
    return remote.replace(/\/$/, "");
  }

  return defaultConfig.apiBaseUrl.replace(/\/$/, "");
}

function fetchRemoteConfig() {
  return new Promise((resolve) => {
    wx.request({
      url: `${defaultConfig.apiBaseUrl.replace(/\/$/, "")}/config/client`,
      method: "GET",
      success(res) {
        const remoteUrl = res.data && res.data.api_base_url;

        if (typeof remoteUrl === "string" && remoteUrl) {
          wx.setStorageSync(API_BASE_URL_KEY, remoteUrl.replace(/\/$/, ""));
          resolve(remoteUrl);
          return;
        }

        resolve(defaultConfig.apiBaseUrl);
      },
      fail() {
        resolve(defaultConfig.apiBaseUrl);
      }
    });
  });
}

module.exports = {
  ...defaultConfig,
  getApiBaseUrl,
  fetchRemoteConfig
};
