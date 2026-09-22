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

function promptFor(items, additionalInstructions) {
  const list = items.map((item, index) => `${index + 2}. ${item.item_category}: ${item.item_name.slice(0, 80)}`).join('\n');
  const userRequest = additionalInstructions
    ? `\n\nADDITIONAL USER STYLING REQUEST:\n${additionalInstructions}\nApply this request only where it is compatible with the identity lock, body lock and edit boundary above. It may guide garment fit, styling, layering or accessory placement, but it must never alter the person's identity, face, skin, body, pose or other protected details.`
    : '';
  return `Perform a precise photorealistic virtual try-on edit.

IMAGE 1 IS THE IMMUTABLE PERSON AND SCENE REFERENCE. The result must unmistakably be the exact same photograph of the exact same person, with only the selected clothing and accessories changed. Do not reinterpret, regenerate, beautify, retouch, reshape, age, de-age, or stylize the person.

IDENTITY LOCK — preserve exactly from Image 1:
- facial geometry and every facial feature, including eyes, eyebrows, nose, lips, teeth, ears, jawline and face shape
- expression, gaze, head angle, hairstyle, hairline, facial hair and makeup
- skin tone, skin texture, marks, freckles and other identifying details

BODY LOCK — preserve exactly from Image 1:
- height, build, weight, body proportions, shoulders, waist, hips and limb shape
- pose, posture, hands, fingers, feet and all visible body parts
- camera position, crop, perspective, lighting, shadows and background

Images 2 onward are garment references only. Ignore and never copy any person, face, skin, body, pose, mannequin, hanger, room or background visible in those references. Extract only the named garment or accessory from each reference:
${list}

EDIT BOUNDARY: change only the pixels necessary to dress the person in the selected pieces and create physically plausible garment folds, fit, occlusion and contact shadows. Adapt each garment to the person's existing body and pose; never adapt the person's face or body to the garment. Preserve the exact colors, patterns, cut, material and recognizable details of every selected piece. Keep all unselected clothing and accessories unchanged.

Do not add garments, accessories, jewelry, tattoos, makeup, hair, body parts or people. Do not alter exposed skin. Do not create text, labels, prices, a collage or a product catalog.${userRequest}\n\nOutput one vertical full-length photo. Before output, verify that the face, identity, skin and body match Image 1 and that only the requested wardrobe pieces changed.`;
}

async function runGeneration(admin, look, items, key, additionalInstructions) {
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
          text: promptFor(items, additionalInstructions),
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
  const { lookId, instructions } = await request.json().catch(() => ({}));
  const additionalInstructions = typeof instructions === 'string'
    ? instructions.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, 800)
    : '';
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
  EdgeRuntime.waitUntil(runGeneration(admin, look, items, key, additionalInstructions));
  return reply(202, { status: 'running' });
});
