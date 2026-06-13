import crypto from "crypto";

export function hashlobbyid(lobbyId) {
  return crypto
    .createHash("sha256")
    .update(lobbyId)
    .digest();
}