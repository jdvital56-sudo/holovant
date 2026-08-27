/**
 * The assistant's face, as a point cloud.
 *
 * Built from contour rows rather than a mesh: the reference is a figure drawn
 * in scan lines, and lines of points give that directly while also being the
 * thing that can be scattered and reassembled.
 */

export interface FacePoints {
  /** Final resting position, xyz triples. */
  target: Float32Array;
  /** Where each point starts before assembling. */
  scattered: Float32Array;
  /** 0 outline, 1 core, 2 vocal cords — drives colour and how each reacts. */
  role: Float32Array;
  /** 0..1 down the figure; the wave travels along this. */
  flow: Float32Array;
  count: number;
}

/** Half-width of the silhouette at a given height, in local units. */
function silhouetteWidth(t: number): number {
  // t: 0 at the crown, 1 at the base of the shoulders.
  if (t < 0.06) return 0.36 * Math.sin((t / 0.06) * (Math.PI / 2)); // crown curve
  if (t < 0.34) return 0.36 + 0.06 * Math.sin(((t - 0.06) / 0.28) * Math.PI); // temples, cheeks
  if (t < 0.46) return 0.42 - 0.2 * ((t - 0.34) / 0.12); // jaw drawing in
  if (t < 0.58) return 0.22 - 0.06 * ((t - 0.46) / 0.12); // neck
  // Shoulders flare out and fade.
  return 0.16 + 1.05 * Math.pow((t - 0.58) / 0.42, 1.25);
}

const ROWS = 78;
const MIN_PER_ROW = 26;
const MAX_PER_ROW = 74;
const HEIGHT = 3.1;
const SCATTER_RADIUS = 7;

function pushPoint(
  arrays: { target: number[]; scattered: number[]; role: number[]; flow: number[] },
  x: number,
  y: number,
  z: number,
  role: number,
  flow: number,
) {
  arrays.target.push(x, y, z);
  // Points stream in from a wide shell, which is what reads as assembly
  // rather than as a shape fading up.
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const r = SCATTER_RADIUS * (0.5 + Math.random() * 0.5);
  arrays.scattered.push(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi) * 0.5,
    r * Math.sin(phi) * Math.sin(theta),
  );
  arrays.role.push(role);
  arrays.flow.push(flow);
}

export function buildFace(): FacePoints {
  const arrays = { target: [] as number[], scattered: [] as number[], role: [] as number[], flow: [] as number[] };

  for (let row = 0; row < ROWS; row++) {
    const t = row / (ROWS - 1);
    const halfWidth = silhouetteWidth(t);
    if (halfWidth <= 0.01) continue;

    const y = HEIGHT * (0.5 - t);
    // Denser where the figure is wide, so density stays even along the contour.
    const perRow = Math.round(MIN_PER_ROW + (MAX_PER_ROW - MIN_PER_ROW) * Math.min(1, halfWidth / 0.8));

    for (let i = 0; i < perRow; i++) {
      const u = perRow === 1 ? 0.5 : i / (perRow - 1);
      const x = (u * 2 - 1) * halfWidth;
      // A shallow curve in depth: enough to catch the light as it turns,
      // without becoming a head seen from the side.
      const z = 0.26 * Math.cos((u * 2 - 1) * (Math.PI / 2)) * (t < 0.5 ? 1 : 0.4);
      pushPoint(arrays, x, y, z, 0, t);
    }
  }

  // The core: a bright oval sitting where a face would be, drawn in horizontal
  // bands so it reads as something signalling rather than a solid blob.
  const CORE_ROWS = 22;
  for (let row = 0; row < CORE_ROWS; row++) {
    const t = row / (CORE_ROWS - 1);
    const y = HEIGHT * (0.5 - (0.13 + t * 0.2));
    const band = Math.sin(t * Math.PI);
    const halfWidth = 0.2 * band;
    const perRow = Math.max(6, Math.round(30 * band));
    for (let i = 0; i < perRow; i++) {
      const u = perRow === 1 ? 0.5 : i / (perRow - 1);
      pushPoint(arrays, (u * 2 - 1) * halfWidth, y, 0.16, 1, t);
    }
  }

  // Vocal cords: strands running down the throat, which are what visibly
  // fire when the assistant speaks.
  const STRANDS = 5;
  for (let strand = 0; strand < STRANDS; strand++) {
    const lean = (strand / (STRANDS - 1) - 0.5) * 0.16;
    for (let i = 0; i < 34; i++) {
      const t = i / 33;
      const y = HEIGHT * (0.5 - (0.44 + t * 0.16));
      const x = lean * (0.3 + t) + Math.sin(t * Math.PI * 3 + strand) * 0.015;
      pushPoint(arrays, x, y, 0.12, 2, t);
    }
  }

  return {
    target: new Float32Array(arrays.target),
    scattered: new Float32Array(arrays.scattered),
    role: new Float32Array(arrays.role),
    flow: new Float32Array(arrays.flow),
    count: arrays.role.length,
  };
}
