import { authenticatedUser, corsHeaders, instagramCallbackUrl, reply, sha256, validReturnUrl } from '../_shared/instagram.js';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return reply(405, { error: 'POST required.' });
  try {
    const { admin, userId } = await authenticatedUser(request);
    const { returnUrl } = await request.json().catch(() => ({}));
    if (!validReturnUrl(returnUrl)) return reply(400, { error: 'This app return URL is not allowed.' });
    const appId = Deno.env.get('META_APP_ID');
    if (!appId) return reply(503, { error: 'Instagram connection is not configured yet.' });
    const state = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll('-', '');
    const stateHash = await sha256(state);
    await admin.from('instagram_oauth_states').delete().lt('expires_at', new Date().toISOString());
    const { error } = await admin.from('instagram_oauth_states').insert({
      state_hash: stateHash,
      user_id: userId,
      return_url: returnUrl,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    if (error) throw error;
    const authorize = new URL('https://www.instagram.com/oauth/authorize');
    authorize.searchParams.set('client_id', appId);
    authorize.searchParams.set('redirect_uri', instagramCallbackUrl());
    authorize.searchParams.set('response_type', 'code');
    authorize.searchParams.set('scope', 'instagram_business_basic');
    authorize.searchParams.set('state', state);
    return reply(200, { url: authorize.toString() });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('Instagram OAuth start', error);
    return reply(500, { error: error instanceof Error ? error.message : 'Could not start Instagram connection.' });
  }
});
