# Jamango Game Project Overview
<!-- jamango-ai-context v1.0 -->

- You are working on a multiplayer, browser-based game built with the Jamango Engine & API.
- Import the API with: `import * as J from "jamango"`.
- API reference: node_modules/jamango/api.ts
- Patterns & UI guide: node_modules/jamango/README.md
- Always-visible UI pattern (HUDs, leaderboards, kill feeds): node_modules/jamango/HUD-PATTERN.md
- Asset IDs for this world: node_modules/jamango/assets.ts

## Core Concepts
Jamango is a voxel-based multiplayer game engine. Positions are in block units — [1, 2, 1] = 1 block right, 2 up, 1 forward.

- **Blocks**: Blocks exist on a voxel grid. Blocks can be placed, removed, and sculpted.
- **Entities**: Everything in the world that isn't a block is an entity — Props, Characters and Areas are all entities.
- **Props**: Built from block structures in the editor. Can move, scale, rotate, have physics, have traits. Can be spawned client-side (local only) or server-side (synced).
- **Characters**: Players and NPCs. Emotes, animations, movement. Server only for spawning in current engine.
- **Areas**: Invisible collision volumes (box/sphere). Engine-optimized — generally prefer over manual distance checks.
- **Traits**: Data attached to any entity/area/block/world. Auto-sync to all clients via setTrait(). Added via wrench tool in editor.
- **Commands**: Typed network messages (net.defineCommand) for client↔server communication.

## Project Structure
- src/client.ts — Client entry point (UI, input, visuals, audio, particles, client-based game logic)
- src/server.ts — Server entry point (game state, spawning, validation, persistence, server-based game logic)
- src/shared/ — Traits (shared/traits.ts), commands (shared/commands.ts), constants, helpers
- Systems follow init()/tick(dt) pattern, registered in onGameStart/onGameTick
- Keep src/client.ts and src/server.ts as lightweight entry points, rather than nesting logic.
- Keep files small and ideally focused on a single responsibility

## Networking: Client vs Server
- Movement is client-authoritative, and character/player position is automatically synced with server
- Moving characters (including players) needs to be performed on the client (e.g. setEntityPosition() for character to teleport)

| What | Client | Server |
|------|--------|--------|
| Props | Local-only (not visible to others) | Synced to all players |
| Characters | Cannot spawn | Required |
| Blocks | Synced automatically (same as server) | Synced to all players |
| Particles | Client only (J.spawnParticles or prop-based) | Cannot spawn |
| UI | Required (J.uiElement) | N/A |

- Client: UI, input, visuals, player movement/velocity/teleportation, local-only props, particles
- Server: Game state, scoring, spawning characters/blocks, leaderboards, persistence
- Minimize server load & favor client logic where feasible.
- Network traffic should not exceed 30kb per player per second.
- Shared code must not have side effects on import.

## Traits
- Traits can be defined anywhere based on creator preference.
- Traits should be the preferred way to attach data to entities.
- It is recommended to define traits in src/shared/traits.ts and use J.schema (not generic type params):

```
const PlayerHealthTrait = J.defineTrait("PlayerHealth");  // code-only
const BouncyTrait = J.defineTrait("Bouncy",   // editor-visible once creator uses wrench tool - makes it easy for creator to add trait in-world
  J.schema.object({ force: J.schema.number({ defaultValue: 10, label: "Force" }) }),
  { name: "Bouncy", description: "Bounces entities", color: "#ffe100", icon: "🦘" });
```

- Auto-sync to all clients on setTrait(). Sync is batched per tick.
- To appear in editor wrench: MUST have J.schema + metadata AND be imported in client.ts

## Commands
Commands are the ONLY way to communicate between client and server.
Define commands in shared, then use net.send (or net.sendToAll) and net.listen on either side:
```
export const BUY = net.defineCommand<{ key: string }>("buy");
net.listen(BUY, (data, playerId) => { ... });
net.send(BUY, { key: "sword" });
```

## UI
- All UI mounts under J.uiElement (can be undefined — always check). Vanilla DOM only, NO frameworks.
- One UI entry point: initialize all UI from a single function (e.g., initUI()) called in client.ts. UI modules export init/update functions — they should NOT append to the DOM on import.
- Pointer lock is enabled by default. For interactive panels (shops, inventory), release with `document.exitPointerLock()` and re-engage with `document.getElementById("gameCanvas")?.requestPointerLock()`.
- Mobile: hide built-in controls with `J.setUIOptions({ mobileCameraButton: false, mobileRightButtons: false, mobileInteractButton: false, mobileEmoteButton: false })`
- Use J.onGameRender (client-only) for UI that tracks world positions or updates per frame.
- Avoid duplicate DOM: check if elements exist before creating. Use keyed `<style>` tags to prevent duplicate stylesheets.
- World-space UI (waypoints, labels): J.getScreenPosition() in onGameRender → position DOM with absolute left/top.
- See README.md for full UI guide with component patterns and examples.
- For always-visible UI (HUDs, leaderboards, kill feeds, ammo counters): follow HUD-PATTERN.md. Build the DOM once, store refs, use `textContent` with a last-value cache, drive animations via CSS `@keyframes` toggled by class. NEVER write `innerHTML` inside `onGameTick`, NEVER recompute scale/opacity in JS per tick, NEVER use `filter: drop-shadow` (use `text-shadow`).

## Player Input
- Use J.onControlPress/J.onControlRelease for key bindings — not raw DOM events. Client-side only.
- J.getCharacterInput(playerId) returns continuous input state (movement, camera, joystick).
- Key bindings don't work on mobile. For cross-platform actions, extract the logic into a shared function and call it from both the key binding and a mobile UI button:
```
function useAbility() { /* action logic */ }
J.onControlPress("q", () => useAbility());        // desktop
myButton.addEventListener("pointerdown", () => useAbility()); // mobile UI button (inside J.uiElement)
```

## Code Execution
- Code runs in BOTH edit and play mode. J.on* hooks only fire in play mode.
- ALL gameplay logic MUST be inside hooks (onGameStart, onGameTick, etc.). Code outside hooks runs during editing.
- Module-scope constants and defineTrait() are OK outside hooks.
- Do NOT use setInterval/setTimeout — use J.onGameTick with time checks instead. The engine cannot clean up timers between mode switches.
- console.log appears in the IN-GAME CHAT, however it also appears in the browser dev console where it is more feature full (searchable, collapsible, etc.). Recommend for debugging.
- If a script fails to compile, the engine keeps running the last successfully compiled version. Check the browser dev console for compilation errors.
- Runtime errors in scripts are caught and shown as red messages in the browser dev console.

## Performance
- Jamango runs in the browser and targets low-end devices (Chromebooks). Be conscious of performance bottlenecks.
- Avoid heavy computation in onGameTick — it runs every frame on every client.
- Minimize DOM updates in UI — only re-render when values change.
- Use areas for collision detection instead of manual distance checks (engine-optimized).

## Physics & Data
- Positions are BLOCK UNITS, not meters.
- Always use dt — timestep is variable (max 0.1s).
- Movement is client-sided. addEntityVelocity or setEntityVelocity for characters should happen on client.
- Use areas for collision detection, not manual distance checks in onGameTick.
- Persistent data: per-player-per-world. Play mode and edit mode have SEPARATE storage.
- Visual offset/quaternion/scale (setEntityVisualOffset etc.) are cosmetic only — separate from physics.

## Camera
- Use the default Jamango camera where possible. setLocalPlayerCamera configures modes (firstPerson/thirdPerson/selfie). setCameraFree() can detach for cinematics but is experimental.

## Leaderboards
- Define with J.leaderboards.defineLeaderboard() in shared code. Set scores on server with setPlayerScore (integer scores only). API is async (returns Promises). Scores persist across sessions. Modes: "lowest" (time trials) or "highest" (score chase). See README.md for full example.

## Key API (see docs.md for full reference)
- Lifecycle: onGameStart, onGameTick, onGameRender, onPlayerJoin, onPlayerLeave
- Entities: spawnProp, spawnCharacter, removeEntity, getEntityPosition, setEntityPosition
- Traits: defineTrait, setTrait, getTrait, getAllWithTraits
- Commands: net.defineCommand, net.send, net.sendToAll, net.listen
- Physics: setEntityVelocity, addEntityImpulse, raycast, spawnBoxArea, spawnSphereArea
- Collisions: onEntityCollisionStart/End, onBlockCollisionStart/End
- UI: uiElement, setCrosshair, setBlockSelector, getScreenPosition, setUIOptions
- Audio: playSound, playSoundAtPosition | Chat: sendChatMessage
- Persistent Data: getPlayerPersistentData, setPlayerPersistentData, leaderboards.defineLeaderboard, leaderboards.getPlayerScore, leaderboards.setPlayerScore, leaderboards.getTopScores, leaderboards.getScoresForPlayers

## Your Game
<!---Add context about your specific game below so the AI understands what you're building.-->

<!-- Example:
- Survival game where players survive 13 nights
- Zombies spawn at night with increasing difficulty
- Players assigned to campfire teams of up to 4
-->
