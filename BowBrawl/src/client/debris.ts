import * as J from "jamango";
import { HitCommand } from "../commands";

type DebrisEntry = {
  entity: J.EntityId;
  spawnTime: number;
};

const debrisList: DebrisEntry[] = [];

J.net.listen(HitCommand, (data, senderId) => {
  const viewRay = J.getCharacterViewRay(data.victimId);
  if (!viewRay) return;

  const debris = J.spawnProp(J.assets.props["Bow Debris"].id);
  const forwardOffset = J.vec3.scale([0, 0, 0], viewRay.direction, 1.5);
  const spawnPos = J.vec3.add([0, 0, 0], viewRay.origin, forwardOffset);
  J.setEntityPosition(debris, spawnPos);

  const randomSpin: J.Vec3 = [
    (Math.random() - 0.5) * 60,
    (Math.random() - 0.5) * 60,
    (Math.random() - 0.5) * 60,
  ];

  const speed = 8 + Math.random() * 4;
  const vel = J.vec3.scale([0, 0, 0], viewRay.direction, speed);
  vel[1] += 15 + Math.random() * 5;

  J.setEntityVelocity(debris, vel);
  J.setEntityAngularVelocity(debris, randomSpin);

  debrisList.push({
    entity: debris,
    spawnTime: J.getWorldTime(),
  });
});

J.onGameTick(() => {
  const t = J.getWorldTime();

  for (let i = debrisList.length - 1; i >= 0; i--) {
    const entry = debrisList[i];
    if (t - entry.spawnTime >= 5) {
      J.removeEntity(entry.entity);
      debrisList.splice(i, 1);
    }
  }
});
