import * as J from "jamango";

let cameraZoomTarget: J.EntityId | null = null;
let deathCameraStartTime = 0;
let smoothedKillerPos: J.Vec3 | null = null;
let initialViewRay: { origin: J.Vec3; direction: J.Vec3 } | null = null;

export function setCameraZoomTarget(targetId: J.EntityId | null) {
  cameraZoomTarget = targetId;
  if (targetId) {
    deathCameraStartTime = J.getWorldTime();
    smoothedKillerPos = null;
    const victimId = J.getLocalPlayer();
    initialViewRay = victimId ? J.getCharacterViewRay(victimId) : null;
  }
}

J.onGameTick((_, t) => {
  if (!cameraZoomTarget || !initialViewRay) return;

  const victimId = J.getLocalPlayer();
  if (!victimId) return;

  const victimPos = J.getEntityPosition(victimId);
  const killerPos = J.getEntityPosition(cameraZoomTarget);
  if (!victimPos || !killerPos) {
    return;
  }

  // Initialize smoothed position on first frame
  if (!smoothedKillerPos) {
    smoothedKillerPos = [...killerPos];
  }

  // Smoothly lerp towards the killer's current position
  const smoothSpeed = 0.1;
  J.vec3.lerp(smoothedKillerPos, smoothedKillerPos, killerPos, smoothSpeed);

  const elapsed = t - deathCameraStartTime;

  const movePhase = Math.min(1, elapsed / 2);
  const smoothPhase = movePhase * movePhase * (3 - 2 * movePhase);

  const dirToKiller = J.vec3.subtract([0, 0, 0], smoothedKillerPos, victimPos);
  dirToKiller[1] = 0;
  J.vec3.normalize(dirToKiller, dirToKiller);
  const oppositeDir = J.vec3.negate([0, 0, 0], dirToKiller);

  const finalPos: J.Vec3 = [
    victimPos[0] + oppositeDir[0] * 3,
    victimPos[1] + 1.6 + 3,
    victimPos[2] + oppositeDir[2] * 3,
  ];
  const cameraPos = J.vec3.lerp([0, 0, 0], initialViewRay.origin, finalPos, smoothPhase);

  const dirToTarget = J.vec3.subtract([0, 0, 0], smoothedKillerPos, cameraPos);
  J.vec3.normalize(dirToTarget, dirToTarget);
  const finalDir = J.vec3.lerp([0, 0, 0], initialViewRay.direction, dirToTarget, smoothPhase);

  const targetPos = J.vec3.add([0, 0, 0], cameraPos, finalDir);

  const viewMatrix = J.mat4.create();
  const worldMatrix = J.mat4.create();
  const quat = J.quat.create();
  const up: J.Vec3 = [0, 1, 0];

  J.mat4.lookAt(viewMatrix, cameraPos, targetPos, up);
  J.mat4.invert(worldMatrix, viewMatrix);
  J.mat4.getRotation(quat, worldMatrix);
  J.setCameraFree(cameraPos, quat);
});
