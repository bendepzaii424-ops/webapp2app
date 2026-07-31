import UIKit
import Capacitor
import WebKit

/// Mo rong CAPBridgeViewController mac dinh cua Capacitor de tiem
/// virtual-mouse.js + virtual-mouse.css vao WKWebView sau khi trang
/// tai xong (didFinish navigation), tuong tu co che onPageFinished ben Android.
class ViewController: CAPBridgeViewController {

    override func viewDidLoad() {
        super.viewDidLoad()
        guard let webView = self.bridge?.webView else { return }
        webView.navigationDelegate = self
    }
}

extension ViewController: WKNavigationDelegate {
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard
            let cssPath = Bundle.main.path(forResource: "virtual-mouse", ofType: "css", inDirectory: "public/virtual-mouse"),
            let jsPath = Bundle.main.path(forResource: "virtual-mouse", ofType: "js", inDirectory: "public/virtual-mouse"),
            let css = try? String(contentsOfFile: cssPath, encoding: .utf8),
            let js = try? String(contentsOfFile: jsPath, encoding: .utf8)
        else { return }

        let escapedCss = css
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "`", with: "\\`")

        let injectCss = """
        (function(){
          var s = document.createElement('style');
          s.textContent = `\(escapedCss)`;
          document.head.appendChild(s);
        })();
        """

        webView.evaluateJavaScript(injectCss, completionHandler: nil)
        webView.evaluateJavaScript(js, completionHandler: nil)
    }
}
