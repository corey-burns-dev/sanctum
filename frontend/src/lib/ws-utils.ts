import { ApiError, apiClient } from '@/api/client'
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
  let ticketResp: { ticket: string; expires_in: number }
  try {
    ticketResp = await apiClient.issueWSTicket()
    if (import.meta.env.DEV) {
      try {
        // eslint-disable-next-line no-console
        console.debug(
          '[ws] ticket issued (not logged) expires_in=',
          ticketResp.expires_in
        )
      } catch {}
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      try {
        if (err instanceof ApiError) {
          // eslint-disable-next-line no-console
          console.error('[ws] ticket issuance failed', {
            status: err.status,
            code: err.code,
            message: err.message,
          })
          try {
            // Suggest a retry delay for developers (non-authoritative)
            // eslint-disable-next-line no-console
            console.debug('[ws] suggested retry in', getNextBackoff(0), 'ms')
          } catch {}
        } else {
          // eslint-disable-next-line no-console
          console.error('[ws] ticket issuance unexpected error', err)
          try {
            // eslint-disable-next-line no-console
            console.debug('[ws] suggested retry in', getNextBackoff(0), 'ms')
          } catch {}
        }
      } catch {}
    }
    throw err
  }

  const baseUrl = getWsBaseUrl()
  const separator = options.path.includes('?') ? '&' : '?'
  const wsUrl = `${baseUrl}${options.path}${separator}ticket=${ticketResp.ticket}`

  const wsUrlNoTicket = `${baseUrl}${options.path}`

  if (import.meta.env.DEV) {
    try {
      // Log the base WS endpoint (do not log the ticket)
      // eslint-disable-next-line no-console
      console.debug('[ws] connecting to', wsUrlNoTicket, '(ticket appended)')
    } catch {}
  }

  let ws: WebSocket
  try {
    ws = new WebSocket(wsUrl)
  } catch (err) {
    if (import.meta.env.DEV) {
      try {
        // eslint-disable-next-line no-console
        console.error(
          '[ws] WebSocket constructor failed for',
          wsUrlNoTicket,
          err
        )
      } catch {}
    }
    throw err
  }

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
