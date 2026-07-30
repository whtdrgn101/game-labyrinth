import type {
  BoardProps as KernelBoardProps,
  GameClient as KernelGameClient,
  GameMessage,
  GamePayload,
} from '@game-hub/kernel/client';

/**
 * The UI contract and the transport DTOs it binds, both from the one specifier — `@game-hub/kernel/client`
 * (Track D / D2b). The kernel keeps `Payload`/`Message` generic rather than baking them in (dropping two
 * type parameters would be a breaking arity change), so every game writes these two aliases once and then
 * works in a single type argument.
 */
export type GameClient<S> = KernelGameClient<S, GamePayload<S>, GameMessage>;
export type BoardProps<S> = KernelBoardProps<S, GamePayload<S>, GameMessage>;
