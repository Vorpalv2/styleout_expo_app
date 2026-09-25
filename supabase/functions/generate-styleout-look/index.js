import { createClient } from 'npm:@supabase/supabase-js@2';
import { createGateway, generateImage } from 'npm:ai@6';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' };
const bucket = 'styleout-images';
const defaultModel = 'spacexai/grok-imagine-image';
const modelReferenceLimits = new Map([
  [defaultModel, 3],
  ['spacexai/grok-imagine-image-2.0', 5],
  ['bfl/flux-kontext-pro', 4],
  ['openai/gpt-image-2.5-flare', 4],
  ['openai/gpt-image-2.5-sunburst', 4],
]);
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

function promptFor(items, additionalInstructions, backgroundBlur) {
  const imageCount = items.length + 1;
  const garmentReferences = items.map((item, index) => {
    const details = [
      item.item_color ? `color: ${item.item_color}` : '',
      item.item_brand ? `brand: ${item.item_brand}` : '',
      item.item_notes ? `description: ${item.item_notes}` : '',
    ].filter(Boolean).join('; ');
    return `Image ${index + 2} — ${item.item_category}: ${item.item_name.slice(0, 80)}${details ? ` (${details})` : ''}. Use only this selected item from this reference.`;
  }).join('\n');
  const topIndex = items.findIndex((item) => item.item_category === 'Tops');
  const outerwearIndex = items.findIndex((item) => item.item_category === 'Outerwear');
  const top = topIndex >= 0 ? items[topIndex] : null;
  const outerwear = outerwearIndex >= 0 ? items[outerwearIndex] : null;
  const layeringRequest = top && outerwear
    ? `\n\nREQUIRED LAYERING: Image ${topIndex + 2} is the only selected shirt/top and must be worn as the base layer. Image ${outerwearIndex + 2} supplies only the named outerwear. Completely ignore any shirt, undershirt, or other clothing visible beneath it in the outerwear product photo. Do not copy that incidental shirt. The visible collar, chest, opening, cuffs, and sleeves of the base layer must come from Image ${topIndex + 2}. Layer the selected outerwear over it; adjust only the outerwear opening if needed to show the selected top.`
    : '';
  const backgroundRequest = backgroundBlur
    ? '\n\nBACKGROUND BLUR: Apply subtle, natural depth-of-field blur only to the existing background behind the person. Keep the person, clothes, accessories, and all visible body parts crisp. Preserve the same background objects, colors, lighting, and layout.'
    : '';
  const userRequest = additionalInstructions
    ? `\n\nADDITIONAL USER STYLING REQUEST:\n${additionalInstructions}\nApply only to garment fit, styling, layering, or accessory placement. It must not override the identity, body, pose, or image-role instructions.`
    : '';
  return `Create a photorealistic virtual try-on by editing the supplied reference images.

IMAGE INPUT MAP — this request contains exactly ${imageCount} images, passed in this order:
Image 1 is the user's original photograph. It is the immutable base canvas and must occupy the whole output.
${garmentReferences}

OUTPUT COMPOSITION: Return one single, continuous, full-length portrait photograph based on Image 1. Never create a collage, grid, split screen, contact sheet, catalog, mood board, inset, border, or pasted rectangle of any input image. Images 2 through ${imageCount} are visual garment references only, never layout or scene references. For every wardrobe reference, extract only the named selected item and transfer it onto the person in Image 1. Ignore the reference's model/person, face, body, pose, mannequin, hanger, styling, background, lighting, crop, and framing.

IDENTITY AND FACE LOCK — preserve the person in Image 1 as the exact same individual. Keep facial geometry and features unchanged, including face shape, eyes, eyebrows, nose, lips, teeth, ears, jaw, expression, gaze, and head angle. Preserve hairstyle, hairline, facial hair, makeup, skin tone, skin texture, freckles, marks, and other identifying details. Do not beautify, retouch, stylize, regenerate, age, de-age, or reinterpret the person.

BODY AND POSE LOCK — preserve Image 1's body and photograph: same height, build, body proportions, shoulders, waist, hips, limbs, pose, posture, hands, fingers, feet, and all visible body parts. Keep the same camera position, lens perspective, crop, composition, lighting, and shadows. Do not make the person stand, sit, turn, move, or change expression. Do not reshape the body to fit a garment; adapt garment fit to the existing person and pose.

EDIT BOUNDARY — modify only the clothing/accessory pixels needed to dress the person in the selected pieces. Preserve all unselected clothing, exposed skin, and all other parts of Image 1. Match each selected garment's recognizable cut, color, pattern, material, and details. Render natural folds, fit, occlusion, and contact shadows. Do not add unselected garments, accessories, jewelry, tattoos, makeup, hair, body parts, people, text, labels, or prices.${layeringRequest}${backgroundRequest}${userRequest}

Before returning the result, check that it is a single edit of Image 1, the same person remains in the same pose and scene, and only the named selected wardrobe items have changed.`;
}

async function runGeneration(admin, look, items, key, additionalInstructions, backgroundBlur, model) {
  try {
    const paths = [look.image_path, ...items.map((item) => item.item_image_path)];
    const images = await Promise.all(paths.map((path) => downloadImage(admin, path)));
    const bytes = images.reduce((total, image) => total + image.data.size, 0);
    if (bytes > 24 * 1024 * 1024) throw new Error('These photos are too large together. Use smaller wardrobe images and try again.');

    const gateway = createGateway({ apiKey: key });
    let result;
    try {
      const openAiImageModel = model.startsWith('openai/');
      result = await generateImage({
        model: gateway.imageModel(model),
        prompt: {
          text: promptFor(items, additionalInstructions, backgroundBlur),
          images: await Promise.all(images.map(async ({ data }) => new Uint8Array(await data.arrayBuffer()))),
        },
        ...(openAiImageModel ? { size: '1024x1536' } : { aspectRatio: '2:3' }),
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
    if (look.generated_image_path && look.generated_image_path !== path) {
      const { error: removeError } = await admin.storage.from(bucket).remove([look.generated_image_path]);
      if (removeError) console.error('Could not remove replaced generated image', look.id, removeError.message);
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
  const { lookId, instructions, backgroundBlur: requestedBackgroundBlur, regenerate: requestedRegenerate, model: requestedModel } = await request.json().catch(() => ({}));
  const model = typeof requestedModel === 'string' ? requestedModel : defaultModel;
  if (!modelReferenceLimits.has(model)) return reply(400, { error: 'Choose a supported image generation model.' });
  const backgroundBlur = requestedBackgroundBlur === true;
  const forceRegenerate = requestedRegenerate === true;
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
  if (look.generated_image_path && !forceRegenerate) return reply(200, { status: 'complete' });
  if (!look.image_path) return reply(400, { error: 'Add a full-length photo to this style first.' });

  const { data: items, error: itemsError } = await caller.from('saved_look_items')
    .select('slot_index,item_id,item_name,item_category,item_image_path').eq('look_id', lookId).order('slot_index');
  if (itemsError) return reply(500, { error: 'Could not load this style’s wardrobe pieces.' });
  const maxWardrobeItems = modelReferenceLimits.get(model) - 1;
  if (!items?.length || items.length > maxWardrobeItems || items.some((item) => !item.item_image_path)) return reply(400, { error: `${model} accepts your photo plus up to ${maxWardrobeItems} wardrobe pieces. Select one to ${maxWardrobeItems} pieces for this AI look.` });
  const { data: itemDetails, error: detailsError } = await caller.from('wardrobe_items')
    .select('id,color,brand,notes').eq('user_id', look.user_id).in('id', items.map((item) => item.item_id));
  if (detailsError) return reply(500, { error: 'Could not load your wardrobe descriptions for this style.' });
  const detailsById = new Map((itemDetails || []).map((item) => [item.id, item]));
  const describedItems = items.map((item) => {
    const details = detailsById.get(item.item_id);
    return { ...item, item_color: details?.color || '', item_brand: details?.brand || '', item_notes: String(details?.notes || '').slice(0, 240).replace(/[\r\n]+/g, ' ') };
  });
  const admin = createClient(url, service, { auth: { persistSession: false } });
  let key;
  if (model === defaultModel) {
    // The built-in server key remains the default model's credential for every user.
    key = Deno.env.get('AI_GATEWAY_API_KEY');
    if (!key) return reply(503, { error: 'The default image model is not configured yet.' });
  } else {
    const { data: personalKey, error: keyError } = await admin.rpc('styleout_get_ai_gateway_key', { p_user_id: look.user_id });
    if (keyError) {
      console.error('Could not retrieve a user AI Gateway key', keyError.message);
      return reply(500, { error: 'Could not check your AI Gateway key. Please try again.' });
    }
    if (!personalKey) return reply(403, { error: 'Add your own AI Gateway key in Profile to use this model.' });
    key = personalKey;
  }

  const stale = look.generation_started_at && Date.now() - new Date(look.generation_started_at).getTime() > 150000;
  if (look.generation_status === 'running' && !stale) return reply(202, { status: 'running' });
  let claim = admin.from('saved_looks').update({ generation_status: 'running', generation_started_at: new Date().toISOString(), generation_error: null, background_blur: backgroundBlur })
    .eq('id', lookId).eq('user_id', look.user_id);
  if (look.generated_image_path && forceRegenerate) claim = claim.eq('generated_image_path', look.generated_image_path);
  else claim = claim.is('generated_image_path', null);
  claim = stale
    ? claim.lt('generation_started_at', new Date(Date.now() - 150000).toISOString())
    : claim.in('generation_status', forceRegenerate ? ['idle', 'failed', 'complete'] : ['idle', 'failed']);
  const { data: claimed, error: claimError } = await claim.select('id').maybeSingle();
  if (claimError) return reply(500, { error: 'Could not start image generation.' });
  if (!claimed) return reply(202, { status: 'running' });
  EdgeRuntime.waitUntil(runGeneration(admin, look, describedItems, key, additionalInstructions, backgroundBlur, model));
  return reply(202, { status: 'running' });
});
