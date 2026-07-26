package io.github.gemcascade;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Gem Cascade als eigenstaendige App.
 *
 * Das Spiel liegt vollstaendig in den Assets und wird von dort geladen, nicht
 * aus dem Netz. Damit laeuft die App offline, es gibt keine Ladezeit und
 * keine Adressleiste — sie verhaelt sich wie eine normale App, weil sie in
 * jeder Hinsicht, die zaehlt, eine ist.
 *
 * Der WebView bekommt nur, was das Spiel wirklich braucht: JavaScript und
 * DOM-Storage fuer den Spielstand. Kein Dateizugriff, kein Netzwerkzugriff
 * auf lokale Dateien, keine Geolokalisierung.
 */
public class MainActivity extends Activity {

    private WebView web;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
                             WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        WebSettings s = web.getSettings();

        s.setJavaScriptEnabled(true);
        /* Der Spielstand liegt im localStorage — ohne das waere nach jedem
           Schliessen alles weg. */
        s.setDomStorageEnabled(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(false);

        /* Nichts davon braucht das Spiel, also bleibt es aus. */
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setGeolocationEnabled(false);

        /* Alles bleibt in der App: ein Link nach draussen wuerde sonst den
           WebView zur halbgaren Browserattrappe machen. */
        web.setWebViewClient(new WebViewClient());
        web.setBackgroundColor(0xFF0A1A4D);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);

        setContentView(web);
        goFullscreen();

        web.loadUrl("file:///android_asset/www/index.html");
    }

    /** Randlos, damit das Brett den ganzen Schirm bekommt. */
    private void goFullscreen() {
        View decor = getWindow().getDecorView();
        decor.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
              | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
              | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
              | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
              | View.SYSTEM_UI_FLAG_FULLSCREEN
              | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().setStatusBarColor(0xFF12296B);
            getWindow().setNavigationBarColor(0xFF0A1A4D);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) goFullscreen();
    }

    /**
     * Zurueck fuehrt im Spiel zurueck, nicht aus der App heraus. Das Spiel
     * selbst hat keine Browser-Historie, deshalb wird die Taste an eine
     * Escape-Taste weitergereicht: die schliesst Popups und pausiert.
     */
    @Override
    public void onBackPressed() {
        if (web != null) {
            web.evaluateJavascript(
                "(function(){var e=new KeyboardEvent('keydown',{key:'Escape'});"
              + "document.dispatchEvent(e);"
              + "return !!document.querySelector('.screen--overlay.is-active');})()",
                null);
        }
        /* Nicht super.onBackPressed(): sonst laege die App nach dem ersten
           Zurueck im Hintergrund, mitten im Level. */
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (web != null) web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
