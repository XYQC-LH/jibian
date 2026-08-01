
import { httpClient } from '@/lib/http/httpClient'

export type XianyuInternalApiKeyPayload = {
  configured: boolean
  value: string
  masked_value: string
  source: string
  length: number
}

export const getRegistrationBonus = async (): Promise<number> => {
  const res = await httpClient.get('/api/v1/settings/registration-bonus').then(r => r.data)
  const val = res?.data?.registration_bonus_credits
  if (val === undefined || val === null) {
    throw new Error('Invalid response')
  }
  return Number(val)
}

const ensureXianyuInternalApiKeyPayload = (payload: Record<string, unknown>): XianyuInternalApiKeyPayload => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid response')
  }
  return {
    configured: Boolean(payload.configured),
    value: String(payload.value || ''),
    masked_value: String(payload.masked_value || ''),
    source: String(payload.source || 'unset'),
    length: Number(payload.length || 0),
  }
}

export const getXianyuInternalApiKey = async (): Promise<XianyuInternalApiKeyPayload> => {
  const res = await httpClient.get('/api/v1/settings/xianyu-internal-api-key').then(r => r.data)
  return ensureXianyuInternalApiKeyPayload(res?.data)
}

export const updateXianyuInternalApiKey = async (value: string): Promise<XianyuInternalApiKeyPayload> => {
  const res = await httpClient.put('/api/v1/settings/xianyu-internal-api-key', { value }).then(r => r.data)
  return ensureXianyuInternalApiKeyPayload(res?.data)
}

export const generateXianyuInternalApiKey = async (): Promise<XianyuInternalApiKeyPayload> => {
  const res = await httpClient.post('/api/v1/settings/xianyu-internal-api-key/generate').then(r => r.data)
  return ensureXianyuInternalApiKeyPayload(res?.data)
}

export const updateRegistrationBonus = async (value: number): Promise<number> => {
  const res = await httpClient.put('/api/v1/settings/registration-bonus', {
    registration_bonus_credits: value,
  }).then(r => r.data)
  const val = res?.data?.registration_bonus_credits
  if (val === undefined || val === null) {
    throw new Error('Invalid response')
  }
  return Number(val)
}
