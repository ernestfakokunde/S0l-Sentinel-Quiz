import { getProfile, upsertProfile } from '../services/profileStore.js';

async function readProfile(req, res) {
  try {
    const profile = await getProfile(req.params.wallet);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    return res.json({ profile });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function saveProfile(req, res) {
  try {
    const profile = await upsertProfile(req.params.wallet, req.body || {});
    return res.json({ profile });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export {
  readProfile,
  saveProfile,
};
