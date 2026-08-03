import Image from "next/image";
import Link from "next/link";
import { ExperienceCanvas } from "@/components/experience/ExperienceCanvas";
import { ScrollMotion } from "@/components/experience/ScrollMotion";
import { MediaPlaceholder } from "@/components/media/MediaPlaceholder";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ServiceCard } from "@/components/projects/ServiceCard";
import { getText, media } from "@/lib/content";
import { getContactChannels, getHomeModel, getProjects, getServices, getSiteSettings, getTrustContent } from "@/lib/content-source";
import { ensureLocale, getUi, localizedPath, type Locale } from "@/lib/i18n";

export default async function HomePage({ params }: { params: Promise<{ locale?: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = ensureLocale(rawLocale || "fa");
  const ui = getUi(locale);
  const [{ copy, sectionSettings, mediaOverrides, featuredProjects, ctaOverrides }, projectItems, serviceItems, settings, trustContent, contactChannels] = await Promise.all([getHomeModel(locale), getProjects(locale), getServices(locale), getSiteSettings(), getTrustContent(locale), getContactChannels()]);
  const proofProjects = featuredProjects.length ? featuredProjects : projectItems.slice(0, 3);
  const safeHref = (href: string | undefined, fallback: string) => href?.startsWith("/") || href?.startsWith("#") ? href : fallback;
  const heroCta = { label: ctaOverrides.hero?.label || ui.explore, href: safeHref(ctaOverrides.hero?.href, "#experience") };
  const conversionCta = { label: ctaOverrides.conversion?.label || ui.start, href: safeHref(ctaOverrides.conversion?.href, localizedPath(locale, "contact")) };
  const salesChannel = contactChannels.find((channel) => channel.purpose === "sales");
  const whatsappChannel = contactChannels.find((channel) => channel.purpose === "whatsapp") || salesChannel;
  const whatsappHref = whatsappChannel?.whatsapp ? whatsappChannel.whatsapp.startsWith("http") ? whatsappChannel.whatsapp : `https://wa.me/${whatsappChannel.whatsapp.replace(/\D/g, "")}` : null;
  const sectionStyle = (key: string, fallbackOrder: number) => ({ order: sectionSettings[key]?.order ?? fallbackOrder, display: sectionSettings[key]?.visible === false ? "none" : undefined });
  const sectionMedia = (key: string, fallback: typeof media.spark) => mediaOverrides[key] || fallback;
  const sceneUi = locale === "fa" ? {
    spark: "01 / جرقه", space: "02 / فضا", build: "03 / ساخت", event: "04 / رویداد زنده", proof: "05 / پروژه‌های منتخب", interaction: "06 / تعامل", intelligence: "07 / هوشمندی رویداد", trust: "08 / همکاری", memory: "09 / خاطره", invitation: "10 / شروع گفتگو",
    production: "طراحی. تولید. فضا. اجرا.", eventTitle: "تجربه‌ها شکل می‌گیرند.", interactionTitle: "تعامل، تجربه و مشارکت ماندگار.",
    labels: ["طراحی مفهومی", "طراحی فضا", "تولید سازه", "نورپردازی", "اجرای رویداد"],
    engagement: "مشارکت", signals: "سیگنال‌های تعامل", next: "بینش برای رویداد بعدی",
  } : locale === "ar" ? {
    spark: "01 / الشرارة", space: "02 / المساحة", build: "03 / البناء", event: "04 / فعالية حية", proof: "05 / أعمال مختارة", interaction: "06 / التفاعل", intelligence: "07 / ذكاء الفعاليات", trust: "08 / التعاون", memory: "09 / الذكرى", invitation: "10 / ابدأ الحوار",
    production: "تصميم. إنتاج. مساحة. تنفيذ.", eventTitle: "تتشكّل التجارب.", interactionTitle: "تفاعل وتجربة ومشاركة تبقى.",
    labels: ["التصميم المفاهيمي", "تصميم المساحة", "إنتاج الهيكل", "الإضاءة", "تنفيذ الفعالية"],
    engagement: "المشاركة", signals: "إشارات التفاعل", next: "رؤى للفعالية التالية",
  } : {
    spark: "01 / Spark", space: "02 / Space", build: "03 / Build", event: "04 / Live event", proof: "05 / Selected work", interaction: "06 / Interaction", intelligence: "07 / Event intelligence", trust: "08 / Collaboration", memory: "09 / Memory", invitation: "10 / Start a conversation",
    production: "Design. Production. Space. Delivery.", eventTitle: "Experiences come alive.", interactionTitle: "Interaction, experience and lasting participation.",
    labels: ["Concept design", "Spatial design", "Structure build", "Lighting", "Live delivery"],
    engagement: "Engagement", signals: "Interaction signals", next: "Insight for the next event",
  };

  return (
    <ScrollMotion lenisEnabled={settings.featureFlags.lenis}>
      <div className="experienceBackdrop" data-experience-canvas-host>
        <ExperienceCanvas enabledByCms={settings.featureFlags.immersiveCanvas} />
        <div className="sceneRoom" aria-hidden="true"><span className="sceneRoomGlass" /><span className="sceneRoomCeiling" /><span className="sceneRoomFloor" /><span className="sceneRoomPlinth" /><span className="sceneRoomWall" /></div>
        <div className="sceneChrome" aria-hidden="true"><span className="sceneChromeCount">01 — 10</span><span className="sceneChromeRail"><i /></span><span className="sceneChromeLabel">SCROLL TO ASSEMBLE</span></div>
        <div className="sceneSpark" data-scene-spark aria-hidden="true"><i /><span className="sceneSparkTrail sceneSparkTrailOne" /><span className="sceneSparkTrail sceneSparkTrailTwo" /></div>
        <svg className="sceneGuides" data-scene-guides aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path className="sceneGuidePath sceneGuidePathOne" pathLength="1" d="M 31 52 C 35 40, 42 31, 49 35 S 58 59, 64 42" />
          <path className="sceneGuidePath sceneGuidePathTwo" pathLength="1" d="M 31 52 C 39 48, 43 60, 51 52 S 58 39, 63 47" />
          <path className="sceneGuidePath sceneGuidePathThree" pathLength="1" d="M 31 52 C 42 54, 49 43, 59 57" />
        </svg>
        <div className="sceneBuildAssembly" data-scene-layer="construction" aria-hidden="true">
          <div className="sceneBuildDeck"><i /><i /><i /></div>
          <div className="sceneBuildTruss"><i /><i /><i /><i /></div>
          <div className="sceneBuildLed"><i /></div>
          <div className="sceneBuildWall sceneBuildWallLeft" /><div className="sceneBuildWall sceneBuildWallRight" />
          <div className="sceneBuildCase sceneBuildCaseOne" /><div className="sceneBuildCase sceneBuildCaseTwo" />
          <div className="sceneBuildLight sceneBuildLightOne" /><div className="sceneBuildLight sceneBuildLightTwo" /><div className="sceneBuildLight sceneBuildLightThree" />
        </div>
        <div className="sceneMediaSurface">
          <div className="sceneMediaFrame sceneMediaEvent" data-scene-media="event"><Image src={sectionMedia("space", media.exhibition).src} alt="" fill sizes="(max-width: 760px) 78vw, 46vw" /></div>
          <div className="sceneMediaFrame sceneMediaExperience" data-scene-media="experience"><Image src={sectionMedia("experience", media.interactive).src} alt="" fill sizes="(max-width: 760px) 72vw, 42vw" /></div>
          {proofProjects.slice(0, 3).map((project, index) => <div className={`sceneMediaFrame sceneMediaProof sceneMediaProof${index + 1}`} data-scene-media={`project-${index}`} key={project.slug}><Image src={project.media.src} alt="" fill sizes="(max-width: 760px) 86vw, 58vw" /><span className="sceneMediaMeta"><span>{getText(project.category, locale)}</span><small>{project.year}</small></span></div>)}
          <div className="sceneMediaFrame sceneMediaMemory" data-scene-media="memory"><Image src={sectionMedia("memory", media.photo).src} alt="" fill sizes="(max-width: 760px) 72vw, 42vw" /></div>
        </div>
        <div className="sceneBuildLabels" data-scene-layer="build" aria-hidden="true">
          {sceneUi.labels.map((label, index) => <span key={label} className={`sceneBuildLabel sceneBuildLabel${index + 1}`}>{label}</span>)}
        </div>
        <div className="sceneInteractionSurface" data-scene-layer="interaction" aria-hidden="true">
          <div className="sceneInteractionStation sceneInteractionGame"><Image src={sectionMedia("experience", media.interactive).src} alt="" fill sizes="(max-width: 760px) 32vw, 16vw" /><span>01 / GAME</span></div>
          <div className="sceneInteractionStation sceneInteractionPhoto"><Image src={sectionMedia("memory", media.photo).src} alt="" fill sizes="(max-width: 760px) 26vw, 13vw" /><span>02 / PHOTO</span></div>
          <div className="sceneInteractionStation sceneInteractionTouch"><Image src={sectionMedia("space", media.exhibition).src} alt="" fill sizes="(max-width: 760px) 26vw, 13vw" /><span>03 / TOUCH</span></div>
          <div className="sceneInteractionPulse" />
        </div>
        <div className="sceneDataSurface" data-scene-layer="data" aria-hidden="true">
          <div className="sceneDataNexus"><i /><i /><i /><b /></div>
          <div className="sceneInsightPanel sceneInsightEngagement"><span>01 / {sceneUi.engagement}</span><strong>•••</strong><i /></div>
          <div className="sceneInsightPanel sceneInsightSignals"><span>02 / {sceneUi.signals}</span><strong>••••</strong><i /></div>
          <div className="sceneInsightPanel sceneInsightNext"><span>03 / {sceneUi.next}</span><strong>••</strong><i /></div>
        </div>
        <div className="sceneMemoryParticles" data-scene-layer="memory-particles" aria-hidden="true">{Array.from({ length: 16 }, (_, index) => <i key={index} />)}</div>
        <div className="storyCopyLayer">
          <section className="storyCopy storyCopySpark" data-scene-copy="idea"><span>{sceneUi.spark}</span><h2>{copy.conceptTitle}</h2><p>{copy.conceptBody}</p></section>
          <section className="storyCopy storyCopySpace" data-scene-copy="space"><span>{sceneUi.space}</span><h2>{copy.spaceTitle}</h2><p>{copy.spaceBody}</p></section>
          <section className="storyCopy storyCopyProduction" data-scene-copy="build"><span>{sceneUi.build}</span><h2>{sceneUi.production}</h2><p>{copy.systemBody}</p></section>
          <section className="storyCopy storyCopyEvent" data-scene-copy="event"><span>{sceneUi.event}</span><h2>{sceneUi.eventTitle}</h2></section>
          <section className="storyCopy storyCopyProof" data-scene-copy="proof"><span>{sceneUi.proof}</span><h2>{copy.proofTitle}</h2><p>{copy.proofBody}</p></section>
          <section className="storyCopy storyCopyInteractive" data-scene-copy="interaction"><span>{sceneUi.interaction}</span><h2>{sceneUi.interactionTitle}</h2><p>{copy.interactiveBody}</p></section>
          <section className="storyCopy storyCopyIntelligence" data-scene-copy="intelligence"><span>{sceneUi.intelligence}</span><h2>{copy.intelligenceTitle}</h2><p>{copy.intelligenceBody}</p></section>
          <section className="storyCopy storyCopyTrust" data-scene-copy="trust"><span>{sceneUi.trust}</span><h2>{copy.trustTitle}</h2><p>{copy.trustBody}</p></section>
          <section className="storyCopy storyCopyMemory" data-scene-copy="memory"><span>{sceneUi.memory}</span><h2>{copy.memoryTitle}</h2><p>{copy.memoryBody}</p></section>
          <section className="storyCopy storyCopyInvitation" data-scene-copy="invitation"><span>{sceneUi.invitation}</span><h2>{copy.ctaTitle}</h2><p>{copy.ctaBody}</p><div className="storyCtaActions"><Link className="button buttonPrimary" href={conversionCta.href} data-analytics="cta_start_project">{conversionCta.label}<span aria-hidden="true">↗</span></Link>{salesChannel?.phone ? <a className="button buttonGhost" href={`tel:${salesChannel.phone}`} data-analytics="phone_click" data-analytics-label="sales">{ui.callSales}</a> : null}{whatsappHref ? <a className="button buttonGhost" href={whatsappHref} target="_blank" rel="noreferrer" data-analytics="whatsapp_click" data-analytics-label="sales">{ui.whatsapp}</a> : <Link className="button buttonGhost" href={localizedPath(locale, "contact")}>{ui.navigation.contact}</Link>}</div></section>
        </div>
        <div className="sceneNavigator">
          <div className="sceneNavigatorHead"><span>MANDEGAR / LIVE BUILD</span><span>01 — 10</span></div>
          <div className="sceneNavigatorSteps">
            <span data-scene-step="spark">Spark</span>
            <span data-scene-step="idea">Idea</span>
            <span data-scene-step="space">Space</span>
            <span data-scene-step="experience">Experience</span>
            <span data-scene-step="proof">Proof</span>
            <span data-scene-step="capability">System</span>
            <span data-scene-step="intelligence">Insight</span>
            <span data-scene-step="trust">Trust</span>
            <span data-scene-step="memory">Memory</span>
            <span data-scene-step="invitation">Invitation</span>
          </div>
        </div>
        <div className="eventAtlas" aria-hidden="true">
          <div className="eventAtlasHeader"><span>EVENT ATLAS</span><span>PROOF / SYSTEM / INSIGHT</span></div>
          <div className="eventAtlasField">
            <span className="atlasTrace atlasTraceOne" />
            <span className="atlasTrace atlasTraceTwo" />
            <span className="atlasTrace atlasTraceThree" />
            <span className="atlasNode atlasNodeCore"><b>LIVE</b><small>event</small></span>
            <span className="atlasNode atlasNodeProof"><b>05</b><small>proof</small></span>
            <span className="atlasNode atlasNodeSystem"><b>06</b><small>system</small></span>
            <span className="atlasNode atlasNodeInsight"><b>07</b><small>insight</small></span>
          </div>
          <div className="eventAtlasFooter"><span>01 — FRAME</span><span>02 — BUILD</span><span>03 — READ</span></div>
        </div>
        <div className="sceneStageShell" aria-hidden="true">
          <div className="sceneStageHeader"><span>LIVE EVENT / SCENE SYSTEM</span><span>PROVISIONAL BUILD</span></div>
          <div className="sceneStageFloor"><span /><span /><span /></div>
          <div className="sceneStageFooter"><span>SPACE / SIGNAL / MEMORY</span><span>SCROLL TO ASSEMBLE</span></div>
        </div>
        <div className="narrativeRail"><span className="narrativeRailTrack"><i /></span><span className="narrativeRailLabel">IDEA / SPACE / EXPERIENCE</span></div>
      </div>
      <section className="heroSection" data-stage="spark" aria-labelledby="hero-title">
        <div className="heroBackdrop"><Image src={sectionMedia("idea", media.spark).src} alt="" fill priority sizes="100vw" /></div>
        <div className="heroWash" />
        <span className="heroSpark" aria-hidden="true" />
        <div className="heroContent pageWidth">
          <div className="eyebrow"><span className="eyebrowDot" /> {copy.kicker}</div>
          <h1 id="hero-title">{copy.title}</h1>
          <p className="heroIntro">{copy.intro}</p>
          <Link className="button buttonPrimary" href={heroCta.href} data-analytics="cta_explore">{heroCta.label}<span aria-hidden="true">↓</span></Link>
        </div>
        <div className="heroFooter pageWidth">
          <span>{ui.scroll}</span>
          <span className="heroIndex">01 / 10</span>
        </div>
        <span className="placeholderPill">{ui.placeholder}</span>
      </section>

      <div className="homepageFlow" id="experience">
        <section className="sectionPad conceptSection" data-stage="idea" data-cinematic-beat aria-labelledby="concept-title" style={sectionStyle("idea", 1)}>
          <div className="pageWidth splitIntro" data-cinematic-content>
            <div className="sectionKicker">02 / {locale === "fa" ? "ایده" : locale === "ar" ? "الفكرة" : "Idea"}</div>
            <div className="sectionLead">
              <h2 id="concept-title">{copy.conceptTitle}</h2>
              <p>{copy.conceptBody}</p>
            </div>
          </div>
          <div className="lineField pageWidth" aria-hidden="true"><span /><span /><span /><span /></div>
        </section>

        <section className="sectionPad spaceSection" data-stage="space" data-cinematic-beat aria-labelledby="space-title" style={sectionStyle("space", 2)}>
          <div className="pageWidth imageStory" data-cinematic-content>
            <div className="storyImage largeMedia"><MediaPlaceholder media={sectionMedia("space", media.exhibition)} locale={locale} className="cinematicDomMedia" /></div>
            <div className="storyCopy">
              <div className="sectionKicker">03 / {locale === "fa" ? "فضا" : locale === "ar" ? "المساحة" : "Space"}</div>
              <h2 id="space-title">{copy.spaceTitle}</h2>
              <p>{copy.spaceBody}</p>
              <div className="microList"><span>01 / Strategy</span><span>02 / Space</span><span>03 / Production</span></div>
            </div>
          </div>
        </section>

        <section className="sectionPad interactionSection" data-stage="experience" data-cinematic-beat aria-labelledby="interaction-title" style={sectionStyle("experience", 3)}>
          <div className="pageWidth interactionGrid" data-cinematic-content>
            <div className="interactionCopy">
              <div className="sectionKicker">04 / {locale === "fa" ? "تجربه" : locale === "ar" ? "التجربة" : "Experience"}</div>
              <h2 id="interaction-title">{copy.interactiveTitle}</h2>
              <p>{copy.interactiveBody}</p>
              <div className="featureTags"><span>{locale === "fa" ? "بازی" : locale === "ar" ? "ألعاب" : "Games"}</span><span>{locale === "fa" ? "لمس و حرکت" : locale === "ar" ? "لمس وحركة" : "Touch + motion"}</span><span>{locale === "fa" ? "عکس" : locale === "ar" ? "تصوير" : "Photo"}</span></div>
            </div>
            <div className="interactionMedia"><MediaPlaceholder media={sectionMedia("experience", media.interactive)} locale={locale} className="cinematicDomMedia" /></div>
          </div>
        </section>

        <section className="sectionPad proofSection" data-stage="proof" data-cinematic-beat aria-labelledby="proof-title" style={sectionStyle("proof", 4)}>
          <div className="pageWidth sectionHeading" data-cinematic-content>
            <div className="sectionKicker">05 / {ui.selectedWork}</div>
            <div className="headingWithLink"><h2 id="proof-title">{copy.proofTitle}</h2><Link className="textLink" href={localizedPath(locale, "projects")}>{ui.viewAll}<span aria-hidden="true">↗</span></Link></div>
            <p>{copy.proofBody}</p>
          </div>
          <div className="pageWidth eventAtlasBridge cinematicDecoration" aria-hidden="true">
            <span className="eventAtlasBridgeLabel">ONE EVENT / MANY TOUCHPOINTS</span>
            <span className="eventAtlasBridgeLine"><i /><i /><i /><i /></span>
            <span className="eventAtlasBridgeLabel">SPACE — EXPERIENCE — MEMORY</span>
          </div>
          <div className="pageWidth projectGrid projectGridFeatured eventAtlasProjects cinematicProjectIndex">
            {proofProjects.map((project, index) => <ProjectCard key={project.slug} project={project} locale={locale} featured={index === 0} />)}
          </div>
        </section>

        <section className="sectionPad systemSection" data-stage="capability" data-cinematic-beat aria-labelledby="system-title" style={sectionStyle("capability", 5)}>
          <div className="pageWidth sectionHeading" data-cinematic-content>
            <div className="sectionKicker">06 / {locale === "fa" ? "سیستم ساختن" : locale === "ar" ? "نظام البناء" : "Build system"}</div>
            <h2 id="system-title">{copy.systemTitle}</h2>
            <p>{copy.systemBody}</p>
          </div>
          <div className="pageWidth systemAtlasBridge cinematicDecoration" aria-hidden="true">
            <span>STRATEGY</span><i /><span>SPATIAL LOGIC</span><i /><span>PRODUCTION</span><i /><span>LIVE SIGNAL</span>
          </div>
          <div className="pageWidth serviceList eventAtlasServices cinematicProjectIndex">{serviceItems.slice(0, 5).map((service) => <ServiceCard key={service.slug} service={service} locale={locale} />)}</div>
        </section>

        <section className="sectionPad intelligenceSection" data-stage="intelligence" data-cinematic-beat aria-labelledby="intelligence-title" style={sectionStyle("intelligence", 6)}>
          <div className="pageWidth intelligenceGrid" data-cinematic-content>
            <div className="intelligenceMedia"><MediaPlaceholder media={sectionMedia("intelligence", media.intelligence)} locale={locale} className="cinematicDomMedia" /></div>
            <div className="intelligenceCopy">
              <div className="sectionKicker">07 / {getUi(locale).emerging}</div>
              <h2 id="intelligence-title">{copy.intelligenceTitle}</h2>
              <p>{copy.intelligenceBody}</p>
              <div className="insightList"><span>Registration</span><span>Participation</span><span>Feedback</span><span>Recommendations</span></div>
            </div>
          </div>
        </section>

        <section className="sectionPad trustSection" data-stage="trust" data-cinematic-beat aria-labelledby="trust-title" style={sectionStyle("trust", 7)}>
          <div className="pageWidth trustGrid" data-cinematic-content>
            <div>
              <div className="sectionKicker">08 / {locale === "fa" ? "اعتماد و مقیاس" : locale === "ar" ? "الثقة والنطاق" : "Trust + scale"}</div>
              <h2 id="trust-title">{copy.trustTitle}</h2>
              <p>{copy.trustBody}</p>
            </div>
            {trustContent.clients.length || trustContent.metrics.length || trustContent.testimonials.length ? (
              <div className="trustProof">
                {trustContent.clients.length ? <div className="clientWall">{trustContent.clients.map((client) => client.url ? <a key={client.name} href={client.url} target="_blank" rel="noreferrer" aria-label={client.name}>{client.logo ? <Image src={client.logo} alt={client.name} width={140} height={70} /> : <span>{client.name}</span>}</a> : <div key={client.name}>{client.logo ? <Image src={client.logo} alt={client.name} width={140} height={70} /> : <span>{client.name}</span>}</div>)}</div> : null}
                {trustContent.metrics.length ? <div className="metricGrid">{trustContent.metrics.map((metric) => <div className="metric" key={`${metric.value}-${getText(metric.label, locale)}`}><strong>{metric.value}{metric.unit}</strong><span>{getText(metric.label, locale)}</span><small>{getText(metric.context, locale)}</small></div>)}</div> : null}
                {trustContent.testimonials.map((testimonial) => <blockquote className="testimonial" key={getText(testimonial.quote, locale)}><p>“{getText(testimonial.quote, locale)}”</p><footer>{getText(testimonial.person, locale)} · {getText(testimonial.role, locale)} · {getText(testimonial.organization, locale)}</footer></blockquote>)}
              </div>
            ) : (
              <div className="sectorWall" aria-label="Sectors served">
                <span>Corporate</span><span>Exhibitions</span><span>Public</span><span>Event agencies</span><span>Partners</span>
                <small>{locale === "fa" ? "ادعاها، لوگوها و آمار در CMS با منبع تأیید می‌شوند." : locale === "ar" ? "يتم اعتماد الادعاءات والشعارات والأرقام في CMS مع مصادرها." : "Claims, logos and metrics are verified in the CMS with source notes."}</small>
              </div>
            )}
          </div>
        </section>

        <section className="sectionPad memorySection" data-stage="memory" data-cinematic-beat aria-labelledby="memory-title" style={sectionStyle("memory", 8)}>
          <div className="pageWidth memoryGrid" data-cinematic-content>
            <div className="memoryCopy"><div className="sectionKicker">09 / {locale === "fa" ? "خاطره" : locale === "ar" ? "الذكرى" : "Memory"}</div><h2 id="memory-title">{copy.memoryTitle}</h2><p>{copy.memoryBody}</p></div>
            <div className="memoryMedia"><MediaPlaceholder media={sectionMedia("memory", media.photo)} locale={locale} className="cinematicDomMedia" /></div>
          </div>
        </section>

        <section className="ctaSection" data-stage="invitation" data-cinematic-beat id="contact" aria-labelledby="cta-title" style={sectionStyle("conversion", 9)}>
          <div className="pageWidth ctaInner" data-cinematic-content>
            <div className="ctaOrb" aria-hidden="true"><span /></div>
            <div className="sectionKicker">10 / {locale === "fa" ? "شروع گفتگو" : locale === "ar" ? "ابدأ الحوار" : "Start a conversation"}</div>
            <h2 id="cta-title">{copy.ctaTitle}</h2>
            <p>{copy.ctaBody}</p>
            <div className="ctaActions">
              {salesChannel?.phone ? <a className="button buttonPrimary" href={`tel:${salesChannel.phone}`} data-analytics="phone_click" data-analytics-label="sales">{ui.callSales}<span aria-hidden="true">↗</span></a> : <Link className="button buttonPrimary" href={conversionCta.href} data-analytics="cta_start_project">{conversionCta.label}<span aria-hidden="true">↗</span></Link>}
              {whatsappHref ? <a className="button buttonGhost" href={whatsappHref} target="_blank" rel="noreferrer" data-analytics="whatsapp_click" data-analytics-label="sales">{ui.whatsapp}</a> : <Link className="button buttonGhost" href={localizedPath(locale, "contact")} data-analytics="cta_general_contact">{ui.navigation.contact}</Link>}
            </div>
          </div>
        </section>
      </div>
    </ScrollMotion>
  );
}
