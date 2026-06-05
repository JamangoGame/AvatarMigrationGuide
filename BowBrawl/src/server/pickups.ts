import * as J from "jamango";
import { PickupSpawnerTrait, PickupTrait, PlayerTrait } from "../traits";
import { PickupCommand, ItemSpawnCommand } from "../commands";

function spawnPickup(
  spawnerId: J.EntityId,
  position: J.Vec3,
  spawnerData: { spawnedItemId: number; dryTime: number },
  sendCommand: boolean = true
): void {
  const pickup = J.spawnProp(J.assets.props["Arrow"].id);
  position[1] += 1;
  J.setEntityPosition(pickup, position, false);
  J.setEntityScale(pickup, 0.15);
  J.setTrait(pickup, PickupTrait, {});

  J.setTrait(spawnerId, PickupSpawnerTrait, {
    ...spawnerData,
    spawnedItemId: pickup,
    dryTime: 0,
  });

  if (sendCommand) {
    J.net.sendToAll(ItemSpawnCommand, { position });
  }
}

J.onGameStart(() => {
  const spawners = J.getAllWithTraits([PickupSpawnerTrait]);

  for (const [id, data] of spawners) {
    const position = J.getEntityPosition(id)!;
    spawnPickup(id, position, data, false);
  }
});

J.onGameTick((_, t) => {
  const spawners = J.getAllWithTraits([PickupSpawnerTrait]);

  for (const [spawnerId, spawnerData] of spawners) {
    // Check if the spawned item still exists
    const itemExists =
      spawnerData.spawnedItemId !== -1 &&
      J.getTrait(spawnerData.spawnedItemId, PickupTrait);

    if (!itemExists && spawnerData.spawnedItemId !== -1) {
      // Item was picked up, mark as dry
      if (spawnerData.dryTime === 0) {
        J.setTrait(spawnerId, PickupSpawnerTrait, {
          ...spawnerData,
          dryTime: t,
          spawnedItemId: -1,
        });
      }
    } else if (spawnerData.dryTime > 0 && t - spawnerData.dryTime >= 10) {
      // Been dry for 10 seconds, spawn a new pickup
      const position = J.getEntityPosition(spawnerId)!;
      spawnPickup(spawnerId, position, spawnerData);
    }
  }
});

J.onEntityCollisionPersisted(
  { source: [PlayerTrait], target: [PickupTrait] },
  (playerId, pickupId) => {
    const playerTrait = J.getTrait(playerId, PlayerTrait);
    if (!playerTrait) return;

    if (playerTrait.arrowCount >= playerTrait.maxArrows) return;

    const pickupPosition = J.getEntityPosition(pickupId);
    if (!pickupPosition) return;

    J.setTrait(playerId, PlayerTrait, {
      ...playerTrait,
      arrowCount: playerTrait.arrowCount + 1,
    });

    J.removeEntity(pickupId);

    J.net.sendToAll(PickupCommand, {
      playerId,
      pickupPosition,
    });
  }
);
