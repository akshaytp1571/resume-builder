const ACTION_VERBS = [
  'led', 'owned', 'performed', 'built', 'designed', 'developed', 'delivered',
  'executed', 'managed', 'created', 'automated', 'implemented', 'improved',
  'optimized', 'resolved', 'spearheaded', 'orchestrated', 'maintained', 'tested',
  'engineered', 'collaborated', 'scaled', 'verified', 'drove'
];

// Word-boundary matching. A bare `includes` let "enabled" satisfy "led" and
// "saddled" satisfy "led", handing action-verb points to bullets with no verb
// at all. Compiled once at module load — this runs on every keystroke.
const VERB_PATTERNS = new Map(
  ACTION_VERBS.map((verb) => [verb, new RegExp(`\\b${verb}\\b`, 'i')])
);

/** A string, or '' for anything else. Keeps every .trim()/.toLowerCase() safe. */
function toText(value) {
  return typeof value === 'string' ? value : '';
}

/** An array, or [] for anything else. */
function listOf(value) {
  return Array.isArray(value) ? value : [];
}

function isObject(value) {
  return typeof value === 'object' && value !== null;
}

/** True when the text contains a real action verb as a whole word. */
function hasActionVerb(text) {
  const value = toText(text);
  if (!value) return false;
  for (const pattern of VERB_PATTERNS.values()) {
    if (pattern.test(value)) return true;
  }
  return false;
}

// --- layout awareness ------------------------------------------------------
// The data model alone cannot tell you a template pushed the last bullet onto
// page 2. ResumePreview measures the rendered height, so the caller may pass it
// as a second argument. Absent means "not measured yet" and the scorer behaves
// exactly as it did before layout existed — that is a hard contract, because
// every caller and test that predates this feature passes one argument.

/**
 * A4 at 96dpi. Mirrors the constant ResumePreview uses for its page-budget
 * badge so the two can never disagree about what "one page" means.
 */
const A4_PAGE_HEIGHT_PX = 1123;

/**
 * Category maximums when a layout measurement is available.
 *
 * Layout & Fit gets 13 because a resume that spills to a second page is the
 * single most common reason a strong candidate gets filtered, so it deserves
 * more weight than Education or Projects. The other six categories keep their
 * relative order but shrink to make room: the old spread was
 * 25/15/15/25/10/10 = 100, this one is 25/12/12/22/8/8 + 13 = 100. Contact
 * stays at 25 — a missing email is disqualifying regardless of page count.
 *
 * Without a layout measurement the legacy maximums above are used unchanged,
 * which is why the two tables are separate rather than one table scaled.
 */
const LAYOUT_MAX_SCORES = {
  'Contact & Header Info': 25,
  'Professional Summary': 12,
  'Skills & Keywords': 12,
  'Experience & Action Impact': 22,
  'Education & Credentials': 8,
  'Projects & Portfolio': 8,
  'Layout & Fit': 13,
};

/**
 * Read the optional layout argument. Anything that is not two finite, positive
 * pixel counts is treated as "no measurement" — a hostile layout must never
 * produce NaN, and ignoring it degrades to the legacy score, which is always
 * safe.
 */
function readLayout(layout) {
  if (!isObject(layout)) return null;
  const { pageHeightPx, pageBudgetPx } = layout;
  if (!Number.isFinite(pageHeightPx) || !Number.isFinite(pageBudgetPx)) return null;
  if (pageHeightPx <= 0 || pageBudgetPx <= 0) return null;
  return { ratio: pageHeightPx / pageBudgetPx };
}

/**
 * Points for the Layout & Fit category (out of 13).
 *
 * A clean one-pager earns full marks. Spill is punished in steps because the
 * difference between "3 lines on page 2" and "page 2 is half full" matters to a
 * recruiter: the first is a trim, the second is a rewrite. A page that is under
 * 40% full is deliberately NOT rewarded with full marks even though it fits —
 * fitting is only good if the page is actually used.
 */
function scoreLayoutFit(ratio) {
  if (ratio < 0.25) return 5; // almost empty
  if (ratio < 0.4) return 8; // thin: fits, but wastes the page
  if (ratio <= 1) return 13; // clean one page
  if (ratio <= 1.15) return 10; // minor spill, trimmable
  if (ratio <= 1.5) return 5; // a real second page
  if (ratio <= 2) return 2; // two full pages
  return 0; // beyond two pages
}

/**
 * Re-express a legacy breakdown on the layout-aware maximums and add the
 * Layout & Fit entry. Scores are scaled proportionally so a category that was
 * full stays full, then the total is recomputed from the breakdown itself —
 * which keeps the returned score and the numbers the modal renders in sync.
 *
 * `contentScore` is the legacy total. Fit is only meaningful for a resume that
 * has content: an almost-empty resume trivially "fits one page", and paying it
 * 13 points for that was a lie of exactly the kind this scorer exists to avoid.
 * Below a quarter of the legacy total the fit category is withheld entirely.
 */
function applyLayout(breakdown, layoutRatio, suggestions, contentScore) {
  const rebalanced = breakdown.map((item) => {
    const maxScore = LAYOUT_MAX_SCORES[item.category] ?? item.maxScore;
    const scaled = item.maxScore > 0 ? Math.ceil((item.score * maxScore) / item.maxScore) : 0;
    // Round up, not to nearest: the rebalanced maximums are smaller, so
    // rounding 4/15 down to 3/12 would delete a real signal and leave a resume
    // scoring LOWER merely because its page was measured. Measuring must never
    // cost points that content earned.
    const score = Math.min(maxScore, Math.max(0, scaled));
    // Same 80% "good" rule the legacy categories use, as an integer compare so
    // no float rounding can flip a status.
    return {
      ...item,
      score,
      maxScore,
      status: score * 5 >= maxScore * 4 ? 'good' : 'warning',
    };
  });

  const layoutScore = contentScore < 25 ? 0 : scoreLayoutFit(layoutRatio);
  rebalanced.push({
    category: 'Layout & Fit',
    score: layoutScore,
    maxScore: LAYOUT_MAX_SCORES['Layout & Fit'],
    status: layoutScore * 5 >= LAYOUT_MAX_SCORES['Layout & Fit'] * 4 ? 'good' : 'warning',
  });

  if (contentScore < 25) {
    suggestions.push(
      'Fill in the core sections first — page fit only counts once there is content to fit.'
    );
  } else if (layoutRatio > 1) {
    const pct = Math.round(layoutRatio * 100);
    suggestions.push(
      `Your resume renders at ${pct}% of one page, so content is spilling onto a second. Trim bullets or tighten spacing to land on a single page.`
    );
  } else if (layoutRatio < 0.4) {    suggestions.push(
      `Your resume only fills ${Math.round(layoutRatio * 100)}% of the page. Add projects or detail rather than leaving the page half empty.`
    );
  }

  const total = rebalanced.reduce((sum, item) => sum + item.score, 0);
  return { breakdown: rebalanced, total };
}

export function calculateAtsScore(resumeData, layout) {
  // Callers are supposed to hand us a normalized resume, but this function is
  // exported and a future caller may not. Guard here so it can never throw;
  // normalizeResume still owns the real sanitising.
  const data = isObject(resumeData) ? resumeData : {};
  const personalInfo = isObject(data.personalInfo) ? data.personalInfo : {};

  let score = 0;
  const breakdown = [];
  const suggestions = [];

  // 1. Personal Info Check (25 pts)
  let contactScore = 0;
  const emailValue = toText(personalInfo.email).trim();
  const hasValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailValue);
  if (toText(personalInfo.fullName).trim()) contactScore += 7;
  if (toText(personalInfo.title).trim()) contactScore += 6;
  if (hasValidEmail) contactScore += 4;
  if (toText(personalInfo.phone).trim()) contactScore += 4;
  if (toText(personalInfo.location).trim()) contactScore += 4;

  score += contactScore;
  breakdown.push({
    category: 'Contact & Header Info',
    score: contactScore,
    maxScore: 25,
    status: contactScore >= 20 ? 'good' : 'warning',
  });

  if (!toText(personalInfo.title).trim()) {
    suggestions.push('Add a targeted professional headline / title (e.g. "QA Lead | Automation Specialist").');
  }
  if (!toText(personalInfo.phone).trim() || !hasValidEmail) {
    suggestions.push('Ensure both a valid phone number and professional email are included.');
  }

  // 2. Professional Summary (15 pts)
  let summaryScore = 0;
  const summaryText = toText(data.summary).trim();
  const wordCount = summaryText ? summaryText.split(/\s+/).length : 0;

  if (wordCount >= 30 && wordCount <= 120) {
    summaryScore = 15;
  } else if (wordCount >= 10 && wordCount < 30) {
    // >= 10, not > 10: exactly 10 words used to fall through every branch and
    // score 0 while 11 words scored 9.
    summaryScore = 9;
    suggestions.push('Expand your summary slightly (target 40-80 words) to highlight leadership and core achievements.');
  } else if (wordCount > 120) {
    summaryScore = 10;
    suggestions.push('Your summary is a bit long. Aim to keep it punchy (under 100 words) for recruiter scannability.');
  } else {
    suggestions.push('Add an impactful 3-4 sentence professional summary.');
  }

  score += summaryScore;
  breakdown.push({
    category: 'Professional Summary',
    score: summaryScore,
    maxScore: 15,
    status: summaryScore >= 12 ? 'good' : 'warning',
  });

  // 3. Technical Skills & Keyword Coverage (15 pts)
  let skillsScore = 0;
  const skillGroups = listOf(data.skills);
  const totalCategories = skillGroups.length;
  let totalSkillCount = 0;
  skillGroups.forEach(s => {
    const items = toText(isObject(s) ? s.items : '');
    if (items) {
      totalSkillCount += items.split(/[,|;]/).length;
    }
  });

  // Custom sections are free-text keywords too, so they count toward coverage.
  const customSections = listOf(data.customSections);
  customSections.forEach(section => {
    listOf(isObject(section) ? section.items : []).forEach(item => {
      if (toText(item).trim()) totalSkillCount += 1;
    });
  });

  if (totalCategories >= 4 && totalSkillCount >= 10) {
    skillsScore = 15;
  } else if (totalSkillCount >= 5) {
    skillsScore = 9;
    suggestions.push('Categorize your skills into distinct domains (e.g. Automation, API, Performance, Tools).');
  } else {
    skillsScore = 4;
    suggestions.push('Add more relevant industry tools and frameworks to pass automated keyword screens.');
  }

  score += skillsScore;
  breakdown.push({
    category: 'Skills & Keywords',
    score: skillsScore,
    maxScore: 15,
    status: skillsScore >= 12 ? 'good' : 'warning',
  });

  // 4. Work Experience & Impact Metrics (25 pts)
  let expScore = 0;
  const experiences = listOf(data.experience).filter(isObject);
  if (experiences.length > 0) {
    expScore += 10;

    // Check for strong action verbs and quantified numbers
    let actionVerbCount = 0;
    let numberCount = 0;

    experiences.forEach(exp => {
      listOf(exp.highlights).forEach(hl => {
        const text = toText(hl);
        if (!text) return;
        if (hasActionVerb(text)) {
          actionVerbCount++;
        }
        if (/\d+/.test(text)) {
          numberCount++;
        }
      });
    });

    if (actionVerbCount >= 3) expScore += 8;
    else suggestions.push('Start your accomplishment bullets with strong action verbs (e.g. Spearheaded, Engineered, Led).');

    if (numberCount >= 2) expScore += 7;
    else suggestions.push('Quantify your results with metrics (e.g., "5 years", "3 mobile apps", "reduced bugs by 40%").');
  } else {
    suggestions.push('Add detailed work experience with measurable achievements.');
  }

  score += expScore;
  breakdown.push({
    category: 'Experience & Action Impact',
    score: expScore,
    maxScore: 25,
    status: expScore >= 20 ? 'good' : 'warning',
  });

  // 5. Education & Credentials (10 pts)
  let eduScore = 0;
  const education = listOf(data.education).filter(isObject);
  if (education.length > 0) {
    eduScore += 7;
    if (education.some(e => toText(e.degree).trim() && toText(e.school).trim())) {
      eduScore += 3;
    }
  } else {
    suggestions.push('Add your academic background (Degree, University/School).');
  }

  score += eduScore;
  breakdown.push({
    category: 'Education & Credentials',
    score: eduScore,
    maxScore: 10,
    status: eduScore >= 8 ? 'good' : 'warning',
  });

  // 6. Projects & Portfolio (10 pts)
  let projectScore = 0;
  const projects = listOf(data.projects).filter(isObject);
  if (projects.length > 0) {
    projectScore += 5;

    let projectVerbCount = 0;
    let projectNumberCount = 0;
    projects.forEach(proj => {
      listOf(proj.highlights).forEach(hl => {
        const text = toText(hl);
        if (!text) return;
        if (hasActionVerb(text)) projectVerbCount++;
        if (/\d+/.test(text)) projectNumberCount++;
      });
    });

    if (projectVerbCount >= 2) projectScore += 3;
    if (projectNumberCount >= 1) projectScore += 2;

    if (projectScore < 10) {
      suggestions.push('Describe each project with an action verb and a measurable outcome (e.g. "Cut manual regression time by 60%").');
    }
  } else {
    suggestions.push('Add 1-2 portfolio projects that prove the skills your target role asks for.');
  }

  score += projectScore;
  breakdown.push({
    category: 'Projects & Portfolio',
    score: projectScore,
    maxScore: 10,
    status: projectScore >= 8 ? 'good' : 'warning',
  });

  // 7. Layout & Fit (13 pts) — only when the caller measured the rendered page.
  // Without a measurement the legacy six-category breakdown above is returned
  // verbatim, so `calculateAtsScore(data)` keeps its exact previous score.
  const measured = readLayout(layout);
  let finalBreakdown = breakdown;
  let finalScore = Math.min(100, Math.max(0, Math.round(score)));

  if (measured) {
    const laidOut = applyLayout(breakdown, measured.ratio, suggestions, score);
    finalBreakdown = laidOut.breakdown;
    finalScore = Math.min(100, Math.max(0, Math.round(laidOut.total)));
  }

  let rating = 'Good';
  let ratingColor = 'text-blue-400';

  if (finalScore >= 90) {
    rating = 'Exceptional';
    ratingColor = 'text-emerald-400';
  } else if (finalScore >= 75) {
    rating = 'Strong ATS Ready';
    ratingColor = 'text-green-400';
  } else if (finalScore >= 50) {
    rating = 'Moderate';
    ratingColor = 'text-yellow-400';
  } else {
    rating = 'Needs Optimization';
    ratingColor = 'text-red-400';
  }

  return {
    score: finalScore,
    rating,
    ratingColor,
    breakdown: finalBreakdown,
    suggestions,
  };
}
