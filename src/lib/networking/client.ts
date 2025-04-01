import { encodeMessage, decodeMessage, GameMessage, Player } from "./protocol";
import { SignalingService } from "./signaling";

export class P2PClient {
  private peerConnection: RTCPeerConnection;
  private dataChannel: RTCDataChannel | null = null;
  private onMessage: (message: GameMessage) => void;
  private onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  private signaling: SignalingService;
  private isOfferer: boolean = false;
  private isHost: boolean = false;
  public roomId: string | null = null;

  constructor(
    onMessage: (message: GameMessage) => void,
    onConnectionStateChange: (state: RTCPeerConnectionState) => void,
    signalUrl: string,
  ) {
    const configuration = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun.l.google.com:5349" },
        { urls: "stun:stun1.l.google.com:3478" },
        { urls: "stun:stun1.l.google.com:5349" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:5349" },
        { urls: "stun:stun3.l.google.com:3478" },
        { urls: "stun:stun3.l.google.com:5349" },
        { urls: "stun:stun4.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:5349" },
      ],
    };

    this.peerConnection = new RTCPeerConnection(configuration);
    this.onMessage = onMessage;
    this.onConnectionStateChange = onConnectionStateChange;
    this.signaling = new SignalingService(signalUrl);

    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannel();
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling
          .sendCandidate(event.candidate, this.isOfferer)
          .catch((err) => console.error("Error sending ICE candidate:", err));
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      console.log(
        "Connection state changed:",
        this.peerConnection.connectionState,
      );
      this.onConnectionStateChange(this.peerConnection.connectionState);
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log(
        "ICE connection state:",
        this.peerConnection.iceConnectionState,
      );
    };
  }

  private setupDataChannel() {
    if (!this.dataChannel) return;

    this.dataChannel.onmessage = (event) => {
      try {
        const message = decodeMessage(event.data);
        this.onMessage(message);
      } catch (error) {
        console.error("Failed to decode message:", error);
      }
    };

    this.dataChannel.onopen = () => {
      console.log("Data channel is open");
      if (this.peerConnection.connectionState === "connected") {
        this.onConnectionStateChange("connected");
      }
    };

    this.dataChannel.onclose = () => {
      console.log("Data channel is closed");
    };

    this.dataChannel.onerror = (error) => {
      console.error("Data channel error:", error);
      if (!this.isHost) {
        this.onConnectionStateChange("disconnected");
      }
    };
  }

  async createGame(): Promise<string> {
    try {
      this.isOfferer = true;
      this.isHost = true;

      const roomId = await this.signaling.createRoom();
      this.roomId = roomId;
      this.signaling.setRoomId(roomId);

      this.dataChannel = this.peerConnection.createDataChannel("game");
      this.setupDataChannel();

      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      await this.signaling.sendOffer(offer);

      this.signaling.pollForAnswer(async (answer) => {
        console.log("Received answer from peer");
        try {
          await this.peerConnection.setRemoteDescription(
            new RTCSessionDescription(answer),
          );
        } catch (error) {
          console.error("Error setting remote description:", error);
        }
      });

      this.signaling.pollForCandidates(async (candidate) => {
        console.log("Received ICE candidate from answerer");
        try {
          await this.peerConnection.addIceCandidate(
            new RTCIceCandidate(candidate),
          );
        } catch (error) {
          console.error("Error adding ICE candidate:", error);
        }
      }, this.isOfferer);

      return roomId;
    } catch (error) {
      console.error("Error creating game:", error);
      throw error;
    }
  }

  async joinGame(roomId: string): Promise<string> {
    try {
      this.isOfferer = false;
      this.isHost = false;
      this.roomId = roomId;
      this.signaling.setRoomId(roomId);

      const roomExists = await this.signaling.checkRoom(roomId);
      if (!roomExists) {
        throw new Error("Game room not found");
      }

      this.signaling.pollForOffer(async (offer) => {
        console.log("Received offer from peer");
        try {
          await this.peerConnection.setRemoteDescription(
            new RTCSessionDescription(offer),
          );

          const answer = await this.peerConnection.createAnswer();
          await this.peerConnection.setLocalDescription(answer);

          await this.signaling.sendAnswer(answer);
        } catch (error) {
          console.error("Error handling offer:", error);
        }
      });

      this.signaling.pollForCandidates(async (candidate) => {
        console.log("Received ICE candidate from offerer");
        try {
          await this.peerConnection.addIceCandidate(
            new RTCIceCandidate(candidate),
          );
        } catch (error) {
          console.error("Error adding ICE candidate:", error);
        }
      }, this.isOfferer);

      return roomId;
    } catch (error) {
      console.error("Error joining game:", error);
      throw error;
    }
  }

  isGameHost(): boolean {
    return this.isHost;
  }

  sendStartGame(
    hostPlayer: Player,
    guestPlayer: Player,
    startingPlayer: Player,
  ) {
    if (!this.isHost) {
      console.error("Only the host can start the game and assign players");
      return;
    }

    this.sendMessage({
      type: "start",
      localPlayer: guestPlayer,
      startingPlayer,
    });

    return {
      localPlayer: hostPlayer,
      startingPlayer,
    };
  }

  sendGameSetup(startingPlayer: Player) {
    if (!this.isHost) {
      console.error("Only the host can send game setup");
      return;
    }

    this.sendMessage({
      type: "setup",
      startingPlayer,
    });
  }

  sendMessage(message: GameMessage) {
    if (this.dataChannel && this.dataChannel.readyState === "open") {
      this.dataChannel.send(encodeMessage(message));
    } else {
      console.error("Data channel is not open");
    }
  }

  close() {
    if (this.dataChannel) {
      this.dataChannel.close();
    }
    this.peerConnection.close();
    this.signaling.cleanup();
  }

  getRoomId() {
    return this.roomId;
  }
}
