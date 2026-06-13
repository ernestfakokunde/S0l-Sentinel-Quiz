import crypto from 'crypto';

let cachedKeyPair;

function normalizePem(value) {
  return value ? value.replace(/\\n/g, '\n') : value;
}

function loadKeyPair() {
  if (cachedKeyPair) return cachedKeyPair;

  const privateKeyPem = normalizePem(process.env.RESULT_SIGNER_PRIVATE_KEY_PEM);
  const privateKeyDerB64 = process.env.RESULT_SIGNER_PRIVATE_KEY_DER_BASE64;

  if (privateKeyPem) {
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    const publicKey = crypto.createPublicKey(privateKey);
    cachedKeyPair = { privateKey, publicKey, ephemeral: false };
    return cachedKeyPair;
  }

  if (privateKeyDerB64) {
    const privateKey = crypto.createPrivateKey({
      key: Buffer.from(privateKeyDerB64, 'base64'),
      format: 'der',
      type: 'pkcs8',
    });
    const publicKey = crypto.createPublicKey(privateKey);
    cachedKeyPair = { privateKey, publicKey, ephemeral: false };
    return cachedKeyPair;
  }

  const generated = crypto.generateKeyPairSync('ed25519');
  cachedKeyPair = { ...generated, ephemeral: true };
  console.warn('RESULT_SIGNER_PRIVATE_KEY_PEM not set. Using an ephemeral DEV Ed25519 signer.');
  return cachedKeyPair;
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function getRawPublicKeyBase64(publicKey) {
  const jwk = publicKey.export({ format: 'jwk' });
  return Buffer.from(jwk.x, 'base64url').toString('base64');
}

function getSignerInfo() {
  const { publicKey, ephemeral } = loadKeyPair();
  return {
    algorithm: 'ed25519',
    publicKeyBase64: getRawPublicKeyBase64(publicKey),
    ephemeral,
  };
}

function signCanonicalResult(payload) {
  const { privateKey, publicKey, ephemeral } = loadKeyPair();
  const canonical = stableStringify(payload);
  const message = Buffer.from(canonical, 'utf8');
  const signature = crypto.sign(null, message, privateKey);
  const resultHash = crypto.createHash('sha256').update(message).digest('base64');

  return {
    algorithm: 'ed25519',
    canonical,
    messageBase64: message.toString('base64'),
    signatureBase64: signature.toString('base64'),
    publicKeyBase64: getRawPublicKeyBase64(publicKey),
    resultHash,
    ephemeralSigner: ephemeral,
  };
}

export {
  getSignerInfo,
  signCanonicalResult,
  stableStringify,
};
