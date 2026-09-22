import { activeConnection, authenticatedUser, corsHeaders, graphJson, reply } from '../_shared/instagram.js';

const bucket = 'styleout-images';
const allowedTypes = new Map([['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp']]);

function presentMedia(entry) {
  return {
    id: String(entry.id),
    mediaType: entry.media_type,
    imageUrl: entry.media_url || entry.thumbnail_url,
    caption: entry.caption || '',
    permalink: entry.permalink || '',
    timestamp: entry.timestamp || null,
  };
}

function flattenMedia(entries) {
  const result = [];
  for (const entry of entries || []) {
    if (entry.media_type === 'IMAGE' && entry.media_url) result.push(presentMedia(entry));
    if (entry.media_type === 'CAROUSEL_ALBUM') {
      for (const child of entry.children?.data || []) if (child.media_type === 'IMAGE' && child.media_url) result.push(presentMedia({ ...child, caption: entry.caption, permalink: entry.permalink, timestamp: entry.timestamp }));
    }
  }
  return result;
}

async function downloadInstagramImage(media, token) {
  const detail = await graphJson(media, token, { fields: 'id,media_type,media_url,thumbnail_url,timestamp' });
  if (detail.media_type !== 'IMAGE' || !detail.media_url) throw new Error('Only Instagram photos can be imported.');
  const response = await fetch(detail.media_url);
  if (!response.ok) throw new Error('Instagram could not provide one of the selected photos.');
  const type = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
  const extension = allowedTypes.get(type);
  if (!extension) throw new Error('One selected Instagram photo uses an unsupported image format.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > 10 * 1024 * 1024) throw new Error('One selected photo is larger than 10 MB.');
  return { bytes, type, extension };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return reply(405, { error: 'POST required.' });
  try {
    const { admin, userId } = await authenticatedUser(request);
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'status';
    const connection = await activeConnection(admin, userId);
    if (action === 'status') return reply(200, { connected: !!connection, username: connection?.username || null });
    if (!connection) return reply(409, { error: 'Connect Instagram before choosing photos.' });

    if (action === 'disconnect') {
      const { error } = await admin.from('instagram_connections').delete().eq('user_id', userId);
      if (error) throw error;
      return reply(200, { connected: false });
    }

    if (action === 'list') {
      const payload = await graphJson(`${connection.instagram_user_id}/media`, connection.token, {
        fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{id,media_type,media_url,thumbnail_url}',
        limit: 48,
        after: typeof body.cursor === 'string' ? body.cursor : undefined,
      });
      return reply(200, { media: flattenMedia(payload.data), nextCursor: payload.paging?.cursors?.after || null, hasMore: !!payload.paging?.next });
    }

    if (action === 'import') {
      const mediaIds = Array.isArray(body.mediaIds) ? [...new Set(body.mediaIds.filter((id) => typeof id === 'string' && /^\d+$/.test(id)))] : [];
      if (!mediaIds.length || mediaIds.length > 2) return reply(400, { error: 'Choose one or two Instagram photos.' });
      const paths = [];
      const newlyUploaded = [];
      try {
        for (const mediaId of mediaIds) {
          const { data: existing } = await admin.from('instagram_imports').select('storage_path').eq('user_id', userId).eq('instagram_media_id', mediaId).maybeSingle();
          if (existing?.storage_path) {
            const { error: existingError } = await admin.storage.from(bucket).createSignedUrl(existing.storage_path, 30);
            if (!existingError) { paths.push(existing.storage_path); continue; }
            await admin.from('instagram_imports').delete().eq('user_id', userId).eq('instagram_media_id', mediaId);
          }
          const image = await downloadInstagramImage(mediaId, connection.token);
          const path = `${userId}/main/instagram-${mediaId}-${crypto.randomUUID()}.${image.extension}`;
          const { error: uploadError } = await admin.storage.from(bucket).upload(path, image.bytes, { contentType: image.type, upsert: false });
          if (uploadError) throw uploadError;
          newlyUploaded.push(path);
          const { error: recordError } = await admin.from('instagram_imports').insert({ user_id: userId, instagram_media_id: mediaId, storage_path: path });
          if (recordError) throw recordError;
          paths.push(path);
        }
        const { error: profileError } = await admin.from('styleout_profiles').upsert({
          user_id: userId,
          main_image_path: paths[0],
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
        if (profileError) throw profileError;
        return reply(200, { imported: paths.length, paths, activePath: paths[0] });
      } catch (error) {
        if (newlyUploaded.length) {
          await admin.storage.from(bucket).remove(newlyUploaded);
          await admin.from('instagram_imports').delete().eq('user_id', userId).in('storage_path', newlyUploaded);
        }
        throw error;
      }
    }

    return reply(400, { error: 'Unknown Instagram action.' });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('Instagram media', error);
    return reply(500, { error: error instanceof Error ? error.message : 'Instagram could not complete this request.' });
  }
});
