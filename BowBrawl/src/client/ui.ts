import * as J from "jamango";
import { PlayerTrait } from "../traits";
import { HitCommand, EnvironmentalDeathCommand } from "../commands";
import { onKill } from "./progression";

const STYLE_ID = "bb-ui-style";
const MAX_LB_ROWS = 10;
const MAX_KF_ENTRIES = 10;

let overlay: HTMLDivElement | undefined;
let textEl: HTMLDivElement | undefined;
let notifEl: HTMLDivElement | undefined;
let arrowEls: HTMLDivElement[] = [];
let arrowLabel: HTMLDivElement | undefined;
let lbRows: LbRow[] = [];
let lbCounter: HTMLDivElement | undefined;
let lbCounterText: HTMLSpanElement | undefined;
let kfContainer: HTMLDivElement | undefined;

type LbRow = {
  el: HTMLDivElement;
  rankEl: HTMLDivElement;
  nameEl: HTMLDivElement;
  killsEl: HTMLDivElement;
  deathsEl: HTMLDivElement;
  streakEl: HTMLDivElement;
  lastPlayerId: number;
  lastIsLocal: boolean;
  lastName: string;
  lastKills: number;
  lastDeaths: number;
  lastStreak: number;
  hidden: boolean;
};

let deathMessage = "";
let lastShownDeathMessage = "";
let lastShownAlive = true;
let isAlive = true;
let lastTimeAlive = 0;
let gameStartTime = 0;
let lastArrowCount = 3;
let lastOverlayColor = "";
let lastWarn = false;
let lastLabelHidden = false;
let lastArrowsHidden = false;
let lastLbCounterText = "";
let lastLbCounterHidden = false;
let isTabPressed = false;

let notificationActive = false;
let notificationHideAt = 0;

function injectStyles(): void {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = `
    #bb-overlay {
      position: fixed; inset: 0;
      pointer-events: none;
      background-color: rgba(0, 0, 0, 0);
    }

    #bb-text {
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      color: white;
      font: bold 48px Quicksand, sans-serif;
      text-align: center;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.9);
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
    }
    #bb-text.show { animation: bb-text-in 2s ease-out forwards; }
    @keyframes bb-text-in {
      0%   { opacity: 0; transform: translate(-50%, -50%) scale(1.5); }
      50%  { opacity: 0; }
      100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }

    #bb-arrow-ui {
      position: fixed; bottom: 40px; left: 50%;
      transform: translateX(-50%);
      display: flex; flex-direction: column; align-items: center;
      gap: 4px;
      pointer-events: none;
    }

    #bb-notification {
      color: white;
      font: bold 20px Quicksand, sans-serif;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.9);
      letter-spacing: 1px;
      text-align: center;
      opacity: 0;
      transition: opacity 0.2s;
    }
    #bb-notification.show {
      opacity: 1;
      animation: bb-elastic 0.4s ease-out;
    }

    #bb-arrows { display: flex; gap: 12px; }
    .bb-arrow {
      color: white;
      font: bold 50px Quicksand, sans-serif;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.9);
    }
    .bb-arrow.spent  { opacity: 0.3; }
    .bb-arrow.hidden { opacity: 0; }
    .bb-arrow.wobble { animation: bb-elastic 0.4s ease-out; }

    #bb-arrow-label {
      color: white;
      font: bold 20px Quicksand, sans-serif;
      letter-spacing: 1px;
      opacity: 0.3;
      transition: color 0.2s, opacity 0.2s;
    }
    #bb-arrow-label.warn {
      color: #ff2222;
      opacity: 1;
      animation: bb-pulse 0.3s ease-in-out infinite alternate;
    }
    #bb-arrow-label.hidden { opacity: 0; animation: none; }

    @keyframes bb-elastic {
      0%   { transform: scale(1); }
      16%  { transform: scale(2.4); }
      28%  { transform: scale(0.7); }
      44%  { transform: scale(1.3); }
      59%  { transform: scale(0.9); }
      73%  { transform: scale(1.05); }
      100% { transform: scale(1); }
    }
    @keyframes bb-pulse {
      from { transform: scale(1); }
      to   { transform: scale(1.1); }
    }

    #bb-leaderboard {
      position: fixed; top: 20px; left: 20px;
      color: white;
      font: 13px Quicksand, sans-serif;
      background-color: rgba(0, 0, 0, 0.4);
      padding: 2px;
      border-radius: 6px;
      pointer-events: none;
    }
    .bb-lb-row {
      display: grid;
      grid-template-columns: 15px 120px 35px 35px 35px;
      gap: 4px;
      align-items: center;
      padding: 4px 6px;
      background-color: rgba(0, 0, 0, 0.3);
      margin-bottom: 2px;
      border-radius: 3px;
      font-weight: bold;
      color: white;
      white-space: nowrap;
    }
    .bb-lb-row.local  { color: #FFD700; }
    .bb-lb-row.hidden { display: none; }
    .bb-lb-row > div { text-align: center; white-space: nowrap; }
    .bb-lb-row > .bb-lb-name {
      text-align: left;
      overflow: hidden; text-overflow: ellipsis;
      width: 120px;
    }
    .bb-lb-counter {
      padding: 4px 6px;
      background-color: rgba(0, 0, 0, 0.3);
      margin-top: 2px;
      border-radius: 4px;
      font-weight: bold;
      color: white;
      text-align: center;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .bb-lb-counter.hidden { display: none; }
    .bb-lb-counter > .key {
      background-color: rgba(255, 255, 255, 0.15);
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 11px;
      border: 1px solid rgba(255, 255, 255, 0.3);
    }
    .bb-lb-counter > .count { opacity: 0.8; }

    #bb-kill-feed {
      position: fixed; top: 75px; right: 20px;
      display: flex; flex-direction: column; align-items: flex-end;
      color: white;
      font: 13px Quicksand, sans-serif;
      pointer-events: none;
    }
    .bb-kf-entry {
      display: inline-block;
      padding: 4px 8px;
      background-color: rgba(0, 0, 0, 0.4);
      margin-bottom: 2px;
      border-radius: 3px;
      font-weight: bold;
      transform-origin: center center;
      animation: bb-elastic 0.4s ease-out, bb-kf-fade 1s 4s forwards;
    }
    .bb-kf-entry.local-killer { background-color: rgba(120, 120, 120, 1); }
    .bb-kf-entry .victim, .bb-kf-entry .killer { color: #ff4444; }
    @keyframes bb-kf-fade {
      from { opacity: 1; }
      to   { opacity: 0; }
    }
  `;
}

function makeEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opts?: { id?: string; className?: string; text?: string }
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (opts?.id) el.id = opts.id;
  if (opts?.className) el.className = opts.className;
  if (opts?.text !== undefined) el.textContent = opts.text;
  return el;
}

function buildLbRow(rank: number): LbRow {
  const el = makeEl("div", { className: "bb-lb-row hidden" });
  const rankEl = makeEl("div", { text: String(rank) });
  const nameEl = makeEl("div", { className: "bb-lb-name" });
  const killsEl = makeEl("div");
  const deathsEl = makeEl("div");
  const streakEl = makeEl("div");
  el.append(rankEl, nameEl, killsEl, deathsEl, streakEl);
  return {
    el, rankEl, nameEl, killsEl, deathsEl, streakEl,
    lastPlayerId: -1,
    lastIsLocal: false,
    lastName: "",
    lastKills: -1,
    lastDeaths: -1,
    lastStreak: -1,
    hidden: true,
  };
}

function buildUI(host: HTMLElement): void {
  injectStyles();

  // Hot reload: reuse existing nodes if present.
  const existing = document.getElementById("bb-overlay");
  if (existing) {
    overlay = existing as HTMLDivElement;
    textEl = document.getElementById("bb-text") as HTMLDivElement;
    notifEl = document.getElementById("bb-notification") as HTMLDivElement;
    arrowEls = Array.from(document.querySelectorAll(".bb-arrow")) as HTMLDivElement[];
    arrowLabel = document.getElementById("bb-arrow-label") as HTMLDivElement;
    const rows = Array.from(document.querySelectorAll(".bb-lb-row")) as HTMLDivElement[];
    lbRows = rows.map((r, i) => {
      const [rankEl, nameEl, killsEl, deathsEl, streakEl] = Array.from(r.children) as HTMLDivElement[];
      rankEl.textContent = String(i + 1);
      return {
        el: r, rankEl, nameEl, killsEl, deathsEl, streakEl,
        lastPlayerId: -1, lastIsLocal: false, lastName: "",
        lastKills: -1, lastDeaths: -1, lastStreak: -1,
        hidden: r.classList.contains("hidden"),
      };
    });
    lbCounter = document.querySelector(".bb-lb-counter") as HTMLDivElement;
    lbCounterText = lbCounter?.querySelector(".count") as HTMLSpanElement;
    kfContainer = document.getElementById("bb-kill-feed") as HTMLDivElement;
    return;
  }

  overlay = makeEl("div", { id: "bb-overlay" });
  textEl = makeEl("div", { id: "bb-text" });

  const arrowUI = makeEl("div", { id: "bb-arrow-ui" });
  notifEl = makeEl("div", { id: "bb-notification" });
  const arrowsContainer = makeEl("div", { id: "bb-arrows" });
  arrowEls = [];
  for (let i = 0; i < 3; i++) {
    const a = makeEl("div", { className: "bb-arrow", text: "I" });
    arrowEls.push(a);
    arrowsContainer.appendChild(a);
  }
  arrowLabel = makeEl("div", { id: "bb-arrow-label", text: "Ammo" });
  arrowUI.append(notifEl, arrowsContainer, arrowLabel);

  const lbContainer = makeEl("div", { id: "bb-leaderboard" });
  lbRows = [];
  for (let i = 0; i < MAX_LB_ROWS; i++) {
    const row = buildLbRow(i + 1);
    lbRows.push(row);
    lbContainer.appendChild(row.el);
  }
  lbCounter = makeEl("div", { className: "bb-lb-counter" });
  const lbKey = makeEl("span", { className: "key", text: "R" });
  lbCounterText = makeEl("span", { className: "count" });
  lbCounter.append(lbKey, lbCounterText);
  lbContainer.appendChild(lbCounter);

  kfContainer = makeEl("div", { id: "bb-kill-feed" });

  host.append(overlay, textEl, arrowUI, lbContainer, kfContainer);
}

function updateOverlay(t: number, respawnTime: number): void {
  if (!overlay) return;
  const gameStartFadeIn = Math.max(0, 1 - (t - gameStartTime) / 2);
  const respawnFadeInOut = respawnTime > 0
    ? Math.max(0, 1 - Math.abs(respawnTime - t))
    : 0;
  const darkFadeAlpha = Math.max(gameStartFadeIn, respawnFadeInOut);

  let color: string;
  if (isAlive) {
    color = darkFadeAlpha > 0
      ? `rgba(0, 0, 0, ${darkFadeAlpha.toFixed(3)})`
      : "rgba(0, 0, 0, 0)";
  } else {
    const deathElapsed = t - lastTimeAlive;
    const deathFade = Math.min(1, deathElapsed / 3);
    const redOpacity = 0.8 - deathFade * 0.6;
    const finalAlpha = Math.max(darkFadeAlpha, redOpacity);
    color = darkFadeAlpha > 0
      ? `rgba(0, 0, 0, ${finalAlpha.toFixed(3)})`
      : `rgba(139, 0, 0, ${redOpacity.toFixed(3)})`;
  }
  if (color !== lastOverlayColor) {
    overlay.style.backgroundColor = color;
    lastOverlayColor = color;
  }
}

function syncDeathText(): void {
  if (!textEl) return;
  if (!isAlive) {
    const changed = lastShownAlive || lastShownDeathMessage !== deathMessage;
    if (changed) {
      textEl.innerHTML = deathMessage;
      lastShownDeathMessage = deathMessage;
      textEl.classList.remove("show");
      void textEl.offsetWidth;
      textEl.classList.add("show");
    }
    lastShownAlive = false;
  } else if (!lastShownAlive) {
    textEl.classList.remove("show");
    lastShownAlive = true;
  }
}

function wobbleArrow(prev: number, curr: number): void {
  const idx = Math.min(prev, curr);
  if (idx < 0 || idx >= arrowEls.length) return;
  const el = arrowEls[idx];
  el.classList.remove("wobble");
  void el.offsetWidth;
  el.classList.add("wobble");
}

function updateArrows(arrowCount: number): void {
  if (arrowCount !== lastArrowCount) {
    if (isAlive) wobbleArrow(lastArrowCount, arrowCount);
    lastArrowCount = arrowCount;
  }
  const hidden = !isAlive;
  if (hidden !== lastArrowsHidden) {
    for (const el of arrowEls) el.classList.toggle("hidden", hidden);
    lastArrowsHidden = hidden;
  }
  if (!hidden) {
    for (let i = 0; i < arrowEls.length; i++) {
      arrowEls[i].classList.toggle("spent", i >= arrowCount);
    }
  }
}

function updateArrowLabel(arrowCount: number, localId: J.EntityId): void {
  if (!arrowLabel) return;
  let warn = false;
  if (isAlive && arrowCount === 0) {
    const input = J.getCharacterInput(localId);
    if (input && input.isPrimaryDown) warn = true;
  }
  const hidden = !isAlive;
  if (hidden !== lastLabelHidden) {
    arrowLabel.classList.toggle("hidden", hidden);
    lastLabelHidden = hidden;
  }
  if (warn !== lastWarn) {
    arrowLabel.classList.toggle("warn", warn);
    lastWarn = warn;
  }
}

function updateLeaderboard(localId: J.EntityId): void {
  if (!lbCounter || !lbCounterText) return;
  const allPlayers = J.getAllWithTraits([PlayerTrait]);
  const stats: Array<{ id: J.EntityId; name: string; kills: number; deaths: number; killStreak: number }> = [];
  for (const [pid, pt] of allPlayers) {
    if (!pt) continue;
    stats.push({
      id: pid,
      name: pt.name,
      kills: pt.kills,
      deaths: pt.deathCount,
      killStreak: pt.killStreak,
    });
  }
  stats.sort((a, b) => b.kills - a.kills);
  const visible = isTabPressed ? MAX_LB_ROWS : 5;
  const top = stats.slice(0, visible);

  for (let i = 0; i < lbRows.length; i++) {
    const row = lbRows[i];
    if (i >= top.length) {
      if (!row.hidden) {
        row.el.classList.add("hidden");
        row.hidden = true;
        row.lastPlayerId = -1;
      }
      continue;
    }
    if (row.hidden) {
      row.el.classList.remove("hidden");
      row.hidden = false;
    }
    const p = top[i];
    const isLocal = p.id === localId;
    if (isLocal !== row.lastIsLocal) {
      row.el.classList.toggle("local", isLocal);
      row.lastIsLocal = isLocal;
    }
    const playerChanged = row.lastPlayerId !== p.id;
    const crown = i === 0 ? "👑 " : "";
    const name = `${crown}${p.name.substring(0, 16)}`;
    if (playerChanged || row.lastName !== name) {
      row.nameEl.textContent = name;
      row.lastName = name;
    }
    if (playerChanged || row.lastDeaths !== p.deaths) {
      row.deathsEl.textContent = `💀 ${p.deaths}`;
      row.lastDeaths = p.deaths;
    }
    if (playerChanged || row.lastKills !== p.kills) {
      row.killsEl.textContent = `🏹 ${p.kills}`;
      row.lastKills = p.kills;
    }
    if (playerChanged || row.lastStreak !== p.killStreak) {
      row.streakEl.textContent = p.killStreak >= 2 ? `🔥 ${p.killStreak}` : "";
      row.lastStreak = p.killStreak;
    }
    row.lastPlayerId = p.id;
  }

  const total = stats.length;
  const counterText = `${total} player${total !== 1 ? "s" : ""}`;
  if (counterText !== lastLbCounterText) {
    lbCounterText.textContent = counterText;
    lastLbCounterText = counterText;
  }
  if (isTabPressed !== lastLbCounterHidden) {
    lbCounter.classList.toggle("hidden", isTabPressed);
    lastLbCounterHidden = isTabPressed;
  }
}

function pushKillFeedEntry(opts: {
  killerName: string;
  victimName: string;
  isLocalPlayerKiller: boolean;
  isEnvironmental?: boolean;
}): void {
  if (!kfContainer) return;
  const el = makeEl("div", { className: "bb-kf-entry" });
  if (opts.isLocalPlayerKiller) el.classList.add("local-killer");

  if (opts.isEnvironmental) {
    const victim = makeEl("span", { className: "victim", text: opts.victimName });
    el.append("💀 ", victim);
  } else {
    const killer = makeEl("span", { className: "killer", text: opts.killerName });
    const victim = makeEl("span", { className: "victim", text: opts.victimName });
    el.append(killer, " 🏹 ", victim);
  }

  el.addEventListener("animationend", (ev) => {
    if ((ev as AnimationEvent).animationName === "bb-kf-fade") el.remove();
  });

  kfContainer.appendChild(el);
  while (kfContainer.children.length > MAX_KF_ENTRIES) {
    kfContainer.firstElementChild?.remove();
  }
}

export function setDeathMessage(message: string): void {
  deathMessage = message;
}

export function showNotification(text: string, duration: number = 3, customStyle: string = ""): void {
  if (!notifEl) return;
  notifEl.classList.remove("show");
  void notifEl.offsetWidth;
  notifEl.style.cssText = customStyle;
  notifEl.innerHTML = text;
  notifEl.classList.add("show");
  notificationActive = true;
  notificationHideAt = J.getWorldTime() + duration;
}

function hideNotification(): void {
  if (!notifEl || !notificationActive) return;
  notifEl.classList.remove("show");
  notificationActive = false;
}

J.onGameStart(() => {
  const host = J.uiElement;
  if (!host) return;
  buildUI(host);
  gameStartTime = J.getWorldTime();
  lastTimeAlive = gameStartTime;
});

J.onGameTick((_dt, t) => {
  const id = J.getLocalPlayer();
  if (id === undefined) return;
  const player = J.getTrait(id, PlayerTrait);
  if (!player) return;

  isAlive = J.getCharacterAlive(id);
  if (isAlive) lastTimeAlive = t;

  syncDeathText();
  updateOverlay(t, player.respawnTime);
  updateArrows(player.arrowCount);
  updateArrowLabel(player.arrowCount, id);
  updateLeaderboard(id);

  if (notificationActive && (t >= notificationHideAt || !isAlive)) {
    hideNotification();
  }
});

J.net.listen(HitCommand, (data, _senderId) => {
  const localPlayerId = J.getLocalPlayer();
  const killerTrait = J.getTrait(data.attackerId, PlayerTrait);
  const victimTrait = J.getTrait(data.victimId, PlayerTrait);
  const killerName = (killerTrait?.name || "Unknown").substring(0, 16);
  const victimName = (victimTrait?.name || "Unknown").substring(0, 16);

  pushKillFeedEntry({
    killerName,
    victimName,
    isLocalPlayerKiller: data.attackerId === localPlayerId,
  });

  if (data.attackerId === localPlayerId && data.victimId !== localPlayerId) {
    const killStreak = killerTrait?.killStreak || 1;
    onKill(victimTrait?.name || "Unknown", killStreak);
  }

  if (data.victimId === localPlayerId) {
    if (data.attackerId === localPlayerId) {
      setDeathMessage(`You 💀 died<br><span style="font-size: 32px;">you hit yourself</span>`);
    } else {
      setDeathMessage(`You 💀 died<br><span style="font-size: 24px;">killed by ${killerName}.</span>`);
    }
  }
});

J.net.listen(EnvironmentalDeathCommand, (data, _senderId) => {
  const victimTrait = J.getTrait(data.victimId, PlayerTrait);
  const victimName = (victimTrait?.name || "Unknown").substring(0, 16);
  pushKillFeedEntry({
    killerName: "",
    victimName,
    isLocalPlayerKiller: false,
    isEnvironmental: true,
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "r" || event.key === "R") isTabPressed = true;
});
document.addEventListener("keyup", (event) => {
  if (event.key === "r" || event.key === "R") isTabPressed = false;
});
