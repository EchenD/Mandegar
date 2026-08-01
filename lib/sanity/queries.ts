export const homepageQuery = `*[_type == "homepage" && locale == $locale][0]{
  title,
  intro,
  sections[] | order(order asc) {
    key,
    variant,
    visible,
    title,
    body,
    media,
    projects[]->
  }
}`;

export const projectsQuery = `*[_type == "project" && locale == $locale && publicationState == "published"] | order(featuredRank asc, _createdAt desc){
  title, "slug": slug.current, summary, year, location, category->, heroMedia, featured
}`;

export const projectQuery = `*[_type == "project" && locale == $locale && slug.current == $slug][0]{
  title, "slug": slug.current, summary, year, client, location, categories[]->, services[]->,
  challenge, concept, scope, mediaGallery, outcomes, credits, relatedProjects[]->
}`;

export const servicesQuery = `*[_type == "service" && locale == $locale && status != "archived"] | order(order asc){
  title, "slug": slug.current, summary, detail, capabilities, media, status, order
}`;

export const contactChannelsQuery = `*[_type == "contactChannel" && (defined(priority) || purpose in ["sales", "general", "international", "whatsapp"])] | order(priority asc){
  purpose, label, department, phone, whatsapp, email, country, availability, priority
}`;
