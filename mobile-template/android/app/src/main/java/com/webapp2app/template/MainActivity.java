package com.webapp2app.template;

import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.BridgeActivity;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

/**
 * MainActivity mac dinh cua Capacitor, duoc mo rong de tiem
 * virtual-mouse.js + virtual-mouse.css vao moi trang duoc WebView tai,
 * bat ke la URL remote (server.url) hay noi dung local (assets/public).
 *
 * Viec inject o day khong bi gioi han boi CORS/same-origin, vi day la
 * script chay trong chinh ngu canh JS cua trang top-level (khong phai
 * iframe) - tuong tu co che cua cac WebView-wrapper app pho bien.
 */
public class MainActivity extends BridgeActivity {

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    WebView webView = this.bridge.getWebView();
    final String css = readAsset("virtual-mouse/virtual-mouse.css");
    final String js = readAsset("virtual-mouse/virtual-mouse.js");

    webView.setWebViewClient(new WebViewClient() {
      @Override
      public void onPageFinished(WebView view, String url) {
        super.onPageFinished(view, url);

        String injectCss =
            "(function(){var s=document.createElement('style');s.textContent="
                + jsStringLiteral(css)
                + ";document.head.appendChild(s);})();";
        view.evaluateJavascript(injectCss, null);
        view.evaluateJavascript(js, null);
      }
    });
  }

  private String readAsset(String path) {
    StringBuilder sb = new StringBuilder();
    try (BufferedReader reader = new BufferedReader(
        new InputStreamReader(getAssets().open(path), StandardCharsets.UTF_8))) {
      String line;
      while ((line = reader.readLine()) != null) {
        sb.append(line).append("\n");
      }
    } catch (IOException e) {
      e.printStackTrace();
    }
    return sb.toString();
  }

  // Chuyen chuoi Java thanh JS string literal an toan de nhung vao evaluateJavascript
  private String jsStringLiteral(String raw) {
    String escaped = raw
        .replace("\\", "\\\\")
        .replace("'", "\\'")
        .replace("\n", "\\n")
        .replace("\r", "");
    return "'" + escaped + "'";
  }
}
