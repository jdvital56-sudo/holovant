"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { buildFace } from "./faceGeometry";
import { useVitaStore } from "@/stores/vitaStore";
import { voiceLevel } from "@/audio/voiceLevel";

/** Seconds for the figure to assemble, and to scatter again. */
const ASSEMBLE_SECONDS = 2.6;
const DISSOLVE_SECONDS = 1.1;

const vertexShader = /* glsl */ `
  attribute vec3 scattered;
  attribute float role;
  attribute float flow;

  uniform float uAssembly;   // 0 scattered, 1 assembled
  uniform float uTime;
  uniform float uVoice;      // 0..1, measured from the audio playing now
  uniform float uPixelRatio;

  varying float vRole;
  varying float vGlow;

  void main() {
    vRole = role;

    // Each point arrives on its own schedule, spread along the figure, so the
    // form builds from the base upward instead of snapping into place at once.
    float stagger = clamp((uAssembly - flow * 0.35) / 0.65, 0.0, 1.0);
    float eased = stagger * stagger * (3.0 - 2.0 * stagger);
    vec3 pos = mix(scattered, position, eased);

    // A wave travelling down the figure. It never stops entirely, so the
    // face is alive while idle, and the voice drives its amplitude.
    float wave = sin(flow * 12.0 - uTime * 2.4);
    float idle = 0.006;
    float driven = uVoice * (role == 2.0 ? 0.09 : role == 1.0 ? 0.05 : 0.028);
    pos.z += wave * (idle + driven) * eased;
    pos.x += wave * driven * 0.35 * eased;

    // The core breathes outward with volume, which is what reads as speech
    // rather than as decoration.
    if (role == 1.0) {
      pos.xy *= 1.0 + uVoice * 0.16 + sin(uTime * 1.6) * 0.02;
    }

    vGlow = eased * (0.55 + 0.45 * abs(wave)) * (0.6 + uVoice * 0.9);

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float size = role == 0.0 ? 2.4 : 3.2;
    gl_PointSize = size * uPixelRatio * (1.0 + uVoice * 0.5) * (12.0 / -mvPosition.z);
  }
`;

const fragmentShader = /* glsl */ `
  precision mediump float;

  uniform vec3 uOutline;
  uniform vec3 uCore;
  uniform vec3 uCords;

  varying float vRole;
  varying float vGlow;

  void main() {
    // Round, soft-edged points; square ones read as pixels, not light.
    vec2 offset = gl_PointCoord - vec2(0.5);
    float dist = length(offset);
    if (dist > 0.5) discard;
    float falloff = smoothstep(0.5, 0.0, dist);

    vec3 colour = vRole == 1.0 ? uCore : vRole == 2.0 ? uCords : uOutline;
    gl_FragColor = vec4(colour * (0.7 + vGlow), falloff * vGlow);
  }
`;

/**
 * The assistant made visible: a figure that assembles out of drifting points
 * and moves with its own voice.
 *
 * Hidden until asked for. It is the assistant's face, not decoration, and a
 * face watching the user permanently is a different product.
 */
export function VitaFace() {
  const visible = useVitaStore((s) => s.visible);
  const pointsRef = useRef<THREE.Points>(null);
  const assembly = useRef(0);

  const face = useMemo(() => buildFace(), []);

  const uniforms = useMemo(
    () => ({
      uAssembly: { value: 0 },
      uTime: { value: 0 },
      uVoice: { value: 0 },
      uPixelRatio: { value: 1 },
      uOutline: { value: new THREE.Color("#39c8ff") },
      uCore: { value: new THREE.Color("#ffa32e") },
      uCords: { value: new THREE.Color("#ffcc3d") },
    }),
    [],
  );

  // Writing uniform values every frame is how a shader is driven; the
  // alternative, re-rendering React sixty times a second, is the thing this
  // exists to avoid.
  /* eslint-disable react-hooks/immutability */
  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const target = visible ? 1 : 0;
    const rate = dt / (visible ? ASSEMBLE_SECONDS : DISSOLVE_SECONDS);
    assembly.current += Math.sign(target - assembly.current) * rate;
    assembly.current = Math.min(1, Math.max(0, assembly.current));

    uniforms.uAssembly.value = assembly.current;
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uVoice.value = voiceLevel();
    uniforms.uPixelRatio.value = state.gl.getPixelRatio();

    // Fully scattered and invisible: stop drawing it altogether.
    if (pointsRef.current) pointsRef.current.visible = assembly.current > 0.001;
  });
  /* eslint-enable react-hooks/immutability */

  return (
    <points ref={pointsRef} position={[0, 0.1, 0]} visible={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[face.target, 3]} />
        <bufferAttribute attach="attributes-scattered" args={[face.scattered, 3]} />
        <bufferAttribute attach="attributes-role" args={[face.role, 1]} />
        <bufferAttribute attach="attributes-flow" args={[face.flow, 1]} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
