import { forwardRef } from 'react';
import { motion } from 'motion/react';
import { Button } from '../../components/livekit/button';

function AnimatedWaveform() {
  const bars = [
    { height: 24, delay: 0 },
    { height: 48, delay: 0.1 },
    { height: 32, delay: 0.2 },
    { height: 56, delay: 0.15 },
    { height: 40, delay: 0.25 },
    { height: 28, delay: 0.05 },
    { height: 52, delay: 0.3 },
  ];

  return (
    <div className="mb-8 flex items-center justify-center gap-2">
      {bars.map((bar, i) => (
        <motion.div
          key={i}
          className="w-2 rounded-full bg-gradient-to-t from-blue-500 to-purple-500"
          initial={{ height: 8 }}
          animate={{
            height: [8, bar.height, 8],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: bar.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

interface WelcomeViewProps {
  startButtonText: string;
  onStartCall: () => void;
}

export const WelcomeView = forwardRef<HTMLDivElement, React.ComponentProps<'div'> & WelcomeViewProps>(
  ({ startButtonText, onStartCall, ...props }, ref) => {
    return (
      <div ref={ref} {...props}>
        <section className="bg-background flex flex-col items-center justify-center text-center">
          <AnimatedWaveform />

          <h1 className="text-foreground mb-3 text-3xl font-bold tracking-tight md:text-4xl">
            IT Support Agent
          </h1>

          <p className="text-muted-foreground max-w-prose pt-1 leading-6 font-medium">
            Chat live with your voice-enabled IT support assistant
          </p>

          <Button variant="primary" size="lg" onClick={onStartCall} className="mt-8 w-64 font-mono shadow-lg hover:shadow-xl transition-shadow">
            {startButtonText}
          </Button>
        </section>

        {/* <div className="fixed bottom-5 left-0 flex w-full items-center justify-center">
          <p className="text-muted-foreground max-w-prose pt-1 text-xs leading-5 font-normal text-pretty md:text-sm">
            Need help getting set up? Check out the{' '}
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://docs.livekit.io/agents/start/voice-ai/"
              className="underline"
            >
              Voice AI quickstart
            </a>
            .
          </p>
        </div> */}
      </div>
    );
  }
);

WelcomeView.displayName = 'WelcomeView';