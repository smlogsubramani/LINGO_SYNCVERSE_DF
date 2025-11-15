import React, { useState, useRef, useEffect } from 'react';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Loader2, Sparkles, Circle, Maximize2, Minimize2 } from 'lucide-react';

declare global {
  interface Window {
    SpeechSDK: any;
    __userStream?: MediaStream | null;
  }
}

interface SessionState {
  active: boolean;
  reconnecting: boolean;
  userClosed: boolean;
}

const MeetAI: React.FC = () => {
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const speechRecognizerRef = useRef<any>(null);
  const avatarSynthesizerRef = useRef<any>(null);
  const peerConnectionDataChannelRef = useRef<any>(null);

  const [sessionStarted, setSessionStarted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Session management states
  const [sessionState, setSessionState] = useState<SessionState>({
    active: false,
    reconnecting: false,
    userClosed: false
  });
  const [pendingQueries, setPendingQueries] = useState<string[]>([]);

  // Azure Configuration from environment variables
  const AZURE_SPEECH_KEY = import.meta.env.VITE_APP_AZURE_SPEECH_KEY;
  const AZURE_SPEECH_REGION = import.meta.env.VITE_APP_AZURE_SPEECH_REGION;
  const AVATAR_CHARACTER = 'lisa';
  const AVATAR_STYLE = 'casual-sitting';
  const TTS_VOICE = 'en-US-JennyNeural';

  // Backend API URL
  const BACKEND_API_URL = 'https://avatar-llm-endpoint.onrender.com/ask';
  
  // State to manage the user stream and track changes
  const [userStream, setUserStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    loadSpeechSDK();
    return () => cleanup();
  }, []);

  // Effect to handle local video stream
  useEffect(() => {
    if (isCameraOn && localVideoRef.current && userStream) {
      localVideoRef.current.srcObject = userStream;
      localVideoRef.current.play().catch(console.error);
    } else if (!isCameraOn && localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  }, [isCameraOn, userStream]);

  const loadSpeechSDK = () => {
    if (window.SpeechSDK) {
      console.log('Speech SDK already loaded');
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://aka.ms/csspeech/jsbrowserpackageraw';
    script.async = true;
    script.onload = () => {
      console.log('Speech SDK loaded successfully');
    };
    script.onerror = () => {
      console.error('Failed to load Speech SDK');
      alert('Failed to load Speech SDK. Please refresh the page.');
    };
    document.head.appendChild(script);
  };

  // Call backend API function
  const callBackendAPI = async (query: string): Promise<string> => {
    try {
      console.log('Calling backend API with query:', query);

      const response = await fetch(BACKEND_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: query
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Backend API response:', data);
      return data.response;
    } catch (error) {
      console.error('Error calling backend API:', error);
      throw error;
    }
  };

  const initializeAzureServices = async () => {
    try {
      setConnectionStatus('Initializing...');

      if (!window.SpeechSDK) {
        alert('Speech SDK not loaded yet. Retrying...');
        loadSpeechSDK();
        setTimeout(initializeAzureServices, 1000); 
        return;
      }

      console.log('Creating speech config for avatar...');
      const speechSynthesisConfig = window.SpeechSDK.SpeechConfig.fromSubscription(
        AZURE_SPEECH_KEY,
        AZURE_SPEECH_REGION
      );
      const avatarConfig = new window.SpeechSDK.AvatarConfig(AVATAR_CHARACTER, AVATAR_STYLE);
      avatarSynthesizerRef.current = new window.SpeechSDK.AvatarSynthesizer(speechSynthesisConfig, avatarConfig);

      avatarSynthesizerRef.current.avatarEventReceived = (_s: any, e: any) => {
        console.log(`Avatar event: ${e.description}, offset: ${e.offset / 10000}ms`);
      };

      console.log('Initializing speech recognition...');
      const speechRecognitionConfig = window.SpeechSDK.SpeechConfig.fromEndpoint(
        new URL(`wss://${AZURE_SPEECH_REGION}.stt.speech.microsoft.com/speech/universal/v2`),
        AZURE_SPEECH_KEY
      );

      speechRecognitionConfig.setProperty(
        window.SpeechSDK.PropertyId.SpeechServiceConnection_LanguageIdMode,
        "Continuous"
      );

      const autoDetectConfig = window.SpeechSDK.AutoDetectSourceLanguageConfig.fromLanguages([
        "en-US", "es-ES", "fr-FR", "de-DE", "it-IT"
      ]);

      speechRecognizerRef.current = window.SpeechSDK.SpeechRecognizer.FromConfig(
        speechRecognitionConfig,
        autoDetectConfig,
        window.SpeechSDK.AudioConfig.fromDefaultMicrophoneInput()
      );

      setupSpeechRecognitionEvents();

      setConnectionStatus('Fetching WebRTC token...');
      await fetchWebRtcToken();

    } catch (error) {
      console.error('Error initializing Azure services:', error);
      alert(`Failed to initialize: ${error}`);
      setConnectionStatus('');
    }
  };

  const setupSpeechRecognitionEvents = () => {
    if (!speechRecognizerRef.current) return;

    speechRecognizerRef.current.recognizing = (_s: any, e: any) => {
      if (e.result.text) {
        setUserSpeaking(true);
      }
    };

    speechRecognizerRef.current.recognized = (_s: any, e: any) => {
      if (e.result.reason === window.SpeechSDK.ResultReason.RecognizedSpeech) {
        const userQuery = e.result.text.trim();
        if (userQuery) {
          console.log('Recognized speech:', userQuery);
          setUserSpeaking(false);
          
          if (isSpeaking) {
            stopSpeaking();
          }
          
          handleUserQuery(userQuery);
        }
      }
    };
    
    speechRecognizerRef.current.sessionStopped = () => {
        setUserSpeaking(false);
    }
  };

  const fetchWebRtcToken = async () => {
    try {
      const response = await fetch(
        `https://${AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/avatar/relay/token/v1`,
        {
          headers: {
            'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY || ''
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Token request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('WebRTC token received');
      setConnectionStatus('Setting up video connection...');
      setupWebRTC(data.Urls[0], data.Username, data.Password);
    } catch (error) {
      console.error('Error fetching WebRTC token:', error);
      alert(`Failed to connect to avatar service: ${error}`);
      setConnectionStatus('');
    }
  };

  const setupWebRTC = (iceServerUrl: string, username: string, credential: string) => {
    console.log("Setting up WebRTC connection...");

    if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
    }

    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: [iceServerUrl], username, credential }]
    });

    peerConnection.addEventListener("datachannel", (event) => {
      peerConnectionDataChannelRef.current = event.channel;
      peerConnectionDataChannelRef.current.onmessage = (e: any) => {
        console.log(`WebRTC event: ${e.data}`);
      };
    });

    peerConnection.createDataChannel("eventChannel");
    peerConnection.addTransceiver("video", { direction: "sendrecv" });
    peerConnection.addTransceiver("audio", { direction: "sendrecv" });

    peerConnection.ontrack = (event) => {
      console.log("Track received:", event.track.kind);

      if (event.track.kind === "video" && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        remoteVideoRef.current.onloadeddata = () => {
          remoteVideoRef.current
            ?.play()
            .then(() => {
              console.log("🎥 Video stream connected");
              activateSessionIfNeeded();
            })
            .catch(console.error);
        };
      }

      if (event.track.kind === "audio" && remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
        remoteAudioRef.current.onloadeddata = () => {
          remoteAudioRef.current
            ?.play()
            .then(() => {
              console.log("🔊 Avatar audio is playing");
              activateSessionIfNeeded();
            })
            .catch(err => console.error("Audio play error", err));
        };
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      const state = peerConnection.iceConnectionState;
      console.log("ICE connection state:", state);
      setConnectionStatus(`Connection: ${state}`);

      if (state === "disconnected" || state === "failed") {
        handleDisconnection();
      }
    };

    peerConnectionRef.current = peerConnection;

    console.log("Starting avatar session...");
    setConnectionStatus("Starting avatar...");

    avatarSynthesizerRef.current
      .startAvatarAsync(peerConnection)
      .then((result: any) => {
        if (result.reason === window.SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
          console.log("Avatar session started successfully");
        } else {
          throw new Error(`Avatar start failed: ${result.reason}`);
        }
      })
      .catch((error: any) => {
        console.error("Failed to start avatar:", error);
        alert(`Failed to start avatar session: ${error}`);
        setConnectionStatus("");
      });
  };

  let sessionActivated = false;

  const activateSessionIfNeeded = () => {
    if (sessionActivated) return;
    sessionActivated = true;
    onAvatarConnected();
  };

  const onAvatarConnected = () => {
    console.log("🔥 Avatar Connected");
    setIsConnected(true);
    setSessionState((prev) => ({ ...prev, active: true, reconnecting: false }));
    setConnectionStatus("");

    setTimeout(() => {
      if (speechRecognizerRef.current && !isMicOn) {
        speechRecognizerRef.current.startContinuousRecognitionAsync();
        setIsMicOn(true);
        console.log("🎤 Microphone auto-started");
      }
    }, 500);

    if (pendingQueries.length > 0) {
      const queued = [...pendingQueries];
      setPendingQueries([]);
      console.log("Processing pending queries:", queued);

      setTimeout(() => {
        queued.forEach((q) => handleUserQuery(q));
      }, 500);
    }

    setTimeout(() => {
      speakWelcomeMessage();
    }, 1000);
  };

  const handleDisconnection = () => {
    if (sessionState.active && !sessionState.userClosed) {
      console.log('Connection lost, attempting reconnection...');
      setSessionState(prev => ({ ...prev, active: false, reconnecting: true }));
      setIsConnected(false);

      setTimeout(() => {
        if (!sessionState.userClosed) {
          initializeAzureServices();
        }
      }, 3000);
    }
  };

  const speakWelcomeMessage = () => {
    const welcomeMsg = "Hello! I'm your AI consultant. I can help answer your questions and provide assistance. How can I help you today?";
    speakResponse(welcomeMsg);
  };

  const handleUserQuery = async (query: string) => {
    if (!avatarSynthesizerRef.current) {
      console.log('Avatar synthesizer not ready, queuing query:', query);
      setPendingQueries(prev => [...prev, query]);
      return;
    }

    setIsLoading(true);

    if (isSpeaking) {
      stopSpeaking();
    }

    try {
      const response = await callBackendAPI(query);
      speakResponse(response);
    } catch (error) {
      console.error('Error calling backend API:', error);
      const errorMsg = "I apologize, but I'm having trouble processing your request. Please try again.";
      speakResponse(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const speakResponse = (text: string) => {
    if (!avatarSynthesizerRef.current) {
      console.warn('Avatar synthesizer not available');
      return;
    }

    const ssml = `
      <speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='http://www.w3.org/2001/mstts' xml:lang='en-US'>
        <voice name='${TTS_VOICE}'>
          <mstts:leadingsilence-exact value='0'/>
          ${text}
        </voice>
      </speak>
    `;

    setIsSpeaking(true);
    avatarSynthesizerRef.current.speakSsmlAsync(ssml)
      .then((result: any) => {
        if (result.reason === window.SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
          console.log('Speech completed for text:', text);
        } else {
          console.log('Speech synthesis incomplete:', result.reason);
        }
        setIsSpeaking(false);
      })
      .catch((error: any) => {
        console.error('Error speaking:', error);
        setIsSpeaking(false);
      });
  };

  const stopSpeaking = () => {
    if (avatarSynthesizerRef.current) {
      avatarSynthesizerRef.current.stopSpeakingAsync()
        .then(() => {
          console.log('Speech stopped successfully');
          setIsSpeaking(false);
        })
        .catch((error: any) => {
          console.error('Error stopping speech:', error);
        });
    }
  };

  const toggleMicrophone = () => {
    if (!speechRecognizerRef.current) {
      alert('Speech recognition not initialized. Please wait for connection.');
      return;
    }

    if (isMicOn) {
      speechRecognizerRef.current.stopContinuousRecognitionAsync();
      console.log('Microphone stopped');
      setIsMicOn(false);
    } else {
      if (!sessionState.active) {
        alert('Please wait for the AI consultant to finish connecting before starting the microphone.');
        return;
      }

      speechRecognizerRef.current.startContinuousRecognitionAsync();
      console.log('Microphone started');
      setIsMicOn(true);
    }
  };

  const toggleCamera = async () => {
    if (isCameraOn) {
      if (userStream) {
        userStream.getTracks().forEach(track => track.stop());
      }
      setUserStream(null);
      setIsCameraOn(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });

      setUserStream(stream);
      setIsCameraOn(true);

    } catch (err) {
      alert("Unable to access camera. Please check permissions.");
      console.error(err);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const startSession = () => {
    console.log('Starting consultation session...');
    setSessionStarted(true);
    setSessionState(prev => ({ ...prev, userClosed: false }));
    setPendingQueries([]);

    setTimeout(() => {
      initializeAzureServices();
    }, 100);
  };

  const endCall = () => {
    setSessionState(prev => ({ ...prev, userClosed: true, active: false }));
    cleanup();
    setSessionStarted(false);
    setIsConnected(false);
    setIsMicOn(false);
    setIsCameraOn(false);
    setConnectionStatus('');
    setPendingQueries([]);
    setIsFullscreen(false);
  };

  const cleanup = () => {
    if (speechRecognizerRef.current) {
      speechRecognizerRef.current.stopContinuousRecognitionAsync();
      speechRecognizerRef.current.close();
      speechRecognizerRef.current = null;
    }
    if (avatarSynthesizerRef.current) {
      avatarSynthesizerRef.current.close();
      avatarSynthesizerRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (peerConnectionDataChannelRef.current) {
      peerConnectionDataChannelRef.current.close();
      peerConnectionDataChannelRef.current = null;
    }
    if (userStream) {
      userStream.getTracks().forEach(track => track.stop());
      setUserStream(null);
    }
  };

  // Landing Page
  if (!sessionStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-8 sm:mb-12 animate-fade-in">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl mb-6 shadow-xl transform hover:scale-110 transition-transform duration-300">
              <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-white animate-pulse" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4">
              MeetAI
            </h1>
            <p className="text-lg sm:text-xl text-gray-700 mb-2 font-medium">
              Your Intelligent AI Assistant
            </p>
            <p className="text-sm sm:text-base text-gray-600 max-w-2xl mx-auto px-4 leading-relaxed">
              Experience next-generation AI conversations with our interactive avatar.
              Ask questions and receive intelligent, real-time responses.
            </p>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl p-6 sm:p-8 mb-8 border border-gray-100">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6 text-center">How Can I Assist You?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { icon: '💼', title: 'Business Strategy', desc: 'Expert insights on business decisions and planning', gradient: 'from-blue-500 to-cyan-500' },
                { icon: '🔧', title: 'Technical Support', desc: 'Comprehensive technical guidance and solutions', gradient: 'from-purple-500 to-pink-500' },
                { icon: '📚', title: 'Learning & Education', desc: 'Clear explanations and educational content', gradient: 'from-green-500 to-emerald-500' },
                { icon: '💡', title: 'Creative Ideation', desc: 'Innovative brainstorming and creative solutions', gradient: 'from-yellow-500 to-orange-500' },
                { icon: '📊', title: 'Data Analysis', desc: 'Detailed analysis and data interpretation', gradient: 'from-indigo-500 to-blue-500' },
                { icon: '🔄', title: 'Process Optimization', desc: 'Streamline workflows and boost efficiency', gradient: 'from-red-500 to-pink-500' }
              ].map((item, idx) => (
                <div 
                  key={idx} 
                  className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-50 to-white p-4 border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
                >
                  <div className={`absolute inset-0 bg-gradient-to-r ${item.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}></div>
                  <div className="relative flex items-start space-x-3">
                    <span className="text-3xl transform group-hover:scale-110 transition-transform duration-300">{item.icon}</span>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-base mb-1">{item.title}</h3>
                      <p className="text-sm text-gray-600 leading-snug">{item.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={startSession}
              className="group inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 text-base relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <Video className="w-5 h-5 mr-3 relative z-10 group-hover:animate-pulse" />
              <span className="relative z-10">Start AI Conversation</span>
            </button>
            <p className="mt-4 text-sm text-gray-500 font-medium">
              Click to begin your personalized AI experience
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Meeting Interface
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800/90 backdrop-blur-md px-4 sm:px-6 py-4 flex items-center justify-between border-b border-gray-700/50 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg">MeetAI</h1>
              <div className="flex items-center space-x-2">
                <Circle className={`w-2 h-2 ${isConnected ? 'fill-green-400 text-green-400' : 'fill-yellow-400 text-yellow-400'} animate-pulse`} />
                <span className="text-xs text-gray-300 font-medium">
                  {connectionStatus || (isConnected ? 'Connected' : 'Connecting...')}
                  {sessionState.reconnecting && ' (Reconnecting...)'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-gray-700/50 rounded-lg">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-gray-300 font-medium">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </div>

      {/* Video Area */}
      <div className="flex-1 flex items-center justify-center p-3 sm:p-6 overflow-hidden">
        <div className="w-full h-full max-w-7xl mx-auto">
          <div className="h-full grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
            {/* AI Avatar Video - Main */}
            <div className={`relative ${isCameraOn ? 'lg:col-span-2' : 'lg:col-span-3'} rounded-2xl overflow-hidden shadow-2xl border-2 border-gray-700/50 bg-gradient-to-br from-indigo-900/20 via-purple-900/20 to-blue-900/20 h-full min-h-[300px] sm:min-h-[400px] lg:min-h-[500px]`}>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className={`w-full h-full object-cover ${isFullscreen ? 'object-contain' : ''}`}
              />
              <audio ref={remoteAudioRef} autoPlay playsInline hidden />
              
              {/* Avatar Label */}
              <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md px-4 py-2 rounded-xl flex items-center space-x-2 shadow-lg border border-gray-600/30">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span className="text-white text-sm font-semibold">AI Assistant</span>
              </div>

              {/* Fullscreen Toggle */}
              <button
                onClick={toggleFullscreen}
                className="absolute top-4 right-4 p-2 bg-black/70 backdrop-blur-md rounded-xl hover:bg-black/80 transition-all border border-gray-600/30"
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4 text-white" />
                ) : (
                  <Maximize2 className="w-4 h-4 text-white" />
                )}
              </button>

              {/* Speaking Indicator */}
              {isSpeaking && (
                <div className="absolute bottom-4 right-4 bg-blue-500/90 backdrop-blur-md px-4 py-2 rounded-xl flex items-center space-x-2 animate-pulse shadow-lg">
                  <Mic className="w-4 h-4 text-white" />
                  <span className="text-white text-sm font-semibold">Speaking</span>
                  <div className="flex space-x-1">
                    <div className="w-1 h-3 bg-white rounded-full animate-pulse"></div>
                    <div className="w-1 h-4 bg-white rounded-full animate-pulse" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-1 h-3 bg-white rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
              )}

              {/* Thinking Indicator */}
              {isLoading && (
                <div className="absolute bottom-4 left-4 bg-purple-500/90 backdrop-blur-md px-4 py-2 rounded-xl flex items-center space-x-2 shadow-lg">
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                  <span className="text-white text-sm font-semibold">Thinking</span>
                </div>
              )}

              {/* Connection Loading Overlay */}
              {!isConnected && (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-sm">
                  <div className="text-center p-8">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center animate-pulse">
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                    </div>
                    <p className="text-white text-lg font-semibold mb-2">{connectionStatus || 'Connecting to AI assistant...'}</p>
                    {sessionState.reconnecting && (
                      <p className="text-yellow-400 text-sm font-medium">Attempting to reconnect...</p>
                    )}
                    <div className="mt-4 flex justify-center space-x-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* User Video - Side Panel */}
            {isCameraOn && (
              <div className="relative lg:col-span-1 rounded-2xl overflow-hidden shadow-2xl border-2 border-gray-700/50 bg-gray-800 h-full min-h-[200px] sm:min-h-[300px] lg:min-h-[500px]">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                
                {/* User Label */}
                <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md px-4 py-2 rounded-xl shadow-lg border border-gray-600/30">
                  <span className="text-white text-sm font-semibold">You</span>
                </div>

                {/* User Speaking Indicator */}
                {userSpeaking && (
                  <div className="absolute bottom-4 right-4 bg-green-500/90 backdrop-blur-md px-4 py-2 rounded-xl flex items-center space-x-2 animate-pulse shadow-lg">
                    <Circle className="w-2 h-2 fill-white text-white" />
                    <span className="text-white text-sm font-semibold">Speaking</span>
                    <div className="flex space-x-1">
                      <div className="w-1 h-3 bg-white rounded-full animate-pulse"></div>
                      <div className="w-1 h-4 bg-white rounded-full animate-pulse" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-1 h-3 bg-white rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gray-800/90 backdrop-blur-md px-4 sm:px-6 py-5 border-t border-gray-700/50 shadow-2xl">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center space-x-4 sm:space-x-6">
            {/* Microphone Button */}
            <div className="flex flex-col items-center">
              <button
                onClick={toggleMicrophone}
                disabled={!isConnected || !sessionState.active}
                className={`p-4 rounded-2xl transition-all duration-300 transform hover:scale-110 shadow-lg ${
                  isMicOn
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-blue-500/50'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                } disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none border-2 ${
                  isMicOn ? 'border-blue-400' : 'border-gray-600'
                }`}
                title={!sessionState.active ? 'Wait for connection' : (isMicOn ? 'Turn off microphone' : 'Turn on microphone')}
              >
                {isMicOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
              </button>
              <span className="text-xs text-gray-400 mt-2 font-medium">
                {isMicOn ? 'Mic On' : 'Mic Off'}
              </span>
            </div>

            {/* Camera Button */}
            <div className="flex flex-col items-center">
              <button
                onClick={toggleCamera}
                className={`p-4 rounded-2xl transition-all duration-300 transform hover:scale-110 shadow-lg ${
                  isCameraOn
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-blue-500/50'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                } border-2 ${
                  isCameraOn ? 'border-blue-400' : 'border-gray-600'
                }`}
                title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
              >
                {isCameraOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
              </button>
              <span className="text-xs text-gray-400 mt-2 font-medium">
                {isCameraOn ? 'Camera On' : 'Camera Off'}
              </span>
            </div>

            {/* End Call Button */}
            <div className="flex flex-col items-center">
              <button
                onClick={endCall}
                className="p-4 rounded-2xl bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 transition-all duration-300 transform hover:scale-110 shadow-lg shadow-red-500/50 border-2 border-red-400"
                title="End conversation"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
              <span className="text-xs text-gray-400 mt-2 font-medium">End Call</span>
            </div>
          </div>

          {/* Status Indicators */}
          <div className="mt-4 flex items-center justify-center space-x-6 text-xs">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isMicOn ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`}></div>
              <span className="text-gray-400 font-medium">Microphone</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isCameraOn ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`}></div>
              <span className="text-gray-400 font-medium">Camera</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-yellow-400 animate-pulse'}`}></div>
              <span className="text-gray-400 font-medium">Connection</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetAI;