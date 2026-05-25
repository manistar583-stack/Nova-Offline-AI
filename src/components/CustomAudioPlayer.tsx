import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Download } from 'lucide-react';

export function CustomAudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationRef = useRef<number>();
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const initAudioContext = useCallback(() => {
    if (audioContextRef.current) return;
    const audio = audioRef.current;
    if (!audio) return;

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64; // Yields 32 frequency bins, perfect for 30 bars

      // Enable CORS for media source if it's an external URL
      if (src.startsWith('http')) {
         audio.crossOrigin = 'anonymous';
      }

      const source = audioContext.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(audioContext.destination);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;
    } catch (err) {
      console.warn('Web Audio API not supported or initialization failed:', err);
    }
  }, [src]);

  const updateWaveform = useCallback(() => {
    if (!analyserRef.current) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    barsRef.current.forEach((bar, index) => {
      if (bar) {
        // dataArray has values 0-255
        const value = dataArray[index];
        const percent = value / 255;
        // height in px: min 4, max 32 (h-8 = 32px)
        const height = Math.max(4, percent * 32);
        // smooth transition using logic or just assign height
        bar.style.height = `${height}px`;
      }
    });

    animationRef.current = requestAnimationFrame(updateWaveform);
  }, []);

  const resetWaveform = useCallback(() => {
    barsRef.current.forEach(bar => {
      if (bar) {
        bar.style.height = '4px';
      }
    });
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play().then(() => {
        if (audioContextRef.current?.state === 'suspended') {
          audioContextRef.current.resume();
        }
        animationRef.current = requestAnimationFrame(updateWaveform);
      }).catch(err => {
        console.error("Audio playback error:", err);
        setIsPlaying(false);
      });
    } else {
      audio.pause();
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      resetWaveform();
    }
    
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, updateWaveform, resetWaveform]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const setAudioData = () => setDuration(audio.duration);
    const setAudioTime = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => {
      setIsPlaying(false);
      resetWaveform();
    };

    audio.addEventListener('loadedmetadata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [resetWaveform]);

  const togglePlayPause = () => {
    initAudioContext();
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newTime = Number(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <div className="flex flex-col w-full max-w-md bg-gray-900/50 rounded-xl p-4 mt-4 border border-gray-800/50 backdrop-blur-sm shadow-xl">
      <audio ref={audioRef} src={src} preload="metadata" />
      
      <div className="flex items-center gap-4">
        {/* Play/Pause Button */}
        <button 
          onClick={togglePlayPause}
          className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-nova-accent hover:bg-nova-accent/80 text-white rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-nova-accent focus:ring-offset-2 focus:ring-offset-gray-900"
        >
          {isPlaying ? <Pause size={20} className="fill-current" /> : <Play size={20} className="fill-current ml-1" />}
        </button>

        {/* Waveform Visualization */}
        <div className="flex-1 flex items-center h-8 gap-[2px] overflow-hidden">
          {[...Array(30)].map((_, i) => (
            <div 
              key={i}
              ref={el => barsRef.current[i] = el}
              className="w-1 rounded-full bg-nova-accent/80 transition-all duration-[50ms]"
              style={{
                height: '4px',
                opacity: (currentTime / duration) > (i / 30) || !duration ? 1 : 0.3
              }}
            />
          ))}
        </div>
        
        {/* Mute Button */}
        <button 
          onClick={toggleMute}
          className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
        >
          {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>

        {/* Download Button */}
        <a 
          href={src} 
          download="audio.mp3"
          className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
          title="Download audio"
        >
          <Download size={18} />
        </a>
      </div>

      {/* Progress Bar & Time */}
      <div className="flex items-center gap-3 mt-3 text-xs text-gray-400 font-mono">
        <span>{formatTime(currentTime)}</span>
        <input 
          type="range" 
          min={0} 
          max={duration || 100} 
          value={currentTime} 
          onChange={handleProgressChange}
          className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-nova-accent"
        />
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}
