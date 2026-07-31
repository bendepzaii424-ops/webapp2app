# Web2App — Chuyển URL/File thành ứng dụng di động kèm Virtual Mouse

## 1. Cấu trúc dự án

```
webapp2app/
├── frontend/               # Web UI (thuần HTML/CSS/JS, không cần build step)
│   └── index.html
├── backend/                 # API server điều phối build
│   ├── server.js
│   ├── routes/build.js
│   └── services/
│       ├── jobStore.js
│       ├── androidBuilder.js
│       └── iosBuilder.js
└── mobile-template/         # Template app Capacitor dùng để "nhân bản" cho mỗi job
    ├── capacitor.config.template.json
    ├── android/.../MainActivity.java     # tiêm virtual mouse vào WebView
    ├── ios/App/App/ViewController.swift  # tiêm virtual mouse vào WKWebView
    ├── ios/ExportOptions.plist
    └── .../virtual-mouse/{virtual-mouse.js, virtual-mouse.css}
```

**Cách hoạt động tổng quát**: mỗi lần người dùng bấm "Tạo Ứng Dụng", backend copy
`mobile-template/` sang một thư mục làm việc riêng, cấu hình `capacitor.config.json`
trỏ tới URL (hoặc chép file/zip vào thư mục `www`), chạy `cap sync` rồi build native
bằng Gradle (Android) hoặc `xcodebuild` (iOS). File kết quả được copy vào `backend/builds/`
và phục vụ qua endpoint tĩnh `/downloads/...`.

Virtual mouse **không** được build riêng cho từng job — nó nằm sẵn trong
`mobile-template`, nên mọi app sinh ra đều tự động có tính năng này.

## 2. Chạy demo nhanh (chỉ Android)

```bash
cd backend
npm install
npm start        # chạy tại http://localhost:4000

# ở tab khác, mở frontend/index.html bằng một static server bất kỳ
npx serve frontend
```

Mở trang, nhập URL, chọn Android, bấm "Tạo Ứng Dụng". Yêu cầu máy chủ backend đã
cài Android SDK + JDK (mục 3).

## 3. Thiết lập môi trường build Android

Chạy trên Linux hoặc macOS đều được.

```bash
# 1. Cài JDK 17
sudo apt install openjdk-17-jdk        # Ubuntu/Debian
# hoặc: brew install openjdk@17        # macOS

# 2. Cài Android command-line tools
mkdir -p ~/android-sdk/cmdline-tools
cd ~/android-sdk/cmdline-tools
curl -O https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip commandlinetools-linux-*.zip -d latest_tmp && mv latest_tmp/cmdline-tools latest && rm -rf latest_tmp

export ANDROID_HOME=~/android-sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

# 3. Cài các package cần thiết
sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"

# 4. Cài Node.js >= 18 và Capacitor CLI
npm install -g @capacitor/cli
```

Kiểm tra template build được thủ công trước khi cắm vào backend:

```bash
cd mobile-template
npm install @capacitor/core @capacitor/android
npx cap sync android
cd android && ./gradlew assembleDebug
```

## 4. Thiết lập môi trường build iOS (bắt buộc máy macOS)

Apple **không cho phép** build/ký file `.ipa` trên Linux hay Windows. Bạn cần:

1. Một máy Mac (vật lý, hoặc Mac cloud như MacStadium, Codemagic, GitHub Actions
   `macos-latest` runner, Bitrise...) có cài **Xcode** (qua App Store hoặc
   `xcode-select --install` cho Command Line Tools tối thiểu).
2. Tài khoản **Apple Developer Program** (99 USD/năm) để có Team ID, certificate
   ký (Distribution/Ad-hoc) và provisioning profile.
3. Cài CocoaPods: `sudo gem install cocoapods`
4. Cài Capacitor iOS: `npm install @capacitor/ios && npx cap sync ios`
5. Trong Xcode, mở `ios/App/App.xcworkspace`, đăng nhập Apple ID (Preferences >
   Accounts), chọn Team, để "Automatically manage signing".
6. Cập nhật `mobile-template/ios/ExportOptions.plist`: thay `YOUR_APPLE_TEAM_ID`
   bằng Team ID thật; đổi `method` thành `app-store`, `ad-hoc`, hoặc
   `development` tuỳ mục đích phân phối.

**Kiến trúc khuyến nghị cho production**: backend Node.js chạy trên Linux như
bình thường, nhưng job iOS được đẩy sang một **Mac build agent** riêng (qua SSH,
hoặc trigger CI job trên Codemagic/GitHub Actions macOS runner) — xem comment
trong `backend/services/iosBuilder.js` để biết chỗ cần sửa nếu tách agent.

## 5. Giới hạn và điểm cần mở rộng khi lên production

- **Hàng đợi build**: bản demo chạy build ngay khi có request (không giới hạn số
  job song song). Production nên dùng queue (BullMQ + Redis) để giới hạn build
  đồng thời, tránh quá tải CPU/RAM của máy build.
- **Ký APK release**: bản demo build `assembleDebug` (không cần keystore). Muốn
  phát hành thật, cần tạo keystore (`keytool -genkeypair ...`) và đổi sang
  `assembleRelease` với cấu hình `signingConfigs` trong `android/app/build.gradle`.
- **Lưu trữ file build**: bản demo lưu trực tiếp trên đĩa server. Production nên
  đẩy lên S3/Cloud Storage và trả pre-signed URL, có cơ chế tự xoá sau X ngày.
- **Bảo mật upload**: giới hạn loại file, quét virus/malware trước khi đóng gói
  vào app, giới hạn dung lượng theo gói dịch vụ.
- **Xác thực người dùng & giới hạn tần suất build** nếu triển khai như dịch vụ
  công khai.

## 6. Tuỳ biến Virtual Mouse

Toàn bộ logic nằm trong 2 file, dùng chung cho cả Android lẫn iOS:

- `mobile-template/.../virtual-mouse/virtual-mouse.js`
- `mobile-template/.../virtual-mouse/virtual-mouse.css`

Có thể chỉnh `SENSITIVITY`, `TAP_MOVE_THRESHOLD`, `TAP_TIME_THRESHOLD` ở đầu file
JS để đổi độ nhạy trackpad, hoặc sửa CSS để đổi icon/vị trí nút "Mouse".
