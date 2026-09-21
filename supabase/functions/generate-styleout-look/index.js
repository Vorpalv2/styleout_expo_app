import { createClient } from 'npm:@supabase/supabase-js@2';
import { createGateway, generateImage } from 'npm:ai@6';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' };
const bucket = 'styleout-images';
const model = 'spacexai/grok-imagine-image';
const reply = (status, payload) => new Response(JSON.stringify(payload), { status, headers });
const validId = (value) => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);

function fileType(path) {
  const extension = path.split('.').pop()?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  throw new Error('One of these photos uses an unsupported format. Re-upload it as JPEG, PNG, or WebP.');
}

async function downloadImage(admin, path) {
  const type = fileType(path);
  const { data, error } = await admin.storage.from(bucket).download(path);
  if (error || !data) throw new Error('Could not read one of the saved photos.');
  return { data, type };
}

function promptFor(items) {
  const list = items.map((item, index) => `${index + 2}. ${item.item_category}: ${item.item_name.slice(0, 80)}`).join('\n');
  return `Create one photorealistic full-length fashion try-on image. Image 1 is the source photo of the person. Preserve the same person's identity, face, skin tone, body proportions, pose, camera angle, lighting and background as closely as possible. Images 2 onward are reference photos of clothing and accessories. Replace only the corresponding garments and accessories on the person with these exact pieces, preserving their recognizable colors, patterns, cuts, materials and details. The reference photos are in this order:\n${list}\nDo not add unselected garments or accessories. Keep any visible clothing that has no replacement. Do not create a collage, text, labels, prices, extra people, or a product catalog. Output a single vertical photo of the styled person.`;
}

async function runGeneration(admin, look, items, key) {
  try {
    const paths = [look.image_path, ...items.map((item) => item.item_image_path)];
    const images = await Promise.all(paths.map((path) => downloadImage(admin, path)));
    const bytes = images.reduce((total, image) => total + image.data.size, 0);
    if (bytes > 24 * 1024 * 1024) throw new Error('These photos are too large together. Use smaller wardrobe images and try again.');

    const gateway = createGateway({ apiKey: key });
    let result;
    try {
      result = await generateImage({
        model: gateway.imageModel(model),
        prompt: {
          text: promptFor(items),
          images: await Promise.all(images.map(async ({ data }) => new Uint8Array(await data.arrayBuffer()))),
        },
        aspectRatio: '2:3',
        abortSignal: AbortSignal.timeout(130000),
        maxRetries: 0,
      });
    } catch (error) {
      const status = error?.statusCode ?? error?.status;
      console.error('AI Gateway image request failed', status, error?.message);
      throw new Error(status === 402 || status === 403
        ? 'AI Gateway credits or model access are unavailable. Check your Vercel account.'
        : status === 429
          ? 'The image service is busy. Please retry shortly.'
          : status === 400
            ? 'The image service could not use these photos. Try clearer JPEG or PNG photos.'
            : 'Image generation failed. Please retry.');
    }
    const file = result.images[0];
    if (!file) throw new Error('The image service returned no image. Please retry.');
    const imageType = file.mediaType === 'image/jpeg' ? 'image/jpeg' : file.mediaType === 'image/webp' ? 'image/webp' : file.mediaType === 'image/png' ? 'image/png' : null;
    if (!imageType) throw new Error('The image service returned an unsupported image format.');
    const extension = imageType === 'image/jpeg' ? 'jpg' : imageType.split('/')[1];
    const imageBytes = file.uint8Array;
    const { data: stillExists, error: lookupError } = await admin.from('saved_looks').select('id').eq('id', look.id).eq('user_id', look.user_id).maybeSingle();
    if (lookupError || !stillExists) return;
    const path = `${look.user_id}/generated/${look.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await admin.storage.from(bucket).upload(path, imageBytes, { contentType: imageType, upsert: false });
    if (uploadError) throw new Error('The generated image could not be stored. Please retry.');
    const { data: updated, error: updateError } = await admin.from('saved_looks').update({
      generated_image_path: path, generation_status: 'complete', generation_error: null,
    }).eq('id', look.id).eq('user_id', look.user_id).select('id').maybeSingle();
    if (updateError || !updated) {
      await admin.storage.from(bucket).remove([path]);
      throw new Error('The generated image could not be attached to this look.');
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Image generation failed. Please retry.';
    console.error('Styleout generation', look.id, detail);
    await admin.from('saved_looks').update({ generation_status: 'failed', generation_error: detail.slice(0, 240) })
      .eq('id', look.id).eq('user_id', look.user_id).eq('generation_status', 'running');
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply(405, { error: 'POST required.' });
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return reply(401, { error: 'Sign in to generate a look.' });
  const { lookId } = await request.json().catch(() => ({}));
  if (!validId(lookId)) return reply(400, { error: 'Invalid saved look.' });
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !service) return reply(503, { error: 'Image generation is not configured.' });

  // The caller's verified Clerk token is evaluated by Supabase RLS before a service client is used.
  const caller = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: look, error: lookError } = await caller.from('saved_looks')
    .select('id,user_id,image_path,generated_image_path,generation_status,generation_started_at')
    .eq('id', lookId).maybeSingle();
  if (lookError || !look) return reply(404, { error: 'Saved look not found.' });
  if (look.generated_image_path) return reply(200, { status: 'complete' });
  if (!look.image_path) return reply(400, { error: 'Add a full-length photo to this style first.' });

  const { data: items, error: itemsError } = await caller.from('saved_look_items')
    .select('slot_index,item_name,item_category,item_image_path').eq('look_id', lookId).order('slot_index');
  if (itemsError) return reply(500, { error: 'Could not load this style’s wardrobe pieces.' });
  if (!items?.length || items.length > 2 || items.some((item) => !item.item_image_path)) return reply(400, { error: 'Grok Imagine accepts your photo plus up to two wardrobe pieces. Select one or two pieces for this AI look.' });
  const key = Deno.env.get('AI_GATEWAY_API_KEY');
  if (!key) return reply(503, { error: 'The Vercel AI Gateway key has not been configured for this function.' });

  const stale = look.generation_started_at && Date.now() - new Date(look.generation_started_at).getTime() > 150000;
  if (look.generation_status === 'running' && !stale) return reply(202, { status: 'running' });
  const admin = createClient(url, service, { auth: { persistSession: false } });
  let claim = admin.from('saved_looks').update({ generation_status: 'running', generation_started_at: new Date().toISOString(), generation_error: null })
    .eq('id', lookId).eq('user_id', look.user_id).is('generated_image_path', null);
  claim = stale ? claim.lt('generation_started_at', new Date(Date.now() - 150000).toISOString()) : claim.in('generation_status', ['idle', 'failed']);
  const { data: claimed, error: claimError } = await claim.select('id').maybeSingle();
  if (claimError) return reply(500, { error: 'Could not start image generation.' });
  if (!claimed) return reply(202, { status: 'running' });
  EdgeRuntime.waitUntil(runGeneration(admin, look, items, key));
  return reply(202, { status: 'running' });
});
