function saveLocalImage(filePath) {
  return new Promise((resolve, reject) => {
    wx.saveImageToPhotosAlbum({
      filePath,
      success: resolve,
      fail: reject
    });
  });
}

function downloadImage(url) {
  if (!/^https?:\/\//i.test(url)) {
    return Promise.resolve(url);
  }

  return new Promise((resolve, reject) => {
    wx.downloadFile({
      url,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300 && res.tempFilePath) {
          resolve(res.tempFilePath);
          return;
        }
        reject(new Error("图片下载失败"));
      },
      fail: reject
    });
  });
}

function saveImageToAlbum(url) {
  const imageUrl = String(url || "").trim();
  if (!imageUrl) {
    return Promise.reject(new Error("图片地址为空"));
  }

  return downloadImage(imageUrl).then(saveLocalImage);
}

module.exports = { saveImageToAlbum };
