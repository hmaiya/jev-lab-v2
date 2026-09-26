# Decision Lab v2

Three pages. Static files. No build step, no framework, no tracking.

| Page | Job | Ask |
|---|---|---|
| `index.html` Evaluate | Operating baseline, workflow requirements and estimated economics. Three illustrative examples. | Work email for the evaluation brief, then optional company and role. |
| `guide.html` Field guide | What Jev is, where it breaks, limits, pricing, integration, vendor risk, calculator method. Sourced. | None. Builds trust. |
| `partner.html` Deploy | Workflow review, shadow evaluation and production migration. Team backgrounds and partners. | Optional workflow enquiry: 3 fields, then context. Estimate attached automatically. |

## Lead flow

1. Visitor runs the assessment. Every number is visible without a form.
2. "Keep the evaluation brief" asks for a work email only. The brief opens and saves as PDF.
3. Two optional details follow (company, role) with a link to the implementation approach.
4. The partner page prefills the email and company, and attaches the estimate.
5. Every submission arrives as JSON with `type`: `brief`, `brief-details`, `fit-review`, `fit-review-details`.

No phone, budget or timeline fields. Each extra field costs conversion.

## Before you host: edit `config.js`

1. `formEndpoint`: create a form at formspree.io, paste `https://formspree.io/f/<id>`. Web3Forms also works: set the endpoint and `formExtraFields.access_key`.
2. `bookingUrl`: your Cal.com or Calendly link for a 30-minute call.
3. `contactEmail`: the address shown in the footer and privacy section.
4. Team background and partner relationships were confirmed by the site owner on 26 Sep 2026. Logos are local assets in `assets/logos/`. Six were sourced from the referenced Distyl About page; the Salesforce logo is from Wikimedia Commons. These are third-party trademarks.

## Editorial direction

Navigation: Evaluate, Field guide, Deploy. Field guide retains its resource name; the other labels describe actions. The homepage leads with workflow economics and requirements. No booking CTA appears in the header or homepage. The next steps are the evaluation brief and deployment approach.

The hero distinguishes published vendor pricing, a vendor workflow timing comparison and confidence routing. The comparison is not presented as a measured result for the visitor's workload. Examples remain illustrative. The calculator logic and existing model price assumptions were not changed by the editorial revision.

The yellow preview banner disappears once `formEndpoint` is set.

## Host

Any static host works. Fastest: drag the `v2` folder onto app.netlify.com/drop, or push it to GitHub Pages, Vercel or Cloudflare Pages. Point your domain at it.

## Keep it accurate

- Re-check Jev pricing and limits in `config.js` (`jev` block) and current-model prices in `assets/assess.js` (`MODELS`) before each release. Update `verifiedOn`.
- The privacy and FAQ answers are commitments. Edit them to match how you actually handle data.
- Confirm with TypeSafe how you may reference Jev. The site states it is independent.

## Files

```
config.js          all settings
index.html         assess
guide.html         field guide
partner.html       partner + intake + privacy
assets/site.css    shared styles and tokens
assets/site.js     config, preview mode, form submit
assets/assess.*    calculator, fit check, brief
assets/partner.*   intake flow
assets/guide.*     field guide
```
