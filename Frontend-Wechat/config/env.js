const config = {
  apiBaseUrl: "https://api.jibian.art/api"
};

function getApiBaseUrl() {
  return config.apiBaseUrl.replace(/\/$/, "");
}

module.exports = {
  ...config,
  getApiBaseUrl
};
