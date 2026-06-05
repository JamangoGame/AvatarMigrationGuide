import * as J from "jamango";

type Vec4 = [number, number, number, number];

export const CUBE = J.assets.props["Effect Cube"].id;
export const SPHERE = J.assets.props["Effect Sphere"].id;

type Effect = {
  prop: J.EntityId;
  startTint: Vec4;
  endTint: Vec4;
  startGlow: number;
  endGlow: number;
  startScale: number;
  endScale: number;
  velocity: J.Vec3;
  acceleration: J.Vec3;
  startPos: J.Vec3;
  startQuat: J.Quat;
  endQuat: J.Quat;
  startTime: number;
  endTime: number;
};

const effects: Effect[] = [];

export function addEffect(
  propId: string,
  startTint: Vec4,
  endTint: Vec4,
  startGlow: number,
  endGlow: number,
  startScale: number,
  endScale: number,
  velocity: J.Vec3,
  acceleration: J.Vec3,
  startPos: J.Vec3,
  startQuat: J.Quat,
  endQuat: J.Quat,
  duration: number
) {
  const prop = J.spawnProp(propId);
  const startTime = J.getWorldTime();

  J.setEntityPosition(prop, startPos, false);
  J.setEntityScale(prop, startScale);
  J.setEntityTint(prop, startTint);
  J.setEntityGlow(prop, startGlow);
  J.setEntityQuaternion(prop, startQuat);

  effects.push({
    prop,
    startTint,
    endTint,
    startGlow,
    endGlow,
    startScale,
    endScale,
    velocity: [...velocity],
    acceleration,
    startPos: [...startPos],
    startQuat: [...startQuat],
    endQuat: [...endQuat],
    startTime,
    endTime: startTime + duration,
  });
}

J.onGameRender(() => {
  const t = J.getWorldTime();

  for (let i = effects.length - 1; i >= 0; i--) {
    const effect = effects[i];

    if (t >= effect.endTime) {
      J.removeEntity(effect.prop);
      effects.splice(i, 1);
      continue;
    }

    const elapsed = t - effect.startTime;
    const duration = effect.endTime - effect.startTime;
    const progress = elapsed / duration;

    const offsetPos: J.Vec3 = [
      effect.startPos[0] + effect.velocity[0] * elapsed + 0.5 * effect.acceleration[0] * elapsed * elapsed,
      effect.startPos[1] + effect.velocity[1] * elapsed + 0.5 * effect.acceleration[1] * elapsed * elapsed,
      effect.startPos[2] + effect.velocity[2] * elapsed + 0.5 * effect.acceleration[2] * elapsed * elapsed,
    ];

    const scale =
      effect.startScale + (effect.endScale - effect.startScale) * progress;

    const tint = J.vec4.lerp(
      [0, 0, 0, 0],
      effect.startTint,
      effect.endTint,
      progress
    );
    const glow =
      effect.startGlow + (effect.endGlow - effect.startGlow) * progress;

    const quat = J.quat.slerp(
      [0, 0, 0, 1],
      effect.startQuat,
      effect.endQuat,
      progress
    );
    // J.setEntityVisible(effect.prop, true);

    J.setEntityPosition(effect.prop, offsetPos);
    J.setEntityScale(effect.prop, scale);
    J.setEntityTint(effect.prop, tint);
    J.setEntityGlow(effect.prop, glow);
    J.setEntityQuaternion(effect.prop, quat);
  }
});
