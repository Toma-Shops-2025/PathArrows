package fun.patharrows.unity;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import androidx.annotation.Nullable;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.unity3d.ads.AdExpiredListener;
import com.unity3d.ads.BannerAd;
import com.unity3d.ads.BannerConfiguration;
import com.unity3d.ads.BannerShowListener;
import com.unity3d.ads.BannerSize;
import com.unity3d.ads.InitializationConfiguration;
import com.unity3d.ads.InitializationListener;
import com.unity3d.ads.InterstitialAd;
import com.unity3d.ads.InterstitialShowListener;
import com.unity3d.ads.LoadConfiguration;
import com.unity3d.ads.LoadListener;
import com.unity3d.ads.RewardedAd;
import com.unity3d.ads.RewardedShowListener;
import com.unity3d.ads.ShowConfiguration;
import com.unity3d.ads.ShowFinishState;
import com.unity3d.ads.UnityAds;
import com.unity3d.ads.UnityAdsError;

@CapacitorPlugin(name = "UnityAds")
public class UnityAdsPlugin extends Plugin {

    private static final String TAG = "UnityAdsPlugin";
    private static final String GAME_ID = "REPLACE_WITH_PATHARROWS_UNITY_GAME_ID";

    private static final String REWARDED_ID = "Rewarded_Android";
    private static final String INTERSTITIAL_ID = "Interstitial_Android";
    private static final String BANNER_ID = "Banner_Android";

    private static final long READY_WAIT_MS = 8000L;
    private static final long READY_POLL_MS = 250L;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Nullable private RewardedAd rewardedAd;
    @Nullable private InterstitialAd interstitialAd;
    @Nullable private BannerAd bannerAd;
    private boolean bannerVisible;

    @PluginMethod
    public void initialize(PluginCall call) {
        InitializationConfiguration configuration =
                new InitializationConfiguration.Builder(GAME_ID)
                        .withTestMode(false)
                        .build();

        UnityAds.initialize(configuration, new InitializationListener() {
            @Override
            public void onInitializationComplete(@Nullable UnityAdsError error) {
                JSObject result = new JSObject();
                if (error == null) {
                    loadRewarded();
                    loadInterstitial();
                    loadBanner();
                    result.put("success", true);
                    Log.i(TAG, "Unity Ads initialized");
                } else {
                    result.put("success", false);
                    result.put("error", errorMessage(error));
                    Log.e(TAG, "Unity Ads init failed: " + errorMessage(error));
                }
                call.resolve(result);
            }
        });
    }

    private void loadRewarded() {
        LoadConfiguration config = new LoadConfiguration.Builder(REWARDED_ID).build();

        RewardedAd.load(config, new LoadListener<RewardedAd>() {
            @Override
            public void onAdLoaded(@Nullable RewardedAd ad, @Nullable UnityAdsError error) {
                if (ad != null) {
                    rewardedAd = ad;
                    ad.setOnAdExpired(new AdExpiredListener<RewardedAd>() {
                        @Override
                        public void onAdExpired(RewardedAd expiredAd) {
                            if (rewardedAd == expiredAd) {
                                rewardedAd = null;
                            }
                            loadRewarded();
                        }
                    });
                    Log.i(TAG, "Rewarded ad loaded");
                } else {
                    rewardedAd = null;
                    Log.e(TAG, "Rewarded load failed: " + errorMessage(error));
                }
            }
        });
    }

    @PluginMethod
    public void showRewarded(PluginCall call) {
        waitForReady(
                () -> rewardedAd != null,
                this::loadRewarded,
                ready -> {
                    if (!ready || rewardedAd == null) {
                        JSObject result = new JSObject();
                        result.put("success", false);
                        result.put("rewarded", false);
                        result.put("error", "Rewarded ad not ready");
                        call.resolve(result);
                        loadRewarded();
                        return;
                    }

                    Activity activity = getActivity();
                    if (activity == null) {
                        JSObject result = new JSObject();
                        result.put("success", false);
                        result.put("rewarded", false);
                        result.put("error", "Activity unavailable");
                        call.resolve(result);
                        return;
                    }

                    ShowConfiguration config =
                            new ShowConfiguration.Builder()
                                    .withCustomRewardString("patharrows_reward")
                                    .build();

                    final boolean[] resolved = {false};
                    final boolean[] earnedReward = {false};
                    RewardedAd adToShow = rewardedAd;
                    rewardedAd = null;

                    adToShow.show(activity, config, new RewardedShowListener() {
                        @Override
                        public void onStarted(RewardedAd ad) {}

                        @Override
                        public void onClicked(RewardedAd ad) {}

                        @Override
                        public void onRewarded(RewardedAd ad) {
                            earnedReward[0] = true;
                            resolveRewarded(call, resolved, true, null);
                        }

                        @Override
                        public void onCompleted(RewardedAd ad, ShowFinishState state) {
                            boolean rewarded =
                                    earnedReward[0] || state == ShowFinishState.COMPLETED;
                            resolveRewarded(call, resolved, rewarded, null);
                            loadRewarded();
                        }

                        @Override
                        public void onFailed(RewardedAd ad, UnityAdsError error) {
                            resolveRewarded(call, resolved, false, errorMessage(error));
                            loadRewarded();
                        }
                    });
                });
    }

    private void resolveRewarded(
            PluginCall call,
            boolean[] resolved,
            boolean rewarded,
            @Nullable String error) {
        if (resolved[0]) {
            return;
        }
        resolved[0] = true;

        JSObject result = new JSObject();
        result.put("success", rewarded);
        result.put("rewarded", rewarded);
        if (error != null) {
            result.put("error", error);
        }
        call.resolve(result);
    }

    private void loadInterstitial() {
        LoadConfiguration config = new LoadConfiguration.Builder(INTERSTITIAL_ID).build();

        InterstitialAd.load(config, new LoadListener<InterstitialAd>() {
            @Override
            public void onAdLoaded(@Nullable InterstitialAd ad, @Nullable UnityAdsError error) {
                if (ad != null) {
                    interstitialAd = ad;
                    ad.setOnAdExpired(new AdExpiredListener<InterstitialAd>() {
                        @Override
                        public void onAdExpired(InterstitialAd expiredAd) {
                            if (interstitialAd == expiredAd) {
                                interstitialAd = null;
                            }
                            loadInterstitial();
                        }
                    });
                    Log.i(TAG, "Interstitial ad loaded");
                } else {
                    interstitialAd = null;
                    Log.e(TAG, "Interstitial load failed: " + errorMessage(error));
                }
            }
        });
    }

    @PluginMethod
    public void showInterstitial(PluginCall call) {
        waitForReady(
                () -> interstitialAd != null,
                this::loadInterstitial,
                ready -> {
                    if (!ready || interstitialAd == null) {
                        call.resolve();
                        loadInterstitial();
                        return;
                    }

                    Activity activity = getActivity();
                    if (activity == null) {
                        call.resolve();
                        return;
                    }

                    ShowConfiguration config = new ShowConfiguration.Builder().build();
                    InterstitialAd adToShow = interstitialAd;
                    interstitialAd = null;

                    adToShow.show(activity, config, new InterstitialShowListener() {
                        @Override
                        public void onStarted(InterstitialAd ad) {}

                        @Override
                        public void onClicked(InterstitialAd ad) {}

                        @Override
                        public void onCompleted(InterstitialAd ad, ShowFinishState state) {
                            loadInterstitial();
                            call.resolve();
                        }

                        @Override
                        public void onFailed(InterstitialAd ad, UnityAdsError error) {
                            Log.e(TAG, "Interstitial show failed: " + errorMessage(error));
                            loadInterstitial();
                            call.resolve();
                        }
                    });
                });
    }

    private void loadBanner() {
        Activity activity = getActivity();
        if (activity == null) {
            return;
        }

        BannerSize size = BannerSize.Companion.getStandard();
        BannerShowListener showListener = new BannerShowListener() {
            @Override
            public void onImpression(BannerAd ad) {
                Log.i(TAG, "Banner impression");
            }

            @Override
            public void onClicked(BannerAd ad) {}

            @Override
            public void onFailedToShow(BannerAd ad, UnityAdsError error) {
                Log.e(TAG, "Banner failed to show: " + errorMessage(error));
            }
        };

        BannerConfiguration config =
                new BannerConfiguration.Builder(BANNER_ID, size, showListener).build();

        BannerAd.load(config, new LoadListener<BannerAd>() {
            @Override
            public void onAdLoaded(@Nullable BannerAd ad, @Nullable UnityAdsError error) {
                if (ad != null) {
                    bannerAd = ad;
                    ad.setOnAdExpired(new AdExpiredListener<BannerAd>() {
                        @Override
                        public void onAdExpired(BannerAd expiredAd) {
                            if (bannerAd == expiredAd) {
                                detachBannerView(expiredAd);
                                bannerAd = null;
                            }
                            loadBanner();
                        }
                    });
                    Log.i(TAG, "Banner ad loaded");
                    if (bannerVisible) {
                        attachBannerView(ad);
                    }
                } else {
                    bannerAd = null;
                    Log.e(TAG, "Banner load failed: " + errorMessage(error));
                }
            }
        });
    }

    @PluginMethod
    public void showBanner(PluginCall call) {
        bannerVisible = true;
        waitForReady(
                () -> bannerAd != null,
                this::loadBanner,
                ready -> {
                    Activity activity = getActivity();
                    if (!ready || bannerAd == null || activity == null) {
                        call.resolve();
                        loadBanner();
                        return;
                    }

                    activity.runOnUiThread(() -> {
                        attachBannerView(bannerAd);
                        call.resolve();
                    });
                });
    }

    @PluginMethod
    public void hideBanner(PluginCall call) {
        bannerVisible = false;
        Activity activity = getActivity();
        if (activity == null) {
            call.resolve();
            return;
        }

        activity.runOnUiThread(() -> {
            detachBannerView(bannerAd);
            call.resolve();
        });
    }

    private void attachBannerView(@Nullable BannerAd ad) {
        if (ad == null) {
            return;
        }

        Activity activity = getActivity();
        if (activity == null) {
            return;
        }

        View bannerView = ad.getView();
        ViewGroup root = activity.findViewById(android.R.id.content);
        if (root == null) {
            return;
        }

        if (bannerView.getParent() instanceof ViewGroup) {
            ((ViewGroup) bannerView.getParent()).removeView(bannerView);
        }

        DisplayMetrics metrics = activity.getResources().getDisplayMetrics();
        int widthPx = Math.round(320 * metrics.density);
        int heightPx = Math.round(50 * metrics.density);

        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                widthPx,
                heightPx,
                Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL
        );

        root.addView(bannerView, params);
    }

    private void detachBannerView(@Nullable BannerAd ad) {
        if (ad == null) {
            return;
        }

        View bannerView = ad.getView();
        if (bannerView.getParent() instanceof ViewGroup) {
            ((ViewGroup) bannerView.getParent()).removeView(bannerView);
        }
    }

    private interface ReadyCheck {
        boolean isReady();
    }

    private interface ReadyCallback {
        void onResult(boolean ready);
    }

    private void waitForReady(ReadyCheck check, Runnable triggerLoad, ReadyCallback callback) {
        if (check.isReady()) {
            callback.onResult(true);
            return;
        }

        triggerLoad.run();
        final long deadline = System.currentTimeMillis() + READY_WAIT_MS;

        Runnable poll = new Runnable() {
            @Override
            public void run() {
                if (check.isReady()) {
                    callback.onResult(true);
                    return;
                }
                if (System.currentTimeMillis() >= deadline) {
                    callback.onResult(false);
                    return;
                }
                mainHandler.postDelayed(this, READY_POLL_MS);
            }
        };
        mainHandler.postDelayed(poll, READY_POLL_MS);
    }

    private static String errorMessage(@Nullable UnityAdsError error) {
        if (error == null) {
            return "Unknown error";
        }
        String message = error.getMessage();
        if (message == null || message.isEmpty()) {
            return "UnityAdsError code=" + error.getCode();
        }
        return message;
    }
}
