/**
 * Main Layout Component
 * TitleBar at top, then sidebar + content below.
 */
import { Outlet } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { Sidebar } from './Sidebar';
import { TitleBar } from './TitleBar';
import { useSettingsStore } from '@/stores/settings';
import { invokeIpc } from '@/lib/api-client';

export function MainLayout() {
  const backgroundImage = useSettingsStore((s) => s.backgroundImage);
  const backgroundType = useSettingsStore((s) => s.backgroundType);
  const backgroundOpacity = useSettingsStore((s) => s.backgroundOpacity);
  const backgroundBlur = useSettingsStore((s) => s.backgroundBlur);
  const [bgDataUrl, setBgDataUrl] = useState('');
  const [bgIsVideo, setBgIsVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!backgroundImage) {
      setBgDataUrl('');
      setBgIsVideo(false);
      return;
    }
    invokeIpc<{ success: boolean; dataUrl?: string; isVideo?: boolean; mimeType?: string }>('settings:getBackgroundImageDataUrl')
      .then((res) => {
        if (res?.success) {
          const isVideo = res.isVideo ?? false;
          setBgIsVideo(isVideo);
          if (isVideo) {
            // Use custom protocol for video streaming
            setBgDataUrl(`clawx-bg://background?t=${Date.now()}`);
          } else if (res.dataUrl) {
            setBgDataUrl(res.dataUrl);
          } else {
            setBgDataUrl('');
          }
        } else {
          setBgDataUrl('');
          setBgIsVideo(false);
        }
      })
      .catch(() => { setBgDataUrl(''); setBgIsVideo(false); });
  }, [backgroundImage, backgroundType]);

  const hasBackground = !!bgDataUrl;

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background">
      {/* Custom background layer */}
      {hasBackground && !bgIsVideo && (
        <div
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${bgDataUrl})`,
            opacity: backgroundOpacity,
            filter: backgroundBlur > 0 ? `blur(${backgroundBlur}px)` : undefined,
            // Slightly scale up to avoid blur edge artifacts
            transform: backgroundBlur > 0 ? 'scale(1.05)' : undefined,
          }}
        />
      )}
      {/* Video background layer */}
      {hasBackground && bgIsVideo && (
        <video
          ref={videoRef}
          key={bgDataUrl}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 z-0 h-full w-full object-cover"
          style={{
            opacity: backgroundOpacity,
            filter: backgroundBlur > 0 ? `blur(${backgroundBlur}px)` : undefined,
            transform: backgroundBlur > 0 ? 'scale(1.05)' : undefined,
          }}
          src={bgDataUrl}
        />
      )}

      {/* Content layer */}
      <div className={`relative z-10 flex h-full flex-col ${hasBackground ? 'bg-background/70' : ''}`}>
        {/* Title bar: drag region on macOS, icon + controls on Windows */}
        <TitleBar />

        {/* Below the title bar: sidebar + content */}
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
