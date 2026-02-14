import type { APIRequestContext } from '@playwright/test'

export interface SanctumRequestPayload {
  requested_name: string
  requested_slug: string
  reason: string
}

const API_BASE = (
  process.env.PLAYWRIGHT_API_URL || 'http://localhost:8375/api'
).replace(/\/$/, '')

export function uniqueSlug(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export async function createSanctumRequest(
  request: APIRequestContext,
  token: string,
  payload: SanctumRequestPayload
) {
  const res = await request.post(`${API_BASE}/sanctums/requests`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: payload,
  })

  if (!res.ok()) {
    let body: string
    try {
      body = await res.text()
    } catch (e) {
      body = `<unable to read body: ${String(e)}>`
    }
    throw new Error(
      `createSanctumRequest failed: status=${res.status()} body=${body}`
    )
  }

  return res
}

export async function listAdminRequests(
  request: APIRequestContext,
  token: string,
  status: 'pending' | 'approved' | 'rejected'
) {
  return request.get(`${API_BASE}/admin/sanctum-requests?status=${status}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export async function approveSanctumRequest(
  request: APIRequestContext,
  token: string,
  id: number,
  review_notes?: string
) {
  return request.post(`${API_BASE}/admin/sanctum-requests/${id}/approve`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: { review_notes },
  })
}
