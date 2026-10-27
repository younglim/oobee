# Oobee (CLI)

[English](./README.md) | **日本語**

[Oobee](https://go.gov.sg/oobee-cli)（旧称 Purple A11y）は、カスタマイズ可能な自動アクセシビリティテストツールです。ソフトウェア開発チームが、自社の製品が障害のある方（PWD）にとって使いやすいかどうかを評価するのに役立ちます。

これは Oobee のエンジンとコマンドラインインターフェース（CLI）です。公式アプリケーションは [https://go.gov.sg/oobee-cli](https://go.gov.sg/oobee-cli) からのみダウンロードできます。他の入手元やサードパーティのリンクはシステムに危険を及ぼすおそれがあるため、必ず公式リンクからダウンロードしてください。

**使いやすいデスクトップアプリ**をお探しの場合は、[Oobee](https://go.gov.sg/oobee) をご覧ください。

[![DPG Badge](https://img.shields.io/badge/Verified-DPG-3333AB?logo=data:image/svg%2bxml;base64,PHN2ZyB3aWR0aD0iMzEiIGhlaWdodD0iMzMiIHZpZXdCb3g9IjAgMCAzMSAzMyIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE0LjIwMDggMjEuMzY3OEwxMC4xNzM2IDE4LjAxMjRMMTEuNTIxOSAxNi40MDAzTDEzLjk5MjggMTguNDU5TDE5LjYyNjkgMTIuMjExMUwyMS4xOTA5IDEzLjYxNkwxNC4yMDA4IDIxLjM2NzhaTTI0LjYyNDEgOS4zNTEyN0wyNC44MDcxIDMuMDcyOTdMMTguODgxIDUuMTg2NjJMMTUuMzMxNCAtMi4zMzA4MmUtMDVMMTEuNzgyMSA1LjE4NjYyTDUuODU2MDEgMy4wNzI5N0w2LjAzOTA2IDkuMzUxMjdMMCAxMS4xMTc3TDMuODQ1MjEgMTYuMDg5NUwwIDIxLjA2MTJMNi4wMzkwNiAyMi44Mjc3TDUuODU2MDEgMjkuMTA2TDExLjc4MjEgMjYuOTkyM0wxNS4zMzE0IDMyLjE3OUwxOC44ODEgMjYuOTkyM0wyNC44MDcxIDI5LjEwNkwyNC42MjQxIDIyLjgyNzdMMzAuNjYzMSAyMS4wNjEyTDI2LjgxNzYgMTYuMDg5NUwzMC42NjMxIDExLjExNzdMMjQuNjI0MSA5LjM1MTI3WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+Cg==)](https://digitalpublicgoods.net/r/oobee)

> この日本語版は英語版 [README.md](./README.md) の翻訳です。内容に差異がある場合は英語版が優先されます。

## 技術スタック

1. [Crawlee](https://crawlee.dev/)
2. [Axe-core](https://github.com/dequelabs/axe-core)
3. [Node.js](https://Node.js.org/en/)
4. [Playwright](https://playwright.dev/)
5. [Pixelmatch](https://github.com/mapbox/pixelmatch)
6. [Corretto](https://aws.amazon.com/corretto)
7. [VeraPDF](https://github.com/veraPDF/veraPDF-apps)

## スキャンの仕組み

Oobee がウェブサイトをどのようにスキャンするか、結果の正確さに影響する要因、推奨ハードウェア仕様、網羅性を高めるコツについては [CRAWL.md](./CRAWL.md)（英語）を参照してください。大規模なスキャンを実行する前にお読みいただくことをお勧めします。

## NodeJS モジュールとしての利用

Oobee を NodeJS モジュールとして使い、エンドツーエンドテストフレームワークと連携させる方法は、[連携ガイド](./INTEGRATION.ja.md)を参照してください。

## 前提条件とインストール

### ポータブル版 Oobee

ポータブル版 Oobee はインストールの手間が少ないため、推奨される実行方法です。手順は[インストールガイド](./INSTALLATION.md)（英語）を参照してください。

### 手動インストール

以下の要件を満たしていることを確認してください。

#### Node.js

- Node.js 22.15 以上（Node 22 LTS または 24 LTS を推奨）。npm スクリプトは Node を `--use-system-ca` 付きで起動するため、それより古いバージョンでは起動できません。
- Node のバージョンは、ターミナルで次のコマンドを実行して確認できます。

```shell
node -v
```

- Node がインストールされていない場合や、Node のバージョンを管理したい場合は、[Node Version Manager (NVM)](https://github.com/nvm-sh/nvm) の利用を検討してください。NVM をインストールしたら、LTS 版の Node をインストールします。

```shell
# NVM で NodeJS をインストールする
nvm install --lts

# 以降は、新しいターミナルを開くたびに次のコマンドを実行する必要があります
nvm use --lts
```

- `npm install` で必要な npm パッケージをインストールします。
- `npm start` で実行する前に、`npm run build` でプロジェクトをビルドしてください。

#### Java JRE/JDK

- バージョン 11 以上の JRE/JDK。
- Java のバージョンは、ターミナルで次のコマンドを実行して確認できます。

```shell
java --version
```

- Java がインストールされていない場合は、OpenJDK のディストリビューションである [Corretto](https://docs.aws.amazon.com/corretto/latest/corretto-11-ug/what-is-corretto-11.html) のインストールを検討してください。

#### VeraPDF

- VeraPDF は PDF ファイルのスキャンに使用します。[インストールガイド](https://docs.verapdf.org/install/)に従って VeraPDF をインストールしてください。同ページの自動インストールスクリプトを使い、XML インストールスクリプトの `<installpath>/tmp/verapdf-test</installpath>` を任意の場所に変更することもできます。
- VeraPDF を PATH に追加してから、正しくインストールされたことを確認します。

```shell
# VeraPDF インストーラーを実行する
# Windows では vera-install ではなく vera-install.bat を使用してください
./verapdf-install ./auto-install.xml

# VeraPDF を PATH に追加する。以降は、新しいターミナルを開くたびに次のコマンドを実行する必要があります
export PATH="<location of verapdf>:$PATH"

# verapdf がインストールされたことを確認する
verapdf --version
```

#### 環境変数（任意）
| 変数名 | 説明 | 既定値 |
| ------------- | ----------- | ------- |
| OOBEE_VERBOSE | `true` に設定すると、ログをコンソールに出力します。 | `false` |
| OOBEE_FAST_CRAWLER | `true` に設定すると、スキャンの同時実行数を急速に増やします。試験的な機能で、低スペックのデバイスではシステムが不安定になる場合があります。 | `false` |
| OOBEE_VALIDATE_URL | `true` に設定すると、URL が有効かどうかを確認して終了します。 | `false` |
| OOBEE_LOGS_PATH | 設定すると、このパスにログを書き込みます。 |  |
| WARN_LEVEL | テストでのみ使用します。 |  |
| OOBEE_DISABLE_BROWSER_DOWNLOAD | Chrome/Chromium/Edge でのファイルのダウンロードを無効にする試験的なフラグ。ローカルファイルのスキャンには影響しません。 | |
| OOBEE_SLOWMO | ウェブブラウザーの動作を指定した時間（ミリ秒）だけ遅くする試験的なフラグ。 | |
| OOBEE_TAGGED_WEBSITE | テレメトリーでウェブサイトを識別するためのタグ。CLI フラグ `-z, --websiteTag` でも設定できます（CLI フラグが優先）。 | |
| OOBEE_SCAN_METADATA | テレメトリーに送信する `entryUrl` タグを上書きします。 | |
| OOBEE_LANG | レポート（HTML、PDF、CSV/JSON）、axe-core の問題テキスト、および CLI のヘルプ・メッセージに使用する ISO 639-1 言語（`en`、`ja`）。CLI フラグ `-n, --lang` でも設定できます（CLI フラグが優先）。未設定の場合、レポートは英語になり、CLI のヘルプはターミナル／OS の言語に従います。[CLI の言語](#cli-の言語)を参照してください。 | `en` |
| OOBEE_SCAN_PRODUCT | テレメトリーのイベントに `scanProduct` タグを追加します。 | |
| OOBEE_CONSECUTIVE_MAX_RETRIES | サーキットブレーカーがクロールを中止するまでに許容する、連続した HTTP エラーの最大数。`0` でこのチェックを無効にします。 | `0`（無効） |
| OOBEE_MAX_RATCHET_CYCLES | 完全に回復しないまま同時実行数を半減できる最大回数。超えるとクロールを中止します。`0` でこのチェックを無効にします。 | `0`（無効） |
| OOBEE_MAX_IDLE_MINUTES | ページのスキャンが 1 件も成功しない状態が続いた場合に、クロールを中止してスキャン済みのページから部分的なレポートを生成するまでの最大時間（分）。`0` でこのチェックを無効にします。 | `0`（無効） |
| OOBEE_SAVE_DOM | `1` または `true` に設定すると、スキャンした各ページの DOM 全体の HTML を、デスクトップとモバイルの両方のビューポートで結果ディレクトリに保存します。モバイルのビューポート幅は iPhone 11 のデバイスプロファイルに基づきます。すべてのスキャンタイプ（Website、Sitemap、Intelligent、LocalFile、Custom）で使用できます。 | |
| OOBEE_SAVE_PAGE_SCREENSHOT | `1` または `true` に設定すると、スキャンした各ページのページ全体のスクリーンショットを、デスクトップとモバイルのビューポートで保存します。モバイルのビューポート幅は iPhone 11 のデバイスプロファイルに基づきます。すべてのスキャンタイプ（Website、Sitemap、Intelligent、LocalFile、Custom）で使用できます。 | |
| HTTP_PROXY | HTTP リクエストに使用するプロキシサーバーの URL（例: `http://proxy.example.com:8080`）。 | |
| HTTPS_PROXY | HTTPS リクエストに使用するプロキシサーバーの URL（例: `https://proxy.example.com:8080`）。 | |
| ALL_PROXY | すべてのリクエストに使用するプロキシサーバーの URL。通常は SOCKS5 プロキシに使用します（例: `socks5://proxy.example.com:1080`）。注意: Chrome/Chromium の既知の問題により、socks5 プロキシを指定しても IPv6 の直接接続が続く場合があります（ホスト側で IPv6 を無効にすることを推奨します）。 | |
| NO_PROXY | プロキシを経由しないドメインのカンマ区切りの一覧（例: `localhost,127.0.0.1,.example.com`）。 | |
| INCLUDE_PROXY | 明示的にプロキシを経由させるドメインのカンマ区切りの一覧。 | |
| CF_WORKER_PROXY | **試験的な機能。** WebSocket 上のローカル SOCKS5 トンネル経由で Chromium の通信を中継する Cloudflare Worker の URL（例: `https://your-worker.your-subdomain.workers.dev`）。TLS はエンドツーエンドのまま（MITM なし）で、DNS は Worker 内で解決されます。一部のサイトのブロックを回避できる場合があります。`HTTP_PROXY`/`HTTPS_PROXY`/`ALL_PROXY` より優先されます。参考となる Worker は [examples/cf-worker-proxy.example.js](./examples/cf-worker-proxy.example.js) を参照してください。 | |
| CF_WORKER_PROXY_AUTH_TOKEN | 任意。`CF_WORKER_PROXY` への WebSocket アップグレード時に `Authorization` ヘッダーとして送信します。 | |
| CF_WORKER_PROXY_PORT | 任意。トンネル用のローカル SOCKS5 のバインドポート。 | `8877` |
| FAMILY_DNS | 任意。`1`、`true`、`yes` のいずれかに設定すると、より安全な閲覧のため、ファミリー向けフィルタリングの DNS over HTTPS (DoH) リゾルバーで DNS を解決します。空の値は未設定として扱います。3 つのプロバイダーを順に試し、前のプロバイダーに到達できない場合にのみ次へ切り替えます: [Cloudflare Families](https://blog.cloudflare.com/introducing-1-1-1-1-for-families/)（`family.cloudflare-dns.com`）、[ControlD Family](https://controld.com/free-dns)（`freedns.controld.com/family`）、[AdGuard Family](https://adguard-dns.io/en/public-dns.html)（`family.adguard-dns.com`）。応答したリゾルバーがブロック対象と判定したホスト名は拒否します。切り替えはプロバイダーからまったく応答がない場合にのみ行われるため、後のプロバイダーが前のプロバイダーの判定を弱めることはありません。`HTTP_PROXY`/`HTTPS_PROXY`/`ALL_PROXY` を使用している場合は機能しません。 | |
| CF_FAMILY_DNS | `FAMILY_DNS` の非推奨の別名で、後方互換性のために残しています。`CF_FAMILY_DNS=1` を使う既存の設定はそのまま動作し、同じ 3 プロバイダーの切り替えが適用されます。`FAMILY_DNS` が設定されている場合は無視されるため、`CF_FAMILY_DNS=1` が引き継がれていても `FAMILY_DNS=0` でフィルターを無効にできます。非推奨の通知を一度だけログに出力します。新しい設定では `FAMILY_DNS` を使用してください。 | |
| GOOGLE_SAFE_BROWSING | 設定すると、Google セーフ ブラウジングによる URL 保護を有効にします。フィッシング、マルウェア、望ましくないソフトウェアの URL をブロックし、ブロックされたページはレポートで「Blocked by Safe Browsing」に分類されます。Google Chrome が必要です（Chromium や Edge では使用できません）。macOS と Windows ではシステムの Chrome プロファイルから脅威データベースをコピーします。Docker の Linux では、事前に準備した Chrome インスタンスに接続します。 | |
| OOBEE_DISABLE_TELEMETRY | `1`、`true`、`yes` のいずれかに設定すると、**すべての**テレメトリー送信（Google フォームおよび Sentry）を無効にします。設定時は、個人情報（名前、メールアドレス、開始 URL、userId）が端末の外に送信されることはありません。また `-k user:email` の指定が不要になり、名前とメールアドレスを入力せずに非対話でスキャンを実行できます。 | |
| OOBEE_SSRF_PROTECTION | `1`、`true`、`yes` のいずれかに設定すると、ライブラリ API の `scanCustomFlow` の対象を公開された `http(s)` に限定します（`file://`、localhost、プライベートなホストを拒否）。ローカルやイントラネットのアプリをスキャンできるよう、既定では無効です。**信頼できないユーザーから受け取った URL を `scanCustomFlow` に渡すアプリケーションでは必須です**。設定しないと、そのユーザーがスキャナーに内部のホストやローカルファイルを読み込ませ、その内容をレポートで受け取れてしまいます。 | |
| OOBEE_ALLOW_INSECURE_TLS | `1`、`true`、`yes` のいずれかに設定すると、スキャン対象の無効な証明書や自己署名の TLS 証明書を受け入れます。認証情報（`Authorization` ヘッダー / `httpCredentials`）が付いていない場合にのみ有効です。認証情報付きのスキャンでは、MITM へのトークン漏えいを防ぐため、常に有効な証明書が必要です。 | |
| SB_PREPOPULATED_SHA256 | 事前に用意したセーフ ブラウジング DB の zip に対する、任意の SHA-256 ハッシュ（16 進数）。設定すると、内容がこのハッシュと一致しない zip は拒否されます。ローカルに置かれた古い、または改ざんされたアーカイブによって、セーフ ブラウジングが気付かないうちに無効になるリスクを防ぎます。 | |

#### 内部で使用する環境変数（設定しないでください）
以下の環境変数は設定しないでください。設定すると、予期しない動作になる場合があります。
| 変数名 | 説明 |
| ------------- | ----------- |
| CRAWLEE_LOG_LEVEL | https://crawlee.dev/docs/guides/configuration#crawlee_log_level |
| CRAWLEE_STORAGE_DIR | https://crawlee.dev/docs/guides/configuration#crawlee_storage_dir |
| CRAWLEE_HEADLESS | https://crawlee.dev/docs/guides/configuration#crawlee_headless |

#### 問題が発生した場合

[トラブルシューティング](#トラブルシューティング)を参照してください。

---

## 機能

Oobee は、対象の URL に対して次のようにスキャンを実行できます。

- **ターミナル**で Oobee を**実行**するには、`npm start` を実行します。正しい入力ができるよう、質問が表示されます。
- 結果は JSON 形式でまとめられ、その後 HTML レポートが生成されます。

> 注意: 初回のスキャンでは、使用できるまでに読み込み時間がかかる場合があります。また、より良い体験を提供するため、お名前とメールアドレスの入力を求め、アプリの利用データを収集します。お客様の情報は [GovTech のプライバシーポリシー](https://www.tech.gov.sg/privacy/)に完全に準拠して取り扱われます。

#### 登録情報の削除・変更

> 保存されているお名前とメールアドレスを削除・変更するには、次のコマンドで `userData.txt` を削除してください。

> - Windows（PowerShell）: `rm "$env:APPDATA\Oobee\userData.txt"`
> - macOS（ターミナル）: `rm "$HOME/Library/Application Support/Oobee/userData.txt"`

`userData.txt` が存在しない場合は、そのまま `npm start` を実行してください。

### スキャンの選択

矢印キーで操作できます。対話モード（`npm start`）の質問は英語で表示されます。

```shell
% npm start
┌────────────────────────────────────────────────────────────┐
│  Oobee (ver      )                                   │
│  We recommend using Chrome browser for the best experience.│
│                                                            │
│ Welcome back User!                                       │
│ (Refer to readme.txt on how to change your profile)        │
└────────────────────────────────────────────────────────────┘
? What would you like to scan? (Use arrow keys)
❯ Sitemap
  Website
  Custom
  Intelligent
  Localfile
```

### ヘッドレスモード

ヘッドレスモードでは、スキャンをバックグラウンドで実行できます。スクレイピングの様子を確認したい場合は `n` を入力してください。

```shell
 % npm start
┌────────────────────────────────────────────────────────────┐
│ Oobee (ver      )                                    │
│ We recommend using Chrome browser for the best experience. │
│                                                            │
│ Welcome back User!                                         │
│ (Refer to readme.txt on how to change your profile)        │
└────────────────────────────────────────────────────────────┘
? What would you like to scan? Sitemap
? Do you want oobee to run in the background? (Y/n) No
```

### サイトマップのスキャン

```shell
% npm start
┌────────────────────────────────────────────────────────────┐
│ Oobee (ver      )                                     │
│ We recommend using Chrome browser for the best experience. │
│                                                            │
│ Welcome back User!                                         │
│ (Refer to readme.txt on how to change your profile)        │
└────────────────────────────────────────────────────────────┘
? What would you like to scan? Sitemap
? Do you want oobee to run in the background? No
? Which screen size would you like to scan? (Use arrow keys) Desktop
? Please enter URL or file path to sitemap, or drag and drop a sitemap file here:  https://www.sitemaps.org/sitemap.xml


 Scanning website...


 Fetching URLs. This might take some time...


Scanning website...

#oobee will then start scraping from the file link provided above.
#Console results

```

指定したサイトマップの URL が無効な場合は、有効な値を入力するようエラーメッセージが表示されます。

```shell
>> Invalid sitemap format. Please provide a URL with a valid sitemap.
```

### ウェブサイトのスキャン

```shell
% npm start
┌────────────────────────────────────────────────────────────┐
│ Oobee (ver      )                                    │
│ We recommend using Chrome browser for the best experience. │
│                                                            │
│ Welcome back User!                                         │
│ (Refer to readme.txt on how to change your profile)        │
└────────────────────────────────────────────────────────────┘
? What would you like to scan? Website
? Do you want oobee to run in the background? Yes
? Which screen size would you like to scan? (Use arrow keys) Desktop
? Please enter URL of website:  https://www.domain.org

```

指定したウェブサイトの URL が無効な場合は、有効な値を入力するようエラーメッセージが表示されます。

```shell
>> Cannot resolve URL. Please provide a valid URL.
```

### モバイルデバイスを指定したスキャン

```shell
% npm start
┌────────────────────────────────────────────────────────────┐
│ Oobee (ver      )                                   │
│ We recommend using Chrome browser for the best experience. │
│                                                            │
│ Welcome back User!                                         │
│ (Refer to readme.txt on how to change your profile)        │
└────────────────────────────────────────────────────────────┘
? What would you like to scan? Website
? Do you want oobee to run in the background? No
? Which screen size would you like to scan? (Use arrow keys) (Use arrow keys)
❯ Desktop
  Mobile
  Custom
```

既定のモバイル画面サイズでスキャンするには `Mobile` を、デバイスを選ぶかビューポートの幅を指定するには `Custom` を選択します。

### カスタムフロー

カスタムフローでは、ブラウザーで目的の各ページのスキャンボタンをクリックしてスキャンを開始することで、ユーザージャーニーを指定できます。ユーザーの操作やフォームの入力が必要なウェブサイトのスキャンに便利です。

1. まず、メニューで `Custom` を選択します。

```shell
% npm start
┌────────────────────────────────────────────────────────────┐
│ Oobee (ver      )                                   │
│ We recommend using Chrome browser for the best experience. │
│                                                            │
│ Welcome back User!                                         │
│ (Refer to readme.txt on how to change your profile)        │
└────────────────────────────────────────────────────────────┘
? What would you like to scan?
  Sitemap
  Website
❯ Custom
  Intelligent
  Localfile
```

1. スキャンを開始するページの URL を入力します。
2. Chrome のウィンドウが開きます。ページを移動しながら、ページ右上の **Scan this page** ボタンをクリックすると、表示中のページのアクセシビリティスキャンが実行されます。
3. 上部の黒いバーがページの要素の妨げになる場合は、バーをページの下部へドラッグできます。
4. Chrome のウィンドウを閉じるとスキャンが終了します。

その他のオプション:

- `exclusions.txt` にドメインのパターンを追加すると、アクセシビリティスキャンから除外するサイト（例: ログインページ）を指定できます。`exclusions.txt` の例:

```txt
\.*login.singpass.gov.sg\.*
```

#### 既知の問題

カスタムフローが開始できない場合は、複数のバージョンの Playwright が使われている可能性があります。Playwright を再インストールしてください。

1. Windows では、フォルダー `%USERPROFILE%\AppData\Local\ms-playwright` を削除します（`%USERPROFILE%` は通常 `C:\Users\<username>` です）。
2. macOS では、フォルダー `~/Library/Caches/ms-playwright` を削除します（`~` は `/Users/<username>` です）。
3. PowerShell（Windows）またはターミナル（macOS）で次のコマンドを実行し、Oobee が使用する Playwright を再インストールします。

```Shell
npx playwright install chromium
```

### CLI モード

CLI モードは、継続的インテグレーション（CI）環境での実行を想定しています。
使用できるコマンドラインパラメーターの一覧は `npm run cli` で確認できます。

ターミナルまたは OS の言語が日本語の場合、ヘルプと CLI のメッセージは日本語で表示されます（[CLI の言語](#cli-の言語)を参照）。以下は日本語の出力です。

<!-- cli-help:start -->
```shell
Oobee バージョン: <version>
使い方: npm run cli -- -c <クローラー> -d <デバイス> -w <ビューポート> -u <url>
オプション

オプション:
      --help                         ヘルプを表示                         [真偽]
  -c, --scanner                      スキャンの種類。1)
                                     sitemap（サイトマップ）、2)
                                     website（ウェブサイトのクロール）、3)
                                     custom（カスタムフロー）、4)
                                     intelligent（インテリジェント）、5)
                                     localfile（ローカルファイル）        [必須]
  -u, --url                          スキャンするウェブサイトの URL
                                                                 [文字列] [必須]
  -d, --customDevice                 スキャンに使用するデバイス         [文字列]
  -w, --viewportWidth                スキャンに使用するビューポートの幅（ピクセ
                                     ル）                                 [数値]
  -o, --zip                          結果を保存する zip ファイル名      [文字列]
  -p, --maxpages                     スキャンする最大ページ数（既定:
                                     100）。ウェブサイトおよびサイトマップのスキ
                                     ャンでのみ使用できます               [数値]
  -f, --safeMode                     ページのボタンやリンクを動的にクリックして
                                     リンクを探す処理を無効にします。一部のウェ
                                     ブサイトで発生する問題を回避できます。[yes
                                     / no]           [文字列] [デフォルト: "no"]
  -h, --headless                     ヘッドレスモードでスキャンを実行します。[ye
                                     s / no]        [文字列] [デフォルト: "yes"]
  -b, --browserToRun                 スキャンに使用するブラウザー: 1)
                                     Chromium、2) Chrome、3) Edge。既定は
                                     Windows と macOS では Chrome（Linux では
                                     Chrome がインストールされている場合）、それ
                                     以外は同梱の Chromium です。
  -s, --strategy                     クロールとリダイレクトの範囲を制御します。
                                     既定はすべてのスキャンタイプで
                                     "same-domain" です。サイトマップのスキャン
                                     では、記載されたすべての URL と子サイトマッ
                                     プを対象にします。リモートのサイトマップに
                                     "same-hostname" を指定した場合のみ、開始
                                     URL のホスト名に絞り込みます（www の有無は
                                     同じホストとして扱います）。"ignore"（リモ
                                     ートのサイトマップのスキャンのみ）を指定す
                                     ると、リダイレクトの範囲制限も行いません。
       [選択してください: "same-domain", "same-hostname", "ignore"] [デフォルト:
                                                                  "same-domain"]
  -e, --exportDirectory              スキャン結果を保存するディレクトリ。パスは
                                     ホームディレクトリからの相対パスです。
                                                                        [文字列]
  -j, --customFlowLabel              レポートで見分けやすくするための、カスタム
                                     フロースキャンのラベル             [文字列]
  -k, --nameEmail                    より良い体験を提供するため、お名前、メール
                                     アドレス、アプリの利用データを収集します。
                                     お客様の情報は GovTech
                                     のプライバシーポリシーに完全に準拠して取り
                                     扱われます。お名前とメールアドレスを "John
                                     Doe:john@domain.com" の形式で指定してくださ
                                     い。OOBEE_DISABLE_TELEMETRY=1
                                     を設定している場合は省略できます。
                                                                 [文字列] [必須]
  -t, --specifiedMaxConcurrency      同時にスキャンする最大ページ数。アクセス制
                                     限（スロットリング）のあるサイトで使用しま
                                     す。既定は CPU 数の 3 倍（最小 2、最大
                                     25）です。                           [数値]
  -i, --fileTypes                    スキャンに含めるファイルの種類。既定は
                                     html-only です。
        [文字列] [選択してください: "all", "pdf-only", "html-only"] [デフォルト:
                                                                    "html-only"]
  -x, --blacklistedPatternsFilename  アクセシビリティスキャンから除外するドメイ
                                     ンのパターンを、1 行に 1 つずつ記載した txt
                                     ファイル                           [文字列]
  -a, --additional                   レポートに含める追加機能:
                                     screenshots - 生成されるレポートに要素のス
                                     クリーンショットを含める
                                     none -
                                     生成されるレポートに追加機能を一切含めない
  [文字列] [選択してください: "screenshots", "none"] [デフォルト: "screenshots"]
  -q, --metadata                     テレメトリー用の追加のスキャンメタデータを
                                     含む JSON 文字列。既定は "{}" です
                                                     [文字列] [デフォルト: "{}"]
  -r, --followRobots                 robots.txt が存在する場合、クローラーはその
                                     ルールに従います。[yes / no]
                                                     [文字列] [デフォルト: "no"]
  -m, --header                       アクセスが制限されたリソースにクローラーが
                                     アクセスできるようにするための、HTTP
                                     認証ヘッダーのキーと値。           [文字列]
  -y, --ruleset                      アクセシビリティチェックに使用するスキャン
                                     のルールセットを指定します
      [文字列] [選択してください: "default", "disable-oobee", "enable-wcag-aaa",
                        "disable-oobee,enable-wcag-aaa"] [デフォルト: "default"]
  -g, --generateJsonFiles            アクセシビリティスキャンの結果を含む、gzi
                                     p 圧縮および base64 エンコードされた JSON
                                     ファイルを 2 つ生成します:

                                     1. scanData.json.gz.b64:
                                     スキャンの概要。以下を含みます:
                                     - WCAG 適合スコア
                                     - 違反している WCAG 達成基準
                                     - メタデータ（スキャンの開始時刻・終了時
                                     刻など）
                                     - スキャンしたページとスキップしたページ
                                     2. scanItems.json.gz.b64: 検出されたアク
                                     セシビリティの問題の詳細。以下を含みます:
                                     - 重大度
                                     - 問題の説明
                                     - 関連する WCAG ガイドライン
                                     - WCAG 達成基準に違反したページの URL
                                     詳細な分析や外部のレポートツールとの連携
                                     に役立ちます。

                                     JSON ファイルを取り出すには、ファイルを
                                     base64 デコードしてから gunzip
                                     で展開します。例:

                                     (macOS) base64 -D -i scanData.json.gz.b64
                                     | gunzip > scanData.json

                                     (linux) base64 -d scanData.json.gz.b64 |
                                     gunzip > scanData.json

                                                     [文字列] [デフォルト: "no"]
  -l, --scanDuration                 スキャンの最大実行時間（秒）。0
                                     は無制限です         [数値] [デフォルト: 0]
  -n, --lang                         レポートおよび axe-core
                                     の問題テキストに使用する ISO 639-1
                                     言語コード（例: en、ja）。既定は環境変数
                                     OOBEE_LANG、未設定の場合は en
                                     です。このヘルプと CLI
                                     メッセージの言語も切り替わります（指定しな
                                     い場合はターミナル／OS の言語に従います）。
                                                                        [文字列]
  -z, --websiteTag                   テレメトリーでウェブサイトを識別するための
                                     タグ。環境変数 OOBEE_TAGGED_WEBSITE
                                     より優先されます。                 [文字列]

例:
  ウェブサイトのサイトマップをスキャンする:
    npm run cli -- -c [ 1 | sitemap ] -u <url_link> \
      [ -d <device> | -w <viewport_width> ]
  ウェブサイトをスキャンする:
    npm run cli -- -c [ 2 | website ] -u <url_link> \
      [ -d <device> | -w <viewport_width> ]
  カスタムフロースキャンを開始する:
    npm run cli -- -c [ 3 | custom ] -u <url_link> \
      [ -d <device> | -w <viewport_width> ]
```
<!-- cli-help:end -->

#### CLI の言語

`npm run cli -- --help` と CLI の検証メッセージは、英語または日本語で表示されます。言語は次の順序で決まります。

1. `-n, --lang`（例: `--lang ja`、`--lang en`）。
2. 環境変数 `OOBEE_LANG`。
3. ターミナルのロケール: `LC_ALL`、`LC_MESSAGES`、`LANG`、`LANGUAGE` の順（macOS / Linux のシェル、および Windows の Git Bash / WSL）。`C` と `POSIX` は未設定として扱います。
4. OS のロケール。Windows では **設定 → 時刻と言語 → 言語と地域 → 地域設定**（例:「日本語 (日本)」）です。Windows の表示言語は使用されません。macOS では、`LANG` が未設定の場合にシステムの言語・地域が使われます。

それ以外の言語の場合は英語になります。`-n` / `OOBEE_LANG` はレポート（HTML、PDF、CSV/JSON、axe-core の問題テキスト）の言語も切り替えます。レポートの言語はターミナルからは**自動判定されません**。既存の CI パイプラインが英語のレポートを出力し続けるよう、日本語のレポートが必要な場合は `--lang ja` を指定するか `OOBEE_LANG=ja` を設定してください。

| プラットフォーム | ヘルプとメッセージを日本語にする | レポートを日本語にする |
| --- | --- | --- |
| macOS / Linux | `export LANG=ja_JP.UTF-8`（`LANG` が未設定の場合は、システムの言語を日本語にする） | `--lang ja` を指定するか `export OOBEE_LANG=ja` |
| Windows（PowerShell / cmd） | 地域設定を「日本語 (日本)」にするか `$env:OOBEE_LANG="ja"` | `--lang ja` を指定するか `$env:OOBEE_LANG="ja"` |

### Basic 認証

HTTP Basic 認証で保護されたサイトでは、次の 2 つの方法で認証情報を指定できます。

1. **URL に含める**: `npm run cli -- -u 'https://user:password@example.com' -c 3`
2. **`-m` フラグを使う**: `npm run cli -- -u 'https://example.com' -c 3 -m "Authorization Basic dXNlcjpwYXNzd29yZA=="`

どちらの方法も、すべてのスキャンタイプ（サイトマップ、ウェブサイト、カスタムフロー）で使用できます。複数のヘッダーを指定するには、`, ` で区切ります。
```
-m "Authorization Basic dXNlcjpwYXNz, X-Custom-Header myvalue"
```

> **注意:** クロスオリジンのリソース（CDN のフォント、分析スクリプトなど）で CORS のプリフライトが失敗しないよう、Authorization ヘッダーは同一オリジンのリクエストにのみ送信されます。

### Windows PowerShell に関する注意
PowerShell では引数の解釈が異なるため、コマンドは `npm run cli -- --`（`--` をもう 1 つ追加）として実行する必要があります。

### デバイスのオプション

<details>
  <summary>対応しているデバイスの一覧を表示するにはクリックしてください</summary>

- "Desktop" (defaults to a 1280x720 viewport)
- "Mobile" (defaults to iPhone 11 viewport)
- "Desktop Chrome HiDPI"
- "Desktop Edge HiDPI"
- "Desktop Firefox HiDPI"
- "Desktop Safari"
- "Desktop Chrome"
- "Desktop Edge"
- "Desktop Firefox"
- "Blackberry PlayBook"
- "Blackberry PlayBook landscape"
- "BlackBerry Z30"
- "BlackBerry Z30 landscape"
- "Galaxy Note 3"
- "Galaxy Note 3 landscape"
- "Galaxy Note II"
- "Galaxy Note II landscape"
- "Galaxy S III"
- "Galaxy S III landscape"
- "Galaxy S5"
- "Galaxy S5 landscape"
- "Galaxy S8"
- "Galaxy S8 landscape"
- "Galaxy S9+"
- "Galaxy S9+ landscape"
- "Galaxy Tab S4"
- "Galaxy Tab S4 landscape"
- "iPad (gen 6)"
- "iPad (gen 6) landscape"
- "iPad (gen 7)"
- "iPad (gen 7) landscape"
- "iPad Mini"
- "iPad Mini landscape"
- "iPad Pro 11"
- "iPad Pro 11 landscape"
- "iPhone 6"
- "iPhone 6 landscape"
- "iPhone 6 Plus"
- "iPhone 6 Plus landscape"
- "iPhone 7"
- "iPhone 7 landscape"
- "iPhone 7 Plus"
- "iPhone 7 Plus landscape"
- "iPhone 8"
- "iPhone 8 landscape"
- "iPhone 8 Plus"
- "iPhone 8 Plus landscape"
- "iPhone SE"
- "iPhone SE landscape"
- "iPhone X"
- "iPhone X landscape"
- "iPhone XR"
- "iPhone XR landscape"
- "iPhone 11"
- "iPhone 11 landscape"
- "iPhone 11 Pro"
- "iPhone 11 Pro landscape"
- "iPhone 11 Pro Max"
- "iPhone 11 Pro Max landscape"
- "iPhone 12"
- "iPhone 12 landscape"
- "iPhone 12 Pro"
- "iPhone 12 Pro landscape"
- "iPhone 12 Pro Max"
- "iPhone 12 Pro Max landscape"
- "iPhone 12 Mini"
- "iPhone 12 Mini landscape"
- "iPhone 13"
- "iPhone 13 landscape"
- "iPhone 13 Pro"
- "iPhone 13 Pro landscape"
- "iPhone 13 Pro Max"
- "iPhone 13 Pro Max landscape"
- "iPhone 13 Mini"
- "iPhone 13 Mini landscape"
- "Kindle Fire HDX"
- "Kindle Fire HDX landscape"
- "LG Optimus L70"
- "LG Optimus L70 landscape"
- "Microsoft Lumia 550"
- "Microsoft Lumia 550 landscape"
- "Microsoft Lumia 950"
- "Microsoft Lumia 950 landscape"
- "Nexus 10"
- "Nexus 10 landscape"
- "Nexus 4"
- "Nexus 4 landscape"
- "Nexus 5"
- "Nexus 5 landscape"
- "Nexus 5X"
- "Nexus 5X landscape"
- "Nexus 6"
- "Nexus 6 landscape"
- "Nexus 6P"
- "Nexus 6P landscape"
- "Nexus 7"
- "Nexus 7 landscape"
- "Nokia Lumia 520"
- "Nokia Lumia 520 landscape"
- "Nokia N9"
- "Nokia N9 landscape"
- "Pixel 2"
- "Pixel 2 landscape"
- "Pixel 2 XL"
- "Pixel 2 XL landscape"
- "Pixel 3"
- "Pixel 3 landscape"
- "Pixel 4"
- "Pixel 4 landscape"
- "Pixel 4a (5G)"
- "Pixel 4a (5G) landscape"
- "Pixel 5"
- "Pixel 5 landscape"
- "Moto G4"
- "Moto G4 landscape"

</details>

デバイス名に `(` と `)` が含まれる場合は、CLI に入力する際にデバイス名をシングルクォートで囲んでください。
なお、`-d` と `-w` は同時に指定できません。どちらも指定しない場合、CLI でのスキャンには既定でデスクトップが使用されます。

例えば、URL「http://localhost:8000」を 'iPad (gen 7) landscape' の画面でウェブサイトスキャンし、結果を「oobee-scan-results.zip」に保存するには、次のコマンドを実行します。

```shell
npm run cli -- -c 2 -o oobee-scan-results.zip -u http://localhost:8000 -d 'iPad (gen 7) landscape'
```

スキャンするサイトの URL にクエリ文字列が含まれる場合は、CLI に入力する際にリンクをシングルクォートで囲んでください。

例えば、URL「http://localhost:8000」を幅 '360' のカスタム画面でウェブサイトスキャンし、結果を「oobee-scan-results.zip」に保存するには、次のコマンドを実行します。

```shell
npm run cli -- -c 2 -o oobee-scan-results.zip -u "http://localhost:8000" -w 360
```

## レポート

サイトのスキャンが完了すると、

レポートが現在の作業ディレクトリにダウンロードされます。

## アクセシビリティスキャンの結果

各問題には、[WCAG 2.2 への適合](https://www.w3.org/TR/WCAG22/)に基づく重大度「Must Fix（必ず修正）」/「Good to Fix（修正推奨）」が付きます。

どのスキャン結果が「Must Fix」/「Good to Fix」に該当するかについては、[Scan Issue Details](./DETAILS.md)（英語）を参照してください。

## トラブルシューティング

デバッグの参考として、以下の情報を参照してください。以下のエラーの多くは、Node.js のバージョンを切り替えたことが原因です。

### URL 検証エラー
スキャンのトラブルシューティングのため、次の URL およびファイルの検証エラーコードが用意されています。エラーメッセージは CLI に表示される英語のままです。

| コード | エラー名 | エラーメッセージ | 対処方法 |
|------|----------------------|-------------------------------------------------------------------------------|------------------------|
| 0    | success              | (undefined) | 対処は不要です。接続に成功しています。 |
| 11   | invalidUrl           | Invalid URL. Please check and try again. | • URL が `http://` または `https://` で始まっていることを確認します。<br>• URL に誤字がないか確認します。 |
| 12   | cannotBeResolved     | URL cannot be accessed. Please verify whether the website exists. | • ドメイン名が正しいことを確認します。<br>• `ping` や `nslookup` で DNS の名前解決を確認します。<br>• サイトが公開されていること（VPN やファイアウォールの内側でないこと）を確認します。 |
| 14   | systemError          | Something went wrong when verifying the URL. Please try again in a few minutes. If this issue persists, please contact the Oobee team. | • 数分後に再試行します。<br>• インターネット接続を確認します。<br>• 解決しない場合は、システムの問題として報告します。 |
| 15   | notASitemap          | Invalid sitemap URL format. Please enter a valid sitemap URL ending with .XML or .TXT e.g. https://www.example.com/sitemap.xml. | • URL が有効な XML サイトマップを指していることを確認します。<br>• [サイトマップの例（sitemaps.org - Protocol）](https://www.sitemaps.org/protocol.html)を参照します。<br>• ブラウザーで URL を開き、XML が返されることを確認します。 |
| 16   | unauthorised         | Login required. Please enter your credentials and try again. | • サイトにユーザー名とパスワードが必要か確認します。<br>• 対応している場合は、Oobee で認証情報を指定します。 |
| 17   | browserError         | Incompatible browser. Please ensure you are using Chrome or Edge browser. | • 最新版の Chrome または Edge をインストールします。 |
| 18   | sslProtocolError     | SSL certificate  error. Please check the SSL configuration of your website and try again. | • SSL 証明書が有効であること（期限切れでなく、信頼された CA が発行していること）を確認します。<br>• TLS のバージョンや暗号スイートの不一致がないか確認します。<br>• SSL チェックツール（例: Qualys SSL Labs）を使用します。 |
| 19   | notALocalFile        | Uploaded file format is incorrect. Please upload a HTML, PDF, XML or TXT file. | • ファイル形式を確認します。<br>• `.html`、`.pdf`、`.xml`、`.txt` のいずれかを選択していることを確認します。 |
| 20   | notAPdf              | URL/file format is incorrect. Please upload a PDF file. | • ファイルの拡張子が `.pdf` であることを確認します。<br>• ファイルを開き、有効な PDF であることを確認します。 |
| 21   | notASupportedDocument| Uploaded file format is incorrect. Please upload a HTML, PDF, XML or TXT file. | • ファイル形式を確認します。<br>• 必要に応じて、対応している形式に変換します。 |
| 22   | connectionRefused    | Connection refused. Please try again in a few minutes. If this issue persists, please contact the Oobee team. | • サーバーが稼働しているか確認します。<br>• ファイアウォールの設定を確認します。<br>• 少し時間をおいて再試行します。 |
| 23   | timedOut             | Request timed out. Please try again in a few minutes. If this issue persists, please contact the Oobee team. | • インターネットの速度と安定性を確認します。<br>• サーバーの負荷が低いときに再試行します。 |

### 互換性のない Node.js のバージョン

**問題**: Node.js のバージョンに互換性がない場合、次のような構文エラーが発生することがあります。

```shell
const URL_NO_COMMAS_REGEX = RegExp('https?://(www\\.)?[\\p{L}0-9][-\\p{L}0-9@:%._\\+~#=]{0,254}[\\p{L}0-9]\\.[a-z]{2,63}(:\\d{1,5})?(/[-\\p{L}0-9@:%_\\+.~#?&//=\\(\\)]*)?', 'giu'); // eslint-disable-line
                            ^
SyntaxError: Invalid regular expression: /https?://(www\.)?[\p{L}0-9][-\p{L}0-9@:%\._\+~#=]{0,254}[\p{L}0-9]\.[a-z]{2,63}(:\d{1,5})?(/[-\p{L}0-9@:%_\+.~#?&//=\(\)]*)?/: Invalid escape
```

**解決方法**: Node.js 22.15 以上（Node 22 LTS または 24 LTS）をインストールしてください。

### 別の Node.js バージョンでコンパイルされたモジュール

**問題**: 環境内で Node.js のバージョンを切り替えると、次のエラーが発生することがあります。

```shell
<user_path>/oobee/node_modules/bindings/bindings.js:91
        throw e
        ^

Error: The module '<module_file_path>'
was compiled against a different Node.js version using
NODE_MODULE_VERSION 57. This version of Node.js requires
NODE_MODULE_VERSION 88. Please try re-compiling or re-installing
the module (for instance, using `npm rebuild` or `npm install`).
```

**解決方法**: エラーメッセージの指示に従い、`npm rebuild` または `npm install` を実行してください。

### Oobee がエラーを表示せずに終了する

**問題**: 次のように、Oobee がスキャンを開始しません。

```shell
> @govtechsg/oobee@0.11.23 cli
> node --use-system-ca --max-old-space-size=10000 dist/cli.js -c -u https://example.com
```

**解決方法**:

1. 既存の `node_modules` フォルダーを削除し、`npm install` で npm パッケージを再インストールします。

2. スキャン中に表示されるエラーを増やすため、Oobee の詳細（Verbose）モードを設定します。
#### macOS の場合:
```
export OOBEE_VERBOSE=1
```
#### Windows の場合:
```
$env:OOBEE_VERBOSE=1
```

3. スキャンを再実行し、問題が解決したか確認します。

4. エラーログを取得します。エラーログは `<uuid>.txt` に書き込まれるログファイルにあります。
```
{"timestamp":"2025-09-26 11:13:57","level":"info","message":"Logger writing to: /Users/.../Oobee/...txt"}
```

5. [Issue](https://github.com/GovTechSG/oobee/issues) を作成してください。問題が発生するまでの手順を記載し、エラーログを貼り付けてください。


### 要素のスクリーンショットの制限

**制限事項**: Axe のスキャン後にアニメーションによって要素がビューポートの外へ移動すると、要素が見つからず、要素のスクリーンショットが 5 秒でタイムアウトする可能性があります。この既知の問題は、一定間隔で切り替わるカルーセルなどで特に発生しやすくなります。

## よくある質問

### スキャンするページ数を制限するには？

ウェブサイトが大きくスキャンに時間がかかりすぎる場合や、サイトマップ内のページが多すぎる場合は、スキャンするページ数を制限できます。

CLI モード（`npm run cli --`）で必要な設定とともに `-p 10` を指定してください。`10` はスキャンしたいページ数です。

### 開発を始めたばかりで、知識が足りない部分があります。

各コンポーネントの役割を理解するため、まず**技術スタック**を確認することをお勧めします。時間をかけて理解してください。

## データに関する追加情報

Oobee は、インストール時にインターネット経由でダウンロードされる場合があるサードパーティのオープンソースツールを使用しています。使用しているライブラリは `package.json` で確認できます。

Oobee は、ユーザーがスキャンを開始したウェブサイトまたは URL に情報を送信する場合があります。利用状況をより良く把握する目的で、メールアドレス、氏名、基本的な分析データなど、限られたユーザー情報を収集します。

## 開発・テスト用ヘルパー

Oobee の開発者向けの便利なヘルパーです。
### HTML の再生成
EJS（HTML、CSS、JS）を編集する際は、次のヘルパースクリプトで変更を確認できます。結果ディレクトリに新しいレポートを得るためにスキャン全体を実行する必要はありません。

既存のレポートの *.json ファイルを、埋め込み HTML のデータセットとして使用します。

```
npx tsx dev/runGenerateJustHtmlReport.ts results/<report directory>
```

### README の CLI ヘルプの更新
`README.md`（英語）と `README.ja.md`（日本語）の CLI ヘルプは、ビルドした CLI から生成しています。CLI のオプションや `src/i18n/locales/*/cli.json` を変更したら、次のコマンドで再生成してください。

```
npm run build && node scripts/updateReadmeCliHelp.mjs
```

`node scripts/updateReadmeCliHelp.mjs --check` は、どちらかのブロックが古い場合にエラーで終了します。
