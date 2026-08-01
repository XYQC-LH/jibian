const api = require("./api");
const templateStore = require("../data/templates");

let usingFallback = false;

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeRemoteTemplate(item, fallback) {
  return {
    id: item.id,
    name: item.name || fallback.name,
    category: item.category || fallback.category || "热门",
    uses: fallback.uses || "新上线",
    price: isFiniteNumber(item.price_credits) ? item.price_credits : fallback.price,
    cover: item.cover_url || fallback.cover,
    result: item.cover_url || fallback.result || fallback.cover,
    description: item.description || fallback.description || "上传照片生成专属效果。",
    cover_asset_id: item.cover_asset_id || "",
    result_count: isFiniteNumber(item.result_count) ? item.result_count : 1,
    sort_order: isFiniteNumber(item.sort_order) ? item.sort_order : 0,
    status: item.status || "published"
  };
}

function applyRemoteTemplates(items) {
  if (!Array.isArray(items) || !items.length) {
    throw new Error("模板列表为空");
  }

  const fallbackById = templateStore.fallbackTemplates.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});

  const templates = items.map((item, index) => {
    const fallback = fallbackById[item.id]
      || templateStore.fallbackTemplates[index % templateStore.fallbackTemplates.length]
      || templateStore.fallbackTemplates[0];

    return normalizeRemoteTemplate(item || {}, fallback);
  });

  usingFallback = false;
  templateStore.setRemoteTemplates(templates);
  return templateStore.templates;
}

function useFallbackTemplates(err) {
  console.warn("[templates fallback]", err);
  usingFallback = true;
  templateStore.resetTemplates();
  return templateStore.templates;
}

function loadTemplates() {
  return api.listTemplates()
    .then(applyRemoteTemplates)
    .catch(useFallbackTemplates);
}

function getCurrentTemplates() {
  return templateStore.templates;
}

function isUsingFallback() {
  return usingFallback;
}

function findTemplate(id) {
  return templateStore.findTemplate(id);
}

function filterTemplates(category) {
  return templateStore.filterTemplates(category);
}

function getHomeSections(category) {
  return templateStore.getHomeSections(category);
}

function getCategories() {
  return templateStore.categories;
}

function getCategoryIcons() {
  return templateStore.categoryIcons;
}

function getFavoriteId(item) {
  return (item && item.template_id) || (item && item.template && item.template.id) || "";
}

function mapFavoriteTemplate(item) {
  const remote = (item && item.template) || {};
  const templateId = remote.id || getFavoriteId(item);
  const fallback = findTemplate(templateId);

  return normalizeRemoteTemplate(remote.id ? remote : { ...remote, id: templateId }, fallback);
}

function refreshFavoriteTemplateIds() {
  return api.listFavorites().then((items) => {
    const favoriteIds = (Array.isArray(items) ? items : [])
      .map(getFavoriteId)
      .filter(Boolean);

    getApp().setFavoriteTemplateIds(favoriteIds);
    return favoriteIds;
  }).catch((err) => {
    console.warn("[favorites fallback]", err);
    return getApp().globalData.favoriteTemplateIds;
  });
}

function listFavoriteTemplates() {
  return api.listFavorites().then((items) => {
    const list = Array.isArray(items) ? items : [];
    const favoriteIds = list.map(getFavoriteId).filter(Boolean);

    getApp().setFavoriteTemplateIds(favoriteIds);
    return list.map(mapFavoriteTemplate);
  });
}

module.exports = {
  loadTemplates,
  getCurrentTemplates,
  isUsingFallback,
  findTemplate,
  filterTemplates,
  getHomeSections,
  getCategories,
  getCategoryIcons,
  refreshFavoriteTemplateIds,
  listFavoriteTemplates,
  mapFavoriteTemplate
};
