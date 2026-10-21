import { AbsoluteFill, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { Bubbles, Caption, Character, Ocean, Reef, SceneFade, TitleText } from './parts'
import { COLOR, FONT } from './theme'

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

const S1 = 180
const S2 = 210
const S3 = 210
const S4 = 300
const S5 = 240
const T2 = S1
const T3 = T2 + S2
const T4 = T3 + S3
const T5 = T4 + S4

export const OPENING_DURATION = T5 + S5

export const Opening = () => {
  const frame = useCurrentFrame()
  // 白化從第 3 段開始，到第 5 段慢慢回暖
  const gray = interpolate(frame, [T3 + 20, T3 + 150, T5 - 30, T5 + 120], [0, 1, 0.85, 0.15], clamp)
  const warm = interpolate(frame, [T5, T5 + 150], [0, 0.6], clamp)
  return (
    <AbsoluteFill style={{ backgroundColor: '#8fcfd8' }}>
      <Ocean gray={gray} warm={warm} />
      <Bubbles />
      <Reef gray={gray} />
      <Sequence durationInFrames={S1}>
        <SceneTitle />
      </Sequence>
      <Sequence from={T2} durationInFrames={S2}>
        <SceneOffice />
      </Sequence>
      <Sequence from={T3} durationInFrames={S3}>
        <SceneBleach />
      </Sequence>
      <Sequence from={T4} durationInFrames={S4}>
        <SceneFactions />
      </Sequence>
      <Sequence from={T5} durationInFrames={S5}>
        <SceneDepart />
      </Sequence>
    </AbsoluteFill>
  )
}

// ① 海底與開場標題
const SceneTitle = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const pop = spring({ frame: frame - 20, fps, config: { damping: 16, stiffness: 70 } })
  const sub = interpolate(frame, [60, 85], [0, 1], clamp)
  return (
    <SceneFade duration={S1}>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', top: -60 }}>
        <div style={{ transform: `scale(${0.8 + 0.2 * pop}) translateY(${Math.sin(frame / 30) * 6}px)`, opacity: pop }}>
          <TitleText text="暖光礁" size={190} />
        </div>
        <div
          style={{
            marginTop: 30,
            opacity: sub,
            fontFamily: FONT,
            fontSize: 48,
            fontWeight: 700,
            color: '#fff',
            letterSpacing: 6,
            textShadow: '0 3px 12px rgba(74,63,92,0.35)',
          }}
        >
          靠陽光與洋流呼吸的珊瑚礁
        </div>
      </AbsoluteFill>
    </SceneFade>
  )
}

// ② 光合事務所的準時下班
const SceneOffice = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  // 時鐘從 17:58 走到 18:00
  const minute = Math.min(60, 58 + Math.floor(interpolate(frame, [20, 110], [0, 2.99], clamp)))
  const hit = minute === 60
  const time = hit ? '18:00' : `17:${String(minute).padStart(2, '0')}`
  const ring = hit ? spring({ frame: frame - 110, fps, config: { damping: 8, stiffness: 160 } }) : 0
  const slide = interpolate(frame, [130, 200], [0, 520], { ...clamp, easing: (t) => t * t * (3 - 2 * t) })
  return (
    <SceneFade duration={S2}>
      <AbsoluteFill>
        <div
          style={{
            position: 'absolute',
            left: 240,
            top: 150,
            width: 1440,
            height: 640,
            borderRadius: 48,
            background: 'rgba(255,248,239,0.78)',
            boxShadow: '0 20px 60px rgba(74,63,92,0.18)',
          }}
        />
        <div style={{ position: 'absolute', left: 300, top: 190, fontFamily: FONT, fontSize: 44, fontWeight: 800, color: COLOR.lavender, letterSpacing: 6 }}>
          光合事務所
        </div>
        <div
          style={{
            position: 'absolute',
            right: 320,
            top: 200,
            width: 260,
            height: 120,
            borderRadius: 28,
            background: hit ? COLOR.mint : '#fff',
            border: `6px solid ${COLOR.lavender}`,
            display: 'grid',
            placeItems: 'center',
            fontFamily: FONT,
            fontSize: 68,
            fontWeight: 800,
            color: COLOR.ink,
            transform: `scale(${1 + ring * 0.12}) rotate(${Math.sin(frame) * ring * 3}deg)`,
          }}
        >
          {time}
        </div>
        <div style={{ position: 'absolute', left: 340, top: 640, width: 1240, height: 34, borderRadius: 17, background: '#e8cfc0' }} />
        <Character id="xiaoye" size={480} delay={6} float={8} style={{ left: 720 + slide, top: 230 }} />
        <Caption text="我是小葉，在光合事務所當行政" from={10} to={110} />
        <Caption text="今天的目標，一樣是準時下班" from={115} to={S2 - 4} />
      </AbsoluteFill>
    </SceneFade>
  )
}

// ③ 珊瑚白化
const SceneBleach = () => {
  const frame = useCurrentFrame()
  const shiver = Math.sin(frame / 3) * interpolate(frame, [90, 120, 160], [0, 3, 0], clamp)
  return (
    <SceneFade duration={S3}>
      <AbsoluteFill>
        <Character
          id="xiaoye"
          size={420}
          delay={4}
          float={5}
          grayscale={interpolate(frame, [30, 150], [0, 0.6], clamp)}
          style={{ left: 750 + shiver, top: 260 }}
        />
        <Caption text="可是，珊瑚一天比一天白" from={8} to={100} />
        <Caption text="連小葉的葉子，也失去了顏色" from={105} to={S3 - 4} />
      </AbsoluteFill>
    </SceneFade>
  )
}

const FACTIONS = [
  { id: 'bobo', name: '波波', role: '潮流郵局局長', faction: '潮', color: COLOR.tide, line: '洋流的事，交給我就好' },
  { id: 'dongdong', name: '凍凍婆婆', role: '深谷的冷水管理員', faction: '霜', color: COLOR.frost, line: '礁石太熱了，得降溫才行' },
  { id: 'jiujiu', name: '啾啾', role: '星光祭主辦人', faction: '光', color: COLOR.light, line: '大家打起精神，一起發光吧' },
] as const

// ④ 三個陣營依序登場
const SceneFactions = () => {
  const per = S4 / FACTIONS.length
  return (
    <SceneFade duration={S4} fade={12}>
      {FACTIONS.map((f, i) => (
        <Sequence key={f.id} from={i * per} durationInFrames={per} layout="none">
          <FactionCard {...f} duration={per} />
        </Sequence>
      ))}
    </SceneFade>
  )
}

const FactionCard = ({
  id,
  name,
  role,
  faction,
  color,
  line,
  duration,
}: (typeof FACTIONS)[number] & { duration: number }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = spring({ frame, fps, config: { damping: 15, stiffness: 80 } })
  const out = interpolate(frame, [duration - 14, duration], [1, 0], clamp)
  return (
    <AbsoluteFill style={{ opacity: Math.min(enter, out) }}>
      <div
        style={{
          position: 'absolute',
          left: 260,
          top: 220,
          width: 560,
          height: 560,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${color} 0%, rgba(255,255,255,0) 70%)`,
          transform: `scale(${0.7 + 0.3 * enter})`,
        }}
      />
      <Character id={id} size={540} float={10} style={{ left: 270, top: 200 }} />
      <div style={{ position: 'absolute', left: 900, top: 330, transform: `translateX(${(1 - enter) * 60}px)` }}>
        <div
          style={{
            display: 'inline-block',
            fontFamily: FONT,
            fontSize: 40,
            fontWeight: 800,
            color: COLOR.ink,
            background: color,
            padding: '8px 28px',
            borderRadius: 999,
            letterSpacing: 4,
          }}
        >
          {faction}陣營・{role}
        </div>
        <div style={{ marginTop: 20 }}>
          <TitleText text={name} size={140} />
        </div>
      </div>
      <Caption text={line} from={12} to={duration - 6} />
    </AbsoluteFill>
  )
}

// ⑤ 小葉出發與遊戲標題
const SceneDepart = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const swim = interpolate(frame, [0, 110], [-200, 360], { ...clamp, easing: (t) => 1 - (1 - t) ** 3 })
  const title = spring({ frame: frame - 100, fps, config: { damping: 14, stiffness: 70 } })
  const tap = interpolate(frame, [150, 170], [0, 1], clamp) * (0.8 + 0.2 * Math.sin(frame / 8))
  const cards = ['leaf-001', 'tide-001', 'frost-001', 'light-001']
  return (
    <SceneFade duration={S5 + 18}>
      <AbsoluteFill>
        {cards.map((c, i) => {
          const pop = spring({ frame: frame - 90 - i * 6, fps, config: { damping: 16 } })
          return (
            <Img
              key={c}
              src={staticFile(`cards/${c}.png`)}
              style={{
                position: 'absolute',
                width: 260,
                height: 260,
                left: 1080 + i * 180,
                top: 500 + Math.sin(frame / 25 + i) * 10 + (i % 2) * 40,
                opacity: pop * 0.9,
                transform: `scale(${0.5 + 0.5 * pop}) rotate(${(i - 1.5) * 8}deg)`,
              }}
            />
          )
        })}
        <Character id="xiaoye" size={420} float={12} style={{ left: swim, top: 520 }} />
        <AbsoluteFill style={{ alignItems: 'center', top: 150 }}>
          <div style={{ opacity: title, transform: `scale(${0.85 + 0.15 * title})` }}>
            <TitleText text="海蛞蝓卡牌對戰" size={150} />
          </div>
          <div
            style={{
              marginTop: 36,
              opacity: tap,
              fontFamily: FONT,
              fontSize: 52,
              fontWeight: 800,
              color: COLOR.ink,
              background: 'rgba(255,248,239,0.88)',
              padding: '14px 56px',
              borderRadius: 999,
              letterSpacing: 8,
            }}
          >
            點擊開始
          </div>
        </AbsoluteFill>
        <Caption text="去聽聽大家的心聲吧，小葉出發" from={6} to={96} />
      </AbsoluteFill>
    </SceneFade>
  )
}
