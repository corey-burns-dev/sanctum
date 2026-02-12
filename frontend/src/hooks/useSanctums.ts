import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import type {
  AdminSanctumRequestActionResponse,
  AdminSanctumRequestStatus,
  BulkSanctumMembershipsInput,
  CreateSanctumRequestInput,
  SanctumRequest,
} from '@/api/types'

export const sanctumKeys = {
  all: ['sanctums'] as const,
  list: () => [...sanctumKeys.all, 'list'] as const,
  detail: (slug: string) => [...sanctumKeys.all, 'detail', slug] as const,
  requests: () => [...sanctumKeys.all, 'requests'] as const,
  myRequests: () => [...sanctumKeys.requests(), 'me'] as const,
  memberships: () => [...sanctumKeys.all, 'memberships'] as const,
  myMemberships: () => [...sanctumKeys.memberships(), 'me'] as const,
  adminRequests: (status: AdminSanctumRequestStatus) =>
    [...sanctumKeys.requests(), 'admin', status] as const,
  admins: (slug: string) => [...sanctumKeys.all, 'admins', slug] as const,
}

export function useSanctums() {
  return useQuery({
    queryKey: sanctumKeys.list(),
    queryFn: () => apiClient.getSanctums(),
  })
}

export function useSanctum(slug: string) {
  return useQuery({
    queryKey: sanctumKeys.detail(slug),
    queryFn: () => apiClient.getSanctum(slug),
    enabled: Boolean(slug),
  })
}

export function useCreateSanctumRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateSanctumRequestInput) =>
      apiClient.createSanctumRequest(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sanctumKeys.myRequests() })
    },
  })
}

export function useMySanctumRequests() {
  return useQuery({
    queryKey: sanctumKeys.myRequests(),
    queryFn: () => apiClient.getMySanctumRequests(),
  })
}

export function useMySanctumMemberships(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: sanctumKeys.myMemberships(),
    queryFn: () => apiClient.getMySanctumMemberships(),
    enabled: options?.enabled ?? true,
  })
}

export function useUpsertMySanctumMemberships() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: BulkSanctumMembershipsInput) =>
      apiClient.upsertMySanctumMemberships(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sanctumKeys.myMemberships() })
    },
  })
}

export function useAdminSanctumRequests(status: AdminSanctumRequestStatus) {
  return useQuery({
    queryKey: sanctumKeys.adminRequests(status),
    queryFn: () => apiClient.getAdminSanctumRequests(status),
  })
}

function invalidateAdminRequestCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  request: SanctumRequest
) {
  queryClient.invalidateQueries({ queryKey: sanctumKeys.myRequests() })
  queryClient.invalidateQueries({ queryKey: sanctumKeys.list() })
  queryClient.invalidateQueries({
    queryKey: sanctumKeys.adminRequests('pending'),
  })
  queryClient.invalidateQueries({
    queryKey: sanctumKeys.adminRequests(request.status),
  })
}

export function useApproveSanctumRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      review_notes,
    }: {
      id: number
      review_notes?: string
    }): Promise<AdminSanctumRequestActionResponse> =>
      apiClient.approveSanctumRequest(id, review_notes),
    onSuccess: data => {
      invalidateAdminRequestCaches(queryClient, data.request)
    },
  })
}

export function useRejectSanctumRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, review_notes }: { id: number; review_notes?: string }) =>
      apiClient.rejectSanctumRequest(id, review_notes),
    onSuccess: request => {
      invalidateAdminRequestCaches(queryClient, request)
    },
  })
}

export function useSanctumAdmins(
  slug: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: sanctumKeys.admins(slug),
    queryFn: () => apiClient.getSanctumAdmins(slug),
    enabled: (options?.enabled ?? true) && Boolean(slug),
  })
}

export function usePromoteSanctumAdmin(slug: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: number) => apiClient.promoteSanctumAdmin(slug, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sanctumKeys.admins(slug) })
    },
  })
}

export function useDemoteSanctumAdmin(slug: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: number) => apiClient.demoteSanctumAdmin(slug, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sanctumKeys.admins(slug) })
    },
  })
}
