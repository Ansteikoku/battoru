// supabaseClient.js
export const SUPABASE_URL = "https://YOUR-PROJECT.supabase.co"; // ←置き換える
export const SUPABASE_ANON_KEY = "YOUR_ANON_KEY"; // ←置き換える

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
