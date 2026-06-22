/** Arena quiz topics — must match backend/data/defaultQuestions.js */
export const GAME_TOPICS = [
  "Solana Ecosystem",
  "Crypto History",
  "DeFi Fundamentals",
  "NFT Markets",
  "Web3 Development",
  "Blockchain Tech",
  "Trading & Markets",
  "Bitcoin",
  "Ethereum",
] as const;

export type GameTopic = (typeof GAME_TOPICS)[number];

/** Fixed entry fee for every match (smart contract will enforce later). */
export const FIXED_ENTRY_FEE_SOL = "0.001";
export const FIXED_ENTRY_FEE_LAMPORTS = "1000000";
export const ENABLE_ONCHAIN_ESCROW = import.meta.env.VITE_ENABLE_ONCHAIN_ESCROW === "true";

export function pickArenaTopic(): GameTopic {
  return GAME_TOPICS[Math.floor(Math.random() * GAME_TOPICS.length)];
}
