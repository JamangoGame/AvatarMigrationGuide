import * as J from "jamango";
import { addEffect, SPHERE } from "./effects";

export function spawnArrowTrailParticle(position: J.Vec3) {
  const randomQuat = J.quat.random([0, 0, 0, 1]);
  addEffect(
    SPHERE,
    [0.5, 0.5, 0.5, 0],
    [0.5, 0.5, 0.5, 0],
    0,
    0,
    0.2,
    0,
    [0, 0.1, 0],
    [0, 0, 0],
    position,
    randomQuat,
    randomQuat,
    0.5
  );
}

export function spawnArrowReflectionParticles(
  position: J.Vec3,
  normal: J.Vec3
) {
  const particleCount = 6;
  for (let i = 0; i < particleCount; i++) {
    const angle = (i / particleCount) * Math.PI * 2;

    const arbitrary: J.Vec3 = Math.abs(normal[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const tangent = J.vec3.normalize(
      [0, 0, 0],
      J.vec3.cross([0, 0, 0], normal, arbitrary)
    );
    const bitangent = J.vec3.cross([0, 0, 0], normal, tangent);

    const circleOffset: J.Vec3 = [
      Math.cos(angle) * tangent[0] + Math.sin(angle) * bitangent[0],
      Math.cos(angle) * tangent[1] + Math.sin(angle) * bitangent[1],
      Math.cos(angle) * tangent[2] + Math.sin(angle) * bitangent[2],
    ];

    const spreadSpeed = 2;
    const normalSpeed = 3;
    const velocity: J.Vec3 = [
      normal[0] * normalSpeed + circleOffset[0] * spreadSpeed,
      normal[1] * normalSpeed + circleOffset[1] * spreadSpeed,
      normal[2] * normalSpeed + circleOffset[2] * spreadSpeed,
    ];

    const randomQuat = J.quat.random([0, 0, 0, 1]);
    addEffect(
      SPHERE,
      [0.8, 0.8, 0.8, 1],
      [0.5, 0.5, 0.5, 0],
      0.3,
      0,
      0.5,
      0,
      velocity,
      [0, 0, 0],
      position,
      randomQuat,
      randomQuat,
      0.4
    );
  }
}

export function spawnPlayerDeathParticles(position: J.Vec3) {
  const particleCount = 12;
  for (let i = 0; i < particleCount; i++) {
    const angle = (i / particleCount) * Math.PI * 2;
    const elevation = (Math.random() - 0.5) * Math.PI * 0.5;

    const horizontalRadius = Math.cos(elevation);
    const velocity: J.Vec3 = [
      Math.cos(angle) * horizontalRadius * (3 + Math.random() * 3),
      8 + Math.random() * 6,
      Math.sin(angle) * horizontalRadius * (3 + Math.random() * 3),
    ];

    const randomQuat = J.quat.random([0, 0, 0, 1]);
    addEffect(
      SPHERE,
      [0.3 + Math.random() * 0.4, 0, 0, 1],
      [0.1 + Math.random() * 0.4, 0, 0, 1],
      1,
      1,
      Math.random() * 0.5 + 0.5,
      0,
      velocity,
      [0, -30, 0],
      position,
      randomQuat,
      randomQuat,
      1
    );
  }
}
