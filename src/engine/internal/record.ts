// Labyrinth's `record()` is the shared kernel one verbatim — apply the changes, bump `version`, append one
// log entry — so it re-exports rather than re-implements. It is the ONE place `version`/`log` may be touched
// (every mechanic from L1 on goes through it), and everything it records is public: anything the engine logs
// is on the wire, so a hidden value (a player's face-down stack) must never appear in a payload.
export { record } from '@game-hub/kernel';
