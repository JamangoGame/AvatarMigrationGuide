import * as J from "jamango";
import { PlayerTrait, DrawTrait } from "../traits";
import {
  setBowFrame,
  initBow,
  removeBow,
  setBowFirstPersonDraw,
  clearBowFirstPersonDraw,
} from "./bow";
import { easeOutCubic } from "../utils";
import { spawnArrow } from "./arrow";
import {
  ArrowCommand,
  RespawnCommand,
  EnvironmentalDeathCommand,
} from "../commands";
import { setDeathMessage } from "./ui";
import { setCameraZoomTarget } from "./camera";
import { spawnPlayerDeathParticles } from "./particles";

function initPlayer(entityId: J.EntityId): void {
  // Initialize client-side draw state
  J.setTrait(entityId, DrawTrait, {
    drawTime: 0,
    releaseTime: 0,
  });
  // Initialize bow
  initBow(entityId);
}

const DEATH_ANIMATION = "locomotion_default_death";
// Seconds before a player respawns to hide their body (see syncCorpseVisibility).
const CORPSE_HIDE_LEAD = 1;
const lastAliveState = new Map<J.EntityId, boolean>();
const hiddenCorpses = new Set<J.EntityId>();

function syncDeathAnimation(id: J.EntityId): void {
  const alive = J.getCharacterAlive(id);
  const last = lastAliveState.get(id);
  if (last === alive) return;

  if (!alive) {
    J.characterPlayAnimation(id, DEATH_ANIMATION, {
      mode: "hold",
      speed: 0.8,
    });
    removeBow(id);
  } else if (last !== undefined) {
    J.characterStopAnimation(id, DEATH_ANIMATION, { fadeOut: 0.2 });
    initBow(id);
  }
  lastAliveState.set(id, alive);
}

// Make the body vanish ~CORPSE_HIDE_LEAD seconds before it respawns, so the
// teleport to the spawn point happens off-screen, then reveal it standing at the
// spawn. `respawnAt > t` means a real respawn is still pending (skips a stale
// respawnTime from a previous life). We re-assert the hidden state each tick so
// it wins over tickTutorial, which re-shows remote players every frame.
function syncCorpseVisibility(id: J.EntityId, respawnAt: number, t: number): void {
  if (hiddenCorpses.has(id)) {
    // Reveal once alive again, or if the pending respawn was cleared, so a hidden
    // body can never get stuck invisible; otherwise keep it hidden.
    if (J.getCharacterAlive(id) || respawnAt <= 0) {
      hiddenCorpses.delete(id);
      J.setEntityVisible(id, true);
    } else {
      J.setEntityVisible(id, false);
    }
    return;
  }

  if (!J.getCharacterAlive(id) && respawnAt > t && t >= respawnAt - CORPSE_HIDE_LEAD) {
    // Settle out of the death pose while hidden so it reappears cleanly standing.
    J.characterStopAnimation(id, DEATH_ANIMATION, { fadeOut: 0.2 });
    J.setEntityVisible(id, false);
    hiddenCorpses.add(id);
  }
}

J.onPlayerLeave((id) => {
  lastAliveState.delete(id);
  hiddenCorpses.delete(id);
});

export function handlePlayerDeath(
  victimId: J.EntityId,
  position: J.Vec3,
  killerId?: J.EntityId
): void {
  J.playSoundAtPosition(
    J.assets.audio.src_assets_audio_sfx_damage.id,
    position,
    { volume: 1 }
  );
  spawnPlayerDeathParticles(position);

  const localPlayerId = J.getLocalPlayer();
  if (victimId === localPlayerId && killerId !== undefined) {
    setCameraZoomTarget(killerId);
  }
}

J.onCharacterUse({ character: [PlayerTrait] }, (id, primary) => {
  if (!primary) return;

  const playerTrait = J.getTrait(id, PlayerTrait);
  if (!playerTrait || playerTrait.arrowCount <= 0) {
    return;
  }

  const drawState = J.getTrait(id, DrawTrait);
  if (drawState && drawState.drawTime === 0) {
    J.setTrait(id, DrawTrait, { drawTime: J.getWorldTime(), releaseTime: 0 });

    const localPlayerId = J.getLocalPlayer();
    if (id === localPlayerId) {
      J.playSound(J.assets.audio.bow_draw.id, { volume: 0.2 });
    } else {
      const playerPos = J.getEntityPosition(id);
      if (playerPos) {
        J.playSoundAtPosition(J.assets.audio.bow_draw.id, playerPos, {
          volume: 0.2,
        });
      }
    }
  }
});

J.onCharacterUnuse({ character: [PlayerTrait] }, (id) => {
  const drawState = J.getTrait(id, DrawTrait);
  if (drawState && drawState.drawTime > 0) {
    const draw = Math.min(1, J.getWorldTime() - drawState.drawTime);
    J.setTrait(id, DrawTrait, { drawTime: 0, releaseTime: J.getWorldTime() });

    const localPlayerId = J.getLocalPlayer();
    // only if local player do we spawn the arrow here
    if (localPlayerId === id) {
      const playerTrait = J.getTrait(id, PlayerTrait);
      if (!playerTrait || playerTrait.arrowCount <= 0) {
        return;
      }

      // Decrement arrow count locally to prevent double shots from latency
      J.setTrait(id, PlayerTrait, {
        ...playerTrait,
        arrowCount: playerTrait.arrowCount - 1,
      });

      J.playSound(J.assets.audio.bow_release.id, {
        volume: 1 + draw * 0.3,
        detune: -900 + draw * 1200,
      });

      const viewRay = J.getCharacterViewRay(id);
      if (viewRay) {
        const netId = Math.floor(Math.random() * 2147483647);
        spawnArrow(viewRay, draw, id, netId);
        J.net.send(ArrowCommand, { viewRay, draw, ownerId: id, netId });
      }
    } else {
      const playerPos = J.getEntityPosition(id);
      if (playerPos) {
        J.playSoundAtPosition(J.assets.audio.bow_release.id, playerPos, {
          volume: 1 + draw * 0.3,
          detune: -900 + draw * 1200,
        });
      }
    }
  }
});

export function isInTutorialArea(id: J.EntityId): boolean {
  const pos = J.getEntityPosition(id);
  return pos !== null && pos[1] > 25;
}

function tickTutorial(
  id: J.EntityId,
  localPlayerId: J.EntityId,
  localInTutorial: boolean
) {
  // Local player always visible
  if (id === localPlayerId) return;

  if (localInTutorial && isInTutorialArea(id)) {
    // Both in tutorial area: hide other player
    J.setEntityVisible(id, false);
    removeBow(id);
  } else {
    // Otherwise: show other player
    J.setEntityVisible(id, true);
  }
}

function tickWhileAlive(
  id: J.EntityId,
  drawState: { drawTime: number; releaseTime: number },
  t: number
) {
  // Check for out of bounds
  const pos = J.getEntityPosition(id);
  if (pos && !J.isInWorldBounds(pos)) {
    setDeathMessage(
      `You 💀 died<br><span style="font-size: 32px;">fell out of bounds</span>`
    );
    J.net.send(EnvironmentalDeathCommand, {
      victimId: id,
      reason: "fell out of bounds",
    });
    J.setCharacterAlive(id, false);
    handlePlayerDeath(id, pos, id);
  }

  const rawDraw =
    drawState.drawTime > 0 ? Math.min(1, t - drawState.drawTime) : 0;
  const draw = easeOutCubic(rawDraw);
  const wobbling = drawState.releaseTime > 0;

  const drawElapsed = t - drawState.drawTime;
  const drawDecay = Math.exp(-18 * drawElapsed);
  const drawWobble = Math.sin(50 * drawElapsed) * drawDecay;

  const releaseElapsed = t - drawState.releaseTime;
  const releaseDecay = Math.exp(-18 * releaseElapsed);
  const releaseWobble = Math.sin(50 * releaseElapsed) * releaseDecay;

  const wobble = wobbling ? releaseWobble : drawWobble;

  const meshDraw = wobbling ? 1 : draw;
  setBowFrame(id, meshDraw > 0 ? Math.round(1 + meshDraw * 3) : 0);

  if (drawState.drawTime > 0 || wobbling) {
    const hold = wobbling ? 1 : draw;

    setBowFirstPersonDraw(id, hold, wobble);

    if (wobbling && releaseDecay < 0.01) {
      J.setTrait(id, DrawTrait, { ...drawState, releaseTime: 0 });
      clearBowFirstPersonDraw(id);
    }
  }

  const velocity = J.getEntityVelocity(id) || [0, 0, 0];
  const speed = J.vec3.length(velocity);
  const accuracy = Math.max(0, draw - speed * 0.03);

  J.setCrosshair(true, 50 - 45 * accuracy + wobble * 30);
}

function tickWhileDead(
  id: J.EntityId,
  drawState: { drawTime: number; releaseTime: number }
) {
  J.setCrosshair(false);

  // Reset draw state while dead to prevent shooting on respawn
  if (drawState.drawTime > 0 || drawState.releaseTime > 0) {
    J.setTrait(id, DrawTrait, { drawTime: 0, releaseTime: 0 });
    clearBowFirstPersonDraw(id);
  }
}

J.onGameTick((_, t) => {
  const localPlayerId = J.getLocalPlayer();
  const localInTutorial = isInTutorialArea(localPlayerId);
  const players = J.getAllWithTraits([PlayerTrait]);

  for (const [id, playertrait] of players) {
    const isLocalPlayer = id === localPlayerId;
    const drawState = J.getTrait(id, DrawTrait);
    if (!drawState) {
      initPlayer(id);
      continue;
    }

    tickTutorial(id, localPlayerId, localInTutorial);
    syncDeathAnimation(id);
    // Hide the body just before it respawns so the teleport to spawn isn't seen.
    syncCorpseVisibility(id, playertrait.respawnTime ?? 0, t);

    if (isLocalPlayer) {
      const isAlive = J.getCharacterAlive(id);

      if (isAlive) {
        tickWhileAlive(id, drawState, t);
      } else {
        tickWhileDead(id, drawState);
      }
    } else {
      if (!J.getCharacterAlive(id)) continue;
      const rawDraw =
        drawState.drawTime > 0 ? Math.min(1, t - drawState.drawTime) : 0;
      const draw = easeOutCubic(rawDraw);
      const wobbling = drawState.releaseTime > 0;
      const meshDraw = wobbling ? 1 : draw;
      setBowFrame(id, meshDraw > 0 ? Math.round(1 + meshDraw * 3) : 0);
    }
  }
});

J.net.listen(RespawnCommand, (data, senderId) => {
  const localPlayerId = J.getLocalPlayer();
  if (data.playerId === localPlayerId) {
    J.setEntityPosition(localPlayerId, data.position, false);
    setCameraZoomTarget(null);
    J.setLocalPlayerCamera(["firstPerson"]);
  }
});
