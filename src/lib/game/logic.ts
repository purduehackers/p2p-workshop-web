export type Player = "X" | "O";
export type GameStatus =
  | "playing"
  | "won"
  | "draw"
  | "waiting"
  | "setup"
  | "new";

export interface GameState {
  board: (Player | null)[];
  isXNext: boolean;
  gameStatus: GameStatus;
  winner: Player | null;
  localPlayer: Player | null;
  isHost: boolean;
}

export const initialGameState: GameState = {
  board: Array(9).fill(null),
  isXNext: true,
  gameStatus: "new",
  winner: null,
  localPlayer: null,
  isHost: false,
};

export function calculateWinner(board: (Player | null)[]): Player | null {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];

  for (let i = 0; i < lines.length; i++) {
    const [a, b, c] = lines[i];
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }

  return null;
}

export function makeMove(state: GameState, index: number): GameState {
  if (state.gameStatus !== "playing") {
    return state;
  }

  const currentPlayer = state.isXNext ? "X" : "O";

  if (state.board[index]) {
    return state;
  }

  const newBoard = [...state.board];
  newBoard[index] = currentPlayer;

  const winner = calculateWinner(newBoard);
  const isDraw = newBoard.every((square) => square !== null);

  return {
    ...state,
    board: newBoard,
    isXNext: !state.isXNext,
    gameStatus: winner ? "won" : isDraw ? "draw" : "playing",
    winner,
  };
}

export function resetGame(
  state: GameState,
  startingPlayer: Player = "X",
): GameState {
  return {
    ...state,
    board: Array(9).fill(null),
    isXNext: startingPlayer === "X",
    gameStatus: state.isHost ? "setup" : "waiting",
    winner: null,
  };
}

export function startNewGame(): GameState {
  return { ...initialGameState };
}
