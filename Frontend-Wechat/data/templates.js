const fallbackTemplates = [
  {
    id: "pearl-portrait",
    name: "清透珠光写真",
    category: "写真",
    uses: "3.8w",
    price: 6,
    cover: "/assets/design/close-up-face.webp",
    result: "/assets/design/close-up-face.webp",
    description: "把普通自拍变成清透、有珠光质感的人像写真。"
  },
  {
    id: "street-boyfriend",
    name: "男友感街拍",
    category: "风格",
    uses: "2.6w",
    price: 5,
    cover: "/assets/design/street-casual-girl.webp",
    result: "/assets/design/street-casual-girl.webp",
    description: "换成自然街拍氛围，适合朋友圈和小红书封面。"
  },
  {
    id: "gufeng-mood",
    name: "古风氛围照",
    category: "角色",
    uses: "4.1w",
    price: 6,
    cover: "/assets/design/gufeng-warrior.webp",
    result: "/assets/design/gufeng-warrior.webp",
    description: "一张照片变成带故事感的古风人物照。"
  },
  {
    id: "private-photo",
    name: "私房写真",
    category: "写真",
    uses: "1.9w",
    price: 6,
    cover: "/assets/design/jimeng-feed-10.webp",
    result: "/assets/design/jimeng-feed-10.webp",
    description: "偏柔和、私密、氛围感强的人像写真效果。"
  },
  {
    id: "japanese-clean",
    name: "日系清新",
    category: "风格",
    uses: "2.3w",
    price: 5,
    cover: "/assets/design/jimeng-feed-4.webp",
    result: "/assets/design/jimeng-feed-4.webp",
    description: "让自拍呈现更轻盈、干净的日系生活感。"
  },
  {
    id: "vintage-film",
    name: "复古胶片",
    category: "风格",
    uses: "1.7w",
    price: 4,
    cover: "/assets/design/jimeng-feed-5.webp",
    result: "/assets/design/jimeng-feed-5.webp",
    description: "套上复古胶片色调，让照片更有故事感。"
  },
  {
    id: "dream-glow",
    name: "梦幻光晕",
    category: "场景",
    uses: "9.8k",
    price: 4,
    cover: "/assets/design/jimeng-feed-6.webp",
    result: "/assets/design/jimeng-feed-6.webp",
    description: "加上柔光和光晕氛围，适合甜美头像和封面。"
  },
  {
    id: "cinematic-portrait",
    name: "电影质感",
    category: "写真",
    uses: "1.5w",
    price: 5,
    cover: "/assets/design/jimeng-feed-7.webp",
    result: "/assets/design/jimeng-feed-7.webp",
    description: "把人物照变成更有镜头感的电影截图效果。"
  },
  {
    id: "forest-avatar",
    name: "森系人像",
    category: "头像",
    uses: "1.1w",
    price: 4,
    cover: "/assets/design/jimeng-feed-8.webp",
    result: "/assets/design/jimeng-feed-8.webp",
    description: "自然、轻氧、适合社交头像的森系人像。"
  },
  {
    id: "city-night",
    name: "城市夜景",
    category: "场景",
    uses: "8.6k",
    price: 4,
    cover: "/assets/design/jimeng-feed-9.webp",
    result: "/assets/design/jimeng-feed-9.webp",
    description: "把照片带入夜景街区，适合朋友圈氛围图。"
  },
  {
    id: "light-shadow",
    name: "光影人像",
    category: "头像",
    uses: "1.4w",
    price: 5,
    cover: "/assets/design/jimeng-feed-11.webp",
    result: "/assets/design/jimeng-feed-11.webp",
    description: "强化面部光影和质感，变成更精致的社交主图。"
  },
  {
    id: "dark-texture",
    name: "暗调质感",
    category: "节日",
    uses: "7.2k",
    price: 4,
    cover: "/assets/design/jimeng-feed-12.webp",
    result: "/assets/design/jimeng-feed-12.webp",
    description: "偏暗调、强质感的人像效果，适合个性化展示。"
  }
];

const templates = fallbackTemplates.map((item) => ({ ...item }));

const categories = ["热门", "风格", "头像", "写真", "角色", "场景", "节日"];

const categoryIcons = {
  热门: "🔥",
  风格: "✦",
  头像: "●",
  写真: "▣",
  角色: "◆",
  场景: "⌁",
  节日: "✺"
};

function findTemplate(id) {
  return templates.find((item) => item.id === id) || templates[0];
}

function setRemoteTemplates(items) {
  if (!Array.isArray(items) || !items.length) {
    return templates;
  }

  templates.splice(0, templates.length, ...items);
  return templates;
}

function resetTemplates() {
  templates.splice(0, templates.length, ...fallbackTemplates.map((item) => ({ ...item })));
  return templates;
}

function filterTemplates(category) {
  if (!category || category === "热门") {
    return templates;
  }

  return templates.filter((item) => item.category === category);
}

function toHomeCard(template) {
  return {
    id: template.id,
    name: template.name,
    cover: template.cover
  };
}

function withLayout(section) {
  const cards = section.cards.map(toHomeCard);

  return {
    ...section,
    cards,
    trackWidth: Math.max(cards.length * 221 - 21, 200)
  };
}

function getHomeSections(category) {
  if (category && category !== "热门") {
    return [withLayout({
      key: category,
      title: category,
      icon: categoryIcons[category] || "",
      iconClass: category === "头像" ? "avatar" : "style",
      cards: filterTemplates(category)
    })];
  }

  const groupKeys = [];
  const seen = new Set();

  templates.forEach((item) => {
    const key = item.category;

    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    groupKeys.push(key);
  });

  return groupKeys.map((key) => withLayout({
    key,
    title: key,
    icon: categoryIcons[key] || "",
    iconClass: key === "头像" ? "avatar" : "style",
    cards: filterTemplates(key)
  }));
}

module.exports = {
  categories,
  categoryIcons,
  templates,
  fallbackTemplates,
  findTemplate,
  filterTemplates,
  getHomeSections,
  setRemoteTemplates,
  resetTemplates
};
