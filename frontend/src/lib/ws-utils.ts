import { apiClient } from '@/api/client'
import { getWsBaseUrl } from './chat-utils'

/**
 * Options for creating a ticketed WebSocket connection
 */
export interface TicketedWSOptions {
  path: string
  onMessage?: (event: MessageEvent) => void
  onOpen?: (event: Event) => void
  onClose?: (event: CloseEvent) => void
  onError?: (event: Event) => void
}

/**
 * Creates a WebSocket connection using a fresh authentication ticket.
 * The ticket is requested via API and appended to the WebSocket URL.
 */
export async function createTicketedWS(
  options: TicketedWSOptions
): Promise<WebSocket> {
  const { ticket } = await apiClient.issueWSTicket()
  const baseUrl = getWsBaseUrl()
  const separator = options.path.includes('?') ? '&' : '?'
  const wsUrl = `${baseUrl}${options.path}${separator}ticket=${ticket}`

  const ws = new WebSocket(wsUrl)

  if (options.onOpen) ws.onopen = options.onOpen
  if (options.onMessage) ws.onmessage = options.onMessage
  if (options.onClose) ws.onclose = options.onClose
  if (options.onError) ws.onerror = options.onError

  return ws
}

/**
 * Shared logic for exponential backoff with jitter
 */
export function getNextBackoff(
  attempt: number,
  base = 1000,
  cap = 30000
): number {
  const delay = Math.min(cap, base * 2 ** attempt)
  const jitter = delay * 0.1 * Math.random()
  return delay + jitter
}
