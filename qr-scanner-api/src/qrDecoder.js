const Jimp = require("jimp");
const jsQR = require("jsqr");

module.exports = async function qrDecoder(buffer) {
  const image = await Jimp.read(buffer);

  const { data, width, height } = image.bitmap;

  const code = jsQR(new Uint8ClampedArray(data), width, height);

  if (!code) return null;

  return code.data; // this is the URL
};