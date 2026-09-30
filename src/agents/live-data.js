import logger from '../logger.js';

/**
 * Mock Live Data Service
 * 
 * Simulates fetching live stock, pricing, and inventory data from an ERP or database.
 * In a real-world scenario, this would make HTTP requests to a live inventory API.
 */

// Mock inventory state
const mockInventory = {
  'JET3 ECO': { stock: 15, status: 'In Stock', nextDelivery: null, price: 4500 },
  'JET2 NEO': { stock: 4, status: 'Low Stock', nextDelivery: null, price: 3800 },
  '300 Series (Model 3260)': { stock: 0, status: 'Out of Stock', nextDelivery: '2026-09-01', price: 6200 },
  'TIJ Inline Printer': { stock: 22, status: 'In Stock', nextDelivery: null, price: 1200 },
  'TIJ Hand Held': { stock: 0, status: 'Out of Stock', nextDelivery: '2026-08-30', price: 800 },
  'Linx TT Series': { stock: 8, status: 'In Stock', nextDelivery: null, price: 5500 },
  'DOD Printer': { stock: 12, status: 'In Stock', nextDelivery: null, price: 7200 },
  'CO2 Laser Marker': { stock: 3, status: 'Low Stock', nextDelivery: null, price: 12500 },
  'Fiber Laser Marker': { stock: 5, status: 'In Stock', nextDelivery: null, price: 8500 },
  'UV Laser Marker': { stock: 2, status: 'Low Stock', nextDelivery: null, price: 14000 }
};

/**
 * Fetches live stock data for the requested product names.
 * @param {Array<string>} productCategories - Array of product names/categories to look up.
 * @returns {Promise<string>} A formatted string of live data to be injected into the LLM context.
 */
export async function getLiveStockData(productCategories) {
  logger.info(`  [Live Data] Fetching live stock data for: ${productCategories.join(', ')}`);
  
  if (!productCategories || productCategories.length === 0) {
    return 'No specific products identified for live stock check.';
  }

  // Simulate network delay for live API call
  await new Promise(resolve => setTimeout(resolve, 300));

  const results = [];
  
  // The 'productCategories' from child-llm might contain category names like 'Continuous Inkjet (CIJ) Printers'
  // Or product names. We will do a loose match against our mock inventory keys.
  
  for (const category of productCategories) {
    for (const [productName, data] of Object.entries(mockInventory)) {
      // If the product name or category is exactly mentioned
      if (category.toLowerCase().includes(productName.toLowerCase()) || 
          productName.toLowerCase().includes(category.toLowerCase())) {
        
        const deliveryStr = data.nextDelivery ? `(Expected restock: ${data.nextDelivery})` : '';
        results.push(`- ${productName}: ${data.stock} units available. Status: ${data.status}. Price: $${data.price} ${deliveryStr}`);
      }
    }
  }

  // Deduplicate results
  const uniqueResults = [...new Set(results)];

  if (uniqueResults.length === 0) {
    return 'Live stock data is currently unavailable for these specific items.';
  }

  return uniqueResults.join('\n');
}
