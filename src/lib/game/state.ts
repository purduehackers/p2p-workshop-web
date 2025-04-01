import {
  GameState,
  initialGameState,
  makeMove,
  resetGame,
  startNewGame,
  Player,
} from "./logic";

export class GameStateManager {
  private state: GameState;
  private listeners: ((state: GameState) => void)[] = [];

  constructor() {
    this.state = initialGameState;
  }

  getState(): GameState {
    return this.state;
  }

  subscribe(listener: (state: GameState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.state));
  }

  makeMove(index: number) {
    this.state = makeMove(this.state, index);
    this.notify();
    return this.state.board[index];
  }

  setIsHost(isHost: boolean) {
    this.state = {
      ...this.state,
      isHost,
      gameStatus: isHost ? "setup" : "waiting",
    };
    this.notify();
  }

  setLocalPlayer(player: Player) {
    this.state = {
      ...this.state,
      localPlayer: player,
    };
    this.notify();
  }

  setStartingPlayer(player: Player) {
    this.state = {
      ...this.state,
      isXNext: player === "X",
    };
    this.notify();
  }

  startGame() {
    this.state = {
      ...this.state,
      gameStatus: "playing",
    };
    this.notify();
  }

  resetGame(startingPlayer?: Player) {
    const player = startingPlayer || (this.state.isXNext ? "X" : "O");
    this.state = resetGame(this.state, player);
    this.notify();
  }

  startNewGame() {
    this.state = startNewGame();
    this.notify();
  }
}
