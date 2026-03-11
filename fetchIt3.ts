import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_NEXT_PUBLIC || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

async function check() {
  // Try inserting with a fake column to see the error, or query
  const { data, error } = await supabase.from('business_config').insert({ id: '00000000-0000-0000-0000-000000000000', closed_dates: [] }).select()
  console.log('Error:', error)
  console.log('Data:', JSON.stringify(data, null, 2))
}

check()
