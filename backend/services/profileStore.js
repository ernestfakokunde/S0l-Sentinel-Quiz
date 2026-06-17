import fs from 'fs/promises';
import path from 'path';

const PROFILE_FILE = path.resolve('backend/data/profiles.json');
const profiles = new Map();

async function loadProfiles() {
  try {
    const raw = await fs.readFile(PROFILE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    Object.entries(parsed).forEach(([wallet, profile]) => profiles.set(wallet, profile));
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn('Could not load profiles:', err.message);
  }
}

async function saveProfiles() {
  const payload = Object.fromEntries(profiles.entries());
  await fs.writeFile(PROFILE_FILE, `${JSON.stringify(payload, null, 2)}\n`);
}

function defaultProfile(wallet) {
  const short = wallet ? `${wallet.slice(0, 4)}...${wallet.slice(-4)}` : 'Guest';
  return {
    wallet,
    username: short,
    avatar: '👨‍🚀',
    bio: 'Sol Quiz Arena competitor',
    favoriteTopic: 'Solana Ecosystem',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function getProfile(wallet) {
  if (!wallet) return null;
  return profiles.get(wallet) || defaultProfile(wallet);
}

async function upsertProfile(wallet, input = {}) {
  if (!wallet) throw new Error('wallet is required');
  const existing = profiles.get(wallet) || defaultProfile(wallet);
  const profile = {
    ...existing,
    wallet,
    username: String(input.username || existing.username).trim().slice(0, 32) || existing.username,
    avatar: String(input.avatar || existing.avatar).slice(0, 8) || existing.avatar,
    bio: String(input.bio || existing.bio).trim().slice(0, 140) || existing.bio,
    favoriteTopic: String(input.favoriteTopic || existing.favoriteTopic).trim().slice(0, 48) || existing.favoriteTopic,
    updatedAt: new Date().toISOString(),
  };

  profiles.set(wallet, profile);
  await saveProfiles();
  return profile;
}

await loadProfiles();

export {
  getProfile,
  upsertProfile,
};
