export class SignalingService {
  private baseUrl: string;
  private roomId: string | null = null;
  private pollingIntervals: NodeJS.Timeout[] = [];

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setRoomId(roomId: string) {
    this.roomId = roomId;
  }

  async createRoom(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/rooms/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const data = await response.json();
    this.roomId = data.roomId;
    return data.roomId;
  }

  async checkRoom(roomId: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/api/rooms/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId }),
    });

    const data = await response.json();
    return data.exists;
  }

  async sendOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.roomId) throw new Error("Room ID not set");

    await fetch(`${this.baseUrl}/api/offer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: this.roomId, offer }),
    });
  }

  async sendAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.roomId) throw new Error("Room ID not set");

    await fetch(`${this.baseUrl}/api/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: this.roomId, answer }),
    });
  }

  async sendCandidate(
    candidate: RTCIceCandidateInit,
    isOfferer: boolean,
  ): Promise<void> {
    if (!this.roomId) throw new Error("Room ID not set");

    await fetch(`${this.baseUrl}/api/candidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: this.roomId, candidate, isOfferer }),
    });
  }

  pollForAnswer(callback: (answer: RTCSessionDescriptionInit) => void): void {
    if (!this.roomId) throw new Error("Room ID not set");

    const poll = async () => {
      try {
        const response = await fetch(
          `${this.baseUrl}/api/answer?roomId=${this.roomId}`,
        );
        const data = await response.json();

        if (data.answer) {
          callback(data.answer);
          this.stopPolling();
        }
      } catch (error) {
        console.error("Error polling for answer:", error);
      }
    };

    const intervalId = setInterval(poll, 2000);
    this.pollingIntervals.push(intervalId);

    poll();
  }

  pollForOffer(callback: (offer: RTCSessionDescriptionInit) => void): void {
    if (!this.roomId) throw new Error("Room ID not set");

    const poll = async () => {
      try {
        const response = await fetch(
          `${this.baseUrl}/api/offer?roomId=${this.roomId}`,
        );
        const data = await response.json();

        if (data.offer) {
          callback(data.offer);
          this.stopPolling();
        }
      } catch (error) {
        console.error("Error polling for offer:", error);
      }
    };

    const intervalId = setInterval(poll, 2000);
    this.pollingIntervals.push(intervalId);

    poll();
  }

  pollForCandidates(
    callback: (candidate: RTCIceCandidateInit) => void,
    isOfferer: boolean,
  ): void {
    if (!this.roomId) throw new Error("Room ID not set");

    const poll = async () => {
      try {
        const response = await fetch(
          `${this.baseUrl}/api/candidates?roomId=${this.roomId}&isOfferer=${isOfferer ? "1" : "0"}`,
        );
        const data = await response.json();

        if (data.candidates && data.candidates.length > 0) {
          data.candidates.forEach((candidate: RTCIceCandidateInit) => {
            callback(candidate);
          });
        }
      } catch (error) {
        console.error("Error polling for candidates:", error);
      }
    };

    const intervalId = setInterval(poll, 1000);
    this.pollingIntervals.push(intervalId);

    poll();
  }

  stopPolling(): void {
    this.pollingIntervals.forEach(clearInterval);
    this.pollingIntervals = [];
  }

  cleanup(): void {
    this.stopPolling();
  }
}
