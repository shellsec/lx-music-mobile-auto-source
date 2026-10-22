# 洛雪增强版 v1.9.2

新增自定义源快速添加：相机扫码、从图片识别二维码、粘贴链接。识别后可确认导入单个源或订阅清单，并选择是否启用。

新增临时局域网 HTTP 配置网页：另一部手机在同一可互访 Wi-Fi 下扫码即可打开；电脑手动访问使用六位配对码。服务在 10 分钟后、切到后台或离开设置时关闭，临时二维码请勿分享。

不内置任何音源。首次安装自定义源列表及订阅地址为空，多源自动切换默认关闭；已有订阅继续支持播放失败时自动检查更新。用户导入的内容由用户自行负责，请遵守当地法律与版权。

README 为各架构加速下载链接增加「生成二维码」，扫码内容对应本行的完整 APK 加速地址。

## 下载

| 架构 | 原始下载 | 加速下载 | 二维码 |
| --- | --- | --- | --- |
| arm64-v8a（常见 Android 手机） | [GitHub 下载](https://github.com/shellsec/lx-music-mobile-auto-source/releases/download/v1.9.2/lx-music-mobile-v1.9.2-arm64-v8a.apk) | [加速下载](https://ghfast.top/https://github.com/shellsec/lx-music-mobile-auto-source/releases/download/v1.9.2/lx-music-mobile-v1.9.2-arm64-v8a.apk) | [生成二维码](https://github.com/shellsec/lx-music-mobile-auto-source/blob/v1.9.2/docs/download-qrs/v1.9.2-arm64-v8a.png) |
| armeabi-v7a（32 位设备） | [GitHub 下载](https://github.com/shellsec/lx-music-mobile-auto-source/releases/download/v1.9.2/lx-music-mobile-v1.9.2-armeabi-v7a.apk) | [加速下载](https://ghfast.top/https://github.com/shellsec/lx-music-mobile-auto-source/releases/download/v1.9.2/lx-music-mobile-v1.9.2-armeabi-v7a.apk) | [生成二维码](https://github.com/shellsec/lx-music-mobile-auto-source/blob/v1.9.2/docs/download-qrs/v1.9.2-armeabi-v7a.png) |
| universal（通用包） | [GitHub 下载](https://github.com/shellsec/lx-music-mobile-auto-source/releases/download/v1.9.2/lx-music-mobile-v1.9.2-universal.apk) | [加速下载](https://ghfast.top/https://github.com/shellsec/lx-music-mobile-auto-source/releases/download/v1.9.2/lx-music-mobile-v1.9.2-universal.apk) | [生成二维码](https://github.com/shellsec/lx-music-mobile-auto-source/blob/v1.9.2/docs/download-qrs/v1.9.2-universal.png) |
| x86_64 | [GitHub 下载](https://github.com/shellsec/lx-music-mobile-auto-source/releases/download/v1.9.2/lx-music-mobile-v1.9.2-x86_64.apk) | [加速下载](https://ghfast.top/https://github.com/shellsec/lx-music-mobile-auto-source/releases/download/v1.9.2/lx-music-mobile-v1.9.2-x86_64.apk) | [生成二维码](https://github.com/shellsec/lx-music-mobile-auto-source/blob/v1.9.2/docs/download-qrs/v1.9.2-x86_64.png) |
| x86 | [GitHub 下载](https://github.com/shellsec/lx-music-mobile-auto-source/releases/download/v1.9.2/lx-music-mobile-v1.9.2-x86.apk) | [加速下载](https://ghfast.top/https://github.com/shellsec/lx-music-mobile-auto-source/releases/download/v1.9.2/lx-music-mobile-v1.9.2-x86.apk) | [生成二维码](https://github.com/shellsec/lx-music-mobile-auto-source/blob/v1.9.2/docs/download-qrs/v1.9.2-x86.png) |

加速下载由第三方服务提供；二维码是本地生成的静态图片。

## 验证

- 28 项 JavaScript 测试及 5 项 JVM 测试通过。
- 五个架构 APK 构建及无内置音源检查通过。
- 当前未连接 Android 实机；相机和两台设备之间的 Wi-Fi 操作尚未实机验证。
- APK 沿用开发测试签名，内部版本代码更新为 80。SHA256SUMS.txt 随附校验值。
