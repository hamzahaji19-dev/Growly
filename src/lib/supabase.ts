import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { generateInviteCode } from './calc'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true },
    })
  : null

export async function uploadToStorage(path: string, file: File): Promise<string> {
  if (!supabase) throw new Error('Storage is not configured.')
  const { error } = await supabase.storage.from('proofs').upload(path, file)
  if (error) throw error
  const { data } = supabase.storage.from('proofs').getPublicUrl(path)
  return data.publicUrl
}

export function newInviteCode(): string {
  return generateInviteCode()
}
