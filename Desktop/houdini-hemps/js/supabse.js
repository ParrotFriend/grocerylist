// ============================================================
// SUPABASE CONFIG — Replace with your actual project values
// ============================================================
const SUPABASE_URL = 'https://jwfwdmwfpjqpsjiwrrpm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3ZndkbXdmcGpxcHNqaXdycnBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwODI1MTMsImV4cCI6MjA5NzY1ODUxM30.iLxHvkZ8kElHCRN5E_kOcvH-kzAewHHOS9dqDgHlYIo';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);