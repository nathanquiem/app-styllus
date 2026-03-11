import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_NEXT_PUBLIC || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

async function check() {
  const { data, error } = await supabase.from('business_config').select('*').limit(1)
  console.log('Error:', error)
  console.log('Data:', JSON.stringify(data, null, 2))
}

check()
