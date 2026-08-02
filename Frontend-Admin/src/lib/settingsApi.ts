
import { httpClient } from '@/lib/http/httpClient'

export const getRegistrationBonus = async (): Promise<number> => {
  const res = await httpClient.get('/api/v1/settings/registration-bonus').then(r => r.data)
  const val = res?.data?.registration_bonus_credits
  if (val === undefined || val === null) {
    throw new Error('Invalid response')
  }
  return Number(val)
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
