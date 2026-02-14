import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useChatWebSocket } from './useChatWebSocket'

// Mock logger to avoid cluttering test output
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock ws-utils
vi.mock('@/lib/ws-utils', () => ({
  createTicketedWS: vi.fn(),
  getNextBackoff: vi.fn(() => 100),
}))

import { createTicketedWS } from '@/lib/ws-utils'

type GlobalWithMocks = typeof globalThis & {
  localStorage?: {
    getItem(k: string): string | null
    setItem(k: string, v: string): void
    removeItem(k: string): void
    clear(): void
  }
}

describe('useChatWebSocket hook', () => {
  let qc: QueryClient

  beforeEach(() => {
    qc = new QueryClient()
    const _store: Record<string, string> = {}
    ;(globalThis as GlobalWithMocks).localStorage = {
      getItem: (k: string) => _store[k] ?? null,
      setItem: (k: string, v: string) => {
        _store[k] = String(v)
      },
      removeItem: (k: string) => {
        delete _store[k]
      },
      clear: () => {
        for (const k of Object.keys(_store)) delete _store[k]
      },
      length: 0,
      key: () => null,
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
    ;(
      globalThis as GlobalWithMocks as { localStorage?: unknown }
    ).localStorage = undefined
    qc.clear()
  })

  it('initializes with default state', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(
      () => useChatWebSocket({ conversationId: 1, enabled: false }),
      { wrapper }
    )

    expect(result.current.isConnected).toBe(false)
    expect(result.current.isJoined).toBe(false)
  })

  it('attempts connection when enabled', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )

    let onOpenCallback: ((event: Event) => void) | undefined

    vi.mocked(createTicketedWS).mockImplementation(async opts => {
      onOpenCallback = opts.onOpen
      return {
        send: vi.fn(),
        close: vi.fn(),
        readyState: 1,
      } as unknown as WebSocket
    })

    const { result } = renderHook(
      () => useChatWebSocket({ conversationId: 1, enabled: true }),
      { wrapper }
    )

    // Wait for the deferred connection attempt
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(createTicketedWS).toHaveBeenCalled()

    // Simulate open
    await act(async () => {
      if (onOpenCallback) onOpenCallback(new Event('open'))
    })

    expect(result.current.isConnected).toBe(true)
  })

  it('handles incoming messages', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )

    let onMessageCallback: ((event: MessageEvent) => void) | undefined
    const mockWS = {
      send: vi.fn(),
      close: vi.fn(),
      readyState: 1,
    }

    vi.mocked(createTicketedWS).mockImplementation(async opts => {
      onMessageCallback = opts.onMessage
      opts.onOpen?.(new Event('open'))
      return mockWS as unknown as WebSocket
    })

    const onMessage = vi.fn()
    renderHook(
      () => useChatWebSocket({ conversationId: 1, enabled: true, onMessage }),
      { wrapper }
    )

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    // Simulate joined message to set isJoined
    await act(async () => {
      if (onMessageCallback) {
        onMessageCallback(
          new MessageEvent('message', {
            data: JSON.stringify({
              type: 'joined',
              conversation_id: 1,
            }),
          })
        )
      }
    })

    // Simulate incoming message
    const messagePayload = { id: 100, content: 'Hello' }
    await act(async () => {
      if (onMessageCallback) {
        onMessageCallback(
          new MessageEvent('message', {
            data: JSON.stringify({
              type: 'message',
              conversation_id: 1,
              payload: messagePayload,
            }),
          })
        )
      }
    })

    expect(onMessage).toHaveBeenCalledWith(messagePayload)
  })

  it('sends typing indicators', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )

    const mockWS = {
      send: vi.fn(),
      close: vi.fn(),
      readyState: 1,
    }

    let onOpenCallback: ((event: Event) => void) | undefined
    let onMessageCallback: ((event: MessageEvent) => void) | undefined
    vi.mocked(createTicketedWS).mockImplementation(async opts => {
      onOpenCallback = opts.onOpen
      onMessageCallback = opts.onMessage
      return mockWS as unknown as WebSocket
    })

    const { result } = renderHook(
      () => useChatWebSocket({ conversationId: 1, enabled: true }),
      { wrapper }
    )

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    await act(async () => {
      if (onOpenCallback) onOpenCallback(new Event('open'))
    })

    // Must be joined to send typing
    await act(async () => {
      if (onMessageCallback) {
        onMessageCallback(
          new MessageEvent('message', {
            data: JSON.stringify({ type: 'joined', conversation_id: 1 }),
          })
        )
      }
    })

    act(() => {
      result.current.sendTyping(true)
    })

    expect(mockWS.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'typing', conversation_id: 1, is_typing: true })
    )
  })
})
