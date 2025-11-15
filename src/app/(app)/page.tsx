import { useEffect, useState } from 'react';
import { App } from '../../components/app/app';
import { getAppConfig } from '../../lib/utils';
import { AppConfig } from '../../app-config';

export default function Page() {
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!appConfig) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-destructive">Failed to load configuration</h2>
          <p className="mt-2 text-muted-foreground">Please refresh the page to try again.</p>
        </div>
      </div>
    );
  }

  return <App appConfig={appConfig} />;
}