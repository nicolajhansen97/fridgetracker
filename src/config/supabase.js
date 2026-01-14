import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zuzfcnrejdtjehfocwos.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1emZjbnJlamR0amVoZm9jd29zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMDU1NTYsImV4cCI6MjA4Mzg4MTU1Nn0.ktaHZZxsjzcSmOtybhhehgNeT0m-OvR6XaNyL3nt0Ks';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
