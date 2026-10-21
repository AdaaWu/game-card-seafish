import type { CSSProperties, ReactNode } from 'react'
import { AbsoluteFill, Img, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { COLOR, FONT } from './theme'

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

// 場景整體淡入淡出
export const SceneFade = ({ duration, children, fade = 18 }: { duration: number; children: ReactNode; fade?: number }) => {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [0, fade, duration - fade, duration], [0, 1, 1, 0], clamp)
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>
}

// 海底漸層，gray 為 0~1 的白化程度
export const Ocean = ({ gray = 0, warm = 0 }: { gray?: number; warm?: number }) => {
  const top = mix(mix('#bfe6ef', '#d6dde3', gray), '#ffe9d6', warm)
  const mid = mix(mix('#8fcfd8', '#aab7c2', gray), '#c9d9ef', warm)
  const bottom = mix(mix('#5f9fbf', '#7d8b9c', gray), '#8f9fd0', warm)
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${top} 0%, ${mid} 55%, ${bottom} 100%)` }}>
      <LightRays gray={gray} />
    </AbsoluteFill>
  )
}

const LightRays = ({ gray }: { gray: number }) => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ opacity: 0.35 * (1 - gray * 0.6) }}>
      {[0, 1, 2, 3, 4].map((i) => {
        const sway = Math.sin(frame / 70 + i) * 4
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: -200,
              left: 180 + i * 360,
              width: 140,
              height: 1500,
              background: 'linear-gradient(180deg, rgba(255,255,255,0.9), rgba(255,255,255,0))',
              transform: `rotate(${12 + sway}deg)`,
              transformOrigin: 'top center',
              filter: 'blur(18px)',
            }}
          />
        )
      })}
    </AbsoluteFill>
  )
}

// 持續上升的氣泡
export const Bubbles = ({ count = 26, seed = 'b' }: { count?: number; seed?: string }) => {
  const frame = useCurrentFrame()
  const { height } = useVideoConfig()
  return (
    <AbsoluteFill>
      {Array.from({ length: count }, (_, i) => {
        const size = 10 + random(`${seed}s${i}`) * 34
        const speed = 0.6 + random(`${seed}v${i}`) * 1.2
        const x = random(`${seed}x${i}`) * 1920
        const start = random(`${seed}y${i}`) * (height + 200)
        const y = height + 100 - ((start + frame * speed * 2) % (height + 200))
        const wobble = Math.sin(frame / 24 + i) * 14
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x + wobble,
              top: y,
              width: size,
              height: size,
              borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.75)',
              background: 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.9) 0 18%, rgba(255,255,255,0.15) 40%)',
            }}
          />
        )
      })}
    </AbsoluteFill>
  )
}

// 底部的珊瑚叢，gray 為白化程度
export const Reef = ({ gray = 0 }: { gray?: number }) => {
  const frame = useCurrentFrame()
  const corals = [
    { x: 60, h: 300, c: '#f4a7b9' },
    { x: 330, h: 220, c: '#f8c89a' },
    { x: 560, h: 340, c: '#e9a3c9' },
    { x: 1260, h: 260, c: '#f6b0a0' },
    { x: 1500, h: 360, c: '#f4a7b9' },
    { x: 1740, h: 240, c: '#f8c89a' },
  ]
  return (
    <AbsoluteFill>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <ellipse cx={960} cy={1130} rx={1200} ry={150} fill={mix('#e8d8c4', '#d9d9d9', gray)} />
        {corals.map((c, i) => {
          const sway = Math.sin(frame / 40 + i) * 3
          const fill = mix(c.c, '#f2f2f0', gray)
          return (
            <g key={i} transform={`translate(${c.x + 90}, 1060) rotate(${sway})`}>
              <Coral h={c.h} fill={fill} />
            </g>
          )
        })}
      </svg>
    </AbsoluteFill>
  )
}

const Coral = ({ h, fill }: { h: number; fill: string }) => {
  const w = 26
  const branch = (x: number, y: number, len: number, rot: number) => (
    <g transform={`translate(${x}, ${y}) rotate(${rot})`}>
      <rect x={-w / 2} y={-len} width={w} height={len} rx={w / 2} fill={fill} />
      <circle cx={0} cy={-len} r={w * 0.75} fill={fill} />
    </g>
  )
  return (
    <g stroke="rgba(120,90,110,0.25)" strokeWidth={3}>
      {branch(0, 0, h, 0)}
      {branch(0, -h * 0.35, h * 0.55, -38)}
      {branch(0, -h * 0.5, h * 0.5, 34)}
      {branch(-h * 0.2, -h * 0.65, h * 0.3, -60)}
      {branch(h * 0.18, -h * 0.72, h * 0.28, 55)}
    </g>
  )
}

// 角色頭像，帶漂浮與彈出
export const Character = ({
  id,
  size,
  delay = 0,
  style,
  float = 14,
  grayscale = 0,
}: {
  id: string
  size: number
  delay?: number
  style?: CSSProperties
  float?: number
  grayscale?: number
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const pop = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 90, mass: 0.9 } })
  const bob = Math.sin((frame - delay) / 22) * float
  return (
    <Img
      src={staticFile(`portraits/${id}.png`)}
      style={{
        position: 'absolute',
        width: size,
        height: size,
        transform: `translateY(${bob}px) scale(${0.6 + 0.4 * pop})`,
        opacity: pop,
        filter: `drop-shadow(0 18px 24px rgba(70,60,100,0.25)) grayscale(${grayscale})`,
        ...style,
      }}
    />
  )
}

// 字幕：淡入淡出並輕微上浮
export const Caption = ({ text, from, to, bottom = 110 }: { text: string; from: number; to: number; bottom?: number }) => {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [from, from + 12, to - 12, to], [0, 1, 1, 0], clamp)
  const y = interpolate(frame, [from, from + 18], [16, 0], clamp)
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom,
        display: 'flex',
        justifyContent: 'center',
        opacity,
        transform: `translateY(${y}px)`,
      }}
    >
      <div
        style={{
          fontFamily: FONT,
          fontSize: 54,
          fontWeight: 700,
          letterSpacing: 4,
          color: COLOR.ink,
          background: 'rgba(255,248,239,0.82)',
          padding: '16px 44px',
          borderRadius: 999,
          boxShadow: '0 8px 24px rgba(74,63,92,0.15)',
          maxWidth: 1500,
          textAlign: 'center',
        }}
      >
        {text}
      </div>
    </div>
  )
}

// 大標題字，白字配紫色描邊
export const TitleText = ({ text, size, color = COLOR.lavender }: { text: string; size: number; color?: string }) => (
  <div
    style={{
      fontFamily: FONT,
      fontSize: size,
      fontWeight: 900,
      color: '#fff',
      WebkitTextStroke: `${Math.round(size / 9)}px ${color}`,
      paintOrder: 'stroke fill',
      letterSpacing: size / 14,
      textAlign: 'center',
      whiteSpace: 'nowrap',
    }}
  >
    {text}
  </div>
)

// 兩個十六進位色線性混色
export function mix(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const ca = p(a)
  const cb = p(b)
  const k = Math.min(1, Math.max(0, t))
  return `#${ca.map((v, i) => Math.round(v + (cb[i]! - v) * k).toString(16).padStart(2, '0')).join('')}`
}
