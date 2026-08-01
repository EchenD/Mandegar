export const homepageQuery = `*[_type == "homepage" && locale == $locale][0]{
  title,
  kicker,
  intro,
  heroCta,
  sections[] | order(order asc) {
    key,
    variant,
    visible,
    title,
    body,
    media,
    cta,
    projects[]->{
      title, "slug": slug.current, summary, year, client, sector, location,
      categories[]->{label, "slug": slug.current}, services[]->{title},
      heroMedia, mediaGallery, challenge, concept, scope, outcomes, credits,
      isPlaceholder, featured, featuredRank
    }
  }
}`;

export const projectsQuery = `*[_type == "project" && locale == $locale && publicationState == "published"] | order(featuredRank asc, _createdAt desc){
  title, "slug": slug.current, summary, year, client, sector, location,
  categories[]->{label, "slug": slug.current}, services[]->{title},
  heroMedia, isPlaceholder, featured, featuredRank
}`;

export const projectQuery = `*[_type == "project" && locale == $locale && slug.current == $slug][0]{
  title, "slug": slug.current, summary, year, client, sector, location,
  categories[]->{label, "slug": slug.current}, services[]->{title},
  heroMedia, challenge, concept, scope, mediaGallery, outcomes, credits, isPlaceholder,
  relatedProjects[]->{title, "slug": slug.current, summary, year, location, categories[]->{label}, heroMedia}
}`;

export const servicesQuery = `*[_type == "service" && locale == $locale && status != "archived"] | order(order asc){
  title, "slug": slug.current, summary, detail, capabilities, media, status, order
}`;

export const contactChannelsQuery = `*[_type == "contactChannel" && (defined(priority) || purpose in ["sales", "general", "international", "whatsapp"])] | order(priority asc){
  purpose, label, department, phone, whatsapp, email, country, availability, priority
}`;

export const legalPageQuery = `*[_type == "legalPage" && locale == $locale][0]{
  title, intro, status, updatedAt, sections[]{heading, body}
}`;

export const siteSettingsQuery = `*[_type == "siteSettings"][0]{
  title,
  navigation[]{label, path, order},
  socialLinks[]{label, url},
  footerLine,
  globalLine,
  featureFlags,
  seoDefaults
}`;

export const editorialPageQuery = `*[_type == "editorialPage" && locale == $locale && pageKey == $pageKey][0]{
  pageKey, heroKicker, title, intro,
  sections[]{key, kicker, title, body, items},
  seo
}`;

export const teamPartnersQuery = `*[_type == "teamPartner" && visibility != "hidden"] | order(order asc, name asc){
  name, role, biography, location, partnerType, order
}`;

export const trustContentQuery = `{
  "clients": *[_type == "client" && visibility == "visible"] | order(name asc){name, logo, url, sector},
  "metrics": *[_type == "metric" && defined(sourceNote)] | order(_createdAt asc){label, value, unit, context, sourceNote},
  "testimonials": *[_type == "testimonial" && locale == $locale && approved == true] | order(_createdAt desc){quote, person, role, organization}
}`;
