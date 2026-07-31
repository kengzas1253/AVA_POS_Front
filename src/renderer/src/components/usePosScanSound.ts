import { useCallback, useEffect, useRef, useState } from "react";
import {
  defaultPosScanSoundSettings,
  getPosScanSoundUrl,
  getStoredPosScanSoundSettings,
  subscribePosScanSoundSettingsChanged,
  type PosScanSoundSettings,
  type PosScanSoundType,
} from "./posScanSoundSettings";

const createAudio = (type: PosScanSoundType): HTMLAudioElement | null => {
  if (typeof Audio === "undefined") return null;

  const audio = new Audio(getPosScanSoundUrl(type));
  audio.preload = "auto";
  return audio;
};

export const usePosScanSound = () => {
  const [settings, setSettings] = useState<PosScanSoundSettings>(
    defaultPosScanSoundSettings,
  );
  const firstProductScanAudioRef = useRef<HTMLAudioElement | null>(null);
  const noProductsFoundAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    firstProductScanAudioRef.current = createAudio("firstProductScan");
    noProductsFoundAudioRef.current = createAudio("noProductsFound");

    void getStoredPosScanSoundSettings().then(setSettings);
    const unsubscribe = subscribePosScanSoundSettingsChanged(setSettings);

    return () => {
      unsubscribe();
      firstProductScanAudioRef.current?.pause();
      noProductsFoundAudioRef.current?.pause();
      firstProductScanAudioRef.current = null;
      noProductsFoundAudioRef.current = null;
    };
  }, []);

  const playAudio = useCallback((audio: HTMLAudioElement | null) => {
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  }, []);

  const playFirstProductScan = useCallback(() => {
    if (!settings.enabled || !settings.firstProductScanEnabled) return;
    playAudio(firstProductScanAudioRef.current);
  }, [playAudio, settings.enabled, settings.firstProductScanEnabled]);

  const playNoProductsFound = useCallback(() => {
    if (!settings.enabled || !settings.noProductsFoundEnabled) return;
    playAudio(noProductsFoundAudioRef.current);
  }, [playAudio, settings.enabled, settings.noProductsFoundEnabled]);

  return {
    settings,
    playFirstProductScan,
    playNoProductsFound,
  };
};

