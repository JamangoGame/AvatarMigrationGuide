import * as J from "jamango";
import { PlayerTrait } from "../traits";

J.onGameTick(() => {
  // Get all players with the Player trait
  const players = J.getAllWithTraits([PlayerTrait]);

  // Find the player with the highest kills
  let topPlayerId: J.EntityId | null = null;
  let maxKills = -1;

  for (const [playerId, trait] of players) {
    if (trait.kills > maxKills) {
      maxKills = trait.kills;
      topPlayerId = playerId;
    }
  }

  // Set nameplates
  for (const [playerId, trait] of players) {
    if (trait && trait.name) {
      const isTopPlayer = playerId === topPlayerId && maxKills > 0;
      const displayName = isTopPlayer ? `👑 ${trait.name}` : trait.name;
      const textColor: J.Vec3 = isTopPlayer ? [1, 0.843, 0] : [1, 1, 1]; // Gold or white
      J.setCharacterNameplate(playerId, true, textColor, displayName);
    }
  }
});
