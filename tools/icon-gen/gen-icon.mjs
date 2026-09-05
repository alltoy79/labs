import zlib from "node:zlib";
import fs from "node:fs";

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function png(size, draw) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, [r, g, b, a = 255]) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
  };
  draw(set, size);
  // 스캔라인마다 필터 바이트 0 추가
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const BG = [79, 70, 229];      // indigo-600
const FG = [255, 255, 255];
const ACC = [199, 210, 254];   // indigo-200

// 마스커블 안전영역(중앙 80%) 안에 마크를 넣는다.
function draw(set, S) {
  const u = S / 100;                       // 1% 단위
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, BG);

  const rect = (x, y, w, h, c, r = 0) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (r > 0) {                          // 모서리 둥글게
        const dx = Math.min(i, w - 1 - i), dy = Math.min(j, h - 1 - j);
        if (dx < r && dy < r && (r - dx) ** 2 + (r - dy) ** 2 > r * r) continue;
      }
      set(Math.round(x + i), Math.round(y + j), c);
    }
  };

  // 흰 카드 (퀴즈 카드 느낌) — 중앙 62%
  const cw = 62 * u, ch = 62 * u, cx = (S - cw) / 2, cy = (S - ch) / 2;
  rect(cx, cy, cw, ch, FG, 10 * u);

  // 카드 안 가로줄 3개 (문제 텍스트)
  const lw = 38 * u, lh = 6 * u, lx = cx + 12 * u;
  rect(lx, cy + 14 * u, lw, lh, BG, lh / 2);
  rect(lx, cy + 27 * u, lw * 0.8, lh, ACC, lh / 2);
  rect(lx, cy + 40 * u, lw * 0.55, lh, ACC, lh / 2);
}

for (const size of [192, 512]) {
  const out = `public/icon-${size}.png`;
  fs.writeFileSync(out, png(size, draw));
  console.log(`  ${out}  ${fs.statSync(out).size} bytes`);
}
