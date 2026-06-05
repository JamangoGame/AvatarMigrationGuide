import * as J from "jamango";
import { PickupTrait } from "../traits";
import { PickupCommand, ItemSpawnCommand } from "../commands";
import { addEffect, SPHERE } from "./effects";

const pickupBasePositions = new Map<J.EntityId, number>();
const pickupLastParticleTime = new Map<J.EntityId, number>();

J.onGameTick((_, time) => {
  const pickups = J.getAllWithTraits([PickupTrait]);

  for (const [pickupId, _] of pickups) {
    const pos = J.getEntityPosition(pickupId);
    if (!pos) continue;

    if (!pickupBasePositions.has(pickupId)) {
      pickupBasePositions.set(pickupId, pos[1]);
    }

    const baseY = pickupBasePositions.get(pickupId)!;

    const offset = pos[0] * 0.3 + pos[2] * 0.2;
    const hoverHeight = 0.35;
    const hoverSpeed = 4.5;
    const newY = baseY + Math.sin(time * hoverSpeed + offset) * hoverHeight;

    J.setEntityPosition(pickupId, [pos[0], newY, pos[2]]);

    const rotationSpeed = 1.5;
    const spinAngle = time * rotationSpeed;
    const rotation = J.quat.create();
    J.quat.fromEuler(rotation, [Math.PI / 2, 0, spinAngle]);
    J.setEntityQuaternion(pickupId, rotation);

    const glowIntensity = (Math.sin(time * 3 + offset) + 1) / 2;
    J.setEntityGlow(pickupId, glowIntensity);

    // Spawn particles around pickup (only if within 20 units of local player)
    const localPlayer = J.getLocalPlayer();
    const localPlayerPos = localPlayer ? J.getEntityPosition(localPlayer) : null;
    if (!localPlayerPos) continue;

    const dx = pos[0] - localPlayerPos[0];
    const dy = pos[1] - localPlayerPos[1];
    const dz = pos[2] - localPlayerPos[2];
    const distSq = dx * dx + dy * dy + dz * dz;
    if (distSq > 30 * 30) continue;

    const lastParticleTime = pickupLastParticleTime.get(pickupId) || 0;
    const particleInterval = 0.5; // 2 particles per second

    if (time - lastParticleTime >= particleInterval) {
      pickupLastParticleTime.set(pickupId, time);

      // Random position around the pickup
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.3 + Math.random() * 0.2;
      const particlePos: J.Vec3 = [
        pos[0] + Math.cos(angle) * radius,
        newY - 0.3,
        pos[2] + Math.sin(angle) * radius,
      ];

      // Random rotation
      const randomQuat = J.quat.random([0, 0, 0, 1]);

      // Green glowy color
      const greenTint: [number, number, number, number] = [0.2, 1, 0.3, 1];
      const fadeTint: [number, number, number, number] = [0.2, 1, 0.3, 0];

      addEffect(
        SPHERE,
        greenTint,
        fadeTint,
        1.5, // Start glow
        0,   // End glow
        0.15, // Start scale
        0.05, // End scale
        [0, 1.2, 0], // Velocity - float upward
        [0, 0, 0], // No acceleration
        particlePos,
        randomQuat,
        randomQuat,
        1.5 // Duration
      );
    }
  }
});

J.net.listen(PickupCommand, (data) => {
  const localPlayerId = J.getLocalPlayer();

  if (data.playerId === localPlayerId) {
    J.playSound(J.assets.audio.src_assets_audio_sfx_collectarrow.id, {
      volume: 0.7,
    });
  } else {
    J.playSoundAtPosition(
      J.assets.audio.src_assets_audio_sfx_collectarrow.id,
      data.pickupPosition,
      { volume: 1 }
    );
  }
});

J.net.listen(ItemSpawnCommand, (data) => {
  J.playSoundAtPosition(
    J.assets.audio.src_assets_audio_sfx_itemspawn.id,
    data.position,
    { volume: 0.8 }
  );
});
