/**
 * 의존성 없는 PNG 생성기.
 *
 * 이 기기에는 ImageMagick / rsvg-convert 가 없고 sips 는 SVG 를 다루지 못한다.
 * 외부 도구 없이 돌아가도록 Node 내장 zlib 로 PNG 를 직접 인코딩한다.
 */
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function encodePng(size, draw) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, [r, g, b, a = 255]) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = a;
  };
  draw(set, size);

  // PNG 스캔라인마다 필터 바이트(0) 를 앞에 붙인다
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0;
    px.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** "#4f46e5" → [79, 70, 229] */
export function hexToRgb(hex) {
  const h = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`잘못된 색상: ${hex} (예: #4f46e5)`);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/** 배경색을 어둡게/밝게 섞어 보조색을 만든다 */
function mix(a, b, t) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}

/**
 * 기본 마크: 배경 + 흰 카드 + 가로줄 3개 (퀴즈 카드).
 * 마크를 중앙 62% 안에 두어 안드로이드 마스커블에서 잘려도 안전하다.
 */
function drawCard(color) {
  const BG = color;
  const FG = [255, 255, 255];
  const ACC = mix(FG, BG, 0.35);

  return (set, S) => {
    const u = S / 100;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, BG);

    const rect = (x, y, w, h, c, r = 0) => {
      for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++) {
          if (r > 0) {
            const dx = Math.min(i, w - 1 - i);
            const dy = Math.min(j, h - 1 - j);
            if (dx < r && dy < r && (r - dx) ** 2 + (r - dy) ** 2 > r * r) continue;
          }
          set(x + i, y + j, c);
        }
    };

    const cw = 62 * u;
    const cx = (S - cw) / 2;
    const cy = (S - cw) / 2;
    rect(cx, cy, cw, cw, FG, 10 * u);

    const lw = 38 * u;
    const lh = 6 * u;
    const lx = cx + 12 * u;
    rect(lx, cy + 14 * u, lw, lh, BG, lh / 2);
    rect(lx, cy + 27 * u, lw * 0.8, lh, ACC, lh / 2);
    rect(lx, cy + 40 * u, lw * 0.55, lh, ACC, lh / 2);
  };
}

/**
 * PWA 아이콘 일습을 생성한다.
 * @param {object} o
 * @param {string} o.publicDir  public/ 경로 (icon-192.png, icon-512.png)
 * @param {string} o.appDir     app/ 경로   (apple-icon.png 180x180)
 * @param {string} o.color      배경 hex
 * @returns {string[]} 생성된 파일 경로
 */
export function generateIcons({ publicDir, appDir, color = "#4f46e5" }) {
  const draw = drawCard(hexToRgb(color));
  const written = [];
  const write = (file, size) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, encodePng(size, draw));
    written.push(file);
  };
  write(path.join(publicDir, "icon-192.png"), 192);
  write(path.join(publicDir, "icon-512.png"), 512);
  // iOS 홈 화면용. 없으면 아이콘 대신 페이지 스크린샷이 뜬다.
  write(path.join(appDir, "apple-icon.png"), 180);
  return written;
}
