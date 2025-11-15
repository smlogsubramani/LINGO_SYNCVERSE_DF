import { useEffect, useState } from 'react';
import { getAppConfig } from '../../lib/utils';

interface LayoutProps {
  children: React.ReactNode;
}

interface AppConfig {
  companyName: string;
  logo: string;
  logoDark?: string;
}

export default function Layout({ children }: LayoutProps) {
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        // In Vite, we fetch config client-side without headers
        const config = await getAppConfig();
        setAppConfig(config);
      } catch (error) {
        console.error('Failed to load app config:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, []);

  // Show minimal header while loading to avoid layout shift
  if (isLoading || !appConfig) {
    return (
      <>
        <header className="fixed top-0 left-0 z-50 hidden w-full flex-row justify-between p-6 md:flex">
          <div className="size-6 bg-muted rounded animate-pulse"></div>
          <span className="text-foreground font-mono text-xs font-bold tracking-wider uppercase">
            Built with{' '}
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://docs.livekit.io/agents"
              className="underline underline-offset-4"
            >
              LiveKit Agents
            </a>
          </span>
        </header>
        {children}
      </>
    );
  }

  const { companyName, logo, logoDark } = appConfig;

  return (
    <>
      <header className="fixed top-0 left-0 z-50 hidden w-full flex-row justify-between p-6 md:flex">
        <a
          target="_blank"
          rel="noopener noreferrer"
          href="https://livekit.io"
          className="scale-100 transition-transform duration-300 hover:scale-110"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={logo} 
            alt={`${companyName} Logo`} 
            className="block size-6 dark:hidden" 
            onError={(e) => {
              // Fallback if image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoDark ?? logo}
            alt={`${companyName} Logo`}
            className="hidden size-6 dark:block"
            onError={(e) => {
              // Fallback if image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        </a>
        <span className="text-foreground font-mono text-xs font-bold tracking-wider uppercase">
          Built with{' '}
          <a
            target="_blank"
            rel="noopener noreferrer"
            href="https://docs.livekit.io/agents"
            className="underline underline-offset-4"
          >
            LiveKit Agents
          </a>
        </span>
      </header>

      {children}
    </>
  );
}