// Static arrays for filtering search results

export const EXCLUDED_DIRECTORIES = [
  'bizi.si',
  'zlatestrani.si',
  'poslovniseznam.si',
  'firme.si',
  'ajpes.si',
  'telefonski-imenik.si',
  'najdi.si'
  // Add more as discovered
];

export const EXCLUDED_SOCIAL_MEDIA = [
  'facebook.com',
  'linkedin.com',
  'instagram.com',
  'twitter.com',
  'youtube.com',
  'tiktok.com',
  'pinterest.com'
];

export const EXCLUDED_MARKETPLACES = [
  'amazon.com',
  'ebay.com',
  'mercator.si',
  'enaa.com'
];

// Combine all exclusions
export const ALL_EXCLUDED_DOMAINS = [
  ...EXCLUDED_DIRECTORIES,
  ...EXCLUDED_SOCIAL_MEDIA,
  ...EXCLUDED_MARKETPLACES
]; 