import * as J from "jamango";
import { RespawnerTrait, PlayerTrait } from "../traits";
import { RespawnCommand } from "../commands";

let spawnPositions: J.Vec3[] = [];

export function killPlayer(playerId: J.EntityId): void {
  J.setCharacterAlive(playerId, false);

  const playerTrait = J.getTrait(playerId, PlayerTrait);
  if (playerTrait) {
    J.setTrait(playerId, PlayerTrait, {
      ...playerTrait,
      deathCount: playerTrait.deathCount + 1,
      respawnTime: J.getWorldTime() + 5,
      killStreak: 0, // Reset kill streak on death
    });
  }
}

export function spawnPlayer(playerId: J.EntityId, fromRespawn: boolean = true) {
  if (fromRespawn && spawnPositions.length === 0) return;

  // Initialize trait if it doesn't exist
  const existingTrait = J.getTrait(playerId, PlayerTrait);
  if (!existingTrait) {
    // Get player name from peers system, fallback to "Unknown" if unavailable
    const playerName = J.getPlayerUsername(playerId) || "Unknown";

    J.setTrait(playerId, PlayerTrait, {
      kills: 0,
      deathCount: 0,
      respawnTime: 0,
      arrowCount: 3,
      maxArrows: 3,
      lastKillTime: 0,
      name: playerName,
      killStreak: 0,
    });
  }

  let bestSpawnPosition: J.Vec3 | null = null;

  if (fromRespawn) {
    const allPlayers = J.getAllWithTraits([PlayerTrait]);
    const livingPlayers: J.EntityId[] = [];

    for (const [id, _] of allPlayers) {
      if (id !== playerId && J.getCharacterAlive(id)) {
        livingPlayers.push(id);
      }
    }

    let bestMinDistance = -1;

    for (const spawnPos of spawnPositions) {
      let minDistanceToAnyPlayer = Infinity;

      for (const livingPlayerId of livingPlayers) {
        const playerPos = J.getEntityPosition(livingPlayerId)!;
        const distance = J.vec3.distance(spawnPos, playerPos);
        minDistanceToAnyPlayer = Math.min(minDistanceToAnyPlayer, distance);
      }

      if (minDistanceToAnyPlayer > bestMinDistance) {
        bestMinDistance = minDistanceToAnyPlayer;
        bestSpawnPosition = spawnPos;
      }
    }

    if (!bestSpawnPosition) {
      bestSpawnPosition = spawnPositions[0];
    }
  }

  J.setCharacterAlive(playerId, true);

  const playerTrait = J.getTrait(playerId, PlayerTrait);
  if (playerTrait) {
    J.setTrait(playerId, PlayerTrait, {
      ...playerTrait,
      arrowCount: 3,
    });
  }

  if (fromRespawn && bestSpawnPosition) {
    J.net.sendToAll(RespawnCommand, { playerId, position: bestSpawnPosition });
  }
  J.setPlayerPermissions(playerId, {
    canFly: false,
    canForceRespawn: false,
    canUseIndividualBlocks: false,
  });
  J.setCharacterMovementProperties(playerId, {
    walkSpeed: 7,
    canSprint: true,
    sprintSpeedMultiplier: 1.3,
    airAcceleration: 5,
    maxHorizontalSpeedMultiplier: 6,
    airFriction: 0.1,
  });
  return bestSpawnPosition;
}

J.onGameStart(() => {
  const respawners = J.getAllWithTraits([RespawnerTrait]);
  spawnPositions = [];

  for (const [id, _] of respawners) {
    const position = J.getEntityPosition(id)!;
    spawnPositions.push([position[0], position[1], position[2]]);
  }
});
