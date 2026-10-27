## Oobee とエンドツーエンドテストフレームワークの連携

[English](./INTEGRATION.md) | **日本語**

> この日本語版は英語版 [INTEGRATION.md](./INTEGRATION.md) の翻訳です。内容に差異がある場合は英語版が優先されます。

Oobee は、[Cypress](https://www.cypress.io/) や [Playwright](https://playwright.dev/) などのエンドツーエンドテストフレームワークと連携するための機能を提供しています。

### 前提条件

この機能を使用するには、テストフレームワークが次をサポートしている必要があります。

- NodeJS 環境でのスクリプトの実行。
- テスト対象のドキュメントへの JavaScript の挿入。
- ドキュメントのコンテキストでの JavaScript の実行と、実行結果の NodeJS 環境への受け渡し。

### プロジェクトに Oobee を追加する方法

1. 次のコマンドを実行して、プロジェクトに Oobee を追加します。

   `npm install --save-dev @govtechsg/oobee`

2. 使用するファイルで、次のように Oobee をインポートします。

   `import oobeeA11yInit from '@govtechsg/oobee'`

   Oobee は NodeJS 環境で実行されるスクリプトでインポートしてください。

3. 次のようにして Oobee のインスタンスを作成します。

   `const oobeeA11y = await oobeeA11yInit({ entryUrl, testLabel, name, email })`

   `entryUrl` には、Oobee でスキャンするウェブサイトのドメインを指す有効な URL を指定してください。

### API リファレンス

#### `async oobeeA11yInit({entryUrl, testLabel, name, email, includeScreenshots, viewportSettings, thresholds, scanAboutMetadata, zip, deviceChosen, strategy, ruleset, specifiedMaxConcurrency, followRobots, htmlMaxBytes, parentHtmlDepth, parentHtmlMaxBytes, lang})`

Oobee のインスタンスを返します。

##### パラメーター

- `entryUrl`
  - Oobee のスキャンを開始する最初の URL
- `testLabel`
  - レポートに表示するテストのラベル
- `name`
  - Oobee のデータ収集のため
- `email`
  - Oobee のデータ収集のため
- `includeScreenshots`（任意）
  - 影響を受ける要素のスクリーンショットをレポートに含めます。既定は false です。
- `viewportSettings`（任意）
  - スクリーンショット機能の最適化に必要な、Cypress のテストで使用するビューポートの設定。既定は Cypress の既定のビューポート設定です。例: `{ width: 1000, height: 660 }`
- `thresholds`（任意）
  - テストを失敗とするためのエラーを発生させるまでの、mustFix または goodToFix の問題の最大発生数を含むオブジェクト。既定ではテストを失敗にしません。例: `{ mustFix: 1, goodToFix: 3 }`
- `scanAboutMetadata`（任意）
  - JSON オブジェクトを渡すと、レポートの「Scan About」セクションに追加情報を含めます。
- `zip`（任意）
  - スキャン終了時に生成される Oobee の結果の zip ファイル名。既定は "oobee-scan-results" です。
- `deviceChosen`（任意）
  - スキャンに使用するデバイス名。例: `iPhone 13 Pro Max`
- `strategy`（任意）
  - 使用する EnqueueStrategy。選択肢: `all`、`same-hostname`、`same-domain`、`same-origin`。既定は `all` です。
- `ruleset`（任意）
  - 使用するルールセットの配列。選択肢: `default`、`disable-oobee`、`enable-wcag-aaa`。既定は `['default']` です。
- `specifiedMaxConcurrency`（任意）
  - レポートのスキャン設定に表示されます。`1` を指定すると低速スキャンモードとして表示されます。既定は 25 です。
- `followRobots`（任意）
  - robots.txt に従うかどうか。既定は false です。
- `htmlMaxBytes`（任意）
  - レポートに保存する各要素の HTML スニペットの最大サイズ（バイト）。`OOBEE_HTML_MAX_BYTES` を設定します。既定は 1024 です。`0` を指定すると HTML 全体を保持します。
- `parentHtmlDepth`（任意）
  - 影響を受ける各要素の周囲（文脈）として取得する、祖先要素の HTML の階層数。`OOBEE_PARENT_HTML_DEPTH` を設定します。既定は 0（無効）です。
- `parentHtmlMaxBytes`（任意）
  - 取得する祖先要素の HTML の最大サイズ（バイト）。`OOBEE_PARENT_HTML_MAX_BYTES` を設定します。既定は `htmlMaxBytes` と同じです。
- `lang`（任意）
  - レポートと axe-core の問題テキストに使用する ISO 639-1 言語: `en` または `ja`。既定は `OOBEE_LANG`、未設定の場合は `en` です。

#### Oobee のインスタンス

##### プロパティ

`scanDetails`

スキャンの詳細を含むオブジェクト

- 例: `{
  startTime: 1700104789495,
  crawlType: 'Customized',
  requestUrl: 'https://govtechsg.github.io',
  urlsCrawled: { } 
}`

`randomToken`

スキャンのインスタンスを一意に識別する ID

##### メソッド

`getAxeScript()`

ブラウザーに挿入する axe-core エンジンを取得します。

`getOobeeFunctions()`

アクセシビリティスキャンを実行するための Oobee のカスタム関数を取得します。`getAxeScript()` の後に呼び出してください。

- `runA11yScan(elementsToScan, gradingReadabilityFlag)`
  現在のページで axe のスキャンを実行します。

  パラメーター:

  - `elementsToScan`: テスト対象とする要素と、対象外とする要素を指定します
  - `gradingReadabilityFlag`: 文字列で表した読みやすさのスコア。空でない場合、読みやすさの違反が追加されます。

  戻り値:

  - 現在のページの URL、現在のページのタイトル、axe のスキャン結果からなるオブジェクト。`{ pageUrl, pageTitle, axeScanResults }`

`async pushScanResults(res, metadata, elementsToClick, page, disableScreenshots)`

スキャン結果を処理し、レポートに含めます。

パラメーター:

- `res`: 現在のページの URL、現在のページのタイトル、axe のスキャン結果からなるオブジェクト。` {pageUrl, pageTitle, axeScanResults}`
- `metadata`（任意）: 保存する追加の文字列情報。同じページの異なる状態を区別するのに便利です。注意: この機能は現在、レポートの HTML には実装されていません。
- `elementsToClick`（任意）: スクリーンショットを撮る前に、隠れている要素（モーダルやメニューなど）を表示するためにクリックする CSS セレクターの一覧。Oobee がスクリーンショット用に独自のブラウザーを起動する場合（`page` を指定せず、`disableScreenshots` が false の場合）にのみ使用されます。状態を再現することで、違反している要素を正しくスクリーンショットに収められます。
- `page`（任意）: Playwright の Page オブジェクト。指定すると、影響を受ける要素のスクリーンショットに既存のページを再利用します。
- `disableScreenshots`（任意）: スクリーンショットの取得を無効にする真偽値。Cypress のように、ブラウザーのコンテキストを Node.js と共有しにくいツールと連携する場合に便利です。

戻り値:

- 今回のスキャンでの mustFix と goodToFix の問題の発生数を含むオブジェクト。例: `{ mustFix: 1, goodToFix: 5 }`

`gradeReadability(sentences)`

ページから抽出したテキスト（例: `@govtechsg/oobee/dist/crawlers/custom/extractText.js` の `extractText()`）の読みやすさを評価します。読みやすさのスコアを文字列で返します。テキストが読みやすい場合や文が渡されなかった場合は空文字列を返します。戻り値は `gradingReadabilityFlag` として `runA11yScan()` に渡してください。

`testThresholds()`

累積した問題の発生数を、指定したしきい値と比較します。

- mustFix または goodToFix の累積発生数がいずれかのしきい値を超えると、oobeeA11y のインスタンスを終了してエラーを発生させます。

`async terminate()`

Oobee のインスタンスを停止し、スキャンのレポートとその他の結果ファイルを生成します。結果を含む生成済みフォルダーの名前を返します。

### 使い方

Cypress と Playwright での使用例は[こちらのセクション](#使用例)にあります。

Oobee のインスタンスを `oobeeA11y` とした場合:

1. `oobeeA11y.getAxeScript()` と `oobeeA11y.getOobeeFunctions()` を順に実行し、スキャン対象のドキュメントに挿入するスクリプトを取得します。それぞれスクリプトを文字列で返します。
2. スキャン対象のドキュメントにスクリプトを挿入します。最も簡単な方法は、ドキュメントの環境で `eval()` を使うことです。
   - この手順は、訪問するページごとに行う必要があります。
3. ドキュメントの環境で `runA11yScan()` を実行して、スキャンを行います。
   - 既定では、ページ全体をスキャンします。
   - ページ内の特定のセクションや要素だけをスキャンすることもできます。その方法の 1 つは、スキャンする要素の CSS セレクターの配列を `runA11yScan` に渡すことです。例: `runA11yScan(['#my-component', 'button'])`。その他の引数の形式は[こちら](https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#context-parameter)を参照してください。
4. スキャン結果を、`oobeeA11y` がある NodeJS 環境に渡します。
5. `await oobeeA11y.pushScanResults(scanResults)` で結果を登録します。
   - Playwright では、4 番目の引数に `page` オブジェクトを渡してください: `await oobeeA11y.pushScanResults(scanResults, undefined, undefined, page)`。既存のブラウザーをスクリーンショットに再利用するため、処理が速くなります。
   - Cypress では、スクリーンショット用に別のブラウザーが起動しないよう、スクリーンショットを自分で取得し、`disableScreenshots` を `true` に設定する必要があります。実装の詳細は、同梱の Cypress の例を参照してください。
6. 手順 2〜5 を必要な回数だけ繰り返します。
7. `await oobeeA11y.terminate()` で Oobee を終了します。プロジェクトのルートディレクトリにある `results` ディレクトリに、スキャンの詳細とレポートを含むフォルダーが作成されます。

### 使用例

#### Cypress

<details>
<summary>E2E Cypress テスト（JavaScript）での使用例を表示するにはクリックしてください</summary>

デモ用の Cypress プロジェクトに、次のファイルを作成します。

```
    ├── cypress
    │   ├── e2e
    │   │   └── spec.cy.js
    │   └── support
    │       └── e2e.js
    ├── cypress.config.js
    └── package.json

```

`./examples/oobee-cypress-integration-js` にある例をフォルダーにコピーし、そのフォルダーを作業ディレクトリにします。

`npm install` で依存パッケージをインストールします。

<code>node_modules/@govtechsg/oobee</code> に移動し、フォルダー内で <code>npm install</code> と <code>npm run build</code> を実行して、残りの Oobee の依存パッケージをインストールします。

```
    cd node_modules/@govtechsg/oobee
    npm install
    npm run build
    cd ../../..
```

<code>npx cypress run</code> でテストを実行します。

<code>results</code> フォルダーに Oobee の結果が生成されます。

</details>

<details>
   <summary>E2E Cypress テスト（TypeScript）での使用例を表示するにはクリックしてください</summary>

デモ用の Cypress プロジェクトに、次のファイルを作成します。

```
    ├── cypress.config.ts
    ├── cypress.d.ts
    ├── package.json
    ├── src
    │   └── cypress
    │       ├── e2e
    │       │   └── spec.cy.ts
    │       └── support
    │           └── e2e.ts
    └── tsconfig.json

```

`./examples/oobee-cypress-integration-ts` にある例をフォルダーにコピーし、そのフォルダーを作業ディレクトリにします。

`npm install` で依存パッケージをインストールします。

<code>node_modules/@govtechsg/oobee</code> に移動し、フォルダー内で <code>npm install</code> と <code>npm run build</code> を実行して、残りの Oobee の依存パッケージをインストールします。

```
    cd node_modules/@govtechsg/oobee
    npm install
    npm run build
    cd ../../..
```

<code>npx tsc</code> で TypeScript のコードをコンパイルします。  
<code>npx cypress run</code> でテストを実行します。

<code>results</code> フォルダーに Oobee の結果が生成されます。

</details>

#### Playwright

<details>
    <summary>Playwright（JavaScript）での使用例を表示するにはクリックしてください</summary>

`./examples/oobee-playwright-integration-js` にある例をフォルダーにコピーし、そのフォルダーを作業ディレクトリにします。

`npm install` で依存パッケージをインストールします。

<code>npx playwright install chromium</code> を実行して、Playwright の Chromium をインストールします。

<code>node_modules/@govtechsg/oobee</code> に移動し、フォルダー内で <code>npm install</code> と <code>npm run build</code> を実行して、残りの Oobee の依存パッケージをインストールします。

```
    cd node_modules/@govtechsg/oobee
    npm install
    npm run build
    cd ../../..
```

`node oobee-playwright-demo.js` でテストを実行します。

results フォルダーに Oobee の結果が生成されます。

</details>

<details>
    <summary>Playwright（TypeScript）での使用例を表示するにはクリックしてください</summary>

`./examples/oobee-playwright-integration-ts` にある例をフォルダーにコピーし、そのフォルダーを作業ディレクトリにします。

`npm install` で依存パッケージをインストールします。

<code>npx playwright install chromium</code> を実行して、Playwright の Chromium をインストールします。

<code>node_modules/@govtechsg/oobee</code> に移動し、フォルダー内で <code>npm install</code> と <code>npm run build</code> を実行して、残りの Oobee の依存パッケージをインストールします。

```
    cd node_modules/@govtechsg/oobee
    npm install
    npm run build
    cd ../../..
```

<code>npx tsc</code> で TypeScript のコードをコンパイルします。

<code>npm test</code> でテストを実行します。

<code>results</code> フォルダーに Oobee の結果が生成されます。

</details>

#### ウェブクローラーのログインの自動化

<details>
    <summary>ウェブクローラーのログインを自動化する例（JavaScript）を表示するにはクリックしてください</summary>
<code>automated-web-crawler-login.js</code>:
   
    import { chromium } from 'playwright';
    import { exec } from 'child_process';

    const loginAndCaptureHeaders = async (url, email, password) => {
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();

        await page.goto(url);
        await page.fill('input[name="email"]', email);
        await page.fill('input[name="password"]', password);

        const [response] = await Promise.all([
            page.waitForNavigation(),
            page.click('input[type="submit"]'),
        ]);

        // Format cookie retrieved from page
        const formatCookies = cookies => {
            return cookies.map(cookie => `cookie ${cookie.name}=${cookie.value}`).join('; ');
        };

        // Retrieve cookies after login
        let cookies = await page.context().cookies();
        const formattedCookies = formatCookies(cookies);

        // Close browser
        await browser.close();

        return formattedCookies;
    };

    const runOobeeA11yScan = command => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error: ${error.message}`);
                return;
            }
            if (stderr) {
                console.error(stderr);
            }
            console.log(stdout);
        });
    };

    const runScript = () => {
        loginAndCaptureHeaders(
            // Test example with authenticationtest.com
            'https://authenticationtest.com/simpleFormAuth/',
            'simpleForm@authenticationtest.com',
            'pa$w0rd',
        )
            .then(formattedCookies => {
                console.log('Cookies retrieved.\n');
                // where -m "..." are the headers needed in the format "header1 value1, header2 value2" etc
                // where -u ".../loginSuccess/" is the destination page after login
                const command = `npm run cli -- -c website -u "https://authenticationtest.com/loginSuccess/" -p 1 -k "Your Name:email@domain.com" -m "${formattedCookies}"`;
                console.log(`Executing OobeeA11y scan command:\n> ${command}\n`);
                runOobeeA11yScan(command);
            })
            .catch(err => {
                console.error('Error:', err);
            });
    };

    runScript();

</details>

<details>
    <summary>ウェブクローラーのログインを自動化する例（TypeScript）を表示するにはクリックしてください</summary>
<code>automated-web-crawler-login.ts</code>:
   
    import { chromium, Browser, Page, Cookie } from 'playwright';
    import { exec } from 'child_process';

    const loginAndCaptureHeaders = async (url: string, email: string, password: string): Promise<string> => {
        const browser: Browser = await chromium.launch({ headless: true });
        const page: Page = await browser.newPage();

        await page.goto(url);
        await page.fill('input[name="email"]', email);
        await page.fill('input[name="password"]', password);

        const [response] = await Promise.all([
            page.waitForNavigation(),
            page.click('input[type="submit"]'),
        ]);

        // Format cookie retrieved from page
        const formatCookies = (cookies: Cookie[]): string => {
            return cookies.map(cookie => `cookie ${cookie.name}=${cookie.value}`).join('; ');
        };

        // Retrieve cookies after login
        let cookies: Cookie[] = await page.context().cookies();
        const formattedCookies: string = formatCookies(cookies);

        // Close browser
        await browser.close();

        return formattedCookies;
    };

    const runOobeeA11yScan = (command: string): void => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error: ${error.message}`);
                return;
            }
            if (stderr) {
                console.error(stderr);
            }
            console.log(stdout);
        });
    };

    const runScript = (): void => {
        loginAndCaptureHeaders(
            // Test example with authenticationtest.com
            'https://authenticationtest.com/simpleFormAuth/',
            'simpleForm@authenticationtest.com',
            'pa$w0rd',
        )
            .then((formattedCookies: string) => {
                console.log('Cookies retrieved.\n');
                // where -m "..." are the headers needed in the format "header1 value1, header2 value2" etc
                // where -u ".../loginSuccess/" is the destination page after login
                const command: string = `npm run cli -- -c website -u "https://authenticationtest.com/loginSuccess/" -p 1 -k "Your Name:email@domain.com" -m "${formattedCookies}"`;
                console.log(`Executing OobeeA11y scan command:\n> ${command}\n`);
                runOobeeA11yScan(command);
            })
            .catch((err: Error) => {
                console.error('Error:', err);
            });
    };

    runScript();

</details>

#### 任意の NodeJS ワークフローとの連携（ベータ）

特定のフレームワーク向けの連携パターンを使わずに、任意の NodeJS スクリプトで Oobee を使うこともできます。独自のワークフロー、CI/CD パイプライン、ブラウザーの自動操作を自分で管理する簡単なスクリプト、静的な HTML のスキャンなどに便利です。

`examples/oobee-scan-page-demo.js` と `examples/oobee-scan-html-demo.js` の例を参照してください。

##### `async scanPage(pages, config)`

1 つ以上の Playwright の Page オブジェクトをスキャンします。Oobee のエンジンをページのコンテキストに挿入して検査します。

**パラメーター:**

- `pages`: Playwright の `Page` オブジェクト、または `Page` オブジェクトの配列。
- `config`: 設定オブジェクト
  - `name`: 結果に記録する名前（必須）
  - `email`: 結果に記録するメールアドレス（必須）
  - `pageTitle`: ページタイトルを上書きする場合に指定（任意。1 ページだけをスキャンする場合にのみ適用）
  - `metadata`: メタデータの文字列（任意）
  - `ruleset`: `RuleFlags` の配列（任意。例: `['enable-wcag-aaa', 'disable-oobee']`）
  - `lang`: 問題テキストに使用する ISO 639-1 言語（`en` または `ja`）（任意）。既定は `OOBEE_LANG`、未設定の場合は `en` です。

**戻り値:**

- 分類された違反と合格数を含むスキャン結果のオブジェクト。

##### `async scanHTML(htmlContent, config)`

HTML 文字列をスキャンします。JSDOM 環境（NodeJS）で axe-core を使って実行するため、ブラウザーでの完全なレイアウトや JavaScript の実行が必要なアクセシビリティの問題は検出できない場合があります。

**パラメーター:**

- `htmlContent`: HTML 文字列、または HTML 文字列の配列。
- `config`: 設定オブジェクト
  - `name`: 結果に記録する名前（必須）
  - `email`: 結果に記録するメールアドレス（必須）
  - `pageUrl`: レポートで使用する URL の識別子（任意。既定は 'raw-html'）
  - `pageTitle`: タイトルの識別子（任意。既定は 'HTML Content'）
  - `metadata`: メタデータの文字列（任意）
  - `ruleset`: `RuleFlags` の配列（任意）
  - `lang`: 問題テキストに使用する ISO 639-1 言語（`en` または `ja`）（任意）。既定は `OOBEE_LANG`、未設定の場合は `en` です。

各 HTML 文字列のサイズは `OOBEE_SCANHTML_MAX_BYTES`（既定 50 MB）、各 axe の実行時間は `OOBEE_SCANHTML_AXE_TIMEOUT_MS`（既定 5 分）に制限されます。`0` 以下の値を指定しても制限は無効にならず、既定値が使われます。

**戻り値:**

- 分類された違反（mustFix、goodToFix、needsReview）を含むスキャン結果のオブジェクト。

##### `scanCustomFlow(config)`

対話式のカスタムフロースキャンを開始します。Oobee が `config.url` でブラウザーを開き、ユーザーがページを移動しながら各ページで **Scan this page** をクリックします。ブラウザーを閉じるか `stop()` を呼び出すと、レポートが生成されます。セッションオブジェクトをすぐに返します（関数自体は `async` ではありません）。

**パラメーター（`config`）:**

- `url`: 開始 URL（必須）。`http:`、`https:`、ローカルの `file:` の URL を指定できます。
- `name`、`email`: Oobee のデータ収集のため（必須）
- `browser`: `chrome`（既定）、`chromium`、`edge`
- `deviceChosen` / `customDevice` / `viewportWidth`: ビューポートのオプション。既定は幅 1920px の `Desktop` です。
- `includeScreenshots`: 要素のスクリーンショットを含めます。既定は false です。
- `customFlowLabel`: レポートに表示され、結果フォルダー名にも使われるラベル。
- `ruleset`、`strategy`、`followRobots`、`blacklistedPatterns`、`extraHTTPHeaders`、`zip`、`metadata`: `oobeeA11yInit` や CLI と同じ意味です。
- `maxPagesToScan`: スキャンするページ数の上限（任意）。
- `cleanupArtifacts`: レポート生成後に中間ファイルを削除します。既定は true です。
- `onReady`、`onFinalizing`: ブラウザーの準備ができたとき、およびレポートを生成しているときに呼ばれるコールバック（任意）。

レポートの言語は `OOBEE_LANG`（`en` または `ja`）に従います。`scanCustomFlow` には `lang` オプションはありません。1 つのプロセスで同時に実行できるカスタムフローのセッションは 1 つだけです。

**戻り値**として、次を持つセッションを返します。

- `ready`: ブラウザーが開くと解決される Promise。
- `result`: レポートが生成されると `{ customFlowLabel, scanData, scanItems, results, resultDirectory, artifacts }` で解決される Promise。
- `stop()`: スキャンを終了し、レポートを生成します。
- `focus()`: スキャン用のブラウザーウィンドウを前面に表示します。

> **セキュリティ:** 信頼できないユーザーから受け取った URL を `scanCustomFlow` に渡すアプリケーションでは、`OOBEE_SSRF_PROTECTION=1` を設定してください。設定しないと、そのユーザーがスキャナーに内部のホストやローカルファイルを読み込ませ、その内容をレポートで受け取れてしまいます。
