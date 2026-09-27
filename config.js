/*
  Decision Lab: site configuration.
  This is the only file you need to edit before hosting.

  1. formEndpoint: where form submissions go. Any service that accepts a JSON POST works.
       Formspree:  'https://formspree.io/f/your-form-id'
       Web3Forms:  'https://api.web3forms.com/submit'  (also set formExtraFields.access_key)
       Basin, Getform, or your own endpoint also work.
     Leave it empty to run in preview mode: forms work, nothing is sent, and a banner says so.

  2. bookingUrl: your Cal.com or Calendly link for the 30-minute fit review.
     Leave it empty and booking buttons point to the intake form instead.

  Team and partner logos are maintained in partner.html and assets/logos/.
*/
window.SITE_CONFIG = {
  brand: 'Decision Lab',

  // Lead capture
  formEndpoint: 'https://api.web3forms.com/submit',
  formExtraFields: {
    access_key: '4483a6ba-dcbd-4964-8f1b-2af9b9085b3b',
    subject: 'Decision Lab inquiry'
  },
  bookingUrl: 'https://calendly.com/harish-useorin/30min',
  contactEmail: 'contact@useorin.com',

  // Facts pulled from TypeSafe's public docs. Re-check before each release.
  jev: {
    inputPricePerMillion: 0.042,
    medianSeconds: 0.114,
    llmMedianSeconds: 8.566,
    requestsPerMinute: 1200,
    maxStatePlusQuestionTokens: 32000,
    maxRequestTokens: 64000,
    verifiedOn: '25 Sep 2026'
  }
};
