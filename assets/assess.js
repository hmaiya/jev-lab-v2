/*
  Decision Lab: assessment page.

  How it works, in order:
    1. Reference data: current-model prices, example workloads, fit-check questions.
    2. Read the form into one plain object.
    3. calculate(): pure math for cost, speed and routing.
    4. render(): write the numbers into the result panel.
    5. The brief: an HTML summary the visitor can save as PDF, unlocked by a work email.
    6. Wire up events and load the first example.
*/
(function () {
  'use strict';

  const { money, count, store } = window.Site;
  const JEV = window.SITE_CONFIG.jev;
  const $ = id => document.getElementById(id);

  /* ------------------------------------------------------------------
     1. Reference data
  ------------------------------------------------------------------ */

  // Current-model list prices, USD per million tokens. Verified 25 Sep 2026.
  // Sources: platform.claude.com/docs/en/about-claude/pricing, OpenAI pricing via yottalabs.ai, Gemini via benchlm.ai.
  const MODELS = [
    { id: 'fable-5.1',  name: 'Claude Fable 5.1',  in: 10, out: 50 },
    { id: 'gpt-6-astra', name: 'GPT-6 Astra',      in: 10, out: 50 },
    { id: 'opus-5.5',   name: 'Claude Opus 5.5',   in: 4,  out: 20 },
    { id: 'sonnet-5',   name: 'Claude Sonnet 5',   in: 2,  out: 10 },
    { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', in: 2, out: 12 },
    { id: 'haiku-4.5',  name: 'Claude Haiku 4.5',  in: 1,  out: 5 },
    { id: 'custom',     name: 'Other model (enter prices)', in: null, out: null }
  ];

  // The fit check. Each option moves the eligible share and may raise a flag.
  // Flags quote the mitigation from TypeSafe's "Known limitations of jev-1.13" page.
  const FIT = [
    {
      id: 'answer', q: 'What does the model return?',
      options: [
        { v: 'choice', label: 'One option from a list', base: 90, primitive: 'Choice' },
        { v: 'score',  label: 'A score on a rubric',    base: 90, primitive: 'Score' },
        { v: 'noul',   label: 'Yes or no',              base: 90, primitive: 'Noul' },
        { v: 'mix',    label: 'Decisions and some text', base: 50, primitive: 'Choice, Score or Noul for the decision steps',
          flag: ['warn', 'Split it. Decision steps move to Jev; text generation stays on your current model.'] },
        { v: 'text',   label: 'Free-form text',          base: 5, primitive: 'None. Jev is not trained for generation.',
          flag: ['bad', 'Jev is not trained for text generation. Keep this on your current model.'] }
      ]
    },
    {
      id: 'math', q: 'Does the answer depend on arithmetic, counting or date comparison?',
      options: [
        { v: 'no', label: 'No', delta: 0 },
        { v: 'some', label: 'Some, and code can do it', delta: -5,
          flag: ['warn', 'Do the arithmetic and date math in code. Ask Jev only the judgment.'] },
        { v: 'core', label: 'Yes, it is the task', delta: -40,
          flag: ['bad', 'Jev is not a calculator and reads dates as text. This part stays in code or on your current model.'] }
      ]
    },
    {
      id: 'size', q: 'After filtering, does each input fit in about 32k tokens (≈150k characters)?',
      options: [
        { v: 'yes', label: 'Yes', delta: 0 },
        { v: 'usually', label: 'Usually', delta: -10,
          flag: ['warn', 'Filter irrelevant fields in code first. Oversized inputs go to the fallback path.'] },
        { v: 'no', label: 'No', delta: -40,
          flag: ['bad', 'Over the 32k state-plus-question limit. Split the input or pre-select with retrieval.'] }
      ]
    },
    {
      id: 'media', q: 'Is the input text or JSON?',
      options: [
        { v: 'yes', label: 'Yes', delta: 0 },
        { v: 'some', label: 'Some images, audio or PDFs', delta: -15,
          flag: ['warn', 'Jev takes text only. Convert with OCR or transcription before the call.'] },
        { v: 'mostly', label: 'Mostly not', delta: -50,
          flag: ['bad', 'Jev takes text only today. Keep media-first work on a multimodal model.'] }
      ]
    },
    {
      id: 'fallback', q: 'Can uncertain answers go to a fallback model or a person?',
      options: [
        { v: 'yes', label: 'Yes', delta: 0 },
        { v: 'few', label: 'Only a few', delta: -10,
          flag: ['warn', 'Expect lower automation. Set thresholds from measured calibration, not defaults.'] },
        { v: 'no', label: 'No, every answer is final', delta: -20,
          flag: ['bad', 'Without a fallback path, confidence cannot protect you. Build the route before migrating.'] }
      ]
    },
    {
      id: 'adversarial', q: 'Could users write input meant to steer the answer?',
      options: [
        { v: 'no', label: 'No', delta: 0 },
        { v: 'possibly', label: 'Possibly', delta: -5,
          flag: ['warn', 'Write explicit criteria and include adversarial samples in the evaluation set.'] },
        { v: 'yes', label: 'Yes, expected', delta: -15,
          flag: ['bad', 'Jev does not treat data as hostile by default. Add a guardrail step and test it.'] }
      ]
    }
  ];

  // Example workloads. Values are illustrative starting points, not measurements.
  const EXAMPLES = [
    { id: 'support', name: 'Support ticket routing', model: 'fable-5.1', volume: 1000000, tokIn: 2500, tokOut: 300, latency: 8.6, auto: 85, ops: 1000, migration: 25000,
      fit: { answer: 'choice', math: 'no', size: 'yes', media: 'yes', fallback: 'yes', adversarial: 'possibly' } },
    { id: 'matching', name: 'Product record matching', model: 'opus-5.5', volume: 500000, tokIn: 1200, tokOut: 200, latency: 6, auto: 80, ops: 750, migration: 20000,
      fit: { answer: 'choice', math: 'some', size: 'yes', media: 'yes', fallback: 'yes', adversarial: 'no' } },
    { id: 'claims', name: 'Insurance claims triage', model: 'fable-5.1', volume: 200000, tokIn: 6000, tokOut: 400, latency: 12, auto: 75, ops: 1500, migration: 35000,
      fit: { answer: 'mix', math: 'some', size: 'usually', media: 'some', fallback: 'yes', adversarial: 'possibly' } }
  ];

  // Page state that is not held in inputs.
  const state = {
    exampleId: EXAMPLES[0].id,
    fit: { ...EXAMPLES[0].fit },
    eligibleManual: false,   // true once the visitor drags the eligible slider
    last: null,              // last good calculation, used by the brief
    email: ''                // set once the visitor asks for the brief
  };

  /* ------------------------------------------------------------------
     2. Build controls and read inputs
  ------------------------------------------------------------------ */

  function buildSelects() {
    $('example').innerHTML = EXAMPLES.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
    $('model').innerHTML = MODELS.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
  }

  // Render the six fit questions as radio pills.
  function buildFitQuestions() {
    const root = $('fit-questions');
    root.innerHTML = FIT.map(q => `
      <div class="fit-q" data-q="${q.id}">
        <span class="label" id="fq-${q.id}">${q.q}</span>
        <div class="seg" role="radiogroup" aria-labelledby="fq-${q.id}">
          ${q.options.map(o => `
            <input type="radio" name="fit-${q.id}" id="fit-${q.id}-${o.v}" value="${o.v}">
            <label for="fit-${q.id}-${o.v}">${o.label}</label>`).join('')}
        </div>
        <div class="fit-flag" hidden></div>
      </div>`).join('') + `<div class="fit-summary" id="fit-summary"></div>`;
  }

  // Score the fit check: eligible share, label, primitive and the list of flags.
  function scoreFit(answers) {
    let eligible = 0;
    let primitive = '';
    const flags = [];
    for (const q of FIT) {
      const opt = q.options.find(o => o.v === answers[q.id]) || q.options[0];
      if (q.id === 'answer') { eligible = opt.base; primitive = opt.primitive; }
      else eligible += opt.delta;
      if (opt.flag) flags.push({ q: q.q, answer: opt.label, level: opt.flag[0], text: opt.flag[1] });
    }
    // Clamp to 0..95 and round to the slider's 5-point step. Nothing is 100% eligible.
    eligible = Math.max(0, Math.min(95, Math.round(eligible / 5) * 5));
    const label = eligible >= 70 ? 'Strong fit' : eligible >= 40 ? 'Partial fit' : 'Poor fit';
    return { eligible, label, primitive, flags };
  }

  // Read every input into one object. Throws a readable message if something is off.
  function readInputs() {
    const num = (id, { min = 0, max = Infinity, allowEmpty = false } = {}) => {
      const raw = $(id).value.trim();
      if (raw === '' && allowEmpty) return null;
      const n = Number(raw);
      if (raw === '' || !Number.isFinite(n) || n < min || n > max) {
        $(id).setAttribute('aria-invalid', 'true');
        const name = $(id).closest('.field')?.querySelector('label')?.childNodes[0]?.textContent.trim() || id;
        throw new Error(`Check “${name}”. It needs a number${min > 0 ? ' of at least ' + min : ''}.`);
      }
      $(id).removeAttribute('aria-invalid');
      return n;
    };

    const model = MODELS.find(m => m.id === $('model').value);
    const isCustom = model.id === 'custom';

    return {
      modelName: isCustom ? 'Other model' : model.name,
      priceIn: isCustom ? num('price-in') : model.in,
      priceOut: isCustom ? num('price-out') : model.out,
      volume: num('volume'),
      latency: num('latency'),
      tokIn: num('tok-in', { min: 1 }),
      tokOut: num('tok-out'),
      bill: $('bill-details').open ? num('bill', { allowEmpty: true }) : null,
      eligible: Number($('eligible').value) / 100,
      auto: Number($('auto').value) / 100,
      ops: num('ops'),
      migration: num('migration'),
      jevTok: num('jev-tok', { min: 1 })
    };
  }

  /* ------------------------------------------------------------------
     3. The math. Pure function: inputs in, numbers out.
  ------------------------------------------------------------------ */
  function calculate(v) {
    // Step A: what one decision costs today.
    const tokenCostPerDecision = (v.tokIn * v.priceIn + v.tokOut * v.priceOut) / 1e6;
    const current = v.bill !== null ? v.bill : v.volume * tokenCostPerDecision;
    const perDecision = v.volume > 0 ? current / v.volume : 0;

    // Step B: split decisions into three routes.
    const jevAttempts = v.volume * v.eligible;          // every eligible decision is tried on Jev first
    const automated = jevAttempts * v.auto;              // confident answers act directly
    const fallbacks = jevAttempts - automated;           // low-confidence answers go to the current model
    const stays = v.volume - jevAttempts;                // ineligible decisions never leave the current model

    // Step C: monthly cost with Jev. Output tokens on Jev are free.
    const jevCost = jevAttempts * v.jevTok * JEV.inputPricePerMillion / 1e6;
    const fallbackCost = fallbacks * perDecision;
    const stayCost = stays * perDecision;
    const withJev = jevCost + fallbackCost + stayCost + v.ops;

    // Step D: savings and payback.
    const savings = current - withJev;
    const paybackMonths = savings > 0 ? v.migration / savings : null;

    // Step E: speed. Fallbacks pay Jev's time plus the current model's time.
    const tJev = JEV.medianSeconds;
    const eligibleAvg = v.auto * tJev + (1 - v.auto) * (tJev + v.latency);
    const speedup = v.latency > 0 ? v.latency / tJev : 0;
    const hoursSaved = jevAttempts * (v.latency - eligibleAvg) / 3600;

    // Step F: how far Jev's price could rise before savings reach zero.
    const nonJev = fallbackCost + stayCost + v.ops;
    const priceHeadroom = jevCost > 0 ? (current - nonJev) / jevCost : null;

    // Step G: capacity check against the published rate limit.
    const perMinute = v.volume / (30 * 24 * 60) * v.eligible;

    return {
      current, perDecision, withJev, jevCost, fallbackCost, stayCost, ops: v.ops,
      savings, annual: savings * 12, pct: current > 0 ? savings / current : null, paybackMonths,
      automated, fallbacks, stays, jevAttempts,
      tJev, eligibleAvg, speedup, hoursSaved, priceHeadroom, perMinute
    };
  }

  /* ------------------------------------------------------------------
     4. Render
  ------------------------------------------------------------------ */

  function formatPayback(months) {
    if (months === null) return 'None';
    if (months === 0) return 'Immediate';
    const days = months * 30.4;
    if (days < 1) return '< 1 day';
    if (days < 60) return Math.round(days) + ' days';
    return months.toFixed(1) + ' months';
  }

  function formatSeconds(s) {
    return s < 1 ? s.toFixed(2) + 's' : s.toFixed(1) + 's';
  }

  function formatSpeed(r, v) {
    if (v.latency <= r.tJev) return 'No faster';
    return Math.round(r.speedup).toLocaleString('en-US') + '× faster';
  }

  // Show the fit flags under each question and the summary line.
  function renderFit(fit) {
    for (const q of FIT) {
      const box = document.querySelector(`.fit-q[data-q="${q.id}"] .fit-flag`);
      const flag = fit.flags.find(f => f.q === q.q);
      box.hidden = !flag;
      if (flag) { box.className = 'fit-flag ' + flag.level; box.textContent = flag.text; }
    }
    const tag = fit.label === 'Strong fit' ? 'tag-good' : fit.label === 'Partial fit' ? 'tag-warn' : 'tag-bad';
    $('fit-summary').innerHTML =
      `<span class="tag ${tag}">${fit.label}</span>` +
      `<span>${fit.eligible}% of decisions eligible.</span>` +
      `<span class="muted">Question type: ${fit.primitive}</span>`;
  }

  function renderVerdict(fit, r, v) {
    let tag = 'tag-good', label = 'Strong candidate';
    let text = 'Worth a shadow evaluation. Measure accuracy and confidence on labeled examples before switching.';

    if (v.eligible === 0 || fit.label === 'Poor fit') {
      tag = 'tag-bad'; label = 'Keep it where it is';
      const blocker = fit.flags.find(f => f.level === 'bad');
      text = 'Keep this workflow on your current model.' + (blocker ? ' ' + blocker.text : '');
    } else if (r.savings <= 0) {
      tag = 'tag-warn'; label = 'No cost case';
      text = 'At this volume and price, Jev does not pay for itself. Speed alone may still justify it.';
    } else if (fit.label === 'Partial fit') {
      tag = 'tag-warn'; label = 'Partial fit';
      text = 'Split the workflow. Move the decision steps, keep the rest on your current model.';
    }

    // Capacity and size checks against published limits.
    if (r.perMinute > JEV.requestsPerMinute) {
      text += ` Average load is ${count(r.perMinute)} requests/min, above the published ${count(JEV.requestsPerMinute)}. Batch questions per request or ask TypeSafe for higher limits.`;
    }
    if (v.jevTok > JEV.maxStatePlusQuestionTokens) {
      text += ` ${count(v.jevTok)} tokens per decision exceeds the 32k state-plus-question limit.`;
    }

    $('verdict-tag').className = 'tag ' + tag;
    $('verdict-tag').textContent = label;
    $('verdict-text').textContent = text;
  }

  function render() {
    const fit = scoreFit(state.fit);
    renderFit(fit);

    // Keep the eligible slider in step with the fit check unless the visitor overrode it.
    if (!state.eligibleManual) $('eligible').value = fit.eligible;
    $('eligible-out').textContent = $('eligible').value + '%';
    $('auto-out').textContent = $('auto').value + '%';
    $('eligible-hint').innerHTML = state.eligibleManual
      ? `Set manually. <button type="button" class="link-btn" id="use-fit">Use fit check: ${fit.eligible}%</button>`
      : 'Set by the fit check. Drag to override.';

    // Show the selected model's prices.
    const model = MODELS.find(m => m.id === $('model').value);
    $('custom-price').hidden = model.id !== 'custom';
    $('model-price').textContent = model.id === 'custom'
      ? 'Enter your list or contracted price.'
      : `$${model.in} input / $${model.out} output per million tokens. List price.`;

    let v, r;
    try {
      v = readInputs();
      r = calculate(v);
      $('calc-error').textContent = '';
    } catch (err) {
      state.last = null;
      $('calc-error').textContent = err.message;
      ['r-savings', 'r-annual', 'r-payback', 'r-speed', 'r-hours', 'r-now', 'r-new', 's-savings', 's-speed'].forEach(id => { $(id).textContent = '—'; });
      $('r-savings-sub').textContent = '';
      return;
    }
    state.last = { v, r, fit, example: EXAMPLES.find(e => e.id === state.exampleId) };

    // Headline numbers.
    const savingsEl = $('r-savings');
    savingsEl.textContent = money(r.savings);
    savingsEl.classList.toggle('neg', r.savings < 0);
    $('r-savings-sub').textContent = r.pct === null ? 'No current cost to compare.'
      : `${Math.abs(r.pct * 100).toFixed(0)}% ${r.savings >= 0 ? 'lower' : 'higher'} than ${money(r.current)} today`;
    $('r-annual').textContent = money(r.annual);
    $('r-payback').textContent = formatPayback(r.paybackMonths);
    $('r-speed').textContent = formatSpeed(r, v);
    $('r-speed').title = `${formatSeconds(r.tJev)} vs ${formatSeconds(v.latency)} median`;
    $('r-hours').textContent = r.hoursSaved > 0 ? count(r.hoursSaved) + ' h/mo' : '0 h/mo';

    // Cost bars.
    const max = Math.max(r.current, r.withJev, 1);
    $('bar-now').style.width = (r.current / max * 100) + '%';
    $('bar-new').style.width = (Math.max(r.withJev, 0) / max * 100) + '%';
    $('r-now').textContent = money(r.current);
    $('r-new').textContent = money(r.withJev);
    $('r-cost-parts').textContent =
      `Jev ${money(r.jevCost)} · fallback ${money(r.fallbackCost)} · unchanged ${money(r.stayCost)} · ops ${money(r.ops)}`;

    // Routing stack.
    const total = Math.max(v.volume, 1);
    const pct = n => (n / total * 100);
    $('seg-jev').style.width = pct(r.automated) + '%';
    $('seg-fb').style.width = pct(r.fallbacks) + '%';
    $('seg-stay').style.width = pct(r.stays) + '%';
    $('l-jev').textContent = pct(r.automated).toFixed(0) + '%';
    $('l-fb').textContent = pct(r.fallbacks).toFixed(0) + '%';
    $('l-stay').textContent = pct(r.stays).toFixed(0) + '%';

    // Mobile sticky bar.
    $('s-savings').textContent = money(r.savings);
    $('s-speed').textContent = formatSpeed(r, v);

    renderVerdict(fit, r, v);

    // Hand the estimate to the partner page so the intake form can attach it.
    store.set('dl-estimate', summaryForLead());
  }

  // Compact summary sent with every lead. Numbers only, no free text.
  function summaryForLead() {
    if (!state.last) return null;
    const { v, r, fit, example } = state.last;
    return {
      workflow: example ? example.name : 'Custom',
      model: v.modelName,
      decisions_per_month: v.volume,
      current_monthly_usd: Math.round(r.current),
      with_jev_monthly_usd: Math.round(r.withJev),
      monthly_savings_usd: Math.round(r.savings),
      eligible_pct: Math.round(v.eligible * 100),
      automated_pct: Math.round(v.auto * 100),
      fit: fit.label,
      fit_flags: fit.flags.map(f => f.text),
      question_type: fit.primitive
    };
  }

  /* ------------------------------------------------------------------
     5. The brief
  ------------------------------------------------------------------ */

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function buildBrief() {
    const { v, r, fit, example } = state.last;
    const today = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    const pct = n => (n / Math.max(v.volume, 1) * 100).toFixed(0) + '%';
    const answers = FIT.map(q => {
      const opt = q.options.find(o => o.v === state.fit[q.id]);
      const flag = fit.flags.find(f => f.q === q.q);
      return `<tr><td>${esc(q.q)}</td><td>${esc(opt.label)}</td><td>${flag ? esc(flag.text) : 'No issue.'}</td></tr>`;
    }).join('');
    const headroom = r.priceHeadroom !== null && r.priceHeadroom > 1
      ? `Savings hold until Jev’s input price rises ${count(r.priceHeadroom, 0)}×.`
      : 'Savings are sensitive to Jev’s price at these inputs.';
    const partner = window.SITE_CONFIG.partner || {};

    return `
      <h1 id="brief-heading">Jev migration brief: ${esc(example ? example.name : 'Custom workflow')}</h1>
      <p class="brief-meta">Prepared ${today} with Decision Lab. An estimate from your inputs, not a measurement.</p>

      <div class="brief-kpis num">
        <div><span class="kpi-label">Monthly savings</span><strong>${money(r.savings)}</strong></div>
        <div><span class="kpi-label">Annual run-rate</span><strong>${money(r.annual)}</strong></div>
        <div><span class="kpi-label">Payback</span><strong>${formatPayback(r.paybackMonths)}</strong></div>
        <div><span class="kpi-label">Automated path</span><strong>${formatSpeed(r, v)}</strong></div>
      </div>

      <h2>Recommendation</h2>
      <p>${esc($('verdict-text').textContent)}</p>

      <h2>Workload</h2>
      <table class="num">
        <tr><th>Current model</th><td>${esc(v.modelName)}: $${v.priceIn} in / $${v.priceOut} out per M tokens</td></tr>
        <tr><th>Decisions per month</th><td>${count(v.volume)}</td></tr>
        <tr><th>Tokens per decision</th><td>${count(v.tokIn)} in, ${count(v.tokOut)} out today; ${count(v.jevTok)} in on Jev</td></tr>
        <tr><th>Median response</th><td>${formatSeconds(v.latency)} today; ${formatSeconds(r.tJev)} on Jev (TypeSafe workflow evals)</td></tr>
        <tr><th>Monthly cost today</th><td>${money(r.current)}${v.bill !== null ? ' (from your bill)' : ''}</td></tr>
        <tr><th>Monthly cost with Jev</th><td>${money(r.withJev)}: Jev ${money(r.jevCost)}, fallback ${money(r.fallbackCost)}, unchanged ${money(r.stayCost)}, operations ${money(r.ops)}</td></tr>
        <tr><th>One-time migration</th><td>${money(v.migration)}</td></tr>
      </table>

      <h2>Routing</h2>
      <ul class="num">
        <li>${pct(r.automated)} act on Jev’s answer automatically (${count(r.automated)} per month).</li>
        <li>${pct(r.fallbacks)} fall below the confidence threshold and go to ${esc(v.modelName)}.</li>
        <li>${pct(r.stays)} stay on ${esc(v.modelName)}.</li>
        <li>Model wait removed: ${count(Math.max(r.hoursSaved, 0))} hours per month.</li>
      </ul>

      <h2>Fit check: ${esc(fit.label)}</h2>
      <table><tr><th>Question</th><th>Answer</th><th>Note</th></tr>${answers}</table>
      <p style="margin-top:10px">Recommended question type: <b>${esc(fit.primitive)}</b>.</p>

      <h2>Starting confidence thresholds</h2>
      <ul>
        <li>Above 0.9: act automatically.</li>
        <li>0.5 to 0.9: ask for confirmation or queue for review.</li>
        <li>Below 0.5: do not act. Route to your current model or a person.</li>
      </ul>
      <p style="margin-top:8px" class="muted">From TypeSafe’s confidence guidance. Raise thresholds for high-stakes actions. Set final values from calibration measured on your data.</p>

      <h2>Migration plan</h2>
      <ol>
        <li><b>Fit review.</b> Confirm scope and question type. Collect labeled examples; TypeSafe suggests 20+ to start, a decision-grade evaluation uses a few hundred.</li>
        <li><b>Shadow evaluation, two weeks.</b> Jev runs beside ${esc(v.modelName)} on live traffic. Log both. Measure accuracy by confidence band, latency and cost.</li>
        <li><b>Threshold tuning.</b> Set a threshold per action from the calibration curve.</li>
        <li><b>Staged rollout.</b> Automate low-risk paths first. Keep ${esc(v.modelName)} as fallback behind a flag. Pin the model version and re-run the evaluation set on every new version.</li>
      </ol>

      <h2>Risk register</h2>
      <table>
        <tr><th>Risk</th><th>Mitigation</th></tr>
        <tr><td>Jev is in early access. No published SLA or plan tiers.</td><td>Keep the current model hot as fallback. One flag routes 100% back.</td></tr>
        <tr><td>Pricing may change.</td><td>${esc(headroom)}</td></tr>
        <tr><td>Model versions change behavior.</td><td>Pin the version from the response, log it, re-run the labeled set before upgrading.</td></tr>
        <tr><td>Adversarial or misleading input.</td><td>Explicit criteria, adversarial samples in the evaluation set, a guardrail step where exposed.</td></tr>
        <tr><td>Rate limits: ${count(JEV.requestsPerMinute)} requests per minute.</td><td>Ask several questions per request (fan-out). Current average load: ${count(r.perMinute)} per minute.</td></tr>
      </table>

      <h2>Sources</h2>
      <ul class="small">
        <li>Pricing, limits: docs.typesafe.ai/models (verified ${esc(JEV.verifiedOn)})</li>
        <li>Latency: typesafe.ai, workflow evals, 0.114s vs 8.566s median</li>
        <li>Limitations: docs.typesafe.ai/model-jaggedness/jev-1.13</li>
        <li>Thresholds: docs.typesafe.ai/confidence</li>
        <li>Current-model list prices: provider pricing pages, verified ${esc(JEV.verifiedOn)}</li>
      </ul>

      <p class="brief-foot">Decision Lab is independent and not affiliated with TypeSafe AI. Accuracy is not assumed here; a shadow evaluation measures it.
      ${partner.name ? 'Questions: ' + esc(partner.name) + (window.SITE_CONFIG.contactEmail ? ', ' + esc(window.SITE_CONFIG.contactEmail) : '') + '.' : ''}</p>`;
  }

  function openBrief() {
    if (!state.last) return;
    $('brief-body').innerHTML = buildBrief();
    const dlg = $('brief-dialog');
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  }

  // Step 1 of lead capture: one field, then the brief opens.
  async function onBriefSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const email = form.email.value.trim();
    const status = $('brief-status');
    if (!window.Site.isWorkEmail(email)) {
      form.email.setAttribute('aria-invalid', 'true');
      status.className = 'status err';
      status.textContent = 'Enter a valid work email.';
      return;
    }
    if (!state.last) { status.className = 'status err'; status.textContent = 'Fix the highlighted input first.'; return; }
    form.email.removeAttribute('aria-invalid');
    form.querySelector('button').disabled = true;

    const res = await window.Site.submitLead({ type: 'brief', email, website: form.website.value, estimate: summaryForLead() });
    form.querySelector('button').disabled = false;
    if (!res.ok) { status.className = 'status err'; status.textContent = res.message; return; }

    state.email = email;
    store.set('dl-email', email);
    openBrief();
    form.hidden = true;
    $('followup-form').hidden = false;
    $('reopen-brief').hidden = false;
  }

  // Step 2 of lead capture: optional context, saved against the same email.
  async function onFollowupSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const role = form.querySelector('input[name=role]:checked');
    const res = await window.Site.submitLead({ type: 'brief-details', email: state.email, company: form.company.value.trim(), role: role ? role.value : '' });
    const status = $('followup-status');
    status.className = 'status ' + (res.ok ? 'ok' : 'err');
    status.textContent = res.ok ? 'Context saved with your evaluation.' : res.message;
    if (res.ok) store.set('dl-company', form.company.value.trim());
  }

  /* ------------------------------------------------------------------
     6. Events and first load
  ------------------------------------------------------------------ */

  function loadExample(id) {
    const ex = EXAMPLES.find(e => e.id === id) || EXAMPLES[0];
    state.exampleId = ex.id;
    state.fit = { ...ex.fit };
    state.eligibleManual = false;
    $('example').value = ex.id;
    $('model').value = ex.model;
    $('volume').value = ex.volume;
    $('latency').value = ex.latency;
    $('tok-in').value = ex.tokIn;
    $('tok-out').value = ex.tokOut;
    $('jev-tok').value = ex.tokIn;
    $('auto').value = ex.auto;
    $('ops').value = ex.ops;
    $('migration').value = ex.migration;
    $('bill').value = '';
    // Check the matching fit answers.
    for (const q of FIT) {
      const input = document.getElementById(`fit-${q.id}-${ex.fit[q.id]}`);
      if (input) input.checked = true;
    }
    render();
  }

  function wire() {
    $('example').addEventListener('change', e => loadExample(e.target.value));

    // Any numeric or select change re-renders.
    ['model', 'price-in', 'price-out', 'volume', 'latency', 'tok-in', 'tok-out', 'bill', 'auto', 'ops', 'migration', 'jev-tok']
      .forEach(id => $(id).addEventListener('input', render));
    $('bill-details').addEventListener('toggle', render);

    // Keep Jev tokens in step with today's input tokens until edited separately.
    let jevTokTouched = false;
    $('jev-tok').addEventListener('input', () => { jevTokTouched = true; });
    $('tok-in').addEventListener('input', () => { if (!jevTokTouched) { $('jev-tok').value = $('tok-in').value; render(); } });
    $('example').addEventListener('change', () => { jevTokTouched = false; });

    // Dragging the eligible slider overrides the fit check.
    $('eligible').addEventListener('input', () => { state.eligibleManual = true; render(); });
    $('eligible-hint').addEventListener('click', e => {
      if (e.target.id === 'use-fit') { state.eligibleManual = false; render(); }
    });

    // Fit answers.
    $('fit-questions').addEventListener('change', e => {
      if (!e.target.name || !e.target.name.startsWith('fit-')) return;
      state.fit[e.target.name.slice(4)] = e.target.value;
      state.eligibleManual = false;
      render();
    });

    // Brief and follow-up.
    $('brief-form').addEventListener('submit', onBriefSubmit);
    $('followup-form').addEventListener('submit', onFollowupSubmit);
    $('reopen-brief').addEventListener('click', openBrief);
    $('close-brief').addEventListener('click', () => $('brief-dialog').close());
    $('print-brief').addEventListener('click', () => {
      document.body.classList.add('printing');
      window.print();
    });
    window.addEventListener('afterprint', () => document.body.classList.remove('printing'));

    // Mobile sticky bar: show while the full result is off screen.
    const sticky = $('sticky-result');
    if ('IntersectionObserver' in window) {
      const assess = document.getElementById('assess');
      const result = $('result');
      let assessVisible = false, resultVisible = false;
      const update = () => { sticky.hidden = !(assessVisible && !resultVisible); };
      new IntersectionObserver(([e]) => { assessVisible = e.isIntersecting; update(); }).observe(assess);
      new IntersectionObserver(([e]) => { resultVisible = e.isIntersecting; update(); }, { threshold: 0.15 }).observe(result);
    }

    // Returning visitor who already gave an email this session: skip step 1.
    const knownEmail = store.get('dl-email');
    if (knownEmail) {
      state.email = knownEmail;
      $('brief-form').hidden = true;
      $('followup-form').hidden = false;
      $('reopen-brief').hidden = false;
    }
  }

  // Optional: expose the estimate to browser agents that support WebMCP.
  function registerAgentTools() {
    if (!document.modelContext || !document.modelContext.registerTool) return;
    try {
      document.modelContext.registerTool({
        name: 'read_jev_estimate',
        description: 'Read the visible Jev migration estimate, routing split and fit check.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true },
        execute: () => summaryForLead()
      });
    } catch { /* not supported */ }
  }

  buildSelects();
  buildFitQuestions();
  wire();
  loadExample(EXAMPLES[0].id);
  registerAgentTools();

  // Exposed for tests.
  window.DecisionLab = { calculate, scoreFit, EXAMPLES, MODELS };
})();
