import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

/**
 * Safety tests for the apply agent's URL guard and field classifier.
 *
 * Both live under src/agents/, which the coverage config excludes — they are
 * Node-side Playwright code, not app code. They are still the two places where
 * a value the app does not control decides what the agent does next, so they
 * get tested here rather than not at all.
 */

const require = createRequire(import.meta.url);
const { isSafeUrl } = require('../agents/apply-agent/apply-agent.cjs');
const { matchField } = require('../agents/apply-agent/form-filler.js');

describe('apply agent URL guard', () => {
  const allowed = [
    ['a normal Greenhouse posting', 'https://boards.greenhouse.io/acme/jobs/4123'],
    ['a normal Lever posting', 'https://jobs.lever.co/acme/9f3c1a'],
    ['a Workday posting', 'https://acme.wd3.myworkdayjobs.com/en-US/apply/1234'],
    ['a company careers page', 'https://careers.example.com/openings/qa-lead'],
    ['an employer ATS on a subdomain of a blocked name', 'https://paypal.com.evil.example/apply'],
    ['a host that merely contains a blocked word', 'https://mybank-resume.example/apply'],
    ['a host that merely contains a blocked word', 'https://notpaypal.com/apply'],
  ];

  const refused = [
    ['a non-http scheme', 'file:///etc/passwd'],
    ['a data URL', 'data:text/html,<script>alert(1)</script>'],
    ['a blob URL', 'blob:https://example.com/abc'],
    ['a javascript URL', 'javascript:alert(1)'],
    ['credentials hiding the real host', 'https://accounts.google.com@evil.example/'],
    ['credentials on a blocked host', 'https://user:pw@paypal.com/'],
    ['loopback', 'http://127.0.0.1:3457/api/apply'],
    ['loopback by name', 'http://localhost:3457/'],
    ['the cloud metadata address', 'http://169.254.169.254/latest/meta-data/'],
    ['an RFC1918 address', 'http://192.168.1.1/'],
    ['an RFC1918 address', 'http://10.0.0.5/'],
    ['an RFC1918 address', 'http://172.20.3.4/'],
    ['the CGNAT range', 'http://100.64.0.1/'],
    ['IPv6 loopback', 'http://[::1]:8080/'],
    ['an IPv4-mapped loopback', 'http://[::ffff:127.0.0.1]/'],
    ['an mDNS name', 'http://printer.local/'],
    ['an internal name', 'http://wiki.internal/'],
    ['a blocked host exactly', 'https://accounts.google.com/o/oauth'],
    ['a blocked host on a subdomain', 'https://www.paypal.com/checkout'],
    ['a blocked host on a subdomain', 'https://pay.stripe.com/pay'],
    ['a string that is not a URL at all', 'not a url'],
    ['an empty string', ''],
  ];

  for (const [label, url] of allowed) {
    it(`allows ${label}`, () => {
      expect(isSafeUrl(url), url).toBe(true);
    });
  }

  for (const [label, url] of refused) {
    it(`refuses ${label}`, () => {
      expect(isSafeUrl(url), url).toBe(false);
    });
  }

  it('is exported so the redirect path can reuse it', () => {
    // The offsite-apply link used to be followed on a bare `^https?://` test,
    // which meant the only URL ever validated was the one we started from.
    expect(typeof isSafeUrl).toBe('function');
  });
});

describe('apply agent field classifier', () => {
  /**
   * The classifier used to match aliases with `haystack.includes(alias)`, so
   * every short alias fired on unrelated fields: `pin` inside "Pipeline stage"
   * and "Pinterest profile", `state` inside "Statement of purpose" and "Real
   * estate", `city` inside "Capacity planning" and "Velocity". The agent then
   * typed a postcode into a pipeline selector and reported it as filled.
   */
  const mustNotMatch = [
    ['Pipeline stage', 'zip'],
    ['Shipping address line 1', 'zip'],
    ['Pinterest profile URL', 'zip'],
    ['Statement of purpose', 'state'],
    ['Real estate experience', 'state'],
    ['Capacity planning notes', 'city'],
    ['Deployment velocity', 'city'],
    ['Eligibility to work in the EU', 'zip'],
  ];

  for (const [hint, wrongKey] of mustNotMatch) {
    it(`does not read "${hint}" as ${wrongKey}`, () => {
      expect(matchField(hint), hint).not.toBe(wrongKey);
    });
  }

  const mustMatch = [
    ['First name', 'firstname'],
    ['Given name', 'firstname'],
    ['Last name', 'lastname'],
    ['Surname', 'lastname'],
    ['Email address', 'email'],
    ['Phone number', 'phone'],
    ['Mobile number', 'phone'],
    ['Current job title', 'currenttitle'],
    ['Current company', 'currentcompany'],
    ['City', 'city'],
    ['State / Province', 'state'],
    ['Postal code', 'zip'],
    ['Work permit / visa status', 'visa'],
    ['Notice period', 'notice'],
    ['Expected salary', 'salary'],
    ['LinkedIn profile URL', 'linkedin'],
    ['GitHub URL', 'github'],
    ['Cover letter', 'coverletter'],
  ];

  for (const [hint, key] of mustMatch) {
    it(`reads "${hint}" as ${key}`, () => {
      expect(matchField(hint), hint).toBe(key);
    });
  }

  const neverAnswered = [
    'Gender',
    'Race / ethnicity',
    'Veteran status',
    'Do you have a disability',
    'Religion',
    'Sexual orientation',
    'How did you hear about us',
    'Pronouns',
    'Referral source',
  ];

  for (const hint of neverAnswered) {
    it(`still refuses to answer "${hint}"`, () => {
      expect(matchField(hint), hint).toBeNull();
    });
  }
});
