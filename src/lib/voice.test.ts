import { afterEach, expect, it, vi } from 'vitest'
import { startVoiceRecording } from './voice'
import { sessionScope } from './sessionScope'

afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();sessionScope.set(null)})
function fixture(failSetup=false) {
  sessionScope.set('A')
  const stop=vi.fn(),close=vi.fn(async()=>{}),connect=vi.fn(),disconnect=vi.fn()
  const processor={connect,disconnect,onaudioprocess:null as null | ((e: {inputBuffer:{getChannelData:()=>Float32Array}})=>void)}
  class Context {
    state='running';sampleRate=16000;destination={};close=close
    constructor() { if(failSetup) throw new Error('Audio unavailable') }
    createMediaStreamSource() { return {connect,disconnect} }
    createScriptProcessor() { return processor }
    createGain() { return {gain:{value:1},connect,disconnect} }
  }
  const stream={getTracks:()=>[{stop}]}
  const getUserMedia=vi.fn(async()=>stream)
  vi.stubGlobal('navigator',{mediaDevices:{getUserMedia}})
  vi.stubGlobal('window',{AudioContext:Context,setTimeout})
  return {stop,close,processor,getUserMedia,stream}
}
it('closes the microphone when audio initialization fails',async()=>{
  const {stop}=fixture(true)
  await expect(startVoiceRecording()).rejects.toThrow('Audio unavailable')
  expect(stop).toHaveBeenCalledOnce()
})
it('discards microphone permission granted after the originating account changed',async()=>{
  const {getUserMedia,stream,stop}=fixture()
  getUserMedia.mockImplementation(async()=>{sessionScope.set('B');return stream})
  await expect(startVoiceRecording()).rejects.toThrow('Account cambiato')
  expect(stop).toHaveBeenCalledOnce()
})
it('discards permission granted after the owning view was closed',async()=>{
  const {getUserMedia,stream,stop}=fixture(), controller=new AbortController()
  getUserMedia.mockImplementation(async()=>{controller.abort();return stream})
  await expect(startVoiceRecording(controller.signal)).rejects.toThrow('Registrazione annullata')
  expect(stop).toHaveBeenCalledOnce()
})
it('never returns audio for transcription after an account change during the final tail',async()=>{
  vi.useFakeTimers();const {stop}=fixture()
  const rec=await startVoiceRecording(), audio=rec.stop()
  const rejected=expect(audio).rejects.toThrow('Account cambiato')
  sessionScope.set('B');await Promise.all([vi.runAllTimersAsync(),rejected])
  expect(stop).toHaveBeenCalledOnce()
})
it('aborting an active recorder releases resources and prevents later transcription',async()=>{
  vi.useFakeTimers();const {stop,close}=fixture(),controller=new AbortController()
  const rec=await startVoiceRecording(controller.signal)
  controller.abort()
  expect(stop).toHaveBeenCalledOnce();expect(close).toHaveBeenCalledOnce()
  const rejected=expect(rec.stop()).rejects.toThrow('Registrazione annullata')
  await Promise.all([vi.runAllTimersAsync(),rejected])
})
it('still returns a mono WAV after normal recording and releases the microphone',async()=>{
  vi.useFakeTimers();const {processor,stop}=fixture()
  const rec=await startVoiceRecording()
  processor.onaudioprocess!({inputBuffer:{getChannelData:()=>new Float32Array(1600).fill(.5)}})
  const audio=rec.stop();await vi.runAllTimersAsync()
  const result=await audio
  expect(result.durationMs).toBe(100);expect(result.mime).toBe('audio/wav')
  expect(atob(result.base64).slice(0,4)).toBe('RIFF');expect(stop).toHaveBeenCalledOnce()
})
