import * as J from "jamango";

// easing functions (t: 0 to 1)

export const easeInQuad = (t: number) => t * t;
export const easeOutQuad = (t: number) => t * (2 - t);
export const easeInOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

export const easeInCubic = (t: number) => t * t * t;
export const easeOutCubic = (t: number) => --t * t * t + 1;
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;

export const easeInExpo = (t: number) => (t === 0 ? 0 : Math.pow(2, 10 * (t - 1)));
export const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

export const easeInElastic = (t: number) => Math.sin(((13 * Math.PI) / 2) * t) * Math.pow(2, 10 * (t - 1));
export const easeOutElastic = (t: number) =>
  Math.sin(((-13 * Math.PI) / 2) * (t + 1)) * Math.pow(2, -10 * t) + 1;

export const spring = (t: number, damping = 18, frequency = 50) =>
  Math.sin(frequency * t) * Math.exp(-damping * t);

export function easeOutCirc(x: number): number {
  return Math.sqrt(1 - Math.pow(x - 1, 2));
}

export function quatFromDirection(out: J.Quat, dir: J.Vec3): J.Quat {
  const forward = J.vec3.normalize([0, 0, 0], dir);
  const up: J.Vec3 = [0, 1, 0];
  const right = J.vec3.normalize([0, 0, 0], J.vec3.cross([0, 0, 0], up, forward));
  const correctedUp = J.vec3.cross([0, 0, 0], forward, right);

  const mat: J.Mat3 = [
    right[0],
    right[1],
    right[2],
    correctedUp[0],
    correctedUp[1],
    correctedUp[2],
    forward[0],
    forward[1],
    forward[2],
  ];

  return J.quat.fromMat3(out, mat);
}
