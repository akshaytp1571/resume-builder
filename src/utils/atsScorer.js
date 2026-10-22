const ACTION_VERBS = [
  'led', 'owned', 'performed', 'built', 'designed', 'developed', 'delivered',
  'executed', 'managed', 'created', 'automated', 'implemented', 'improved',
  'optimized', 'resolved', 'spearheaded', 'orchestrated', 'maintained', 'tested',
  'engineered', 'collaborated', 'scaled', 'verified', 'drove'
];

export function calculateAtsScore(resumeData) {
  let score = 0;
  const breakdown = [];
  const suggestions = [];

  // 1. Personal Info Check (25 pts)
  let contactScore = 0;
  const emailValue = (resumeData.personalInfo?.email || '').trim();
  const hasValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailValue);
  if (resumeData.personalInfo?.fullName?.trim()) contactScore += 7;
  if (resumeData.personalInfo?.title?.trim()) contactScore += 6;
  if (hasValidEmail) contactScore += 4;
  if (resumeData.personalInfo?.phone?.trim()) contactScore += 4;
  if (resumeData.personalInfo?.location?.trim()) contactScore += 4;

  score += contactScore;
  breakdown.push({
    category: 'Contact & Header Info',
    score: contactScore,
    maxScore: 25,
    status: contactScore >= 20 ? 'good' : 'warning',
  });

  if (!resumeData.personalInfo?.title) {
    suggestions.push('Add a targeted professional headline / title (e.g. "QA Lead | Automation Specialist").');
  }
  if (!resumeData.personalInfo?.phone?.trim() || !hasValidEmail) {
    suggestions.push('Ensure both a valid phone number and professional email are included.');
  }

  // 2. Professional Summary (20 pts)
  let summaryScore = 0;
  const summaryText = resumeData.summary?.trim() || '';
  const wordCount = summaryText ? summaryText.split(/\s+/).length : 0;

  if (wordCount >= 30 && wordCount <= 120) {
    summaryScore = 20;
  } else if (wordCount > 10 && wordCount < 30) {
    summaryScore = 12;
    suggestions.push('Expand your summary slightly (target 40-80 words) to highlight leadership and core achievements.');
  } else if (wordCount > 120) {
    summaryScore = 14;
    suggestions.push('Your summary is a bit long. Aim to keep it punchy (under 100 words) for recruiter scannability.');
  } else {
    suggestions.push('Add an impactful 3-4 sentence professional summary.');
  }

  score += summaryScore;
  breakdown.push({
    category: 'Professional Summary',
    score: summaryScore,
    maxScore: 20,
    status: summaryScore >= 16 ? 'good' : 'warning',
  });

  // 3. Technical Skills (20 pts)
  let skillsScore = 0;
  const totalCategories = resumeData.skills?.length || 0;
  let totalSkillCount = 0;
  resumeData.skills?.forEach(s => {
    if (s.items) {
      totalSkillCount += s.items.split(/[,|;]/).length;
    }
  });

  if (totalCategories >= 4 && totalSkillCount >= 10) {
    skillsScore = 20;
  } else if (totalSkillCount >= 5) {
    skillsScore = 12;
    suggestions.push('Categorize your skills into distinct domains (e.g. Automation, API, Performance, Tools).');
  } else {
    skillsScore = 5;
    suggestions.push('Add more relevant industry tools and frameworks to pass automated keyword screens.');
  }

  score += skillsScore;
  breakdown.push({
    category: 'Skills & Keywords',
    score: skillsScore,
    maxScore: 20,
    status: skillsScore >= 16 ? 'good' : 'warning',
  });

  // 4. Work Experience & Impact Metrics (25 pts)
  let expScore = 0;
  const experiences = resumeData.experience || [];
  if (experiences.length > 0) {
    expScore += 10;
    
    // Check for strong action verbs and quantified numbers
    let actionVerbCount = 0;
    let numberCount = 0;
    
    experiences.forEach(exp => {
      (exp.highlights || []).forEach(hl => {
        const lower = hl.toLowerCase();
        if (ACTION_VERBS.some(v => lower.includes(v))) {
          actionVerbCount++;
        }
        if (/\d+/.test(hl)) {
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
  if (resumeData.education && resumeData.education.length > 0) {
    eduScore += 7;
    if (resumeData.education.some(e => e.degree && e.school)) {
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

  const finalScore = Math.min(100, Math.round(score));
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
    breakdown,
    suggestions,
  };
}
