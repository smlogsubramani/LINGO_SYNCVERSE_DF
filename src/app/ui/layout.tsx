import * as React from 'react';
import { SessionProvider } from '../../components/app/session-provider';
import { getAppConfig } from '../../lib/utils';
import { useEffect, useState } from 'react';

export default function ComponentsLayout({ children }: { children: React.ReactNode }) {
  const [appConfig, setAppConfig] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        // In Vite, we fetch config client-side
        const config = await getAppConfig();
        setAppConfig(config);
      } catch (error) {
        console.error('Failed to fetch app config:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfig();
  }, []);

  if (isLoading || !appConfig) {
    return (
      <div className="bg-muted/20 min-h-svh p-8 flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <SessionProvider appConfig={appConfig}>
      <div className="bg-muted/20 min-h-svh p-8">
        <div className="mx-auto max-w-3xl space-y-8">
          <header className="space-y-2">
            <h1 className="text-5xl font-bold tracking-tight">LiveKit UI</h1>
            <p className="text-muted-foreground max-w-80 leading-tight text-pretty">
              A set of UI components for building LiveKit-powered voice experiences.
            </p>
            <p className="text-muted-foreground max-w-prose text-balance">
              Built with{' '}
              <a href="https://shadcn.com" className="underline underline-offset-2">
                Shadcn
              </a>
              ,{' '}
              <a href="https://motion.dev" className="underline underline-offset-2">
                Motion
              </a>
              , and{' '}
              <a href="https://livekit.io" className="underline underline-offset-2">
                LiveKit
              </a>
              .
            </p>
            <p className="text-foreground max-w-prose text-balance">Open Source.</p>
          </header>

          <main className="space-y-20">{children}</main>
        </div>
      </div>
    </SessionProvider>
  );
}