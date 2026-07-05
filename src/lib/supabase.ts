import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL ?? 'https://boucbthrnddmnzcowafy.supabase.co'
const anonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'sb_publishable_dKViNdk1yNGARxVb3KydBg_FPd0GCRb'

export const supabase = createClient(url, anonKey)
