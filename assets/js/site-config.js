/*
 * SITE CONFIGURATION — edit this file to publish verified information.
 *
 * Empty values are hidden on the site.
 */
window.SITE_CONFIG = {
  contact: {
    // Public email to display on the site/resume. Left empty: the inbox stays private.
    email: '',
    showEmail: false,
    phone: '',
    linkedin: '', // full URL
    imdb: 'https://www.imdb.com/name/nm15804821/',
    // Form backend: FormSubmit forwards each submission to the owner's inbox.
    // The random alias keeps the inbox address out of the site's code.
    // Any Formspree-compatible JSON endpoint also works here.
    formEndpoint: 'https://formsubmit.co/ajax/c53d44c09565da6b637659e53d270675',
  },


  // Verified book purchase links, keyed by data-book id in index.html.
  bookLinks: {
    // 'whos-driving-my-car': 'https://...'
  },
};
