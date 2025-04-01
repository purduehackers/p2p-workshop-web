"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  RefreshCw,
  Wifi,
  DoorOpen,
  Copy,
  Settings,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";

import { GameStateManager } from "~/lib/game/state";
import { P2PClient } from "~/lib/networking/client";
import { GameMessage, Player } from "~/lib/networking/protocol";

import { env } from "~/env";

const gameStateManager = new GameStateManager();

const SIGNALING_SERVER_URL = env.NEXT_PUBLIC_SIGNALING_SERVER_URL;

export default function TicTacToe() {
  const [state, setState] = useState(gameStateManager.getState());
  const [connectionStatus, setConnectionStatus] = useState<
    "disconnected" | "connecting" | "connected"
  >("disconnected");
  const [p2pClient, setP2PClient] = useState<P2PClient | null>(null);
  const [roomId, setRoomId] = useState<string>("");
  const [joinRoomId, setJoinRoomId] = useState<string>("");
  const [isConnectionDialogOpen, setIsConnectionDialogOpen] = useState(false);
  const [isGameSetupDialogOpen, setIsGameSetupDialogOpen] = useState(false);
  const [connectingToRoom, setConnectingToRoom] = useState(false);
  const [hostPlayer, setHostPlayer] = useState<Player>("X");
  const [startingPlayer, setStartingPlayer] = useState<Player>("X");

  useEffect(() => {
    const unsubscribe = gameStateManager.subscribe(setState);
    return () => unsubscribe();
  }, []);

  const handleMessage = (message: GameMessage) => {
    switch (message.type) {
      case "move":
        gameStateManager.makeMove(message.index);
        break;
      case "reset":
        gameStateManager.resetGame(message.startingPlayer);
        break;
      case "start":
        gameStateManager.setLocalPlayer(message.localPlayer);
        gameStateManager.setStartingPlayer(message.startingPlayer);
        gameStateManager.startGame();
        toast.success(
          `Game started! You are playing as ${message.localPlayer}`,
        );
        break;
      case "setup":
        setStartingPlayer(message.startingPlayer);
        break;
    }
  };

  const handleConnectionStateChange = (state: RTCPeerConnectionState) => {
    console.log(`Connection state changed to: ${state}`);

    if (state === "connected") {
      setConnectionStatus("connected");
      toast.success("Connected to peer");
      setIsConnectionDialogOpen(false);
      setConnectingToRoom(false);

      if (gameStateManager.getState().isHost) {
        gameStateManager.setIsHost(true);
      } else {
        gameStateManager.setIsHost(false);
      }
    } else if (
      state === "disconnected" ||
      state === "failed" ||
      state === "closed"
    ) {
      setConnectingToRoom(false);

      if (gameStateManager.getState().isHost) {
        gameStateManager.resetGame();
        toast.error("Client disconnected. Waiting for a new peer...");
      } else {
        disconnectFromPeer("Host disconnected");
      }
    }
  };

  const createNewGame = async () => {
    setConnectionStatus("connecting");
    setConnectingToRoom(true);

    try {
      const client = new P2PClient(
        handleMessage,
        handleConnectionStateChange,
        SIGNALING_SERVER_URL,
      );
      setP2PClient(client);

      const generatedRoomId = await client.createGame();
      setRoomId(generatedRoomId);

      gameStateManager.setIsHost(true);

      toast("Waiting for peer to join...");
    } catch (error) {
      console.error("Failed to create game:", error);
      toast.error("Failed to create game");
      setConnectionStatus("disconnected");
      setConnectingToRoom(false);
    }
  };

  const joinGame = async () => {
    if (!joinRoomId.trim()) {
      toast.error("Please enter a room ID");
      return;
    }

    setConnectionStatus("connecting");
    setConnectingToRoom(true);

    try {
      const client = new P2PClient(
        handleMessage,
        handleConnectionStateChange,
        SIGNALING_SERVER_URL,
      );
      setP2PClient(client);

      await client.joinGame(joinRoomId);
      setRoomId(joinRoomId);

      toast("Connecting to game room...");
    } catch (error) {
      console.error("Failed to join game:", error);
      toast.error("Failed to join game room");
      setConnectionStatus("disconnected");
      setConnectingToRoom(false);
    }
  };

  const disconnectFromPeer = (message?: string) => {
    if (p2pClient) {
      p2pClient.close();
    }
    setConnectionStatus("disconnected");
    setRoomId("");
    setJoinRoomId("");
    gameStateManager.startNewGame();
    toast(message || "Disconnected from peer");
  };

  const copyRoomIdToClipboard = () => {
    navigator.clipboard.writeText(roomId);
    toast("Room ID copied to clipboard");
  };

  const handleSquareClick = (index: number) => {
    if (state.gameStatus !== "playing") return;

    const currentPlayer = state.isXNext ? "X" : "O";
    if (state.localPlayer !== currentPlayer) {
      toast.error("Not your turn!");
      return;
    }

    const playerSymbol = gameStateManager.makeMove(index);

    if (playerSymbol && connectionStatus === "connected" && p2pClient) {
      p2pClient.sendMessage({
        type: "move",
        index,
        player: playerSymbol as Player,
      });
    }
  };

  const handleResetGame = () => {
    if (state.isHost) {
      gameStateManager.resetGame(startingPlayer);

      if (connectionStatus === "connected" && p2pClient) {
        p2pClient.sendMessage({
          type: "reset",
          startingPlayer,
        });
      }
    } else {
      toast.info("Only the host can reset the game");
    }
  };

  const startGame = () => {
    if (!p2pClient || !state.isHost) {
      toast.error("Only the host can start the game");
      return;
    }

    const guestPlayer: Player = hostPlayer === "X" ? "O" : "X";

    const settings = p2pClient.sendStartGame(
      hostPlayer,
      guestPlayer,
      startingPlayer,
    );

    if (!settings) {
      toast.error("Failed to start game");
      return;
    }

    gameStateManager.setLocalPlayer(settings.localPlayer);
    gameStateManager.setStartingPlayer(settings.startingPlayer);
    gameStateManager.startGame();

    setIsGameSetupDialogOpen(false);

    toast.success(`Game started! You are playing as ${settings.localPlayer}`);
  };

  const updateGameSetup = (newStartingPlayer: Player) => {
    setStartingPlayer(newStartingPlayer);

    if (p2pClient && state.isHost) {
      p2pClient.sendGameSetup(newStartingPlayer);
    }
  };

  return (
    <>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>
              {state.gameStatus === "playing" && (
                <>
                  Next Player: {state.isXNext ? "X" : "O"}
                  {state.localPlayer &&
                    ` (${state.localPlayer === (state.isXNext ? "X" : "O") ? "Your Turn" : "Waiting"})`}
                </>
              )}
              {state.gameStatus === "won" && `Winner: ${state.winner}`}
              {state.gameStatus === "draw" && "Game Draw"}
              {state.gameStatus === "new" && "New Game"}
              {state.gameStatus === "waiting" && "Waiting for Host"}
              {state.gameStatus === "setup" && "Game Setup"}
            </span>
            <div className="flex gap-2">
              {state.isHost && state.gameStatus === "setup" && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsGameSetupDialogOpen(true)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  if (connectionStatus === "disconnected") {
                    setIsConnectionDialogOpen(true);
                  } else {
                    disconnectFromPeer();
                  }
                }}
              >
                {connectionStatus === "disconnected" && (
                  <Wifi className="h-4 w-4" />
                )}
                {connectionStatus === "connecting" && (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                )}
                {connectionStatus === "connected" && (
                  <DoorOpen className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardTitle>
          {roomId && connectionStatus !== "disconnected" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Room: {roomId}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={copyRoomIdToClipboard}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          )}
          {state.localPlayer && (
            <div className="text-sm text-muted-foreground">
              You are playing as: {state.localPlayer}
            </div>
          )}
        </CardHeader>

        <CardContent>
          {state.gameStatus === "new" && (
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>New game</AlertTitle>
              <AlertDescription>
                Start a new game or join an existing one.
              </AlertDescription>
            </Alert>
          )}

          {state.gameStatus === "waiting" && (
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Waiting for host</AlertTitle>
              <AlertDescription>
                The host is setting up the game. Please wait.
              </AlertDescription>
            </Alert>
          )}

          {state.gameStatus === "setup" && state.isHost && (
            <Alert className="mb-4 w-full flex flex-col">
              <div className="flex flex-row w-full gap-2">
                <Settings className="h-4 w-4 mt-1" />
                <div className="flex flex-col w-fit">
                  <AlertTitle>Game Setup</AlertTitle>
                  <AlertDescription>
                    Click the settings icon to configure the game, or the button
                    below to start with current settings.
                  </AlertDescription>
                </div>
              </div>
              <Button className="mt-2 w-full" onClick={startGame}>
                Start Game
              </Button>
            </Alert>
          )}

          <GameBoard board={state.board} onClick={handleSquareClick} />
        </CardContent>

        {["won", "draw"].includes(state.gameStatus) && state.isHost && (
          <CardFooter>
            <Button
              onClick={handleResetGame}
              className="w-full"
              disabled={connectionStatus !== "connected" || !state.isHost}
            >
              Reset Game
            </Button>
          </CardFooter>
        )}
      </Card>

      <Dialog
        open={isConnectionDialogOpen}
        onOpenChange={setIsConnectionDialogOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect to Peer</DialogTitle>
            <DialogDescription>
              Create a new game or join an existing one by entering a room ID.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger disabled={connectingToRoom} value="create">
                Create Game
              </TabsTrigger>
              <TabsTrigger disabled={connectingToRoom} value="join">
                Join Game
              </TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="mt-4">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Create a new game and share the room ID with your friend.
                </p>

                {roomId && (
                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="roomId">Room ID</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        id="roomId"
                        value={roomId}
                        readOnly
                        className="flex-1"
                      />
                      <Button size="icon" onClick={copyRoomIdToClipboard}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={createNewGame}
                  disabled={connectingToRoom}
                >
                  {connectingToRoom ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create New Game"
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="join" className="mt-4">
              <div className="space-y-4">
                <div className="flex flex-col space-y-2">
                  <Label htmlFor="joinRoomId">Room ID</Label>
                  <Input
                    id="joinRoomId"
                    placeholder="Enter room ID"
                    value={joinRoomId}
                    onChange={(e) => setJoinRoomId(e.target.value)}
                  />
                </div>

                <Button
                  className="w-full"
                  onClick={joinGame}
                  disabled={connectingToRoom}
                >
                  {connectingToRoom ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Joining...
                    </>
                  ) : (
                    "Join Game"
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setConnectingToRoom(false);
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={isGameSetupDialogOpen && state.isHost}
        onOpenChange={setIsGameSetupDialogOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Game Setup</DialogTitle>
            <DialogDescription>
              Configure your game settings as the host.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Your Player Symbol</Label>
              <RadioGroup
                value={hostPlayer}
                onValueChange={(value) => setHostPlayer(value as Player)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="X" id="player-x" />
                  <Label htmlFor="player-x">X</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="O" id="player-o" />
                  <Label htmlFor="player-o">O</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="starting-player">Starting Player</Label>
              <Select
                value={startingPlayer}
                onValueChange={(value) => updateGameSetup(value as Player)}
              >
                <SelectTrigger id="starting-player">
                  <SelectValue placeholder="Select who starts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="X">X starts first</SelectItem>
                  <SelectItem value="O">O starts first</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="pt-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Game Summary</AlertTitle>
                <AlertDescription>
                  You will play as {hostPlayer}. Your opponent will play as{" "}
                  {hostPlayer === "X" ? "O" : "X"}. {startingPlayer} will make
                  the first move.
                </AlertDescription>
              </Alert>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsGameSetupDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={startGame}>Start Game</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface GameBoardProps {
  board: (string | null)[];
  onClick: (index: number) => void;
}

function GameBoard({ board, onClick }: GameBoardProps) {
  return (
    <div className="grid grid-cols-3 gap-2 aspect-square">
      {board.map((value, index) => (
        <Square key={index} value={value} onClick={() => onClick(index)} />
      ))}
    </div>
  );
}

interface SquareProps {
  value: string | null;
  onClick: () => void;
}

function Square({ value, onClick }: SquareProps) {
  return (
    <Button
      variant="outline"
      className="h-full w-full text-3xl font-bold flex items-center justify-center aspect-square"
      onClick={onClick}
    >
      {value}
    </Button>
  );
}
