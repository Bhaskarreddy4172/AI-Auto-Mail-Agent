/**
 * TechBott India Product Knowledge Base
 * Scraped from https://techbottindia.com — products only.
 */

const COMPANY_INFO = {
  name: 'TechBott India',
  tagline: 'Innovative Printing and Automation Solutions',
  headquarters: 'Plot #454, Subash Nagar, IDA Jeedimetla, Hyderabad – 500 055',
  phone: ['+91 7337335751', '040 40207440'],
  email: 'info@techbottindia.com',
  industries: ['FMCG', 'Pharma', 'Food & Beverages', 'Automotive', 'Electronics', 'Medical'],
  usp: [
    '20–30% reduction in printing and coding costs',
    'German-engineered technology',
    'Strong after-sales and AMC support',
    'Pan-India service network',
    'End-to-end printing & automation solutions',
  ],
};

const PRODUCTS = [
  {
    category: 'Continuous Inkjet (CIJ) Printers',
    slug: 'cij',
    overview: 'High-speed, reliable CIJ printers that use a continuous stream of ink droplets for precise prints on paper, plastic, metal, curved and uneven surfaces like bottles, cans, and irregular shapes.',
    models: [
      {
        name: 'JET3 ECO',
        brand: 'LEIBINGER',
        description: 'Combines top-notch print quality, dependable performance, and operational efficiency at an attractive price. Factory-configured with one print head and a 3-meter umbilical.',
        features: [
          'Sealtronic printhead — prevents ink drying, eliminates cleaning downtime',
          'Contact-free printing at speeds up to 403 m/min',
          'Prints up to 5 lines of text',
          '800+ intuitive, user-friendly functions',
          'Windows-based touchscreen interface',
          'Compatible with wide range of ink formulations',
          'All software upgrades included at no extra cost',
          'German-engineered',
        ],
      },
      {
        name: 'JET2 NEO',
        brand: 'LEIBINGER',
        description: 'Dependable CIJ printer for standard marking and coding. Prints expiry dates, manufacturing dates, batch numbers, and variable information up to 3 lines.',
        features: [
          'Sealtronic print head prevents clogging, reduces maintenance',
          'Printing speed up to 268 m/min',
          'Low solvent usage for eco-friendly operation',
          'Wide range of connectivity options and smart features',
          'Compatible with various ink types for different surfaces',
          'Designed for cost efficiency and long-term performance',
        ],
      },
      {
        name: '300 Series (Model 3260)',
        brand: 'TechBott',
        description: 'Industrial CIJ printer with detailed specifications for high-volume production environments.',
        specs: {
          printHeadDuct: '3m / 6m',
          nozzleSpecs: '400µ, 50µ, 60µ, 75µ',
          printingHeight: '2–20mm',
          printingDistance: '3–30mm',
          printingLines: '1–5 lines',
          inkColors: 'Black, Red, Blue, Green, White, Invisible',
          inkTypes: 'High adhesion, Migration resistance, High temperature resistance, Glass-specific, Food grade, Oil resistance',
          printContent: 'Text, Time, Date, Logo, Shift, Serial Number, Dynamic Barcode/QR Code, Dynamic Database',
          os: 'Embedded Linux',
          display: '10.1-inch color industrial touch screen',
          interfaces: 'Network port, USB, RS232',
          protectionLevel: 'IP55',
          power: '100–240V AC, 150W',
          memory: '256M',
          machineMaterial: '304 stainless steel',
          dimensions: '400mm × 250mm × 550mm',
          weight: '22 kg',
          workingTemp: '0–45°C',
          humidity: '30–70% RH',
          certifications: 'RoHS, CE, BIS',
          cpu: 'American TI AM3358 industrial grade',
          fpga: 'American Xilinx Spartan-6 industrial grade',
          languages: '40+ languages (Chinese, English, Arabic, Danish, German, Russian, French, Finnish, Korean, Japanese, Spanish, Italian, etc.)',
        },
        printMaterials: 'Carton, Plastic, Metal, Boarding, Pipe, Stone, Cable, Glass, Electronic components, Auto parts, Industrial chemical packaging, Medical/Food/Gift box',
      },
    ],
  },
  {
    category: 'Thermal Inkjet (TIJ) Printers',
    slug: 'tij',
    overview: 'Advanced TIJ printers using HP Thermal Ink Jet T2.5 Technology for precise, vibrant prints on various surfaces. Available as inline and handheld models.',
    models: [
      {
        name: 'TIJ Inline Printer',
        description: 'Industrial thermal inkjet printer for high-speed production lines.',
        features: [
          'HP Thermal Ink Jet T2.5 Technology for reliability',
          'Printing speed up to 240 m/min',
          '150 dpi to 600 dpi resolution',
          '1mm to 25mm adjustable printing height',
          'GS1 Data Matrix support',
          'Network remote centralized management',
          'Anti-counterfeiting trace data printing',
          'Real-time printing cost calculation',
          'Wireless keyboard and mouse control',
          'Production line alarm light control',
          'Zero breakdown — maximum uptime',
          '5-inch and 7-inch full graphics touch screen',
          'No hidden cost — only ink cost is running cost',
          'Ethernet / USB / RS232 connectivity',
        ],
      },
      {
        name: 'TIJ Hand Held',
        description: 'Portable handheld thermal inkjet printer for flexible marking applications.',
      },
    ],
  },
  {
    category: 'Thermal Transfer Overprinters (TTO)',
    slug: 'tto',
    overview: 'TTO printers for high-quality, reliable printing on flexible packaging materials. Uses Linx TT Series thermal transfer technology.',
    models: [
      {
        name: 'Linx TT Series',
        brand: 'Linx',
        description: 'Thermal transfer overprinters for printing best-before dates, batch codes, barcodes, ingredients, logos and product information on flexible packaging.',
        features: [
          'Print speed up to 1000 mm/s at widths up to 107mm',
          'Advanced motor drive — operates without compressed air',
          'Low total cost of ownership',
          '3 ribbon saving modes to optimize usage',
          'Ribbon lengths up to 1,200m for minimal change intervals',
          'Quick push-button cassette ribbon change',
          'Electronic pressure control for easy print quality setup',
          'Responsive, intuitive graphic user interface',
          'Minimal user-maintainable parts, easy to replace',
        ],
      },
    ],
  },
  {
    category: 'Drop-On-Demand (DOD) Printers',
    slug: 'dod',
    overview: 'DOD printers with precise ink droplet placement for high-quality prints on various materials. Versatile for professional and personal use, with faster speeds and reduced ink consumption.',
    models: [
      {
        name: 'DOD Printer',
        description: 'Drop-on-demand printer for versatile marking and coding applications.',
        features: [
          'Precise and efficient ink droplet placement',
          'Prints on various materials',
          'Faster printing speeds',
          'Reduced ink consumption',
          'User-friendly controls',
          'Seamless integration into production lines',
        ],
      },
    ],
  },
  {
    category: 'CO₂ Laser Printers',
    slug: 'co2-laser',
    overview: 'CO₂ lasers for non-contact marking and engraving on non-metals — leather, paper, rubber, plastics, glass, wood, and more.',
    models: [
      {
        name: 'CO₂ Laser Marker',
        description: 'Industrial CO₂ laser for high-speed coding and marking on non-metal surfaces.',
        specs: {
          laserWavelength: '1060nm',
          laserPower: '20W / 30W / 60W',
          maxSpeed: '900–1800 characters/second (power dependent)',
          markingLineWidth: '0.09mm',
          minCharacter: '0.15mm',
          markingSpeed: '≤12000 mm/s',
          markingDepth: '0.01–2mm',
          repeatability: '±0.002mm',
          coolingSystem: 'Built-in air cooling',
          operatingLife: '> 100,000 hours',
          os: 'Embedded Linux system kernel, anti-virus',
          safetyLevel: 'IP54, Level IV',
          codingModes: 'Static coding, analog speed coding, encoder speed coding',
          qrCodeTypes: 'QR codes, DA codes, dozens of barcode types',
          workTableArea: '110 × 110mm standard',
          markingRange: 'Customizable; Standard 110mm, optional 150/175/200/300/400/600',
          environment: '-20°C to 45°C, relative humidity 80%',
          powerSupply: '220V 50Hz AC, 500W',
          weight: '100 kg',
        },
        materials: 'Leather, Paper, Rubber, Plastics, Glass, Wood',
        markingContent: 'Patterns, text, DataMatrix QR code, serial number, counters, dates, shifts, variables',
      },
    ],
  },
  {
    category: 'Fiber Laser Printers',
    slug: 'fiber-laser',
    overview: 'Fiber lasers for permanent marking on metals and non-metals. Compact, high-power, with 100,000+ hour lifespans.',
    models: [
      {
        name: 'Fiber Laser Marker',
        description: 'Industrial fiber laser for high-precision marking on metals and non-metals.',
        specs: {
          laserWavelength: '1060nm',
          laserPower: '20W / 30W / 50W / 60W',
          laserType: 'Pulsed or continuous',
          markingDepth: '0.5mm (material dependent)',
          markingLineSpeed: '7000 mm/s',
          minCharacter: '0.15mm',
          minLineWidth: '0.012mm',
          repeatability: '±0.002mm',
          markingRange: 'Standard 100mm × 100mm',
          operatingLife: '> 100,000 hours',
          coolingSystem: 'Built-in air cooling',
          workTable: '320mm × 200mm, bearing 30 kg',
          liftingHeight: '550mm',
          os: 'WinXP / Win7',
          graphicConverter: 'CAD, CorelDRAW, CAXA',
          environment: '-20°C to 45°C, relative humidity 80%',
          dimensions: '620mm × 760mm × 1400mm',
          weight: '45 kg (standard) / 83 kg (heavy-duty)',
        },
        materials: 'All metals, metal alloys, plastics, rubber, leather',
        markingContent: 'Patterns, text, DataMatrix QR code, serial number, counters, dates, shifts, variables',
        industries: 'Automotive, Electronics, Medical machining',
      },
    ],
  },
  {
    category: 'UV Laser Printers',
    slug: 'uv-laser',
    overview: 'UV lasers (355nm) for ultra-precise marking on sensitive materials. Ideal for cold-marking applications with minimal heat effect.',
    models: [
      {
        name: 'UV Laser Marker',
        description: 'UV laser for precision marking with minimal thermal impact.',
        specs: {
          laserWavelength: '355nm',
          laserPower: '3W / 5W / 6W / 8W / 10W',
          maxSpeed: '300–500 characters/second (power dependent)',
          markingLineWidth: '0.08mm',
          minCharacter: '0.15mm',
          markingSpeed: '≤12000 mm/s',
          markingDepth: '0.01–10mm',
          repeatability: '±0.002mm',
          coolingMode: 'Water cooling',
          laserType: 'Metal encapsulated integrated laser',
          safetyLevel: 'IP54, Level IV',
          markingRange: 'Standard 120mm, optional 150/175/200/300/400/600',
          codingModes: 'Static coding, analog speed coding, encoder speed coding',
          qrCodeTypes: 'QR codes, DA codes, dozens of barcode types',
          os: 'Embedded Linux system kernel, anti-virus',
          environment: '-20°C to 45°C, relative humidity 80%',
          powerSupply: '220V 50Hz AC, 500W',
        },
        materials: 'All metals and most non-metals',
        markingContent: 'Text, graphics, automatic date, shift, serial number',
      },
    ],
  },
  {
    category: 'Thermal Transfer Ribbons',
    slug: 'ribbons',
    overview: 'High-quality thermal transfer ribbons engineered for TTO and thermal transfer printers. Excellent resistance to smudging, fading, and abrasion. Available in various widths and lengths.',
    models: [
      {
        name: 'Thermal Transfer Ribbon',
        description: 'Durable ribbon for barcodes, labels, and critical information printing. Delivers smooth, precise results on a variety of materials.',
      },
    ],
  },
  {
    category: 'Conveyor Systems',
    slug: 'conveyors',
    overview: 'Industrial conveyor systems for production line automation and material handling.',
  },
  {
    category: 'Labeling Machines',
    slug: 'labeling',
    overview: 'Automated labeling machines for product identification and compliance.',
  },
  {
    category: 'Packing & Material Handling Solutions',
    slug: 'packing',
    overview: 'End-to-end packing and material handling automation solutions.',
  },
  {
    category: 'Inks & Cartridges',
    slug: 'inks',
    overview: 'Wide range of printing inks and cartridges for CIJ, TIJ, and DOD printers. Available in Black, Red, Blue, Green, White, Invisible. Types include high adhesion, food grade, oil resistant, and more.',
  },
  {
    category: 'Wash & Make-Up Fluids',
    slug: 'fluids',
    overview: 'Maintenance fluids for CIJ and DOD printers — wash solutions and make-up fluids to maintain print quality and extend printer life.',
  },
];

/**
 * Search the product knowledge base with a text query.
 * Returns matching products with relevance.
 */
export function searchProducts(query) {
  const q = query.toLowerCase();
  const results = [];

  for (const product of PRODUCTS) {
    let score = 0;
    const matchReasons = [];

    // Category match
    if (product.category.toLowerCase().includes(q)) {
      score += 10;
      matchReasons.push('category');
    }

    // Slug/keyword match
    if (product.slug && q.includes(product.slug)) {
      score += 8;
      matchReasons.push('keyword');
    }

    // Overview match
    if (product.overview?.toLowerCase().includes(q)) {
      score += 5;
      matchReasons.push('overview');
    }

    // Token-based matching for multi-word queries
    const tokens = q.split(/\s+/).filter(t => t.length > 2);
    for (const token of tokens) {
      if (product.category.toLowerCase().includes(token)) score += 3;
      if (product.overview?.toLowerCase().includes(token)) score += 2;
      if (product.slug?.includes(token)) score += 4;

      // Search inside models
      if (product.models) {
        for (const model of product.models) {
          if (model.name.toLowerCase().includes(token)) score += 4;
          if (model.description?.toLowerCase().includes(token)) score += 2;
          if (model.features?.some(f => f.toLowerCase().includes(token))) score += 2;
          if (model.printMaterials?.toLowerCase().includes(token)) score += 3;
          if (model.materials?.toLowerCase().includes(token)) score += 3;
          if (model.specs) {
            const specStr = JSON.stringify(model.specs).toLowerCase();
            if (specStr.includes(token)) score += 2;
          }
        }
      }
    }

    if (score > 0) {
      results.push({ product, score, matchReasons });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * Get all products as a formatted text block for LLM context.
 */
export function getAllProductsText() {
  const lines = [`=== TechBott India — Product Catalog ===\n`];

  for (const p of PRODUCTS) {
    lines.push(`## ${p.category}`);
    lines.push(p.overview);

    if (p.models) {
      for (const m of p.models) {
        lines.push(`  • ${m.name}${m.brand ? ` (${m.brand})` : ''}`);
        if (m.description) lines.push(`    ${m.description}`);
        if (m.features) {
          lines.push(`    Key Features:`);
          for (const f of m.features) lines.push(`      - ${f}`);
        }
        if (m.specs) {
          lines.push(`    Specifications:`);
          for (const [k, v] of Object.entries(m.specs)) {
            const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
            lines.push(`      ${label}: ${v}`);
          }
        }
        if (m.printMaterials) lines.push(`    Print Materials: ${m.printMaterials}`);
        if (m.materials) lines.push(`    Materials: ${m.materials}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format search results into a text block for the LLM.
 */
export function formatProductResults(results) {
  if (results.length === 0) return 'No matching products found.';

  const lines = [];
  for (const { product } of results.slice(0, 5)) {
    lines.push(`## ${product.category}`);
    lines.push(product.overview);
    if (product.models) {
      for (const m of product.models) {
        lines.push(`  • ${m.name}${m.brand ? ` (${m.brand})` : ''}`);
        if (m.description) lines.push(`    ${m.description}`);
        if (m.features) {
          for (const f of m.features) lines.push(`    - ${f}`);
        }
        if (m.specs) {
          for (const [k, v] of Object.entries(m.specs)) {
            const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
            lines.push(`    ${label}: ${v}`);
          }
        }
      }
    }
    lines.push('');
  }
  return lines.join('\n');
}

export { COMPANY_INFO, PRODUCTS };
