import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { APP_CONFIG_DEFAULTS } from '../app-config';
import { AppConfig } from '../app-config';

// Vite uses import.meta.env for env variables
export const CONFIG_ENDPOINT = import.meta.env.VITE_APP_CONFIG_ENDPOINT;
export const SANDBOX_ID = import.meta.env.VITE_SANDBOX_ID;

export const THEME_STORAGE_KEY = 'theme-mode';
export const THEME_MEDIA_QUERY = '(prefers-color-scheme: dark)';

export interface SandboxConfig {
  [key: string]:
    | { type: 'string'; value: string }
    | { type: 'number'; value: number }
    | { type: 'boolean'; value: boolean }
    | null;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Updated for Vite - removed headers parameter since we're client-side
export async function getAppConfig(): Promise<AppConfig> {
  if (CONFIG_ENDPOINT) {
    const sandboxId = SANDBOX_ID || '';
    try {
      if (!sandboxId) {
        console.warn('Sandbox ID is not available, using default config');
        return APP_CONFIG_DEFAULTS;
      }
      
      const response = await fetch(CONFIG_ENDPOINT, {
        cache: 'no-store',
        headers: { 
          'X-Sandbox-ID': sandboxId,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const remoteConfig: SandboxConfig = await response.json();
        const config: AppConfig = { ...APP_CONFIG_DEFAULTS, sandboxId };
        
        for (const [key, entry] of Object.entries(remoteConfig)) {
          if (entry === null) continue;
          if (
            (key in APP_CONFIG_DEFAULTS &&
              APP_CONFIG_DEFAULTS[key as keyof AppConfig] === undefined) ||
            (typeof config[key as keyof AppConfig] === entry.type &&
              typeof config[key as keyof AppConfig] === typeof entry.value)
          ) {
            // @ts-expect-error type safety checked above
            config[key as keyof AppConfig] = entry.value as AppConfig[keyof AppConfig];
          }
        }
        return config;
      } else {
        console.error(
          `ERROR: querying config endpoint failed with status ${response.status}: ${response.statusText}`
        );
      }
    } catch (error) {
      console.error('ERROR: getAppConfig()', error);
    }
  }
  return APP_CONFIG_DEFAULTS;
}

export function getStyles(appConfig: AppConfig) {
  const { accent, accentDark } = appConfig;
  return [
    accent
      ? `:root { --primary: ${accent}; --primary-hover: color-mix(in srgb, ${accent} 80%, #000); }`
      : '',
    accentDark
      ? `.dark { --primary: ${accentDark}; --primary-hover: color-mix(in srgb, ${accentDark} 80%, #000); }`
      : ''
  ]
    .filter(Boolean)
    .join('\n');
}