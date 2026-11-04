/*
 * SITE CONFIGURATION — edit this file to publish verified information.
 *
 * Accuracy rule: only fill a field once it is verified. Empty values render as
 * "Pending verification" (records) or are hidden (contact links).
 */
window.SITE_CONFIG = {
  contact: {
    // Public email shown on the site and used as the form's fallback (mailto:).
    email: '',
    phone: '',
    linkedin: '', // full URL
    // Optional form backend (e.g. a Formspree endpoint "https://formspree.io/f/xxxx").
    // When set, the contact form POSTs JSON here. When empty, the form opens the
    // visitor's email app addressed to `email` above.
    formEndpoint: '',
  },

  // Verified financial records for the Real Estate & Investments section.
  // Proposed scenarios are shown separately and are never summed into these.
  verifiedRecords: {
    // e.g. [{ label: 'Lorenzo Court land lease', date: '2025-03', amount: 5400, type: 'Rent collected' }]
    closedTransactions: [],
    actualGrossSales: null, // number in USD, e.g. 25000
    realizedReturns: null, // string, e.g. '$4,800 net cash flow (2025)'
    investedCapital: null, // number in USD
    asOf: '', // e.g. 'November 2026'
  },

  // Verified book purchase links, keyed by data-book id in index.html.
  bookLinks: {
    // 'whos-driving-my-car': 'https://...'
  },
};
