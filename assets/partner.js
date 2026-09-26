/*
  Decision Lab: partner page.
    1. Configure optional direct contact
    2. Two-step intake: step 1 sends right away (3 fields), step 2 adds optional detail
    3. Attach the estimate from the assessment page if the visitor ran one
*/
(function () {
  'use strict';

  const Site = window.Site;
  const config = Site.config;
  const $ = id => document.getElementById(id);

  // Step 1: optional direct-calendar link.
  function fillPartner() {
    $('booking-direct').hidden = !config.bookingUrl;
  }

  // Step 2: show the estimate carried over from the assessment page.
  const estimate = Site.store.get('dl-estimate');
  function showEstimate() {
    if (!estimate) return;
    $('estimate-attach').hidden = false;
    $('estimate-summary').textContent =
      `${estimate.workflow}, ${Site.money(estimate.monthly_savings_usd)}/mo estimated savings`;
  }

  // Prefill anything the visitor already told us this session.
  function prefill() {
    const email = Site.store.get('dl-email');
    const company = Site.store.get('dl-company');
    if (email) $('in-email').value = email;
    if (company) $('in-company').value = company;
  }

  // Validate step 1 and mark invalid fields.
  function validateStep1(form) {
    let ok = true;
    for (const name of ['name', 'email', 'company']) {
      const el = form[name];
      const valid = name === 'email' ? Site.isWorkEmail(el.value) : el.value.trim().length > 0;
      el.setAttribute('aria-invalid', String(!valid));
      if (!valid) ok = false;
    }
    return ok;
  }

  let lead = null; // what step 1 sent, reused by step 2

  async function onStep1(e) {
    e.preventDefault();
    const form = e.target;
    const status = $('intake-1-status');
    if (!validateStep1(form)) {
      status.className = 'status err';
      status.textContent = 'Name, a valid work email and company are needed.';
      form.querySelector('[aria-invalid=true]').focus();
      return;
    }
    lead = {
      type: 'fit-review',
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      company: form.company.value.trim(),
      website: form.website.value
    };
    if (estimate && $('attach-estimate').checked) lead.estimate = estimate;

    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    const res = await Site.submitLead({ ...lead });
    btn.disabled = false;
    if (!res.ok) { status.className = 'status err'; status.textContent = res.message; return; }

    Site.store.set('dl-email', lead.email);
    form.hidden = true;
    $('intake-2').hidden = false;
    $('in-workflow').focus();
  }

  async function onStep2(e) {
    e.preventDefault();
    const form = e.target;
    const volume = form.querySelector('input[name=volume]:checked');
    const detail = {
      type: 'fit-review-details',
      email: lead ? lead.email : '',
      workflow: form.workflow.value,
      volume: volume ? volume.value : '',
      notes: form.notes.value.trim()
    };
    // Only send if they gave us something.
    if (detail.workflow || detail.volume || detail.notes) {
      const res = await Site.submitLead(detail);
      if (!res.ok) { $('intake-2-status').className = 'status err'; $('intake-2-status').textContent = res.message; return; }
    }
    finish();
  }

  function finish() {
    $('intake-2').hidden = true;
    $('intake-done').hidden = false;
    if (Site.isPreview()) {
      $('done-heading').textContent = 'Preview complete.';
      $('done-message').textContent = 'Your details were not sent. This draft is not connected to an inbox.';
    }
  }

  fillPartner();
  showEstimate();
  prefill();
  $('intake-1').addEventListener('submit', onStep1);
  $('intake-2').addEventListener('submit', onStep2);
  $('skip-2').addEventListener('click', finish);
})();
