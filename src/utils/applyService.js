import { callAiChat } from './aiService';

const API_BASE = 'http://localhost:3457';

/**
 * Apply Agent Service (browser side)
 *
 * Talks to the local apply agent. The agent fills the form and attaches the
 * resume but does NOT submit unless `submit` AND `confirmSubmit` are both
 * true - so the UI must ask twice before anything is sent.
 */

export const APPLY_AGENT_OFFLINE =
  'The apply agent service is not running. Start it with: npm run jobs:api';

/**
 * Prepare an application for a job.
 *
 * @param {object} job        { title, company, applyUrl }
 * @param {object} resumeData The resume builder's resumeData
 * @param {object} options    { resumePath, dryRun, coverLetter }
 */
export async function prepareApplication(job, resumeData, options = {}) {
  const { resumePath = '', dryRun = true, coverLetter = '' } = options;

  if (!job?.applyUrl) {
    return {
      status: 'failed',
      error: 'This listing has no application link.',
    };
  }

  try {
    const response = await fetch(`${API_BASE}/api/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job, resumeData, resumePath, dryRun, coverLetter }),
      signal: AbortSignal.timeout(180000),
    });

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const err = await response.json();
        detail = err.error || detail;
      } catch (e) {
        /* keep the status line */
      }
      throw new Error(detail);
    }

    return await response.json();
  } catch (error) {
    if (error.name === 'TimeoutError') {
      return { status: 'failed', error: 'The apply agent timed out.' };
    }
    if (error.message.includes('Failed to fetch')) {
      return { status: 'failed', error: APPLY_AGENT_OFFLINE };
    }
    return { status: 'failed', error: error.message || 'Apply agent failed' };
  }
}

/**
 * Actually submit the application.
 * Only ever called after an explicit double confirmation in the UI.
 */
export async function submitApplication(job, resumeData, options = {}) {
  const { resumePath = '', coverLetter = '' } = options;

  try {
    const response = await fetch(`${API_BASE}/api/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job,
        resumeData,
        resumePath,
        coverLetter,
        dryRun: false,
        submit: true,
        confirmSubmit: true,
      }),
      signal: AbortSignal.timeout(180000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    return { status: 'failed', error: error.message || 'Submit failed' };
  }
}

/**
 * Check whether the apply agent service is running.
 */
export async function isApplyAgentOnline() {
  try {
    const response = await fetch(`${API_BASE}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch (e) {
    return false;
  }
}

/**
 * Ask the AI to write a cover letter for a specific job, using the resume
 * as the source of truth. Kept here so the apply flow is one button.
 */
export async function generateCoverLetter({ job, resumeData, config = null, tone }) {
  const systemPrompt = `You are an expert executive resume writer preparing a cover letter for a specific job.

Rules:
1. Only use facts present in the resume. Never invent employers, dates, degrees or tools.
2. Reference the job title and company by name where the posting names them.
3. Speak to the role's actual responsibilities, not generic filler.
4. 180-280 words, plain prose, no headings, no bullet points, no placeholder brackets.
5. Output ONLY the letter body.`;

  const userPrompt = `RESUME SUMMARY:
${resumeData.summary || ''}

RESUME SKILLS:
${(resumeData.skills || []).map((s) => `${s.category}: ${s.items}`).join('\n')}

RESUME EXPERIENCE:
${(resumeData.experience || [])
  .map((e) => `${e.role} at ${e.company}\n${(e.highlights || []).map((h) => `- ${h}`).join('\n')}`)
  .join('\n\n')}

JOB TITLE: ${job.title || ''}
COMPANY: ${job.company || ''}
JOB DESCRIPTION:
${job.description || '(not provided)'}

${tone ? `TONE: ${tone}\n` : ''}
Write the cover letter:`;

  try {
    const raw = await callAiChat({ systemPrompt, userPrompt, config });
    return { ok: true, text: raw.trim() };
  } catch (error) {
    return { ok: false, error: error.message || 'Could not generate a cover letter' };
  }
}
