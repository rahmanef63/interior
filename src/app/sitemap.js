import { UNITS } from '../config/units.js';

// Every unit is a real, indexable page — /tour?unit=<key> renders its own title,
// description and canonical. Listing only /tour told search engines the showroom
// was one page, which is the opposite of the point: somebody searching for a
// two-bedroom plan should be able to land on the two-bedroom.
export default function sitemap() {
  const lastModified = new Date();
  const base = 'https://interior.rahmanef.com';
  return [
    { url: base, lastModified, changeFrequency: 'monthly', priority: 1 },
    { url: base + '/gallery', lastModified, changeFrequency: 'weekly', priority: 0.9 },
    { url: base + '/tour', lastModified, changeFrequency: 'monthly', priority: 0.8 },
    ...UNITS.map((u) => ({
      url: base + '/tour?unit=' + u.key,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    })),
    { url: base + '/privacy', lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: base + '/terms', lastModified, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
