import { getSignerInfo, signCanonicalResult } from '../services/signerService.js';

function getSigner(_req, res) {
  res.json({ signer: getSignerInfo() });
}

function devSign(req, res) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  const { payload } = req.body || {};
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'payload object is required' });
  }

  return res.json({ signedResult: signCanonicalResult(payload) });
}

export {
  getSigner,
  devSign,
};
