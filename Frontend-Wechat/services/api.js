const { request } = require("../utils/request");

function unwrapList(res) {
  if (Array.isArray(res)) {
    return res;
  }

  if (res && Array.isArray(res.data)) {
    return res.data;
  }

  return [];
}

function unwrapData(res) {
  return res && res.data && typeof res.data === "object" ? res.data : res;
}

function normalizeBalance(res) {
  const data = unwrapData(res) || {};
  const balance = Number(data.balance);

  return { balance: Number.isFinite(balance) ? balance : 0 };
}

function login() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(res) {
        request({
          url: "/auth/wechat-login",
          method: "POST",
          data: { code: res.code || `dev-${Date.now()}` }
        }).then(resolve).catch(reject);
      },
      fail: reject
    });
  });
}

function listTemplates() {
  return request({ url: "/templates" }).then(unwrapList);
}

function listFavorites() {
  return request({ url: "/favorites" }).then(unwrapList);
}

function addFavorite(templateId) {
  return request({
    url: `/favorites/${templateId}`,
    method: "POST"
  });
}

function removeFavorite(templateId) {
  return request({
    url: `/favorites/${templateId}`,
    method: "DELETE"
  });
}

function getMe() {
  return request({ url: "/users/me" }).then(unwrapData);
}

function getCreditLedger() {
  return request({ url: "/credits/ledger" });
}

function redeemCode(code) {
  return request({
    url: "/redeem-codes/redeem",
    method: "POST",
    data: { code }
  }).then(normalizeBalance);
}

function requestAccountDeletion() {
  return request({
    url: "/account/deletion-requests",
    method: "POST"
  });
}

function getUserCreation(id) {
  return request({ url: `/user-creations/${id}` });
}

function deleteUserCreation(id) {
  return request({
    url: `/user-creations/${id}`,
    method: "DELETE"
  });
}

function createUploadUrl(assetType) {
  return request({
    url: "/assets/upload-url",
    method: "POST",
    data: { asset_type: assetType }
  });
}

function readFileAsArrayBuffer(filePath) {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath,
      success(res) {
        resolve(res.data);
      },
      fail: reject
    });
  });
}

function uploadToPresignedUrl(uploadUrl, filePath) {
  return readFileAsArrayBuffer(filePath).then((buffer) => new Promise((resolve, reject) => {
    wx.request({
      url: uploadUrl,
      method: "PUT",
      data: buffer,
      header: {
        "content-type": "application/octet-stream"
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
          return;
        }

        reject(new Error("图片上传失败"));
      },
      fail: reject
    });
  }));
}

function uploadInputImage(filePath) {
  return createUploadUrl("input_image").then((upload) => {
    if (!upload || !upload.asset_id) {
      throw new Error("上传凭证无效");
    }

    if (!upload.upload_url || /^mock:\/\//.test(upload.upload_url)) {
      return {
        ...upload,
        file_path: filePath,
        uploaded: true
      };
    }

    return uploadToPresignedUrl(upload.upload_url, filePath)
      .then(() => ({ ...upload, file_path: filePath, uploaded: true }));
  });
}

function createTask(data) {
  return request({
    url: "/tasks",
    method: "POST",
    data
  });
}

function getTask(taskId) {
  return request({ url: `/tasks/${taskId}` });
}

function listUserCreations() {
  return request({ url: "/user-creations" });
}

function getCreditBalance() {
  return request({ url: "/credits/balance" }).then(normalizeBalance);
}

function bindPhone(phone) {
  return request({
    url: "/users/phone-bind",
    method: "POST",
    data: { phone }
  });
}

module.exports = {
  login,
  listTemplates,
  createUploadUrl,
  uploadInputImage,
  createTask,
  getTask,
  listUserCreations,
  getCreditBalance,
  redeemCode,
  bindPhone,
  listFavorites,
  addFavorite,
  removeFavorite,
  getMe,
  getCreditLedger,
  requestAccountDeletion,
  getUserCreation,
  deleteUserCreation
};
