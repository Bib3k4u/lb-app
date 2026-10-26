import { SITE_NAME, SITE_URL, absoluteUrl } from "./seo";

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteUrl("/icon.png"),
    description:
      "LimitBeyond is a multi-tenant gym management platform for gym owners running one or many locations — roster, plans, billing, attendance and feedback in one place.",
    sponsor: {
      "@type": "Organization",
      name: "Neelkanth Gym",
    },
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
