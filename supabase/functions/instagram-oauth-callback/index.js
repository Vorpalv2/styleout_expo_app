import { appendResult, encryptToken, instagramCallbackUrl, sha256 } from '../_shared/instagram.js';
import { createClient } from 'npm:@supabase/supabase-js@2';

const fallback = 'styleout://instagram-connected';
function redirect(url) { return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'no-store' } }); }

Deno.serve(async (request) => {
  const requestUrl = new URL(request.url);
  const state = requestUrl.searchParams.get('state') || '';
  const code = requestUrl.searchParams.get('code') || '';
  const oauthError = requestUrl.searchParams.get('error_description') || requestUrl.searchParams.get('error');
  const url = Deno.env.get('SUPABASE_URL');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !service || !state) return redirect(appendResult(fallback, { instagram: 'error' }));
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const stateHash = await sha256(state);
  const { data: savedState } = await admin.from('instagram_oauth_states').select('*').eq('state_hash', stateHash).maybeSingle();
  if (!savedState) return redirect(appendResult(fallback, { instagram: 'expired' }));
  await admin.from('instagram_oauth_states').delete().eq('state_hash', stateHash);
  const returnUrl = savedState.return_url || fallback;
  if (oauthError || !code || new Date(savedState.expires_at).getTime() < Date.now()) {
    return redirect(appendResult(returnUrl, { instagram: oauthError ? 'cancelled' : 'expired' }));
  }
  try {
    const appId = Deno.env.get('META_APP_ID');
    const appSecret = Deno.env.get('META_APP_SECRET');
    if (!appId || !appSecret) throw new Error('Meta app credentials are missing.');
    const tokenResponse = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: appId, client_secret: appSecret, grant_type: 'authorization_code', redirect_uri: instagramCallbackUrl(), code }),
    });
    const userToken = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !userToken.access_token) throw new Error(userToken?.error_message || 'Instagram did not return an access token.');
    const longLivedUrl = new URL('https://graph.instagram.com/access_token');
    longLivedUrl.search = new URLSearchParams({ grant_type: 'ig_exchange_token', client_secret: appSecret, access_token: userToken.access_token }).toString();
    const longLivedResponse = await fetch(longLivedUrl);
    const longLived = await longLivedResponse.json().catch(() => ({}));
    if (!longLivedResponse.ok || !longLived.access_token) throw new Error(longLived?.error?.message || 'Instagram token could not be extended.');
    const instagramUserId = String(userToken.user_id);
    const profileUrl = new URL(`https://graph.instagram.com/${instagramUserId}`);
    profileUrl.searchParams.set('fields', 'user_id,username');
    profileUrl.searchParams.set('access_token', longLived.access_token);
    const profileResponse = await fetch(profileUrl);
    const profile = await profileResponse.json().catch(() => ({}));
    if (!profileResponse.ok) throw new Error(profile?.error?.message || 'Instagram profile details were unavailable.');
    const { error } = await admin.from('instagram_connections').upsert({
      user_id: savedState.user_id,
      facebook_user_id: null,
      facebook_page_id: null,
      facebook_page_name: null,
      instagram_user_id: instagramUserId,
      username: profile.username || '',
      access_token_ciphertext: await encryptToken(longLived.access_token),
      token_expires_at: longLived.expires_in ? new Date(Date.now() + Number(longLived.expires_in) * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) throw error;
    return redirect(appendResult(returnUrl, { instagram: 'connected' }));
  } catch (error) {
    console.error('Instagram OAuth callback', error);
    return redirect(appendResult(returnUrl, { instagram: 'error' }));
  }
});
