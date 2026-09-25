import { authenticatedUser, corsHeaders, reply } from '../_shared/instagram.js';

const bucket = 'styleout-images';

async function listUserFiles(admin, userId) {
  const paths = [];
  async function walk(folder) {
    let offset = 0;
    while (true) {
      const { data, error } = await admin.storage.from(bucket).list(folder, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });
      if (error) throw error;
      const entries = data || [];
      for (const entry of entries) {
        const path = `${folder}/${entry.name}`;
        if (entry.id === null) await walk(path);
        else if (path.startsWith(`${userId}/`)) paths.push(path);
      }
      if (entries.length < 100) break;
      offset += entries.length;
    }
  }
  await walk(userId);
  return paths;
}

async function removeRows(admin, table, userId) {
  const { error } = await admin.from(table).delete().eq('user_id', userId);
  if (error) throw new Error(`Could not remove ${table}: ${error.message}`);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return reply(405, { error: 'POST required.' });

  try {
    const clerkSecret = Deno.env.get('CLERK_SECRET_KEY');
    if (!clerkSecret) throw new Error('Account deletion is not configured yet. Set CLERK_SECRET_KEY in Supabase Edge Function secrets.');

    const { admin, userId } = await authenticatedUser(request);
    const clerkHeaders = { Authorization: `Bearer ${clerkSecret}`, Accept: 'application/json' };

    // Validate the server secret and user before removing any user data.
    const clerkUser = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(userId)}`, { headers: clerkHeaders });
    if (!clerkUser.ok) throw new Error(clerkUser.status === 404 ? 'The signed-in Clerk account could not be found.' : 'Could not verify the Clerk account. Check the Supabase CLERK_SECRET_KEY secret.');
    const clerkRecord = await clerkUser.json();
    if (clerkRecord.id !== userId) throw new Error('The signed-in account could not be verified.');

    const { error: keyError } = await admin.rpc('styleout_delete_ai_gateway_key', { p_user_id: userId });
    if (keyError) throw new Error('Could not securely remove the saved AI Gateway key. Account deletion was stopped.');

    const imagePaths = await listUserFiles(admin, userId);

    // Remove children before parents because wardrobe links restrict item deletion.
    for (const table of ['instagram_oauth_states', 'instagram_connections', 'instagram_imports', 'saved_look_items', 'saved_looks', 'wardrobe_items', 'styleout_profiles']) {
      await removeRows(admin, table, userId);
    }

    for (let index = 0; index < imagePaths.length; index += 100) {
      const { error } = await admin.storage.from(bucket).remove(imagePaths.slice(index, index + 100));
      if (error) throw new Error(`Database data was removed, but stored images could not all be deleted: ${error.message}`);
    }

    const deletion = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(userId)}`, { method: 'DELETE', headers: clerkHeaders });
    if (!deletion.ok) {
      const detail = await deletion.json().catch(() => ({}));
      throw new Error(detail?.errors?.[0]?.long_message || detail?.errors?.[0]?.message || 'Styleout data was removed, but Clerk could not delete the login account.');
    }

    return reply(200, { deleted: true });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('Account deletion failed', error);
    return reply(500, { error: error instanceof Error ? error.message : 'Could not delete the account. Please try again.' });
  }
});
