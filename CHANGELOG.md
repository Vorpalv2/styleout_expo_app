# Changelog

App changes are recorded here by production deployment, with the commit that was included and the previous app revision for comparison.

## Production release — 2026-10-02

- **Commit:** [`9d7051f`](https://github.com/Vorpalv2/styleout_expo_app/commit/9d7051f)
- **Previous app revision:** [`b22eada`](https://github.com/Vorpalv2/styleout_expo_app/commit/b22eada)
- **Production app:** [styleout.expo.app](https://styleout.expo.app/)

### Changes

- Improved mobile tab switching by removing the screen transition animation and loading tabs on demand.
- Updated the style page for smaller screens and added a clear empty state when no main photo is selected.
- Added the ability to remove the selected main photo while retaining it in the photo carousel.
- Added Clerk OAuth callback handling for web and native sign-in, with clearer provider loading feedback.
- Added a confirmation dialog before signing out.
- Refined shared headers, the floating tab bar, and the sign-out icon.

The later commit [`81cba7c`](https://github.com/Vorpalv2/styleout_expo_app/commit/81cba7c) updates GitHub's production deployment link workflow. It contains no app changes and was not a separate EAS app release.
