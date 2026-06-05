# Jamango World Migration Guide (June 2026)

## What this guide is for

Jamango's avatar rebuild introduced new lower-level APIs for GLB items, props, transforms, animations, emotes, and avatar configuration. Use this guide if your world was built against the old Items, emote, or avatar component APIs and needs to be updated to the new system.

## Example migrated game

The `BowBrawl/` folder contains a fully migrated game with example gameplay code. Use it as a solid base when you want to see these migration patterns in a complete, working project.

## TL;DR, what got removed and what to call instead

| Removed | Replacement | Section |
|---|---|---|
| `J.setCharacterItem(id, item)` | `J.addCharacterMeshAttachmentProp(...)` + tracked handle | [§1 Item equip] |
| `J.setCharacterItem(id, undefined)` | `J.removeCharacterMeshAttachment(id, handle)` | [§1 Item equip] |
| `J.getCharacterItem(id)` | Track equipped state yourself, or `J.getCharacterMeshAttachments(id)` | [§1 Item equip] |
| `J.ItemAnimations.ONE_HANDED_TOOL` | string `"items_tools_idle_over"` (table in [§1 Item equip]) | [§1 Item equip] |
| `J.characterPlayEmote(id, emoteId)` | `J.characterPlayAnimation(id, clipName, opts?)` | [§2 Emotes API] |
| `J.characterStopEmote(id, emoteId)` | `J.characterStopAnimation(id, clipName, opts?)` | [§2 Emotes API] |
| `J.assets.emotes.Wave` (and ALL old names) | `J.assets.animations.emotes_hello` etc., see [§3 Available emotes] | [§3 Available emotes] |
| `J.equipAvatarComponent(id, componentId)` | `J.addCharacterAvatarConfig(id, partialConfig)` | [§4 Avatar API] |
| `J.unequipAvatarComponent(id, componentId)` | Reset + re-layer pattern | [§4 Avatar API] |
| `J.assets.avatarComponents` | Removed, use avatar config APIs with known component IDs | [§4 Avatar API] |
| `schema.asset({ assetTypes: ["emote"] })` | `assetTypes: ["animation"]` | [§6 Schema asset types] |
| `schema.asset({ assetTypes: ["avatarComponent"] })` | Removed, no replacement | [§6 Schema asset types] |

---

## §0 First, find what needs migrating

 

| If you find this in your code... | Go to | What it means |
|---|---|---|
| `setCharacterItem` | [§1 Item equip] | Old item-equip API, removed. |
| `getCharacterItem` | [§1 Item equip] | Old item-equip API, removed. |
| `ItemAnimations` | [§1 Item equip] | Old item-animation enum, removed. |
| `characterPlayEmote` | [§2 Emotes API] | Old emote API, removed. |
| `characterStopEmote` | [§2 Emotes API] | Old emote API, removed. |
| `assets.emotes` | [§2 Emotes API], [§3 Available emotes] | Old emote asset registry, removed. |
| `equipAvatarComponent` | [§4 Avatar API] | Old avatar API, removed. |
| `unequipAvatarComponent` | [§4 Avatar API] | Old avatar API, removed. |
| `assets.avatarComponents` | [§4 Avatar API] | Old avatar asset registry, removed. |
| `"emote"` (inside `assetTypes`) | [§6 Schema asset types] | Old schema asset type, renamed. |
| `"avatarComponent"` (inside `assetTypes`) | [§6 Schema asset types] | Old schema asset type, removed. |

[§1 Item equip]: #section-1
[§2 Emotes API]: #section-2
[§3 Available emotes]: #section-3
[§4 Avatar API]: #section-4
[§5 Multiplayer replication]: #section-5
[§5.1 Client animations]: #section-5-1
[§6 Schema asset types]: #section-6

---

<a id="section-1"></a>

## §1 Item equip, REQUIRED if you ever put a prop in a player's hand

**What broke:** `J.setCharacterItem`, `J.getCharacterItem`, and `J.ItemAnimations` are removed. The replacement is the mesh-attachment system.

### The replacement APIs (full type signatures)

```ts
// Third-person, what other players (and your camera in 3rd-person) see.
// Returns a handle (>= 0). Returns -1 on failure (e.g. asset not loaded).
J.addCharacterMeshAttachmentProp(
  characterId: number,
  id: string,                         // prop asset id, e.g. J.assets.props.Shovel.id
  slot: CharacterSlotId,              // see slot list below
  position: J.Vec3,                   // [x, y, z] meters, local to slot
  quaternion: J.Quat,                 // [x, y, z, w] local to slot
  scale: J.Vec3 | number,             // uniform or per-axis
): number;

// Remove an attachment by handle.
J.removeCharacterMeshAttachment(characterId: number, handle: number): void;

// First-person, camera-relative; renders ONLY while the local camera is
// first-person on that character. Safe to call for everyone, it just
// doesn't show on remote players.
J.addFirstPersonMeshAttachmentProp(
  characterId: number,
  id: string,
  position: J.Vec3,                   // camera-relative
  quaternion: J.Quat,
  scale: J.Vec3 | number,
): number;
J.removeFirstPersonMeshAttachment(characterId: number, handle: number): void;

// Hold pose / put away animations replace J.ItemAnimations:
J.characterPlayAnimation(id: number, clip: string, opts?: {
  mode?: "loop" | "once" | "hold";     // default depends on the clip suffix, see §2
  speed?: number;                      // default: 1
  fadeIn?: number;                     // crossfade seconds
  cancelOnMove?: boolean;              // auto stop when the character moves
}): void;
J.characterStopAnimation(id: number, clip: string, opts?: { fadeOut?: number }): void;
```

Supporting types:
```ts
type Vec3 = [x: number, y number, z: number];
type Quat = [x: number, y: number, z: number, w: number];
type CharacterSlotId =
  | "head" | "chest" | "waist"
  | "armLeft" | "armRight"
  | "handLeft" | "handRight"
  | "legLeft" | "legRight"
  | "footLeft" | "footRight";
```

### Three rules

1. **Client-only, not networked.** Calling `addCharacterMeshAttachmentProp` on the server is a silent no-op. Calling it on one client does NOT show the item to other clients. To make remote players see held items, see [§5 Multiplayer replication].
2. **No "current item" concept.** The engine doesn't track what you attached as "the held item", you must store the returned `handle` so you can remove it later.
3. **Always check the handle.** `-1` means the attach failed. Don't store it; bail out of your equip path.

### Hold pose animation for third person

`addCharacterMeshAttachmentProp` only places the mesh. It does not pose the character. Without a matching hold pose animation, the character stays in their default idle, arms relaxed at their sides, and the item floats next to the hand. The local player rarely notices in first person, but every other player sees it from third person and it looks broken.

The fix: alongside the equip, play a matching `_over` clip from the table below. `_over` clips affect only the bones they track (typically arms and upper body), so locomotion keeps running underneath. The player can still walk, run, and jump while the held item pose follows.

Pattern: play once on first equip with `mode: "loop"`, persist across item swaps (do not restart it when you detach and reattach the mesh for a phase change), and stop on unequip.

```ts
// On equip, pose the arms to grip the item
J.characterPlayAnimation(playerId, "items_fightTwoHanded_idle_over", {
  mode: "loop",
  fadeIn: 0.2,
});

// On unequip, release back to default idle
J.characterStopAnimation(playerId, "items_fightTwoHanded_idle_over", {
  fadeOut: 0.2,
});
```

Pick the clip that matches the item type. See the table below.

### `ItemAnimations` → clip-name table

The old enum is gone. Pass these strings to `characterPlayAnimation`:

| Old enum | New clip name |
|---|---|
| `ItemAnimations.ONE_HANDED_TOOL` | `"items_tools_idle_over"` |
| `ItemAnimations.ONE_HANDED_MELEE` | `"items_melee_idle_over"` |
| `ItemAnimations.ONE_HANDED_RANGED_WEAPON` | `"items_oneHanded_idle_over"` |
| `ItemAnimations.TWO_HANDED_RANGED_WEAPON` | `"items_fightTwoHanded_idle_over"` |

The `_over` suffix means override, it plays on top of locomotion and only occupies the bones the clip tracks (typically arms).

### Example client `updateEquipment`

```ts
const ITEM_HOLD_ANIMATION = "items_tools_idle_over";

// playerId → the attachments we created for them
const equippedItemState = new Map<
  number,
  { assetId: string; handle: number; fpHandle: number }
>();

function detachEquipped(
  playerId: number,
  current: { handle: number; fpHandle: number }
) {
  J.removeCharacterMeshAttachment(playerId, current.handle);
  if (current.fpHandle !== -1) {
    J.removeFirstPersonMeshAttachment(playerId, current.fpHandle);
  }
}

export function updateEquipment(playerId: number, assetId?: string) {
  const current = equippedItemState.get(playerId);

  // Unequip path
  if (!assetId) {
    if (current) {
      detachEquipped(playerId, current);
      J.characterStopAnimation(playerId, ITEM_HOLD_ANIMATION);
      equippedItemState.delete(playerId);
    }
    return;
  }

  // Already holding this asset, nothing to do
  if (current?.assetId === assetId) return;

  // Swap path: drop the old mesh first
  if (current) detachEquipped(playerId, current);

  const handle = J.addCharacterMeshAttachmentProp(
    playerId,
    assetId,
    "handRight",
    [0, 0, 0],                          // TP position, tune per prop
    [-0.705, 0, 0, 0.724],              // TP quaternion, tune per prop
    0.12,                               // TP scale, tune per prop
  );

  if (handle === -1) {
    // attach failed, bail and clean up animation if we were already playing
    if (current) {
      J.characterStopAnimation(playerId, ITEM_HOLD_ANIMATION);
      equippedItemState.delete(playerId);
    }
    return;
  }

  // Also attach a first person view so the local player sees their hands
  const fpHandle = J.addFirstPersonMeshAttachmentProp(
    playerId,
    assetId,
    [0.2, -1.4, -1.0],                  // FP position, tune separately from TP
    [0, 0, 0, 1],                       // FP quaternion
    0.07,                               // FP scale
  );

  // Start the hold pose only on first equip; keep it playing across swaps
  if (!current) J.characterPlayAnimation(playerId, ITEM_HOLD_ANIMATION);

  equippedItemState.set(playerId, { assetId, handle, fpHandle });
}
```

### Tuning offset, rotation, and scale (you WILL need to tinker)

The old `setCharacterItem` (plus `setFirstPersonItemTransform` for the FP view) accepted a single transform that the engine adapted per rig. The new mesh attachment API does not, so every prop needs its position, rotation, and scale tuned by hand, and the first person and third person values are independent.

BowBrawl's bow uses these constants as a starting point (lifted from `src/client/bow.ts`):

```ts
// First person values, what the local player sees
const FP_BASE_POSITION: J.Vec3 = [0.2, -1.4, -1.0];
const FP_QUATERNION: J.Quat  = [0, 0, 0, 1];
const FP_SCALE              = 0.07;

// Third person values, in slot local space. Tune independently from FP.
const TP_POSITION: J.Vec3   = [0, 0, 0];
const TP_QUATERNION: J.Quat = [-0.705, 0, 0, 0.724];
const TP_SCALE              = 0.12;

J.addCharacterMeshAttachmentProp(playerId, assetId, "handRight",
  TP_POSITION, TP_QUATERNION, TP_SCALE);
J.addFirstPersonMeshAttachmentProp(playerId, assetId,
  FP_BASE_POSITION, FP_QUATERNION, FP_SCALE);
```

What to tinker with per prop:

- **Scale.** Tool and weapon props typically land around `0.07` to `0.12`. Blocks have much larger source meshes (roughly a 1m cube in mesh space) and sit better in the hand at something like `0.3` to `0.5`. There is no clever formula, eyeball it.
- **Position.** Coordinates are in meters, in the slot's local frame. If the prop floats above the palm or sticks out the wrong end of the hand, nudge it.
- **Rotation.** Most prop meshes face the "wrong" way by default. Rotating around the X axis (tilting the prop forward or back) is the most common fix.
- **First person values are SEPARATE from third person.** First person attachments live in a camera relative coordinate space, so the same numbers will not look right in both views. Tune them independently. Plan on having two sets of values per prop: one for `addCharacterMeshAttachmentProp` (third person, what other players see) and one for `addFirstPersonMeshAttachmentProp` (your own first person view).
 
### Replacing `getCharacterItem(playerId)` checks

Three options, easiest first:

1. **Use your own source of truth.** If your code already knows what's selected (e.g. an inventory state + `selectedSlotIndex`), use that, it's the same data, and it's the only data without network latency.
2. **Read from the map you maintain.** `equippedItemState.get(playerId)?.assetId`.
3. **Ask the engine** with `J.getCharacterMeshAttachments(playerId)` and filter by slot, slower; only useful if you didn't write the equip code.

### Cleanup on player leave

The engine drops the attachments when the character despawns, but your bookkeeping map keeps a stale entry:

```ts
J.onPlayerLeave((playerId) => {
  equippedItemState.delete(playerId);
});
```

---

<a id="section-2"></a>

## §2 Emotes API, REQUIRED if you ever played an emote

**What broke:** `J.characterPlayEmote` and `J.characterStopEmote` are removed. `J.assets.emotes.*` is gone with NO aliases, the old emote names (`Wave`, `CowgirlDance`, `MangoDance`, `Salute`, `FistPump`, `ThumbsUp`, `RaisedArms`, `Talk`, `Think`, `Beckon`, `Measure`, `Show`, `Freeze`, `JumpingJacks`, `LayDown`, `PushUps`, `Sit`, `Stretch`, `Dance`, `DjDance`, `HopakDance`, `Flying`, `Energy`, `Death`, `Fly`, `Zombie`, `Clap`) are all gone.

**Replacement:** `J.assets.animations.*` + `J.characterPlayAnimation(id, clip, opts?)`. Pick the closest clip from [§3 Available emotes].

### Signatures (repeat from §1)

```ts
J.characterPlayAnimation(id, clip, {
  mode?: "loop" | "once" | "hold", // default comes from the clip suffix, see table below
  speed?: number,                  // default: 1
  fadeIn?: number,                 // crossfade seconds, default: 0.1 for base, 0 otherwise
  cancelOnMove?: boolean,          // auto stop when the character moves/jumps/crouches
});
J.characterStopAnimation(id, clip, { fadeOut?: 0.2 });
J.clearCharacterAnimations(id);  // stops EVERYTHING (base + additive + override)
```

### Suffix semantics, important

The clip name's suffix determines how it blends and what the default `mode` is:

| Suffix | Mode | Default `mode` | Behavior |
|---|---|---|---|
| _(none)_ | **base** | `"loop"` | Replaces locomotion in the single base slot. New base auto removes previous. |
| `_add` | **additive** | `"once"` | Blends on top as a delta from bind pose. Good for hits, leans. |
| `_over` | **override** | `"loop"` | Plays concurrently at full weight; only affects the bones the clip tracks (e.g. arms only, keeps legs walking). |

Pass `mode: "hold"` to clamp on the final frame instead of looping or clearing (see next subsection).

### Holding a pose at the end with `mode: "hold"`

`"hold"` plays the clip once and then freezes the character on its last frame until you explicitly stop it. Useful for death poses, knockouts, or any final pose the player should keep until a respawn or reset.

The pattern: on the client, observe a piece of networked state (alive flag, KO trait, etc.) and play the hold animation locally when the state flips. Stop it on the inverse transition.

```ts
// client.ts (or a module imported by it)
const DEATH_ANIMATION = "locomotion_default_death";
const lastAliveState = new Map<J.EntityId, boolean>();

J.onGameTick(() => {
  for (const [id] of J.getAllWithTraits([PlayerTrait])) {
    const alive = J.getCharacterAlive(id);
    if (lastAliveState.get(id) === alive) continue;

    if (!alive) {
      J.characterPlayAnimation(id, DEATH_ANIMATION, {
        mode: "hold",
        speed: 0.8,
      });
    } else if (lastAliveState.has(id)) {
      J.characterStopAnimation(id, DEATH_ANIMATION, { fadeOut: 0.2 });
    }
    lastAliveState.set(id, alive);
  }
});
```

No extra trait is needed because the engine already replicates `getCharacterAlive`. Every client watches the alive state and triggers the hold locally. This is the same shape as the [§5 Multiplayer replication] pattern (client side reaction to networked state), but for animation instead of equipment. See [§5.1 Client animations] for the general rule.

### Before / after

```ts
// Before
J.characterPlayEmote(playerId, J.assets.emotes.Wave.id);

// After, pick the closest clip from §3
J.characterPlayAnimation(playerId, J.assets.animations.emotes_hello.id, {
  cancelOnMove: true,
});
```

```ts
// Before
J.characterStopEmote(playerId, J.assets.emotes.Wave.id);

// After
J.characterStopAnimation(playerId, "emotes_hello", { fadeOut: 0.2 });
// or stop everything at once:
J.clearCharacterAnimations(playerId);
```

You can pass `J.assets.animations.<name>.id` OR a raw string literal, both work.

---

<a id="section-3"></a>

## §3 Available emotes, enumerated

Use any of these as the `clip` argument to `characterPlayAnimation`. Source: engine's `lib/content-client/.../character-component.ts:2905-2996`.

### Recommended emotes (dances & gestures)

These are the "user-facing" emotes, what you'd put on an emote wheel.

| Clip id | Description |
|---|---|
| `emotes_hello` | Wave hello with one arm, closest replacement for old `Wave`. |
| `emotes_danceBasic` | Steady looping dance, generic "dancing" emote. |
| `emotes_danceWorm` | The worm: lie down and ripple. |
| `emotes_hopak` | Traditional hopak (squat-kick) dance. |
| `emotes_67` | Quick celebratory gesture. |
| `emotes_headFootball` | Juggle / bounce something on the head. |
| `emotes_headSpin` | Breakdance head-spin. |
| `emotes_luffy` | Anime-inspired victory pose. |
| `emotes_ronaldoCelebration` | Soccer goal-celebration spin. |
| `emotes_usainBolt` | Sprint-then-pose (Bolt's "lightning" pose). |
| `emotes_zen` | Meditation / sit-and-breathe loop. |

Most are looped, pair with `cancelOnMove: true` if you want them to stop when the player moves.

```ts
J.characterPlayAnimation(id, J.assets.animations.emotes_danceBasic.id, {
  cancelOnMove: true,
});
```

### Combat / held-item poses (use these with `_over` for held weapons)

| Clip id | Use when player is holding… |
|---|---|
| `items_tools_idle_over` | A tool (shovel, hammer, etc.) |
| `items_melee_idle_over` | A one-handed melee weapon |
| `items_oneHanded_idle_over` | A one-handed ranged weapon (pistol) |
| `items_fightTwoHanded_idle_over` | A two-handed ranged weapon (rifle) |
| `items_shield_idle_over` | A shield (typically combined with melee in the other hand) |

There are also `_add` and `_over` swing/shoot variants under `items_melee_*`, `items_tools_*`, etc., grep the source file above for the full set if you need attack animations.

### Mood locomotion overrides (no suffix → replaces base)

Drop in to make a player walk "angry", "happy", etc. without writing your own state machine:

`locomotion_angry_*`, `locomotion_happy_*`, `locomotion_sad_*`, `locomotion_proud_*`, `locomotion_kingpin_*`, `locomotion_zombie_*`, `locomotion_fight_*`, each has `_idle`, `_walk`, `_run` variants. The engine picks the right one based on movement state automatically when you play the `_idle` clip as a base.

```ts
// Make the player walk angrily until they're hit
J.characterPlayAnimation(playerId, "locomotion_angry_idle");
```

### Action one-shots

| Clip id | What it does |
|---|---|
| `actions_sit` | Sit down (loop) |
| `actions_climbUp` | Climb-up motion |
| `actions_dash` | Forward dash |
| `actions_slide` | Slide |
| `actions_roll` | Forward roll |
| `actions_crawl` | Crawling locomotion |
| `actions_carrying` | Carry-something pose |
| `actions_push` | Push-something pose |
| `actions_ritualSpin` | Slow ritual spin |
| `actions_spawnZombie` | Rise-from-ground spawn animation |

### Default locomotion modifiers (the engine plays these automatically)

You normally won't call these directly, but if you want hit reactions or leans on top of whatever's playing:

```ts
J.characterPlayAnimation(playerId, "locomotion_default_hit_add");      // one-shot hit
J.characterPlayAnimation(playerId, "locomotion_default_leanLeft_add"); // additive lean
```

The full set in `locomotion_default_*`: `idle`, `walk`, `run`, `sprint`, `fall`, `fallFree`, `flyIdle`, `fly`, `flySprint`, `flyUp`, `flyDown`, `crouch`, `crouchIdle`, `death`, `jumpStart`, `jumpEnd`, `jumpDouble`, `swimIdle`, `swimCrawl`, `swimBreaststroke`, `hit_add`, `impulseStart_add`, `impulseStop_add`, `leanLeft_add`, `leanRight_add`.

---

<a id="section-4"></a>

## §4 Avatar API, CONDITIONAL: only if you swap avatar components

**What broke:** `J.equipAvatarComponent`, `J.unequipAvatarComponent`, and `J.assets.avatarComponents` are all removed.

**Replacement model:** Additive layering via `J.addCharacterAvatarConfig`. There is no direct "unequip one thing" call, to remove an item you reset to the base avatar and re-apply everything else.

### Signatures

```ts
J.addCharacterAvatarConfig(
  entityId: number,
  partialConfig: PartialCharacterAvatarConfig,
): void;
J.setCharacterAvatarByConfig(entityId: number, config: CharacterAvatarConfig): void;
J.setCharacterAvatarById(entityId: number, avatarAssetId: string): void;
J.getCharacterAvatar(entityId: number): CharacterAvatarConfig | undefined;
J.getPlayerBaseAvatar(entityId: number): CharacterAvatarConfig | undefined;
```

`PartialCharacterAvatarConfig` shape:
```ts
{
  rigId?: CharacterRigId;
  skinColorPrimary?: string | null;
  skinColorSecondary?: string | null;
  hairColor?: string | null;
  face?: Partial<CharacterAvatarFaceConfig>;
  components?: Partial<Record<CharacterSlotId, CharacterAvatarComponentConfig[]>>;
}
```

### Equipping (additive)

```ts
// Before
J.equipAvatarComponent(playerId, "nova_chest");

// After
J.addCharacterAvatarConfig(playerId, {
  components: {
    chest: [{ id: "nova_chest", colors: {} }],
  },
});
```

Layer an entire outfit in one call:
```ts
J.addCharacterAvatarConfig(playerId, {
  components: {
    head:      [{ id: "nova_head",     colors: {} }],
    chest:     [{ id: "nova_chest",    colors: {} }],
    armLeft:   [{ id: "nova_armLeft",  colors: {} }],
    armRight:  [{ id: "nova_armRight", colors: {} }],
    legLeft:   [{ id: "nova_legLeft",  colors: {} }],
    legRight:  [{ id: "nova_legRight", colors: {} }],
    footLeft:  [{ id: "nova_footLeft", colors: {} }],
    footRight: [{ id: "nova_footRight",colors: {} }],
  },
});
```

### Component colors

Use keys `"01"` (primary), `"02"` (secondary), `"03"` (tertiary):
```ts
J.addCharacterAvatarConfig(playerId, {
  components: {
    chest: [{ id: "nova_chest", colors: { "01": "#ff0000", "02": "#ffffff" } }],
  },
});
```

### Unequipping (reset + re-layer)

There is no `unequipAvatarComponent`. The intended pattern is to keep track of what's equipped in your own script state and re-apply everything except the removed piece:

```ts
const equipped = new Set<PartialCharacterAvatarConfig>();

function applyEquipment(playerId: number) {
  const base = J.getPlayerBaseAvatar(playerId);
  if (base) J.setCharacterAvatarByConfig(playerId, base);
  for (const item of equipped) {
    J.addCharacterAvatarConfig(playerId, item);
  }
}
```

### `J.assets.avatarComponents` is gone

Pass component IDs as string literals (e.g. `"nova_chest"`). The asset registry no longer enumerates them, they're treated as marketplace products now.

---

<a id="section-5"></a>

## §5 Multiplayer replication of held items, RECOMMENDED

**Why this is in the guide:** `addCharacterMeshAttachmentProp` is client-only and not networked. If your world is multiplayer and you equip props, other players will NOT see what each player is holding unless you replicate the state yourself.

The recommended pattern uses a trait, traits auto-sync server → all clients (batched per tick), so you set it on the server and read it on every client.

**Use a trait, not a one-shot command broadcast.** It's tempting to replicate equips by sending a "player X equipped Y" message to everyone when it happens. That breaks for **late joiners**: a player who connects *after* the equip never received that message, so they see everyone empty-handed until each player happens to equip again. A trait holds *current* state, and the engine syncs current trait values to any client when it joins, so late joiners just read the trait and attach the right mesh, no resync code needed. (If you already have an equip command from the client, keep it for client → server, but have the server write the result to a trait rather than re-broadcasting it.)

<a id="section-5-1"></a>

### §5.1 Always play animations on the client

`characterPlayAnimation` and `characterStopAnimation` calls on the server replace whatever the client is playing. A server side death pose erases the held item pose the client was layering on top, and the character snaps back to default arms.

Keep every animation call in `client.ts` or in a module imported by it. When an animation should react to networked state (death, hit, equipment change), have the client observe the state and trigger the animation locally. The death example in [§2 Emotes API] follows this pattern, watching `getCharacterAlive`. The trait based equipment pattern below ([§5 Multiplayer replication], Step 1 to 3) is the same idea for held items.

### Step 1: Define the trait

```ts
// src/traits.ts (or wherever you define traits)
import { defineTrait, schema } from "jamango";

export const EquippedItemTrait = defineTrait(
  "EquippedItem",
  // Whatever uniquely identifies the held thing;
  // a raw asset id works too.
  schema.any<{ key: string | null }>(),
);
```

### Step 2: Server publishes on tick (only when it changes)

In your server code, on every tick, look at what each player should be holding (whatever your inventory / hotbar shape is) and publish the result on the trait. Only write the trait when the value actually changed; that diff avoids unnecessary network traffic.

```ts
// In your server entry point (or a system file imported from it)
import { onGameTick, getAllPlayers, getTrait, setTrait } from "jamango";
import { EquippedItemTrait } from "./wherever-you-defined-it";

// Plug in YOUR own logic here. Return the identifier of whatever the player
// is currently holding, or null if nothing is equipped. The shape of `key`
// must match what you put in EquippedItemTrait's schema in Step 1.
function getCurrentlyEquippedKey(playerId: number): string | null {
  // Example: read from your own inventory/hotbar state and return the
  // selected item's key, or null. Replace this body with your real logic.
  return null;
}

onGameTick(() => {
  getAllPlayers().forEach((playerId) => {
    const key = getCurrentlyEquippedKey(playerId);

    const current = getTrait(playerId, EquippedItemTrait);
    if ((current?.key ?? null) !== key) {
      setTrait(playerId, EquippedItemTrait, { key });
    }
  });
});
```

The "only when it changes" diff matters, `setTrait` triggers network traffic, but a no-op early return doesn't.

### Step 3: Client applies the trait to remote players

```ts
// src/client/hotbarSystem.ts  
import { getAllWithTraits, getLocalPlayer } from "jamango";
import { EquippedItemTrait } from "../traits";

export function update() {
  const localId = getLocalPlayer();

  // Local player: drive equipment off local state (zero-latency)
  // ... your existing local-player updateEquipment call ...

  // Remote players: drive equipment off the networked trait
  for (const [entityId, trait] of getAllWithTraits([EquippedItemTrait])) {
    if (entityId === localId) continue;
    updateEquipment(entityId, trait?.key ?? undefined);
  }
}
```

Why the local-vs-remote split: the trait round-trips through the server (~1 tick latency). For the local player you have the data instantly via your own state, use it. For everyone else, the trait is the only synced source.
 

<a id="section-6"></a>

## §6 Schema asset types

If you defined a trait with `J.schema.asset({ assetTypes: [...] })`:

```ts
// Before
J.schema.asset({ assetTypes: ["emote"] })
// After
J.schema.asset({ assetTypes: ["animation"] })

// Before
J.schema.asset({ assetTypes: ["avatarComponent"] })
// After, no direct replacement. Either drop the asset reference and store an
// id string, or rethink the feature.
```

---

## §7 Migration checklist

- [ ] If `setCharacterItem` / `getCharacterItem` / `ItemAnimations` had hits: migrate [§1 Item equip]. Rewrite your equip function, drop dead imports, remove any server-side equip calls.
- [ ] Update scaling/transform of your props in first person / third person
- [ ] If `characterPlayEmote` / `characterStopEmote` / `assets.emotes` had hits: migrate [§2 Emotes API]. Replace each call site with `characterPlayAnimation` in `client.ts` (not `server.ts`, see [§5.1 Client animations]); pick the new clip name from [§3 Available emotes].
- [ ] If you use raw old emote names (Wave, CowgirlDance, …) in strings/configs anywhere: replace them using [§3 Available emotes], there are no automatic aliases.
- [ ] If `equipAvatarComponent` / `unequipAvatarComponent` / `assets.avatarComponents` had hits: migrate [§4 Avatar API]. Switch to additive layering with reset + re-layer for unequip.
- [ ] If your world is multiplayer and equips items: add [§5 Multiplayer replication].
- [ ] If your `J.schema.asset(...)` calls used `"emote"` or `"avatarComponent"`: update per [§6 Schema asset types].
- [ ] If an animation should play once and freeze on the final frame (death, knockout), pass `mode: "hold"` to `characterPlayAnimation`. See [§2 Emotes API].

---

## §8 Common pitfalls

- **Don't call `addCharacterMeshAttachmentProp` on the server.** Silent no-op.
- **The returned handle can be `-1`.** Always check before storing.
- **Mesh attachments don't auto-clean on swap.** Track the handle; `removeCharacterMeshAttachment` before adding a new one.
- **First-person attachments are safe to add for any character.** They render only when the local camera is currently first-person on that character.
- **Avatar resets wipe everything else, too.** When you do reset + re-layer ([§4 Avatar API]), be sure your `equipped` set has everything the player should keep.
- **Trait `setTrait` is not idempotent for network traffic.** Diff before setting (see the [§5 Multiplayer replication] server loop).
- **Old emote names are GONE with no aliases.** Pick the closest from [§3 Available emotes] or remove the feature. The old `Wave` is now `emotes_hello`; `CowgirlDance` / `Dance` / `DjDance` collapse to `emotes_danceBasic` or `emotes_danceWorm`; `Sit` becomes `actions_sit`; the rest have no direct mapping.
- **Never call `characterPlayAnimation` or `characterStopAnimation` on the server.** Server animation calls replace client animations, so a server side death pose erases the held item pose layered on top. See [§5.1 Client animations].
- **Held items do not sync by themselves.** Mesh attachments are local to the client that created them. To make other players see what someone is holding, publish the current item key on a trait and apply it on every client. See [§5 Multiplayer replication].

---

## §9 New helpers (additive, not breaking)

A few helpers landed alongside the breaking changes. None are required to migrate, but they make held-item animation and hand/viewmodel math much easier.

### `J.updateFirstPersonMeshAttachment(characterId, handle, position?, quaternion?, scale?)`

Moves an existing first-person attachment (the one `addFirstPersonMeshAttachmentProp` handed you a handle for). This is how you animate a held item in first person, frame by frame, from `J.onGameRender`: a thrust, a swing arc, a recoil spring. Pass `undefined` for any field to leave it unchanged.

First-person attachments are camera-space and have **no skeleton**, so animation clips do not move them. A swing or shoot `_add` clip animates only the third-person body (what other players see). For a polished weapon, do both: play the `_add` clip for everyone, and drive the first-person viewmodel yourself with this call.

```ts
// once, on fire: the third-person body reacts for everyone
J.characterPlayAnimation(playerId, "items_fightTwoHanded_shoot_add", { mode: "once" });
// every frame: your own first-person model kicks back, then springs home
J.updateFirstPersonMeshAttachment(playerId, fpHandle, [baseX, baseY, baseZ + recoil]);
```

The next two are read-only; reach for them when you spawn projectiles or muzzle flashes from a player's hand or first-person viewmodel, instead of recomputing transforms by hand.

### `J.getCharacterSlotWorldMatrix(characterId, slot, localMatrix)`

Resolves a slot-local matrix into world space using the same per-rig retargeting that `addCharacterMeshAttachmentProp` uses. Returns `undefined` if the character has no visual or the slot is not bound.

Slot values are the same as the mesh-attachment slots: `"head" | "chest" | "waist" | "armLeft" | "armRight" | "handLeft" | "handRight" | "legLeft" | "legRight" | "footLeft" | "footRight"`.

```ts
// World position of a muzzle 10cm forward on the right hand
const muzzleLocal = J.mat4.fromTranslation(J.mat4.create(), [0, 0, 0.1]);
const muzzleWorld = J.getCharacterSlotWorldMatrix(characterId, "handRight", muzzleLocal);
if (muzzleWorld) {
  const origin = J.vec3.fromMat4Translation([0, 0, 0], muzzleWorld);
  J.spawnProjectile("#ff0000", 50, characterId, null, origin, aimDirection);
}
```

### `J.getCharacterFirstPersonWorldMatrix(characterId, localMatrix)`

Resolves a camera-local matrix into world space for first-person viewmodels. Returns `undefined` when the view is not currently first-person on that character.

```ts
const muzzleLocal = J.mat4.fromTranslation(J.mat4.create(), [0.1, 0, -0.3]);
const muzzleWorld = J.getCharacterFirstPersonWorldMatrix(localCharacterId, muzzleLocal);
if (muzzleWorld) {
  const origin = J.vec3.fromMat4Translation([0, 0, 0], muzzleWorld);
  // spawn tracer, muzzle flash, etc.
}
```

Both are **client-only**. Call them in `client.ts` or inside `J.onGameRender`.

---

## §10 Complete animation clip name reference

Every string you can pass to `characterPlayAnimation`. 

The suffix determines blending mode automatically:
- no suffix → **base** (replaces locomotion in the single base slot)
- `_add` → **additive** (blends on top as a delta; default mode `"once"`)
- `_over` → **override** (partial-bone tracks, plays on top of locomotion; default mode `"loop"`)

---

### Emotes

| Clip | Notes |
|---|---|
| `emotes_hello` | Wave hello |
| `emotes_danceBasic` | Steady looping dance |
| `emotes_danceWorm` | The worm |
| `emotes_hopak` | Squat-kick dance |
| `emotes_67` | Celebratory gesture |
| `emotes_headFootball` | Head-juggle |
| `emotes_headSpin` | Breakdance head-spin |
| `emotes_luffy` | Anime victory pose |
| `emotes_ronaldoCelebration` | Soccer goal-celebration spin |
| `emotes_usainBolt` | Pose |
| `emotes_zen` | Meditation loop |

---

### Actions

| Clip | Notes |
|---|---|
| `actions_sit` | Sit down |
| `actions_climbUp` | Climb-up motion |
| `actions_dash` | Forward dash |
| `actions_slide` | Slide |
| `actions_roll` | Forward roll |
| `actions_crawl` | Crawling locomotion |
| `actions_carrying` | Carry-something pose |
| `actions_push` | Push-something pose |
| `actions_ritualSpin` | Slow ritual spin |
| `actions_spawnZombie` | Rise-from-ground spawn |

---

### Items / held-weapon poses

| Clip | Mode | Use when holding… |
|---|---|---|
| `items_tools_idle_over` | override | A tool (shovel, wrench, etc.) |
| `items_tools_equipSide_over` | override | Tool stowed at side |
| `items_tools_equipBack_over` | override | Tool stowed on back |
| `items_tools_shoot_add` | additive | Tool-use swing/fire |
| `items_melee_idle_over` | override | One-handed melee (casual) |
| `items_melee_spin` | base | Spinning melee wind-up |
| `items_melee_swingLeft_add` | additive | Left swing |
| `items_melee_swingRight_add` | additive | Right swing |
| `items_fightMelee_idle_over` | override | One-handed melee (combat stance) |
| `items_fightMelee_block_over` | override | Blocking |
| `items_fightMelee_swingDown_add` | additive | Overhead swing |
| `items_fightMelee_swingLeft_add` | additive | Left swing (fight) |
| `items_fightMelee_swingRight_add` | additive | Right swing (fight) |
| `items_oneHanded_idle_over` | override | One-handed ranged (pistol) |
| `items_oneHanded_shoot_add` | additive | Pistol fire |
| `items_fightOneHanded_idle_over` | override | One-handed ranged (combat) |
| `items_fightOneHanded_shoot_add` | additive | Pistol fire (combat) |
| `items_twoHanded_idle_over` | override | Two-handed ranged (rifle) |
| `items_twoHanded_shoot_add` | additive | Rifle fire |
| `items_fightTwoHanded_idle_over` | override | Two-handed ranged (combat) |
| `items_fightTwoHanded_shoot_add` | additive | Rifle fire (combat) |
| `items_twohanded_shootBow_add` | additive | Bow draw/release |
| `items_shield_idle_over` | override | Shield held |

---

### Locomotion default

| Clip | Mode | Notes |
|---|---|---|
| `locomotion_default_idle` | base | Standing still |
| `locomotion_default_walk` | base | Walking |
| `locomotion_default_run` | base | Running |
| `locomotion_default_sprint` | base | Sprinting |
| `locomotion_default_crouch` | base | Moving while crouched |
| `locomotion_default_crouchIdle` | base | Crouching still |
| `locomotion_default_fall` | base | Falling (short drop) |
| `locomotion_default_fallFree` | base | Free-fall |
| `locomotion_default_jumpStart` | base | Jump takeoff |
| `locomotion_default_jumpEnd` | base | Jump landing |
| `locomotion_default_jumpDouble` | base | Double-jump |
| `locomotion_default_flyIdle` | base | Hovering |
| `locomotion_default_fly` | base | Flying |
| `locomotion_default_flySprint` | base | Flying fast |
| `locomotion_default_flyUp` | base | Flying up |
| `locomotion_default_flyDown` | base | Flying down |
| `locomotion_default_swimIdle` | base | Treading water |
| `locomotion_default_swimBreaststroke` | base | Breaststroke |
| `locomotion_default_swimCrawl` | base | Front crawl |
| `locomotion_default_death` | base | Death (use `mode: "hold"` to freeze on last frame) |
| `locomotion_default_hit_add` | additive | Hit reaction (one-shot) |
| `locomotion_default_leanLeft_add` | additive | Lean left |
| `locomotion_default_leanRight_add` | additive | Lean right |
| `locomotion_default_impulseStart_add` | additive | Impulse kick start |
| `locomotion_default_impulseStop_add` | additive | Impulse kick stop |

---
 :
