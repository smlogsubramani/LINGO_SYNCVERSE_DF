import { Request, Response } from 'express';
import { APP_CONFIG_DEFAULTS, AppConfig } from '../../app-config';

// Default app config for OG images
const DEFAULT_APP_CONFIG: AppConfig = {
  ...APP_CONFIG_DEFAULTS,
  pageTitle: 'LiveKit Voice Agent',
  pageDescription: 'A voice agent built with LiveKit',
};

// Clean page title for display
function cleanPageTitle(pageTitle: string): string {
  if (pageTitle === APP_CONFIG_DEFAULTS.pageTitle) {
    return 'Voice Agent';
  }
  return pageTitle;
}

// Generate SVG OG image
function generateOGImageSVG(appConfig: AppConfig = DEFAULT_APP_CONFIG): string {
  const width = 1200;
  const height = 628;
  const pageTitle = cleanPageTitle(appConfig.pageTitle);

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Background gradient -->
      <defs>
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#0f0f0f;stop-opacity:1" />
          <stop offset="50%" style="stop-color:#1a1a1a;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#0f0f0f;stop-opacity:1" />
        </linearGradient>
        
        <!-- Grid pattern -->
        <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
          <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
        </pattern>
      </defs>
      
      <!-- Background -->
      <rect width="${width}" height="${height}" fill="url(#bgGradient)"/>
      <rect width="${width}" height="${height}" fill="url(#grid)"/>
      
      <!-- LiveKit Logo (simplified) -->
      <rect x="60" y="60" width="60" height="60" rx="12" fill="#0066ff"/>
      <circle cx="90" cy="75" r="8" fill="white"/>
      <circle cx="75" cy="105" r="8" fill="white"/>
      <circle cx="105" cy="105" r="8" fill="white"/>
      
      <!-- Company Name -->
      <text x="140" y="95" font-family="Inter, Arial, sans-serif" font-size="32" font-weight="bold" fill="white">
        ${appConfig.companyName}
      </text>
      
      <!-- Main Title -->
      <text x="60" y="300" font-family="Inter, Arial, sans-serif" font-size="72" font-weight="bold" fill="white">
        ${pageTitle}
      </text>
      
      <!-- Description -->
      <text x="60" y="400" font-family="Inter, Arial, sans-serif" font-size="24" fill="#cccccc">
        ${appConfig.pageDescription}
      </text>
      
      <!-- LiveKit Branding -->
      <text x="60" y="568" font-family="'SF Mono', Monaco, 'Cascadia Code', monospace" font-size="18" fill="rgba(255,255,255,0.7)">
        Powered by LiveKit Agents
      </text>
      
      <!-- Sandbox Badge -->
      <rect x="940" y="60" width="140" height="40" rx="4" fill="#0066ff"/>
      <text x="1010" y="85" text-anchor="middle" font-family="'SF Mono', Monaco, 'Cascadia Code', monospace" font-size="16" font-weight="bold" fill="white">
        SANDBOX
      </text>
      
      <!-- Bottom border -->
      <rect x="0" y="624" width="${width}" height="4" fill="#0066ff" fill-opacity="0.3"/>
    </svg>
  `;
}

// Convert SVG to PNG using a simple API (no native dependencies)
async function convertSVGtoPNG(svg: string): Promise<Buffer> {
  // Use a simple SVG to PNG conversion service or library without native dependencies
  // For now, we'll return the SVG as is, and the client can handle conversion if needed
  return Buffer.from(svg);
}

// Express route handler
export async function handleOGImageRequest(req: Request, res: Response) {
  try {
    // Customize config based on query parameters
    const customConfig: Partial<AppConfig> = {
      pageTitle: (req.query.title as string) || DEFAULT_APP_CONFIG.pageTitle,
      pageDescription: (req.query.description as string) || DEFAULT_APP_CONFIG.pageDescription,
      companyName: (req.query.company as string) || DEFAULT_APP_CONFIG.companyName,
    };

    const appConfig: AppConfig = {
      ...DEFAULT_APP_CONFIG,
      ...customConfig,
    };

    const format = (req.query.format as string) || 'svg';
    
    if (format === 'svg') {
      // Return SVG directly
      const svg = generateOGImageSVG(appConfig);
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(svg);
    } else {
      // For PNG, you might want to use a cloud service
      res.status(400).json({
        error: 'PNG format requires additional setup. Use SVG format or set up a conversion service.',
        suggestion: 'Use ?format=svg or implement a cloud-based PNG conversion service'
      });
    }
  } catch (error) {
    console.error('Error generating OG image:', error);
    res.status(500).json({ 
      error: 'Failed to generate Open Graph image',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}