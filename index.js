(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof exports === "object") {
    module.exports = factory();
  } else {
    root.ImageTune = factory();
  }
}(this, function ($, _) {

  var types = {
    "jpg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
  }

  var convertImage = function (image, options = {}) {
    return new Promise(function (resolve, reject) {
      var width = options.width || 200;
      var height = options.height || 200;
      var mode = options.mode || 'scale'
      var quality = (options.quality || 100) / 100;
      var type = types[(options.type || 'jpg')];

      if (!type) {
        reject("Not supported image format " + options.type);
      }

      if (0 > quality || quality > 1) {
        reject("Not supported quality value " + options.quality);
      }

      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext("2d");
      ctx.imageSmoothingQuality = options.smoothingQuality || "high";

      var widthRatio = image.width / width;
      var heightRatio = image.height / height;

      var scaledWidth = 0;
      var scaledHeight = 0;
      var offsetX = 0;
      var offsetY = 0;

      if (mode == 'crop') {
        canvas.width = width;
        canvas.height = height;

        if (widthRatio >= heightRatio) {
          scaledWidth = image.width / heightRatio;
          scaledHeight = image.height / heightRatio;
          offsetX = (width - scaledWidth) / 2;
        } else {
          scaledWidth = image.width / widthRatio;
          scaledHeight = image.height / widthRatio;
          offsetY = (height - scaledHeight) / 2;
        }
      } else if (mode == 'scale') {
        if (widthRatio > heightRatio) {
          canvas.width = image.width / widthRatio;
          canvas.height = image.height / widthRatio;
        } else {
          canvas.width = image.width / heightRatio;
          canvas.height = image.height / heightRatio;
        }
        scaledWidth = canvas.width;
        scaledHeight = canvas.height;
      }

      ctx.drawImage(image, offsetX, offsetY, scaledWidth, scaledHeight);

      resolve(canvas.toDataURL(type, quality));
    });
  }

  var loadImage = function (file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      var image = new Image();

      image.onload = function () {
        resolve(image);
      }

      reader.onloadend = function () {
        image.src = reader.result;
      }

      reader.readAsDataURL(file);
    });
  }

  var ImageTune = {
    tune: function (file, options) {
      return new Promise(function (resolve, reject) {
        loadImage(file).then(function (result) {
          convertImage(result, options).then(function (data) {
            resolve(data);
          });
        });
      });
    }
  }

  return ImageTune;
}));