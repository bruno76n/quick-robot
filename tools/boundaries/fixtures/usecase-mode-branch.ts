// NEGATIVE FIXTURE — linted as if it lived in packages/server/src/usecases. Must be rejected (docs/02 §7.6).
export function broken(mode: string) {
  if (mode === 'cloud') return 1;
  return 0;
}
