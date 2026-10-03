/**
 * Dựng ảnh phối cảnh (mặc định 1200×630 JPEG) từ tile cube của bản xuất 3DVista —
 * KHÔNG chụp canvas của tour đang chạy (không giữ drawing buffer, dính hotspot/UI, sai tỉ lệ).
 * Tile cùng origin với website nên canvas không bị tainted, toBlob chạy được.
 *
 * Tile: <base>/media/<panoId>_0/<face>/<zoom>/<row>_<col>.jpg
 *   face r l u d f b · zoom 0 (nét nhất) … 3 (thô nhất) · n = 2^(3−zoom) tile mỗi cạnh · tile 512².
 * Hệ trục: camera nhìn về −Z, +Y là lên; bảng mặt / hằng số dấu theo SPEC-chia-se-og §6.2.4–6.2.5.
 */

const TILE_SIZE = 512;
const MAX_TILES = 48;
const GRID_X = 65;
const GRID_Y = 35;
const EDGE_MARGIN = 0.04;
/** Đo thực tế với 3DVista. Ảnh chụp bị lật gương so với preview → đổi dấu ĐÚNG MỘT hằng số. */
const YAW_SIGN = -1;
const PITCH_SIGN = 1;

type Vec3 = [number, number, number];
type FaceKey = 'r' | 'l' | 'u' | 'd' | 'f' | 'b';

interface FaceAxes {
  key: FaceKey;
  n: Vec3;
  r: Vec3;
  u: Vec3;
}

// Thứ tự = thứ tự texture t0..t5 trong shader
const FACES: FaceAxes[] = [
  { key: 'r', n: [1, 0, 0], r: [0, 0, 1], u: [0, 1, 0] },
  { key: 'l', n: [-1, 0, 0], r: [0, 0, -1], u: [0, 1, 0] },
  { key: 'u', n: [0, 1, 0], r: [1, 0, 0], u: [0, 0, 1] },
  { key: 'd', n: [0, -1, 0], r: [1, 0, 0], u: [0, 0, -1] },
  { key: 'f', n: [0, 0, -1], r: [1, 0, 0], u: [0, 1, 0] },
  { key: 'b', n: [0, 0, 1], r: [-1, 0, 0], u: [0, 1, 0] },
];

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const toRad = (deg: number) => (deg * Math.PI) / 180;

export interface PanoShotOptions {
  /** Thư mục bản xuất, vd "/assets/vr-data" */
  tourBasePath: string;
  /** Id cảnh dạng "panorama_<UUID>" */
  pano: string;
  yaw: number;
  pitch: number;
  /** Góc nhìn NGANG của ảnh ra (độ) */
  fov: number;
  width?: number;
  height?: number;
  quality?: number;
  onProgress?: (done: number, total: number) => void;
}

interface FaceRect {
  c0: number;
  r0: number;
  cols: number;
  rows: number;
}

/** Tia nhìn cho điểm chuẩn hoá x,y ∈ [−1,1] (trái→phải, dưới→trên) — giống hệt shader */
const rayFor = (x: number, y: number, tanH: number, aspect: number, yawRad: number, pitchRad: number): Vec3 => {
  let dx = x * tanH;
  let dy = y * tanH * aspect;
  let dz = -1;
  const len = Math.hypot(dx, dy, dz);
  dx /= len;
  dy /= len;
  dz /= len;

  // xoay quanh X (pitch)
  const cp = Math.cos(pitchRad);
  const sp = Math.sin(pitchRad);
  const y1 = dy * cp - dz * sp;
  const z1 = dy * sp + dz * cp;
  // xoay quanh Y (yaw)
  const cy = Math.cos(yawRad);
  const sy = Math.sin(yawRad);
  return [dx * cy + z1 * sy, y1, -dx * sy + z1 * cy];
};

const faceUv = (d: Vec3): { face: number; u: number; v: number } => {
  let face = 0;
  let best = -Infinity;
  FACES.forEach((axes, index) => {
    const score = dot(d, axes.n);
    if (score > best) {
      best = score;
      face = index;
    }
  });
  const axes = FACES[face];
  const scale = 1 / best;
  const t: Vec3 = [d[0] * scale, d[1] * scale, d[2] * scale];
  return { face, u: (dot(t, axes.r) + 1) / 2, v: (1 - dot(t, axes.u)) / 2 };
};

/** Lưới tia 65×35 → hình chữ nhật tile cần cho từng mặt (null = mặt không dùng) */
const collectFaceRects = (n: number, tanH: number, aspect: number, yawRad: number, pitchRad: number) => {
  const hits: Array<Set<string>> = FACES.map(() => new Set());
  for (let gy = 0; gy < GRID_Y; gy += 1) {
    for (let gx = 0; gx < GRID_X; gx += 1) {
      const x = (gx / (GRID_X - 1)) * 2 - 1;
      const y = (gy / (GRID_Y - 1)) * 2 - 1;
      const { face, u, v } = faceUv(rayFor(x, y, tanH, aspect, yawRad, pitchRad));
      const fu = Math.min(u * n, n - 1e-6);
      const fv = Math.min(v * n, n - 1e-6);
      const col = Math.floor(fu);
      const row = Math.floor(fv);
      const add = (c: number, r: number) => {
        if (c >= 0 && r >= 0 && c < n && r < n) hits[face].add(`${r}_${c}`);
      };
      add(col, row);
      // Sát mép tile → lấy thêm tile bên cạnh, tránh viền đen khi nội suy
      const nearLeft = fu - col < EDGE_MARGIN;
      const nearRight = col + 1 - fu < EDGE_MARGIN;
      const nearTop = fv - row < EDGE_MARGIN;
      const nearBottom = row + 1 - fv < EDGE_MARGIN;
      if (nearLeft) add(col - 1, row);
      if (nearRight) add(col + 1, row);
      if (nearTop) add(col, row - 1);
      if (nearBottom) add(col, row + 1);
      if (nearLeft && nearTop) add(col - 1, row - 1);
      if (nearRight && nearTop) add(col + 1, row - 1);
      if (nearLeft && nearBottom) add(col - 1, row + 1);
      if (nearRight && nearBottom) add(col + 1, row + 1);
    }
  }

  return hits.map((set): FaceRect | null => {
    if (set.size === 0) return null;
    const cells = [...set].map((key) => key.split('_').map(Number));
    const rows = cells.map(([r]) => r);
    const cols = cells.map(([, c]) => c);
    const r0 = Math.min(...rows);
    const c0 = Math.min(...cols);
    return { c0, r0, cols: Math.max(...cols) - c0 + 1, rows: Math.max(...rows) - r0 + 1 };
  });
};

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Không tải được ${url}`));
    image.src = url;
  });

const VERTEX_SHADER = `
attribute vec2 aPos;
varying vec2 vPos;
void main() { vPos = aPos; gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAGMENT_SHADER = `
precision highp float;
varying vec2 vPos;
uniform float uTanH, uAspect, uYaw, uPitch, uN;
uniform sampler2D t0, t1, t2, t3, t4, t5;
uniform vec4 rect0, rect1, rect2, rect3, rect4, rect5;

vec4 sampleFace(sampler2D tex, vec4 rect, vec2 uv) {
  return texture2D(tex, (uv * uN - rect.xy) / rect.zw);
}

void main() {
  vec3 d = normalize(vec3(vPos.x * uTanH, vPos.y * uTanH * uAspect, -1.0));
  float cp = cos(uPitch), sp = sin(uPitch);
  d = vec3(d.x, d.y * cp - d.z * sp, d.y * sp + d.z * cp);
  float cy = cos(uYaw), sy = sin(uYaw);
  d = vec3(d.x * cy + d.z * sy, d.y, -d.x * sy + d.z * cy);

  vec3 a = abs(d);
  if (a.x >= a.y && a.x >= a.z) {
    if (d.x > 0.0) { vec3 t = d / d.x;  gl_FragColor = sampleFace(t0, rect0, vec2((t.z + 1.0) * 0.5, (1.0 - t.y) * 0.5)); }
    else           { vec3 t = d / -d.x; gl_FragColor = sampleFace(t1, rect1, vec2((1.0 - t.z) * 0.5, (1.0 - t.y) * 0.5)); }
  } else if (a.y >= a.z) {
    if (d.y > 0.0) { vec3 t = d / d.y;  gl_FragColor = sampleFace(t2, rect2, vec2((t.x + 1.0) * 0.5, (1.0 - t.z) * 0.5)); }
    else           { vec3 t = d / -d.y; gl_FragColor = sampleFace(t3, rect3, vec2((t.x + 1.0) * 0.5, (1.0 + t.z) * 0.5)); }
  } else {
    if (d.z < 0.0) { vec3 t = d / -d.z; gl_FragColor = sampleFace(t4, rect4, vec2((t.x + 1.0) * 0.5, (1.0 - t.y) * 0.5)); }
    else           { vec3 t = d / d.z;  gl_FragColor = sampleFace(t5, rect5, vec2((1.0 - t.x) * 0.5, (1.0 - t.y) * 0.5)); }
  }
}
`;

const compile = (gl: WebGLRenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Trình duyệt không tạo được shader WebGL');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`Lỗi shader: ${gl.getShaderInfoLog(shader) ?? ''}`);
  }
  return shader;
};

/** Dựng ảnh từ góc nhìn → Blob JPEG */
export const renderPanoShot = async ({
  tourBasePath,
  pano,
  yaw,
  pitch,
  fov,
  width = 1200,
  height = 630,
  quality = 0.9,
  onProgress,
}: PanoShotOptions): Promise<Blob> => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
  if (!gl) throw new Error('Trình duyệt không hỗ trợ WebGL');

  const tanH = Math.tan(toRad(fov) / 2);
  const aspect = height / width;
  const yawRad = toRad(yaw * YAW_SIGN);
  const pitchRad = toRad(pitch * PITCH_SIGN);
  const maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;

  // Mức zoom thô nhất mà vẫn đủ nét: px/độ của tile ≥ px/độ của ảnh ra
  let zoom = 3;
  for (let candidate = 3; candidate >= 0; candidate -= 1) {
    zoom = candidate;
    if ((TILE_SIZE * 2 ** (3 - candidate)) / 90 >= width / fov) break;
  }

  let n = 2 ** (3 - zoom);
  let rects = collectFaceRects(n, tanH, aspect, yawRad, pitchRad);
  const tooBig = (list: Array<FaceRect | null>) =>
    list.reduce((sum, rect) => sum + (rect ? rect.cols * rect.rows : 0), 0) > MAX_TILES ||
    list.some((rect) => rect && Math.max(rect.cols, rect.rows) * TILE_SIZE > maxTexture);
  while (tooBig(rects) && zoom < 3) {
    zoom += 1;
    n = 2 ** (3 - zoom);
    rects = collectFaceRects(n, tanH, aspect, yawRad, pitchRad);
  }

  // Tải tile song song, ghép mỗi mặt thành 1 canvas; tile lỗi thì để nền tối
  const total = rects.reduce((sum, rect) => sum + (rect ? rect.cols * rect.rows : 0), 0);
  let done = 0;
  onProgress?.(0, total);

  const faceCanvases = await Promise.all(
    rects.map(async (rect, faceIndex) => {
      if (!rect) return null;
      const faceCanvas = document.createElement('canvas');
      faceCanvas.width = rect.cols * TILE_SIZE;
      faceCanvas.height = rect.rows * TILE_SIZE;
      const ctx = faceCanvas.getContext('2d');
      if (!ctx) return null;
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, faceCanvas.width, faceCanvas.height);

      const jobs: Promise<void>[] = [];
      for (let row = rect.r0; row < rect.r0 + rect.rows; row += 1) {
        for (let col = rect.c0; col < rect.c0 + rect.cols; col += 1) {
          const url = `${tourBasePath}/media/${pano}_0/${FACES[faceIndex].key}/${zoom}/${row}_${col}.jpg`;
          jobs.push(
            loadImage(url)
              .then((image) => ctx.drawImage(image, (col - rect.c0) * TILE_SIZE, (row - rect.r0) * TILE_SIZE))
              .catch(() => undefined)
              .finally(() => {
                done += 1;
                onProgress?.(done, total);
              }),
          );
        }
      }
      await Promise.all(jobs);
      return faceCanvas;
    }),
  );

  if (done > 0 && faceCanvases.every((faceCanvas) => !faceCanvas)) {
    throw new Error('Không tải được tile nào của cảnh này');
  }

  const program = gl.createProgram();
  if (!program) throw new Error('Trình duyệt không tạo được chương trình WebGL');
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Lỗi liên kết shader: ${gl.getProgramInfoLog(program) ?? ''}`);
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const blank = document.createElement('canvas');
  blank.width = 1;
  blank.height = 1;

  faceCanvases.forEach((faceCanvas, index) => {
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + index);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, faceCanvas ?? blank);
    gl.uniform1i(gl.getUniformLocation(program, `t${index}`), index);
    const rect = rects[index] ?? { c0: 0, r0: 0, cols: 1, rows: 1 };
    gl.uniform4f(gl.getUniformLocation(program, `rect${index}`), rect.c0, rect.r0, rect.cols, rect.rows);
  });

  gl.uniform1f(gl.getUniformLocation(program, 'uTanH'), tanH);
  gl.uniform1f(gl.getUniformLocation(program, 'uAspect'), aspect);
  gl.uniform1f(gl.getUniformLocation(program, 'uYaw'), yawRad);
  gl.uniform1f(gl.getUniformLocation(program, 'uPitch'), pitchRad);
  gl.uniform1f(gl.getUniformLocation(program, 'uN'), n);

  gl.viewport(0, 0, width, height);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Không xuất được ảnh JPEG'))),
      'image/jpeg',
      quality,
    );
  });
};

/**
 * Khung 1200:630 vẽ trên khung xem trước + góc nhìn ngang tương ứng để ảnh chụp khớp đúng
 * những gì nằm trong khung. hfov của player trải trên CHIỀU NGANG khung xem trước.
 */
export const shareCropFrame = (viewWidth: number, viewHeight: number, viewerHfov: number) => {
  const target = 1200 / 630;
  const frameWidth = viewWidth / viewHeight > target ? viewHeight * target : viewWidth;
  const frameHeight = frameWidth / target;
  const fov = (2 * Math.atan(Math.tan(toRad(viewerHfov) / 2) * (frameWidth / viewWidth)) * 180) / Math.PI;
  return { frameWidth, frameHeight, fov };
};
