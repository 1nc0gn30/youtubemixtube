import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { 
  Loader2, 
  Settings, 
  X, 
  Check, 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  Sliders, 
  Music, 
  Terminal,
  Activity
} from "lucide-react";
import DatamoshTransition from "./components/DatamoshTransition";

interface Thumbnail {
  id: string;
  title: string;
  author: string;
  image: string;
  fallback: string;
}

const AVAILABLE_GENRES = [
  "Pop", "Hip Hop", "Rock", "R&B", 
  "Electronic", "Indie", "Afrobeats", 
  "K-Pop", "Latin", "Country"
];

// Procedural Audio Engine using Web Audio API
class GenerativeSynth {
  private ctx: AudioContext | null = null;
  private droneOscs: OscillatorNode[] = [];
  private droneGains: GainNode[] = [];
  private masterGain: GainNode | null = null;
  private isPlaying = false;

  constructor() {}

  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    this.ctx = new AudioContextClass();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.04, this.ctx.currentTime); // Low baseline volume
    this.masterGain.connect(this.ctx.destination);
  }

  startDrone(mode: string) {
    this.init();
    if (!this.ctx || !this.masterGain || this.isPlaying) return;
    
    this.isPlaying = true;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    // Base frequencies mapping based on vibe mode
    let baseFreq = 110; // A2
    if (mode === "lucky") baseFreq = 82.4; // E2 (deep dark ambient)
    else if (mode === "trending") baseFreq = 130.8; // C3 (brighter energetic vibe)
    else if (mode === "shuffle") baseFreq = 98.0; // G2 (wonky synth vibe)

    const chords = [baseFreq, baseFreq * 1.5, baseFreq * 2.0, baseFreq * 2.5];

    chords.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      // Warm triangle wave for analog 2026 aesthetics
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, this.ctx!.currentTime);
      osc.detune.setValueAtTime((Math.random() - 0.5) * 15, this.ctx!.currentTime);

      gain.gain.setValueAtTime(0, this.ctx!.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, this.ctx!.currentTime + 2.0); // Smooth 2s fade-in

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start();

      this.droneOscs.push(osc);
      this.droneGains.push(gain);

      // Low frequency modulator to create organic filter sweep
      const lfo = this.ctx!.createOscillator();
      const lfoGain = this.ctx!.createGain();
      lfo.frequency.setValueAtTime(0.1 + Math.random() * 0.15, this.ctx!.currentTime);
      lfoGain.gain.setValueAtTime(8, this.ctx!.currentTime);
      
      const filter = this.ctx!.createBiquadFilter();
      filter.type = "lowpass";
      filter.Q.setValueAtTime(1.0, this.ctx!.currentTime);
      filter.frequency.setValueAtTime(freq * 2.5, this.ctx!.currentTime);

      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();
      
      // Keep references to clean up if needed
      (osc as any).lfo = lfo;
    });
  }

  updateDrone(mode: string) {
    if (!this.ctx || !this.isPlaying) return;
    
    let baseFreq = 110; 
    if (mode === "lucky") baseFreq = 82.4; 
    else if (mode === "trending") baseFreq = 130.8; 
    else if (mode === "shuffle") baseFreq = 98.0;

    const chords = [baseFreq, baseFreq * 1.5, baseFreq * 2.0, baseFreq * 2.5];
    
    this.droneOscs.forEach((osc, idx) => {
      if (chords[idx]) {
        // Smoothly glide pitch to new chord notes (portamento)
        osc.frequency.exponentialRampToValueAtTime(chords[idx], this.ctx!.currentTime + 1.8);
      }
    });
  }

  stopDrone() {
    if (!this.ctx || !this.isPlaying) return;
    this.isPlaying = false;
    this.droneGains.forEach((gain) => {
      gain.gain.linearRampToValueAtTime(0, this.ctx!.currentTime + 1.0); // 1s fade-out
    });
    const oscs = [...this.droneOscs];
    this.droneOscs = [];
    this.droneGains = [];
    
    setTimeout(() => {
      oscs.forEach(osc => {
        try { 
          osc.stop(); 
          if ((osc as any).lfo) {
            (osc as any).lfo.stop();
          }
        } catch(e) {}
      });
    }, 1200);
  }

  playTransitionSound(style: number) {
    if (!this.ctx || !this.isPlaying) return;
    const now = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9); // decay envelope

    filter.type = "bandpass";
    filter.Q.setValueAtTime(8, now);

    if (style === 0) { // Datamosh: Digital glitch sweep
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(550, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.35);
      filter.frequency.setValueAtTime(1000, now);
      filter.frequency.exponentialRampToValueAtTime(180, now + 0.4);
    } 
    else if (style === 1) { // Horizontal Tear: High frequency static crackle
      osc.type = "square";
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.linearRampToValueAtTime(700, now + 0.12);
      filter.frequency.setValueAtTime(2500, now);
      filter.frequency.exponentialRampToValueAtTime(150, now + 0.18);
    } 
    else if (style === 2) { // VHS Melt: Low pitch tape flutter
      osc.type = "sine";
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.linearRampToValueAtTime(60, now + 0.75);
      
      const vibrato = this.ctx.createOscillator();
      const vibratoGain = this.ctx.createGain();
      vibrato.frequency.setValueAtTime(16, now);
      vibratoGain.gain.setValueAtTime(25, now);
      vibrato.connect(vibratoGain);
      vibratoGain.connect(osc.frequency);
      
      vibrato.start(now);
      vibrato.stop(now + 0.75);
      
      filter.frequency.setValueAtTime(350, now);
      filter.frequency.linearRampToValueAtTime(90, now + 0.75);
    } 
    else { // Liquid Wave: Resonant sweeping ripple
      osc.type = "sine";
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(850, now + 0.65);
      filter.frequency.setValueAtTime(450, now);
      filter.frequency.exponentialRampToValueAtTime(1800, now + 0.65);
    }

    osc.start(now);
    osc.stop(now + 0.9);
  }
  
  setVolume(vol: number) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.linearRampToValueAtTime(vol * 0.04, this.ctx.currentTime + 0.15);
    }
  }
}

export default function App() {
  const [queue, setQueue] = useState<Thumbnail[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Custom Settings & Visual Parameter States
  const [showSettings, setShowSettings] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [customArtists, setCustomArtists] = useState<string>("");
  const [playbackMode, setPlaybackMode] = useState<string>("mix");
  
  // Custom Controls (2026 Interactive Features)
  const [isPlaying, setIsPlaying] = useState(true);
  const [audioSource, setAudioSource] = useState<"youtube" | "synth" | "none">("youtube");
  const [volume, setVolume] = useState(0.5);
  const [youtubeReady, setYoutubeReady] = useState(false);
  const [showVideoPreview, setShowVideoPreview] = useState(true);
  const [gyroEnabled, setGyroEnabled] = useState(false);
  
  const playerRef = useRef<any>(null);

  const toggleGyro = () => {
    const DeviceOrientationEventClass = (window as any).DeviceOrientationEvent;
    if (DeviceOrientationEventClass && typeof DeviceOrientationEventClass.requestPermission === "function") {
      DeviceOrientationEventClass.requestPermission()
        .then((response: string) => {
          if (response === "granted") {
            setGyroEnabled(true);
          } else {
            setGyroEnabled(false);
          }
        })
        .catch((err: any) => {
          console.error("Gyro permission request failed:", err);
          setGyroEnabled(false);
        });
    } else {
      // Android / non-iOS standard mobile browsers
      setGyroEnabled(!gyroEnabled);
    }
  };
  
  // WebGL custom tuning parameters
  const [transitionStyle, setTransitionStyle] = useState<number>(-1); // -1: Auto, 0: Datamosh, 1: Tear, 2: VHS, 3: Liquid
  const [glitchIntensity, setGlitchIntensity] = useState<number>(1.0);
  const [aberrationStrength, setAberrationStrength] = useState<number>(1.0);
  const [mouseStrength, setMouseStrength] = useState<number>(0.8);
  const [scanlineDensity, setScanlineDensity] = useState<number>(800);
  const [transitionDuration, setTransitionDuration] = useState<number>(1200); // ms

  // Instantiate Synthesizer
  const synth = useMemo(() => new GenerativeSynth(), []);

  // Compute actual transition style based on video characteristics
  const activeStyle = useMemo(() => {
    if (transitionStyle !== -1) return transitionStyle;
    const video = queue[currentIndex];
    if (!video) return 0;
    const combined = `${video.title} ${video.author}`.toLowerCase();
    
    if (playbackMode === "lucky" || combined.includes("vaporwave") || combined.includes("retro") || combined.includes("synth") || combined.includes("80s") || combined.includes("90s") || combined.includes("vintage") || combined.includes("lo-fi") || combined.includes("vhsmelt")) {
      return 2; // VHS Melt
    }
    if (combined.includes("slow") || combined.includes("chill") || combined.includes("ambient") || combined.includes("lofi") || combined.includes("liquid") || combined.includes("electronic") || combined.includes("dream") || combined.includes("house") || combined.includes("downtempo")) {
      return 3; // Liquid Wave
    }
    if (combined.includes("rock") || combined.includes("metal") || combined.includes("live") || combined.includes("punk") || combined.includes("guitar") || combined.includes("math") || combined.includes("band") || combined.includes("concert")) {
      return 1; // Horizontal Tear
    }
    
    // Deterministic hash of video ID to make it different for each video but stable
    let hash = 0;
    for (let i = 0; i < video.id.length; i++) {
      hash += video.id.charCodeAt(i);
    }
    return hash % 4;
  }, [currentIndex, queue, transitionStyle, playbackMode]);
  
  // Refs to ensure callbacks have latest values without triggering infinite loops
  const fetchLock = useRef(false);
  const prefsRef = useRef({ genres: selectedGenres, artists: customArtists, mode: playbackMode });

  useEffect(() => {
    prefsRef.current = { genres: selectedGenres, artists: customArtists, mode: playbackMode };
  }, [selectedGenres, customArtists, playbackMode]);

  const fetchMoreThumbnails = useCallback(async (clearQueue = false) => {
    if (fetchLock.current) return;
    fetchLock.current = true;
    setIsFetching(true);
    
    try {
      const { genres, artists, mode } = prefsRef.current;
      const params = new URLSearchParams();
      if (genres.length > 0) params.append("genres", genres.join(","));
      if (artists.trim()) params.append("artists", artists);
      params.append("mode", mode);

      const response = await fetch(`/api/thumbnails?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch thumbnails");
      
      const data = await response.json();
      if (data.thumbnails && data.thumbnails.length > 0) {
        if (clearQueue) {
          setQueue(data.thumbnails);
          setCurrentIndex(0);
        } else {
          setQueue((prev) => [...prev, ...data.thumbnails]);
        }
      }
    } catch (err) {
      console.error(err);
      setError("Failed to connect. Re-engaging node...");
    } finally {
      setIsFetching(false);
      fetchLock.current = false;
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchMoreThumbnails();
  }, [fetchMoreThumbnails]);

  // Keep queue populated
  useEffect(() => {
    const remaining = queue.length - currentIndex;
    if (remaining <= 3 && !isFetching && !fetchLock.current && !showSettings) {
      fetchMoreThumbnails();
    }
  }, [currentIndex, queue.length, isFetching, fetchMoreThumbnails, showSettings]);

  // Transition timer
  useEffect(() => {
    if (queue.length === 0 || showSettings || !isPlaying) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev < queue.length - 1) {
          setIsTransitioning(true);
          return prev + 1;
        }
        return prev;
      });
    }, 4500); // Wait 4.5 seconds between images

    return () => clearInterval(timer);
  }, [queue.length, showSettings, isPlaying]);

  // YouTube API Player Initialization
  useEffect(() => {
    if (queue.length === 0) return;

    if (!(window as any).YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      
      (window as any).onYouTubeIframeAPIReady = () => {
        initPlayer();
      };
    } else {
      initPlayer();
    }

    function initPlayer() {
      if (playerRef.current) return;
      playerRef.current = new (window as any).YT.Player("youtube-player", {
        height: "100%",
        width: "100%",
        videoId: queue[currentIndex]?.id || "",
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3,
          origin: window.location.origin
        },
        events: {
          onReady: (event: any) => {
            setYoutubeReady(true);
            event.target.setVolume(volume * 100);
            if (isPlaying && audioSource === "youtube") {
              event.target.playVideo();
              event.target.unMute();
            } else {
              event.target.mute();
              event.target.pauseVideo();
            }
          }
        }
      });
    }
  }, [queue.length]);

  // Handle video change when slide advances
  useEffect(() => {
    if (youtubeReady && playerRef.current && typeof playerRef.current.loadVideoById === "function") {
      const currentVideo = queue[currentIndex];
      if (currentVideo) {
        if (audioSource === "youtube") {
          playerRef.current.unMute();
          playerRef.current.loadVideoById({
            videoId: currentVideo.id,
            suggestedQuality: "small"
          });
          playerRef.current.setVolume(volume * 100);
          if (isPlaying) {
            playerRef.current.playVideo();
          } else {
            playerRef.current.pauseVideo();
          }
        } else {
          playerRef.current.mute();
          playerRef.current.pauseVideo();
        }
      }
    }
  }, [currentIndex, youtubeReady, audioSource]);

  // Handle Play/Pause sync
  useEffect(() => {
    if (youtubeReady && playerRef.current) {
      if (isPlaying && audioSource === "youtube") {
        playerRef.current.playVideo();
      } else {
        playerRef.current.pauseVideo();
      }
    }
  }, [isPlaying, youtubeReady, audioSource]);

  // Handle Volume sync
  useEffect(() => {
    if (youtubeReady && playerRef.current) {
      playerRef.current.setVolume(volume * 100);
    }
  }, [volume, youtubeReady]);

  // Web Audio Synth synchronization hooks
  useEffect(() => {
    if (audioSource === "synth") {
      synth.startDrone(playbackMode);
      synth.updateDrone(playbackMode);
    } else {
      synth.stopDrone();
    }
  }, [audioSource, playbackMode, synth]);

  useEffect(() => {
    synth.setVolume(volume);
  }, [volume, synth]);

  // Play transition chime when slide advances
  useEffect(() => {
    if (audioSource !== "none" && currentIndex > 0) {
      synth.playTransitionSound(activeStyle);
    }
  }, [currentIndex, activeStyle, audioSource, synth]);

  // Interactive Playback Actions
  const handleNext = useCallback(() => {
    if (currentIndex < queue.length - 1) {
      setIsTransitioning(true);
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, queue.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setIsTransitioning(true);
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  const handleHistoryJump = (index: number) => {
    if (index === currentIndex || isTransitioning) return;
    setIsTransitioning(true);
    setCurrentIndex(index);
  };

  // Keyboard controls listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing inside form elements
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        return;
      }

      switch (e.code) {
        case "Space":
          e.preventDefault();
          setIsPlaying(prev => !prev);
          break;
        case "ArrowRight":
          e.preventDefault();
          handleNext();
          break;
        case "ArrowLeft":
          e.preventDefault();
          handlePrev();
          break;
        case "KeyS":
          e.preventDefault();
          setShowSettings(prev => !prev);
          break;
        case "KeyA":
          e.preventDefault();
          setAudioSource(prev => prev === "none" ? "youtube" : "none");
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePrev]);

  const applyPreferences = () => {
    setShowSettings(false);
    fetchMoreThumbnails(true); // clear queue and load fresh
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev => 
      prev.includes(genre) 
        ? prev.filter(g => g !== genre)
        : [...prev, genre]
    );
  };

  if (queue.length === 0) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-white font-sans">
        <div className="flex flex-col items-center gap-5 text-zinc-400">
          <Loader2 className="h-10 w-10 animate-spin text-white/60" />
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-white/50">
            {error || "Synchronizing Visual Node..."}
          </p>
        </div>
      </div>
    );
  }

  const currentImage = queue[currentIndex];
  const nextImage = queue[currentIndex + 1];

  // Visual history feed list (up to 6 items)
  const historyStart = Math.max(0, currentIndex - 5);
  const historyItems = queue.slice(historyStart, currentIndex + 1);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-zinc-950 text-white font-sans select-none">
      
      {/* Playback Progress Transport */}
      <div className="absolute top-0 left-0 right-0 z-30 h-1 bg-white/10">
        <motion.div
          key={currentImage.id}
          initial={{ width: "100%" }}
          animate={{ width: "0%" }}
          transition={{ duration: 4.5, ease: "linear" }}
          className="h-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)]"
          style={{
             animationPlayState: (!isPlaying || showSettings) ? 'paused' : 'running'
          }}
        />
      </div>

      {/* WebGL Glitch Transition layer */}
      <DatamoshTransition 
        imageUrl={currentImage.image} 
        nextImageUrl={nextImage?.image}
        isTransitioning={isTransitioning}
        setIsTransitioning={setIsTransitioning}
        transitionStyle={activeStyle}
        glitchIntensity={glitchIntensity}
        aberrationStrength={aberrationStrength}
        scanlineDensity={scanlineDensity}
        transitionDuration={transitionDuration}
        mouseStrength={mouseStrength}
        title={currentImage.title}
        gyroEnabled={gyroEnabled}
      />

      {/* Floating Picture-in-Picture YouTube Video Preview */}
      <div 
        className={`fixed top-24 right-6 sm:top-auto sm:bottom-36 sm:right-6 z-20 overflow-hidden rounded-xl border border-white/10 bg-black/60 backdrop-blur-xl shadow-2xl transition-all duration-500 w-44 h-25 sm:w-52 sm:h-30 ${
          showVideoPreview && audioSource === "youtube" ? "opacity-80 hover:opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"
        }`}
      >
        <div id="youtube-player" className="w-full h-full pointer-events-none" />
      </div>

      {/* Subtle overlay for text readability and aesthetic */}
      <div className="absolute inset-x-0 bottom-0 top-auto h-2/3 bg-gradient-to-t from-black/95 via-black/40 to-transparent pointer-events-none z-0" />

      {/* Ambient Radial Color Glow in Background matching current state */}
      <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[60%] h-[40%] rounded-full bg-white/3 blur-[180px] pointer-events-none z-0" />

      {/* Header Info & Logo */}
      <div className="absolute top-6 left-6 z-20 flex items-center gap-3 sm:top-12 sm:left-12">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 bg-black/40 backdrop-blur-xl">
          <Activity className="h-4 w-4 text-white/80 animate-pulse" />
        </div>
        <span className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-white/90">
          YouMix Tube
        </span>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white/50">
          v2.6
        </span>
      </div>

      {/* Floating Header Actions */}
      <div className="absolute right-6 top-6 z-20 flex items-center gap-3 sm:right-12 sm:top-12">
        {/* Audio Toggle Button */}
        <button
          onClick={() => setAudioSource(audioSource === "none" ? "youtube" : "none")}
          className={`group flex items-center justify-center rounded-full p-3 backdrop-blur-xl border transition-all duration-300 hover:scale-105 ${
            audioSource !== "none"
              ? "bg-emerald-400/10 border-emerald-400/40 text-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.15)]" 
              : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white"
          }`}
          title="Toggle Audio Feed (A)"
          aria-label="Toggle Audio"
        >
          {audioSource === "youtube" ? (
            <Music className="h-5 w-5 animate-pulse" />
          ) : audioSource === "synth" ? (
            <Music className="h-5 w-5 animate-bounce" />
          ) : (
            <VolumeX className="h-5 w-5" />
          )}
        </button>

        {/* Settings Toggle */}
        <button
          onClick={() => setShowSettings(true)}
          className="rounded-full bg-white/5 p-3 text-white/70 backdrop-blur-xl border border-white/10 transition-all hover:bg-white/10 hover:text-white hover:scale-105"
          aria-label="Open Settings"
          title="Open Settings (S)"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>

      {/* Left-Side Dashboard / Status (Premium 2026 Vibe) */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2 z-10 hidden flex-col gap-4 sm:flex sm:left-12">
        <div className="flex flex-col gap-2 rounded-2xl border border-white/5 bg-black/45 p-4 backdrop-blur-2xl max-w-[180px]">
          <div className="flex items-center gap-2 text-white/40">
            <Terminal className="h-3.5 w-3.5" />
            <span className="font-mono text-[9px] uppercase tracking-wider font-bold">Node Status</span>
          </div>
          
          <div className="mt-1 space-y-2 font-mono text-[10px]">
            <div className="flex justify-between gap-4">
              <span className="text-white/40">Feed:</span>
              <span className="text-white/80 capitalize font-semibold">{playbackMode}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-white/40">Transit:</span>
              <span className="text-white/80 font-semibold">
                {activeStyle === 0 ? "Mosh" : activeStyle === 1 ? "Tear" : activeStyle === 2 ? "VHS" : "Liquid"}
                {transitionStyle === -1 && <span className="text-[9px] text-emerald-400 ml-1">(Auto)</span>}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-white/40">Audio:</span>
              <span className={audioSource !== "none" ? "text-emerald-400 font-semibold" : "text-white/30"}>
                {audioSource === "youtube" ? "YouTube" : audioSource === "synth" ? "Synth" : "Off"}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-white/40">Gyro Tilt:</span>
              <span className={gyroEnabled ? "text-emerald-400 font-semibold animate-pulse" : "text-white/30"}>
                {gyroEnabled ? "Active" : "Off"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Interface Container */}
      <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-col gap-4 sm:bottom-12 sm:left-12 sm:right-12 sm:gap-6">
        
        {/* Floating Info & Controls Row */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
          
          {/* Main Title Metadata Card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentImage.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="flex max-w-3xl flex-col gap-1.5 drop-shadow-2xl z-10"
            >
              <h2 className="font-mono text-[10px] font-semibold tracking-[0.2em] text-white/60 uppercase mix-blend-screen line-clamp-1">
                {currentImage.author}
              </h2>
              <h1 className="font-sans text-xl font-extrabold tracking-tighter text-white sm:text-4xl lg:text-6xl line-clamp-2 md:leading-[1.05]">
                {currentImage.title}
              </h1>
            </motion.div>
          </AnimatePresence>
          
          {/* Audio Feed and Video Action Deck */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0 z-10">
            {/* Playback Controls */}
            <div className="flex items-center gap-1 rounded-full bg-white/5 border border-white/10 p-1 backdrop-blur-xl sm:p-1.5 sm:gap-1.5">
              <button 
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="rounded-full p-2 text-white/60 transition hover:bg-white/5 hover:text-white disabled:opacity-30 disabled:pointer-events-none sm:p-2.5"
                title="Previous Visual (Left Arrow)"
              >
                <SkipBack className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
              </button>
              
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="rounded-full bg-white p-2 text-black transition hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(255,255,255,0.2)] sm:p-2.5"
                title="Play/Pause Stream (Space)"
              >
                {isPlaying ? <Pause className="h-4 w-4 fill-black sm:h-4.5 sm:w-4.5" /> : <Play className="h-4 w-4 fill-black sm:h-4.5 sm:w-4.5" />}
              </button>

              <button 
                onClick={handleNext}
                disabled={currentIndex === queue.length - 1}
                className="rounded-full p-2 text-white/60 transition hover:bg-white/5 hover:text-white disabled:opacity-30 disabled:pointer-events-none sm:p-2.5"
                title="Next Visual (Right Arrow)"
              >
                <SkipForward className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
              </button>
            </div>

            {/* YouTube Direct Link */}
            <a
              href={`https://www.youtube.com/watch?v=${currentImage.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-white/10 px-4 py-2.5 sm:px-7 sm:py-3.5 font-bold text-white backdrop-blur-xl border border-white/20 transition-all duration-300 hover:scale-[1.03] hover:bg-white/20 hover:border-white/40 active:scale-[0.98] shadow-[0_0_30px_rgba(255,255,255,0.08)]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out" />
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 sm:h-4.5 sm:w-4.5">
                <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
              </svg>
              <span className="text-[10px] sm:text-xs tracking-wide">YouTube Direct</span>
            </a>
          </div>
        </div>

        {/* History Timeline Feed Overlay */}
        <div className="flex flex-col gap-2 z-10 border-t border-white/5 pt-3 sm:pt-4 sm:gap-2.5">
          <div className="flex items-center justify-between text-white/40 font-mono text-[8px] sm:text-[9px] uppercase tracking-widest font-bold">
            <span>Visual Stream History</span>
            <span className="text-white/60">Node {currentIndex + 1} of {queue.length}</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none sm:gap-3">
            {/* Historical entries */}
            {queue.slice(0, currentIndex + 1).map((item, idx) => {
              const isActive = idx === currentIndex;
              return (
                <div
                  key={`${item.id}-${idx}`}
                  onClick={() => handleHistoryJump(idx)}
                  className={`relative flex-shrink-0 h-8 w-12 sm:h-12 sm:w-20 rounded-md sm:rounded-lg overflow-hidden border cursor-pointer transition-all duration-300 hover:scale-105 ${
                    isActive 
                      ? "border-white shadow-[0_0_10px_rgba(255,255,255,0.4)]" 
                      : "border-white/10 opacity-50 hover:opacity-90"
                  }`}
                >
                  <img 
                    src={`/api/image-proxy?url=${encodeURIComponent(item.image)}&fallback=${encodeURIComponent(item.fallback)}`}
                    alt={item.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/20 hover:bg-transparent transition-colors" />
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Settings Modal / Config Sheet */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-end justify-center bg-black/70 p-4 pb-0 backdrop-blur-3xl sm:items-center sm:p-6"
          >
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 26, stiffness: 220 }}
              className="relative flex w-full max-w-xl max-h-[92vh] flex-col overflow-hidden rounded-t-[2rem] bg-zinc-950 border border-white/10 shadow-2xl sm:rounded-3xl"
            >
              {/* Drag Handle */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 h-1.5 w-12 rounded-full bg-white/20 sm:hidden" />
              
              <div className="flex items-center justify-between border-b border-white/5 px-8 pb-5 pt-8">
                <div className="flex items-center gap-2.5">
                  <Sliders className="h-5 w-5 text-white/70" />
                  <h2 className="text-xl font-bold tracking-tight text-white">Algorithm Console</h2>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className="rounded-full bg-white/5 p-2 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Tabs Content */}
              <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                
                {/* Visual Glitch Parameter Suite */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-white/40">
                    <Sparkles className="h-3.5 w-3.5" />
                    <h3 className="text-[10px] font-bold tracking-[0.2em] uppercase">Visual Modulators</h3>
                  </div>

                  {/* Transition style choice */}
                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      { id: -1, label: "Auto" },
                      { id: 0, label: "Mosh" },
                      { id: 1, label: "Tear" },
                      { id: 2, label: "VHS" },
                      { id: 3, label: "Wave" },
                    ].map((style) => (
                      <button
                        key={style.id}
                        onClick={() => setTransitionStyle(style.id)}
                        className={`rounded-xl border py-2 text-[10px] font-semibold transition-all ${
                          transitionStyle === style.id
                            ? "border-white bg-white text-black font-bold"
                            : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                        }`}
                      >
                        {style.label}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-3 pt-2">
                    {/* Intensity Slider */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-white/60 font-medium">Glitch Intensity</span>
                        <span className="font-mono text-white/40">{glitchIntensity.toFixed(1)}x</span>
                      </div>
                      <input 
                        type="range" min="0" max="2" step="0.1" 
                        value={glitchIntensity} 
                        onChange={(e) => setGlitchIntensity(parseFloat(e.target.value))}
                        className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
                      />
                    </div>

                    {/* Chromatic Aberration */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-white/60 font-medium">Chromatic Drift</span>
                        <span className="font-mono text-white/40">{aberrationStrength.toFixed(1)}x</span>
                      </div>
                      <input 
                        type="range" min="0" max="2" step="0.1" 
                        value={aberrationStrength} 
                        onChange={(e) => setAberrationStrength(parseFloat(e.target.value))}
                        className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
                      />
                    </div>

                    {/* Mouse Interaction Strength */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-white/60 font-medium">Mouse Warp Force</span>
                        <span className="font-mono text-white/40">{mouseStrength.toFixed(1)}x</span>
                      </div>
                      <input 
                        type="range" min="0" max="2" step="0.1" 
                        value={mouseStrength} 
                        onChange={(e) => setMouseStrength(parseFloat(e.target.value))}
                        className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
                      />
                    </div>

                    {/* Transition Duration */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-white/60 font-medium">Transit Speed</span>
                        <span className="font-mono text-white/40">{transitionDuration}ms</span>
                      </div>
                      <input 
                        type="range" min="500" max="3000" step="100" 
                        value={transitionDuration} 
                        onChange={(e) => setTransitionDuration(parseInt(e.target.value))}
                        className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Playback Mode */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-white/40">
                    <Activity className="h-3.5 w-3.5" />
                    <h3 className="text-[10px] font-bold tracking-[0.2em] uppercase">Vibe Parameters</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "mix", label: "Mix Feed" },
                      { id: "shuffle", label: "Pure Shuffle" },
                      { id: "lucky", label: "I'm Lucky (Obscure)" },
                      { id: "trending", label: "Trending Top" },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        onClick={() => setPlaybackMode(mode.id)}
                        className={`rounded-xl border px-4 py-2.5 text-xs font-semibold transition-all ${
                          playbackMode === mode.id
                            ? "border-white bg-white text-black font-bold"
                            : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Genre Seeding */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase">Genre Seeds</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {AVAILABLE_GENRES.map((genre) => {
                      const isSelected = selectedGenres.includes(genre);
                      return (
                        <button
                          key={genre}
                          onClick={() => toggleGenre(genre)}
                          className={`flex items-center gap-1 rounded-full px-4 py-1.5 text-xs font-semibold transition-all border ${
                            isSelected
                              ? "border-emerald-400 bg-emerald-400/10 text-emerald-300"
                              : "border-white/10 bg-transparent text-white/50 hover:bg-white/5"
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                          {genre}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Specific Artists */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase">Creator Focus</h3>
                  <input
                    type="text"
                    value={customArtists}
                    onChange={(e) => setCustomArtists(e.target.value)}
                    placeholder="e.g. The Weeknd, Drake, Daft Punk"
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-xs text-white placeholder:text-white/35 focus:border-white/40 focus:outline-none transition-all"
                  />
                </div>

                {/* Audio Source Customizer */}
                <div className="space-y-3 border-t border-white/5 pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white/40">
                      <Music className="h-3.5 w-3.5" />
                      <h3 className="text-[10px] font-bold tracking-[0.2em] uppercase">Audio Feed Mode</h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "youtube", label: "YouTube" },
                      { id: "synth", label: "Synth Drone" },
                      { id: "none", label: "Mute" },
                    ].map((src) => (
                      <button
                        key={src.id}
                        onClick={() => setAudioSource(src.id as any)}
                        className={`rounded-xl border py-2 text-xs font-semibold transition-all ${
                          audioSource === src.id
                            ? "border-white bg-white text-black font-bold"
                            : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                        }`}
                      >
                        {src.label}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-1 pt-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-white/40">Master Volume</span>
                      <span className="font-mono text-white/40">{Math.round(volume * 100)}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="1" step="0.05"
                      value={volume}
                      disabled={audioSource === "none"}
                      onChange={(e) => setVolume(parseFloat(e.target.value))}
                      className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white disabled:opacity-20"
                    />
                  </div>

                  {audioSource === "youtube" && (
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-white/40">Show Video Picture-In-Picture</span>
                      <button 
                        onClick={() => setShowVideoPreview(!showVideoPreview)}
                        className={`px-3 py-1 rounded-full border text-[10px] font-bold transition ${
                          showVideoPreview ? "border-white text-white bg-white/5" : "border-white/10 text-white/40"
                        }`}
                      >
                        {showVideoPreview ? "Visible" : "Hidden"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Gyroscope Tilt Controller */}
                <div className="space-y-3 border-t border-white/5 pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white/40">
                      <Sparkles className="h-3.5 w-3.5" />
                      <h3 className="text-[10px] font-bold tracking-[0.2em] uppercase">Gyro Parallax Tilt</h3>
                    </div>
                    
                    <button 
                      onClick={toggleGyro}
                      className={`text-xs px-3.5 py-1.5 rounded-full font-bold border transition duration-300 ${
                        gyroEnabled 
                          ? "border-emerald-400 text-emerald-400 bg-emerald-400/5 shadow-[0_0_15px_rgba(52,211,153,0.15)]" 
                          : "border-white/10 text-white/50 hover:text-white hover:border-white/30"
                      }`}
                    >
                      {gyroEnabled ? "Motion Enabled" : "Enable Motion"}
                    </button>
                  </div>
                  <p className="text-[10px] text-white/35">
                    Rotate and tilt your phone to tilt the WebGL perspective and shift the color spectrum in real-time. (Requires motion permissions on mobile).
                  </p>
                </div>

              </div>

              <div className="border-t border-white/5 bg-black/30 p-6 flex justify-end shrink-0 sm:rounded-b-3xl">
                <button
                  onClick={applyPreferences}
                  className="w-full sm:w-auto rounded-full bg-white px-8 py-3.5 text-xs font-bold text-black transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_25px_rgba(255,255,255,0.15)]"
                >
                  Deploy Node Configurations
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
