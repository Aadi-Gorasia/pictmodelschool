"use strict";
/**
 * lib/imagemeta.js
 * ---------------------------------------------------------------------------
 * Reads pixel dimensions straight out of image file headers. No "sharp" or
 * "image-size" package (no network to install one) - these formats' headers
 * are simple and well documented enough to parse directly and reliably.
 * Returns null (never throws) for anything it doesn't recognize, so the
 * media library degrades gracefully for file types it can't measure.
 */

function readPng(buf) {
  // 8-byte signature, then first chunk must be IHDR: width/height are the
  // first 8 bytes of the IHDR chunk data, big-endian, at fixed offsets.
  if (buf.length < 24) return null;
  const sig = buf.subarray(0, 8);
  const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!sig.equals(pngSig)) return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

function readGif(buf) {
  if (buf.length < 10) return null;
  const header = buf.toString("ascii", 0, 6);
  if (header !== "GIF87a" && header !== "GIF89a") return null;
  const width = buf.readUInt16LE(6);
  const height = buf.readUInt16LE(8);
  return { width, height };
}

function readJpeg(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 1 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = buf[offset + 1];
    if (marker === 0xff) {
      offset++; // fill byte, keep scanning
      continue;
    }
    // Markers with no payload: TEM, RSTn, SOI, EOI.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }
    if (offset + 3 >= buf.length) break;
    const segmentLength = buf.readUInt16BE(offset + 2);
    const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSOF) {
      if (offset + 8 >= buf.length) break;
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      return { width, height };
    }
    if (marker === 0xda) break; // start of entropy-coded scan data - no more header markers follow
    offset += 2 + segmentLength;
  }
  return null;
}

function readWebp(buf) {
  if (buf.length < 30) return null;
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return null;
  const format = buf.toString("ascii", 12, 16);
  if (format === "VP8 ") {
    // Lossy: dimensions are 14 bits each, little-endian, at offset 26/28.
    const width = buf.readUInt16LE(26) & 0x3fff;
    const height = buf.readUInt16LE(28) & 0x3fff;
    return { width, height };
  }
  if (format === "VP8L") {
    // Lossless: bits packed starting at offset 21.
    const b = buf.readUInt32LE(21);
    const width = (b & 0x3fff) + 1;
    const height = ((b >> 14) & 0x3fff) + 1;
    return { width, height };
  }
  if (format === "VP8X") {
    const width = (buf[24] | (buf[25] << 8) | (buf[26] << 16)) + 1;
    const height = (buf[27] | (buf[28] << 8) | (buf[29] << 16)) + 1;
    return { width, height };
  }
  return null;
}

function readImageDimensions(buf, ext) {
  try {
    switch ((ext || "").toLowerCase()) {
      case ".png":
        return readPng(buf);
      case ".gif":
        return readGif(buf);
      case ".jpg":
      case ".jpeg":
        return readJpeg(buf);
      case ".webp":
        return readWebp(buf);
      default:
        return null;
    }
  } catch {
    return null;
  }
}

module.exports = { readImageDimensions };
