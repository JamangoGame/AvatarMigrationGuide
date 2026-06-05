import * as J from "jamango";
import {
  ArrowCommand,
  HitCommand,
  RespawnCommand,
  EnvironmentalDeathCommand,
} from "./commands";
import { PlayerTrait } from "./traits";
import "./server/pickups";
import "./server/bots";
import { spawnPlayer, killPlayer } from "./server/respawn";

J.onGameStart(() => {
  J.getAllPlayers().forEach((id) => spawnPlayer(id, false));
});

J.onPlayerJoin((id) => spawnPlayer(id, false));

J.net.listen(ArrowCommand, (data, senderId) => {
  const playerTrait = J.getTrait(senderId, PlayerTrait);
  if (!playerTrait || playerTrait.arrowCount <= 0) {
    return;
  }

  J.setTrait(senderId, PlayerTrait, {
    ...playerTrait,
    arrowCount: playerTrait.arrowCount - 1,
  });

  J.net.sendToAll(ArrowCommand, data, senderId);
});

J.net.listen(HitCommand, (data, senderId) => {
  killPlayer(data.victimId);

  const isSuicide = data.attackerId === data.victimId;

  const attackerTrait = J.getTrait(data.attackerId, PlayerTrait);
  if (attackerTrait && !isSuicide) {
    J.setTrait(data.attackerId, PlayerTrait, {
      ...attackerTrait,
      kills: attackerTrait.kills + 1,
      lastKillTime: J.getWorldTime(),
      killStreak: attackerTrait.killStreak + 1,
    });
  }

  J.net.sendToAll(HitCommand, data);
});

J.net.listen(EnvironmentalDeathCommand, (data, senderId) => {
  killPlayer(data.victimId);
  J.net.sendToAll(EnvironmentalDeathCommand, data);
});

J.onGameTick((_, t) => {
  const players = J.getAllWithTraits([PlayerTrait]);

  for (const [id, _] of players) {
    const player = J.getTrait(id, PlayerTrait);
    if (!player) continue;

    const isAlive = J.getCharacterAlive(id);

    if (!isAlive && player.respawnTime > 0 && t >= player.respawnTime) {
      const pos = spawnPlayer(id);
      if (pos) {
        J.setEntityPosition(id, pos);
      }
    }
  }
});
