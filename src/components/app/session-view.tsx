'use client';

import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { easeOut } from 'motion';
import type { AppConfig } from '../../app-config';
import { ChatTranscript } from '../../components/app/chat-transcript';
import { PreConnectMessage } from '../../components/app/preconnect-message';
import { TileLayout } from '../../components/app/tile-layout';
import {
  AgentControlBar,
  type ControlBarControls,
} from '../../components/livekit/agent-control-bar/agent-control-bar';
import { useChatMessages } from '../../hooks/useChatMessages';
import { useConnectionTimeout } from '../../hooks/useConnectionTimout';
import { useDebugMode } from '../../hooks/useDebug';
import { cn } from '../../lib/utils';
import { ScrollArea } from '../livekit/scroll-area/scroll-area';

const IN_DEVELOPMENT = process.env.NODE_ENV === 'development';

const MotionBottom = motion.create('div');

const BOTTOM_VIEW_MOTION_PROPS = {
  variants: {
    visible: {
      opacity: 1,
      translateY: '0%',
    },
    hidden: {
      opacity: 0,
      translateY: '100%',
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
  transition: {
    duration: 0.3,
    delay: 0.5,
    ease: easeOut,
  },
};

interface FadeProps {
  top?: boolean;
  bottom?: boolean;
  className?: string;
}

export function Fade({ top = false, bottom = false, className }: FadeProps) {
  return (
    <div
      className={cn(
        'from-background pointer-events-none h-4 bg-linear-to-b to-transparent',
        top && 'bg-linear-to-b',
        bottom && 'bg-linear-to-t',
        className
      )}
    />
  );
}

// Wave Animation Component
interface WaveAnimationProps {
  isSpeaking: boolean;
  className?: string;
}

function WaveAnimation({ isSpeaking, className }: WaveAnimationProps) {
  const bars = Array.from({ length: 12 }, (_, i) => i);
  
  return (
    <div className={cn('flex items-end justify-center gap-1 h-24', className)}>
      {bars.map((index) => (
        <motion.div
          key={index}
          className="w-2 rounded-full bg-gradient-to-t from-purple-500 via-blue-400 to-cyan-300"
          initial={{ height: 8 }}
          animate={{
            height: isSpeaking ? [8, 32, 8] : 8,
            opacity: isSpeaking ? [0.7, 1, 0.7] : 0.4,
          }}
          transition={{
            duration: 1.2,
            repeat: isSpeaking ? Infinity : 0,
            delay: index * 0.1,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// Simple White Background
function WhiteBackground() {
  return (
    <div className="absolute inset-0 bg-dark" />
  );
}

interface SessionViewProps {
  appConfig: AppConfig;
}

export const SessionView = forwardRef<HTMLElement, React.ComponentProps<'section'> & SessionViewProps>(
  ({ appConfig, ...props }, ref) => {
    useConnectionTimeout(200_000);
    useDebugMode({ enabled: IN_DEVELOPMENT });

    const messages = useChatMessages();
    const [chatOpen, setChatOpen] = useState(false);
    const [isBotSpeaking, setIsBotSpeaking] = useState(false);
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    const controls: ControlBarControls = {
      leave: true,
      microphone: true,
      chat: appConfig.supportsChatInput,
      camera: appConfig.supportsVideoInput,
      screenShare: appConfig.supportsVideoInput,
    };

    // Detect when bot is speaking (you might need to adjust this logic based on your actual bot speaking detection)
    useEffect(() => {
      const lastMessage = messages.at(-1);
      const isBotMessage = lastMessage?.from?.isLocal === false;
      
      if (isBotMessage && lastMessage?.timestamp) {
        setIsBotSpeaking(true);
        // Simulate bot speaking duration - adjust based on your actual implementation
        const speakingDuration = Math.max(lastMessage.message.length * 50, 2000);
        const timer = setTimeout(() => {
          setIsBotSpeaking(false);
        }, speakingDuration);
        
        return () => clearTimeout(timer);
      }
    }, [messages]);

    useEffect(() => {
      const lastMessage = messages.at(-1);
      const lastMessageIsLocal = lastMessage?.from?.isLocal === true;

      if (scrollAreaRef.current && lastMessageIsLocal) {
        scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
      }
    }, [messages]);

    return (
      <section ref={ref} className="bg-white relative z-10 h-full w-full overflow-hidden" {...props}>
        {/* Clean White Background */}
        <WhiteBackground />

        {/* Main Content Area */}
        <div className="relative z-20 h-full flex flex-col">
          {/* Chat Transcript */}
          <div
            className={cn(
              'fixed inset-0 grid grid-cols-1 grid-rows-1',
              !chatOpen && 'pointer-events-none'
            )}
          >
            <Fade top className="absolute inset-x-4 top-0 h-40" />
            <ScrollArea ref={scrollAreaRef} className="px-4 pt-40 pb-[150px] md:px-6 md:pb-[180px]">
              <ChatTranscript
                hidden={!chatOpen}
                messages={messages}
                className="mx-auto max-w-2xl space-y-3 transition-opacity duration-300 ease-out"
              />
            </ScrollArea>
          </div>

          {/* Tile Layout */}
          <TileLayout chatOpen={chatOpen} />

          {/* Center Area with Wave Animation */}
          <div className="flex-1 flex flex-col items-center justify-center pb-40">
            <motion.div
              className="text-center mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              <motion.h2 
                className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent mb-4"
                animate={{
                  backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                }}
                transition={{
                  duration: 5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                style={{
                  backgroundSize: '200% 200%',
                }}
              >
                {isBotSpeaking ? "I'm speaking..." : "Ready to help!"}
              </motion.h2>
              
              <WaveAnimation 
                isSpeaking={isBotSpeaking} 
                className="scale-125"
              />
            </motion.div>
          </div>

          {/* Bottom Control Bar */}
          <MotionBottom
            {...BOTTOM_VIEW_MOTION_PROPS}
            className="fixed inset-x-0 bottom-0 z-50 flex justify-center"
          >
            <div className="w-full max-w-4xl px-3 md:px-12">
              {appConfig.isPreConnectBufferEnabled && (
                <PreConnectMessage messages={messages} className="pb-4" />
              )}
              <div className="bg-white relative mx-auto rounded-t-2xl pb-3 md:pb-6 pt-4 border-t border-l border-r border-gray-200" style={{marginLeft: '200px'}}> <Fade bottom className="absolute inset-x-0 top-0 h-4 -translate-y-full" />
                <div className="flex justify-center">
                  <AgentControlBar 
                    controls={controls} 
                    onChatOpenChange={setChatOpen}
                    className="max-w-2xl w-full"
                  />
                </div>
              </div>
            </div>
          </MotionBottom>
        </div>
      </section>
    );
  }
);

SessionView.displayName = 'SessionView';