/**
 * Mock Offers Data
 * 
 * Simulates fetching active promotions and discounts.
 */

const mockOffers = {
  'JET3 ECO': 'We currently have a 10% discount on the JET3 ECO for the next 7 days, along with a free 3-month maintenance package.',
  'TIJ Inline Printer': 'Special promotion: Buy 1 TIJ Inline Printer and get a complimentary set of high-adhesion ink cartridges.',
  'CO2 Laser Marker': 'End-of-quarter sale: $500 off any CO2 Laser Marker model.'
};

/**
 * Get active offers for the given products.
 * @param {Array<string>} productKeywords - Array of product names or keywords.
 * @returns {string} Formatted string of active offers, or empty string if none.
 */
export function getActiveOffers(productKeywords) {
  if (!productKeywords || productKeywords.length === 0) return '';

  const foundOffers = [];
  
  for (const kw of productKeywords) {
    for (const [product, offerText] of Object.entries(mockOffers)) {
      if (kw.toLowerCase().includes(product.toLowerCase()) || product.toLowerCase().includes(kw.toLowerCase())) {
        foundOffers.push(`- **${product}**: ${offerText}`);
      }
    }
  }

  const uniqueOffers = [...new Set(foundOffers)];
  if (uniqueOffers.length === 0) return '';

  return uniqueOffers.join('\n');
}
