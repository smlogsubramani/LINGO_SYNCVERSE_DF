import express, { Request, Response } from "express";
import cors from "cors";
import {
  AccessToken,
  type AccessTokenOptions,
  type VideoGrant,
} from "livekit-server-sdk";
import { RoomConfiguration } from "@livekit/protocol";

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

const app = express();

app.use(cors());
app.use(express.json());

app.post("/api/create-token", async (req: Request, res: Response) => {
  try {
    if (!LIVEKIT_URL) throw new Error("LIVEKIT_URL is not defined");
    if (!API_KEY) throw new Error("LIVEKIT_API_KEY is not defined");
    if (!API_SECRET) throw new Error("LIVEKIT_API_SECRET is not defined");

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
    console.error(err);
    res.status(500).send(err.message);
  }
});

function createParticipantToken(
  userInfo: AccessTokenOptions,
  roomName: string,
  agentName?: string
): Promise<string> {
  const at = new AccessToken(API_KEY, API_SECRET, {
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

app.listen(8000, () => console.log("Server running on :8000"));