/**
 * Registrazione vocale robusta: cattura il microfono via Web Audio API e produce
 * un WAV 16-bit mono a 16 kHz (formato accettato ovunque da Gemini).
 * Evita i problemi di formato di MediaRecorder su iOS (mp4) e Android (webm).
 */

type AudioCtor = typeof AudioContext

export function voiceSupported(): boolean {
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor }
  const hasGetUserMedia = typeof navigator.mediaDevices?.getUserMedia === 'function'
  return hasGetUserMedia && Boolean(w.AudioContext || w.webkitAudioContext)
}

export interface VoiceRecorder {
  /** Ferma (catturando la coda della frase) e restituisce l'audio WAV in base64. */
  stop: () => Promise<{ base64: string; mime: 'audio/wav'; durationMs: number }>
  /** Annulla senza produrre nulla. */
  cancel: () => void
}

/** Millisecondi di audio raccolti ancora dopo il tap "stop", per non tagliare la fine. */
const TAIL_MS = 350

const OUT_RATE = 16000

function downsample(input: Float32Array, inRate: number): Float32Array {
  if (inRate <= OUT_RATE) return input
  const ratio = inRate / OUT_RATE
  const outLen = Math.floor(input.length / ratio)
  const out = new Float32Array(outLen)
  for (let i = 0; i < outLen; i++) out[i] = input[Math.floor(i * ratio)]
  return out
}

function encodeWav(samples: Float32Array, sampleRate: number): string {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }
  // ArrayBuffer -> base64 a blocchi (evita overflow dello stack)
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export async function startVoiceRecording(): Promise<VoiceRecorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor }
  const Ctx = (w.AudioContext ?? w.webkitAudioContext)!
  const ctx = new Ctx()
  if (ctx.state === 'suspended') await ctx.resume()

  const source = ctx.createMediaStreamSource(stream)
  const processor = ctx.createScriptProcessor(4096, 1, 1)
  const chunks: Float32Array[] = []
  let stopped = false

  processor.onaudioprocess = (e) => {
    if (stopped) return
    chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)))
  }

  // Gain a 0 per non riprodurre l'audio in loopback pur mantenendo attivo il processor
  const silent = ctx.createGain()
  silent.gain.value = 0
  source.connect(processor)
  processor.connect(silent)
  silent.connect(ctx.destination)

  const sampleRate = ctx.sampleRate

  const cleanup = () => {
    stopped = true
    try {
      processor.disconnect()
      source.disconnect()
      silent.disconnect()
    } catch { /* già scollegati */ }
    stream.getTracks().forEach((t) => t.stop())
    void ctx.close()
  }

  const finalize = () => {
    stopped = true
    const total = chunks.reduce((n, c) => n + c.length, 0)
    const merged = new Float32Array(total)
    let pos = 0
    for (const c of chunks) {
      merged.set(c, pos)
      pos += c.length
    }
    const durationMs = Math.round((total / sampleRate) * 1000)
    const down = downsample(merged, sampleRate)
    const base64 = encodeWav(down, OUT_RATE)
    cleanup()
    return { base64, mime: 'audio/wav' as const, durationMs }
  }

  return {
    // Aspetta un attimo prima di chiudere: cattura la fine della frase anche se parli veloce
    stop: () =>
      new Promise((resolve) => {
        window.setTimeout(() => resolve(finalize()), TAIL_MS)
      }),
    cancel: cleanup,
  }
}
