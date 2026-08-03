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

function login(inviteCode) {
  return new Promise((resolve, reject) => {
    wx.login({
      success(res) {
        const data = { code: res.code || `dev-${Date.now()}` };
        if (inviteCode) {
          data.invite_code = inviteCode;
        }
        request({
          url: "/auth/wechat-login",
          method: "POST",
          data
        }).then(resolve).catch(reject);
      },
      fail: reject
    });
  });
}

function listTemplates() {
  return request({ url: "/templates" }).then(unwrapList);
}

function listCategories() {
  return request({ url: "/templates/categories" }).then(unwrapList);
}

function getHomeOperation() {
  return request({ url: "/operation/home" }).then(unwrapData);
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

function getMyInvite() {
  return request({ url: "/invites/me" }).then(unwrapData);
}

function bindInviteCode(inviteCode) {
  return request({
    url: "/invites/bind",
    method: "POST",
    data: { invite_code: inviteCode }
  }).then(unwrapData);
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

function inferImageContentType(filePath) {
  const cleanPath = String(filePath || "").split("?")[0].toLowerCase();
  if (cleanPath.endsWith(".jpg") || cleanPath.endsWith(".jpeg")) return "image/jpeg";
  if (cleanPath.endsWith(".png")) return "image/png";
  if (cleanPath.endsWith(".webp")) return "image/webp";
  if (cleanPath.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

function createUploadUrl(assetType, contentType) {
  return request({
    url: "/assets/upload-url",
    method: "POST",
    data: {
      asset_type: assetType,
      content_type: contentType
    }
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

function uploadToPresignedUrl(uploadUrl, filePath, contentType) {
  return readFileAsArrayBuffer(filePath).then((buffer) => new Promise((resolve, reject) => {
    wx.request({
      url: uploadUrl,
      method: "PUT",
      data: buffer,
      header: {
        "content-type": contentType
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
  const contentType = inferImageContentType(filePath);
  return createUploadUrl("input_image", contentType).then((upload) => {
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

    return uploadToPresignedUrl(upload.upload_url, filePath, contentType)
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

function listPaymentPackages() {
  return request({ url: "/payments/packages" }).then(unwrapList);
}

function getWechatPaymentStatus() {
  return request({ url: "/payments/wechat/status" }).then(unwrapData);
}

function createWechatPaymentOrder(packageId) {
  return request({
    url: "/payments/wechat/orders",
    method: "POST",
    data: { package_id: packageId }
  }).then(unwrapData);
}

function getWechatPaymentOrder(outTradeNo) {
  return request({ url: `/payments/wechat/orders/${outTradeNo}` }).then(unwrapData);
}

function listMembershipPlans() {
  return request({ url: "/memberships/plans" }).then(unwrapList);
}

function getMembershipStatus() {
  return request({ url: "/memberships/me" }).then(unwrapData);
}

function createMembershipPreSign(planId) {
  return request({
    url: "/memberships/wechat/contracts/pre-sign",
    method: "POST",
    data: { plan_id: planId }
  }).then(unwrapData);
}

function cancelMembershipAutoRenew() {
  return request({
    url: "/memberships/me/cancel",
    method: "POST"
  }).then(unwrapData);
}

function bindPhone(payload) {
  const data = typeof payload === "string" ? { phone: payload } : payload;
  return request({
    url: "/users/phone-bind",
    method: "POST",
    data
  });
}

module.exports = {
  login,
  listTemplates,
  listCategories,
  getHomeOperation,
  createUploadUrl,
  uploadInputImage,
  createTask,
  getTask,
  listUserCreations,
  getCreditBalance,
  listPaymentPackages,
  getWechatPaymentStatus,
  createWechatPaymentOrder,
  getWechatPaymentOrder,
  listMembershipPlans,
  getMembershipStatus,
  createMembershipPreSign,
  cancelMembershipAutoRenew,
  redeemCode,
  getMyInvite,
  bindInviteCode,
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
