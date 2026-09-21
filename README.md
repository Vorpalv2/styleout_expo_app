# Styleout

An Expo 57 wardrobe and outfit styling app with Clerk authentication and Supabase storage.

## Run

1. Copy `.env.example` to `.env.local` and set the Clerk and Supabase public keys and Supabase project URL.
2. In Clerk, enable **Native API** and the **Supabase integration**. In Supabase, add your Clerk domain under **Authentication → Third-Party Auth**. Use Clerk's native Supabase integration so its session JWT has the `authenticated` role.
3. For a new Supabase project, run [the schema SQL](supabase/migrations/20260919000000_styleout.sql). It creates the tables, private image bucket, and per-user row and object policies. The SQL has already been run in the supplied Styleout project.
   Then run [the saved-look SQL](supabase/migrations/20260920000000_saved_look_items.sql). This has also been run in the supplied Styleout project.
   Then run [the style-name and item-snapshot migration](supabase/migrations/20260920010000_style_names_and_item_snapshots.sql) to keep each saved style's name and original wardrobe details. This has also been run in the supplied Styleout project.
   Then run [the AI look status migration](supabase/migrations/20260920020000_ai_looks.sql). This has also been run in the supplied Styleout project.
4. Run `npm install` and `npm run start`, then open the project in Expo Go on your iPhone.

The native bundle ID and Android package in `app.json` are `com.styleout.app`. Register those identifiers in Clerk's Native applications settings before making a standalone build. Expo Go uses its own development callback.

The app stores profile details, wardrobe items, and saved looks in Supabase tables. Main photos and wardrobe images go to the private `styleout-images` bucket under the signed-in Clerk user ID. The app uses short-lived signed image URLs and Clerk tokens for all database and storage requests. Existing local wardrobe pieces, saved looks, and profile data can be imported from the Profile tab after sign-in. Images are limited to 10 MB each by the bucket.

A new saved style keeps the path of the main photo used at save time and links each selected wardrobe item ID with its position in the look. The `save_styleout_look_v2` database function writes the look and item snapshots in one transaction. Profile opens a saved style with its source photo, linked garments, and generated image when ready. Wardrobe items used in saved styles cannot be removed until those styles are removed.

## AI look generation

The Style page's **Generate AI look** action saves the current named look, then invokes the deployed `generate-styleout-look` Supabase Edge Function with only its saved-look ID. The function checks the caller's Clerk JWT through Supabase row policies, reads the saved source photo and garment snapshots from the private bucket, sends them to `spacexai/grok-imagine-image` through Vercel AI Gateway, and writes the result to `styleout-images/<user-id>/generated/<look-id>/`. This model accepts up to three reference images, so AI generation takes the user's photo and at most two wardrobe pieces; styles with more pieces can still be saved. The resulting path and generation status belong to the saved look. The app polls while generation runs and shows the result in Style and Profile. A stopped job can be retried after 150 seconds.

The function source is in [supabase/functions/generate-styleout-look/index.js](supabase/functions/generate-styleout-look/index.js); [supabase/config.toml](supabase/config.toml) disables the legacy gateway JWT check so the function can authorize Clerk tokens with Supabase RLS. Deploy the function after code changes. Set `AI_GATEWAY_API_KEY` in **Supabase → Edge Functions → Secrets**. Keep the key off the phone. Generation sends the user's selected photos through Vercel AI Gateway to SpaceXAI; clear JPEG, PNG, or WebP photos give the best results. Source and garment photos remain private in Supabase; generated images use signed URLs. Image rendering can take around two minutes and may not reproduce every garment detail perfectly.
