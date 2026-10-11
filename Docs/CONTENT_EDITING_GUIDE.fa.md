# راهنمای کامل ویرایش محتوای ماندگار

[English version](CONTENT_EDITING_GUIDE.md) · [راهنمای فارسی انتشار سایت](DEPLOYMENT_GUIDE.fa.md)

این راهنما برای تغییر متن‌ها، تصاویر، ویدیوها، لوگوی همراهان و تصاویر نمایشگرهای سایت فعلی است. دستورها را در **Windows PowerShell** و از پوشهٔ `D:\Projects\Navid\Mandegar` اجرا کنید. پس از بررسی محتوا، مراحل [راهنمای انتشار](DEPLOYMENT_GUIDE.fa.md) را دنبال کنید.

محتوا هنگام ساخت سایت از فایل‌های محلی JSON و TypeScript خوانده می‌شود و به حساب CMS یا Sanity نیاز ندارد. بیشتر صفحات از `content/` استفاده می‌کنند؛ صفحهٔ اصلی متحرک، متن و تنظیمات دیگری در `app/` و `components/` و تصاویر و مدل‌هایی در `public/` دارد. ذخیرهٔ فایل منبع، پیش‌نمایش محلی را به‌روز می‌کند. سایت عمومی پس از ساخت و انتشار دوباره تغییر می‌کند.

مسیرها، نام فیلدها، گزینه‌ها و دستورها عمداً با همان حروف لاتین نسخهٔ انگلیسی نگه داشته شده‌اند تا قابل جست‌وجو و کپی باشند. در مثال‌ها، مسیرهای نمونه و متن‌های داخل کروشه را با فایل‌ها و اطلاعات تأییدشدهٔ خودتان جایگزین کنید. ورودی نمونه را به شیء یا آرایهٔ موجود اضافه کنید؛ کل مجموعه را با یک مثال جایگزین نکنید.

## فهرست

1. [آماده‌سازی پیش‌نمایش محلی](#content-01)
2. [ویرایش صحیح متن‌های چندزبانه](#content-02)
3. [پیدا کردن منبع هر متن](#content-03)
4. [ویرایش تمام بخش‌های صفحهٔ اصلی](#content-04)
5. [ویرایش پروژه‌ها و صفحات شرح پروژه](#content-05)
6. [ویرایش خدمات](#content-06)
7. [ویرایش دربارهٔ ما و همراهان](#content-07)
8. [ویرایش تماس با ما](#content-08)
9. [ویرایش منو، پایین صفحه و هویت بصری](#content-09)
10. [جایگزینی تصاویر](#content-10)
11. [افزودن ویدیو و زیرنویس](#content-11)
12. [ویرایش تصاویر و نمایشگرهای سه‌بعدی](#content-12)
13. [ویرایش سئو و متن حقوقی](#content-13)
14. [اعتبارسنجی و بازبینی](#content-14)
15. [مرجع فیلدهای متن مشترک](#content-15)
16. [رفع اشکال ویرایش محتوا](#content-16)

<a id="content-01"></a>

## 1. آماده‌سازی پیش‌نمایش محلی

### گام ۱ — باز کردن پوشهٔ کد منبع

```powershell
Set-Location -LiteralPath "D:\Projects\Navid\Mandegar"
git status --short --branch
git branch --show-current
node --version
npm --version
```

روی شاخهٔ `source` کار کنید. شاخهٔ `main` در مخزن آنلاین، فایل‌های تولیدشدهٔ GitHub Pages را نگه می‌دارد و با اسکریپت انتشار مدیریت می‌شود. اگر روی شاخهٔ دیگری هستید، پیش از `git switch source` تغییرات فعلی را ذخیره یا کامیت کنید.

نسخهٔ نصب‌شدهٔ Next.js به Node.js نسخهٔ 20.9 یا بالاتر نیاز دارد. این پروژه با Node.js نسخهٔ 22.19 ساخته شده است. برای دریافت تازهٔ مخزن، وابستگی‌های ثبت‌شده را نصب کنید:

```powershell
npm ci
if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed." }
```

پیش از نصب دوبارهٔ وابستگی‌ها، سرور توسعه را متوقف کنید. اگر نصب فعلی درست کار می‌کند، برای هر ویرایش محتوا نیازی به نصب مجدد نیست.

### گام ۲ — ساخت تنظیمات محلی برای اولین بار

```powershell
if (-not (Test-Path -LiteralPath ".env.local")) {
  Copy-Item -LiteralPath ".env.example" -Destination ".env.local"
}
```

برای ویرایش محلی، محتوای `.env.local` می‌تواند چنین باشد:

```dotenv
NEXT_PUBLIC_SITE_URL=http://localhost:3300
MEDIA_CDN_ORIGIN=
```

فایل `.env.local` را وارد Git نکنید. اسکریپت انتشار استاتیک، نشانی مقصد و پیشوند مسیر را هنگام ساخت تنظیم می‌کند.

### گام ۳ — اجرای پیش‌نمایش

```powershell
npm run content:check
if ($LASTEXITCODE -ne 0) { throw "Fix the content errors first." }
npm run dev
```

نشانی‌های `http://localhost:3300/fa`، `http://localhost:3300/en` و `http://localhost:3300/ar` را باز کنید. این ترمینال باید باز و در حال اجرا بماند؛ برای اجرای بررسی‌ها از ترمینال دوم استفاده کنید. تغییرات را ذخیره کنید و اگر تصویر یا انیمیشن هنوز حالت قبلی را نشان می‌دهد، صفحه را تازه‌سازی کنید. برای توقف سرور `Ctrl+C` بزنید.

اگر پورت در حال استفاده است، دستور `npm run dev -- --port 3301` را اجرا کنید و سایت را روی پورت 3301 باز کنید.

<a id="content-02"></a>

## 2. ویرایش صحیح متن‌های چندزبانه

### گام ۱ — شناخت ساختار ترجمه

در پروژه‌ها، خدمات و رسانه‌ها معمولاً زبان‌ها داخل هر فیلد قرار دارند:

```json
{
  "title": {
    "fa": "عنوان فارسی تأییدشده",
    "en": "Approved English title",
    "ar": "العنوان العربي المعتمد"
  }
}
```

در فرهنگ متن‌های مشترک رابط کاربری، برعکس، فیلدها داخل هر زبان قرار دارند:

```json
{
  "fa": { "startProject": "شروع یک پروژه" },
  "en": { "startProject": "Start a project" },
  "ar": { "startProject": "ابدأ مشروعاً" }
}
```

این‌ها فقط نمونهٔ ساختار هستند و نباید جایگزین فایل کامل شوند.

### گام ۲ — تغییر مقدارها با حفظ شناسه‌ها

1. متن داخل علامت نقل‌قول را تغییر دهید.
2. مقدارهای متناظر `fa`، `en` و `ar` را به‌روز کنید.
3. نام کلیدها، شناسهٔ فصل‌ها و نامک‌ها را حفظ کنید، مگر اینکه عمداً مسیر صفحه یا ساختار مورد انتظار برنامه را تغییر می‌دهید.
4. فایل را با UTF-8 ذخیره کنید؛ در صورت نیاز نشانگر encoding در VS Code را بررسی کنید.

در JSON باید از نقل‌قول دوتایی استفاده کنید و بین ورودی‌ها ویرگول بگذارید. توضیح داخل کد و ویرگول بعد از آخرین ورودی مجاز نیست. نقل‌قول داخل متن را به‌شکل `\"` و شکست خط داخل رشته را به‌شکل `\n` بنویسید. بیشتر پاراگراف‌ها خودکار به خط بعد می‌روند.

عبارت‌های جایگزین‌شونده مثل `{count}`، `{piece}`، `{row}` و `{column}` را دقیقاً حفظ کنید؛ برنامه مقدارشان را وارد می‌کند. جهت راست‌به‌چپ برای فارسی و عربی خودکار است.

### گام ۳ — بررسی عنوان‌ها در موبایل

دستورهای موبایل و عنوان‌های متحرک را کوتاه نگه دارید. متن بلندتر می‌تواند تعداد خط‌ها، زمان تایپ، نمایش سه‌نقطه و فاصلهٔ کنترل‌ها را تغییر دهد. بعد از ویرایش عنوان‌های هیرو، توضیح خدمات، نام همراهان یا عنوان نهایی تک‌خطی، نتیجه را در عرض‌های 320 و 390 پیکسل و روی دسکتاپ بررسی کنید.

<a id="content-03"></a>

## 3. پیدا کردن منبع هر متن

با `Ctrl+Shift+F` در VS Code یک عبارت مشخص را جست‌وجو کنید، یا از ripgrep استفاده کنید:

```powershell
rg -n -F -- "Start a project" content app components lib
```

بعضی عبارت‌ها در چند منبع فعال وجود دارند و جست‌وجو ممکن است کامپوننت‌های قدیمی و بلااستفاده را هم پیدا کند. از این نقشهٔ منابع استفاده کنید:

| محتوای قابل مشاهده | منبع |
| --- | --- |
| کارت‌های پروژه و شرح کامل پروژه‌ها | [content/projects.json](../content/projects.json) |
| فهرست و صفحات جزئیات خدمات | [content/services.json](../content/services.json) |
| مسیر رسانه، متن جایگزین تصویر، توضیح و مجوز انتشار | [content/media.json](../content/media.json) |
| معرفی صفحات پروژه‌ها، خدمات، دربارهٔ ما، همراهان و تماس | [content/pages.json](../content/pages.json) |
| متن‌های صفحات داخلی، دعوت به اقدام، شرح اولیهٔ پروژه، پایین صفحه و صفحات خطا | [content/page-copy.json](../content/page-copy.json) |
| متن‌های مشترک و پیش‌فرض رابط کاربری | [content/ui.json](../content/ui.json) |
| برند، منو، آدرس، شبکه‌های اجتماعی و متن پایین صفحه | [content/site.json](../content/site.json) |
| مقصد ایمیل، تلفن و واتساپ | [content/contacts.json](../content/contacts.json) |
| اطلاعات افراد در صفحهٔ دربارهٔ ما | [content/people.json](../content/people.json) |
| نام و لوگوی تأییدشدهٔ همراهان و مشتریان | [content/trust.json](../content/trust.json) |
| گذار صفحهٔ اصلی، تایپ دربارهٔ ما، همراهان و بخش پایانی | [content/journey.json](../content/journey.json) |
| انتخاب پروژه‌های صفحهٔ اصلی و تنظیمات جایگزین قدیمی | [content/homepage.json](../content/homepage.json) |
| عنوان و توضیح پیش‌فرض جست‌وجو و اشتراک‌گذاری | [content/seo.json](../content/seo.json) |
| محتوا و وضعیت صفحهٔ حقوقی | [content/legal.json](../content/legal.json) |
| عنوان، توضیح، نام مرحله‌های هیرو، بارگذاری و دکمهٔ صدا | [app/[locale]/page.tsx](../app/[locale]/page.tsx)، بخش `fallbackCopy` |
| راهنمای موبایل و کنترل‌های عکس، بازی و نقاشی | [interaction-copy.ts](../components/experience/interactions/interaction-copy.ts) |
| متن و تصویر فصل‌های خدمات در صفحهٔ اصلی | [services-copy.ts](../components/experience/services-copy.ts) |
| متن داستان چهار دکمه روی نمایشگر | [touch-motion-story.ts](../components/experience/interactions/touch-motion-story.ts)، [installation-demo.ts](../components/experience/interactions/installation-demo.ts) |
| متن بررسی مشارکت، شخصیت‌ها و فعالیت‌ها | [intelligence-inspector-copy.ts](../components/experience/intelligence-inspector-copy.ts)، [intelligence-person-profile.ts](../components/experience/intelligence-person-profile.ts)، [intelligence-participation.ts](../components/experience/intelligence-participation.ts) |
| میان‌بر پروژه‌ها، عبور از مقدمه، بازگشت به بالا و متن ویژهٔ حالت جایگزین | [MandegarExperience.tsx](../components/experience/MandegarExperience.tsx) |
| برچسب‌های دسترس‌پذیری سربرگ و نام زبان‌ها | [Header.tsx](../components/layout/Header.tsx)، [lib/i18n.ts](../lib/i18n.ts) |
| متن داخل تصویر یا مدل | فایل اصلی تصویر یا مدل؛ بخش ۱۲ |

ویرایش معمول متن نیازی به تغییر دوربین، زمان‌بندی انیمیشن یا CSS ندارد. بعضی تنظیمات و برچسب‌های قدیمی در ترکیب فعلی استفاده نمی‌شوند؛ بخش‌های بعدی این موارد را مشخص می‌کنند.

<a id="content-04"></a>

## 4. ویرایش تمام بخش‌های صفحهٔ اصلی

### گام ۱ — ویرایش متن اصلی هیرو

در `app/[locale]/page.tsx`، بلوک‌های `fa`، `en` و `ar` را در `fallbackCopy` ویرایش کنید. با تنظیم فعلی `useContentOverrides: false`، این مقدارها منبع اصلی متن هستند.

| مرحله یا مورد | فیلدهای هر زبان |
| --- | --- |
| ورود | `arrivalLabel`، `arrivalBody` |
| کشف | `discoveryEyebrow`، `discoveryTitle`، `discoveryBody` |
| فعال‌سازی عکس | `activationEyebrow`، `activationTitle`، `activationBody` |
| داستان چهار دکمه | `engagementEyebrow`، `engagementTitle`، `engagementBody` |
| نورپردازی صحنه | `revealEyebrow`، `revealTitle`، `revealBody` |
| بازی جاده | `experiencesEyebrow`، `experiencesTitle`، `experiencesBody` |
| دیوار نقاشی | `connectionEyebrow`، `connectionTitle`، `connectionBody` |
| نمای کلی پروژه‌ها | `proofEyebrow`، `proofTitle`، `proofBody` |
| هوشمندی | `intelligenceEyebrow`، `intelligenceTitle`، `intelligenceBody` |
| دعوت | `invitationEyebrow`، `invitationTitle`، `invitationBody` |
| دکمهٔ شروع پروژه و بارگذاری | `startProject`، `loading` |
| برچسب‌های صدا | `enableSound`، `muteSound` |
| نام مراحل و دسترس‌پذیری نوار پیشرفت | از `phases.arrival` تا `phases.loop`، و `scroll` |
| متن‌های باقی‌ماندهٔ بازپخش، ناحیه‌ها و منو | `replay`، `zones.photo/game/touch`، `navigation.projects/services/about/contact` |

در موبایل، برخی توضیحات دسکتاپ با راهنمای کوتاه تعامل جایگزین می‌شوند. تغییر توضیح دسکتاپ به‌تنهایی آن راهنمای موبایل را تغییر نمی‌دهد.

### گام ۲ — ویرایش متن تعامل و موبایل

در `components/experience/interactions/interaction-copy.ts`:

- بخش‌های `english`، `persian` و `arabic`: عنوان و راهنمای ایستگاه‌ها، عبور و ادامه، توقف و ادامهٔ بازی و فرمان، بازگشت و پاک‌کردن و پایان نقاشی، تحویل عکس و راهنمای صفحه‌کلید.
- `mobileHeroCopy.fa/en/ar.instructions`: راهنماهای کوتاه عکس، لمس، صحنه، بازی و نقاشی.
- `mobileHeroCopy.fa/en/ar.intelligence`: راهنمای کوتاه هوشمندی در موبایل.

برای داستان چهار دکمه، `installationCopy` در `installation-demo.ts` را برای `views` و راهنمای دکمه‌ها و `copy` در `touch-motion-story.ts` را برای چهار عنوان، توضیح‌های دوخطی و برچسب‌های روی نمایشگر ویرایش کنید. شناسه‌های چهار جایگاه را حفظ کنید: `assembled`، `parts`، `details` و `image`.

برای برچسب‌های مخاطبان و مشارکت، سه منبع هوشمندی در جدول بالا را ویرایش کنید. اطلاعات نوشته‌شدهٔ شخصیت‌ها و مشارکت، دادهٔ نمایشی هستند و با شواهد واقعی کسب‌وکار در `trust.json` تفاوت دارند؛ این‌ها دادهٔ جمع‌آوری‌شده از بازدیدکنندگان نیستند.

### گام ۳ — ویرایش دربارهٔ ما، همراهان و پایان صفحه

در `content/journey.json`، بخش `copy.fa/en/ar` را ویرایش کنید:

| فیلد | کاربرد |
| --- | --- |
| `work` | نام دسترس‌پذیر بخش پروژه‌های منتخب |
| `entry` | گذار از هیرو به ادامهٔ صفحه |
| `aboutLabel`، `aboutBody`، `more` | برچسب دربارهٔ ما، توضیح و پیوند |
| `about` | متن چندخطی قدیمی؛ عنوان متحرک فعلی از `aboutTyping` استفاده می‌کند |
| `partnersLabel`، `partners` | عنوان و توضیح همراهان |
| `genericPartnersLabel`، `genericPartnersNote` | عنوان و توضیح زمانی که همراه واقعی اضافه نشده است |
| `disciplines` | نام‌های کارت‌های نمونه |
| `placeholder` | برچسب نشان نمونه |
| `finale` | عنوان نهایی تک‌خطی و متن دسترس‌پذیر عنوان تایپی |
| `contact` | پیوند گفت‌وگوی نهایی |
| `demo`، `scroll`، `detail` | برچسب‌های باقی‌مانده؛ بعضی فعلاً استفاده نمی‌شوند |

در همان فایل، `aboutTyping.fa/en/ar.base` و `.words` را ویرایش کنید. بخش پایه ثابت می‌ماند و کلمه‌ها تایپ و پاک می‌شوند. آرایهٔ کلمه‌ها را خالی نگذارید و ترکیب نهایی را در موبایل بررسی کنید.

فایل `MandegarExperience.tsx` شامل `postExperienceCopy` و متن‌های مستقیم هر زبان برای میان‌بر پروژه‌ها، عبور از مقدمه، بازگشت به بالا و جملهٔ ویژهٔ هوشمندی در حالت جایگزین متنی نیز هست. چند فیلد دیگر این بخش نگه داشته شده‌اند ولی نمایش داده نمی‌شوند.

### گام ۴ — انتخاب پروژه‌های صفحهٔ اصلی

مقدار `featuredProjectSlugs` در `content/homepage.json` را روی نامک‌های موجود و منتشرشده تنظیم کنید. نمونهٔ زیر از رکوردهای فعلی استفاده می‌کند؛ آن‌ها را با نامک پروژه‌های واقعی جایگزین کنید:

```json
{
  "featuredProjectSlugs": [
    "placeholder-exhibition-01",
    "placeholder-interactive-02",
    "placeholder-live-03"
  ]
}
```

آرایهٔ خالی از ترتیب پروژه‌های منتشرشده در `projects.json` استفاده می‌کند. حداکثر هشت پروژه انتخاب می‌شوند و اگر تعداد کمتر باشد، کارت‌ها در مدار تکرار می‌شوند. برای نمایش کامل مسیر متحرک حداقل یک پروژهٔ منتشرشده نگه دارید؛ بدون پروژه، چیدمان به حالت ثابت تغییر می‌کند. عنوان و تصویر از `title` و `media` پروژه می‌آیند. رسانهٔ اصلی پروژهٔ منتخب صفحهٔ اصلی را تصویر نگه دارید و ویدیو را در گالری قرار دهید.

### گام ۵ — شناخت تنظیمات جایگزین قدیمی

برای ترکیب فعلی، `useContentOverrides: false` را حفظ کنید. برای انتخاب پروژه‌ها نیازی به فعال‌کردن آن نیست. اگر عمداً فعال شود، `homepage.copy.<locale>` چنین نگاشتی دارد:

| فیلدهای جایگزین | بخش هیرو |
| --- | --- |
| `spaceTitle`، `spaceBody` | کشف |
| `systemTitle`، `systemBody` | فعال‌سازی عکس |
| `interactiveTitle`، `interactiveBody` | هم آشکارسازی و هم بازی |
| `proofTitle`، `proofBody` | نمای کلی پروژه‌ها |
| `intelligenceTitle`، `intelligenceBody` | هوشمندی |
| `ctaTitle`، `ctaBody` | دعوت |

فیلدهای دیگر هیرو از `fallbackCopy` استفاده می‌کنند. `sectionSettings` و `mediaOverrides` ترکیب متحرک فعلی را کنترل نمی‌کنند. اگر `ctaOverrides.conversion.href` تنظیم شود، مقصد دکمهٔ هیرو را تغییر می‌دهد؛ `label` آن فعلاً متن `startProject` را جایگزین نمی‌کند. دعوت نهایی ادامهٔ صفحه همچنان به تماس با ما می‌رود.

<a id="content-05"></a>

## 5. ویرایش پروژه‌ها و صفحات شرح پروژه

### گام ۱ — انتخاب یک رکورد

فایل `content/projects.json` را باز کنید. یک رکورد موجود را ویرایش کنید یا نسخهٔ کامل یک رکورد را داخل همان آرایه کپی کنید. شش نمونهٔ فعلی نامک‌هایی با پیشوند `placeholder-` دارند. پیش از حذف برچسب طرح مفهومی، متن و فایل‌هایشان را با محتوای واقعی جایگزین کنید.

### گام ۲ — تکمیل فیلدها

| فیلد | مقدار مورد نیاز |
| --- | --- |
| `slug` | نامک یکتا با حروف کوچک لاتین و کلمه‌های جداشده با یک خط تیره |
| `title`، `eyebrow`، `summary` | نام پروژه، برچسب معرفی و خلاصه در هر زبان |
| `category` و `categories` اختیاری | دسته‌بندی‌های چندزبانه برای نمایش و فیلتر |
| `client` اختیاری | نام تأییدشدهٔ مشتری در هر زبان |
| `year`، `location` | سال تأییدشده به‌شکل رشته و مکان در هر زبان |
| `media` | کلید تصویر اصلی از `media.json` |
| `gallery` | آرایهٔ مرتب کلیدهای رسانه؛ حداقل یک مورد |
| `services` | آرایهٔ غیرخالی شرح کارهای انجام‌شده در هر زبان |
| `serviceSlugs` | نامک خدمات موجود برای پیوندها |
| `challenge`، `approach`، `scope`، `outcome` | بخش‌های شرح پروژه در هر زبان |
| `credits` اختیاری | عوامل یا اعتبارهای تأییدشده در هر زبان |
| `relatedProjectSlugs` | نامک پروژه‌های موجود؛ خود پروژه را وارد نکنید |
| `publicationState` | یکی از `draft`، `published` یا `archived` |
| `isPlaceholder` | برای طرح نمونه `true`؛ پس از تأیید محتوای واقعی `false` |

برای یک دسته‌بندی، نام یکسانی در پروژه‌ها به کار ببرید تا فیلتر یکپارچه بماند. `services` متن نمایشی است و `serviceSlugs` رابطه و پیوند است؛ مقدار یکی، دیگری را خودکار پر نمی‌کند.

### گام ۳ — ثبت و اتصال رسانه

فایل‌ها را اضافه کنید، ورودی‌هایشان را در `media.json` بسازید و سپس کلیدها را استفاده کنید:

```json
{
  "media": "yourProjectHero",
  "gallery": ["yourProjectDetail", "yourProjectFilm"],
  "serviceSlugs": ["event-production"],
  "relatedProjectSlugs": []
}
```

این مثال فقط بخشی از رکورد است. ابتدا کلیدهای رسانهٔ ارجاع‌شده را بسازید؛ روش آن در بخش‌های ۱۰ و ۱۱ آمده است.

### گام ۴ — انتشار و تنظیم ترتیب

هنگام آماده‌سازی رکورد از `draft` و پس از آماده‌شدن از `published` استفاده کنید. حالت `archived` پس از ساخت دوباره، رکورد را از فهرست و مسیر جزئیات حذف می‌کند. `isPlaceholder: true` یک رکورد منتشرشده را با برچسب طرح مفهومی نمایش می‌دهد و آن را پنهان نمی‌کند.

ترتیب آرایه، ترتیب فهرست و ناوبری پروژهٔ قبلی و بعدی را تعیین می‌کند. ترتیب صفحهٔ اصلی جداگانه با `featuredProjectSlugs` تنظیم می‌شود. مسیرهای `/fa/projects`، `/en/projects` و `/ar/projects` و صفحات جزئیات تغییرکرده را همراه با فیلترها، برش تصویر جلد، گالری و پیوندهای مرتبط بررسی کنید.

تغییر نامک منتشرشده، نشانی هر سه زبان را تغییر می‌دهد. انتخاب صفحهٔ اصلی، رابطه‌ها و تست‌هایی را که نامک قدیمی دارند به‌روز کنید. خروجی فعلی برای نامک قدیمی ریدایرکت خودکار تولید نمی‌کند؛ این کار به تنظیم میزبان یا تغییر برنامه نیاز دارد.

<a id="content-06"></a>

## 6. ویرایش خدمات

### گام ۱ — ویرایش فهرست و متن جزئیات

در `content/services.json` موارد زیر را به‌روز کنید:

- `slug`، `number`، متن‌های چندزبانهٔ `title`، `summary` و `detail` و کلید ثبت‌شدهٔ `media`.
- `capabilities` و `deliverables`: آرایه‌های غیرخالی از متن چندزبانه.
- `process`: ورودی‌های دارای `title` و `body` چندزبانه.
- `faq`: ورودی‌های دارای `question` و `answer` چندزبانه.
- `relatedProjectSlugs`، `publicationState` و `isPlaceholder`.
- `status` اختیاری: `current` یا `emerging`.

برای اعتبارسنجی، `number` را خالی نگذارید؛ شمارهٔ نمایشی از ترتیب خدمات منتشرشده دوباره محاسبه می‌شود. `emerging` خدمت در حال توسعه را با برچسب مشخص نشان می‌دهد.

### گام ۲ — ویرایش جداگانهٔ فصل صفحهٔ اصلی

در `components/experience/services-copy.ts`، فیلدهای `title.fa/en/ar` و `description.fa/en/ar` فصل مورد نظر را ویرایش کنید. `servicesCopy` برچسب مشترک بخش، راهنمای اسکرول و متن پیوند جزئیات خدمت را نگه می‌دارد.

| شناسهٔ فصل | نامک ثابت خدمت مرتبط | تصویر جایگزین |
| --- | --- | --- |
| `events` | `event-production` | `/media/services/events.webp` |
| `exhibitions` | `exhibitions-and-space` | `/media/services/exhibitions.webp` |
| `web-apps` | `websites-and-applications` | `/media/services/web-apps.webp` |
| `content` | `content-and-media` | `/media/services/content.webp` |
| `advertising` | `advertising-structures` | `/media/services/advertising.webp` |

این خدمات مرتبط را در حالت منتشرشده نگه دارید. افزودن خدمت تازه، محتوای فهرست و جزئیات می‌سازد ولی فصل متحرک تازه اضافه نمی‌کند. افزودن یا تغییر ترتیب فصل‌های سه‌بعدی به تغییر مدل و طراحی حرکت نیاز دارد.

### گام ۳ — بررسی هر دو نمایش

فصل صفحهٔ اصلی و صفحهٔ جزئیات مستقل را بررسی کنید؛ عنوان و توضیح آن‌ها از منابع جدا می‌آیند. مدل‌های کوچک سه‌بعدی نیز از تصاویر جایگزین مستقل هستند. برای تغییر فایل‌های تصویری و مدل‌ها به بخش ۱۲ مراجعه کنید.

<a id="content-07"></a>

## 7. ویرایش دربارهٔ ما و همراهان

### گام ۱ — ویرایش معرفی صفحات

در `content/pages.json`، هر صفحه فیلدهای چندزبانهٔ `heroKicker`، `title`، `intro` و `seo.title`/`seo.description` دارد.

دربارهٔ ما از کلیدهای ثابت `approach` و `geography` استفاده می‌کند: `kicker`، `title` و `body` آن‌ها و `approach.items` را برای اصول قابل مشاهده ویرایش کنید. همراهان از `network` استفاده می‌کند؛ `kicker`، `title` و `body` آن را تغییر دهید. افزودن کلید دلخواه، بخش تازه‌ای در چیدمان صفحه ایجاد نمی‌کند.

### گام ۲ — ویرایش روند کار و معرفی افراد

در هر زبان `page-copy.json`، فیلدهای `aboutWorkflowKicker`، `aboutWorkflowTitle`، `aboutWorkflowBody`، `aboutWorkflowSteps[].title/body` و گروه‌های `aboutTeam*` و `aboutCta*` را به‌روز کنید.

تا زمانی که فرد تأییدشده‌ای وجود ندارد، `aboutTeamRoles` نقش‌های نمونه را با `title`، `body` و کلید ثبت‌شدهٔ `media` نمایش می‌دهد. تا وقتی این نقش‌ها نمونه هستند، متن `aboutTeamPlaceholderNote` را مطابق واقعیت نگه دارید.

پروفایل واقعی را به آرایهٔ `content/people.json` اضافه کنید:

```json
{
  "name": "[Approved person name]",
  "role": { "fa": "[نقش تأییدشده]", "en": "[Approved role]", "ar": "[الدور المعتمد]" },
  "biography": { "fa": "[معرفی تأییدشده]", "en": "[Approved biography]", "ar": "[النبذة المعتمدة]" },
  "publicationState": "draft",
  "isPlaceholder": true
}
```

فیلدهای اختیاری `location` و `partnerType` رشتهٔ ساده هستند. فقط پس از تأیید، وضعیت را `published` و `isPlaceholder` را `false` کنید. پروفایل‌های تأییدشده جای نقش‌های تصویری را می‌گیرند. ساختار فعلی فیلدی برای عکس افراد ندارد؛ افزودن عکس به تغییر ساختار داده و قالب نیاز دارد.

### گام ۳ — افزودن نام و لوگوی همراهان واقعی

مدار کارت‌های صفحهٔ اصلی و صفحهٔ مستقل همراهان، هر دو از `trust.json.clients` استفاده می‌کنند. لوگو را اضافه کنید و سپس رکورد مشتری یا همراه را وارد کنید:

```json
{
  "name": "[Approved partner name]",
  "logo": "/media/partners/your-partner-logo.webp",
  "url": "https://your-partner-domain.com",
  "sector": "[Confirmed sector]",
  "publicationState": "draft",
  "isPlaceholder": true,
  "approvalNote": "[Record permission to publish this name and logo]"
}
```

نشانی نمونه را با نشانی تأییدشده جایگزین کنید یا آن را حذف کنید. `logo` مسیر مستقیم فایل است و کلید `media.json` نیست. پس از تأیید، `published` و `isPlaceholder: false` را تنظیم کنید. نام‌ها رشتهٔ مشترک بین زبان‌ها هستند؛ نام چندزبانهٔ همراهان به تغییر ساختار داده نیاز دارد.

همراهان واقعی منتشرشده، جای کارت‌های نمونهٔ حوزه‌ها را می‌گیرند. اگر لوگو موجود نباشد، متن یا نشان حروف نمایش داده می‌شود. `url` در صفحهٔ مستقل به وب‌سایت همراه پیوند می‌دهد؛ کارت‌های مدار صفحهٔ اصلی فعلاً پیوند مستقل وب‌سایت ندارند. `partnersCtaTitle`، `partnersCtaBody`، `partnersWebsiteLabel` و `partnersPlaceholderNote` را در هر زبان `page-copy.json` به‌روز کنید.

### گام ۴ — شناخت فیلدهای شواهد

فیلدهای `trust.json.metrics` و `.testimonials` نیز وضعیت انتشار، نشان نمونه و `approvalNote` دارند. شاخص‌ها به `label` و `context` چندزبانه، `value`، `unit` اختیاری و `sourceNote` نیاز دارند. نظرها به `quote`، `person`، `role` و `organization` چندزبانه نیاز دارند.

این رکوردها اعتبارسنجی می‌شوند، اما صفحهٔ اصلی فعلی بخش شاخص‌های کسب‌وکار یا نظر مشتریان را نمایش نمی‌دهد. افزودن رکورد به‌تنهایی بخش تازه نمی‌سازد. فقط ادعاها و شواهد تأییدشده را وارد کنید.

<a id="content-08"></a>

## 8. ویرایش تماس با ما

### گام ۱ — ویرایش معرفی و متن هدف تماس

برای معرفی، `pages.contact` را ویرایش کنید. در `page-copy.json`، گروه‌های `contactChannels*`، `contactSales*`، `contactGeneral*`، `contactInternational*` و `contactWhatsapp*` را در هر زبان تغییر دهید.

عنوان و توضیح قابل مشاهدهٔ هدف تماس از این گروه‌ها می‌آید. فیلدهای `label` و `description` خود کانال، همهٔ عنوان‌های هدف تماس را در قالب فعلی جایگزین نمی‌کنند.

### گام ۲ — تنظیم مقصد واقعی تماس

در `contacts.json`، برای هر هدف یعنی `sales`، `general`، `international` یا `whatsapp`:

1. `label` چندزبانه و `description` اختیاری را ویرایش کنید.
2. حداقل یکی از `email`، `phone` یا `whatsapp` تأییدشده را وارد کنید.
3. پس از بررسی، `isPlaceholder: false` را تنظیم کنید.
4. در صورت نیاز متن نمایشی `availabilityText.fa/en/ar` را اضافه کنید.

ایمیل باید نشانی ساده و بدون `mailto:` باشد. تلفن از قالب E.164 استفاده می‌کند: علامت `+`، کد کشور و ارقام، بدون فاصله یا جداکننده. واتساپ شمارهٔ بین‌المللی یا نشانی HTTPS روی `wa.me` می‌پذیرد. پایین صفحه از همین مقصدها استفاده می‌کند.

کانال نمونه نباید پیوند تماس قابل استفاده داشته باشد. برای انتشار نهایی، رکورد نمونهٔ بلااستفاده را حذف کنید و آن را تأییدنشده باقی نگذارید. `department`، `country` و `availability` داده‌های اختیاری نگه‌داری‌شده هستند؛ متن زمان دسترسی قابل مشاهده از `availabilityText` می‌آید.

### گام ۳ — ویرایش الگوی شرح اولیهٔ پروژه

در همهٔ زبان‌ها، `briefKicker`، `briefTitle`، `briefBody`، `briefFields`، `copyBrief`، `copiedBrief`، `copyBriefFallback`، `copyBriefFailed` و `briefPrivacyNote` را به‌روز کنید.

صفحه یک الگوی متنی را کپی می‌کند و فرم ارسال نمی‌کند یا خودکار ایمیل نمی‌فرستد. گزینهٔ باقی‌ماندهٔ `callbackForm` سامانهٔ دریافت فرم ایجاد نمی‌کند. ارسال فرم به پیاده‌سازی جداگانه یا سرویس دریافت نیاز دارد.

### گام ۴ — آزمودن راه‌های تماس

پیوند ایمیل، تلفن و واتساپ را در صفحهٔ تماس و پایین صفحه، از جمله روی گوشی واقعی، باز کنید. متن کپی‌شدهٔ شرح اولیه را در هر سه زبان بررسی کنید.

<a id="content-09"></a>

## 9. ویرایش منو، پایین صفحه و هویت بصری

### گام ۱ — ویرایش تنظیمات سایت

| فیلد در `content/site.json` | کاربرد |
| --- | --- |
| `title` | نام برند در سربرگ و پایین صفحه و هویت مشترک |
| `copyrightHolder` | صاحب حق نشر؛ سال خودکار تولید می‌شود |
| `navigation[].label/path/order` | برچسب‌های ترجمه‌شده، مقصد داخلی و ترتیب |
| `footerLine`، `globalLine` | متن چندزبانهٔ پایین صفحه |
| `address` | آدرس تأییدشدهٔ اختیاری در هر زبان |
| `socialLinks` | `label` قابل مشاهده و `url` تأییدشدهٔ HTTPS |
| `brandMark` | مسیر اختیاری لوگوی سربرگ و پایین صفحه |
| `socialImage` | مسیر تصویر مشترک اشتراک‌گذاری |

مسیرهای منو معمولاً زبان را ندارند؛ مانند `projects`، `services`، `about`، `partners` و `contact`. در صفحهٔ اصلی، پیوندها به بخش شناخته‌شده اسکرول می‌کنند و در صفحات داخلی، مسیر مستقل را باز می‌کنند. هش‌های قدیمی `#showcase`، `#services`، `#about`، `#partners` و `#contact` همچنان پشتیبانی می‌شوند. برچسب‌های تنظیم‌شده را با مقدارهای جایگزین `ui.<locale>.navigation` هماهنگ نگه دارید.

### گام ۲ — ویرایش متن پایین صفحه

برچسب‌های `footer*`، `privacy`، `copyright` و `startProject` را در هر زبان `page-copy.json` ویرایش کنید. `footerConceptNote` حتی پس از جایگزینی پروژه‌های نمونه نمایش داده می‌شود؛ آن را با محتوای نهایی هماهنگ کنید.

### گام ۳ — جایگزینی لوگوی مربوط

- سربرگ و پایین صفحه: `site.brandMark` را تنظیم و فایل آن را اضافه کنید. اگر تنظیم نشود، دایرهٔ داخلی باقی می‌ماند.
- لوگوی پایانی صفحهٔ اصلی: `public/images/mandegar-finale-logo.webp` با اندازهٔ فعلی 1800×1031. شفافیت و نسبت تصویر را حفظ کنید؛ این فایل هم تصویر و هم ماسک است.
- تصویر اشتراک‌گذاری: `public/images/mandegar-social.png` با اندازهٔ 1200×630 یا مسیر دیگر در `site.socialImage`. فایل SVG منبع کنار آن است؛ ویرایش SVG، فایل PNG را خودکار بازسازی نمی‌کند.
- نوشته‌های سه‌بعدی: تصویر یا مدل بیک‌شده را تغییر دهید؛ تغییر `site.title` آن‌ها را عوض نمی‌کند.

تنظیم فونت فارسی در `lib/fonts.ts` و `styles/fonts/rokh-fa-num/` است. ویرایش معمول متن نیازی به تغییر فونت ندارد.

<a id="content-10"></a>

## 10. جایگزینی تصاویر

### گام ۱ — آماده‌سازی فایل‌های انتشار

نام‌های توصیفی با حروف کوچک و پسوند نسخه به کار ببرید؛ برای مثال:

```text
public/media/projects/your-project/hero-v1.webp
public/media/projects/your-project/detail-v1.webp
public/media/projects/your-project/hero-mobile-v1.webp
public/media/partners/your-partner-logo.webp
```

فایل اصلی با اندازهٔ کامل را جدا نگه دارید. برای عکس معمول پروژه، عرض حدود 1600 پیکسل نقطهٔ شروع مناسبی است و در صورت نیاز برش کوچک‌تری برای موبایل تهیه کنید. این پیشنهاد برای آماده‌سازی محتواست و محدودیت اعتبارسنجی نیست. خروجی استاتیک فایل‌ها را بدون بهینه‌سازی تصویر هنگام اجرا سرو می‌کند؛ اندازهٔ مناسب را پیش از انتشار آماده کنید.

برای عکس از WebP و برای لوگو از WebP یا PNG شفاف یا SVG مورد اعتماد استفاده کنید. برش را بررسی کنید؛ ساختار فعلی رسانه فیلد نقطهٔ کانونی ندارد. نام نسخه‌دار، بررسی تغییر فایل در برابر کش را آسان‌تر می‌کند.

### گام ۲ — تبدیل اختیاری عکس

Sharp از قبل نصب است. پیش از اجرا، مسیر منبع و پوشهٔ نمونه را جایگزین کنید:

```powershell
New-Item -ItemType Directory -Force -Path ".\public\media\projects\your-project" | Out-Null
node -e "require('sharp')('D:/Assets/project-hero.jpg').rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 85 }).toFile('public/media/projects/your-project/hero-v1.webp').catch(error => { console.error(error); process.exitCode = 1; })"
```

برای موبایل، از برش مناسب و عرض کوچک‌تری مثل 800 استفاده کنید. نتیجه را بررسی کنید؛ بزرگ‌کردن منبع کم‌کیفیت جزئیات از دست‌رفته را برنمی‌گرداند.

### گام ۳ — ثبت فایل رسانه

یک کلید به شیء اصلی `content/media.json` اضافه کنید:

```json
{
  "yourProjectHero": {
    "src": "/media/projects/your-project/hero-v1.webp",
    "mobileSrc": "/media/projects/your-project/hero-mobile-v1.webp",
    "kind": "image",
    "alt": {
      "fa": "[شرح دقیق تصویر]",
      "en": "[Accurate image description]",
      "ar": "[وصف دقيق للصورة]"
    },
    "caption": {
      "fa": "[توضیح یا اعتبار تصویر]",
      "en": "[Caption or image credit]",
      "ar": "[تعليق أو نسبة الصورة]"
    },
    "isPlaceholder": false,
    "rightsStatus": "approved",
    "sourceNote": "[Actual source and permission to publish]"
  }
}
```

نشان‌های رسانهٔ واقعی را فقط پس از تأیید استفاده کنید. اگر `caption` یا `mobileSrc` ندارید، این فیلدهای اختیاری را حذف کنید. اعتبارسنج، وجود تمام فایل‌های محلی تعیین‌شده را بررسی می‌کند؛ حتی فایل‌های پیش‌نویس.

نشانی محلی با `/media/` یا `/images/` شروع می‌شود. `public`، نام زبان، `Mandegar`، حرف درایو یا پیشوند انتشار را وارد نکنید. برنامه پیشوند میزبان را اضافه می‌کند.

### گام ۴ — اتصال کلید به محتوا

مقدار `media` یا `gallery` پروژه، `media` خدمت یا `media` نقش دربارهٔ ما را روی این کلید تنظیم کنید. تغییر کلید مشترک، همهٔ ارجاع‌ها را تغییر می‌دهد؛ اگر فقط یک پروژه باید تغییر کند، کلید تازه بسازید.

کلیدهای فعلی: `spark`، `exhibition`، `interactive`، `photo`، `projectPhoto`، `intelligence`، `stage`، `videoPlaceholder`، `webApps` و `advertising`. پیش از تغییر کاربرد یک کلید، محل استفادهٔ آن را جست‌وجو کنید:

```powershell
rg -n -F -- '"exhibition"' content app components
```

تصاویر صفحات محتوایی از `mobileSrc` پشتیبانی می‌کنند. کارت‌های متحرک پروژه در صفحهٔ اصلی فعلاً از `src` اصلی استفاده می‌کنند؛ منبع موبایل جداگانه، برش این کارت‌ها را تغییر نمی‌دهد.

### گام ۵ — CDN اختیاری رسانه

مقدار `MEDIA_CDN_ORIGIN` را روی یک مبدأ HTTPS مثل `https://media.your-domain.com`، بدون مسیر یا اطلاعات ورود تنظیم کنید. از نشانی کامل رسانه روی همان مبدأ استفاده کنید. پس از تغییر تنظیمات محیط، سرور توسعه را دوباره اجرا کنید و برای انتشار، ساخت تازه انجام دهید.

برای رسانهٔ استفاده‌شده در canvas یا WebGL و زیرنویس بیرونی، CORS مناسب را روی CDN تنظیم کنید. فایل‌ها را در صحنهٔ واقعی آزمایش کنید. تغییر نشانی به ساخت دوباره نیاز دارد؛ جایگزینی محتوای فایل روی نشانی قبلی نیز نیازمند بررسی کش است.

<a id="content-11"></a>

## 11. افزودن ویدیو و زیرنویس

### گام ۱ — انتخاب محل پشتیبانی‌شده

| محل نمایش | رفتار |
| --- | --- |
| گالری جزئیات پروژه | کنترل پخش ویدیو پشتیبانی می‌شود |
| رسانهٔ اصلی جزئیات خدمت | کنترل پخش ویدیو پشتیبانی می‌شود |
| رسانهٔ اصلی فهرست پروژه‌ها | تصویر پوستر ویدیو نمایش داده می‌شود |
| جلد پروژه در صفحهٔ اصلی متحرک | انتظار تصویر دارد؛ جلد را عکس نگه دارید و ویدیو را در گالری بگذارید |
| سطوح رسانهٔ همراهان و پایان صفحه روی دسکتاپ | می‌توانند از ویدیوهای گالری استفاده کنند |
| سطوح رسانهٔ همراهان و پایان صفحه روی موبایل | از پوستر ویدیو استفاده می‌کنند |
| نمایشگر بازی، نقاشی و داستان | محتوای تعاملی canvas است؛ جایگزینی با ویدیوی معمول به توسعه نیاز دارد |

قالب جزئیات و فهرست پروژه از ویدیوی اصلی پشتیبانی می‌کند، ولی مسیر فعلی جلد صفحهٔ اصلی، آن را به پوستر تبدیل نمی‌کند. برای پروژهٔ منتخب از جلد تصویری و ویدیوی گالری استفاده کنید، مگر اینکه این مسیر تغییر کند.

### گام ۲ — آماده‌سازی ویدیو و پوستر

برای مسیر معمول انتشار، فایل مستقیم MP4 با تصویر H.264 و صدای AAC تهیه کنید. نشانی صفحهٔ YouTube یا Vimeo، منبع فایل برای کامپوننت فعلی نیست. پوستر و در صورت نیاز نسخهٔ کوچک‌تر موبایل را آماده کنید.

بستهٔ نصب‌شدهٔ `ffmpeg-static` ابزار محلی تبدیل را فراهم می‌کند. مسیرهای نمونه را جایگزین کنید، پوشهٔ خروجی را بسازید و نام خروجی تازه به کار ببرید:

```powershell
New-Item -ItemType Directory -Force -Path ".\public\media\projects\your-project" | Out-Null
$ffmpegPath = node -p "require('ffmpeg-static')"
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $ffmpegPath)) { throw "Video encoder is unavailable; check npm ci." }
& $ffmpegPath -i "D:\Assets\project-film.mp4" -vf "scale=1280:-2" -c:v libx264 -crf 24 -preset medium -c:a aac -b:a 128k -movflags +faststart ".\public\media\projects\your-project\film-v1.mp4"
if ($LASTEXITCODE -ne 0) { throw "Video encoding failed." }
& $ffmpegPath -ss "00:00:02" -i ".\public\media\projects\your-project\film-v1.mp4" -frames:v 1 ".\public\media\projects\your-project\film-poster-v1.jpg"
if ($LASTEXITCODE -ne 0) { throw "Video poster creation failed." }
```

زمان مناسبی برای پوستر انتخاب کنید. برای موبایل، تبدیل را با عرض کوچک‌تر مثل 720 و نام خروجی دیگر تکرار کنید. پیش از تعیین فشرده‌سازی، کیفیت جزئیات و حجم را بررسی کنید.

### گام ۳ — ثبت ویدیو

```json
{
  "yourProjectFilm": {
    "src": "/media/projects/your-project/film-v1.mp4",
    "mobileSrc": "/media/projects/your-project/film-mobile-v1.mp4",
    "poster": "/media/projects/your-project/film-poster-v1.jpg",
    "captionsSrc": "/media/projects/your-project/film-captions.vtt",
    "kind": "video",
    "alt": {
      "fa": "[شرح محتوای فیلم]",
      "en": "[Description of the film]",
      "ar": "[وصف محتوى الفيلم]"
    },
    "isPlaceholder": false,
    "rightsStatus": "approved",
    "sourceNote": "[Actual source and approved film/audio rights]"
  }
}
```

اگر فایل `mobileSrc` یا `captionsSrc` وجود ندارد، آن فیلد را حذف کنید. ویدیو به `poster` نیاز دارد. کلید را به گالری پروژه یا `media` خدمت اضافه کنید. `kind: "video-placeholder"` تصویر و برچسب نمونه نمایش می‌دهد و ویدیو پخش نمی‌کند.

### گام ۴ — تهیهٔ زیرنویس در صورت نیاز

فایل WebVTT با UTF-8 بسازید؛ برای مثال:

```vtt
WEBVTT

00:00:00.000 --> 00:00:03.000
Caption for the opening scene.

00:00:03.000 --> 00:00:06.000
Caption for the next scene.
```

`captionsSrc` یک مسیر مشترک است و شیء چندزبانه نیست. زیرنویس‌های جداگانهٔ فارسی، انگلیسی و عربی و انتخاب زبان به گسترش کامپوننت و ساختار داده نیاز دارند؛ برای هر زبان، فایل دیگری خودکار انتخاب نمی‌شود.

### گام ۵ — آزمایش پخش واقعی

ویدیوهای صفحات محتوایی کنترل پخش دارند، تکرار می‌شوند و ابتدا بی‌صدا هستند. وقتی کاهش حرکت و صرفه‌جویی داده فعال نباشد، تلاش می‌کنند خودکار پخش شوند؛ مرورگر ممکن است نپذیرد. با کاهش حرکت یا صرفه‌جویی داده، پخش منتظر اقدام کاربر می‌ماند. پخش و توقف، صدا، زیرنویس، نسخهٔ موبایل و پوستر را بررسی کنید.

ویدیوهای حجیم را از CDN تنظیم‌شده سرو کنید. GitHub در push معمول Git، فایل منفرد بزرگ‌تر از 100 MiB را نمی‌پذیرد. [مستند محدودیت حجم فایل GitHub](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github).

<a id="content-12"></a>

## 12. ویرایش تصاویر و نمایشگرهای سه‌بعدی

این فایل‌ها مستقیم و خارج از `media.json` بارگذاری می‌شوند.

### گام ۱ — شناسایی منبع فعال

| تصویر یا مدل | فایل یا منبع |
| --- | --- |
| دیوار نورپردازی هیرو | `public/media/hero/lighting-screen-v1.webp`، تنظیم‌شده در `scene-config.ts` |
| نمونهٔ تحویل عکس | `public/media/placeholders/photo-experience.webp`، بارگذاری مستقیم در `BakedMandegarScene.tsx` |
| تصویر جایگزین مسیر صفحه هنگام نبود رسانه | `public/media/placeholders/exhibition-space.webp`، بارگذاری مستقیم در `ConnectedJourney.tsx` |
| تصویر پازل و مرجع | `public/media/hero/connected-experience.webp` و جایگزین `public/media/mandegar/screens/mandegar-puzzle.webp`، در `puzzle-artwork.ts` |
| تصویرهای خودرو و جاده | `public/media/hero/race-cars.webp` و `race-road.webp`، در `race-artwork.ts` |
| پوسترهای جایگزین خدمات | پنج مسیر `public/media/services/*.webp` در `services-copy.ts` |
| مدل‌های کوچک متحرک خدمات | `public/models/services/mandegar-services.glb`، بارگذاری در `ServicesSceneCanvas.tsx` |
| مدل سالن، نمایشگاه و جمعیت | `public/models/mandegar/mandegar_environment.glb`، `mandegar_exhibition.glb` و `mandegar_crowd.glb` |
| مدل دکمهٔ لمسی | `public/models/mandegar/mandegar_touch_button.glb` |
| بافت‌های بیک‌شدهٔ حالت آرام و اوج | `public/textures/mandegar/baked/` و `mobile/`، تنظیم‌شده در `baked-scene-contract.ts` |
| لوگوی پایانی | `public/images/mandegar-finale-logo.webp` |

فایل `race-idle.webp` نگه داشته شده ولی منبع فعال بازی جاده نیست. همهٔ فایل‌های `public/` لزوماً در نمایش فعلی استفاده نمی‌شوند.

### گام ۲ — جایگزینی تصاویر دوبعدی

فایل موجود را با تصویر سازگار جایگزین کنید یا مسیر فعال در کد را تغییر دهید. هنگام تغییر مسیر، `publicAssetPath(...)` را حفظ کنید. اندازه‌های فعلی مهم:

- تصویر نورپردازی: 1740×450؛ ترکیب عریض آن را حفظ کنید.
- تصویر connected-experience: اندازهٔ 1672×941.
- پوسترهای جایگزین خدمات: 896×896.
- تصویرهای خودرو: 1774×887؛ چیدمان فریم‌های اطلس را حفظ کنید یا مختصات `race-artwork.ts` را به‌روز کنید.
- جاده: 1024×1536؛ چیدمان جاده و تکرار بافت را حفظ کنید.
- لوگوی پایانی: 1800×1031 با شفافیت.

داستان چهار دکمه با کد رسم می‌شود. جایگزینی تصویر پازل، متن و صحنه‌های ترسیم‌شدهٔ آن داستان را تغییر نمی‌دهد.

### گام ۳ — بازسازی پوسترهای جایگزین خدمات

PNGهای منبع را در `Docs/CreativeProduction/3d/services/` جایگزین کنید و سپس اجرا کنید:

```powershell
node .\scripts\blender\prepare-services-posters.mjs
```

این دستور هر پنج WebP جایگزین و manifest آن‌ها را بازسازی می‌کند و GLB را دوباره نمی‌سازد. برای تغییر مدل‌های متحرک، فایل `.blend` مربوط را ویرایش کنید، متریال‌ها را دوباره بیک کنید و `mandegar-services.glb` را با حفظ سلسله‌مراتب و موقعیت فصل‌های مورد انتظار رندرر خروجی بگیرید.

### گام ۴ — تغییر نوشتهٔ داخل تصویر و تابلوها

متن داخل تصویر یا مدل به ویرایش تصویر، بافت یا مدل و خروجی گرفتن دوباره نیاز دارد. نوشته‌های مستقیم برند روی canvas در کد رسم قرار دارند. آن‌ها را پیدا کنید:

```powershell
rg -n -F -- "MANDEGAR" components/experience
```

رسم‌کننده‌های فعال شامل `ScrollScenes.tsx`، `StageBeamInteraction.tsx`، `DrawingInteraction.tsx` و `touch-motion-story.ts` هستند. هنگام تغییر نام برند، این‌ها و نوشته‌های سه‌بعدی را بررسی کنید.

### گام ۵ — بازسازی نسخه‌های بافت بیک‌شده

سازندهٔ فعلی صحنه به PNGهای 4096×4096 با نام‌های `env_quiet.png`، `env_peak.png`، `exhibit_quiet.png` و `exhibit_peak.png` نیاز دارد. Khronos KTX-Software را نصب کنید یا `KTX_TOKTX_PATH` را روی مسیر `toktx.exe` تنظیم کنید.

```powershell
npm run assets:textures -- "D:\Projects\Navid\mandegar3d\Texture\Update"
```

برای بازسازی فقط نقشه‌های انتخاب‌شده:

```powershell
npm run assets:textures -- "D:\Projects\Navid\mandegar3d\Texture\Update" --texture exhibit_quiet --texture exhibit_peak
```

خروجی، اطلس‌های WebP و KTX2 با اندازهٔ 4096 پیکسل برای دسکتاپ و 2048 برای موبایل است. این اندازه‌ها مربوط به مسیر فعلی ساخت صحنه هستند؛ عکس معمول پروژه از این مسیر استفاده نمی‌کند. UV مدل و نسخه‌های حالت آرام و اوج را حفظ کنید. برای تحویل مدل، [قرارداد فایل‌های سه‌بعدی](3D_ASSET_WORKFLOW.md) را ببینید.

### گام ۶ — در نظر گرفتن ویدیوی هیرو به‌عنوان تغییر برنامه

کامپوننت `BakedScreenController.tsx` دیوار مرکزی می‌تواند بافت ویدیو بارگذاری کند، ولی `ScrollScenes.tsx` و `StageBeamInteraction.tsx` نیز همان منبع نورپردازی را به‌عنوان تصویر مصرف می‌کنند. تعویض مسیر WebP با MP4 به‌تنهایی کافی نیست. ابتدا باید مدیریت هماهنگ پوستر و ویدیو پیاده‌سازی شود و تعامل زنده، گذارها، موبایل و کاهش حرکت بررسی شوند.

<a id="content-13"></a>

## 13. ویرایش سئو و متن حقوقی

### گام ۱ — ویرایش توضیحات جست‌وجو و اشتراک‌گذاری

در `content/seo.json`، هر زبان دارای `home`، `projects`، `services`، `about`، `partners`، `contact` و `legal` است و مقدار هر کدام به‌شکل `[title, description]` است.

صفحات داخلی در صورت وجود از `pages.<page>.seo.title` و `.description` استفاده می‌کنند و در غیر این صورت به `seo.json` برمی‌گردند. مقدار فعال را ویرایش کنید. فرادادهٔ جزئیات پروژه از عنوان، خلاصه و پوستر یا جلد آن و فرادادهٔ خدمت از عنوان و خلاصهٔ آن استفاده می‌کند.

هنگام ساخت، `SiteUrl` واقعی سایت عمومی را تنظیم کنید. این مقدار نشانی canonical، پیوند زبان‌های دیگر، نشانی نقشهٔ سایت و نشانی کامل اشتراک‌گذاری را کنترل می‌کند. هنگام تغییر تصویر اشتراک‌گذاری، `site.socialImage` را نیز تغییر دهید.

### گام ۲ — تکمیل متن حقوقی

`legal.json.title`، `.intro` و `.heading`/`.body` بخش‌ها را در همهٔ زبان‌ها ویرایش کنید. تا زمان بررسی، `status: "draft"` را حفظ کنید. پس از تأیید واقعی، `status: "approved"` و تاریخ معتبر `updatedAt` با قالب `YYYY-MM-DD` تنظیم کنید. پیام پیش‌نویس و رفتار ایندکس‌شدن خودکار تغییر می‌کند. اعتبارسنج، ساختار و وضعیت را بررسی می‌کند و صحت حقوقی متن را تأیید نمی‌کند. متن‌های رابط صفحهٔ حقوقی در `page-copy.json` هستند.

<a id="content-14"></a>

## 14. اعتبارسنجی و بازبینی

### گام ۱ — بررسی ساختار محتوا

```powershell
npm run content:check
```

خطاهایی مثل ترجمه یا فایل ناقص، کلید رسانهٔ ناشناخته، نامک تکراری، رابطهٔ خراب، تماس نامعتبر و رسانهٔ واقعی تأییدنشده را رفع کنید. محتوای نمونه با برچسب مشخص در ساخت پیش‌نمایش مجاز است.

### گام ۲ — بررسی محتوای انتشار نهایی

```powershell
npm run content:check -- --strict
```

این حالت، نمونه‌ها و پیش‌نویس‌های در انتظار بررسی را به خطای انتشار نهایی تبدیل می‌کند. وضعیت مخزن در تاریخ 2026-10-11 شامل 27 مورد است: شش پروژهٔ مفهومی، هفت خدمت نمونه، ده رسانهٔ نمونه، سه رکورد تماس تأییدنشده و متن حقوقی پیش‌نویس. آن‌ها را با محتوای واقعی تکمیل کنید یا پس از بررسی ارجاع‌ها، رسانه‌ها و تماس‌های بلااستفاده را حذف کنید. تغییر یک نشان به‌تنهایی محتوای تأییدشده تولید نمی‌کند.

اعتبارسنجی سخت‌گیرانه کیفیت متن، صحت ترجمه یا تصاویر بیک‌شده را ارزیابی نمی‌کند. خالی‌بودن آرایه‌های اختیاری همراهان و افراد به‌معنای نهایی‌بودن کارت‌های نمونهٔ نمایش‌داده‌شده نیست؛ صفحات را خودتان بررسی کنید.

### گام ۳ — بررسی کد ویرایش‌شده

```powershell
npm run lint
npm run typecheck
```

### گام ۴ — بازبینی صفحات تغییرکرده

نسخه‌های فارسی، انگلیسی و عربی را در اندازهٔ موبایل و دسکتاپ بررسی کنید:

- تمام مرحله‌های تغییرکردهٔ هیرو، راهنمای کوتاه موبایل، عنوان تایپی و کنترل تعامل.
- ترتیب پروژه‌های منتخب، پیوند عنوان و تصویر، شرح پروژه و گالری.
- فصل‌های خدمات صفحهٔ اصلی و جزئیات مستقل.
- مدار و صفحهٔ همراهان و پروفایل یا نقش‌های دربارهٔ ما.
- سربرگ، منو، پایین صفحه، مقصد تماس و متن کپی‌شدهٔ شرح اولیه.
- کاهش حرکت، فوکوس صفحه‌کلید، برش تصویر و کنترل و پوستر ویدیو.
- فرادادهٔ جست‌وجو و اشتراک‌گذاری و اطلاع‌رسانی حقوقی.

### گام ۵ — اجرای بررسی مرورگر

```powershell
npx playwright install chromium
npm run test:e2e -- tests/e2e/content-files.spec.ts tests/e2e/content-navigation.spec.ts tests/e2e/interior-content.spec.ts tests/e2e/partners-page.spec.ts tests/e2e/footer.spec.ts
```

برای بررسی کامل انتشار، `npm run test:e2e` را اجرا کنید. برخی تست‌ها به نامک یا متن نمونهٔ فعلی وابسته هستند؛ جایگزینی آن‌ها ممکن است به تغییر انتظارهای تست نیاز داشته باشد. خطا را بررسی کنید تا دادهٔ قدیمی تست را از خرابی واقعی مسیر یا چیدمان تشخیص دهید. گزارش را با `npx playwright show-report` باز کنید.

### گام ۶ — ساخت و انتشار

از [راهنمای فارسی انتشار](DEPLOYMENT_GUIDE.fa.md) استفاده کنید. ویرایش JSON در GitHub، push شاخهٔ `source` یا بارگذاری JSON به‌تنهایی اسکریپت انتشار این مخزن را اجرا نمی‌کند. به‌روزرسانی عمومی به ساخت و انتشار تازه نیاز دارد.

<a id="content-15"></a>

## 15. مرجع فیلدهای متن مشترک

فایل `content/page-copy.json` در بخش‌های `fa`، `en` و `ar` کلیدهای متناظر دارد. هر فیلد تغییرکرده را در هر سه زبان ویرایش کنید.

| بخش | کلیدها |
| --- | --- |
| منو و عمومی | `home`, `navigationLabel`, `breadcrumbs`, `projects`, `services`, `overview`, `backToProjects`, `backToServices`, `startProject`, `exploreServices`, `viewServices`, `viewProjects`, `viewProject`, `viewService`, `skipToContent` |
| شرح پروژه و فراداده | `challenge`, `approach`, `scope`, `outcome`, `credits`, `client`, `year`, `location`, `category`, `service`, `project`, `projectContents`, `projectIndex` |
| فهرست و فیلتر | `emptyProjects`, `emptyProjectsBody`, `clearFilters`, `allCategories`, `results`, `filterProjects`, `showAllProjects`, `projectCount`, `projectArchiveAsideTitle`, `projectArchiveAsideBody` |
| گالری و پروژه‌های مرتبط | `projectGallery`, `projectGalleryBody`, `relatedProjects`, `relatedProjectsBody`, `nextProject`, `previousProject`, `serviceRelatedProjectsBody` |
| خدمات | `capabilities`, `deliverables`, `process`, `faq`, `relatedServices`, `servicesCount`, `serviceArchiveAsideTitle`, `serviceArchiveAsideBody`, `serviceContents`, `serviceOverview`, `serviceWorkingTogether`, `serviceWorkingTogetherBody` |
| دعوت به اقدام | `projectCtaTitle`, `projectCtaBody`, `serviceCtaTitle`, `serviceCtaBody`, `contactCtaTitle`, `contactCtaBody` |
| پیام‌های وضعیت | `conceptLabel`, `conceptNotice`, `conceptMedia`, `videoConcept`, `emergingLabel`, `emergingNotice` |
| دربارهٔ ما | `aboutWorkflowKicker`, `aboutWorkflowTitle`, `aboutWorkflowBody`, `aboutWorkflowSteps[].title/body`, `aboutTeamKicker`, `aboutTeamTitle`, `aboutTeamBody`, `aboutTeamPlaceholderNote`, `aboutTeamRoles[].title/body/media`, `aboutCtaTitle`, `aboutCtaBody` |
| همراهان | `partnersCtaTitle`, `partnersCtaBody`, `partnersPlaceholderNote`, `partnersWebsiteLabel` |
| تماس | `contactChannelsKicker`, `contactChannelsTitle`, `contactChannelsBody`, `contactSalesTitle`, `contactSalesBody`, `contactGeneralTitle`, `contactGeneralBody`, `contactInternationalTitle`, `contactInternationalBody`, `contactWhatsappTitle`, `contactWhatsappBody`, `contactPlaceholderTitle`, `contactPlaceholderBody`, `contactEmail`, `contactPhone`, `contactWhatsapp` |
| شرح اولیهٔ پروژه | `briefKicker`, `briefTitle`, `briefBody`, `briefFields`, `copyBrief`, `copiedBrief`, `copyBriefFallback`, `copyBriefFailed`, `briefPrivacyNote` |
| پایین صفحه | `footerNavigation`, `footerContact`, `footerLegal`, `copyright`, `privacy`, `footerSocial`, `footerLanguages`, `footerCtaTitle`, `footerCtaBody`, `footerPlaceholder`, `footerConceptNote` |
| حقوقی | `legalKicker`, `legalContents`, `legalUpdated`, `legalDraftLabel`, `legalDraftNotice`, `legalApprovedLabel`, `legalQuestionTitle`, `legalQuestionBody`, `legalQuestionLink` |
| خطا و بازیابی | `notFoundTitle`, `notFoundBody`, `backHome`, `retry`, `errorTitle`, `errorBody` |

فایل `content/ui.json` در هر زبان شامل `navigation.projects/services/about/partners/contact`، `start`، `explore`، `viewProject`، `viewAll`، `selectedWork`، `placeholder`، `scroll`، `menu`، `close`، `availableSoon`، `all`، `sendMessage`، `callSales`، `whatsapp`، `readMore`، `backToProjects`، `emerging`، `noContact` و `footer` است. بعضی از این‌ها فیلدهای جایگزین نگه‌داری‌شده هستند و در نمایش فعلی استفاده نمی‌شوند.

برچسب‌های دسترس‌پذیری خانه و منوی سربرگ، مخفف زبان‌ها و نام زبان‌ها در `Header.tsx` و `lib/i18n.ts` هستند. برای متن‌های مستقیم باقی‌مانده، در `content`، `app`، `components` و `lib` جست‌وجو کنید. متن‌هایی که فقط داخل تصویر دیده می‌شوند، طبق بخش ۱۲ تغییر می‌کنند.

<a id="content-16"></a>

## 16. رفع اشکال ویرایش محتوا

| مشکل | موردی که باید بررسی کنید |
| --- | --- |
| متن صفحهٔ اصلی تغییر نکرده | منبع فعال هیرو، موبایل یا مسیر صفحه را ویرایش کنید؛ با تنظیم جایگزینی خاموش، `homepage.copy` فعال نیست |
| خدمت فقط در صفحهٔ جزئیات تغییر کرده | `services-copy.ts` را نیز به‌روز کنید |
| بخش تازهٔ JSON نمایش داده نمی‌شود | قالب از کلیدهای ثابت استفاده می‌کند؛ بخش دلخواه، شاخص‌ها و نظر مشتریان به توسعه نیاز دارند |
| تصویر پیدا نمی‌شود | بزرگی و کوچکی حروف نام فایل، وجود فایل، کلید رسانه و مسیر نسبت به ریشه را بررسی کنید |
| تصویر قبلی باقی مانده | نام نسخه‌دار بسازید، منبع را تغییر دهید، دوباره بسازید و کش مرورگر یا CDN را بررسی کنید |
| نوشته یا تصویر سه‌بعدی تغییر نکرده | مدل یا تصویر بیک‌شده را تغییر دهید؛ تصویر JSON آن را جایگزین نمی‌کند |
| پروژهٔ تازه دیده نمی‌شود | وضعیت انتشار، رسانه و انتخاب صفحهٔ اصلی را بررسی کنید |
| کارت‌های نمونهٔ همراهان باقی مانده | از `trust.clients` با وضعیت منتشرشده و بدون نشان نمونه استفاده کنید |
| فرد تازه دیده نمی‌شود | از `people.json` با وضعیت منتشرشده و بدون نشان نمونه استفاده کنید |
| ویدیو به‌شکل تصویر ثابت است | کارت‌ها و سطوح فضایی موبایل از پوستر استفاده می‌کنند؛ محل نمایش و سیاست پخش خودکار را بررسی کنید |
| جلد ویدیویی صفحهٔ اصلی را خراب کرده | رسانهٔ اصلی پروژهٔ منتخب را تصویر نگه دارید و ویدیو را در گالری بگذارید |
| پیوند تماس وجود ندارد | مقصد تأییدشده اضافه کنید و نشان نمونه را بردارید |
| توضیح جست‌وجو قدیمی است | مقدار فعال `pages.<page>.seo` را تغییر دهید، نه فقط مقدار جایگزین |
| محتوای عمومی قدیمی است | دوباره بسازید و منتشر کنید؛ push شاخهٔ `source` به‌تنهایی انتشار نیست |

پس از بازبینی کامل محتوا، [راهنمای فارسی انتشار](DEPLOYMENT_GUIDE.fa.md) را دنبال کنید.
