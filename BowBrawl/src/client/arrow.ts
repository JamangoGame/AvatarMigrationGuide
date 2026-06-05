import * as J from "jamango";
import { ArrowColliderTrait, PlayerTrait } from "../traits";
import { quatFromDirection } from "../utils";
import { ArrowCommand, HitCommand, RespawnCommand } from "../commands";
import { handlePlayerDeath, isInTutorialArea } from "./player";
import { playBowReleaseAnim } from "./bow";
import {
  spawnArrowReflectionParticles,
  spawnArrowTrailParticle,
} from "./particles";

type ArrowEntry = {
  arrow: J.EntityId;
  draw: number;
  ownerId: J.EntityId;
  netId: number;
  stuckPos: J.Vec3;
  stuckDir: J.Vec3;
  stuckTime: number;
  lastEffectTime: number;
  spawnTime: number;
};

const arrows = new Map<J.EntityId, ArrowEntry>();
const arrowsHit = new Set<J.EntityId>();
const arrowBounds = J.assets.props["Arrow"].bounds;
const arrowSize = 0.2;

const arrowOffset = (arrowBounds.z / 2) * arrowSize;

function deleteArrow(netId: number) {
  for (const [coll, entry] of arrows) {
    if (entry.netId === netId) {
      J.removeEntity(coll);
      J.removeEntity(entry.arrow);
      arrows.delete(coll);
      arrowsHit.delete(coll);
      return;
    }
  }
}

function updateArrowTransform(
  entry: ArrowEntry,
  pos: J.Vec3,
  dir: J.Vec3,
  wobble: number
) {
  const wobbledDir: J.Vec3 = [dir[0] + wobble, dir[1] + wobble, dir[2]];
  J.vec3.normalize(wobbledDir, wobbledDir);

  const offset = J.vec3.scale([0, 0, 0], wobbledDir, arrowOffset);
  const arrowPos = J.vec3.subtract([0, 0, 0], pos, offset);

  const rot = quatFromDirection(
    [0, 0, 0, 1],
    J.vec3.negate([0, 0, 0], wobbledDir)
  );

  J.setEntityPosition(entry.arrow, arrowPos);
  J.setEntityQuaternion(entry.arrow, rot);
}

export function spawnArrow(
  viewRay: { origin: J.Vec3; direction: J.Vec3 },
  draw: number,
  ownerId: J.EntityId,
  netId: number
) {
  playBowReleaseAnim(ownerId);

  const spawnPos = J.vec3.add([0, 0, 0], viewRay.origin, viewRay.direction);
  const speed = 50 * (0.5 + draw);
  const vel = J.vec3.scale([0, 0, 0], viewRay.direction, speed);

  const coll = J.spawnProp(J.assets.props["Arrow Hit Sphere"].id);
  J.setEntityPosition(coll, spawnPos);
  J.setEntityVelocity(coll, vel);
  J.setEntityVisible(coll, false);
  J.setTrait(coll, ArrowColliderTrait, { wallBounce: 0, ownerId });

  const arrow = J.spawnProp(J.assets.props["Arrow"].id);
  J.setEntityScale(arrow, arrowSize);
  J.setEntityGlow(arrow, 0.5);

  const currentTime = J.getWorldTime();

  const entry: ArrowEntry = {
    arrow,
    draw,
    ownerId,
    netId,
    stuckPos: [0, 0, 0],
    stuckDir: [0, 0, 1],
    stuckTime: 0,
    lastEffectTime: currentTime + 0.1,
    spawnTime: currentTime,
  };
  arrows.set(coll, entry);
  updateArrowTransform(entry, spawnPos, viewRay.direction, 0);
}

J.onBlockCollisionStart(
  { target: [ArrowColliderTrait] },
  (pos, normal, blockType, entityId) => {
    const trait = J.getTrait(entityId, ArrowColliderTrait);
    if (trait) {
      // collide against wall and reduce bounce count
      trait.wallBounce++;
      J.setTrait(entityId, ArrowColliderTrait, trait);

      const entry = arrows.get(entityId);
      const baseDetune = entry ? entry.draw * 400 : 0;
      const detune = baseDetune - trait.wallBounce * 50;

      const collPos = J.getEntityPosition(entityId);
      if (collPos) {
        spawnArrowReflectionParticles(collPos, normal);
      }

      if (trait.wallBounce >= 4) {
        if (entry) {
          if (collPos) J.vec3.copy(entry.stuckPos, collPos);
          entry.stuckTime = J.getWorldTime();
          J.setEntityGlow(entry.arrow, 0);
          J.setEntityTint(entry.arrow, [0, 0, 0, 0.7]);
        }
        J.removeEntity(entityId);
        J.playSoundAtPosition(J.assets.audio.arrow_stuck.id, pos, {
          detune,
          volume: 2,
        });
      } else {
        J.playSoundAtPosition(J.assets.audio.arrow_reflect.id, pos, {
          volume: 2,
          detune,
        });
      }
    }
  }
);

J.onEntityCollisionStart(
  { source: [PlayerTrait], target: [ArrowColliderTrait] },
  (playerId, arrowId) => {
    // Early exit if this arrow has already hit something
    if (arrowsHit.has(arrowId)) return;

    const arrowTrait = J.getTrait(arrowId, ArrowColliderTrait);
    if (!arrowTrait) return;

    const isAlive = J.getCharacterAlive(playerId);
    if (!isAlive) return;

    const localPlayerId = J.getLocalPlayer();

    // Determine if arrow owner is a bot
    const isArrowOwnerBot = !J.getPlayerUsername(arrowTrait.ownerId);

    // Process hit if:
    // 1. Arrow owner is local player (you hit someone else, bot or player)
    // 2. OR victim is local player AND arrow owner is a bot (bot hit you)
    const shouldProcessHit =
      arrowTrait.ownerId === localPlayerId ||
      (playerId === localPlayerId && isArrowOwnerBot);
    if (!shouldProcessHit) return;

    const entry = arrows.get(arrowId);
    if (!entry) return;

    const arrowPos = J.getEntityPosition(arrowId);
    if (!arrowPos) return;

    const flightTime = J.getWorldTime() - entry.spawnTime;
    const isSuicide = arrowTrait.ownerId === playerId;

    // Ignore suicide arrows that have been in flight for less than 0.03s
    if (isSuicide && flightTime < 0.03) {
      return;
    }

    // Mark arrow as hit to prevent multiple hit detections
    arrowsHit.add(arrowId);

    // Only play hit sound if local player is the attacker
    if (arrowTrait.ownerId === localPlayerId && !isSuicide) {
      J.playSound(J.assets.audio.hit.id, { volume: 0.15 });
    }

    // Don't network hits in tutorial area
    if (isInTutorialArea(localPlayerId)) return;

    J.net.send(HitCommand, {
      attackerId: arrowTrait.ownerId,
      victimId: playerId,
      position: arrowPos,
      netId: entry.netId,
    });
  }
);

J.onGameTick(() => {
  const t = J.getWorldTime();

  const arrowsToDelete: J.EntityId[] = [];

  for (const [coll, entry] of arrows) {
    const { arrow, stuckPos, stuckDir, stuckTime } = entry;

    let pos: J.Vec3;
    let dir: J.Vec3;
    let wobble = 0;

    if (stuckTime > 0) {
      const elapsed = t - stuckTime;

      if (elapsed >= 10) {
        arrowsToDelete.push(coll);
        continue;
      }

      pos = stuckPos;
      dir = stuckDir;
      wobble = Math.sin(40 * elapsed) * Math.exp(-3 * elapsed) * 0.15;
    } else {
      const collPos = J.getEntityPosition(coll);
      const vel = J.getEntityVelocity(coll);
      if (!collPos || !vel) continue;
      pos = collPos;
      dir = J.vec3.normalize(entry.stuckDir, vel);

      if (t - entry.lastEffectTime >= 0.05) {
        entry.lastEffectTime = t;
        const tailOffset = J.vec3.scale(
          [0, 0, 0],
          dir,
          arrowBounds.z * arrowSize
        );
        const tailPos = J.vec3.subtract([0, 0, 0], pos, tailOffset);
        spawnArrowTrailParticle(tailPos);
      }
    }

    // Delete arrows that fall below y = -30
    if (pos[1] < -30) {
      arrowsToDelete.push(coll);
      continue;
    }

    updateArrowTransform(entry, pos, dir, wobble);
  }

  for (const coll of arrowsToDelete) {
    const entry = arrows.get(coll);
    if (entry) {
      J.removeEntity(entry.arrow);
      arrows.delete(coll);
      arrowsHit.delete(coll);
    }
  }
});

J.net.listen(ArrowCommand, (data, playerId) => {
  spawnArrow(data.viewRay, data.draw, data.ownerId, data.netId);
});

J.net.listen(HitCommand, (data, senderId) => {
  handlePlayerDeath(data.victimId, data.position, data.attackerId);
  deleteArrow(data.netId);
});

J.net.listen(RespawnCommand, (data, senderId) => {
  const playerPos = J.getEntityPosition(data.playerId);
  if (playerPos) {
    J.playSoundAtPosition(
      J.assets.audio.src_assets_audio_sfx_respawn.id,
      playerPos,
      { volume: 0.5 }
    );
  }
});
