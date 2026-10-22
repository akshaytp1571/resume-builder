import { callAiChat } from './aiService';
import { getSavedCredentials, toApiPayload } from './jobCredentials';

/**
 * Job Discovery Service
 * Uses AI agents and browser automation to search and aggregate job openings from multiple sources.
 *
 * Integration point for the Agent Harness layer:
 * - Leverages the AutoGen-compatible agent harness from our agent_framework_poc
 * - Uses Playwright browser automation via API server for live scraping
 * - Supports multi-provider AI backends (Vyce AI, OpenAI, Groq, etc.)
 */

/**
 * Job board search sources configuration
 * Can be extended to include more platforms
 */
export const JOB_BOARD_SOURCES = [
  {
    id: 'linkedin',
    name: 'LinkedIn Jobs',
    baseUrl: 'https://www.linkedin.com/jobs/search/',
    requiresAuth: true,
  },
  {
    id: 'naukari',
    name: 'Naukri.com',
    baseUrl: 'https://www.naukri.com/',
    requiresAuth: true,
  },
  {
    id: 'indeed',
    name: 'Indeed',
    baseUrl: 'https://www.indeed.com/jobs',
    requiresAuth: false,
  },
];

/**
 * Construct a job search query for the AI agent
 */
function buildSearchPrompt(jobTitle, location, experienceLevel, salaryMin) {
  return `
You are a professional job researcher agent working for a resume optimization platform.

TASK: Find relevant job openings for the following criteria:

JOB TITLE: ${jobTitle || 'Software Engineer'}
LOCATION: ${location || 'Remote/Digital Nomad'}
EXPERIENCE LEVEL: ${experienceLevel || 'Mid-Senior Level'}
MINIMUM SALARY (USD): ${salaryMin || 'Any'}

INSTRUCTIONS:
1. Search across major job boards (LinkedIn, Indeed, Glassdoor, company career pages)
2. Find 5-10 highly relevant job postings matching the criteria
3. For each job, extract:
   - Company name
   - Job title
   - Location (city, state/country or "Remote")
   - Salary range or compensation info (if available)
   - Brief description of role and requirements (3-4 key points)
   - Application link/URL (if accessible)
   - Source platform

OUTPUT FORMAT: Return valid JSON array matching this schema:
[
  {
    "company": "Company Name",
    "title": "Job Title",
    "location": "City, State or Remote",
    "salary": "Salary range or N/A",
    "description": "3-4 key bullet points about role and requirements",
    "applyUrl": "Application URL if available",
    "source": "Platform name"
  }
]

Return ONLY the JSON array. No markdown formatting.`;
}

/**
 * Discover jobs using browser automation + AI agent for enhanced results
 *
 * This function integrates with the agent harness to:
 * 1. Launch browser automation to scrape job boards directly
 * 2. Search multiple job boards (LinkedIn, Naukri, Indeed)
 * 3. Aggregate and deduplicate results
 * 4. Fall back to AI-based search if browser automation fails
 * 5. Pass results back for ATS analysis
 */
export async function discoverJobs(params, aiConfig = null, credentials = null) {
  const {
    jobTitle = 'Software Engineer',
    location = 'Remote',
    experienceLevel = 'Mid-Senior Level',
    salaryMin = null,
    useBrowserAutomation = true,
    apiEndpoint = 'http://localhost:3457',
  } = params;

  // Fall back to whatever the user saved in the credentials modal.
  const effectiveCredentials = credentials || toApiPayload(getSavedCredentials());

  try {
    let allJobs = [];
    
    // Try browser automation first via API server
    if (useBrowserAutomation) {
      try {
        const response = await fetch(`${apiEndpoint}/api/discover-jobs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jobTitle,
            location,
            experienceLevel,
            credentials: effectiveCredentials,
            maxPages: 2
          }),
          // The backend caps its own work at 180s; wait a little longer.
          signal: AbortSignal.timeout(200000)
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.jobs) && data.jobs.length > 0) {
            allJobs = deduplicateJobs(data.jobs);
            console.log(`Browser automation found ${allJobs.length} jobs`);
          }
        }
      } catch (browserError) {
        console.warn('Browser automation failed, falling back to AI search:', browserError.message);
      }
    }
    
    // If browser automation didn't find enough jobs, use AI fallback
    if (allJobs.length < 5) {
      const systemPrompt = buildSearchPrompt(jobTitle, location, experienceLevel, salaryMin);
      const userPrompt = `Find relevant job openings matching these criteria: ${jobTitle} in ${location}. Experience level: ${experienceLevel}. Minimum salary: ${salaryMin || 'Any'}. Return JSON array with 5-10 jobs.`;
      
      const rawResponse = await callAiChat({
        systemPrompt,
        userPrompt,
        config: aiConfig,
      });
      
      const aiJobs = parseJobsResponse(rawResponse);
      allJobs = deduplicateJobs([...allJobs, ...aiJobs]);
    }
    
    return {
      success: true,
      jobs: allJobs,
      searchParams: {
        jobTitle,
        location,
        experienceLevel,
        salaryMin,
      },
      totalFound: allJobs.length,
    };
  } catch (error) {
    console.error('Job discovery failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to discover jobs',
      jobs: [],
      totalFound: 0,
    };
  }
}

/**
 * Parse AI response into job listing objects
 */
function parseJobsResponse(rawText) {
  try {
    const parsed = JSON.parse(rawText.replace(/```json/gi, '').replace(/```/g, '').trim());

    if (!Array.isArray(parsed)) {
      throw new Error('Response is not a JSON array');
    }

    return parsed.map((job, index) => ({
      id: `job-${Date.now()}-${index}`,
      company: job.company || 'Unknown Company',
      title: job.title || 'Unknown Position',
      location: job.location || 'Location not specified',
      salary: job.salary || 'Not listed',
      description: job.description || 'No description available',
      applyUrl: job.applyUrl || '',
      source: job.source || 'Multiple Sources',
      discoveredAt: new Date().toISOString(),
    }));
  } catch (parseError) {
    console.error('Failed to parse jobs response:', parseError);
    // Return empty array if parsing fails
    return [];
  }
}

/**
 * Get featured/recommended jobs for the current resume profile
 * This leverages the resume data to suggest target roles
 */
export async function suggestTargetJobs(resumeData, aiConfig = null) {
  const currentRole = resumeData.personalInfo?.title || 'QA Lead';
  const skills = resumeData.skills?.map((s) => s.category).join(', ') || '';

  const systemPrompt = `
You are a career advisor AI agent. Analyze the candidate's profile and suggest 5-8 relevant job titles/categories to search for on job boards.

Candidate Profile:
- Current Role: ${currentRole}
- Key Skills: ${skills}

Provide suggestions in JSON format:
{
  "suggestedTitles": ["Job Title 1", "Job Title 2", ...],
  "reasoning": "Brief explanation of why these roles match"
}
Return ONLY valid JSON.`;

  try {
    const rawResponse = await callAiChat({
      systemPrompt,
      userPrompt: 'Suggest relevant job titles based on the candidate profile above.',
      config: aiConfig,
    });

    return parseJobSuggestions(rawResponse);
  } catch (error) {
    console.error('Failed to suggest jobs:', error);
    return {
      suggestedTitles: [currentRole],
      reasoning: 'Based on current title',
    };
  }
}

function parseJobSuggestions(rawText) {
  try {
    const parsed = JSON.parse(rawText.replace(/```json/gi, '').replace(/```/g, '').trim());
    return {
      suggestedTitles: parsed.suggestedTitles || [],
      reasoning: parsed.reasoning || '',
    };
  } catch (parseError) {
    return {
      suggestedTitles: [],
      reasoning: 'Failed to parse AI suggestions',
    };
  }
}

/**
 * Filter jobs based on resume match
 * Simple keyword matching for initial filtering
 */

/**
 * Deduplicate jobs by title and company.
 * Tolerates missing fields and strips punctuation/case so "QA Lead" and
 * "qa-lead" at the same employer collapse into one entry.
 */
export function deduplicateJobs(jobs) {
  const seen = new Set();
  const list = Array.isArray(jobs) ? jobs : [];
  return list.filter((job) => {
    if (!job) return false;
    const title = String(job.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const company = String(job.company || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const key = `${title}::${company}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function filterJobsByResume(jobs, resumeData) {
  const list = Array.isArray(jobs) ? jobs : [];
  const resumeText = `${resumeData.summary || ''} ${resumeData.skills?.map((s) => s.items).join(' ') || ''} ${resumeData.experience?.map((e) => e.role + ' ' + e.company).join(' ') || ''}`.toLowerCase();

  // The role the candidate is aiming at, taken from their headline.
  const targetTitle = (resumeData.personalInfo?.title || '').split('|')[0].trim().toLowerCase();

  return list.map((job) => {
    const jobText = `${job.title} ${job.description}`.toLowerCase();
    let matchScore = 0;

    // Skills that actually appear on the resume are worth more than ones the
    // candidate merely listed as common QA terms.
    const skillKeywords = ['testing', 'automation', 'api', 'performance', 'qa', 'selenium', 'jmeter'];
    skillKeywords.forEach((keyword) => {
      if (jobText.includes(keyword)) {
        matchScore += resumeText.includes(keyword) ? 12 : 6;
      }
    });

    if (targetTitle && jobText.includes(targetTitle)) {
      matchScore += 25;
    }

    // Overlap between the job's words and the resume's own words.
    const jobWords = new Set(jobText.split(/[^a-z0-9+#]+/).filter((w) => w.length > 3));
    let overlap = 0;
    jobWords.forEach((w) => {
      if (resumeText.includes(w)) overlap += 1;
    });
    matchScore += Math.min(20, overlap * 2);

    return {
      ...job,
      matchScore: Math.min(100, matchScore),
    };
  }).sort((a, b) => b.matchScore - a.matchScore);
}
