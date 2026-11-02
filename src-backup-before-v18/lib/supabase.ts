import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isBackendConfigured = Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('YOUR_PROJECT_REF'));

// Without a connected project, the public UI and clearly labeled demo remain explorable.
// Requests cannot succeed until real credentials are supplied; never fabricate backend data.
export const supabase = createClient(
  isBackendConfigured ? supabaseUrl : 'https://not-configured.supabase.co',
  isBackendConfigured ? supabaseAnonKey : 'development-placeholder-not-a-real-key',
  { auth: { autoRefreshToken: isBackendConfigured, persistSession: isBackendConfigured } },
);
