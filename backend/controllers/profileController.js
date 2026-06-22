import { getProfile, upsertProfile } from '../services/profileStore.js';

async function readProfile(req, res) {
  try {
    const profile = await getProfile(req.params.wallet);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    return res.json({ profile });
  } catch (err) {
    console.error('Profile lookup failed', err);
    return res.status(500).json({ error: 'Profile could not be loaded' });
  }
}

async function saveProfile(req, res) {
  try {
    const profile = await upsertProfile(req.params.wallet, req.body || {});
    return res.json({ profile });
  } catch (err) {
    console.error('Profile save failed', err);
    return res.status(400).json({ error: 'Profile could not be saved' });
  }
}

export {
  readProfile,
  saveProfile,
};
