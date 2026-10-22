/**
 * Generic Application Form Filler
 *
 * Works across the common ATS platforms (Greenhouse, Lever, Workday,
 * Ashby, SmartRecruiters, Taleo, SuccessFactors) plus generic HTML forms.
 *
 * Strategy:
 *  1. Classify the page by URL + DOM markers.
 *  2. Find every visible input/textarea/select.
 *  3. Match each field to a candidate answer by label / name / id / placeholder.
 *  4. Upload the resume to any file input.
 *  5. Report what was filled, what was skipped, and what needs a human.
 *
 * The agent never submits a form it is not confident about - `submit` is a
 * separate, explicit step.
 */

const FIELD_ALIASES = {
  firstname: ['firstname', 'first_name', 'first name', 'givenname', 'given name', 'fname'],
  lastname: ['lastname', 'last_name', 'last name', 'surname', 'familyname', 'family name', 'lname'],
  fullname: ['fullname', 'full_name', 'full name', 'yourname', 'your name', 'candidatename', 'legal name'],
  email: ['email', 'emailaddress', 'email_address', 'email address', 'workemail', 'e-mail'],
  phone: ['phone', 'phonenumber', 'phone_number', 'phone number', 'mobile', 'mobilenumber', 'mobile number', 'contactnumber', 'contact number', 'telephone'],
  location: ['candidate-location', 'current location', 'city and state', 'citystate', 'currentlocation', 'where are you located', 'address', 'full address'],
  city: ['city', 'town', 'cityname'],
  country: ['country', 'countryname', 'country of residence', 'nation'],
  state: ['state', 'province', 'region', 'stateprovince'],
  zip: ['zip', 'zipcode', 'zip code', 'postalcode', 'postal code', 'pincode', 'pin'],
  linkedin: ['linkedin url', 'linkedin profile', 'linkedinprofile', 'linkedinurl', 'linkedin'],
  github: ['github url', 'github profile', 'githubprofile', 'githuburl', 'github'],
  website: ['website url', 'personal website', 'personalwebsite', 'portfolio url', 'website', 'web site', 'other url'],
  currenttitle: ['current job title', 'current title', 'present title', 'currentjobtitle', 'currenttitle', 'job title', 'jobtitle'],
  currentcompany: ['current company', 'present company', 'currentcompany', 'employer', 'organisation', 'organization'],
  resume: ['resume', 'cv', 'upload cv', 'uploadcv', 'upload resume', 'uploadresume', 'upload file', 'uploadfile', 'attachment', 'attach resume', 'attachresume', 'r\u00e9sum\u00e9', 'curriculum vitae', 'curriculumvitae'],
  coverletter: ['cover letter', 'coverletter', 'why do you want to work', 'tell us about yourself', 'additional information', 'motivation letter', 'motivation'],
  experience: ['years of experience', 'yearsexperience', 'total experience', 'work experience', 'how many years'],
  salary: ['salary expectation', 'salaryexpectation', 'expected salary', 'expectedsalary', 'desired salary', 'desiredsalary', 'current salary'],
  notice: ['notice period', 'noticeperiod', 'available to join', 'when can you start', 'joining date', 'start date'],
  visa: ['work permit', 'workpermit', 'legally authorized', 'legally authorised', 'require sponsorship', 'requires sponsorship', 'visa status'],
};

/**
 * Fields that must NEVER be auto-filled, however their label reads.
 * These ask about protected characteristics or demographics, and answering
 * them on the candidate's behalf would be wrong.
 */
const NEVER_FILL = [
  'gender',
  'hispanic',
  'ethnicity',
  'race',
  'veteran',
  'disability',
  'religion',
  'sexual orientation',
  'photo',
  'recruit',
  'referral',
  'sponsor',
  'how did you hear',
  'demographic',
  'pronoun',
];

const CAPTCHA_HINTS = /captcha|recaptcha|hcaptcha|honeypot|are you a robot/i;

const SELECT_HINTS = {
  yearsexperience: ['0-1', '1-2', '2-3', '3-5', '5-7', '7-10', '10+', 'less than', 'more than'],
  notice: ['immediately', '2 weeks', '1 month', '2 weeks', '30 days', '3 months'],
  visa: ['yes', 'no', 'require', 'sponsorship', 'authorized', 'authorised', 'citizen', 'eligible'],
  country: [],
};

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Find which answer key (if any) a field corresponds to. */
function matchField(hint) {
  const h = normalize(hint);
  if (!h) return null;

  // Protected-characteristic and demographic questions are never answered
  // on the candidate's behalf.
  if (NEVER_FILL.some((blocked) => h.includes(normalize(blocked)))) return null;

  // Longest alias first so "current job title" beats "job title".
  let best = null;
  let bestLen = 0;
  for (const [key, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) {
      const a = normalize(alias);
      if (!a) continue;
      if (h === a || h.includes(a)) {
        if (a.length > bestLen) {
          best = key;
          bestLen = a.length;
        }
      }
    }
  }
  return best;
}

/** Detect the ATS platform so we can apply platform-specific tweaks. */
export function detectAts(url, html = '') {
  const u = String(url || '').toLowerCase();
  const h = String(html || '').toLowerCase();

  const rules = [
    ['greenhouse', 'greenhouse.io'],
    ['lever', 'lever.co'],
    ['workday', 'myworkdayjobs.com'],
    ['workday-portal', 'wd3.myworkdayjobs.com'],
    ['ashby', 'ashbyhq.com'],
    ['smartrecruiters', 'smartrecruiters.com'],
    ['taleo', 'taleo.net'],
    ['icims', 'icims.com'],
    ['successfactors', 'successfactors'],
    ['bamboohr', 'bamboohr.com'],
    ['jazzhr', 'apply.jazzhr.com'],
    ['personio', 'personio.de'],
    ['linkedin', 'linkedin.com'],
    ['indeed', 'indeed.com'],
    ['naukri', 'naukri.com'],
  ];

  for (const [name, needle] of rules) {
    if (u.includes(needle) || h.includes(needle)) return name;
  }
  return 'generic';
}

/**
 * Walk the DOM and return a fill plan.
 * Executed in the page context.
 */
function collectFields() {
  const visible = (el) => {
    if (!el || el.disabled || el.readOnly) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (el.type === 'hidden') return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0 && el.type !== 'file') return false;
    return true;
  };

  const hintFor = (el) => {
    const parts = [];
    if (el.name) parts.push(el.name);
    if (el.id) parts.push(el.id);
    if (el.placeholder) parts.push(el.placeholder);
    if (el.getAttribute('aria-label')) parts.push(el.getAttribute('aria-label'));
    if (el.getAttribute('name')) parts.push(el.getAttribute('name'));
    // Nearby label text
    if (el.id) {
      const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lab) parts.push(lab.innerText);
    }
    const wrapper = el.closest('label');
    if (wrapper) parts.push(wrapper.innerText);
    const parent = el.parentElement;
    if (parent) {
      const pLab = parent.querySelector('label');
      if (pLab) parts.push(pLab.innerText);
    }
    return parts.filter(Boolean).join(' ');
  };

  const out = [];
  document.querySelectorAll('input, textarea, select').forEach((el, idx) => {
    const type = (el.type || '').toLowerCase();
    // A stable handle so the Node side can target this exact element later,
    // even when it has no name or id.
    try {
      el.setAttribute('data-field-idx', String(idx));
    } catch (e) {
      /* read-only attribute - harmless */
    }
    out.push({
      idx,
      tag: el.tagName.toLowerCase(),
      type,
      name: el.name || '',
      id: el.id || '',
      placeholder: el.placeholder || '',
      required: el.required || el.getAttribute('aria-required') === 'true',
      visible: visible(el),
      accept: el.accept || '',
      hint: hintFor(el).slice(0, 400),
      options:
        el.tagName === 'SELECT'
          ? Array.from(el.options).map((o) => ({ value: o.value, label: o.textContent.trim() }))
          : null,
    });
  });
  return out;
}

/**
 * Fill a form with the candidate profile.
 * Returns a report: { ats, filled: [], skipped: [], fileInputs: [], needsHuman: [] }
 */
export async function fillForm(page, profile, options = {}) {
  const { resumePath = '', dryRun = true } = options;
  const answers = options.answers || {};

  const ats = detectAts(page.url(), await page.content());

  const fields = await page.evaluate(collectFields);

  const report = { ats, url: page.url(), filled: [], skipped: [], fileInputs: [], needsHuman: [] };

  for (const field of fields) {
    if (!field.visible) continue;
    if (field.type === 'submit' || field.type === 'button' || field.type === 'reset') continue;

    // --- file input ---
    if (field.type === 'file') {
      const key = matchField(field.hint);
      const looksLikeResume = key === 'resume' || /resume|\.docx|\.pdf/i.test(field.hint + field.accept);
      if (looksLikeResume && resumePath) {
        report.fileInputs.push({ idx: field.idx, name: field.name, resumePath });
      } else {
        report.skipped.push({ field: field.name || field.id, reason: 'file input (no resume path or not a resume field)' });
      }
      continue;
    }

    // --- select ---
    if (field.tag === 'select') {
      const key = matchField(field.hint);
      const wanted = answers[key];
      if (!wanted || !field.options?.length) {
        report.skipped.push({ field: field.name || field.id, reason: 'select - no matching answer' });
        continue;
      }
      const hintList = SELECT_HINTS[key] || [];
      const opt = field.options.find((o) => {
        const label = normalize(o.label);
        const value = normalize(o.value);
        if (label === normalize(wanted) || value === normalize(wanted)) return true;
        return hintList.some((h) => label.includes(normalize(h)) && normalize(wanted).includes(normalize(h)));
      });
      if (!opt) {
        report.skipped.push({ field: field.name || field.id, reason: `select - no option matches "${wanted}"` });
        continue;
      }
      if (!dryRun) {
        const selector = field.name ? `select[name="${field.name}"]` : `#${field.id}`;
        const ok = await page.selectOption(selector, { value: opt.value }).then(
          () => true,
          async () => {
            if (field.id) {
              return page.selectOption(`#${field.id}`, { value: opt.value }).then(() => true, () => false);
            }
            return false;
          }
        );
        if (ok) {
          report.filled.push({ field: field.name || field.id, type: 'select', value: opt.label });
        } else {
          report.skipped.push({ field: field.name || field.id, reason: 'select could not be set' });
        }
        continue;
      }
      report.filled.push({ field: field.name || field.id, type: 'select', value: opt.label });
      continue;
    }

    // --- text / textarea / email / tel / number ---
    const key = matchField(field.hint);
    if (!key) {
      report.skipped.push({ field: field.name || field.id, reason: 'no matching answer key' });
      continue;
    }
    const value = answers[key];
    if (!value) {
      report.skipped.push({ field: field.name || field.id, reason: `no value for "${key}"` });
      continue;
    }

    // Never type into something that is clearly a CAPTCHA or hidden honeypot.
    if (CAPTCHA_HINTS.test(field.hint + ' ' + field.name)) {
      report.needsHuman.push({ field: field.name || field.id, reason: 'CAPTCHA / anti-bot field' });
      continue;
    }

    if (!dryRun) {
      const primary = field.name
        ? `input[name="${field.name}"], textarea[name="${field.name}"]`
        : `#${field.id}`;
      const ok = await page.fill(primary, String(value)).then(
        () => true,
        async () => {
          if (field.id) {
            return page.fill(`#${field.id}`, String(value)).then(() => true, () => false);
          }
          return false;
        }
      );
      if (ok) {
        report.filled.push({
          field: field.name || field.id,
          type: field.type,
          key,
          value: String(value).slice(0, 80),
        });
      } else {
        report.skipped.push({ field: field.name || field.id, reason: 'could not be written' });
      }
      continue;
    }

    report.filled.push({
      field: field.name || field.id,
      type: field.type,
      key,
      value: String(value).slice(0, 80),
    });
  }

  // Anything explicitly required that we did not fill is a human task.
  for (const field of fields) {
    if (!field.visible || !field.required) continue;
    if (field.type === 'file') continue;
    const wasFilled = report.filled.some((f) => f.field === (field.name || field.id));
    if (!wasFilled) {
      report.needsHuman.push({
        field: field.name || field.id,
        label: field.placeholder || field.name || field.id,
        reason: 'required field not auto-fillable',
      });
    }
  }

  return report;
}

/** Upload the resume to every detected file input. */
export async function attachResume(page, fileInputs) {
  const results = [];
  const list = Array.isArray(fileInputs) ? fileInputs : [];
  for (const input of list) {
    const label = input.name || input.id || String(input.idx);
    try {
      // Prefer the most specific selector available so we never land on the
      // wrong one of several file inputs on the page.
      const selectors = [];
      if (input.name) selectors.push(`input[type="file"][name="${input.name}"]`);
      if (input.id) selectors.push(`input[type="file"]#${input.id}`);
      if (input.idx !== undefined) selectors.push(`input[type="file"][data-field-idx="${input.idx}"]`);

      let done = false;
      let lastError = null;
      for (const selector of selectors) {
        try {
          await page.setInputFiles(selector, input.resumePath);
          done = true;
          break;
        } catch (err) {
          lastError = err;
        }
      }
      if (!done) throw lastError || new Error('no file input matched');
      results.push({ field: label, ok: true });
    } catch (err) {
      results.push({ field: label, ok: false, error: err.message });
    }
  }
  return results;
}

export { matchField, collectFields };
