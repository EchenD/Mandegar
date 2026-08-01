import Image from "next/image";
import Link from "next/link";
import { ExperienceCanvas } from "@/components/experience/ExperienceCanvas";
import { ScrollMotion } from "@/components/experience/ScrollMotion";
import { MediaPlaceholder } from "@/components/media/MediaPlaceholder";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ServiceCard } from "@/components/projects/ServiceCard";
import { getText, media } from "@/lib/content";
import { getContactChannels, getHomeModel, getProjects, getServices, getSiteSettings, getTrustContent } from "@/lib/content-source";
import { getUi, localizedPath, type Locale } from "@/lib/i18n";

export default async function HomePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
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

  return (
    <ScrollMotion>
      <section className="heroSection" aria-labelledby="hero-title">
        <div className="heroBackdrop"><Image src={sectionMedia("idea", media.spark).src} alt="" fill priority sizes="100vw" /></div>
        <div className="heroWash" />
        <ExperienceCanvas enabledByCms={settings.featureFlags.immersiveCanvas} />
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
        <section className="sectionPad conceptSection" aria-labelledby="concept-title" style={sectionStyle("idea", 1)}>
          <div className="pageWidth splitIntro" data-reveal>
            <div className="sectionKicker">02 / {locale === "fa" ? "ایده" : locale === "ar" ? "الفكرة" : "Idea"}</div>
            <div className="sectionLead">
              <h2 id="concept-title">{copy.conceptTitle}</h2>
              <p>{copy.conceptBody}</p>
            </div>
          </div>
          <div className="lineField pageWidth" aria-hidden="true"><span /><span /><span /><span /></div>
        </section>

        <section className="sectionPad spaceSection" aria-labelledby="space-title" style={sectionStyle("space", 2)}>
          <div className="pageWidth imageStory" data-reveal>
            <div className="storyImage largeMedia"><MediaPlaceholder media={sectionMedia("space", media.exhibition)} locale={locale} /></div>
            <div className="storyCopy">
              <div className="sectionKicker">03 / {locale === "fa" ? "فضا" : locale === "ar" ? "المساحة" : "Space"}</div>
              <h2 id="space-title">{copy.spaceTitle}</h2>
              <p>{copy.spaceBody}</p>
              <div className="microList"><span>01 / Strategy</span><span>02 / Space</span><span>03 / Production</span></div>
            </div>
          </div>
        </section>

        <section className="sectionPad interactionSection" aria-labelledby="interaction-title" style={sectionStyle("experience", 3)}>
          <div className="pageWidth interactionGrid" data-reveal>
            <div className="interactionCopy">
              <div className="sectionKicker">04 / {locale === "fa" ? "تجربه" : locale === "ar" ? "التجربة" : "Experience"}</div>
              <h2 id="interaction-title">{copy.interactiveTitle}</h2>
              <p>{copy.interactiveBody}</p>
              <div className="featureTags"><span>{locale === "fa" ? "بازی" : locale === "ar" ? "ألعاب" : "Games"}</span><span>{locale === "fa" ? "لمس و حرکت" : locale === "ar" ? "لمس وحركة" : "Touch + motion"}</span><span>{locale === "fa" ? "عکس" : locale === "ar" ? "تصوير" : "Photo"}</span></div>
            </div>
            <div className="interactionMedia"><MediaPlaceholder media={sectionMedia("experience", media.interactive)} locale={locale} /></div>
          </div>
        </section>

        <section className="sectionPad proofSection" aria-labelledby="proof-title" style={sectionStyle("proof", 4)}>
          <div className="pageWidth sectionHeading" data-reveal>
            <div className="sectionKicker">05 / {ui.selectedWork}</div>
            <div className="headingWithLink"><h2 id="proof-title">{copy.proofTitle}</h2><Link className="textLink" href={localizedPath(locale, "projects")}>{ui.viewAll}<span aria-hidden="true">↗</span></Link></div>
            <p>{copy.proofBody}</p>
          </div>
          <div className="pageWidth projectGrid projectGridFeatured">
            {proofProjects.map((project, index) => <ProjectCard key={project.slug} project={project} locale={locale} featured={index === 0} />)}
          </div>
        </section>

        <section className="sectionPad systemSection" aria-labelledby="system-title" style={sectionStyle("capability", 5)}>
          <div className="pageWidth sectionHeading" data-reveal>
            <div className="sectionKicker">06 / {locale === "fa" ? "سیستم ساختن" : locale === "ar" ? "نظام البناء" : "Build system"}</div>
            <h2 id="system-title">{copy.systemTitle}</h2>
            <p>{copy.systemBody}</p>
          </div>
          <div className="pageWidth serviceList">{serviceItems.slice(0, 5).map((service) => <ServiceCard key={service.slug} service={service} locale={locale} />)}</div>
        </section>

        <section className="sectionPad intelligenceSection" aria-labelledby="intelligence-title" style={sectionStyle("intelligence", 6)}>
          <div className="pageWidth intelligenceGrid" data-reveal>
            <div className="intelligenceMedia"><MediaPlaceholder media={sectionMedia("intelligence", media.intelligence)} locale={locale} /></div>
            <div className="intelligenceCopy">
              <div className="sectionKicker">07 / {getUi(locale).emerging}</div>
              <h2 id="intelligence-title">{copy.intelligenceTitle}</h2>
              <p>{copy.intelligenceBody}</p>
              <div className="insightList"><span>Registration</span><span>Participation</span><span>Feedback</span><span>Recommendations</span></div>
            </div>
          </div>
        </section>

        <section className="sectionPad trustSection" aria-labelledby="trust-title" style={sectionStyle("trust", 7)}>
          <div className="pageWidth trustGrid" data-reveal>
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

        <section className="sectionPad memorySection" aria-labelledby="memory-title" style={sectionStyle("memory", 8)}>
          <div className="pageWidth memoryGrid" data-reveal>
            <div className="memoryCopy"><div className="sectionKicker">09 / {locale === "fa" ? "خاطره" : locale === "ar" ? "الذكرى" : "Memory"}</div><h2 id="memory-title">{copy.memoryTitle}</h2><p>{copy.memoryBody}</p></div>
            <div className="memoryMedia"><MediaPlaceholder media={sectionMedia("memory", media.photo)} locale={locale} /></div>
          </div>
        </section>

        <section className="ctaSection" id="contact" aria-labelledby="cta-title" style={sectionStyle("conversion", 9)}>
          <div className="pageWidth ctaInner" data-reveal>
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
