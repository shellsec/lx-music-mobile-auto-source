# Android 扫码添加自定义源与订阅：可行性调研

调研日期：2026-10-22。范围为当前 Android 项目的方案调研；未安装扫描依赖、未修改业务代码、未编译或发布扫码版本，也未进行识别率和包体实测。

## 结论

可以实现。建议首版采用 **ZXing Android Embedded + Android 原生薄桥接**，提供「相机扫码」和「从图片识别」两个入口。二维码承载用户自己的下载地址或订阅地址，识别后复用已有导入/订阅逻辑。这个推荐基于当前代码结构和下方官方资料，属于工程判断，尚需原型构建与真机确认。

相册识别与相机扫码同样重要：二维码经常就在用户自己的手机聊天或网页里，无法用同一部手机的后置相机扫描屏幕；选择截图即可解决。

## 当前项目约束（本地代码核查）

- `package.json`：React Native 0.73.11，已有原生模块桥接，没有相机/扫码库。
- `android/build.gradle`：`minSdkVersion = 21`、`compileSdkVersion = 36`，Android Gradle Plugin 8.6.1。
- `android/gradle.properties`：`newArchEnabled=false`，Hermes 开启。
- `android/app/src/main/AndroidManifest.xml`：当前没有 `CAMERA` 权限。
- `MainApplication.java` 已手动注册多个 `ReactPackage`，可按现有方式增加扫码模块。
- `ScriptImportOnline.tsx` 已实现地址输入、下载脚本和调用 `handleImportScript`，可接入扫码结果。
- `Source.tsx` 与 `remoteSourceFallback.ts` 已有保存订阅、更新清单和失效恢复逻辑；扫码无需另做一套更新器。
- `src/utils/fs.ts` 已有 `selectFile`，相册/截图入口可复用文件选择能力，但 `content://` 图片读取、位图采样与后台解码需要新增。
- `src/core/init/deeplink/index.ts` 当前没有源/订阅导入分支。不能承诺用户用系统相机扫描普通 URL，就能自动唤起本应用导入；深链分发应作为后续独立增强。

## 三种 Android 原生方案

| 方案 | Google 服务与联网 | 旧 Android 与权限 | 图片识别与接入影响 | 本项目判断 |
| --- | --- | --- | --- | --- |
| ZXing Android Embedded | 依赖列表为 ZXing core 和 AndroidX，不依赖 Google Play 服务；解码可以在本地进行 | 默认实际需 API 24；官方另列 API 21 的 desugaring 方案。相机入口需要相机权限 | 提供扫描 Activity；静态图片可接 ZXing core 解码，需要自己接图片选择与像素转换 | 优先做兼容性原型，保留 Android 5.0 的可能性最好 |
| Google Code Scanner | 扫描 UI 和模块由 Google Play 服务提供；模块首次可能下载 | 正文当前写 API 23；应用无需自行申请相机权限 | 适合调用现成扫描界面；相册入口仍需另外设计 | 无 Google 服务设备不宜依赖它作为唯一方案 |
| ML Kit Barcode Scanning（bundled） | 模型随应用打包，首次即可离线识码，不走 Play 服务的模型下载通道 | 当前接入正文要求 API 23；自建相机界面需处理相机权限 | 可以处理相机帧和文件图片；还要增加相机采集/UI | 可作为备选，但当前最低系统版本不匹配 |

上述事实分别依据 [ZXing 依赖源码](https://github.com/journeyapps/zxing-android-embedded/blob/master/zxing-android-embedded/build.gradle)、[ZXing core 解码入口](https://github.com/zxing/zxing/blob/master/core/src/main/java/com/google/zxing/MultiFormatReader.java)、[Google Code Scanner](https://developers.google.com/ml-kit/vision/barcode-scanning/code-scanner)、[ML Kit Android 条码扫描](https://developers.google.com/ml-kit/vision/barcode-scanning/android) 和 [ML Kit 模型安装方式](https://developers.google.com/ml-kit/tips/installation-paths)。Bundled 路径不依靠 Play 服务下载模型，并不等同于本次已验证所有无 GMS 设备可用。

### ZXing 与 Android 5.0 的关键限制

官方 README 当前示例使用 `com.journeyapps:zxing-android-embedded:4.3.0`。库声明最低 API 19，不代表默认依赖在 API 19/21 上就能正常运行：默认 core 需要 API 24。README 提供两条兼容路线：降级 core 到 3.3.0，或者配置 Java API desugaring；它给出 API 21 示例。优先研究后者，不直接照抄旧版本依赖组合。[官方兼容说明](https://github.com/journeyapps/zxing-android-embedded#older-sdk-versions)

本项目 AGP 版本满足官方 desugaring 方案的基本工具版本门槛，但具体 desugaring 依赖版本、AndroidX 依赖解析和 R8 行为仍需实编。不能仅加一个 AAR 就宣称兼容 Android 5.0。[Android 官方 desugaring 说明](https://developer.android.com/studio/write/java8-support#library-desugaring)

### Google 文档内的最低版本矛盾

Google Code Scanner 页面摘要仍写 API 21，`Before you begin` 正文却明确要求 API 23。调研按具体接入正文的 API 23 约束评估，不据摘要承诺 API 21。正式实施时还需核查最终解析到的 AAR manifest 和真机表现。[官方接入页](https://developers.google.com/ml-kit/vision/barcode-scanning/code-scanner)

### 包体、许可与维护状态

ZXing 的实际 APK 增量没有在本项目实测，不提供估算数值；应以相同构建配置、同一架构接入前后比较。其官方发布列表当前将 4.3.0 标为最新版本，不能据此推断持续维护强度，应固定版本并验证兼容性。[发布记录](https://github.com/journeyapps/zxing-android-embedded/releases)

ZXing Android Embedded 使用 Apache-2.0，接入后应保留所需许可与归属说明。[COPYING](https://github.com/journeyapps/zxing-android-embedded/blob/master/COPYING)

ML Kit 文档列 bundled 模型约增加 2.4 MB、unbundled 约增加 200 KB，这是厂商文档参考值，不是本项目 APK 测量结果；相机界面等额外依赖还可能改变结果。[官方安装对照](https://developers.google.com/ml-kit/vision/barcode-scanning/android)

ML Kit SDK 使用受 Google API/ML Kit 条款约束，不能把文档示例的 Apache-2.0 许可等同于整个 SDK 的许可。官方说明图像处理在设备上完成，同时还说明 SDK 可能联系 Google 获取维护信息并发送性能/使用指标；因此不能宣称集成后「绝无任何联网」。[ML Kit Terms & Privacy](https://developers.google.com/ml-kit/terms)

## 建议的用户流程

1. 自定义源管理增加「扫码添加」；进入后可选「相机扫描」或「从图片识别」。相机权限只在打开相机时处理，拒绝后仍可用图片识别、粘贴、本地导入。
2. 识别结果展示完整地址，并明确选择「导入单个源」或「添加订阅」。只接受受支持的 HTTP(S) 地址；普通文本、联系人等二维码提示不支持。
3. 确认「导入单个源」后，复用在线脚本导入的下载、大小限制和脚本校验；确认「添加订阅」后，复用现有清单校验、地址保存与更新逻辑。
4. 清单地址不一定带 `.json`，脚本地址也不一定带 `.js`，不能仅按 URL 后缀决定类型。优先由入口/确认选项决定，再用实际返回内容验证。
5. 单个脚本导入与订阅是两回事：扫码导入普通脚本不会自动变成可更新的订阅。只有保存了订阅地址的订阅源，才沿用现有失效自动更新流程。
6. 首版只识别一个二维码；一张图含多个码时让用户选择。只识别地址，不把二维码中的任意脚本正文当作可直接执行内容。
7. 不更改「列表初始为空」「多源自动切换默认关闭」「软件不提供源地址」的现有约定。

这部分是基于现有产品行为的建议，不是扫码 SDK 自带功能。二维码本质上可以编码 URL 文本，是否将其解释成脚本或订阅由本应用处理。[ZXing 对二维码内容的说明](https://github.com/zxing/zxing/wiki/Barcode-Contents)

## 图片选择与权限处理

相机需要声明相机权限；Android 6.0+ 按需申请并处理拒绝，Android 5.1 及以下的权限授予方式不同。扫码取消应正常返回，不显示导入失败。[Android 官方权限说明](https://developer.android.com/training/permissions/requesting)

图片入口可使用系统文件选择器，仅读取用户选中的图片，不必因此额外索取整个相册的读取权限；当前项目已有文件选择封装。[Android 文件选择与权限说明](https://developer.android.com/training/data-storage/shared/documents-files)Android SAF 自 API 19 提供选择图片等文件的能力，可作为覆盖现有最低系统版本的基线；不能把新系统 Photo Picker 的行为直接假设为 Android 5.0 的能力。[Storage Access Framework](https://developer.android.com/guide/topics/providers/document-provider)

## 最小验证范围

实施前先做小原型，而不是直接把扫码入口放进发布版。需要验证：

- 在当前 RN 旧架构、AGP、Hermes 和 Navigation Activity 下能编译，并能正确返回扫描结果、取消状态与错误。
- Android API 21/22、23 及较新系统；至少一台无 Google 服务设备和一台普通 Android 设备。
- 首次授权、拒绝、永久拒绝、取消扫码、旋转屏幕、切后台后返回；相机资源与 Promise 都应正确释放。
- 相册截图、旋转图片、压缩图片、模糊/高密度长 URL、同图多个二维码；大图缩放避免内存问题。
- 有查询参数、无文件后缀、重定向、无效网址、下载失败、返回 HTML 而非脚本/清单，以及重复扫描的处理。
- 导入脚本后能正常使用；订阅扫码保存后重启保留；失效恢复、限次更新、多源开关均保持现有行为。
- 相同配置下比较五种 APK 的大小、构建结果及运行情况；继续执行现有无预置源检查。

当前结论是「方案可行，ZXing 值得优先验证」，不是「已经实现」或「已经完成兼容性验收」。

## 局域网网页配置与扫码对比

补充调研日期：2026-10-22。手机临时开 HTTP 配置页，让电脑或另一部手机提交地址，在技术上可行。两种方案的方便程度取决于链接在哪里：

| 用户场景 | 更方便的入口 | 原因 |
| --- | --- | --- |
| 长链接在电脑浏览器或文档里 | 局域网网页配置 | 电脑直接复制、粘贴提交，不必先把链接转换成二维码 |
| 另一个屏幕已经展示二维码 | 相机扫码 | 扫描即可，不要求两端接入同一个局域网 |
| 二维码在当前手机的聊天/网页里 | 从图片识别 | 选截图即可，无需借第二台设备 |
| 长链接已在当前手机剪贴板 | 粘贴并导入 | 比启动服务器或生成二维码少一步 |

建议按当前需求先做「局域网添加」，后续补「扫码/相册」；若主要分享方式就是二维码，则顺序可以反过来。这是基于操作步骤的产品判断，不是实测速度结论。

最小流程可以是：手机点击「局域网添加」后显示本机 IP、端口和配对码；电脑打开该地址，选择「导入源」或「添加订阅」，粘贴长链接并提交，由手机复用现有导入/订阅逻辑。手机也可把此临时网页地址生成二维码，供另一手机打开——这是生成二维码，不需要本应用取得相机扫描权限。首版不必先做自动设备发现。

需要两端局域网互通；同一个 Wi-Fi 名称不保证可达，访客网、AP 隔离或防火墙可能阻断，手机热点也须实测。此入口宜只在配置页临时启用，用随机会话令牌或配对码限制提交，并校验 Host/Origin、防止跨站提交；离开页面或倒计时结束即停服，不开放公网、不做常驻后台。这是最小设计建议，尚未实现。

项目现有同步模块只是连接电脑端的 WebSocket 客户端，没有可直接复用的 HTTP 服务。仍需新增服务器、网页和原生桥接，不能保证工程量或 APK 增量比扫码更小。NanoHTTPD 是可评估的嵌入式 Java HTTP 服务候选；选定版本对本项目 API 21、构建工具和生命周期的适配仍需验证。[NanoHTTPD 官方项目](https://github.com/NanoHttpd/nanohttpd)

Android 16 的局域网保护目前为 opt-in；官方文档说明 Android 17 对 target SDK 37+ 的应用引入强制规则，接收入站 TCP 也在范围内。当前 target 29 不能据此推断未来所有版本均无需新权限，应在升级目标 SDK 时重新验证。[Android 官方局域网权限说明](https://developer.android.com/privacy-and-security/local-network-permission)
