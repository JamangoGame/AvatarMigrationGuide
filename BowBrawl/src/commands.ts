import * as J from "jamango";

export const ArrowCommand = J.net.defineCommand<{
  viewRay: { origin: J.Vec3; direction: J.Vec3 };
  draw: number;
  ownerId: J.EntityId;
  netId: number;
}>("arrow");

export const HitCommand = J.net.defineCommand<{
  attackerId: J.EntityId;
  victimId: J.EntityId;
  position: J.Vec3;
  netId: number;
}>("hit");

export const RespawnCommand = J.net.defineCommand<{
  playerId: J.EntityId;
  position: J.Vec3;
}>("respawn");

export const PickupCommand = J.net.defineCommand<{
  playerId: J.EntityId;
  pickupPosition: J.Vec3;
}>("pickup");

export const ItemSpawnCommand = J.net.defineCommand<{
  position: J.Vec3;
}>("itemSpawn");

export const EnvironmentalDeathCommand = J.net.defineCommand<{
  victimId: J.EntityId;
  reason: string;
}>("environmentalDeath");
