/*
  Decision Lab: shared behavior for all pages.
  - Fills in config values (brand, booking links, partner details)
  - Shows a preview banner when no form endpoint is set
  - Exposes Site.submitLead() for every form on the site
*/
(function () {
  'use strict';

  const config = window.SITE_CONFIG || {};

  // Step 1: small helpers used across pages.
  const Site = {
    config,

    // Format a number as whole US dollars, e.g. 27811 -> "$27,811".
    money(n) {
      if (!Number.isFinite(n)) return '—';
      const digits = Math.abs(n) < 10 && n !== 0 ? 2 : 0;
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
    },

    // Format a plain number with separators, e.g. 1000000 -> "1,000,000".
    count(n, digits = 0) {
      if (!Number.isFinite(n)) return '—';
      return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(n);
    },

    // Read and write sessionStorage safely. It can throw in private windows.
    store: {
      get(key) {
        try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; }
      },
      set(key, value) {
        try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
      }
    },

    // True when forms are not connected to a real endpoint yet.
    isPreview() { return !config.formEndpoint; },

    /*
      Send a lead to the configured endpoint.
      - payload: plain object with what the visitor typed plus context
      - returns { ok: true } or { ok: false, message }
    */
    async submitLead(payload) {
      // Step A: drop bots that filled the hidden honeypot field.
      if (payload.website) return { ok: true, dropped: true };
      delete payload.website;

      // Step B: add context that helps you follow up.
      const body = {
        ...config.formExtraFields,
        ...payload,
        page: location.pathname.split('/').pop() || 'index.html',
        submitted_at: new Date().toISOString()
      };

      // Step C: preview mode. Log it so you can see exactly what would be sent.
      if (Site.isPreview()) {
        console.info('[Decision Lab preview] Form payload (not sent):', body);
        return { ok: true, preview: true };
      }

      // Step D: real submission as JSON.
      try {
        const res = await fetch(config.formEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error('Status ' + res.status);
        return { ok: true };
      } catch (err) {
        console.error('Form submit failed', err);
        const fallback = config.contactEmail ? ' Email ' + config.contactEmail + ' instead.' : '';
        return { ok: false, message: 'That did not go through.' + fallback };
      }
    },

    // Simple email check. The browser's own type=email check runs first.
    isWorkEmail(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value).trim());
    }
  };

  // Step 2: apply config to the page once the DOM is ready.
  function applyConfig() {
    // Brand name everywhere it appears.
    document.querySelectorAll('[data-brand]').forEach(el => { el.textContent = config.brand || 'Decision Lab'; });

    // Booking buttons: go to the booking link if set, otherwise to the intake form.
    document.querySelectorAll('[data-booking]').forEach(el => {
      if (config.bookingUrl) {
        el.href = config.bookingUrl;
        el.target = '_blank';
        el.rel = 'noopener';
      } else {
        el.href = el.dataset.fallback || 'partner.html#start';
      }
    });

    // Contact email links.
    document.querySelectorAll('[data-contact]').forEach(el => {
      if (config.contactEmail) {
        el.href = 'mailto:' + config.contactEmail;
        if (!el.textContent.trim()) el.textContent = config.contactEmail;
      }
    });

    // Pricing verification date.
    document.querySelectorAll('[data-verified]').forEach(el => { el.textContent = (config.jev && config.jev.verifiedOn) || ''; });

    // Year in the footer.
    document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });

    // Preview banner so you never ship a site whose forms go nowhere.
    if (Site.isPreview()) {
      const banner = document.createElement('div');
      banner.className = 'preview-banner';
      banner.textContent = 'Preview mode: forms are not connected. Set formEndpoint in config.js before hosting.';
      document.body.prepend(banner);
    }
  }

  window.Site = Site;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyConfig);
  else applyConfig();
})();
