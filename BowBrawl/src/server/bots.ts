import * as J from "jamango";
import { PlayerTrait, PickupTrait } from "../traits";
import { ArrowCommand } from "../commands";
import { spawnPlayer } from "./respawn";

const MAX_BOTS = 3;
const BOT_LIFETIME_MIN = 200;
const BOT_LIFETIME_MAX = 300;
const BOT_THINK_INTERVAL = 0.7;
const BOT_SHOOT_COOLDOWN = 3.0;
const BOT_STUCK_THRESHOLD = 5.0;
const BOT_PROGRESS_THRESHOLD = 0.1;
const BOT_IDLE_DURATION_MIN = 0.5;
const BOT_IDLE_DURATION_MAX = 2;

const BOT_NAMES = [
  "Arrow Dodger",
  "Arcs Daddy",
  "Bullseye Bobby",
  "Captain Quiver",
  "The Fletcher",
  "Arrow McArrowface",
  "Sharpshooter Steve",
  "Legolas",
  "Quiver Kid",
  "Sniper Elf",
  "Straight Shooter",
  "Pointy Boi",
  "Bowboy 420",
  "Arc",
  "Mid Madonna",
  "Based Bowman",
  "Delulu Dan",
  "OP Bow Enjoyer",
  "Arrow Diff",
  "Skitz's Future",
];

// Randomly choose between available bot avatars
const botAvatars = [
  J.assets.avatars.SquireBot.id,
  J.assets.avatars.SkeletonBot.id,
  J.assets.avatars.Maid.id,
  J.assets.avatars.Babe.id,
  J.assets.avatars.Wizard.id,
  J.assets.avatars.Turtes.id,
];

type BotState = {
  lastThinkTime: number;
  currentTargetPickup: J.EntityId | null;
  lastShootTime: number;
  currentPath: J.Vec3[];
  currentPathStart: J.Vec3;
  currentPathGoal: J.Vec3;
  lastDistanceToGoal: number;
  lastDistanceDecreaseTime: number;
  idleUntilTime: number;
  spawnTime: number;
  leaveTime: number;
};

const botStates = new Map<J.EntityId, BotState>();
const botIds = new Set<J.EntityId>();
let lastBotCountCheckTime = 0;

function createBot(): J.EntityId | null {
  const avatarId = botAvatars[Math.floor(Math.random() * botAvatars.length)];
  const botId = J.spawnCharacter(avatarId);

  // Give bot a funny name
  const botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];

  J.setTrait(botId, PlayerTrait, {
    kills: 0,
    killStreak: 0,
    deathCount: 0,
    respawnTime: 0,
    arrowCount: 3,
    maxArrows: 3,
    lastKillTime: 0,
    name: botName,
  });

  const currentTime = J.getWorldTime();
  const lifetime =
    BOT_LIFETIME_MIN + Math.random() * (BOT_LIFETIME_MAX - BOT_LIFETIME_MIN);

  botStates.set(botId, {
    lastThinkTime: 0,
    currentTargetPickup: null,
    lastShootTime: 0,
    currentPath: [],
    currentPathStart: [0, 0, 0],
    currentPathGoal: [0, 0, 0],
    lastDistanceToGoal: Infinity,
    lastDistanceDecreaseTime: 0,
    idleUntilTime: 0,
    spawnTime: currentTime,
    leaveTime: currentTime + lifetime,
  });

  botIds.add(botId);

  return botId;
}

function removeBot(botId: J.EntityId): void {
  botStates.delete(botId);
  botIds.delete(botId);
  J.removeEntity(botId);
}

function findNearestPickup(botId: J.EntityId): J.EntityId | null {
  const botPos = J.getEntityPosition(botId);
  if (!botPos) return null;

  const allPickups = J.getAllWithTraits([PickupTrait]);
  let nearestPickup: J.EntityId | null = null;
  let nearestDistance = Infinity;

  for (const [id, _] of allPickups) {
    const pickupPos = J.getEntityPosition(id);
    if (!pickupPos) continue;

    const distance = J.vec3.distance(botPos, pickupPos);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestPickup = id;
    }
  }

  return nearestPickup;
}

function findRandomPickup(): J.EntityId | null {
  const allPickups = J.getAllWithTraits([PickupTrait]);
  const pickupArray = Array.from(allPickups);

  if (pickupArray.length === 0) return null;

  const randomIndex = Math.floor(Math.random() * pickupArray.length);
  return pickupArray[randomIndex][0];
}

function findNearestEnemy(botId: J.EntityId): J.EntityId | null {
  const botPos = J.getEntityPosition(botId);
  if (!botPos) return null;

  const allPlayers = J.getAllWithTraits([PlayerTrait]);
  let nearestEnemy: J.EntityId | null = null;
  let nearestDistance = Infinity;

  for (const [id, _] of allPlayers) {
    if (id === botId || !J.getCharacterAlive(id)) continue;

    const enemyPos = J.getEntityPosition(id);
    if (!enemyPos) continue;

    const distance = J.vec3.distance(botPos, enemyPos);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestEnemy = id;
    }
  }

  return nearestEnemy;
}

function updateBotAI(botId: J.EntityId, t: number): void {
  const state = botStates.get(botId);
  if (!state) return;

  const isAlive = J.getCharacterAlive(botId);
  if (!isAlive) {
    state.currentTargetPickup = null;
    J.clearCharacterMoveTarget(botId);
    J.clearCharacterLookAtTarget(botId);
    return;
  }

  const botPos = J.getEntityPosition(botId);
  if (!botPos) return;

  if (t - state.lastThinkTime < BOT_THINK_INTERVAL) return;
  state.lastThinkTime = t;

  // Check for nearby enemies to shoot at
  const nearestEnemy = findNearestEnemy(botId);
  if (nearestEnemy) {
    const enemyViewRay = J.getCharacterViewRay(nearestEnemy);
    if (enemyViewRay) {
      const enemyViewPos = enemyViewRay.origin;
      const distance = J.vec3.distance(botPos, enemyViewPos);

      // Check if there's a clear line of sight to the enemy
      const viewRay = J.getCharacterViewRay(botId);
      if (!viewRay) {
        return;
      }

      const directionToEnemy = J.vec3.normalize(
        [0, 0, 0],
        J.vec3.subtract([0, 0, 0], enemyViewPos, viewRay.origin)
      );

      // Start raycast 2 units away from bot to avoid hitting bot's own collider
      const rayStart = J.vec3.add(
        [0, 0, 0],
        viewRay.origin,
        J.vec3.scale([0, 0, 0], directionToEnemy, 2)
      );

      const raycastResult = J.raycast(rayStart, directionToEnemy, 200);

      const hasLineOfSight =
        !raycastResult.hit || raycastResult.hitEntityId === nearestEnemy;

      // Always look at the enemy
      // Calculate aim point with upward compensation based on distance
      const randomOffset = (1 + Math.random()) * -2; // Random offset between -2 and 0

      // configurable arrow speed (m/s) depending on bow type
      const draw = 0.7 + Math.random() * 0.3; // Draw between 0.7 and 1.0
      const arrowSpeed = 50 * draw * 1.5;
      const g = 9.81; // gravity (m/s^2)
      const time = distance / arrowSpeed; // time to reach target
      const drop = 0.5 * g * time * time; // how much the arrow drops in that time

      const aimTarget: J.Vec3 = [
        enemyViewPos[0],
        enemyViewPos[1] + drop + randomOffset,
        enemyViewPos[2],
      ];

      J.setCharacterLookAtTarget(botId, aimTarget);

      // Occasionally crouch (20% chance)
      if (Math.random() < 0.2) {
        J.setCharacterCrouching(botId, true);
      } else {
        J.setCharacterCrouching(botId, false);
      }
      if (hasLineOfSight) {
        // Try to shoot if cooldown is ready
        if (t - state.lastShootTime >= BOT_SHOOT_COOLDOWN) {
          // Set precise aim target right before shooting
          const playerTrait = J.getTrait(botId, PlayerTrait);
          if (playerTrait && playerTrait.arrowCount > 0) {
            const viewRay = J.getCharacterViewRay(botId);
            if (viewRay) {
              const netId = Math.floor(Math.random() * 2147483647);

              J.net.sendToAll(ArrowCommand, {
                viewRay,
                draw,
                ownerId: botId,
                netId,
              });
              J.setTrait(botId, PlayerTrait, {
                ...playerTrait,
                arrowCount: playerTrait.arrowCount - 1,
              });
              state.lastShootTime = t;

              // Occasionally go idle after shooting (30% chance)
              if (Math.random() < 0.3) {
                const idleDuration =
                  Math.random() *
                    (BOT_IDLE_DURATION_MAX - BOT_IDLE_DURATION_MIN) +
                  BOT_IDLE_DURATION_MIN;
                state.idleUntilTime = t + idleDuration;
              }
            }
          }
        }
      } else {
        J.setCharacterCrouching(botId, false);
      }
    }
  } else {
    J.setCharacterCrouching(botId, false);
  }

  // If bot is idle, don't move
  if (t < state.idleUntilTime) {
    J.clearCharacterMoveTarget(botId);
    return;
  }

  if (state.currentTargetPickup !== null) {
    const targetPos = J.getEntityPosition(state.currentTargetPickup);

    if (!targetPos) {
      state.currentTargetPickup = null;
      state.currentPath = [];
      state.lastDistanceToGoal = Infinity;
    } else {
      const currentDistance = J.vec3.distance(botPos, targetPos);

      if (currentDistance < state.lastDistanceToGoal - BOT_PROGRESS_THRESHOLD) {
        state.lastDistanceToGoal = currentDistance;
        state.lastDistanceDecreaseTime = t;
      }

      if (t - state.lastDistanceDecreaseTime < BOT_STUCK_THRESHOLD) {
        return;
      }

      state.lastDistanceToGoal = Infinity;
      state.lastDistanceDecreaseTime = t;
    }
  }

  // Check bot's arrow count to decide pickup strategy
  const playerTrait = J.getTrait(botId, PlayerTrait);
  const hasMaxArrows = playerTrait && playerTrait.arrowCount === 3;

  // If bot has 3 arrows, pick a random pickup; otherwise go for nearest
  const targetPickup = hasMaxArrows
    ? findRandomPickup()
    : findNearestPickup(botId);
  if (!targetPickup) {
    J.clearCharacterMoveTarget(botId);
    J.clearCharacterLookAtTarget(botId);
    state.currentPath = [];
    return;
  }

  const pickupPos = J.getEntityPosition(targetPickup);
  if (!pickupPos) return;

  const pathStart: J.Vec3 = [
    Math.round(botPos[0] - 0.5),
    Math.round(botPos[1]),
    Math.round(botPos[2] - 0.5),
  ];
  const pathGoal: J.Vec3 = [
    Math.round(pickupPos[0] - 0.5),
    Math.floor(pickupPos[1] - 1),
    Math.round(pickupPos[2] - 0.5),
  ];

  const pathResult = J.findPath(pathStart, pathGoal, 1000);
  if (!pathResult.success || pathResult.path.length === 0) {
    state.currentPath = [];
    state.currentPathStart = pathStart;
    state.currentPathGoal = pathGoal;
    return;
  }

  const adjustedPath: J.Vec3[] = pathResult.path.map((waypoint) => [
    waypoint[0] + 0.5,
    waypoint[1] + 0.2,
    waypoint[2] + 0.5,
  ]);

  state.currentTargetPickup = targetPickup;
  state.currentPath = adjustedPath;
  state.currentPathStart = pathStart;
  state.currentPathGoal = pathGoal;
  state.lastDistanceToGoal = J.vec3.distance(botPos, pickupPos);
  state.lastDistanceDecreaseTime = t;

  // Only look at pickup if no enemy is present
  if (!findNearestEnemy(botId)) {
    J.setCharacterLookAtTarget(botId, pickupPos);
  }
  J.setCharacterMoveTarget(botId, adjustedPath);
}

function maintainBotCount(): void {
  const currentTime = J.getWorldTime();

  // Remove bots that have exceeded their lifetime
  for (const botId of botIds) {
    const state = botStates.get(botId);
    if (state && currentTime >= state.leaveTime) {
      removeBot(botId);
    }
  }

  // Always maintain exactly MAX_BOTS bots
  const currentBotCount = botIds.size;

  if (currentBotCount < MAX_BOTS) {
    // Spawn more bots to reach MAX_BOTS
    const botsToSpawn = MAX_BOTS - currentBotCount;
    for (let i = 0; i < botsToSpawn; i++) {
      const botId = createBot();
      if (botId) {
        const pos = spawnPlayer(botId)!;
        J.setEntityPosition(botId, pos);
      }
    }
  }
}

console.log("updated")
// Update bot AI every tick
J.onGameTick((_, t) => {
  if (t - lastBotCountCheckTime >= 1.0) {
    maintainBotCount();
    lastBotCountCheckTime = t;
  }

  for (const botId of botIds) {
    updateBotAI(botId, t);
  }
});
