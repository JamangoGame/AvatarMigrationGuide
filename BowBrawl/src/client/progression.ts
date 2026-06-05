import * as J from "jamango";
import { showNotification } from "./ui";
import { PlayerTrait } from "../traits";

const killStreakData = [
  { text: "", style: "" }, // 0 kills (shouldn't happen)
  { text: "Killed ", style: "" }, // 1 kill
  { text: "🤝 Double Tap", style: "color: #90EE90; font-size: 21px;" },
  { text: "🥭 Mango Rush", style: "color: #FFD700; font-size: 22px;" },
  { text: "💥 Quad Kill", style: "color: #FFD700; font-size: 23px;" },
  {
    text: "🗡️ Penta Kill",
    style: "color: #FF8C00; animation: bounce 0.5s; font-size: 24px;",
  },
  {
    text: "😵 What??",
    style: "color: #FF8C00; animation: bounce 0.5s; font-size: 24px;",
  },
  {
    text: "❤️‍🔥 Ultra Kill",
    style: "color: #9370DB; animation: pulse 0.8s infinite; font-size: 26px;",
  },
  {
    text: "✨ M-M-MONSTER KILL",
    style: "color: #9370DB; animation: pulse 0.8s infinite; font-size: 26px;",
  },
  {
    text: "🕶️ It's nothing..",
    style: "color: #9370DB; animation: pulse 0.8s infinite; font-size: 26px;",
  },
  {
    text: "💣 RAMPAGE",
    style:
      "color: #FF1493; animation: rainbow 1s infinite, shake 0.3s; font-size: 28px;",
  },
  {
    text: "🕯️ ????",
    style:
      "color: #FF1493; animation: rainbow 1s infinite, shake 0.3s; font-size: 28px;",
  },
  {
    text: "😹 GODLIKE",
    style:
      "color: #FF1493; animation: rainbow 1s infinite, shake 0.3s; font-size: 29px;",
  },
  {
    text: "🌶️ LEGENDARY",
    style:
      "color: #FF1493; animation: rainbow 1s infinite, shake 0.3s; font-size: 29px;",
  },
  {
    text: "💀 Sicko",
    style:
      "color: #FF1493; animation: rainbow 0.9s infinite, shake 0.3s; font-size: 30px;",
  },
  {
    text: "🗿 Mogged",
    style:
      "color: #FF1493; animation: rainbow 0.9s infinite, shake 0.3s; font-size: 30px;",
  },
  {
    text: "📈 Killsmaxxing",
    style:
      "color: #FF1493; animation: rainbow 0.8s infinite, shake 0.3s; font-size: 31px;",
  },
  {
    text: "😹 Sigma",
    style:
      "color: #FF1493; animation: rainbow 0.8s infinite, shake 0.3s; font-size: 31px;",
  },
  {
    text: "🥵 GYATT DAMN",
    style:
      "color: #FF1493; animation: rainbow 0.7s infinite, shake 0.3s; font-size: 32px;",
  },
  {
    text: "💰 INSANE",
    style:
      "color: #FF1493; animation: rainbow 0.7s infinite, shake 0.3s; font-size: 32px;",
  },
  {
    text: "👁️✨👁️",
    style:
      "color: #FF1493; animation: rainbow 0.6s infinite, shake 0.3s; font-size: 33px;",
  },
];

export function onKill(victimName: string, killStreak: number) {
  let streakText = "";
  let flavorText = "";
  let customStyle = "";

  // Build streak display based on streak count
  if (killStreak >= 2) {
    streakText = `<span style="color: #FFD700;">${killStreak}x</span>`;
  }

  // Get flavor text and style from array
  const index = Math.min(killStreak, killStreakData.length - 1);
  flavorText = killStreakData[index].text;
  customStyle = killStreakData[index].style;

  // For streaks beyond the array, use the last entry with increased effects
  if (killStreak > killStreakData.length - 1) {
    const extraScale = Math.min(5, killStreak - killStreakData.length + 1);
    customStyle = `
      color: #FF1493;
      animation: rainbow 0.5s infinite, shake 0.3s;
      font-size: ${33 + extraScale}px;
    `;
  }

  showNotification(
    `${flavorText} ${streakText} 🏹 ${victimName}`,
    2,
    customStyle
  );
}

// // DEBUG: Press N to trigger kill notification
// let debugStreak = 0;
// J.onControlPress("n", () => {
//   debugStreak++;
//   onKill("TESTING", debugStreak);
// });

// Add CSS animations to document if not already added
if (typeof document !== "undefined") {
  const styleId = "progression-animations";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
      }
      @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
      }
      @keyframes rainbow {
        0% { color: #FF1493; }
        20% { color: #FF8C00; }
        40% { color: #FFD700; }
        60% { color: #00FF00; }
        80% { color: #1E90FF; }
        100% { color: #FF1493; }
      }
    `;
    document.head.appendChild(style);
  }
}
