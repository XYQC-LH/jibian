const CREDIT_KEY = "jibian_credits";
const RECORDS_KEY = "jibian_generated_records";
const FAVORITES_KEY = "jibian_favorite_template_ids";
const ACCOUNT_KEY = "jibian_account";
const REDEEM_RECORDS_KEY = "jibian_redeem_records";
const ACCESS_TOKEN_KEY = "jibian_access_token";
const USER_KEY = "jibian_user";

function normalizeCredits(value) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function normalizeRecords(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeIds(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function maskPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");

  if (digits.length < 7) {
    return "";
  }

  return `+86 ${digits.slice(0, 3)}****${digits.slice(-4)}`;
}

function normalizeAccount(value) {
  if (!value || typeof value !== "object") {
    return {
      phone: "",
      maskedPhone: "",
      phoneBound: false,
      deleteRequested: false
    };
  }

  const phone = typeof value.phone === "string" ? value.phone : "";

  return {
    phone,
    maskedPhone: typeof value.maskedPhone === "string" ? value.maskedPhone : maskPhone(phone),
    phoneBound: Boolean(value.phoneBound && phone),
    deleteRequested: Boolean(value.deleteRequested)
  };
}

function normalizeUser(value) {
  return value && typeof value === "object" ? value : null;
}

function accountFromUser(user, fallback) {
  const phone = typeof user?.phone === "string" ? user.phone : fallback.phone;
  const status = String(user?.status || "");

  return {
    phone,
    maskedPhone: maskPhone(phone),
    phoneBound: Boolean(user?.phoneBound || user?.phone_bound) && Boolean(phone),
    deleteRequested: status === "deleted" || Boolean(fallback.deleteRequested)
  };
}

App({
  globalData: {
    draftImage: "",
    selectedTemplateId: "",
    currentRecordId: "",
    credits: 0,
    generatedRecords: [],
    redeemRecords: [],
    favoriteTemplateIds: [],
    account: normalizeAccount(),
    accessToken: "",
    user: null,
    templatesLoaded: false,
    currentTaskId: ""
  },

  onLaunch() {
    this.globalData.credits = normalizeCredits(wx.getStorageSync(CREDIT_KEY));
    this.globalData.generatedRecords = normalizeRecords(wx.getStorageSync(RECORDS_KEY));
    this.globalData.redeemRecords = normalizeRecords(wx.getStorageSync(REDEEM_RECORDS_KEY));
    this.globalData.favoriteTemplateIds = normalizeIds(wx.getStorageSync(FAVORITES_KEY));
    this.globalData.account = normalizeAccount(wx.getStorageSync(ACCOUNT_KEY));
    this.globalData.accessToken = wx.getStorageSync(ACCESS_TOKEN_KEY) || "";
    this.globalData.user = normalizeUser(wx.getStorageSync(USER_KEY));
    require("./config/env").fetchRemoteConfig();
    this.ensureLogin(true);
    this.ensureTemplates();
  },

  ensureLogin(force = false) {
    if (!force && this.globalData.accessToken && !this.globalData.account.deleteRequested) {
      return Promise.resolve(this.globalData.accessToken);
    }

    const api = require("./services/api");
    return api.login().then((res) => {
      this.globalData.accessToken = res.access_token || "";
      this.globalData.user = normalizeUser(res.user);
      wx.setStorageSync(ACCESS_TOKEN_KEY, this.globalData.accessToken);
      wx.setStorageSync(USER_KEY, this.globalData.user);
      this.syncAccountFromUser(this.globalData.user);
      this.setCredits(res.credit_balance || 0);
      return res.access_token;
    }).catch((err) => {
      console.warn("[login failed]", err);
      return "";
    });
  },

  ensureTemplates() {
    const templateService = require("./services/templateService");

    return templateService.loadTemplates().then((templates) => {
      this.globalData.templatesLoaded = !templateService.isUsingFallback();
      return templates;
    });
  },

  onPageNotFound() {
    wx.reLaunch({ url: '/pages/home/index' });
  },

  onError(err) {
    console.error('[app error]', err);
  },

  onUnhandledRejection(res) {
    console.warn('[unhandled rejection]', res);
  },

  setCredits(value) {
    this.globalData.credits = normalizeCredits(value);
    wx.setStorageSync(CREDIT_KEY, this.globalData.credits);
    return this.globalData.credits;
  },

  addGeneratedRecord(template, options = {}) {
    const recordId = `work-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const record = {
      id: recordId,
      templateId: template.id,
      name: template.name,
      cover: template.cover,
      result: template.result,
      category: template.category,
      price: template.price,
      ratio: options.ratio || "",
      sourceImage: options.sourceImage || "",
      savedAt: Date.now()
    };

    const records = [
      record,
      ...this.globalData.generatedRecords
    ].slice(0, 12);

    this.globalData.currentRecordId = record.id;
    this.globalData.generatedRecords = records;
    wx.setStorageSync(RECORDS_KEY, records);
    return record;
  },

  getGeneratedRecord(id) {
    return this.globalData.generatedRecords.find((item) => (
      item.id === id || item.templateId === id
    )) || null;
  },

  removeGeneratedRecords(ids) {
    const idSet = new Set(Array.isArray(ids) ? ids : []);
    const records = this.globalData.generatedRecords.filter((item) => !idSet.has(item.id));

    this.globalData.generatedRecords = records;
    wx.setStorageSync(RECORDS_KEY, records);
    return records;
  },

  clearDraftCache() {
    this.globalData.draftImage = "";
  },

  setFavoriteTemplateIds(ids) {
    this.globalData.favoriteTemplateIds = normalizeIds(ids);
    wx.setStorageSync(FAVORITES_KEY, this.globalData.favoriteTemplateIds);
    return this.globalData.favoriteTemplateIds;
  },

  toggleFavoriteTemplate(id) {
    const favoriteIds = this.globalData.favoriteTemplateIds;
    const nextIds = favoriteIds.includes(id)
      ? favoriteIds.filter((item) => item !== id)
      : [id, ...favoriteIds];

    return this.setFavoriteTemplateIds(nextIds);
  },

  syncFavoriteTemplate(id, shouldFavorite, rollbackIds) {
    const api = require("./services/api");
    const beforeIds = Array.isArray(rollbackIds)
      ? normalizeIds(rollbackIds)
      : this.globalData.favoriteTemplateIds.slice();
    const isFavorite = beforeIds.includes(id);
    const nextIds = shouldFavorite
      ? (isFavorite ? beforeIds : [id, ...beforeIds])
      : beforeIds.filter((item) => item !== id);

    this.setFavoriteTemplateIds(nextIds);

    return this.ensureLogin().then(() => (
      shouldFavorite ? api.addFavorite(id) : api.removeFavorite(id)
    )).then(() => nextIds).catch((err) => {
      this.setFavoriteTemplateIds(beforeIds);
      throw err;
    });
  },

  setAccount(value) {
    this.globalData.account = normalizeAccount(value);
    wx.setStorageSync(ACCOUNT_KEY, this.globalData.account);
    return this.globalData.account;
  },

  syncAccountFromUser(user) {
    if (!user) {
      return this.globalData.account;
    }

    return this.setAccount(accountFromUser(user, this.globalData.account));
  },

  submitAccountDeletion() {
    this.globalData.accessToken = "";
    this.globalData.user = null;
    this.globalData.credits = 0;
    this.globalData.generatedRecords = [];
    this.globalData.redeemRecords = [];
    this.globalData.favoriteTemplateIds = [];
    this.globalData.currentRecordId = "";
    this.globalData.currentTaskId = "";
    this.globalData.draftImage = "";

    wx.removeStorageSync(ACCESS_TOKEN_KEY);
    wx.removeStorageSync(USER_KEY);
    wx.removeStorageSync(CREDIT_KEY);
    wx.removeStorageSync(RECORDS_KEY);
    wx.removeStorageSync(REDEEM_RECORDS_KEY);
    wx.removeStorageSync(FAVORITES_KEY);

    return this.setAccount({
      phone: "",
      maskedPhone: "",
      phoneBound: false,
      deleteRequested: true
    });
  },

  addRedeemRecord(code, amount) {
    const record = {
      id: `${code}-${Date.now()}`,
      code,
      amount,
      redeemedAt: Date.now()
    };
    const records = [record, ...this.globalData.redeemRecords].slice(0, 12);

    this.globalData.redeemRecords = records;
    wx.setStorageSync(REDEEM_RECORDS_KEY, records);
    return record;
  }
});
