import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Room, RoomEvent, TokenSource } from 'livekit-client';
import { AppConfig } from '../app-config';
import { toastAlert } from '../components/livekit/alert-toast';

export function useRoom(appConfig: AppConfig) {
  const aborted = useRef(false);
  const room = useMemo(() => new Room(), []);
  const [isSessionActive, setIsSessionActive] = useState(false);

  useEffect(() => {
    function onDisconnected() {
      setIsSessionActive(false);
    }

    function onMediaDevicesError(error: Error) {
      toastAlert({
        title: 'Encountered an error with your media devices',
        description: `${error.name}: ${error.message}`,
      });
    }

    room.on(RoomEvent.Disconnected, onDisconnected);
    room.on(RoomEvent.MediaDevicesError, onMediaDevicesError);

    return () => {
      room.off(RoomEvent.Disconnected, onDisconnected);
      room.off(RoomEvent.MediaDevicesError, onMediaDevicesError);
    };
  }, [room]);

  useEffect(() => {
    return () => {
      aborted.current = true;
      room.disconnect();
    };
  }, [room]);

  const tokenSource = useMemo(
    () =>
      TokenSource.custom(async () => {
        // Vite uses import.meta.env instead of process.env
        const envEndpoint = import.meta.env.VITE_CONN_DETAILS_ENDPOINT;
        const endpoint = (envEndpoint && envEndpoint.trim() !== '') 
          ? envEndpoint 
          : '/api/connection-details';
        
        // Construct URL properly - if endpoint is absolute, use it directly, otherwise combine with origin
        let url: URL;
        if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
          url = new URL(endpoint);
        } else {
          // Ensure endpoint starts with / for relative paths
          const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
          url = new URL(path, window.location.origin);
        }

        console.log('Fetching connection details from:', url.toString());

        try {
          const res = await fetch(url.toString(), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Sandbox-Id': appConfig.sandboxId ?? '',
            },
            body: JSON.stringify({
              room_config: appConfig.agentName
                ? {
                    agents: [{ agent_name: appConfig.agentName }],
                  }
                : undefined,
            }),
          });

          if (!res.ok) {
            const errorText = await res.text().catch(() => 'Unable to read error response');
            console.error(`API Error: ${res.status} ${res.statusText}`, errorText);
            throw new Error(`Failed to fetch connection details: ${res.status} ${res.statusText}`);
          }

          const data = await res.json();
          console.log('Connection details received:', { 
            serverUrl: data.serverUrl, 
            roomName: data.roomName,
            hasToken: !!data.participantToken 
          });
          return data;
        } catch (error) {
          console.error('Error fetching connection details:', error);
          if (error instanceof Error) {
            throw error;
          }
          throw new Error('Error fetching connection details!');
        }
      }),
    [appConfig]
  );

  const startSession = useCallback(() => {
    setIsSessionActive(true);

    if (room.state === 'disconnected') {
      const { isPreConnectBufferEnabled } = appConfig;
      Promise.all([
        room.localParticipant.setMicrophoneEnabled(true, undefined, {
          preConnectBuffer: isPreConnectBufferEnabled,
        }),
        tokenSource
          .fetch({ agentName: appConfig.agentName })
          .then((connectionDetails) =>
            room.connect(connectionDetails.serverUrl, connectionDetails.participantToken)
          ),
      ]).catch((error) => {
        if (aborted.current) {
          // Once the effect has cleaned up after itself, drop any errors
          //
          // These errors are likely caused by this effect rerunning rapidly,
          // resulting in a previous run `disconnect` running in parallel with
          // a current run `connect`
          return;
        }

        toastAlert({
          title: 'There was an error connecting to the agent',
          description: `${error.name}: ${error.message}`,
        });
      });
    }
  }, [room, appConfig, tokenSource]);

  const endSession = useCallback(() => {
    setIsSessionActive(false);
  }, []);

  return { room, isSessionActive, startSession, endSession };
}
