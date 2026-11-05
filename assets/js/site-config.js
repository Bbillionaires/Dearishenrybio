/*
 * SITE CONFIGURATION — edit this file to publish verified information.
 *
 * Empty values are hidden on the site.
 */
window.SITE_CONFIG = {
  contact: {
    // Inbox that receives contact-form requests.
    email: 'dearishenry@gmail.com',
    // Show the email address publicly on the site and resume? (false = private)
    showEmail: false,
    phone: '',
    linkedin: '', // full URL
    imdb: 'https://www.imdb.com/name/nm15804821/',
    // Form backend. FormSubmit forwards each submission to the inbox above.
    // The FIRST submission triggers a one-time activation email from FormSubmit to
    // that inbox — click "Activate Form" in it, then all later messages arrive.
    // Any Formspree-compatible JSON endpoint also works here.
    formEndpoint: 'https://formsubmit.co/ajax/dearishenry@gmail.com',
  },


  // Verified book purchase links, keyed by data-book id in index.html.
  bookLinks: {
    // 'whos-driving-my-car': 'https://...'
  },
};
