import { createClient } from 'npm:@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

export const reply = (status, payload) => new Response(JSON.stringify(payload), { status, headers: corsHeaders });

export function envClients(authorization) {
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !service) throw new Error('Supabase is not configured.');
  const caller = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  return { url, caller, admin };
}

export async function authenticatedUser(request) {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) throw new Response(JSON.stringify({ error: 'Sign in to connect Instagram.' }), { status: 401, headers: corsHeaders });
  const clients = envClients(authorization);
  const { data, error } = await clients.caller.rpc('styleout_current_user');
  if (error || !data) throw new Response(JSON.stringify({ error: 'Your session could not be verified.' }), { status: 401, headers: corsHeaders });
  return { ...clients, userId: String(data) };
}

const encoder = new TextEncoder();
function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
async function tokenKey() {
  const secret = Deno.env.get('INSTAGRAM_TOKEN_ENCRYPTION_KEY');
  if (!secret || secret.length < 32) throw new Error('Instagram token encryption is not configured.');
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function encryptToken(token) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await tokenKey(), encoder.encode(token)));
  return `${bytesToBase64(iv)}.${bytesToBase64(ciphertext)}`;
}
export async function decryptToken(value) {
  const [ivValue, cipherValue] = String(value).split('.');
  if (!ivValue || !cipherValue) throw new Error('The Instagram connection needs to be renewed.');
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(ivValue) }, await tokenKey(), base64ToBytes(cipherValue));
  return new TextDecoder().decode(plaintext);
}

export async function sha256(value) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function instagramCallbackUrl() {
  const explicit = Deno.env.get('INSTAGRAM_CALLBACK_URL');
  if (explicit) return explicit;
  const url = Deno.env.get('SUPABASE_URL');
  if (!url) throw new Error('Instagram callback URL is not configured.');
  return `${url}/functions/v1/instagram-oauth-callback`;
}

export function validReturnUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'styleout:') return true;
    if (['exp:', 'exps:'].includes(url.protocol)) return true;
    if ((url.hostname === 'localhost' || url.hostname === '127.0.0.1') && ['http:', 'https:'].includes(url.protocol)) return true;
    const webUrl = Deno.env.get('STYLEOUT_WEB_URL');
    return !!webUrl && url.origin === new URL(webUrl).origin;
  } catch {
    return false;
  }
}

export function appendResult(returnUrl, params) {
  const url = new URL(returnUrl);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

export async function graphJson(path, token, query = {}) {
  const url = new URL(`https://graph.instagram.com/${path.replace(/^\//, '')}`);
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || 'Instagram could not complete this request.');
  return payload;
}

export async function activeConnection(admin, userId) {
  const { data, error } = await admin.from('instagram_connections').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, token: await decryptToken(data.access_token_ciphertext) };
}
