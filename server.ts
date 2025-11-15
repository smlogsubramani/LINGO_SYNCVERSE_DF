import express, { Request, Response } from "express";
import cors from "cors";
import {
  AccessToken,
  type AccessTokenOptions,
  type VideoGrant,
} from "livekit-server-sdk";
import { RoomConfiguration } from "@livekit/protocol";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;
const PORT = process.env.PORT || 8000;

if (!API_KEY || !API_SECRET || !LIVEKIT_URL) {
  console.error("Missing required environment variables:");
  console.error("LIVEKIT_API_KEY:", API_KEY ? "✓" : "✗");
  console.error("LIVEKIT_API_SECRET:", API_SECRET ? "✓" : "✗");
  console.error("LIVEKIT_URL:", LIVEKIT_URL ? "✓" : "✗");
  console.error("\nPlease set these in your .env file");
  process.exit(1);
}

const app = express();

app.use(cors());
app.use(express.json());

app.post("/api/create-token", async (req: Request, res: Response) => {
  try {
    const agentName: string | undefined =
      req.body?.room_config?.agents?.[0]?.agent_name;

    const participantName = "user";
    const participantIdentity = `voice_assistant_user_${Math.floor(
      Math.random() * 10000
    )}`;
    const roomName = `voice_assistant_room_${Math.floor(
      Math.random() * 10000
    )}`;

    const participantToken = await createParticipantToken(
      { identity: participantIdentity, name: participantName },
      roomName,
      agentName
    );

    res.json({
      serverUrl: LIVEKIT_URL,
      roomName,
      participantToken,
      participantName,
    });
  } catch (err: any) {
    console.error("Error creating token:", err);
    res.status(500).json({ error: err.message });
  }
});

function createParticipantToken(
  userInfo: AccessTokenOptions,
  roomName: string,
  agentName?: string
): Promise<string> {
  const at = new AccessToken(API_KEY!, API_SECRET!, {
    ...userInfo,
    ttl: "15m",
  });

  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  };

  at.addGrant(grant);

  if (agentName) {
    at.roomConfig = new RoomConfiguration({
      agents: [{ agentName }],
    });
  }

  return at.toJwt();
}

app.listen(PORT, () => {
  console.log(`🚀 LiveKit token server running on http://localhost:${PORT}`);
  console.log(`📡 Endpoint: POST http://localhost:${PORT}/api/create-token`);
});

