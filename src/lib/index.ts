import type { AppDB } from './db'
import { isSupabaseConfigured, supabaseDB } from './supabase-db'
import { localDB } from './local-db'

export const db: AppDB = isSupabaseConfigured ? supabaseDB : localDB

export { isSupabaseConfigured } from './supabase-db'
