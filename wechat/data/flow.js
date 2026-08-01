const homeFlowSteps = [
  { key: "pick", index: "1", title: "选玩法", desc: "先看效果" },
  { key: "upload", index: "2", title: "传照片", desc: "清晰正脸" },
  { key: "generate", index: "3", title: "开始变", desc: "积分开变" },
  { key: "save", index: "4", title: "保存分享", desc: "进图库" }
];

const createFlowSteps = [
  { key: "upload", label: "传照片" },
  { key: "ratio", label: "选比例" },
  { key: "generate", label: "开变" }
];

function getCreateFlowKey({ imagePath, generating }) {
  if (generating) {
    return "generate";
  }

  return imagePath ? "ratio" : "upload";
}

module.exports = {
  homeFlowSteps,
  createFlowSteps,
  getCreateFlowKey
};
