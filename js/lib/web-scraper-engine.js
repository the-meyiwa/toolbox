/* ============================================================
   TOOLBOX — Web Scraper, Image Extractor & Structured Data Engine
   Provides robust HTML parsing, OpenGraph, JSON-LD Schema.org,
   image extraction, product normalization, and SSRF guardrails.
   ============================================================ */

/**
 * SSRF Host Validator: Blocks private networks, localhost, link-local, and AWS metadata
 */
export function isBlockedHost(hostname) {
  if (!hostname) return true;
  const h = hostname.toLowerCase().trim();
  if (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '::1' ||
    h === '0.0.0.0' ||
    h.endsWith('.internal') ||
    h.endsWith('.local') ||
    h.endsWith('.onion')
  ) {
    return true;
  }
  // Private subnets (IPv4) & Link-local (AWS metadata 169.254.169.254)
  if (
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h) ||
    /^169\.254\./.test(h) ||
    /^127\./.test(h)
  ) {
    return true;
  }
  return false;
}

/**
 * Calculates Haversine distance in kilometers between two GPS coordinates
 */
export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const l1 = Number(lat1);
  const l2 = Number(lat2);
  const o1 = Number(lon1);
  const o2 = Number(lon2);
  if (isNaN(l1) || isNaN(l2) || isNaN(o1) || isNaN(o2)) return null;

  const R = 6371; // Earth's mean radius in km
  const dLat = ((l2 - l1) * Math.PI) / 180;
  const dLon = ((o2 - o1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((l1 * Math.PI) / 180) *
      Math.cos((l2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

/**
 * Resolves a potentially relative URL against a base URL
 */
export function resolveUrl(relUrl, baseUrl) {
  if (!relUrl || typeof relUrl !== 'string') return null;
  const trimmed = relUrl.trim();
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.startsWith('javascript:')) {
    return null;
  }
  try {
    return new URL(trimmed, baseUrl).href;
  } catch {
    return null;
  }
}

/**
 * Normalizes and extracts price in Nigerian Naira (or other currencies)
 */
export function parsePrice(text) {
  if (!text || typeof text !== 'string') return null;
  const clean = text.replace(/,/g, '').trim();

  // Nigerian Naira formats: ₦550,000 | NGN 550000 | 550,000 Naira
  const nairaMatch = clean.match(/(?:₦|NGN|\bNaira\b)\s*([0-9]+(?:\.[0-9]{1,2})?)/i) ||
    clean.match(/([0-9]+(?:\.[0-9]{1,2})?)\s*(?:₦|NGN|\bNaira\b)/i);
  if (nairaMatch) {
    return {
      amount: parseFloat(nairaMatch[1]),
      currency: 'NGN',
      symbol: '₦',
      formatted: `₦${parseFloat(nairaMatch[1]).toLocaleString('en-NG')}`
    };
  }

  // USD
  const usdMatch = clean.match(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)/);
  if (usdMatch) {
    return {
      amount: parseFloat(usdMatch[1]),
      currency: 'USD',
      symbol: '$',
      formatted: `$${parseFloat(usdMatch[1]).toLocaleString('en-US')}`
    };
  }

  // Generic amount
  const genMatch = clean.match(/([0-9]+(?:\.[0-9]{1,2})?)/);
  if (genMatch && parseFloat(genMatch[1]) > 0) {
    return {
      amount: parseFloat(genMatch[1]),
      currency: 'NGN',
      symbol: '₦',
      formatted: `₦${parseFloat(genMatch[1]).toLocaleString('en-NG')}`
    };
  }

  return null;
}

/**
 * Parses raw HTML string and extracts structured metadata, Schema.org JSON-LD,
 * OpenGraph, images, products, and links.
 */
export function parseWebPage(html, baseUrl) {
  if (!html || typeof html !== 'string') {
    return {
      title: '',
      description: '',
      canonicalUrl: baseUrl,
      openGraph: {},
      structuredData: [],
      products: [],
      images: [],
      links: [],
      textSummary: ''
    };
  }

  let title = '';
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) title = titleMatch[1].trim();

  let description = '';
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  if (descMatch) description = descMatch[1].trim();

  let canonicalUrl = baseUrl;
  const canMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  if (canMatch) {
    const resolved = resolveUrl(canMatch[1], baseUrl);
    if (resolved) canonicalUrl = resolved;
  }

  // Open Graph
  const openGraph = {};
  const ogRegex = /<meta[^>]+property=["']og:([a-zA-Z0-9_:]+)["'][^>]+content=["']([^"']+)["']/gi;
  let ogm;
  while ((ogm = ogRegex.exec(html)) !== null) {
    openGraph[ogm[1]] = ogm[2].trim();
  }
  if (!title && openGraph.title) title = openGraph.title;
  if (!description && openGraph.description) description = openGraph.description;

  // JSON-LD Structured Data (Schema.org)
  const structuredData = [];
  const jsonLdRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let jld;
  while ((jld = jsonLdRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(jld[1].trim());
      if (Array.isArray(parsed)) {
        structuredData.push(...parsed);
      } else if (parsed && typeof parsed === 'object') {
        structuredData.push(parsed);
      }
    } catch {}
  }

  // Extract Images
  const seenImgUrls = new Set();
  const images = [];

  // OG Image
  if (openGraph.image) {
    const ogAbs = resolveUrl(openGraph.image, baseUrl);
    if (ogAbs && !seenImgUrls.has(ogAbs)) {
      seenImgUrls.add(ogAbs);
      images.push({
        url: ogAbs,
        alt: title || 'Page header image',
        type: 'opengraph',
        sourceUrl: baseUrl
      });
    }
  }

  // <img> tags and srcset
  const imgRegex = /<img\b([^>]+)>/gi;
  let imgM;
  while ((imgM = imgRegex.exec(html)) !== null) {
    const attrs = imgM[1];
    const srcMatch = attrs.match(/\bsrc=["']([^"']+)["']/i);
    const dataSrcMatch = attrs.match(/\bdata-(?:src|lazy-src|original)=["']([^"']+)["']/i);
    const altMatch = attrs.match(/\balt=["']([^"']*)["']/i);
    const widthMatch = attrs.match(/\bwidth=["']?([0-9]+)["']?/i);
    const heightMatch = attrs.match(/\bheight=["']?([0-9]+)["']?/i);

    const rawSrc = srcMatch ? srcMatch[1] : (dataSrcMatch ? dataSrcMatch[1] : null);
    if (!rawSrc) continue;

    const absSrc = resolveUrl(rawSrc, baseUrl);
    if (!absSrc || seenImgUrls.has(absSrc)) continue;

    // Filter tiny tracking pixels / spacer GIFs
    const w = widthMatch ? parseInt(widthMatch[1], 10) : null;
    const h = heightMatch ? parseInt(heightMatch[1], 10) : null;
    if ((w !== null && w <= 2) || (h !== null && h <= 2)) continue;
    if (absSrc.includes('spacer.gif') || absSrc.includes('pixel.gif') || absSrc.includes('1x1.')) continue;

    seenImgUrls.add(absSrc);
    images.push({
      url: absSrc,
      alt: altMatch ? altMatch[1].trim() : (title || 'Image'),
      width: w || undefined,
      height: h || undefined,
      sourceUrl: baseUrl
    });
  }

  // Deep CDN / Cloudinary scan in scripts and JSON-LD for dynamic client-rendered SPAs
  const cdnRegex = /https?:\/\/[a-zA-Z0-9_.-]*(?:res\.cloudinary\.com|images\.unsplash\.com)[^\s"'<>\)]+\.(?:jpg|jpeg|png|webp|avif)/gi;
  let cdnM;
  while ((cdnM = cdnRegex.exec(html)) !== null) {
    const rawCdn = cdnM[0];
    if (!seenImgUrls.has(rawCdn)) {
      seenImgUrls.add(rawCdn);
      images.push({
        url: rawCdn,
        alt: title || 'Image',
        sourceUrl: baseUrl
      });
    }
  }

  // Extract Products (Schema.org & Pattern matching)
  const products = [];
  const seenProductKeys = new Set();

  for (const s of structuredData) {
    const isProduct = s['@type'] === 'Product' || (Array.isArray(s['@type']) && s['@type'].includes('Product'));
    if (isProduct && s.name) {
      const offer = Array.isArray(s.offers) ? s.offers[0] : s.offers;
      const rawPrice = offer?.price || offer?.lowPrice || offer?.highPrice;
      const curr = offer?.priceCurrency || 'NGN';
      const numPrice = rawPrice ? parseFloat(rawPrice) : null;
      const productImg = Array.isArray(s.image) ? s.image[0] : (typeof s.image === 'string' ? s.image : s.image?.url);

      const pKey = `${s.name}`.toLowerCase();
      if (!seenProductKeys.has(pKey)) {
        seenProductKeys.add(pKey);
        products.push({
          name: s.name.trim(),
          category: s.category || inferProductCategory(s.name),
          productType: inferProductType(s.name),
          price: numPrice,
          currency: curr,
          displayPrice: numPrice !== null ? (curr === 'NGN' ? `₦${numPrice.toLocaleString()}` : `${curr} ${numPrice}`) : 'Price on request',
          description: s.description ? s.description.slice(0, 200) : '',
          sku: s.sku || offer?.sku || null,
          availability: offer?.availability ? (offer.availability.includes('InStock') ? 'In Stock' : 'Out of Stock') : 'Available',
          url: resolveUrl(s.url || offer?.url || baseUrl, baseUrl),
          image: resolveUrl(productImg, baseUrl),
          source: 'structured_data'
        });
      }
    }
  }

  // Extract Internal / Same-Domain Links (for controlled crawling and pagination)
  const links = [];
  const seenLinks = new Set();
  const aRegex = /<a\b[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let aM;
  let baseHost = '';
  try { baseHost = new URL(baseUrl).hostname; } catch {}

  while ((aM = aRegex.exec(html)) !== null) {
    const rawHref = aM[1].trim();
    const linkText = aM[2].replace(/<[^>]+>/g, '').trim();
    const absHref = resolveUrl(rawHref, baseUrl);
    if (!absHref || seenLinks.has(absHref)) continue;

    try {
      const u = new URL(absHref);
      if (u.hostname === baseHost || u.hostname.endsWith(`.${baseHost}`)) {
        seenLinks.add(absHref);
        links.push({
          url: absHref,
          text: linkText.slice(0, 100),
          isPagination: /next|page|\b\d+\b/i.test(linkText) || /[?&](?:page|p)=\d+/i.test(absHref)
        });
      }
    } catch {}
  }

  // Extract Headings (H1, H2, H3)
  const headings = [];
  const headingRegex = /<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let hM;
  while ((hM = headingRegex.exec(html)) !== null) {
    const hText = hM[2].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    if (hText && hText.length > 1 && hText.length < 150) {
      headings.push({ level: parseInt(hM[1], 10), text: hText });
    }
  }

  // Extract About / Company Overview excerpt
  let aboutExcerpt = '';
  const aboutBlockRegex = /<(?:section|div|article|p)\b[^>]*(?:about|company|overview|mission|who-we-are|who_we_are|intro)[^>]*>([\s\S]*?)<\/(?:section|div|article|p)>/gi;
  const abMatch = aboutBlockRegex.exec(html);
  if (abMatch) {
    aboutExcerpt = abMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600);
  }
  if (!aboutExcerpt) {
    const pRegex = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
    let pM;
    while ((pM = pRegex.exec(html)) !== null) {
      const pText = pM[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (pText.length > 50 && (
        pText.toLowerCase().includes('about') ||
        pText.toLowerCase().includes('we provide') ||
        pText.toLowerCase().includes('we are') ||
        pText.toLowerCase().includes('specializ') ||
        pText.toLowerCase().includes('our team') ||
        pText.toLowerCase().includes('company')
      )) {
        aboutExcerpt = pText.slice(0, 600);
        break;
      }
    }
  }

  // Extract Contact Information (email, phone)
  const contactInfo = {};
  const emailMatch = html.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
  if (emailMatch && !emailMatch[0].endsWith('.png') && !emailMatch[0].endsWith('.jpg')) {
    contactInfo.email = emailMatch[0];
  }
  const phoneMatch = html.match(/(?:\+?\d{1,4}[-.\s]*)?(?:\(?\d{1,4}\)?[-.\s]*)?\d{3,4}[-.\s]*\d{3,4}\b/);
  if (phoneMatch) {
    contactInfo.phone = phoneMatch[0].trim();
  }

  // Clean readable text summary
  const cleanText = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  const textSummary = cleanText.slice(0, 3500);

  return {
    title: title || baseHost || 'Web Page',
    description,
    canonicalUrl,
    openGraph,
    structuredData,
    products,
    images: images.slice(0, 50),
    links: links.slice(0, 40),
    headings: headings.map(h => h.text).slice(0, 20),
    headingItems: headings.slice(0, 20),
    aboutExcerpt,
    contactInfo,
    text: textSummary,
    textSummary
  };
}

/**
 * Infers product category from product name
 */
export function inferProductCategory(name) {
  if (!name) return 'Consumer Electronics';
  const l = name.toLowerCase();
  if (l.includes('iphone') || l.includes('phone') || l.includes('samsung') || l.includes('pixel')) return 'Smartphones';
  if (l.includes('macbook') || l.includes('laptop') || l.includes('thinkpad') || l.includes('notebook')) return 'Laptops & Computers';
  if (l.includes('ipad') || l.includes('tablet')) return 'Tablets';
  if (l.includes('watch') || l.includes('band')) return 'Wearables & Smartwatches';
  if (l.includes('airpods') || l.includes('headphone') || l.includes('earbud') || l.includes('audio')) return 'Audio & Accessories';
  if (l.includes('charger') || l.includes('cable') || l.includes('case') || l.includes('adapter')) return 'Accessories';
  return 'Electronics';
}

/**
 * Infers product type from product name
 */
export function inferProductType(name) {
  if (!name) return 'Product';
  const l = name.toLowerCase();
  if (l.includes('iphone 16 pro max')) return 'Flagship Smartphone';
  if (l.includes('iphone 16 pro')) return 'Pro Smartphone';
  if (l.includes('iphone 16')) return 'Standard Smartphone';
  if (l.includes('iphone 15')) return 'Smartphone';
  if (l.includes('iphone')) return 'Smartphone';
  if (l.includes('macbook pro')) return 'Pro Laptop';
  if (l.includes('macbook air')) return 'Ultraportable Laptop';
  if (l.includes('macbook')) return 'Laptop';
  if (l.includes('ipad pro')) return 'Pro Tablet';
  if (l.includes('ipad air')) return 'Tablet';
  if (l.includes('ipad mini')) return 'Compact Tablet';
  if (l.includes('ipad')) return 'Tablet';
  if (l.includes('apple watch ultra')) return 'Rugged Smartwatch';
  if (l.includes('apple watch series')) return 'Smartwatch';
  if (l.includes('apple watch')) return 'Smartwatch';
  if (l.includes('airpods pro')) return 'Noise-Cancelling Earbuds';
  if (l.includes('airpods max')) return 'Over-Ear Headphones';
  if (l.includes('airpods')) return 'Wireless Earbuds';
  return 'Hardware';
}
