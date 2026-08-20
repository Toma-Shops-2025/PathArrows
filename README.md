# Path Arrows

Casual tap-to-clear arrow puzzle game.

Tap an arrow only when nothing is blocking the direction it points. Clear the board to finish the level.

- 30 original levels
- 3 lives per level
- Hints and extra lives via optional Unity rewarded ads
- Interstitial ads after every 3 wins
- Package: `fun.patharrows`

## Repo

https://github.com/Toma-Shops-2025/PathArrows

## Play Store / legal URLs (live)

Base: https://toma-shops-2025.github.io/PathArrows/

| Purpose | URL |
|--------|-----|
| Privacy | https://toma-shops-2025.github.io/PathArrows/privacy.html |
| Terms | https://toma-shops-2025.github.io/PathArrows/terms.html |
| Data / account deletion | https://toma-shops-2025.github.io/PathArrows/account-deletion.html |
| app-ads.txt | https://toma-shops-2025.github.io/PathArrows/app-ads.txt |

## Monetize (Unity Ads)

1. [Unity Ads dashboard](https://operate.dashboard.unity3d.com/) → add **Path Arrows** as a new Android app.
2. Copy the **Game ID**.
3. Paste it into `android/app/src/main/java/fun/patharrows/unity/UnityAdsPlugin.java` (`GAME_ID`).
4. Keep placements: `Rewarded_Android`, `Interstitial_Android`, `Banner_Android`.
5. Build the AAB and ship. Unity pays you for ads after users play.

Ads in the game:
- **Rewarded:** extra hints / refill lives
- **Interstitial:** after every **3** level wins
- **Banner:** bottom of the screen
