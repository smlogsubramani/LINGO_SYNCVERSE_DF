import { useEffect, useState } from 'react';
import { ApplyThemeScript, ThemeToggle } from '../components/app/theme-toggle';
import { cn, getAppConfig, getStyles } from '../lib/utils';
import '@/styles/globals.css';

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  const [appConfig, setAppConfig] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        // In Vite, we fetch config client-side
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
      <html lang="en" suppressHydrationWarning>
        <head>
          <title>Loading...</title>
        </head>
        <body className="flex items-center justify-center min-h-screen">
          <div className="text-center">Loading...</div>
        </body>
      </html>
    );
  }

  const { pageTitle, pageDescription } = appConfig;
  const styles = getStyles(appConfig);

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        'scroll-smooth font-sans antialiased'
      )}
    >
      <head>
        {styles && <style>{styles}</style>}
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <ApplyThemeScript />
        
        {/* Preload fonts for Vite */}
        <link
          rel="preload"
          href="/fonts/CommitMono-400-Regular.otf"
          as="font"
          type="font/otf"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/CommitMono-700-Regular.otf"
          as="font"
          type="font/otf"
          crossOrigin="anonymous"
        />
        
        {/* Google Fonts for Public Sans */}
        <link
          href="https://fonts.googleapis.com/css2?family=Public+Sans:ital,wght@0,100..900;1,100..900&display=swap"
          rel="stylesheet"
        />
        
        {/* Define CSS variables for fonts */}
        <style>{`
          :root {
            --font-public-sans: 'Public Sans', ui-sans-serif, system-ui, sans-serif;
            --font-commit-mono: 'Commit Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          }
        `}</style>
      </head>
      <body className="overflow-x-hidden">
        {children}
        <div className="group fixed bottom-0 left-1/2 z-50 mb-2 -translate-x-1/2">
          <ThemeToggle className="translate-y-20 transition-transform delay-150 duration-300 group-hover:translate-y-0" />
        </div>
      </body>
    </html>
  );
}