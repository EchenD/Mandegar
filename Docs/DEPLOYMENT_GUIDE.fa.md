# راهنمای انتشار سایت ماندگار

[English version](DEPLOYMENT_GUIDE.md) · [راهنمای فارسی ویرایش محتوا](CONTENT_EDITING_GUIDE.fa.md)

پس از ویرایش محتوا با [راهنمای ویرایش محتوا](CONTENT_EDITING_GUIDE.fa.md)، از این راهنما استفاده کنید. دستورها برای **Windows PowerShell** و پوشهٔ `D:\Projects\Navid\Mandegar` هستند. پیش از اجرا، دامنه‌ها، نام کاربری و شناسهٔ کامیت نمونه را با مقدار واقعی خودتان جایگزین کنید.

نشانی سایت فعلی **https://echend.github.io/Mandegar/** و مخزن کد منبع **https://github.com/EchenD/Mandegar** است.

نام دستورها، مسیرها، گزینه‌ها و متن نمونه‌کدها مطابق نسخهٔ انگلیسی حفظ شده‌اند تا بتوانید آن‌ها را دقیق کپی و اجرا کنید.

## انتخاب مقصد انتشار

| مقصد | دستور | نتیجه |
| --- | --- | --- |
| توسعهٔ محلی | `npm run dev` | پیش‌نمایش مرورگر در `http://localhost:3300/fa` |
| GitHub Pages فعلی | `npm run content:publish` | ساخت و انتشار زیر مسیر `/Mandegar` |
| GitHub Pages با دامنهٔ شما | `npm run content:publish -- -BasePath / -SiteUrl https://www.your-domain.com` | انتشار در ریشهٔ دامنه؛ ابتدا بخش ۵ را تکمیل کنید |
| میزبان استاتیک دیگر | `npm run build:pages -- -BasePath / -SiteUrl https://www.your-domain.com` | تولید `out/` برای بارگذاری؛ انتشار انجام نمی‌دهد |
| میزبان Node.js | `npm run build` و سپس `npm start` | اجرای سرور Next.js؛ بخش ۷ را ببینید |

شاخه‌ها و پوشه‌های مخزن کاربردهای متفاوتی دارند:

| شاخه یا پوشه | کاربرد |
| --- | --- |
| `source` | کد قابل ویرایش، JSON، فایل‌های اصلی عمومی و این راهنماها |
| `main` در مخزن آنلاین | فایل‌های تولیدشدهٔ سایت برای GitHub Pages |
| `out/` | خروجی استاتیک محلی اسکریپت انتشار؛ در Git ثبت نمی‌شود |
| `.next/`، `.next-static/` | خروجی تولیدشدهٔ ساخت؛ ویرایش نکنید |

**Push شاخهٔ `source` تغییرات شما را در GitHub ذخیره می‌کند. انتشار، همان تغییرات را می‌سازد و سایت را روی `main` به‌روز می‌کند.** این مخزن فعلاً گردش کار خودکاری برای ساخت و انتشار با هر push شاخهٔ منبع ندارد. شاخهٔ محلی `main` را روی فایل‌های تولیدشدهٔ سایت push نکنید.

## فهرست

1. [آماده‌سازی کامپیوتر](#deployment-01)
2. [اعتبارسنجی نسخهٔ انتشار](#deployment-02)
3. [ثبت کد منبع و انتشار روی GitHub Pages فعلی](#deployment-03)
4. [پیش‌نمایش دقیق خروجی استاتیک](#deployment-04)
5. [استفاده از دامنهٔ اختصاصی در GitHub Pages](#deployment-05)
6. [انتشار روی میزبان استاتیک دیگر](#deployment-06)
7. [انتشار با سرور Next.js](#deployment-07)
8. [بررسی سایت عمومی](#deployment-08)
9. [بازگرداندن انتشار قبلی](#deployment-09)
10. [رفع اشکال و مرجع دستورها](#deployment-10)

<a id="deployment-01"></a>

## 1. آماده‌سازی کامپیوتر

### گام ۱ — بررسی ابزارها

اگر لازم است، Node.js و Git for Windows را نصب کنید. نسخهٔ Next.js این مخزن به Node.js **20.9 یا بالاتر** نیاز دارد؛ محیط فعلی از Node.js نسخهٔ 22.19 استفاده می‌کند. نسخهٔ پشتیبانی‌شدهٔ Node.js را که با این شرط سازگار است به کار ببرید.

```powershell
Set-Location 'D:\Projects\Navid\Mandegar'
node --version
npm --version
git --version
git branch --show-current
git status --short
```

روی `source` کار کنید. اگر شاخهٔ دیگری فعال است، تغییرات آن را تکمیل یا به‌شکل امن نگه‌داری کنید و سپس شاخه را عوض کنید:

```powershell
git switch source
```

فقط روی کامپیوتر تازه، ابتدا شاخهٔ منبع را در مقصد خالی دریافت کنید:

```powershell
git clone --branch source https://github.com/EchenD/Mandegar.git 'D:\Projects\Navid\Mandegar'
Set-Location 'D:\Projects\Navid\Mandegar'
```

این دستور clone را داخل پوشهٔ کاری موجود اجرا نکنید. پیش از شروع جلسهٔ ویرایش تازه، وقتی پوشهٔ کاری تغییر ثبت‌نشده ندارد، نسخهٔ جدید منبع را دریافت کنید:

```powershell
git pull --ff-only origin source
if ($LASTEXITCODE -ne 0) { throw 'Source update failed; resolve it before editing.' }
```

### گام ۲ — نصب وابستگی‌های ثبت‌شده

```powershell
npm ci
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
if (-not (Test-Path -LiteralPath '.env.local')) {
  Copy-Item -LiteralPath '.env.example' -Destination '.env.local'
}
```

`npm ci` نسخه‌های مشخص‌شده در `package-lock.json` را نصب می‌کند. پیش از نصب مجدد، سرور توسعهٔ فعال را متوقف کنید. `.env.local` را وارد Git نکنید. برای توسعهٔ محلی می‌توانید `NEXT_PUBLIC_SITE_URL=http://localhost:3300` داشته باشید.

`MEDIA_CDN_ORIGIN` اختیاری است؛ فقط در صورت استفاده از مبدأ خارجی HTTPS برای رسانه تنظیمش کنید. همان مبدأ را روی کامپیوتر یا پلتفرمی که نسخهٔ انتشار را می‌سازد تنظیم کنید. پس از تغییر متغیرهای محیط، سرور توسعه را دوباره اجرا کنید.

### گام ۳ — بررسی دسترسی GitHub

```powershell
git remote -v
git ls-remote origin refs/heads/source refs/heads/main
if ($LASTEXITCODE -ne 0) { throw 'GitHub repository access failed.' }
```

ناشر پیش‌فرض از `git@github-echend:EchenD/Mandegar.git` استفاده می‌کند. `github-echend` نام مستعار SSH تنظیم‌شده روی کامپیوتر فعلی است و نام عمومی اینترنتی نیست. روی کامپیوتر دیگر، SSH خودتان را درست تنظیم کنید یا گزینهٔ مخزن HTTPS در بخش ۳ را به کار ببرید.

اگر Git هویت کامیت می‌خواهد، نام و ایمیل GitHub خودتان را برای این مخزن تنظیم کنید:

```powershell
git config user.name 'YOUR NAME'
git config user.email 'YOUR GITHUB EMAIL'
```

برای push هر دو شاخه، دسترسی نوشتن GitHub لازم است. در اتصال HTTPS، در صورت درخواست از ورود مدیریت اعتبارنامهٔ Git for Windows استفاده کنید؛ توکن دسترسی را در فایل محتوا یا مثال دستور قرار ندهید.

<a id="deployment-02"></a>

## 2. اعتبارسنجی نسخهٔ انتشار

### گام ۱ — اعتبارسنجی محتوا و کد منبع

```powershell
npm run content:check
if ($LASTEXITCODE -ne 0) { throw 'Fix content validation errors before continuing.' }
npm run lint
if ($LASTEXITCODE -ne 0) { throw 'Fix lint errors before continuing.' }
npm run typecheck
if ($LASTEXITCODE -ne 0) { throw 'Fix TypeScript errors before continuing.' }
```

بررسی‌های `if` در Windows PowerShell مهم هستند: شکست یک دستور خارجی به‌صورت خودکار اجرای بقیهٔ دستورهای چسبانده‌شده را متوقف نمی‌کند.

### گام ۲ — بررسی محتوای نهایی عمومی

برای انتشار نهایی محتوا اجرا کنید:

```powershell
npm run content:check -- --strict
if ($LASTEXITCODE -ne 0) { throw 'Final content is not ready; resolve the launch review items.' }
```

وضعیت مخزن در تاریخ 2026-10-11 در حالت سخت‌گیرانه **27 مورد نیازمند بررسی** دارد: پروژه‌ها و خدمات مفهومی، رسانه و تماس نمونه و متن حقوقی پیش‌نویس. اعتبارسنجی معمول، محتوای پیش‌نمایش با برچسب مشخص را می‌پذیرد. اسکریپت انتشار هنگام ساخت، اعتبارسنجی معمول را اجرا می‌کند؛ **حالت سخت‌گیرانه را خودکار اجرا نمی‌کند**. پیش از معرفی سایت به‌عنوان انتشار نهایی محتوا، این بررسی را جداگانه تکمیل کنید. روش جایگزینی یا حذف هر نوع نمونه در راهنمای ویرایش آمده است.

### گام ۳ — بازبینی در مرورگر

```powershell
npm run dev
```

`/fa`، `/en` و `/ar`، هر صفحهٔ جزئیات تغییرکرده و مراحل صفحهٔ اصلی را روی موبایل و دسکتاپ بررسی کنید. پیوند منو، مقصد واقعی تماس، برش تصاویر، عنوان‌های تایپی، پخش ویدیو و کاهش حرکت را امتحان کنید. برای بررسی‌ها ترمینال دوم باز کنید و در پایان سرور را با `Ctrl+C` متوقف کنید.

برای آزمون کامل انتشار:

```powershell
npx playwright install chromium
if ($LASTEXITCODE -ne 0) { throw 'Browser installation failed.' }
npm run test:e2e
if ($LASTEXITCODE -ne 0) { throw 'Review browser test failures before publishing.' }
```

پس از جایگزینی نامک‌ها و متن‌های نمونه، انتظارهای تست را در صورت نیاز به‌روز کنید. دادهٔ تست تغییرکرده با مسیر یا چیدمان خراب تفاوت دارد؛ گزارش را با `npx playwright show-report` بررسی کنید.

<a id="deployment-03"></a>

## 3. ثبت کد منبع و انتشار روی GitHub Pages فعلی

### گام ۱ — بررسی تنظیم GitHub Pages

در **EchenD/Mandegar → Settings → Pages**، گزینهٔ **Deploy from a branch**، شاخهٔ **`main`** و پوشهٔ **`/ (root)`** را انتخاب و Save کنید. پس از انتشار، اجرای Pages را در زبانهٔ Actions مخزن بررسی کنید. این‌ها تنظیمات رسمی انتشار از شاخه در GitHub هستند. [مستند انتخاب منبع انتشار GitHub](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

### گام ۲ — بازبینی و کامیت فایل‌های قابل ویرایش

```powershell
git status --short
git diff --check
if ($LASTEXITCODE -ne 0) { throw 'Review whitespace/conflict problems before committing.' }
git diff --stat
git add -- content public
git diff --cached --stat
git diff --cached --check
if ($LASTEXITCODE -ne 0) { throw 'Review staged changes before committing.' }
git commit -m 'feat: update approved website content'
if ($LASTEXITCODE -ne 0) { throw 'Source commit failed.' }
git push origin source
if ($LASTEXITCODE -ne 0) { throw 'Source push failed; do not continue to publishing.' }
```

دستور `git add -- content public` تغییرات محتوا و رسانه را برای کامیت آماده می‌کند. اگر TypeScript صفحهٔ اصلی یا مستندات را تغییر داده‌اید، **فایل‌های مشخص دیگر** را پیش از کامیت اضافه کنید؛ برای مثال:

```powershell
git add -- 'app/[locale]/page.tsx' 'components/experience/interactions/interaction-copy.ts' 'Docs/CONTENT_EDITING_GUIDE.md'
```

تفاوت‌های آمادهٔ کامیت را بررسی کنید و فقط تغییرات مربوط به همین انتشار را وارد کنید. اگر تغییر تازه‌ای برای کامیت وجود ندارد، بررسی کنید کامیت منبع مورد نظر روی `origin/source` موجود است و سپس انتشار را ادامه دهید.

### گام ۳ — ساخت و انتشار

روی کامپیوتر فعلی با تنظیمات موجود:

```powershell
npm run content:publish
if ($LASTEXITCODE -ne 0) { throw 'Publishing failed; inspect the error before retrying.' }
```

روی کامپیوتری که از HTTPS به‌جای نام مستعار SSH فعلی استفاده می‌کند:

```powershell
npm run content:publish -- -Repository https://github.com/EchenD/Mandegar.git
if ($LASTEXITCODE -ne 0) { throw 'Publishing failed; check repository access and build output.' }
```

**یکی** از این دو روش را اجرا کنید. اسکریپت:

1. سایت را با پیشوند `/Mandegar` و نشانی `https://echend.github.io/Mandegar` می‌سازد.
2. خروجی استاتیک را بررسی و در `out/` قرار می‌دهد.
3. فایل‌های مسیر استاتیک مورد نیاز ناوبری سمت کاربر را آماده و یکدست می‌کند.
4. مخزن مقصد را در پوشهٔ موقت دریافت و فایل‌های شاخهٔ انتشار را جایگزین می‌کند.
5. `.nojekyll` را اضافه می‌کند، در صورت تغییر خروجی کامیت می‌سازد و به `main` آنلاین push می‌کند.

اسکریپت از **فایل‌های فعلی پوشهٔ کاری شما** می‌سازد؛ ابتدا آن‌ها را بازبینی و کامیت کنید. اسکریپت شاخهٔ قابل ویرایش `source` را برایتان کامیت یا push نمی‌کند. فایل‌های دستی اضافی که باید منتشر شوند را در `public/` نگه دارید؛ فایل‌هایی که فقط روی `main` تولیدشده اضافه شوند ممکن است در انتشار بعدی حذف شوند.

### گام ۴ — انتظار برای GitHub Pages و بررسی

صبر کنید آخرین اجرای Pages در GitHub Actions موفق شود و سپس این نشانی‌ها را باز کنید:

- `https://echend.github.io/Mandegar/fa/`
- `https://echend.github.io/Mandegar/en/`
- `https://echend.github.io/Mandegar/ar/`
- `https://echend.github.io/Mandegar/fa/partners/`

بررسی‌های بخش ۸ را انجام دهید. Push موفق یعنی بارگذاری موفق بوده است؛ اجرای Pages و نمایش سایت عمومی را هم بررسی کنید.

<a id="deployment-04"></a>

## 4. پیش‌نمایش دقیق خروجی استاتیک

### گام ۱ — ساخت بدون انتشار

```powershell
npm run build:pages
if ($LASTEXITCODE -ne 0) { throw 'Static build failed.' }
```

این دستور از پیشوند فعلی GitHub Pages استفاده می‌کند. بازکردن `out/fa/index.html` به‌صورت فایل محلی کافی نیست، چون مسیر رسانه و ناوبری انتظار سرور HTTP با `/Mandegar` دارد.

### گام ۲ — سرو نسخهٔ موقت در مسیر مطابق خروجی

```powershell
$previewRoot = Join-Path $env:TEMP ('mandegar-preview-' + [guid]::NewGuid().ToString('N'))
$previewSite = Join-Path $previewRoot 'Mandegar'
New-Item -ItemType Directory -Path $previewSite -Force | Out-Null
Copy-Item -Path '.\out\*' -Destination $previewSite -Recurse -Force
npx --yes http-server@14.1.1 "$previewRoot" -a 127.0.0.1 -p 3400 -c-1
```

نشانی **http://127.0.0.1:3400/Mandegar/fa/** را باز کنید، سپس انگلیسی و عربی و پیوند بین صفحات داخلی را آزمایش کنید. `npx` در صورت نیاز ابزار پیش‌نمایش با نسخهٔ مشخص را دریافت می‌کند و `-c-1` کش آن را غیرفعال می‌کند. با `Ctrl+C` متوقفش کنید. این کار وابستگی‌های پروژه را تغییر نمی‌دهد. [روش استفاده از http-server](https://github.com/http-party/http-server).

برای خروجی ساخته‌شده با `-BasePath /`، پوشهٔ `out` را مستقیم سرو کنید:

```powershell
npx --yes http-server@14.1.1 .\out -a 127.0.0.1 -p 3400 -c-1
```

سپس **http://127.0.0.1:3400/fa/** را باز کنید. نشانی‌های canonical در پیش‌نمایش همچنان به `SiteUrl` زمان ساخت اشاره می‌کنند.

<a id="deployment-05"></a>

## 5. استفاده از دامنهٔ اختصاصی در GitHub Pages

در این روش، میزبانی GitHub Pages باقی می‌ماند و نشانی عمومی تغییر می‌کند. ابتدا نام اصلی را انتخاب کنید: مثلاً `www.your-domain.com` یا دامنهٔ ریشهٔ `your-domain.com`. در تمام مراحل، این نمونه را با دامنهٔ خودتان جایگزین کنید.

### گام ۱ — ثبت دامنه در GitHub

در **Settings → Pages → Custom domain** مخزن، نام دامنه را بدون `https://` و بدون مسیر وارد و Save کنید. پیش از اشاره‌دادن DNS به GitHub، دامنه را اینجا تنظیم کنید. مقصدهای DNS رسمی GitHub در ادامه آمده‌اند. [راهنمای دامنهٔ اختصاصی GitHub](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).

### گام ۲ — تنظیم DNS نزد ارائه‌دهندهٔ دامنه

برای `www`، رکورد CNAME اضافه کنید:

| نوع | نام | مقصد |
| --- | --- | --- |
| CNAME | `www` | `echend.github.io` |

مقصد نباید scheme یا پسوند `/Mandegar` داشته باشد. اگر از دامنهٔ ریشه استفاده می‌کنید، به‌جای آن چهار رکورد A زیر را وارد کنید؛ ارائه‌دهنده ممکن است نام ریشه را `@` نمایش دهد:

| نوع | نام | مقصد |
| --- | --- | --- |
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |

تداخل رکوردهای موجود برای همان نام را در تنظیمات ارائه‌دهندهٔ DNS حل کنید. نتیجهٔ DNS را در PowerShell بررسی کنید:

```powershell
Resolve-DnsName -Name 'www.your-domain.com' -Type CNAME
# If using the apex instead:
Resolve-DnsName -Name 'your-domain.com' -Type A
```

اعمال DNS و در دسترس قرارگرفتن گزینهٔ HTTPS ممکن است تا 24 ساعت طول بکشد. وقتی گزینهٔ **Enforce HTTPS** در GitHub Pages فعال شد، آن را روشن کنید. مقصدها و زمان‌بندی بالا مطابق [مستند دامنهٔ اختصاصی GitHub](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) هستند.

### گام ۳ — حفظ دامنه در انتشارهای بعدی

فایل `public/CNAME` را در کد منبع قابل ویرایش بسازید:

```powershell
Set-Location 'D:\Projects\Navid\Mandegar'
$siteDomain = 'www.your-domain.com'
Set-Content -LiteralPath '.\public\CNAME' -Value $siteDomain -Encoding Ascii
Get-Content -LiteralPath '.\public\CNAME'
```

فقط نام دامنهٔ انتخابی را وارد کنید. این مخزن هنگام انتشار، فایل‌های شاخهٔ تولیدشده را جایگزین می‌کند؛ بنابراین `CNAME` که فقط روی `main` ساخته شده باشد حذف خواهد شد. Next.js فایل `public/CNAME` را در خروجی کپی می‌کند تا انتشارهای بعدی آن را حفظ کنند. این تغییر منبع را طبق روش بخش ۳ کامیت و push کنید.

### گام ۴ — انتشار با مسیر ریشهٔ دامنه

```powershell
npm run content:publish -- -BasePath / -SiteUrl 'https://www.your-domain.com'
if ($LASTEXITCODE -ne 0) { throw 'Custom-domain publication failed.' }
```

اگر دسترسی HTTPS مخزن لازم است، `-Repository https://github.com/EchenD/Mandegar.git` را به همان دستور اضافه کنید.

**این گزینه‌های دامنه را در هر انتشار بعدی استفاده کنید.** مقدارهای پیش‌فرض اسکریپت همچنان برای `/Mandegar` هستند؛ حذف گزینه‌ها پس از تغییر دامنه، مسیر نادرست رسانه می‌سازد. `SiteUrl` نشانی کامل فراداده و نقشهٔ سایت و `BasePath` پیشوند مسیر صفحات و فایل‌ها را کنترل می‌کند. برای میزبانی در ریشه از `/` استفاده کنید.

### گام ۵ — بررسی نشانی جدید

`https://www.your-domain.com/fa/`، `/en/`، `/ar/` و چند صفحهٔ پروژه و خدمت را مستقیم باز کنید. بررسی کنید تصاویر، فونت‌ها و فایل‌های سه‌بعدی بدون درخواست به `/Mandegar/_next/...` بارگذاری شوند. بخش ۸ را با نشانی پایهٔ جدید اجرا کنید. پس از بررسی، پیوندهای بیرونی به سایت را به‌روز کنید.

برای بازگشت به نشانی اولیهٔ پروژه، دامنهٔ اختصاصی را از تنظیمات GitHub بردارید، `public/CNAME` منبع را حذف و تغییر را کامیت کنید و با گزینه‌های پیش‌فرض ناشر دوباره بسازید. تغییر DNS به این بستگی دارد که دامنهٔ قبلی بعداً چه چیزی را نمایش دهد.

<a id="deployment-06"></a>

## 6. انتشار روی میزبان استاتیک دیگر

خروجی سایت را می‌توان به‌صورت فایل و بدون اجرای Node.js روی وب‌سرور سرو کرد. خروجی استاتیک Next.js شامل HTML، CSS، JavaScript و فایل‌های عمومی است؛ قابلیت‌های وابسته به سرور به روش میزبانی دیگری نیاز دارند. [مستند خروجی استاتیک Next.js](https://nextjs.org/docs/app/guides/static-exports).

### گام ۱ — ساخت برای نشانی عمومی واقعی

برای ریشهٔ دامنه:

```powershell
npm run build:pages -- -BasePath / -SiteUrl 'https://www.your-domain.com'
if ($LASTEXITCODE -ne 0) { throw 'Static export failed.' }
```

برای زیرپوشه‌ای مثل `https://www.your-domain.com/portfolio`:

```powershell
npm run build:pages -- -BasePath /portfolio -SiteUrl 'https://www.your-domain.com/portfolio'
if ($LASTEXITCODE -ne 0) { throw 'Static export failed.' }
```

یکی را انتخاب کنید. خروجی GitHub Pages که با `/Mandegar` ساخته شده را نمی‌توان بدون ساخت دوباره در ریشهٔ دامنه بارگذاری کرد؛ با پیشوند مقصد دوباره بسازید. اگر از GitHub Pages به میزبان دیگری می‌روید و `public/CNAME` دیگر برای آن میزبان لازم نیست، آن را از منبع حذف کنید.

### گام ۲ — پیش‌نمایش خروجی

از دستور سرور بخش ۴، متناسب با پیشوند انتخاب‌شده استفاده کنید. برای زیرپوشهٔ اختصاصی، نسخهٔ موقت را در پوشه‌ای با همان نام قرار دهید و پوشهٔ والد را سرو کنید.

### گام ۳ — بسته‌بندی یا بارگذاری تمام فایل‌های خروجی

اگر میزبان ZIP می‌پذیرد، در Windows می‌توانید آرشیو را خارج از مخزن بسازید:

```powershell
$siteArchive = Join-Path $env:TEMP ('mandegar-site-' + [guid]::NewGuid().ToString('N') + '.zip')
tar.exe -a -c -f "$siteArchive" -C '.\out' '.'
if ($LASTEXITCODE -ne 0) { throw 'Export archive creation failed.' }
Get-Item -LiteralPath $siteArchive
```

**محتویات `out/`** را در ریشهٔ فایل‌های سایت میزبان، یا مسیر مربوط به زیرپوشهٔ انتخابی بارگذاری و استخراج کنید. ساختار پوشه‌ها را حفظ کنید. `_next/`، پوشه‌های زبان، `media/`، `models/`، `textures/`، فونت‌ها، فایل‌های رمزگشای زمان اجرا، sitemap و robots و فایل‌های بخش‌های ناوبری را همگی نگه دارید. فقط HTML و تصویر را بارگذاری نکنید و نام فایل‌های تولیدشدهٔ بخش‌ها را تغییر ندهید. `scripts/normalize-static-segments.mjs` فایل‌های ناوبری سمت کاربر را قبلاً آماده کرده است.

برای سرور موجودی که کنترل آن را دارید، دستور اختیاری انتقال:

```powershell
scp "$siteArchive" 'YOUR_USER@YOUR_HOST:/home/YOUR_USER/'
if ($LASTEXITCODE -ne 0) { throw 'Archive transfer failed.' }
```

ابتدا حساب، میزبان و مسیر را جایگزین کنید. این دستور فقط آرشیو را انتقال می‌دهد؛ پنل بارگذاری یا روش کار سرور شما باید آن را در ریشهٔ صحیح فایل‌های سایت استخراج کند. پیش از جایگزینی، از فایل‌های منتشرشدهٔ موجود نسخهٔ پشتیبان بگیرید. دستور دقیق استخراج و انتشار به مسیرها و دسترسی‌های آن میزبان بستگی دارد.

### گام ۴ — تنظیم سرو فایل و HTTPS

برای مسیرهایی مانند `/fa/partners/` از سرو معمول `index.html` پوشه استفاده کنید. مسیرهای دارای اسلش پایانی، بزرگی و کوچکی حروف نام فایل و پاسخ 404 برای مسیر ناموجود را حفظ کنید. از قانون SPA که همهٔ درخواست‌ها، حتی فایل‌های ناوبری استاتیک، را به HTML صفحهٔ اصلی می‌فرستد پرهیز کنید.

دامنه و HTTPS را طبق دستور ارائه‌دهندهٔ میزبان تنظیم کنید. اگر نگاشت MIME را خودتان تعیین می‌کنید، علاوه بر HTML، CSS و JavaScript، نوع‌های WebAssembly یعنی `application/wasm`، GLB یعنی `model/gltf-binary`، KTX2 یعنی `image/ktx2` و همچنین WebP، MP4 و WOFF2 را پوشش دهید. هدرهای امنیتی یا کش مورد نظر را میزبان استاتیک باید ارائه کند؛ قواعد هدر سرور Next.js در این حالت اجرا نمی‌شوند.

### گام ۵ — بررسی

بخش ۸ را با نشانی جدید اجرا کنید. هم بارگذاری مستقیم صفحه و هم رفتن با کلیک روی پیوند را آزمایش کنید؛ هر کدام می‌تواند بارگذاری ناقص فایل‌ها یا پیشوند مسیر اشتباه را آشکار کند.

<a id="deployment-07"></a>

## 7. انتشار با سرور Next.js

اگر میزبان، اجرای دائمی Node.js فراهم می‌کند یا بعداً به قابلیت سرور نیاز دارید، از این روش استفاده کنید. سایت GitHub Pages فعلی از روش استاتیک استفاده می‌کند؛ این بخش اختیاری است.

### گام ۱ — آماده‌سازی منبع روی میزبان

از شاخهٔ `source` استفاده کنید، وابستگی‌ها را با `npm ci` نصب کنید و تنظیمات محیط را فراهم کنید. `NEXT_PUBLIC_SITE_URL` را روی مبدأ HTTPS نهایی تنظیم کنید. اگر رسانهٔ خارجی لازم دارد، `MEDIA_CDN_ORIGIN` را تنظیم کنید. فایل محیط و توکن‌ها را وارد Git نکنید.

در نشست PowerShell، تنظیم زمان ساخت می‌تواند چنین باشد:

```powershell
Remove-Item Env:MANDEGAR_STATIC_EXPORT -ErrorAction SilentlyContinue
Remove-Item Env:NEXT_PUBLIC_BASE_PATH -ErrorAction SilentlyContinue
$env:NEXT_PUBLIC_SITE_URL = 'https://www.your-domain.com'
```

این دستورها نشان‌های خروجی استاتیک را در همان ترمینال پاک می‌کنند و فایل پروژه را حذف نمی‌کنند. در داشبورد میزبان، این نشان‌های استاتیک را تنظیم نکنید و نشانی واقعی سایت را همان‌جا وارد کنید.

### گام ۲ — ساخت و اجرا

```powershell
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Next.js server build failed.' }
npm start -- --hostname 127.0.0.1 --port 3000
```

پیش‌نمایش نسخهٔ تولید در `http://127.0.0.1:3000/fa` در دسترس است. `npm start` فرایند در حال اجرا در همان ترمینال است و با توقف یا بستن ترمینال متوقف می‌شود. میزبان تولید باید آن را دائماً اجرا کند و پراکسی HTTPS یا توازن‌دهندهٔ بار را مقابل پورت انتخابی قرار دهد. این موارد را با کنترل سرویس یا فرایند ارائه‌دهنده تنظیم کنید.

در پلتفرم مدیریت‌شدهٔ Node، شاخهٔ **`source`**، دستور نصب **`npm ci`**، دستور ساخت **`npm run build`** و دستور شروع **`npm start`** را انتخاب کنید، مگر اینکه یکپارچه‌سازی Next.js معادل آن‌ها را فراهم کند. مقدارهای محیط را پیش از ساخت تنظیم کنید. شاخهٔ تولیدشدهٔ `main` را به‌عنوان منبع برنامه انتخاب نکنید.

### گام ۳ — انتشار تغییرات بعدی

منبع را کامیت و push کنید، روی میزبان Node دوباره بسازید و سرویس را با نسخهٔ تازه راه‌اندازی مجدد کنید. برای این روش از `content:publish` استفاده نکنید؛ آن دستور یک سایت استاتیک جداگانه روی GitHub Pages منتشر می‌کند. میزبان عمومی را طبق بخش ۸ بررسی کنید.

<a id="deployment-08"></a>

## 8. بررسی سایت عمومی

### گام ۱ — بررسی مسیرها و فایل‌های عمومی

این مثال از نشانی فعلی GitHub Pages استفاده می‌کند. برای دامنهٔ اختصاصی در ریشه، `$liveBase` را با مبدأ HTTPS خود بدون اسلش پایانی جایگزین کنید. برای میزبانی زیرپوشه‌ای، زیرپوشه را هم وارد کنید.

```powershell
$liveBase = 'https://echend.github.io/Mandegar'
$paths = @(
  '/fa/',
  '/en/',
  '/ar/',
  '/fa/projects/',
  '/fa/services/',
  '/fa/partners/',
  '/fa/contact/',
  '/sitemap.xml',
  '/robots.txt',
  '/images/mandegar-finale-logo.webp'
)
foreach ($path in $paths) {
  $response = Invoke-WebRequest -UseBasicParsing -Uri ($liveBase + $path)
  [pscustomobject]@{ Path = $path; Status = $response.StatusCode }
}
```

پاسخ مورد انتظار HTTP 200 است. این بررسی، دسترسی را تأیید می‌کند و چیدمان یا مطابقت محتوا با نسخهٔ مورد نظر را ارزیابی نمی‌کند. دست‌کم یک نامک واقعی پروژه و یک نامک واقعی خدمت از انتشار خود را هم باز کنید.

### گام ۲ — بررسی نمایش نسخهٔ منتشرشده

در پنجرهٔ خصوصی مرورگر یا پس از تازه‌سازی کامل، این موارد را بررسی کنید:

- راست‌به‌چپ فارسی و عربی و چیدمان انگلیسی؛ عنوان ترجمه‌شده و فونت فارسی.
- مراحل هیرو، کنترل موبایل، پیوند خدمات، تغییر حالت عنوان پروژه با اشاره‌گر و فوکوس و بخش همراهان.
- منوی سربرگ در صفحهٔ اصلی و صفحات داخلی؛ بازکردن مستقیم جزئیات و بازگشت بین صفحات.
- تصویر و ویدیوی گالری، رفتار پوستر و بارگذاری و مقصدهای تماس.
- موبایل با عرض 320 تا 430 پیکسل CSS، دسکتاپ، دسترسی صفحه‌کلید و کاهش حرکت.
- ابزار توسعهٔ مرورگر: فایل مفقود و 404، خطای JavaScript و درخواست با پیشوند مسیر اشتباه.
- نشانی sitemap، canonical و اشتراک‌گذاری برای دامنهٔ عمومی واقعی.

یک عنوان یا تصویر مشخص تغییرکرده را با نسخهٔ محلی مقایسه کنید. اگر تصویر قدیمی مانده، کش را بررسی و طبق راهنمای ویرایش از نام نسخه‌دار استفاده کنید. اگر کل صفحه قدیمی است، ابتدا آخرین اجرای GitHub Pages و کامیت منتشرشده را بررسی کنید.

<a id="deployment-09"></a>

## 9. بازگرداندن انتشار قبلی

تغییر مشخص منبع را برگردانید و برای همان مقصد دوباره بسازید. این روش کد منبع و خروجی تولیدشده را هماهنگ نگه می‌دارد.

### گام ۱ — شناسایی تغییر

```powershell
git branch --show-current
git status --short
git log --oneline -12
```

روی `source` بمانید. پیش از بازگردانی، ویرایش‌های نامرتبط را تکمیل یا نگه‌داری کنید. کامیتی را که تغییر نامطلوب را ایجاد کرده بررسی کنید:

```powershell
git show SOURCE_COMMIT_TO_REVERT
```

`SOURCE_COMMIT_TO_REVERT` را با شناسهٔ واقعی کامیت منبع جایگزین کنید. برای کامیت ساده‌ای که merge نیست:

```powershell
git revert --no-edit SOURCE_COMMIT_TO_REVERT
if ($LASTEXITCODE -ne 0) { throw 'Resolve or abort the revert conflict before continuing.' }
npm run content:check
if ($LASTEXITCODE -ne 0) { throw 'Validate the restored content before publishing.' }
git push origin source
if ($LASTEXITCODE -ne 0) { throw 'Rollback source push failed.' }
```

اگر بازگردانی تداخل دارد، فایل‌ها را اصلاح و `git revert --continue` را اجرا کنید، یا بازگردانی نیمه‌تمام را با `git revert --abort` لغو کنید. برای حل این مورد، هیچ‌یک از شاخه‌ها را force-push نکنید. برای انتشار چندکامیتی یا merge، ابتدا مجموعهٔ کامل تغییرات را شناسایی کنید و حدسی یک کامیت را برنگردانید.

### گام ۲ — انتشار منبع بازگردانده‌شده

برای نشانی اصلی پروژه:

```powershell
npm run content:publish
if ($LASTEXITCODE -ne 0) { throw 'Rollback publication failed.' }
```

برای دامنهٔ اختصاصی، همان گزینه‌های `-BasePath / -SiteUrl https://...` انتشار موفق آن دامنه را استفاده کنید. برای میزبان دیگر، خروجی فایل‌ها یا برنامهٔ Node را دوباره بسازید و همان‌جا جایگزین یا منتشر کنید. سایت عمومی بازگردانده‌شده را طبق بخش ۸ بررسی کنید.

<a id="deployment-10"></a>

## 10. رفع اشکال و مرجع دستورها

| مشکل | اقدام |
| --- | --- |
| `npm` یا `git` شناخته نمی‌شود | ابزار را نصب کنید و ترمینال را دوباره باز کنید |
| PowerShell اجرای `npm.ps1` را مسدود می‌کند | در دستورهای این راهنما به‌جای `npm` از `npm.cmd` استفاده کنید؛ تغییر execution policy لازم نیست |
| پورت 3300 یا 3400 اشغال است | سرور شناخته‌شده را متوقف کنید یا پورت و نشانی دیگری انتخاب کنید؛ توسعه دستور `npm run dev -- --port 3301` را می‌پذیرد |
| اعتبارسنجی JSON یا رسانه شکست خورده | فایل و فیلد گزارش‌شده را بررسی و ترجمه، ارجاع، نشان تأیید یا فایل مفقود را پیش از ساخت اصلاح کنید |
| اعتبارسنجی سخت‌گیرانه شکست خورده | بررسی محتوای واقعی، تماس و حقوقی را تکمیل کنید؛ موفقیت پیش‌نمایش معمول، تأیید انتشار نهایی نیست |
| `github-echend` پیدا نمی‌شود یا SSH ناموفق است | SSH را تنظیم کنید یا گزینهٔ `-Repository https://github.com/EchenD/Mandegar.git` ناشر را به کار ببرید؛ push منبع نیز به origin قابل دسترسی نیاز دارد |
| روی کامپیوتر تازه، push منبع با HTTPS لازم است | `git remote set-url origin https://github.com/EchenD/Mandegar.git` را اجرا کنید، وارد حساب شوید و دوباره تلاش کنید |
| منبع push شده ولی سایت عمومی تغییر نکرده | ناشر را اجرا کنید، منتظر اجرای Pages بمانید و نشانی عمومی را بررسی کنید |
| ساخت انتشار ناموفق است | اولین خطای ساخت را بررسی کنید؛ برای دورزدن خطا، `out/` قدیمی را بارگذاری نکنید |
| push شاخهٔ انتشار رد می‌شود | دسترسی یا انتشار هم‌زمان را بررسی کنید و پس از رفع مشکل دوباره اجرا کنید تا اسکریپت شاخهٔ فعلی را دریافت کند؛ force-push نکنید |
| رسانه در دامنهٔ ریشه از `/Mandegar` درخواست می‌شود | با `-BasePath /` و `SiteUrl` صحیح دوباره بسازید |
| رسانه در نشانی پروژه از ریشه درخواست می‌شود | با گزینه‌های پیش‌فرض `/Mandegar` دوباره بسازید |
| پیوند در توسعه کار می‌کند ولی روی میزبان استاتیک خراب است | تمام خروجی را بارگذاری کنید، فایل‌های بخش‌های آماده‌شده را حفظ و بازنویسی مسیر و سرو پوشهٔ میزبان را بررسی کنید |
| دامنهٔ اختصاصی بعد از انتشار حذف می‌شود | `public/CNAME` را روی منبع کامیت کنید تا ناشر آن را نگه دارد |
| دامنه یا گواهی آماده نیست | وضعیت دامنه در GitHub Pages و DNS را بررسی کنید و برای اعمال تغییرات زمان بدهید |
| GitHub ویدیوی حجیم را رد می‌کند | حجم را بهینه کنید یا روش رسانهٔ بیرونی و CDN تأییدشده در راهنمای محتوا را به کار ببرید |
| تصویر یا متن هنوز قدیمی است | ساخت منتشرشده را بررسی کنید، تازه‌سازی کامل انجام دهید و کش و نام نسخه‌دار فایل را بررسی کنید |
| Next.js هشدار می‌دهد هدرها روی خروجی استاتیک اعمال نمی‌شوند | در صورت نیاز هدرها را روی میزبان تنظیم کنید؛ سایت خروجی سرور Next.js اجرا نمی‌کند |

### دستورها و گزینه‌های انتشار

| دستور یا گزینه | معنی |
| --- | --- |
| `npm run build:pages` | فقط ساخت و آماده‌سازی `out/` با تنظیمات پیش‌فرض مقصد GitHub Pages |
| `npm run content:publish` | ساخت و انتشار با تنظیمات پیش‌فرض مقصد |
| `npm run deploy:pages` | نام دیگر اجرای همان اسکریپت انتشار |
| `-Repository` | مخزن مقصد Git؛ تغییر `origin` به‌تنهایی پیش‌فرض ناشر را تغییر نمی‌دهد |
| `-Branch` | شاخهٔ خروجی تولیدشده؛ پیش‌فرض `main` است و باید با تنظیم GitHub Pages هماهنگ باشد |
| `-BasePath` | پیشوند نشانی؛ پیش‌فرض `/Mandegar` و مقدار `/` به‌معنای بدون پیشوند است |
| `-SiteUrl` | نشانی کامل پایهٔ عمومی، همراه با زیرپوشه در صورت استفاده |
| `-BuildOnly` | گزینهٔ اسکریپت که `build:pages` استفاده می‌کند؛ انتشار را انجام نمی‌دهد |
| `-SkipBuild` | استفاده از `out/` موجود؛ فقط برای استفادهٔ پیشرفته، پس از ساخت تازه و تأییدشده برای همان مقصد |

گزینه‌ها بعد از `--` مربوط به npm قرار می‌گیرند؛ برای مثال:

```powershell
npm run build:pages -- -BasePath / -SiteUrl 'https://www.your-domain.com'
```

دستور معمول انتشار عمداً ساخت تازه انجام می‌دهد. `-SkipBuild` تنظیم نشانی تازه را روی خروجی قدیمی اعمال نمی‌کند و با ساخت دوباره، محتوای فعلی را اعتبارسنجی نمی‌کند؛ خروجی قدیمی می‌تواند محتوای اشتباه منتشر کند یا مسیرها را خراب کند.

### ترتیب معمول به‌روزرسانی

برای سایت GitHub Pages فعلی، پس از ویرایش، بازبینی و موفقیت تست‌های مرورگر متناسب با تغییر:

```powershell
Set-Location 'D:\Projects\Navid\Mandegar'
npm run content:check
if ($LASTEXITCODE -ne 0) { throw 'Content validation failed.' }
npm run lint
if ($LASTEXITCODE -ne 0) { throw 'Lint failed.' }
npm run typecheck
if ($LASTEXITCODE -ne 0) { throw 'Typecheck failed.' }
git diff --check
if ($LASTEXITCODE -ne 0) { throw 'Review the diff before committing.' }
git add -- content public
# Stage any additional edited source files individually before the commit.
git diff --cached --stat
git commit -m 'feat: update website content'
if ($LASTEXITCODE -ne 0) { throw 'Source commit failed.' }
git push origin source
if ($LASTEXITCODE -ne 0) { throw 'Source push failed.' }
npm run content:publish
if ($LASTEXITCODE -ne 0) { throw 'Publication failed.' }
```

برای **انتشار نهایی محتوای عمومی**، پیش از کامیت و انتشار باید `npm run content:check -- --strict` هم موفق باشد. برای **دامنهٔ اختصاصی**، گزینه‌های دامنه را روی آخرین دستور انتشار وارد کنید. هر انتشار را با بررسی عمومی بخش ۸ تمام کنید.
