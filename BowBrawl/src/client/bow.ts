import * as J from "jamango";

// First-person values, kept from the pre-migration tuning.
const FP_BASE_POSITION: J.Vec3 = [0.2, -1.4, -1.0];
const FP_SCALE = 0.07;
const FP_QUATERNION: J.Quat = [0, 0, 0, 1];

// Third-person values are in slot-local space and need separate tuning.
const TP_POSITION: J.Vec3 = [0.00, 0, 0];
const TP_QUATERNION: J.Quat = [-0.705, 0, 0, 0.724];
const TP_SCALE = 0.12;

const bowFrames = [
  { asset: J.assets.props["Bow Frame 0"], offset: [0, 0, 0.5] },
  { asset: J.assets.props["Bow Frame 1"], offset: [1.5, 0, 10] },
  { asset: J.assets.props["Bow Frame 2"], offset: [1.5, 0, 8] },
  { asset: J.assets.props["Bow Frame 3"], offset: [1.5, -2, 7] },
  { asset: J.assets.props["Bow Frame 4"], offset: [1.5, -4, 6] },
].map((frame) => {
  const adjustment = J.vec3.fromValues(
    ((frame.asset.bounds.x + 0.5) / 2 - frame.offset[0]) * FP_SCALE,
    ((frame.asset.bounds.y + 0.5) / 2 - frame.offset[1]) * FP_SCALE,
    ((frame.asset.bounds.z + 0.5) / 2 - frame.offset[2]) * FP_SCALE
  );
  return {
    assetId: frame.asset.id,
    fpPosition: J.vec3.add([0, 0, 0], FP_BASE_POSITION, adjustment) as J.Vec3,
  };
});

const HOLD_ANIMATION = "items_fightTwoHanded_idle_over";
const SHOOT_ANIMATION = "items_fightTwoHanded_shoot_add";

type BowState = {
  frameIndex: number;
  handle3p: number;
  handleFp: number;
};

const bowState = new Map<J.EntityId, BowState>();

function detach(entityId: J.EntityId, state: BowState): void {
  J.removeCharacterMeshAttachment(entityId, state.handle3p);
  if (state.handleFp !== -1) {
    J.removeFirstPersonMeshAttachment(entityId, state.handleFp);
  }
}

export function setBowFrame(entityId: J.EntityId, frameIndex: number): void {
  const current = bowState.get(entityId);
  if (current?.frameIndex === frameIndex) return;

  const isFirstAttach = !current;
  if (current) detach(entityId, current);

  const frame = bowFrames[frameIndex];
  const handle3p = J.addCharacterMeshAttachmentProp(
    entityId,
    frame.assetId,
    "handRight",
    TP_POSITION,
    TP_QUATERNION,
    TP_SCALE
  );
  if (handle3p === -1) {
    bowState.delete(entityId);
    return;
  }

  let handleFp = -1;
  if (entityId === J.getLocalPlayer()) {
    handleFp = J.addFirstPersonMeshAttachmentProp(
      entityId,
      frame.assetId,
      frame.fpPosition,
      FP_QUATERNION,
      FP_SCALE
    );
  }

  bowState.set(entityId, { frameIndex, handle3p, handleFp });

  if (isFirstAttach) {
    J.characterPlayAnimation(entityId, HOLD_ANIMATION, {
      mode: "loop",
      fadeIn: 0.2,
    });
  }
}

export function removeBow(entityId: J.EntityId): void {
  const current = bowState.get(entityId);
  if (!current) return;
  detach(entityId, current);
  bowState.delete(entityId);
  J.characterStopAnimation(entityId, HOLD_ANIMATION, { fadeOut: 0.2 });
}

export function initBow(entityId: J.EntityId): void {
  setBowFrame(entityId, 0);
}

export function playBowReleaseAnim(entityId: J.EntityId): void {
  J.characterStopAnimation(entityId, SHOOT_ANIMATION, { fadeOut: 0 });
  J.characterPlayAnimation(entityId, SHOOT_ANIMATION, {
    mode: "once",
    speed: 0.5,
  });
}

export function setBowFirstPersonDraw(
  entityId: J.EntityId,
  hold: number,
  wobble: number
): void {
  const current = bowState.get(entityId);
  if (!current || current.handleFp === -1) return;
  const frame = bowFrames[current.frameIndex];
  const position: J.Vec3 = [
    frame.fpPosition[0] + hold * -0.1,
    frame.fpPosition[1] + hold * 0.03,
    frame.fpPosition[2] + -0.06 * hold,
  ];
  const quaternion = J.quat.fromEuler([0, 0, 0, 0], [0, 0, -hold * 0.6]);
  J.updateFirstPersonMeshAttachment(
    entityId,
    current.handleFp,
    position,
    quaternion,
    FP_SCALE * (1 + wobble * 0.3)
  );
}

export function clearBowFirstPersonDraw(entityId: J.EntityId): void {
  const current = bowState.get(entityId);
  if (!current || current.handleFp === -1) return;
  const frame = bowFrames[current.frameIndex];
  J.updateFirstPersonMeshAttachment(
    entityId,
    current.handleFp,
    frame.fpPosition,
    FP_QUATERNION,
    FP_SCALE
  );
}

J.onPlayerLeave((id) => {
  bowState.delete(id);
});
