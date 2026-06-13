function toJsonSafe(value) {
  return JSON.parse(
    JSON.stringify(value, (_key, innerValue) => (
      typeof innerValue === 'bigint' ? innerValue.toString() : innerValue
    )),
  );
}

export { toJsonSafe };
