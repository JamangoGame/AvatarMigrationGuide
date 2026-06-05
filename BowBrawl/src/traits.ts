import * as J from "jamango";

type PlayerTraitType = {
  kills: number;
  deathCount: number;
  respawnTime: number;
  arrowCount: number;
  maxArrows: number;
  lastKillTime: number;
  name: string;
  killStreak: number;
};

export const PlayerTrait = J.defineTrait(
  "Player",
  J.schema.any<PlayerTraitType>()
);

type DrawTraitType = {
  drawTime: number;
  releaseTime: number;
};

export const DrawTrait = J.defineTrait(
  "Draw",
  J.schema.any<DrawTraitType>()
);

type ArrowColliderTraitType = {
  wallBounce: number;
  ownerId: number;
};

export const ArrowColliderTrait = J.defineTrait(
  "ArrowCollider",
  J.schema.any<ArrowColliderTraitType>()
);

export const PickupSpawnerTrait = J.defineTrait(
  "PickupSpawner",
  J.schema.object({
    spawnedItemId: J.schema.number({ defaultValue: -1, hidden: true }),
    dryTime: J.schema.number({ defaultValue: 0, hidden: true }),
  }),
  {
    name: "Pickup Spawner",
    description: "Spawns collectible items at this location",
    color: "#FFD700",
    icon: "⭐",
  }
);

export const PickupTrait = J.defineTrait(
  "Pickup",
  J.schema.object({})
);

export const RespawnerTrait = J.defineTrait(
  "Respawner",
  J.schema.object({}),
  {
    name: "Player Respawner",
    description: "Marks this location as a player spawn point",
    color: "#00FF00",
    icon: "🔄",
  }
);
