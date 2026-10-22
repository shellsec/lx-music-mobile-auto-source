# 洛雪增强版

基于 [lyswhut/lx-music](https://github.com/lyswhut/lx-music) 系列项目的 [lx-music-mobile](https://github.com/lyswhut/lx-music-mobile) 二次开发。采用 Apache-2.0 许可证，保留原作者版权声明。修改说明见 [NOTICE](NOTICE)。

本软件不提供任何音源。全新安装后自定义源列表为空，「多源自动切换」默认关闭，订阅地址默认为空。没有源时会提示「请在设置中导入自定义源」。

## 安装包下载

[GitHub Release 页面](https://github.com/shellsec/lx-music-mobile-auto-source/releases)

以下为 **`v1.9.2`** 的各架构安装包，均不包含内置音源。常见 Android 手机可优先选择 arm64-v8a；不确定架构时可选择 universal 通用包。

| 架构 | 原始下载 | 加速下载 | 二维码 |
| --- | --- | --- | --- |
| arm64-v8a（常见 Android 手机） | [GitHub 下载](https://github.com/shellsec/lx-music-mobile-auto-source/releases/download/v1.9.2/lx-music-mobile-v1.9.2-arm64-v8a.apk) | [加速下载](https://gh-proxy.com/https://github.com/shellsec/lx-music-mobile-auto-source/releases/download/v1.9.2/lx-music-mobile-v1.9.2-arm64-v8a.apk) | [生成二维码](https://quickchart.io/qr?size=640&margin=4&text=https%3A%2F%2Fgh-proxy.com%2Fhttps%3A%2F%2Fgithub.com%2Fshellsec%2Flx-music-mobile-auto-source%2Freleases%2Fdownload%2Fv1.9.2%2Flx-music-mobile-v1.9.2-arm64-v8a.apk) |
| armeabi-v7a（32 位设备） | [GitHub 下载](https://github.com/shellsec/lx-music-mobile-auto-source/releases/download/v1.9.2/lx-music-mobile-v1.9.2-armeabi-v7a.apk) | [加速下载](https://gh-proxy.com/https://github.com/shellsec/lx-music-mobile-auto-source/releases/download/v1.9.2/lx-music-mobile-v1.9.2-armeabi-v7a.apk) | [生成二维码](https://quickchart.io/qr?size=640&margin=4&text=https%3A%2F%2Fgh-proxy.com%2Fhttps%3A%2F%2Fgithub.com%2Fshellsec%2Flx-music-mobile-auto-source%2Freleases%2Fdownload%2Fv1.9.2%2Flx-music-mobile-v1.9.2-armeabi-v7a.apk) |
| universal（通用包） | [GitHub 下载](https://github.com/shellsec/lx-music-mobile-auto-source/releases/download/v1.9.2/lx-music-mobile-v1.9.2-universal.apk) | [加速下载](https://gh-proxy.com/https://github.com/shellsec/lx-music-mobile-auto-source/releases/download/v1.9.2/lx-music-mobile-v1.9.2-universal.apk) | [生成二维码](https://quickchart.io/qr?size=640&margin=4&text=https%3A%2F%2Fgh-proxy.com%2Fhttps%3A%2F%2Fgithub.com%2Fshellsec%2Flx-music-mobile-auto-source%2Freleases%2Fdownload%2Fv1.9.2%2Flx-music-mobile-v1.9.2-universal.apk) |
| x86_64 | [GitHub 下载](https://github.com/shellsec/lx-music-mobile-auto-source/releases/download/v1.9.2/lx-music-mobile-v1.9.2-x86_64.apk) | [加速下载](https://gh-proxy.com/https://github.com/shellsec/lx-music-mobile-auto-source/releases/download/v1.9.2/lx-music-mobile-v1.9.2-x86_64.apk) | [生成二维码](https://quickchart.io/qr?size=640&margin=4&text=https%3A%2F%2Fgh-proxy.com%2Fhttps%3A%2F%2Fgithub.com%2Fshellsec%2Flx-music-mobile-auto-source%2Freleases%2Fdownload%2Fv1.9.2%2Flx-music-mobile-v1.9.2-x86_64.apk) |
| x86 | [GitHub 下载](https://github.com/shellsec/lx-music-mobile-auto-source/releases/download/v1.9.2/lx-music-mobile-v1.9.2-x86.apk) | [加速下载](https://gh-proxy.com/https://github.com/shellsec/lx-music-mobile-auto-source/releases/download/v1.9.2/lx-music-mobile-v1.9.2-x86.apk) | [生成二维码](https://quickchart.io/qr?size=640&margin=4&text=https%3A%2F%2Fgh-proxy.com%2Fhttps%3A%2F%2Fgithub.com%2Fshellsec%2Flx-music-mobile-auto-source%2Freleases%2Fdownload%2Fv1.9.2%2Flx-music-mobile-v1.9.2-x86.apk) |

加速下载由第三方 [下载加速服务](https://gh-proxy.com/) 提供。后续版本可在该页面粘贴对应 APK 的 GitHub 下载链接。本项目不在软件中内置下载代理或音源地址。

点击每行右侧的「生成二维码」可查看该架构的下载二维码，扫码内容为同一行的完整 APK 加速下载地址。二维码由 [QuickChart](https://quickchart.io/) 外部服务生成。

## 导入自定义源

1. 打开设置中的自定义源管理入口。
2. 选择「本地导入」导入自己准备的脚本，或通过「在线导入」输入自己的脚本地址。
3. 导入后选择要使用的自定义源。管理列表支持删除和调整顺序。

以下为自定义源管理的操作示意。列表中的内容由用户自行导入，不代表软件内置或推荐的来源；不同客户端版本的布局和按钮名称可能不同。

![自定义源管理操作示意](docs/screenshots/custom-source-management.png)

## 快速添加

设置中的「快速添加自定义源」支持扫一扫、从图片识别和粘贴链接。识别后需选择「导入单个源」或「添加订阅清单」，确认地址及「添加后启用」选项，再点击确认添加。二维码须包含完整 HTTP / HTTPS 地址；仅从可信来源导入脚本。

也可点击「启用 HTTP 网页」，让另一部手机连接同一个允许设备互访的 Wi-Fi，扫描应用显示的二维码，直接在浏览器中填写地址；电脑手动打开显示的地址时需要六位配对码。网页提交后在当前设备完成导入，订阅沿用播放失败时自动检查更新的规则。

二维码包含临时访问凭证，请勿公开分享。服务仅绑定局域网地址，10 分钟后、切到后台或离开设置时关闭；重新开启后须重新扫码或配对。没有相机的设备仍可用图片识别、粘贴链接及网页添加。局域网 HTTP 不加密，请仅在可信网络使用。

## 多源自动切换

需要自动尝试其他已导入源时，在设置中选中「多源自动切换」。播放地址获取失败后，会按用户列表顺序尝试其余已导入源；每首歌曲先从列表首项开始尝试。可以在源管理列表中调整优先顺序。

![用户手动启用多源自动切换后的示意](docs/screenshots/multi-source-switching.png)

图中为用户手动开启后的状态，首次安装默认关闭。选择具体源即可关闭多源自动切换。此功能仅使用用户自行导入或订阅的源。

## 订阅自动更新

用户只需添加并保存一次自己的订阅地址，重启后仍会保留，无需每次重新填写。

1. 在设置中的源清单地址输入框填写自己的地址，例如 `https://example.com/sources.json`。
2. 点击「保存并更新订阅」，下载清单中的源脚本。上方管理示意图中的「从源清单地址更新」表示同类操作，当前版本按钮以实际界面为准。
3. 后续播放失败时自动检查这个已保存的订阅；也可以随时点击按钮手动更新。

自动更新的触发方式：

- **选定单个订阅源时**：该源获取播放地址失败后检查订阅，有更新则重新加载并重试同一个源，不会自动开启多源切换。
- **开启多源自动切换时**：先按顺序尝试完已导入源；全部失败后检查订阅，有更新则按用户列表顺序再试一轮。
- **没有变化或下载失败时**：保留本地内容，停止本次更新重试。同一首歌曲的近期失败最多触发一次，同一订阅地址的自动检查至少间隔一分钟，避免反复请求。

只有清单或脚本内容有变化才重试播放；只有全部脚本下载成功才更新列表。更新保留手动导入的源及已有列表顺序，新加入的订阅源追加到列表末尾。启动时不会主动下载。

清空订阅地址并点击保存，即可停止订阅自动更新；已经导入的源仍保留在本地。本地导入且不属于订阅的脚本，不会因添加订阅而自动获得更新。

清单支持包含 `id`、`name`、`url` 字段的对象数组，也兼容 `{ "sources": [...] }` 格式。每项 `id` 应唯一，`url` 是用户自行提供的脚本地址；相对路径按清单所在目录解析。

## 构建

安装 Node.js 18+、Android SDK 和 Java 17，执行 `npm ci`，然后执行 `npm run pack:android`。产物位于 `android/app/build/outputs/apk/release/`，文件名沿用 `lx-music-mobile-v版本号-架构.apk` 格式。

CI 在打包前检查预置脚本，并在发布前检查 APK 中的源脚本（保留上游自定义源运行环境桥接文件）。

## 免责声明

本软件不提供任何音源，用户导入的内容由用户自行负责，请遵守当地法律与版权。
