export type Player = "X" | "O";

export interface GameMove {
  type: "move";
  index: number;
  player: Player;
}

export interface GameReset {
  type: "reset";
  startingPlayer: Player;
}

export interface GameStart {
  type: "start";
  localPlayer: Player;
  startingPlayer: Player;
}

export interface GameSetup {
  type: "setup";
  startingPlayer: Player;
}

export type GameMessage = GameMove | GameReset | GameStart | GameSetup;

export function encodeMessage(message: GameMessage): string {
  return JSON.stringify(message);
}

export function decodeMessage(data: string): GameMessage {
  return JSON.parse(data);
}
