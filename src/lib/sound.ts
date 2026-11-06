// ============================================================
// NEXORA — Efeitos sonoros
//
// Som de GANHO = "moeda" (ding metálico estilo moeda de jogo).
// É sintetizado em código (sem ficheiros .mp3/.wav externos) e
// renderizado UMA vez para amostras — o mesmo som serve:
//   1.º  Web Audio (AudioBuffer)        → caminho normal
//   2.º  <audio> com WAV gerado em código → plano B se a Web Audio falhar
//
// Para NUNCA falhar:
//   • O áudio é desbloqueado no 1.º toque/clique/tecla da página
//     (browsers bloqueiam som antes de haver interação).
//   • Antes de cada som, se o contexto estiver suspenso/interrompido
//     (iOS, separador em segundo plano) faz resume() e só depois toca.
//   • Se a Web Audio não existir ou der erro, usa o plano B.
//
// A preferência (ligado/desligado) fica em localStorage.
// ============================================================

const STORAGE_KEY = 'nexora_sound_enabled'

export function isSoundEnabled(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw === null ? true : raw === 'true' // ligado por defeito
  } catch {
    return true
  }
}

export function setSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled))
  } catch { /* sem localStorage, apenas não persiste */ }
}

// ── Síntese do som de moeda ───────────────────────────────────
const SAMPLE_RATE = 44100
const DURATION_S = 0.9

let coinSamples: Float32Array | null = null

function renderCoin(): Float32Array {
  if (coinSamples) return coinSamples
  const n = Math.floor(SAMPLE_RATE * DURATION_S)
  const out = new Float32Array(n)
  const TWO_PI = Math.PI * 2

  // Notas do "ding" de moeda: B5 curta + E6 que fica a ressoar
  const notes = [
    { start: 0.0,  freq: 987.77,  tau: 0.045, gain: 0.55 },
    { start: 0.075, freq: 1318.51, tau: 0.20,  gain: 0.70 },
  ]
  for (const nt of notes) {
    const s0 = Math.floor(nt.start * SAMPLE_RATE)
    for (let i = s0; i < n; i++) {
      const t = (i - s0) / SAMPLE_RATE
      const env = Math.min(1, t / 0.003) * Math.exp(-t / nt.tau)
      if (env < 0.0005) break
      const f = nt.freq
      // fundamental + harmónicos (brilho metálico)
      const v =
        Math.sin(TWO_PI * f * t) +
        0.45 * Math.sin(TWO_PI * f * 2 * t) +
        0.18 * Math.sin(TWO_PI * f * 3 * t)
      out[i] += v * env * nt.gain
    }
  }

  // Tilintar inarmónico no início da 2.ª nota: é isto que soa a "metal/moeda"
  const ring = [2.76, 5.40, 8.93]
  const r0 = Math.floor(0.075 * SAMPLE_RATE)
  for (let k = 0; k < ring.length; k++) {
    const f = 1318.51 * ring[k] / 2.76
    for (let i = r0; i < n; i++) {
      const t = (i - r0) / SAMPLE_RATE
      const env = Math.min(1, t / 0.002) * Math.exp(-t / (0.09 - k * 0.02))
      if (env < 0.0005) break
      out[i] += Math.sin(TWO_PI * f * t) * env * (0.16 - k * 0.04)
    }
  }

  // Cliques curtos de ataque (impacto da moeda)
  for (const startS of [0, 0.075]) {
    const s0 = Math.floor(startS * SAMPLE_RATE)
    for (let i = 0; i < 90 && s0 + i < n; i++) {
      out[s0 + i] += (Math.random() * 2 - 1) * Math.exp(-i / 18) * 0.22
    }
  }

  // Normaliza para um volume confortável, sem distorcer
  let peak = 0
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]))
  const norm = peak > 0 ? 0.85 / peak : 1
  for (let i = 0; i < n; i++) out[i] *= norm

  coinSamples = out
  return out
}

// ── Web Audio ─────────────────────────────────────────────────
let audioCtx: AudioContext | null = null
let coinBuffer: AudioBuffer | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext || (window as any).webkitAudioContext
  if (!AC) return null
  if (!audioCtx || audioCtx.state === 'closed') {
    try {
      audioCtx = new AC()
      coinBuffer = null // buffer pertence ao contexto antigo
    } catch {
      return null
    }
  }
  return audioCtx
}

function getCoinBuffer(ctx: AudioContext): AudioBuffer {
  if (coinBuffer) return coinBuffer
  const samples = renderCoin()
  const buf = ctx.createBuffer(1, samples.length, SAMPLE_RATE)
  buf.copyToChannel(samples as Float32Array<ArrayBuffer>, 0)
  coinBuffer = buf
  return buf
}

/** Põe o contexto a funcionar (suspenso ou "interrupted" no iOS). */
async function ensureRunning(ctx: AudioContext): Promise<boolean> {
  if (ctx.state === 'running') return true
  try { await ctx.resume() } catch { /* tenta na mesma */ }
  return (ctx.state as string) === 'running'
}

// ── Plano B: <audio> com WAV gerado em código ─────────────────
let wavUrl: string | null = null

function getWavUrl(): string | null {
  if (wavUrl) return wavUrl
  try {
    const samples = renderCoin()
    const dataLen = samples.length * 2
    const buf = new ArrayBuffer(44 + dataLen)
    const v = new DataView(buf)
    const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
    w(0, 'RIFF'); v.setUint32(4, 36 + dataLen, true); w(8, 'WAVE'); w(12, 'fmt ')
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
    v.setUint32(24, SAMPLE_RATE, true); v.setUint32(28, SAMPLE_RATE * 2, true)
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, dataLen, true)
    for (let i = 0; i < samples.length; i++) {
      v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 0x7fff, true)
    }
    wavUrl = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
    return wavUrl
  } catch {
    return null
  }
}

function playWithAudioElement(): void {
  const url = getWavUrl()
  if (!url) return
  try {
    const a = new Audio(url)
    a.volume = 1
    void a.play().catch(() => { /* bloqueado: nada mais a fazer */ })
  } catch { /* ignora */ }
}

// ── Desbloqueio no 1.º gesto do utilizador ────────────────────
let unlocked = false

/** Chamado no 1.º toque/clique/tecla: cria o contexto, toca 1 frame mudo. */
export function unlockSound(): void {
  const ctx = getAudioContext()
  if (!ctx) return
  void ensureRunning(ctx).then((ok) => {
    if (!ok) return
    try {
      // buffer mudo: "acorda" o áudio no iOS/Safari
      const src = ctx.createBufferSource()
      src.buffer = ctx.createBuffer(1, 1, SAMPLE_RATE)
      src.connect(ctx.destination)
      src.start(0)
      getCoinBuffer(ctx) // deixa o som pronto → toca sem atraso
      unlocked = true
    } catch { /* ignora */ }
  })
}

if (typeof window !== 'undefined') {
  const events = ['pointerdown', 'touchstart', 'keydown', 'click'] as const
  const handler = () => {
    unlockSound()
    if (unlocked) events.forEach(e => window.removeEventListener(e, handler, true))
  }
  events.forEach(e => window.addEventListener(e, handler, { capture: true, passive: true }))
  // Voltar ao separador: o contexto pode ter ficado suspenso
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && audioCtx && audioCtx.state !== 'running') {
      audioCtx.resume().catch(() => {})
    }
  })
}

// ── API pública ───────────────────────────────────────────────

/** Som de ganho: moeda. Nunca lança erro; se a Web Audio falhar usa o plano B. */
export function playGainSound(): void {
  if (!isSoundEnabled()) return
  const ctx = getAudioContext()
  if (!ctx) { playWithAudioElement(); return }

  void (async () => {
    try {
      const running = await ensureRunning(ctx)
      if (!running) { playWithAudioElement(); return }
      const src = ctx.createBufferSource()
      const gain = ctx.createGain()
      gain.gain.value = 1
      src.buffer = getCoinBuffer(ctx)
      src.connect(gain)
      gain.connect(ctx.destination)
      src.start(0)
    } catch {
      playWithAudioElement()
    }
  })()
}
