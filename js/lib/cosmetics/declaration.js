/* ============================================================
   TOOLBOX — Cosmetics Database: the Assistant's tool schema

   Kept apart from the catalogue so the Assistant can describe the
   tool without loading the data; js/lib/cosmetics/assistant.js runs
   it (loaded only when the tool is called).
   ============================================================ */

/* Same ids as CATEGORIES in ./db.js (tests/unit/cosmetics-database.test.js checks). */
export const CATEGORY_IDS = ['skincare', 'sun', 'makeup', 'hair', 'body', 'fragrance', 'oral', 'nails', 'lips', 'baby', 'men', 'other'];

export const COSMETICS_TOOL_DECLARATION = {
  name: 'cosmetics_database',
  description: 'The Toolbox Cosmetics Database: skincare, makeup, hair, body, sun care, fragrance and oral care products from brands worldwide, with specifications (SPF, PA, finish, shades, actives with percentages, fragrance family and notes, fluoride…) and full ingredient (INCI) lists in which every ingredient is explained (what it does, the compound behind it, formula, CAS) and flagged (fragrance allergens, alcohol, silicones, sulfates, parabens, essential oils). Actions: product (one product: specs, every ingredient with its job, what is worth knowing; products outside the catalogue are looked up live in Open Beauty Facts), ingredient (what an ingredient is and does, its compound, which products contain it), brand (country, owner, founding year, what it makes, its products), find (products matching filters: category, type, contains, free_of, min_spf), compare (two products: specs side by side, shared and different ingredients). Use it for any question about a cosmetic product, beauty brand or cosmetic ingredient; it shows a card that opens the Cosmetics Database.',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['product', 'ingredient', 'brand', 'find', 'compare'] },
      query: { type: 'string', description: 'The product, ingredient or brand as the person wrote it, e.g. "CeraVe Moisturizing Cream", "niacinamide", "COSRX".' },
      other: { type: 'string', description: 'compare: the second product.' },
      category: { type: 'string', enum: CATEGORY_IDS, description: 'find: product category.' },
      type: { type: 'string', description: 'find: product type, e.g. serum, sunscreen, moisturizer, shampoo, lipstick, fragrance.' },
      contains: { type: 'array', items: { type: 'string' }, description: 'find: ingredients the product must contain.' },
      free_of: { type: 'array', items: { type: 'string' }, description: 'find: what it must not contain: fragrance, alcohol, silicones, sulfates, parabens, essential oils, mineral oil, or any ingredient name.' },
      min_spf: { type: 'number', description: 'find: lowest SPF.' },
    },
    required: ['action'],
  },
};
