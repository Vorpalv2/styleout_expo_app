import { createClient } from 'npm:@supabase/supabase-js@2';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};
const reply = (status, payload) => new Response(JSON.stringify(payload), { status, headers });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply(405, { error: 'POST required.' });
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return reply(401, { error: 'Sign in to manage your AI Gateway key.' });
    const url = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anon || !service) return reply(503, { error: 'AI Gateway key storage is not configured.' });

    // Resolve the Clerk subject from the verified Supabase JWT claims, never from request data.
    const caller = createClient(url, anon, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userId, error: authError } = await caller.rpc('styleout_current_user');
    if (authError || !userId) return reply(401, { error: 'Your session could not be verified.' });
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const body = await request.json().catch(() => ({}));
    if (body.action === 'status') {
      const { data, error } = await admin.rpc('styleout_has_ai_gateway_key', { p_user_id: String(userId) });
      if (error) throw new Error('Could not check your saved key.');
      return reply(200, { hasKey: data === true });
    }
    if (body.action === 'save') {
      const key = typeof body.key === 'string' ? body.key.trim() : '';
      if (key.length < 20 || key.length > 512) return reply(400, { error: 'Enter a valid AI Gateway API key.' });
      const { error } = await admin.rpc('styleout_store_ai_gateway_key', { p_user_id: String(userId), p_api_key: key });
      if (error) throw new Error('Could not securely save your key. Please try again.');
      return reply(200, { hasKey: true });
    }
    if (body.action === 'remove') {
      const { error } = await admin.rpc('styleout_delete_ai_gateway_key', { p_user_id: String(userId) });
      if (error) throw new Error('Could not remove your saved key. Please try again.');
      return reply(200, { hasKey: false });
    }
    return reply(400, { error: 'Choose a valid key action.' });
  } catch (error) {
    // Never log or echo request bodies here; they can contain a user's credential.
    console.error('AI Gateway key management failed', error instanceof Error ? error.message : 'Unknown error');
    return reply(500, { error: error instanceof Error ? error.message : 'AI Gateway key management failed.' });
  }
});
