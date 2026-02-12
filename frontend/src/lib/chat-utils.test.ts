import { afterEach, describe, expect, it, vi } from 'vitest'
import { getWsBaseUrl } from '@/lib/chat-utils'

describe('getWsBaseUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('uses ws host from absolute http VITE_API_URL', () => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:8375/api')

    expect(getWsBaseUrl()).toBe('ws://localhost:8375')
  })

  it('uses wss host from absolute https VITE_API_URL', () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.com/api')

    expect(getWsBaseUrl()).toBe('wss://api.example.com')
  })

  it('falls back to same-origin when VITE_API_URL is not absolute', () => {
    vi.stubEnv('VITE_API_URL', '/api')

    const expectedProtocol =
      window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    expect(getWsBaseUrl()).toBe(`${expectedProtocol}//${window.location.host}`)
  })
})
