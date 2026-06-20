const { Jimp } = require("jimp");
const jsQR = require("jsqr");

// Extract per-pixel luminance from raw RGBA buffer
function lumaFromRGBA(data) {
  const luma = new Float32Array(data.length / 4);
  for (let i = 0; i < luma.length; i++) {
    const o = i * 4;
    luma[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
  }
  return luma;
}

// 2x box-filter downsample — averages each 2x2 block into one pixel.
// Chaining this (full → half → quarter → eighth) progressively removes
// grain, JPEG noise, and the white gaps between circular dots, while
// keeping QR module structure intact.
function halve(luma, width, height) {
  const newW = Math.floor(width / 2);
  const newH = Math.floor(height / 2);
  const out = new Float32Array(newW * newH);
  for (let y = 0; y < newH; y++) {
    for (let x = 0; x < newW; x++) {
      out[y * newW + x] = (
        luma[y * 2 * width + x * 2] +
        luma[y * 2 * width + x * 2 + 1] +
        luma[(y * 2 + 1) * width + x * 2] +
        luma[(y * 2 + 1) * width + x * 2 + 1]
      ) / 4;
    }
  }
  return { luma: out, width: newW, height: newH };
}

// Single global threshold
function globalBinarize(luma, threshold) {
  const out = new Uint8ClampedArray(luma.length * 4);
  for (let i = 0; i < luma.length; i++) {
    const val = luma[i] < threshold ? 0 : 255;
    out[i * 4]     = val;
    out[i * 4 + 1] = val;
    out[i * 4 + 2] = val;
    out[i * 4 + 3] = 255;
  }
  return out;
}

// Adaptive local threshold using integral image (O(n) total).
// Each pixel is compared against the mean of its local neighborhood
// minus a constant c. Handles textures, shadows, non-uniform lighting.
function adaptiveBinarize(luma, width, height, blockSize, c) {
  const integral = new Float64Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      integral[i] = luma[i]
        + (x > 0 ? integral[i - 1] : 0)
        + (y > 0 ? integral[i - width] : 0)
        - (x > 0 && y > 0 ? integral[i - width - 1] : 0);
    }
  }

  const half = Math.floor(blockSize / 2);
  const out = new Uint8ClampedArray(luma.length * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - half);
      const x1 = Math.min(width - 1, x + half);
      const y0 = Math.max(0, y - half);
      const y1 = Math.min(height - 1, y + half);

      const area = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum = integral[y1 * width + x1]
        - (x0 > 0 ? integral[y1 * width + x0 - 1] : 0)
        - (y0 > 0 ? integral[(y0 - 1) * width + x1] : 0)
        + (x0 > 0 && y0 > 0 ? integral[(y0 - 1) * width + x0 - 1] : 0);

      const localMean = sum / area;
      const val = luma[y * width + x] < localMean - c ? 0 : 255;

      const o = (y * width + x) * 4;
      out[o]     = val;
      out[o + 1] = val;
      out[o + 2] = val;
      out[o + 3] = 255;
    }
  }

  return out;
}

// Try all binarization strategies at a given scale
function tryDecode(luma, width, height) {
  // Stage 1: global thresholds — fast, covers most digital/styled QR codes
  for (const t of [128, 100, 160, 80, 180, 64, 200]) {
    const pixels = globalBinarize(luma, t);
    const code = jsQR(pixels, width, height);
    if (code) return code.data;
  }

  // Stage 2: adaptive — handles real-world photos, textures, wood grain
  const blockSize = Math.max(16, Math.floor(Math.min(width, height) / 40));
  for (const c of [10, 5, 15]) {
    const pixels = adaptiveBinarize(luma, width, height, blockSize, c);
    const code = jsQR(pixels, width, height);
    if (code) return code.data;
  }

  return null;
}

module.exports = async function qrDecoder(buffer) {
  const image = await Jimp.read(buffer);
  const { data, width, height } = image.bitmap;

  const fullLuma = lumaFromRGBA(data);

  // Build a pyramid of scales by repeatedly halving.
  // Each halve() call averages 2x2 blocks — this smooths out grain and
  // merges circular dot gaps without needing any extra libraries.
  // We stop halving once the image would drop below 150px (too small for jsQR).
  const scales = [{ luma: fullLuma, width, height }];
  let current = { luma: fullLuma, width, height };
  while (current.width >= 300 && current.height >= 300) {
    current = halve(current.luma, current.width, current.height);
    scales.push(current);
  }

  // Try each scale largest-first. Clean/digital QRs succeed immediately
  // at full size. Real-world photos and styled QRs fall through to
  // smaller scales where noise and dot gaps have been averaged away.
  for (const scale of scales) {
    const result = tryDecode(scale.luma, scale.width, scale.height);
    if (result) return result;
  }

  return null;
};
