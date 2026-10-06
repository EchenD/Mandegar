import type { Locale } from "./i18n";
import { publicAssetPath } from "./public-asset-path";

export type Localized = Record<Locale, string>;

export type MediaAsset = {
  src: string;
  mobileSrc?: string;
  poster?: string;
  captionsSrc?: string;
  alt: Localized;
  caption?: Localized;
  kind: "image" | "video" | "video-placeholder";
  isPlaceholder?: boolean;
};

export type RelatedProject = {
  slug: string;
  title: Localized;
  summary: Localized;
  category: Localized;
  year: string;
  location: Localized;
  media: MediaAsset;
};

export type Project = {
  slug: string;
  title: Localized;
  eyebrow: Localized;
  summary: Localized;
  category: Localized;
  categories?: Localized[];
  client?: Localized;
  year: string;
  location: Localized;
  media: MediaAsset;
  gallery: MediaAsset[];
  services: Localized[];
  challenge: Localized;
  approach: Localized;
  scope: Localized;
  outcome: Localized;
  credits?: Localized;
  relatedProjects?: RelatedProject[];
  isPlaceholder: boolean;
};

export type Service = {
  slug: string;
  number: string;
  title: Localized;
  summary: Localized;
  detail: Localized;
  capabilities: Localized[];
  media: MediaAsset;
  status?: "current" | "emerging";
};

const placeholder = (src: string, alt: Localized, kind: MediaAsset["kind"] = "image"): MediaAsset => ({
  src: publicAssetPath(src),
  alt,
  kind,
  isPlaceholder: true,
});

export const media = {
  spark: placeholder("/media/placeholders/spark-architecture.webp", {
    fa: "جرقه‌ای نورانی که خطوط معماری را در فضای سفید شکل می‌دهد",
    en: "A luminous spark drawing architectural lines in a bright space",
    ar: "شرارة مضيئة ترسم خطوطاً معمارية في مساحة مشرقة",
  }),
  exhibition: placeholder("/media/placeholders/exhibition-space.webp", {
    fa: "فضای نمایشگاهی معاصر با ساختارهای روشن و بازدیدکنندگان",
    en: "A contemporary exhibition space with luminous structures and visitors",
    ar: "مساحة معرض معاصرة بهياكل مضيئة وزوار",
  }),
  interactive: placeholder("/media/placeholders/interactive-wall.webp", {
    fa: "بازدیدکننده‌ای در حال تعامل با دیوار دیجیتال",
    en: "A visitor interacting with a digital wall",
    ar: "زائر يتفاعل مع جدار رقمي",
  }),
  photo: placeholder("/media/placeholders/photo-experience.webp", {
    fa: "پرتره کم‌جزئیات یک بازدیدکننده در نور گرم غرفه عکس",
    en: "A low-poly portrait of a visitor in the warm photo booth light",
    ar: "صورة منخفضة التفاصيل لزائر داخل إضاءة كشك التصوير الدافئة",
  }),
  projectPhoto: placeholder("/media/placeholders/project-photo-experience.webp", {
    fa: "دو نفر در یک تجربه تصویری نورانی",
    en: "Two people enjoying a luminous photo experience",
    ar: "شخصان يستمتعان بتجربة تصوير مضيئة",
  }),
  intelligence: placeholder("/media/placeholders/event-intelligence.webp", {
    fa: "نقاط داده و خطوط نرم که در فضای شیشه‌ای به بینش تبدیل می‌شوند",
    en: "Data points and soft lines becoming insight in a glass space",
    ar: "نقاط بيانات وخطوط ناعمة تتحول إلى رؤى في فضاء زجاجي",
  }),
  stage: placeholder("/media/placeholders/stage-production.webp", {
    fa: "صحنه‌ای معاصر با نمایشگر بزرگ و نورپردازی آبی",
    en: "A contemporary stage with a large screen and blue lighting",
    ar: "منصة معاصرة بشاشة كبيرة وإضاءة زرقاء",
  }),
  videoPlaceholder: placeholder("/media/placeholders/stage-production.webp", {
    fa: "پیش‌نمایش ویدیویی موقت از یک اجرای رویداد",
    en: "Temporary video preview of an event delivery",
    ar: "معاينة فيديو مؤقتة لتنفيذ فعالية",
  }, "video-placeholder"),
};

const coreProjects: Project[] = [
  {
    slug: "placeholder-exhibition-01",
    title: { fa: "فضای گردهمایی", en: "The Gathering Space", ar: "مساحة اللقاء" },
    eyebrow: { fa: "دموی مفهومی / نمایشگاه", en: "Concept demo / Exhibition", ar: "عرض مفاهيمي / معرض" },
    summary: {
      fa: "مطالعه‌ای مفهومی درباره اینکه چگونه فضا، نور و تعامل می‌توانند آدم‌ها را به گردهمایی دعوت کنند.",
      en: "A concept study of how space, light and interaction can invite people to gather.",
      ar: "دراسة مفاهيمية لكيفية دعوة الناس إلى اللقاء من خلال المساحة والضوء والتفاعل.",
    },
    category: { fa: "نمایشگاه", en: "Exhibition", ar: "معرض" },
    year: "Demo",
    location: { fa: "نمونه مفهومی", en: "Concept study", ar: "دراسة مفاهيمية" },
    media: media.exhibition,
    gallery: [media.exhibition, media.interactive, media.stage],
    services: [
      { fa: "طراحی تجربه", en: "Experience design", ar: "تصميم التجربة" },
      { fa: "طراحی فضایی", en: "Spatial design", ar: "التصميم المكاني" },
      { fa: "تولید و اجرا", en: "Production and delivery", ar: "الإنتاج والتنفيذ" },
    ],
    challenge: {
      fa: "چطور یک سالن خالی می‌تواند به فضایی تبدیل شود که آدم‌ها را به دیدار و مشارکت دعوت می‌کند؟",
      en: "How can an empty hall become a space that invites people to meet and participate?",
      ar: "كيف تتحول قاعة فارغة إلى مساحة تدعو الناس إلى اللقاء والمشاركة؟",
    },
    approach: {
      fa: "ما ایده، فضا، محتوا و تعامل را در یک مسیر منسجم کنار هم قرار می‌دهیم.",
      en: "We connect idea, space, content and interaction into one coherent journey.",
      ar: "نربط الفكرة والمساحة والمحتوى والتفاعل في رحلة واحدة متماسكة.",
    },
    scope: {
      fa: "استراتژی، طراحی تجربه، طراحی فضایی، محتوا، فناوری، تولید فنی و اجرای میدانی.",
      en: "Strategy, experience design, spatial design, content, technology, technical production and on-site delivery.",
      ar: "الاستراتيجية وتصميم التجربة والتصميم المكاني والمحتوى والتقنية والإنتاج والتنفيذ الميداني.",
    },
    outcome: {
      fa: "این یک مطالعه مفهومی است؛ نتیجه‌ای از اجرای یک پروژه واقعی گزارش نمی‌شود.",
      en: "This is a concept study; no live project outcomes are reported.",
      ar: "هذه دراسة مفاهيمية؛ لا تُعرض نتائج مشروع منفّذ.",
    },
    isPlaceholder: true,
  },
  {
    slug: "placeholder-interactive-02",
    title: { fa: "دیوار زنده", en: "The Living Wall", ar: "الجدار الحي" },
    eyebrow: { fa: "دموی مفهومی / تعامل", en: "Concept demo / Interaction", ar: "عرض مفاهيمي / تفاعل" },
    summary: {
      fa: "مخاطب فقط تماشا نمی‌کند؛ با فضا وارد گفت‌وگو می‌شود.",
      en: "The audience does not only watch; it enters into a conversation with the space.",
      ar: "الجمهور لا يكتفي بالمشاهدة؛ بل يدخل في حوار مع المساحة.",
    },
    category: { fa: "تجربه تعاملی", en: "Interactive experience", ar: "تجربة تفاعلية" },
    year: "Demo",
    location: { fa: "نمونه مفهومی", en: "Concept study", ar: "دراسة مفاهيمية" },
    media: media.interactive,
    gallery: [media.interactive, media.photo, media.exhibition],
    services: [
      { fa: "طراحی تعامل", en: "Interaction design", ar: "تصميم التفاعل" },
      { fa: "تولید محتوا", en: "Content production", ar: "إنتاج المحتوى" },
      { fa: "نرم‌افزار و فناوری", en: "Software and technology", ar: "البرمجيات والتقنية" },
    ],
    challenge: {
      fa: "چطور یک دیوار دیجیتال می‌تواند تماشاگر را به مشارکت در داستان دعوت کند؟",
      en: "How can a digital wall invite visitors to take part in the story?",
      ar: "كيف يدعو جدار رقمي الزوار إلى المشاركة في القصة؟",
    },
    approach: {
      fa: "تعامل را از یک قابلیت تزئینی به بخشی از داستان برند تبدیل می‌کنیم.",
      en: "We turn interaction from a decorative feature into part of the brand story.",
      ar: "نحوّل التفاعل من ميزة زخرفية إلى جزء من قصة العلامة.",
    },
    scope: {
      fa: "ایده‌پردازی، طراحی بازی و تعامل، محتوا، نرم‌افزار، AV و پشتیبانی اجرا.",
      en: "Ideation, game and interaction design, content, software, AV and production support.",
      ar: "توليد الأفكار وتصميم الألعاب والتفاعل والمحتوى والبرمجيات والصوتيات والدعم الإنتاجي.",
    },
    outcome: {
      fa: "این یک مطالعه مفهومی است؛ نتیجه‌ای از اجرای یک پروژه واقعی گزارش نمی‌شود.",
      en: "This is a concept study; no live project outcomes are reported.",
      ar: "هذه دراسة مفاهيمية؛ لا تُعرض نتائج مشروع منفّذ.",
    },
    isPlaceholder: true,
  },
  {
    slug: "placeholder-live-03",
    title: { fa: "یک لحظه مشترک", en: "One Shared Moment", ar: "لحظة مشتركة" },
    eyebrow: { fa: "دموی مفهومی / رویداد زنده", en: "Concept demo / Live event", ar: "عرض مفاهيمي / فعالية مباشرة" },
    summary: {
      fa: "وقتی صحنه، محتوا، نور و آدم‌ها در یک لحظه ماندگار به هم می‌رسند.",
      en: "When stage, content, light and people meet in one lasting moment.",
      ar: "عندما تلتقي المنصة والمحتوى والضوء والناس في لحظة باقية.",
    },
    category: { fa: "رویداد سازمانی", en: "Corporate event", ar: "فعالية مؤسسية" },
    year: "Demo",
    location: { fa: "نمونه مفهومی", en: "Concept study", ar: "دراسة مفاهيمية" },
    media: media.videoPlaceholder,
    gallery: [media.videoPlaceholder, media.exhibition, media.photo],
    services: [
      { fa: "تولید رویداد", en: "Event production", ar: "إنتاج الفعاليات" },
      { fa: "محتوا و نمایشگر", en: "Content and screens", ar: "المحتوى والشاشات" },
      { fa: "تکنیکال و اجرا", en: "Technical and live delivery", ar: "التقنية والتنفيذ المباشر" },
    ],
    challenge: {
      fa: "چطور صحنه، نور و محتوا می‌توانند مخاطب را در یک لحظه مشترک به هم برسانند؟",
      en: "How can stage, light and content bring an audience into one shared moment?",
      ar: "كيف تجمع المنصة والضوء والمحتوى الجمهور في لحظة مشتركة؟",
    },
    approach: {
      fa: "تمام نقاط تماس مخاطب را از ورود تا آخرین تصویر هماهنگ می‌کنیم.",
      en: "We coordinate every audience touchpoint from arrival to the final image.",
      ar: "ننسّق كل نقطة تواصل مع الجمهور من الوصول حتى الصورة الأخيرة.",
    },
    scope: {
      fa: "سناریو، صحنه، AV، نور، محتوا، لجستیک، نیروی انسانی و پشتیبانی.",
      en: "Scenario, stage, AV, lighting, content, logistics, staffing and support.",
      ar: "السيناريو والمنصة والصوتيات والإضاءة والمحتوى واللوجستيات والطاقم والدعم.",
    },
    outcome: {
      fa: "این یک مطالعه مفهومی است؛ نتیجه‌ای از اجرای یک پروژه واقعی گزارش نمی‌شود.",
      en: "This is a concept study; no live project outcomes are reported.",
      ar: "هذه دراسة مفاهيمية؛ لا تُعرض نتائج مشروع منفّذ.",
    },
    isPlaceholder: true,
  },
];

export const projects: Project[] = [
  ...coreProjects,
  {
    ...coreProjects[0],
    slug: "placeholder-photo-04",
    title: {
      fa: "پرتره‌های در حرکت",
      en: "Portraits in Motion",
      ar: "صور في حركة",
    },
    eyebrow: {
      fa: "دموی مفهومی / تجربه تصویری",
      en: "Concept demo / Photo experience",
      ar: "عرض مفاهيمي / تجربة تصويرية",
    },
    summary: {
      fa: "ایده‌ای برای تبدیل حضور مخاطب به یک یادگار تصویری شخصی.",
      en: "A concept for turning participation into a personal visual keepsake.",
      ar: "فكرة لتحويل مشاركة الزائر إلى تذكار بصري شخصي.",
    },
    category: { fa: "تجربه تصویری", en: "Photo experience", ar: "تجربة تصويرية" },
    challenge: {
      fa: "چطور یک لحظه مشارکت می‌تواند به تصویری تبدیل شود که مخاطب با خود نگه می‌دارد؟",
      en: "How can a moment of participation become an image visitors keep?",
      ar: "كيف تصبح لحظة المشاركة صورة يحتفظ بها الزائر؟",
    },
    media: media.projectPhoto,
    gallery: [media.projectPhoto, media.spark, media.interactive],
  },
  {
    ...coreProjects[1],
    slug: "placeholder-intelligence-05",
    title: {
      fa: "نبض مخاطب",
      en: "The Audience Pulse",
      ar: "نبض الجمهور",
    },
    eyebrow: {
      fa: "دموی مفهومی / هوشمندی رویداد",
      en: "Concept demo / Event intelligence",
      ar: "عرض مفاهيمي / ذكاء الفعاليات",
    },
    summary: {
      fa: "نمایشی مفهومی از اینکه چگونه حرکت‌های جمعی می‌توانند بدون ادعای داده واقعی، به یک لایه بصری زنده تبدیل شوند.",
      en: "A concept preview of how collective movement could become a living visual layer, without claiming real audience data.",
      ar: "تصور مفاهيمي لكيفية تحوّل الحركة الجماعية إلى طبقة بصرية حية، من دون ادعاء بيانات حقيقية.",
    },
    category: { fa: "هوشمندی رویداد", en: "Event intelligence", ar: "ذكاء الفعاليات" },
    challenge: {
      fa: "چطور می‌توان الگوهای مشارکت را در یک فضای بصری زنده و قابل فهم تصور کرد؟",
      en: "How could patterns of participation become a clear, living visual layer?",
      ar: "كيف يمكن تصور أنماط المشاركة في طبقة بصرية حية وواضحة؟",
    },
    media: media.intelligence,
    gallery: [media.intelligence, media.interactive, media.exhibition],
  },
  {
    ...coreProjects[2],
    slug: "placeholder-arrival-06",
    title: {
      fa: "ورود در نور",
      en: "Arrival in Light",
      ar: "الوصول في الضوء",
    },
    eyebrow: {
      fa: "دموی مفهومی / لحظه ورود",
      en: "Concept demo / Arrival moment",
      ar: "عرض مفاهيمي / لحظة الوصول",
    },
    summary: {
      fa: "مطالعه‌ای مفهومی برای ورودی‌ای که داستان رویداد را پیش از رسیدن به فضای اصلی آغاز می‌کند.",
      en: "A concept study for an entrance that begins the event story before guests reach the main space.",
      ar: "دراسة مفاهيمية لمدخل يبدأ قصة الفعالية قبل وصول الضيوف إلى المساحة الرئيسية.",
    },
    category: { fa: "هویت فضایی", en: "Spatial identity", ar: "هوية مكانية" },
    challenge: {
      fa: "چطور می‌توان از اولین قدم، حس و داستان رویداد را به مخاطب منتقل کرد؟",
      en: "How can the first step into a space introduce the event’s mood and story?",
      ar: "كيف تقدّم الخطوة الأولى أجواء الفعالية وقصتها؟",
    },
    media: media.spark,
    gallery: [media.spark, media.exhibition, media.stage],
  },
];

export const services: Service[] = [
  {
    slug: "event-production",
    number: "01",
    title: { fa: "تولید کامل رویداد", en: "Complete event production", ar: "الإنتاج الكامل للفعاليات" },
    summary: {
      fa: "از اولین ایده تا اجرای نهایی، همه قطعات یک رویداد را کنار هم می‌گذاریم.",
      en: "From the first idea to final delivery, we connect every part of an event.",
      ar: "من الفكرة الأولى إلى التنفيذ النهائي، نربط كل أجزاء الفعالية.",
    },
    detail: {
      fa: "استراتژی، سناریو، طراحی تجربه، مدیریت تولید، لجستیک، نیروی انسانی و پشتیبانی در محل.",
      en: "Strategy, scenario, experience design, production management, logistics, staffing and on-site support.",
      ar: "الاستراتيجية والسيناريو وتصميم التجربة وإدارة الإنتاج واللوجستيات والطاقم والدعم الميداني.",
    },
    capabilities: [
      { fa: "استراتژی و سناریو", en: "Strategy and scenario", ar: "الاستراتيجية والسيناريو" },
      { fa: "مدیریت تولید", en: "Production management", ar: "إدارة الإنتاج" },
      { fa: "لجستیک و اجرا", en: "Logistics and delivery", ar: "اللوجستيات والتنفيذ" },
    ],
    media: media.stage,
  },
  {
    slug: "exhibitions-and-space",
    number: "02",
    title: { fa: "نمایشگاه و فضا", en: "Exhibitions and space", ar: "المعارض والمساحات" },
    summary: {
      fa: "فضا را به بخشی از روایت تبدیل می‌کنیم؛ قابل لمس، واضح و به‌یادماندنی.",
      en: "We make the space part of the story: tangible, clear and memorable.",
      ar: "نجعل المساحة جزءاً من القصة؛ ملموسة وواضحة ولا تُنسى.",
    },
    detail: {
      fa: "طراحی فضایی، غرفه، مسیر حرکت، نور، نمایشگر، نقاط تعامل و تولید فنی نمایشگاه.",
      en: "Spatial design, booth systems, visitor flow, lighting, displays, interaction points and technical production.",
      ar: "التصميم المكاني وأنظمة الأجنحة ومسار الزوار والإضاءة والشاشات ونقاط التفاعل والإنتاج التقني.",
    },
    capabilities: [
      { fa: "طراحی فضایی", en: "Spatial design", ar: "التصميم المكاني" },
      { fa: "مسیر تجربه", en: "Experience flow", ar: "مسار التجربة" },
      { fa: "ساخت و اجرا", en: "Build and delivery", ar: "البناء والتنفيذ" },
    ],
    media: media.exhibition,
  },
  {
    slug: "interactive-experiences",
    number: "03",
    title: { fa: "تجربه‌های تعاملی", en: "Interactive experiences", ar: "التجارب التفاعلية" },
    summary: {
      fa: "بازی، لمس، حرکت و مشارکت را به یک تجربه معنادار تبدیل می‌کنیم.",
      en: "We turn play, touch, motion and participation into meaningful experience.",
      ar: "نحوّل اللعب واللمس والحركة والمشاركة إلى تجربة ذات معنى.",
    },
    detail: {
      fa: "بازی‌های سفارشی، دیوارهای تعاملی، نصب‌های دیجیتال، محصولات نرم‌افزاری و تجربه‌های مشارکتی.",
      en: "Custom games, interactive walls, digital installations, software products and participatory experiences.",
      ar: "ألعاب مخصصة وجدران تفاعلية وتركيبات رقمية ومنتجات برمجية وتجارب تشاركية.",
    },
    capabilities: [
      { fa: "طراحی تعامل", en: "Interaction design", ar: "تصميم التفاعل" },
      { fa: "بازی و مشارکت", en: "Games and participation", ar: "الألعاب والمشاركة" },
      { fa: "نرم‌افزار و سیستم", en: "Software and systems", ar: "البرمجيات والأنظمة" },
    ],
    media: media.interactive,
  },
  {
    slug: "content-and-media",
    number: "04",
    title: { fa: "محتوا و رسانه", en: "Content and media", ar: "المحتوى والوسائط" },
    summary: {
      fa: "محتوا فقط روی صفحه نیست؛ بخشی از ریتم، فضا و خاطره است.",
      en: "Content is not only on a screen; it is part of the rhythm, space and memory.",
      ar: "المحتوى ليس على الشاشة فقط؛ بل هو جزء من الإيقاع والمساحة والذاكرة.",
    },
    detail: {
      fa: "ایده‌پردازی، طراحی بصری، موشن، ویدیو، محتوای نمایشگر، عکاسی و مستندسازی رویداد.",
      en: "Ideation, visual direction, motion, video, screen content, photography and event documentation.",
      ar: "توليد الأفكار والإخراج البصري والموشن والفيديو ومحتوى الشاشات والتصوير والتوثيق.",
    },
    capabilities: [
      { fa: "جهت‌دهی بصری", en: "Visual direction", ar: "الإخراج البصري" },
      { fa: "موشن و ویدیو", en: "Motion and video", ar: "الموشن والفيديو" },
      { fa: "عکس و مستندات", en: "Photography and documentation", ar: "التصوير والتوثيق" },
    ],
    media: media.photo,
  },
  {
    slug: "event-intelligence",
    number: "05",
    title: { fa: "هوشمندی رویداد", en: "Event intelligence", ar: "ذكاء الفعاليات" },
    summary: {
      fa: "در حال توسعه: داده‌های رویداد را به بینش قابل استفاده تبدیل می‌کنیم.",
      en: "In development: turning event data into useful insight.",
      ar: "قيد التطوير: تحويل بيانات الفعاليات إلى رؤى قابلة للاستخدام.",
    },
    detail: {
      fa: "این قابلیت در حال توسعه است و می‌تواند داده‌های ثبت‌نام، حضور، نظرسنجی، بازی و تعامل را به خلاصه، الگو و پیشنهاد تبدیل کند.",
      en: "This capability is in development and may turn registration, attendance, survey, game and interaction data into summaries, patterns and recommendations.",
      ar: "هذه القدرة قيد التطوير وقد تحول بيانات التسجيل والحضور والاستبيانات والألعاب والتفاعل إلى ملخصات وأنماط وتوصيات.",
    },
    capabilities: [
      { fa: "خلاصه پس از رویداد", en: "Post-event summaries", ar: "ملخصات ما بعد الفعالية" },
      { fa: "الگوهای مشارکت", en: "Participation patterns", ar: "أنماط المشاركة" },
      { fa: "پیشنهادهای آینده", en: "Future recommendations", ar: "توصيات مستقبلية" },
    ],
    media: media.intelligence,
    status: "emerging",
  },
  {
    slug: "websites-and-applications",
    number: "06",
    title: { fa: "وب‌سایت و اپلیکیشن", en: "Websites and applications", ar: "المواقع والتطبيقات" },
    summary: {
      fa: "طراحی و توسعهٔ وب‌سایت و اپلیکیشن با توجه به تجربهٔ کاربران.",
      en: "Design and development of websites and applications around their users.",
      ar: "تصميم المواقع والتطبيقات وتطويرها حول تجربة مستخدميها.",
    },
    detail: {
      fa: "طراحی رابط و تجربهٔ کاربری، توسعهٔ وب و اپلیکیشن و اتصال تجربه‌های دیجیتال به فضای رویداد.",
      en: "Interface and experience design, web and application development, and connections between digital experiences and event spaces.",
      ar: "تصميم الواجهات وتجربة المستخدم، وتطوير المواقع والتطبيقات، وربط التجارب الرقمية بمساحات الفعاليات.",
    },
    capabilities: [
      { fa: "طراحی تجربهٔ کاربری", en: "User experience design", ar: "تصميم تجربة المستخدم" },
      { fa: "توسعهٔ وب و اپلیکیشن", en: "Web and application development", ar: "تطوير المواقع والتطبيقات" },
      { fa: "تجربه‌های متصل", en: "Connected experiences", ar: "التجارب المتصلة" },
    ],
    media: {
      ...media.interactive,
      src: publicAssetPath("/media/services/web-apps.webp"),
      alt: { fa: "طرح مفهومی وب‌سایت و اپلیکیشن", en: "Website and application concept", ar: "تصور للمواقع والتطبيقات" },
    },
  },
  {
    slug: "advertising-structures",
    number: "07",
    title: { fa: "سازه‌های تبلیغاتی", en: "Advertising structures", ar: "الهياكل الإعلانية" },
    summary: {
      fa: "طراحی و ساخت نمایشگرها، تابلوها و سازه‌های تبلیغاتی برای حضور برند در فضا.",
      en: "Design and fabrication of advertising displays, signs and structures in physical spaces.",
      ar: "تصميم وتصنيع وحدات العرض واللوحات والهياكل الإعلانية في المساحات الفعلية.",
    },
    detail: {
      fa: "طراحی سازه، انتخاب متریال، تولید و نصب تابلوها و نمایشگرهای تبلیغاتی متناسب با محیط و هویت برند.",
      en: "Structural design, material selection, production and installation of displays and signs suited to the environment and brand identity.",
      ar: "التصميم الهيكلي واختيار المواد وإنتاج وتركيب وحدات العرض واللوحات الملائمة للمكان وهوية العلامة التجارية.",
    },
    capabilities: [
      { fa: "طراحی سازه", en: "Structural design", ar: "التصميم الهيكلي" },
      { fa: "ساخت و تولید", en: "Fabrication and production", ar: "التصنيع والإنتاج" },
      { fa: "نصب و اجرا", en: "Installation and delivery", ar: "التركيب والتنفيذ" },
    ],
    media: {
      ...media.exhibition,
      src: publicAssetPath("/media/services/advertising.webp"),
      alt: { fa: "طرح مفهومی سازه‌های تبلیغاتی", en: "Advertising structure concept", ar: "تصور للهياكل الإعلانية" },
    },
  },
];

function resolve<T>(value: Record<Locale, T>, locale: Locale): T {
  return value[locale];
}

export const getText = (value: Localized, locale: Locale) => resolve(value, locale);

export function getProject(slug: string) {
  return projects.find((project) => project.slug === slug);
}

export function getService(slug: string) {
  return services.find((service) => service.slug === slug);
}

export const homeCopy: Record<Locale, {
  kicker: string;
  title: string;
  intro: string;
  conceptTitle: string;
  conceptBody: string;
  spaceTitle: string;
  spaceBody: string;
  interactiveTitle: string;
  interactiveBody: string;
  proofTitle: string;
  proofBody: string;
  systemTitle: string;
  systemBody: string;
  intelligenceTitle: string;
  intelligenceBody: string;
  trustTitle: string;
  trustBody: string;
  memoryTitle: string;
  memoryBody: string;
  ctaTitle: string;
  ctaBody: string;
}> = {
  fa: {
    kicker: "استودیو تجربه و تولید رویداد",
    title: "ایده‌های خوب، خاطره‌های ماندگار می‌سازند.",
    intro: "رویداد بعدی‌تان را تصور کنید.",
    conceptTitle: "هر تجربه از یک جرقه شروع می‌شود.",
    conceptBody: "ما از یک ایده شروع می‌کنیم؛ سپس فضا، محتوا، فناوری و آدم‌ها را در یک مسیر واحد به هم می‌رسانیم.",
    spaceTitle: "از فضای خالی تا لحظه‌ای که شکل می‌گیرد.",
    spaceBody: "نمایشگاه، رویداد سازمانی یا یک نصب تعاملی؛ هر فضا باید هدف، ریتم و دلیل خودش را داشته باشد.",
    interactiveTitle: "مخاطب را وارد داستان کنید.",
    interactiveBody: "بازی، لمس، حرکت، تصویر و مشارکت وقتی ارزش دارند که بخشی از تجربه واقعی برند باشند.",
    proofTitle: "ایده باید در دنیای واقعی دیده شود.",
    proofBody: "ایده‌هایی برای فضا، رویداد و مشارکت را ببینید. نمونه‌های مفهومی با برچسب روشن مشخص شده‌اند.",
    systemTitle: "یک تیم، از اولین فکر تا آخرین اجرا.",
    systemBody: "استراتژی، طراحی، محتوا، نرم‌افزار، AV، لجستیک، نیروی انسانی و پشتیبانی در محل؛ یک سیستم کامل برای ساختن تجربه.",
    intelligenceTitle: "داده، آرام‌آرام به بینش تبدیل می‌شود.",
    intelligenceBody: "قابلیت هوشمندی رویداد در حال توسعه است؛ داده‌های ثبت‌نام، حضور، بازی و بازخورد می‌توانند به گزارش و پیشنهادهای آینده تبدیل شوند.",
    trustTitle: "ساخت محلی. آماده برای همکاری جهانی.",
    trustBody: "مندگار در ایران ریشه دارد و برای همکاری مستقیم یا مشارکت با تیم‌های محلی در بازارهای دیگر آماده می‌شود.",
    memoryTitle: "رویداد تمام می‌شود؛ تجربه می‌ماند.",
    memoryBody: "ما برای همان لحظه‌ای کار می‌کنیم که بعداً در ذهن آدم‌ها بازمی‌گردد.",
    ctaTitle: "بیایید رویداد بعدی شما را با هم تصور کنیم.",
    ctaBody: "بگویید مخاطب شما چه چیزی را باید ببیند، احساس کند و به خاطر بسپارد؛ ما قدم بعدی را با شما شکل می‌دهیم.",
  },
  en: {
    kicker: "Experience studio and event production",
    title: "Good ideas create lasting memories.",
    intro: "Imagine your next event.",
    conceptTitle: "Every experience starts with a spark.",
    conceptBody: "We start with an idea, then connect space, content, technology and people into one journey.",
    spaceTitle: "From empty space to a moment taking shape.",
    spaceBody: "An exhibition, corporate event or interactive installation: every space needs its own purpose, rhythm and reason.",
    interactiveTitle: "Bring the audience into the story.",
    interactiveBody: "Games, touch, motion, imagery and participation matter when they become part of the real brand experience.",
    proofTitle: "An idea needs to be seen in the real world.",
    proofBody: "Explore ideas for spaces, events and participation. Concept studies are clearly labelled.",
    systemTitle: "One team, from first thought to final delivery.",
    systemBody: "Strategy, design, content, software, AV, logistics, staffing and on-site support: a complete system for building experience.",
    intelligenceTitle: "Data gradually becomes insight.",
    intelligenceBody: "Event intelligence is in development; registration, attendance, game and feedback data may become reports and future recommendations.",
    trustTitle: "Built locally. Ready to collaborate globally.",
    trustBody: "Mandegar is rooted in Iran and preparing for direct work or trusted local partnerships in other markets.",
    memoryTitle: "An event ends. The experience stays.",
    memoryBody: "We work for the moment that returns later in people’s minds.",
    ctaTitle: "Let’s imagine your next event together.",
    ctaBody: "Tell us what your audience should see, feel and remember; we will shape the next step with you.",
  },
  ar: {
    kicker: "استوديو التجارب وإنتاج الفعاليات",
    title: "الأفكار الجيدة تصنع ذكريات باقية.",
    intro: "تخيّل فعاليتك القادمة.",
    conceptTitle: "كل تجربة تبدأ بشرارة.",
    conceptBody: "نبدأ بفكرة، ثم نربط المساحة والمحتوى والتقنية والناس في رحلة واحدة.",
    spaceTitle: "من مساحة فارغة إلى لحظة تتشكل.",
    spaceBody: "معرض أو فعالية مؤسسية أو تركيب تفاعلي؛ لكل مساحة هدفها وإيقاعها وسببها.",
    interactiveTitle: "أدخل الجمهور إلى القصة.",
    interactiveBody: "تكتسب الألعاب واللمس والحركة والصورة والمشاركة قيمتها عندما تصبح جزءاً من تجربة العلامة الحقيقية.",
    proofTitle: "يجب أن تُرى الفكرة في العالم الحقيقي.",
    proofBody: "استكشف أفكاراً للمساحات والفعاليات والمشاركة. النماذج المفاهيمية موسومة بوضوح.",
    systemTitle: "فريق واحد، من الفكرة الأولى إلى التنفيذ الأخير.",
    systemBody: "الاستراتيجية والتصميم والمحتوى والبرمجيات والصوتيات واللوجستيات والطاقم والدعم الميداني.",
    intelligenceTitle: "تتحول البيانات بهدوء إلى رؤى.",
    intelligenceBody: "ذكاء الفعاليات قيد التطوير؛ قد تتحول بيانات التسجيل والحضور والألعاب والتغذية الراجعة إلى تقارير وتوصيات مستقبلية.",
    trustTitle: "بُني محلياً. جاهز للتعاون عالمياً.",
    trustBody: "مندگار متجذر في إيران ويستعد للعمل المباشر أو الشراكة مع فرق محلية موثوقة في الأسواق الأخرى.",
    memoryTitle: "تنتهي الفعالية. وتبقى التجربة.",
    memoryBody: "نعمل من أجل اللحظة التي تعود لاحقاً إلى ذاكرة الناس.",
    ctaTitle: "لنتخيل فعاليتك القادمة معاً.",
    ctaBody: "أخبرونا بما يجب أن يراه جمهوركم ويشعر به ويتذكره؛ وسنشكّل الخطوة التالية معكم.",
  },
};
