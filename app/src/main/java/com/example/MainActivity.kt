package com.example

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.view.View
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color as ComposeColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.google.android.gms.ads.AdError
import com.google.android.gms.ads.AdListener
import com.google.android.gms.ads.AdLoader
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdSize
import com.google.android.gms.ads.AdView
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.nativead.NativeAd
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback
import java.io.ByteArrayInputStream
import java.io.IOException
import java.util.Locale
import org.json.JSONObject

private const val ASSET_HOST = "appassets.androidplatform.net"
private const val ASSET_ENTRY_URL = "https://$ASSET_HOST/assets/index.html"

class MainActivity : ComponentActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge(
      statusBarStyle = SystemBarStyle.dark(Color.parseColor("#1E1324")),
      navigationBarStyle = SystemBarStyle.dark(Color.parseColor("#160D1C")),
    )
    setContent {
      GemBlockWebGameScreen(
        onExitRequested = { finish() }
      )
    }
  }
}

private tailrec fun Context.findActivity(): Activity? =
  when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
  }

private class AndroidAudioBridge(context: Context) {
  private var ttsReady = false
  private var tts: TextToSpeech? = null

  init {
    tts = TextToSpeech(context.applicationContext) { status ->
      if (status == TextToSpeech.SUCCESS) {
        tts?.language = Locale.US
        ttsReady = true
      }
    }
  }

  @JavascriptInterface
  fun speakCallout(word: String, pitch: Float, rate: Float) {
    val engine = tts ?: return
    if (!ttsReady) return
    engine.setPitch(pitch.coerceIn(0.6f, 1.8f))
    engine.setSpeechRate(rate.coerceIn(0.7f, 1.5f))
    engine.speak(word, TextToSpeech.QUEUE_FLUSH, null, "callout_${System.currentTimeMillis()}")
  }

  @JavascriptInterface
  fun stopSpeech() {
    tts?.stop()
  }

  fun release() {
    tts?.stop()
    tts?.shutdown()
    tts = null
    ttsReady = false
  }
}

private class AndroidAdsBridge(
  private val context: Context,
  private val webViewProvider: () -> WebView?,
  private val onBannerUpdated: (AdView?, Boolean, Boolean) -> Unit,
) {
  private val mainHandler = Handler(Looper.getMainLooper())
  private var adsInitialized = false
  private var bannerUnitId = ""
  private var nativeUnitId = ""
  private var rewardedUnitId = ""

  private var bannerAdView: AdView? = null
  private var bannerLoaded = false
  private var bannerVisible = false

  @Volatile private var rewardedAd: RewardedAd? = null
  @Volatile private var loadingRewarded = false

  @Volatile private var cachedNativeAd: NativeAd? = null
  @Volatile private var cachedNativeJson: String? = null
  @Volatile private var loadingNative = false
  @Volatile private var pendingNativeContainerId: String? = null

  private fun evalJs(script: String) {
    mainHandler.post {
      webViewProvider()?.evaluateJavascript(script, null)
    }
  }

  private fun notifyBannerState() {
    val loaded = bannerLoaded
    val visible = bannerVisible
    val view = bannerAdView
    mainHandler.post {
      onBannerUpdated(view, loaded, visible)
      webViewProvider()?.evaluateJavascript(
        "window.__onAdMobBannerState && window.__onAdMobBannerState($loaded, $visible);",
        null,
      )
    }
  }

  @JavascriptInterface
  fun initAds(configJson: String) {
    try {
      val json = JSONObject(configJson)
      bannerUnitId = json.optString("bannerAdUnitId", "")
      nativeUnitId = json.optString("nativeInlineAdUnitId", "")
      rewardedUnitId = json.optString("rewardedAdUnitId", "")
    } catch (_: Exception) {
      return
    }

    mainHandler.post {
      if (!adsInitialized) {
        adsInitialized = true
        MobileAds.initialize(context.applicationContext) {
          if (bannerUnitId.isNotBlank() && !bannerUnitId.startsWith("YOUR_")) {
            loadBannerInternal(bannerUnitId)
          }
          if (rewardedUnitId.isNotBlank() && !rewardedUnitId.startsWith("YOUR_")) {
            preloadRewarded(rewardedUnitId)
          }
          if (nativeUnitId.isNotBlank() && !nativeUnitId.startsWith("YOUR_")) {
            preloadNative(nativeUnitId)
          }
        }
      }
    }
  }

  private fun loadBannerInternal(unitId: String) {
    if (unitId.isBlank() || unitId.startsWith("YOUR_")) return
    bannerAdView?.destroy()
    bannerLoaded = false

    val adView = AdView(context).apply {
      setAdSize(AdSize.BANNER)
      adUnitId = unitId
      adListener = object : AdListener() {
        override fun onAdLoaded() {
          bannerLoaded = true
          notifyBannerState()
        }

        override fun onAdFailedToLoad(error: LoadAdError) {
          bannerLoaded = false
          notifyBannerState()
        }
      }
    }
    bannerAdView = adView
    notifyBannerState()
    adView.loadAd(AdRequest.Builder().build())
  }

  @JavascriptInterface
  fun showBanner() {
    bannerVisible = true
    notifyBannerState()
    mainHandler.post {
      if (bannerAdView == null && adsInitialized && bannerUnitId.isNotBlank() && !bannerUnitId.startsWith("YOUR_")) {
        loadBannerInternal(bannerUnitId)
      }
    }
  }

  @JavascriptInterface
  fun hideBanner() {
    bannerVisible = false
    notifyBannerState()
  }

  private fun serializeNativeAd(ad: NativeAd): String {
    return JSONObject().apply {
      put("headline", ad.headline ?: "")
      put("body", ad.body ?: "")
      put("callToAction", ad.callToAction ?: "Learn More")
      put("iconUrl", ad.icon?.uri?.toString() ?: "")
      put("advertiser", ad.advertiser ?: "")
    }.toString()
  }

  private fun preloadNative(unitId: String) {
    if (loadingNative || unitId.isBlank() || unitId.startsWith("YOUR_")) return
    loadingNative = true
    mainHandler.post {
      val loader = AdLoader.Builder(context, unitId)
        .forNativeAd { ad ->
          cachedNativeAd?.destroy()
          cachedNativeAd = ad
          val json = serializeNativeAd(ad)
          cachedNativeJson = json
          loadingNative = false
          val targetId = pendingNativeContainerId
          pendingNativeContainerId = null
          if (!targetId.isNullOrBlank()) {
            val quotedId = JSONObject.quote(targetId)
            val quotedJson = JSONObject.quote(json)
            evalJs("window.__onAdMobNativeLoaded && window.__onAdMobNativeLoaded($quotedId, $quotedJson);")
          }
        }
        .withAdListener(object : AdListener() {
          override fun onAdFailedToLoad(error: LoadAdError) {
            loadingNative = false
            pendingNativeContainerId = null
          }
        })
        .build()
      loader.loadAd(AdRequest.Builder().build())
    }
  }

  @JavascriptInterface
  fun loadNativeAd(unitId: String, containerId: String): String? {
    val resolvedUnit = if (unitId.isNotBlank()) unitId else nativeUnitId
    if (resolvedUnit.isBlank() || resolvedUnit.startsWith("YOUR_")) return null

    val existing = cachedNativeJson
    if (existing != null) {
      pendingNativeContainerId = null
      preloadNative(resolvedUnit)
      return existing
    }

    pendingNativeContainerId = containerId
    preloadNative(resolvedUnit)
    return null
  }

  @JavascriptInterface
  fun onNativeAdClicked(containerId: String) {
    mainHandler.post {
      try {
        cachedNativeAd?.performClick(Bundle.EMPTY)
      } catch (_: Exception) {}
    }
  }

  private fun preloadRewarded(unitId: String) {
    if (loadingRewarded || unitId.isBlank() || unitId.startsWith("YOUR_")) return
    loadingRewarded = true
    mainHandler.post {
      RewardedAd.load(
        context,
        unitId,
        AdRequest.Builder().build(),
        object : RewardedAdLoadCallback() {
          override fun onAdLoaded(ad: RewardedAd) {
            rewardedAd = ad
            loadingRewarded = false
          }

          override fun onAdFailedToLoad(error: LoadAdError) {
            rewardedAd = null
            loadingRewarded = false
          }
        },
      )
    }
  }

  @JavascriptInterface
  fun showRewardedAd(unitId: String): Boolean {
    val resolvedUnit = if (unitId.isNotBlank()) unitId else rewardedUnitId
    val ad = rewardedAd
    val activity = context.findActivity()
    if (ad == null || activity == null) {
      preloadRewarded(resolvedUnit)
      return false
    }

    rewardedAd = null
    mainHandler.post {
      ad.fullScreenContentCallback = object : FullScreenContentCallback() {
        override fun onAdDismissedFullScreenContent() {
          evalJs("window.__onAdMobRewardClosed && window.__onAdMobRewardClosed();")
          preloadRewarded(resolvedUnit)
        }

        override fun onAdFailedToShowFullScreenContent(error: AdError) {
          evalJs("window.__onAdMobRewardClosed && window.__onAdMobRewardClosed();")
          preloadRewarded(resolvedUnit)
        }
      }
      ad.show(activity) {
        evalJs("window.__onAdMobRewardEarned && window.__onAdMobRewardEarned();")
      }
    }
    return true
  }

  fun release() {
    mainHandler.post {
      bannerAdView?.destroy()
      bannerAdView = null
      cachedNativeAd?.destroy()
      cachedNativeAd = null
      cachedNativeJson = null
      rewardedAd = null
    }
  }
}

private class LocalAssetWebViewClient(private val context: Context) : WebViewClient() {

  override fun shouldInterceptRequest(
    view: WebView?,
    request: WebResourceRequest?,
  ): WebResourceResponse? {
    val uri = request?.url ?: return null
    if (uri.host != ASSET_HOST) return null
    val path = uri.path ?: return null

    if (path == "/favicon.ico") {
      return WebResourceResponse("image/x-icon", null, ByteArrayInputStream(ByteArray(0)))
    }

    if (!path.startsWith("/assets/")) return null
    val assetPath = path.removePrefix("/assets/").trimStart('/')
    if (assetPath.isEmpty()) return null

    return try {
      val stream = context.assets.open(assetPath)
      val mimeType = when {
        assetPath.endsWith(".html", ignoreCase = true) -> "text/html"
        assetPath.endsWith(".css", ignoreCase = true) -> "text/css"
        assetPath.endsWith(".js", ignoreCase = true) -> "application/javascript"
        assetPath.endsWith(".svg", ignoreCase = true) -> "image/svg+xml"
        assetPath.endsWith(".png", ignoreCase = true) -> "image/png"
        assetPath.endsWith(".json", ignoreCase = true) -> "application/json"
        else -> "application/octet-stream"
      }
      WebResourceResponse(mimeType, "UTF-8", stream)
    } catch (_: IOException) {
      null
    }
  }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun GemBlockWebGameScreen(
  onExitRequested: () -> Unit,
  modifier: Modifier = Modifier,
) {
  val context = LocalContext.current
  var webViewRef by remember { mutableStateOf<WebView?>(null) }
  var bannerAdView by remember { mutableStateOf<AdView?>(null) }
  var bannerLoaded by remember { mutableStateOf(false) }
  var bannerVisible by remember { mutableStateOf(false) }

  val audioBridge = remember(context) { AndroidAudioBridge(context) }
  val adsBridge = remember(context) {
    AndroidAdsBridge(
      context = context,
      webViewProvider = { webViewRef },
      onBannerUpdated = { view, loaded, visible ->
        bannerAdView = view
        bannerLoaded = loaded
        bannerVisible = visible
      },
    )
  }

  DisposableEffect(audioBridge, adsBridge) {
    onDispose {
      audioBridge.release()
      adsBridge.release()
    }
  }

  BackHandler {
    val webView = webViewRef
    if (webView != null) {
      webView.evaluateJavascript(
        "(function(){ return window.handleAndroidBack ? window.handleAndroidBack() : false; })();"
      ) { result ->
        if (result != "true") {
          onExitRequested()
        }
      }
    } else {
      onExitRequested()
    }
  }

  Column(
    modifier = modifier
      .fillMaxSize()
      .background(ComposeColor(0xFF1E1324))
      .windowInsetsPadding(WindowInsets.systemBars)
  ) {
    AndroidView(
      modifier = Modifier
        .weight(1f)
        .fillMaxWidth()
        .testTag("gem_block_webview"),
      factory = { ctx ->
        WebView(ctx).apply {
          layoutParams = ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT,
          )
          setBackgroundColor(Color.parseColor("#1E1324"))
          overScrollMode = View.OVER_SCROLL_NEVER
          isHorizontalScrollBarEnabled = false
          isVerticalScrollBarEnabled = false

          settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = true
            mediaPlaybackRequiresUserGesture = false
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            cacheMode = WebSettings.LOAD_NO_CACHE
          }

          webViewClient = LocalAssetWebViewClient(ctx.applicationContext)
          webChromeClient = WebChromeClient()
          addJavascriptInterface(audioBridge, "AndroidBridge")
          addJavascriptInterface(adsBridge, "AndroidAds")
          loadUrl(ASSET_ENTRY_URL)
          webViewRef = this
        }
      },
      onRelease = { webView ->
        webView.destroy()
      },
    )

    val activeBanner = bannerAdView
    if (activeBanner != null && bannerLoaded && bannerVisible) {
      AndroidView(
        modifier = Modifier
          .fillMaxWidth()
          .heightIn(min = 50.dp, max = 60.dp)
          .background(ComposeColor(0xFF160D1C)),
        factory = {
          (activeBanner.parent as? ViewGroup)?.removeView(activeBanner)
          activeBanner
        },
        update = { view ->
          if (view.parent == null) return@AndroidView
        },
      )
    }
  }
}
