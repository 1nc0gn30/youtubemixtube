import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { TextureLoader, ShaderMaterial, Texture, Vector2, Mesh } from "three";
import { Text } from "@react-three/drei";

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 modelPosition = modelMatrix * vec4(position, 1.0);
  vec4 viewPosition = viewMatrix * modelPosition;
  vec4 projectedPosition = projectionMatrix * viewPosition;
  gl_Position = projectedPosition;
}
`;

const fragmentShader = `
uniform float progress;
uniform float time;
uniform sampler2D tex1;
uniform sampler2D tex2;
uniform vec2 uMouse;
uniform float uMouseStrength;
uniform vec2 uDeviceTilt;
uniform int uStyle;
uniform float uGlitchIntensity;
uniform float uAberrationStrength;
uniform float uScanlineDensity;

varying vec2 vUv;

// Pseudo-random noise
float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

// 2D Noise
float noise(vec2 p){
    vec2 ip = floor(p);
    vec2 u = fract(p);
    u = u*u*(3.0-2.0*u);
    
    float res = mix(
        mix(rand(ip),rand(ip+vec2(1.0,0.0)),u.x),
        mix(rand(ip+vec2(0.0,1.0)),rand(ip+vec2(1.0,1.0)),u.x),u.y);
    return res*res;
}

void main() {
    vec2 p = vUv;
    
    // 1. Mouse interactive blocky datamosh displacement
    float mouseDist = distance(p, uMouse);
    if (mouseDist < 0.22) {
        float force = (1.0 - smoothstep(0.0, 0.22, mouseDist)) * uMouseStrength;
        float blocks = 45.0;
        vec2 p_pixel = floor(p * blocks) / blocks;
        float n = rand(p_pixel + floor(time * 8.0));
        p += (n - 0.5) * force * 0.08;
    }
    
    // Smooth progress curve
    float pState = smoothstep(0.0, 1.0, progress);
    
    // Intense glitch occurs mainly in the middle of the transition
    float intensity = sin(pState * 3.14159) * uGlitchIntensity;
    
    vec2 disp = vec2(0.0);
    float blockNoise = 0.0;
    
    // Styles: 0 = Classic Datamosh, 1 = Horizontal Tear, 2 = VHS Melt, 3 = Pixelate Melt
    if (uStyle == 0) {
        // Scanline & blocky datamosh displacement
        float blocks = mix(200.0, 20.0, intensity);
        vec2 p_pixel = floor(p * blocks) / blocks;
        blockNoise = rand(p_pixel + time * 0.05);
        
        disp = vec2(
            (blockNoise * 2.0 - 1.0) * intensity * 0.15,
            (rand(p_pixel.yx - time * 0.1) * 2.0 - 1.0) * intensity * 0.05
        );
    } 
    else if (uStyle == 1) {
        // Horizontal tearing effect
        float n = noise(vec2(p.y * 60.0, time * 15.0));
        if (n > 0.6) {
            disp.x = (rand(vec2(floor(p.y * 40.0), time)) * 2.0 - 1.0) * intensity * 0.25;
        }
        blockNoise = rand(p + time);
    } 
    else if (uStyle == 2) {
        // VHS Tracking Line vertical roll
        float roll = fract(time * 0.15) * intensity * 0.5;
        p.y = fract(p.y + roll);
        
        float band = step(0.88, sin(p.y * 4.0 - time * 3.0));
        disp.x = band * intensity * 0.08 * sin(p.y * 120.0);
        blockNoise = rand(vec2(p.x, floor(p.y * 12.0) + time));
    } 
    else if (uStyle == 3) {
        // Pixelate Melt datamosh
        float blocks = mix(150.0, 10.0, intensity);
        vec2 p_pixel = floor(p * blocks) / blocks;
        disp.y = intensity * 0.18 * rand(vec2(p_pixel.x, 0.0));
        blockNoise = rand(p_pixel + time * 0.1);
    }
    
    // Chromatic Aberration & Phone Tilt dynamic drift
    float tiltAberrationX = uDeviceTilt.x * 0.024 * uAberrationStrength;
    float tiltAberrationY = uDeviceTilt.y * 0.024 * uAberrationStrength;

    float rOffset = intensity * 0.03 * uAberrationStrength * (blockNoise + 0.2) + tiltAberrationX;
    float bOffset = -intensity * 0.02 * uAberrationStrength * (blockNoise + 0.2) - tiltAberrationX;

    vec2 uvRed = fract(p + disp + vec2(rOffset, tiltAberrationY));
    vec2 uvGreen = fract(p + disp);
    vec2 uvBlue = fract(p + disp + vec2(bOffset, -tiltAberrationY));
    
    // Sample from tex1 (outgoing) and tex2 (incoming)
    vec3 c1 = vec3(
        texture2D(tex1, uvRed).r,
        texture2D(tex1, uvGreen).g,
        texture2D(tex1, uvBlue).b
    );
    
    vec3 c2 = vec3(
        texture2D(tex2, uvRed).r,
        texture2D(tex2, uvGreen).g,
        texture2D(tex2, uvBlue).b
    );
    
    // Crossfade threshold
    float threshold = pState;
    if (uStyle == 0) {
        threshold = pState + intensity * (blockNoise - 0.5);
    } else {
        threshold = pState + intensity * 0.2 * (blockNoise - 0.5);
    }
    
    // Combine
    vec3 finalColor = mix(c1, c2, smoothstep(0.4, 0.6, threshold));
    
    // Add film grain
    float grain = (rand(p + time) - 0.5) * 0.08 * uGlitchIntensity;
    finalColor += grain;
    
    // Scanlines
    float scanline = sin(p.y * uScanlineDensity) * 0.04;
    finalColor -= scanline;
    
    gl_FragColor = vec4(finalColor, 1.0);
}
`;

// Helper for smoothstep interpolation
const smoothstep = (min: number, max: number, value: number) => {
  const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return x * x * (3 - 2 * x);
};

// Floating Three.js 3D Pop-up Glitch Text Component
const GlitchText = ({ text, progress, active }: { text: string; progress: number; active: boolean }) => {
  const textRef = useRef<any>(null);

  const scaleVal = Math.sin(progress * Math.PI);
  const opacity = smoothstep(0.1, 0.4, scaleVal);

  useFrame((state) => {
    if (textRef.current) {
      textRef.current.scale.set(scaleVal * 1.15, scaleVal * 1.15, 1);
      
      if (progress > 0.15 && progress < 0.85) {
        textRef.current.position.x = (Math.random() - 0.5) * 0.12;
        textRef.current.position.y = (Math.random() - 0.5) * 0.08;
        textRef.current.visible = Math.random() > 0.15;
      } else {
        textRef.current.position.set(0, 0, 0.5);
        textRef.current.visible = active;
      }
    }
  });

  if (!active) return null;

  const cleanText = text
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/official music video/gi, "")
    .replace(/official video/gi, "")
    .replace(/official mv/gi, "")
    .replace(/mv/gi, "")
    .trim();

  return (
    <Text
      ref={textRef}
      position={[0, 0, 0.5]}
      color="white"
      fontSize={0.25}
      maxWidth={3.8}
      textAlign="center"
      anchorX="center"
      anchorY="middle"
      fillOpacity={opacity}
      strokeWidth={0.004}
      strokeColor="#10b981"
      font="https://fonts.gstatic.com/s/jetbrainsmono/v18/tU3oV065u-z5YR7Y6t5k123b.woff2"
    >
      {cleanText.toUpperCase()}
    </Text>
  );
};

const textureCache = new Map<string, Texture>();

const ImageTransitionMaterial = ({ 
  texture1, 
  texture2, 
  progressValue,
  transitionStyle,
  glitchIntensity,
  aberrationStrength,
  scanlineDensity,
  mouseRef,
  mouseStrength,
  deviceTiltRef
}: { 
  texture1: Texture | null; 
  texture2: Texture | null; 
  progressValue: React.MutableRefObject<number>;
  transitionStyle: number;
  glitchIntensity: number;
  aberrationStrength: number;
  scanlineDensity: number;
  mouseRef: React.MutableRefObject<Vector2>;
  mouseStrength: number;
  deviceTiltRef: React.MutableRefObject<{ x: number, y: number }>;
}) => {
  const materialRef = useRef<ShaderMaterial>(null);
  
  const uniforms = useMemo(() => ({
    time: { value: 0 },
    progress: { value: 0 },
    tex1: { value: null },
    tex2: { value: null },
    uMouse: { value: new Vector2(0.5, 0.5) },
    uMouseStrength: { value: mouseStrength },
    uDeviceTilt: { value: new Vector2(0, 0) },
    uStyle: { value: transitionStyle },
    uGlitchIntensity: { value: glitchIntensity },
    uAberrationStrength: { value: aberrationStrength },
    uScanlineDensity: { value: scanlineDensity }
  }), []);

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uStyle.value = transitionStyle;
      materialRef.current.uniforms.uGlitchIntensity.value = glitchIntensity;
      materialRef.current.uniforms.uAberrationStrength.value = aberrationStrength;
      materialRef.current.uniforms.uScanlineDensity.value = scanlineDensity;
      materialRef.current.uniforms.uMouseStrength.value = mouseStrength;
    }
  }, [transitionStyle, glitchIntensity, aberrationStrength, scanlineDensity, mouseStrength]);

  const smoothedMouse = useRef(new Vector2(0.5, 0.5));
  const smoothedTilt = useRef(new Vector2(0, 0));

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.elapsedTime;
      materialRef.current.uniforms.progress.value = progressValue.current;
      
      // Smoothly interpolate mouse positions
      smoothedMouse.current.lerp(mouseRef.current, 0.1);
      materialRef.current.uniforms.uMouse.value.copy(smoothedMouse.current);
      
      // Smoothly interpolate phone gyroscopic tilts
      smoothedTilt.current.lerp(new Vector2(deviceTiltRef.current.x, deviceTiltRef.current.y), 0.1);
      materialRef.current.uniforms.uDeviceTilt.value.copy(smoothedTilt.current);
      
      if (texture1) materialRef.current.uniforms.tex1.value = texture1;
      if (texture2) materialRef.current.uniforms.tex2.value = texture2;
    }
  });

  return (
    <shaderMaterial
      ref={materialRef}
      vertexShader={vertexShader}
      fragmentShader={fragmentShader}
      uniforms={uniforms}
    />
  );
};

const PlaneViewport = ({ 
  imageUrl, 
  nextImageUrl,
  onTransitionEnd,
  transitionStyle,
  glitchIntensity,
  aberrationStrength,
  scanlineDensity,
  transitionDuration,
  mouseRef,
  mouseStrength,
  title,
  gyroEnabled
}: { 
  imageUrl: string; 
  nextImageUrl?: string;
  onTransitionEnd: () => void;
  transitionStyle: number;
  glitchIntensity: number;
  aberrationStrength: number;
  scanlineDensity: number;
  transitionDuration: number;
  mouseRef: React.MutableRefObject<Vector2>;
  mouseStrength: number;
  title: string;
  gyroEnabled: boolean;
}) => {
  const { viewport } = useThree();
  const [texture1, setTexture1] = useState<Texture | null>(null);
  const [texture2, setTexture2] = useState<Texture | null>(null);
  const progressValue = useRef(0);
  const [prevImageUrl, setPrevImageUrl] = useState(imageUrl);

  const textProgress = useRef(0);
  const [textActive, setTextActive] = useState(false);

  // Device orientation tilt vectors
  const deviceTiltRef = useRef({ x: 0, y: 0 });
  const smoothedTilt = useRef({ x: 0, y: 0 });

  // Handle device orientation events locally
  useEffect(() => {
    if (!gyroEnabled) {
      deviceTiltRef.current = { x: 0, y: 0 };
      return;
    }

    const handleOrientation = (e: DeviceOrientationEvent) => {
      // Beta (front-back tilt: clamp -30 to 30) -> normalize to -1 to 1
      // Gamma (left-right tilt: clamp -30 to 30) -> normalize to -1 to 1
      const beta = e.beta !== null ? Math.max(-30, Math.min(30, e.beta)) / 30 : 0;
      const gamma = e.gamma !== null ? Math.max(-30, Math.min(30, e.gamma)) / 30 : 0;
      deviceTiltRef.current = { x: gamma, y: beta };
    };

    window.addEventListener("deviceorientation", handleOrientation);
    return () => window.removeEventListener("deviceorientation", handleOrientation);
  }, [gyroEnabled]);

  // Helper to load texture
  const loadTexture = (url: string, callback: (tex: Texture) => void) => {
    if (textureCache.has(url)) {
      callback(textureCache.get(url)!);
      return;
    }
    const loader = new TextureLoader();
    loader.load(
      `/api/image-proxy?url=${encodeURIComponent(url)}`,
      (tex) => {
        if (textureCache.size > 20) {
          textureCache.clear();
        }
        textureCache.set(url, tex);
        callback(tex);
      },
      undefined,
      (err) => {
        console.error("Error loading texture:", err);
      }
    );
  };

  // Initial load
  useEffect(() => {
    loadTexture(imageUrl, (tex) => {
      setTexture1(tex);
      setTexture2(tex);
    });
  }, []);

  // Preload next image texture
  useEffect(() => {
    if (nextImageUrl) {
      if (!textureCache.has(nextImageUrl)) {
        const loader = new TextureLoader();
        loader.load(
          `/api/image-proxy?url=${encodeURIComponent(nextImageUrl)}`,
          (tex) => {
            if (textureCache.size > 20) {
              textureCache.clear();
            }
            textureCache.set(nextImageUrl, tex);
          }
        );
      }
    }
  }, [nextImageUrl]);

  // Transition trigger logic
  useEffect(() => {
    if (imageUrl !== prevImageUrl) {
        progressValue.current = 0;
        setTextActive(true);
        
        loadTexture(imageUrl, (tex) => {
            setTexture2(tex);
            
            let start = performance.now();
            const duration = transitionDuration; 
            
            const animateProgress = (now: number) => {
                const dt = now - start;
                const val = Math.min(dt / duration, 1);
                progressValue.current = val;
                textProgress.current = val;
                
                if (val < 1) {
                    requestAnimationFrame(animateProgress);
                } else {
                    setTexture1(tex);
                    setPrevImageUrl(imageUrl);
                    progressValue.current = 0;
                    textProgress.current = 0;
                    setTextActive(false);
                    onTransitionEnd();
                }
            };
            requestAnimationFrame(animateProgress);
        });
    }
  }, [imageUrl, prevImageUrl, onTransitionEnd, transitionDuration]);

  const meshRef = useRef<Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
        const scaleVal = 1.05 + Math.sin(state.clock.elapsedTime * 0.15) * 0.04;
        
        // Smoothly lerp tilts for rendering
        smoothedTilt.current.x = smoothedTilt.current.x * 0.9 + deviceTiltRef.current.x * 0.1;
        smoothedTilt.current.y = smoothedTilt.current.y * 0.9 + deviceTiltRef.current.y * 0.1;

        // Apply 3D perspective rotation tilt
        meshRef.current.rotation.y = smoothedTilt.current.x * 0.15;
        meshRef.current.rotation.x = -smoothedTilt.current.y * 0.15;
        
        // Apply camera follow translation shift
        meshRef.current.position.x = smoothedTilt.current.x * 0.22;
        meshRef.current.position.y = -smoothedTilt.current.y * 0.22;

        meshRef.current.scale.set(viewport.width * scaleVal, viewport.height * scaleVal, 1);
    }
  });

  return (
    <group>
      <mesh 
        ref={meshRef} 
        scale={[viewport.width, viewport.height, 1]}
        onPointerMove={(e) => {
          if (e.uv) {
            mouseRef.current.copy(e.uv);
          }
        }}
        onPointerLeave={() => {
          mouseRef.current.set(0.5, 0.5);
        }}
      >
        <planeGeometry args={[1, 1]} />
        <ImageTransitionMaterial 
          texture1={texture1} 
          texture2={texture2} 
          progressValue={progressValue} 
          transitionStyle={transitionStyle}
          glitchIntensity={glitchIntensity}
          aberrationStrength={aberrationStrength}
          scanlineDensity={scanlineDensity}
          mouseRef={mouseRef}
          mouseStrength={mouseStrength}
          deviceTiltRef={deviceTiltRef}
        />
      </mesh>
      
      <GlitchText text={title} progress={textProgress.current} active={textActive} />
    </group>
  );
};

export default function DatamoshTransition({ 
  imageUrl, 
  nextImageUrl,
  isTransitioning, 
  setIsTransitioning,
  transitionStyle,
  glitchIntensity,
  aberrationStrength,
  scanlineDensity,
  transitionDuration,
  mouseStrength,
  title,
  gyroEnabled
}: { 
  imageUrl: string; 
  nextImageUrl?: string;
  isTransitioning: boolean; 
  setIsTransitioning: (v: boolean) => void;
  transitionStyle: number;
  glitchIntensity: number;
  aberrationStrength: number;
  scanlineDensity: number;
  transitionDuration: number;
  mouseStrength: number;
  title: string;
  gyroEnabled: boolean;
}) {
  
  const mouseRef = useRef(new Vector2(0.5, 0.5));

  return (
    <div className="absolute inset-0 z-0 h-full w-full bg-black">
      <Canvas orthographic camera={{ position: [0, 0, 1] }}>
        <PlaneViewport 
          imageUrl={imageUrl} 
          nextImageUrl={nextImageUrl}
          onTransitionEnd={() => setIsTransitioning(false)} 
          transitionStyle={transitionStyle}
          glitchIntensity={glitchIntensity}
          aberrationStrength={aberrationStrength}
          scanlineDensity={scanlineDensity}
          transitionDuration={transitionDuration}
          mouseRef={mouseRef}
          mouseStrength={mouseStrength}
          title={title}
          gyroEnabled={gyroEnabled}
        />
      </Canvas>
    </div>
  );
}
