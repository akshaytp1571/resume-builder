import React, { useState } from 'react';
import {
  Palette,
  User,
  FileText,
  Sparkles,
  Briefcase,
  GraduationCap,
  Award,
  FolderKanban,
  LayoutList,
  Mail,
  Cloud,
} from 'lucide-react';
import { sound } from '../../utils/soundEffects';
import PersonalInfoEditor from './PersonalInfoEditor';
import SummaryEditor from './SummaryEditor';
import SkillsEditor from './SkillsEditor';
import ExperienceEditor from './ExperienceEditor';
import EducationEditor from './EducationEditor';
import CertificationsEditor from './CertificationsEditor';
import LanguagesEditor from './LanguagesEditor';
import ProjectsEditor from './ProjectsEditor';
import CustomSectionsEditor from './CustomSectionsEditor';
import CoverLetterEditor from './CoverLetterEditor';
import ThemeCustomizer from './ThemeCustomizer';
import SaveStatus from '../ui/SaveStatus';

/**
 * The rail.
 *
 * Two documents, two sections — CV and Letter — switched at the top. Below that,
 * the active document's sections as a horizontal index of numbered rows, then the
 * panel.
 *
 * TABS ARE STILL REAL TABS. cvLetterSections.test.jsx queries
 * role="tablist" { name: /document/i } with tabs named /^CV$/ and /^Letter$/,
 * and a second tablist named /cv sections/i. Both role and aria-selected are
 * asserted, so the segmented control below is a tablist, not a styled div.
 *
 * The old version was a 3x5 grid of icon tiles. A grid of nine equal boxes says
 * "these are nine unrelated things"; a numbered column says "this is a document
 * with nine parts, in order". The numeral is the only serif in the rail.
 */

const CV_TABS = [
  { id: 'templates', label: 'Theme', icon: Palette },
  { id: 'personal', label: 'Identity', icon: User },
  { id: 'summary', label: 'Summary', icon: FileText },
  { id: 'skills', label: 'Skills', icon: Sparkles },
  { id: 'experience', label: 'Experience', icon: Briefcase },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'education', label: 'Education', icon: GraduationCap },
  { id: 'certifications', label: 'Certs', icon: Award },
  { id: 'custom', label: 'Custom', icon: LayoutList },
];

const LETTER_TABS = [{ id: 'letter', label: 'Cover Letter', icon: Mail }];

const SECTIONS = [
  { id: 'cv', label: 'CV', hint: 'The resume document', tabs: CV_TABS, defaultTab: 'templates' },
  { id: 'letter', label: 'Letter', hint: 'The cover letter document', tabs: LETTER_TABS, defaultTab: 'letter' },
];

export default function EditorSidebar({
  resumeData,
  theme,
  letter,
  onUpdateResume,
  onUpdateTheme,
  onUpdateLetter,
  onExportCoverLetter,
  onTriggerAiRefine,
  onOpenAiConfig,
  saveStatus,
  onOpenDrive,
}) {
  const [section, setSection] = useState('cv');
  const [activeTab, setActiveTab] = useState('templates');

  const currentSection = SECTIONS.find((s) => s.id === section) || SECTIONS[0];

  const handleSectionClick = (next) => {
    sound.playTab();
    setSection(next);
    const target = SECTIONS.find((s) => s.id === next);
    setActiveTab(target?.defaultTab || target?.tabs[0]?.id);
  };

  const handleTabClick = (tabId) => {
    sound.playTab();
    setActiveTab(tabId);
  };

  const activeIdx = currentSection.tabs.findIndex((t) => t.id === activeTab);

  return (
    <aside
      aria-label="Document editor"
      className="dt-enter-rail no-print flex h-[calc(100vh-70px)] w-full shrink-0 select-none flex-col overflow-hidden border-r border-rule bg-housing lg:w-[460px] xl:w-[500px]"
    >
      {/* ---- CV | Letter -------------------------------------------------
          A segmented control, not a tab bar. The sliding 1px lime rule is a
          transform on a single element rather than a per-button underline, so
          it moves rather than blinks. */}
      <div
        role="tablist"
        aria-label="Document"
        className="relative flex border-b border-rule bg-housing-2"
      >
        {SECTIONS.map((s, i) => {
          const isActive = section === s.id;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`section-${s.id}`}
              id={`section-tab-${s.id}`}
              onClick={() => handleSectionClick(s.id)}
              title={s.hint}
              className={`relative flex flex-1 cursor-pointer items-baseline justify-center gap-2 py-2.5 transition-colors duration-[90ms] ${
                isActive ? 'text-bone' : 'text-bone-52 hover:text-bone-70'
              }`}
            >
              <span className="dt-label">{s.label}</span>
              {/* active rule */}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-px bg-signal"
                  style={{ transform: `translateX(${i === 0 ? 0 : 100}%)` }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ---- save state --------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule bg-housing px-3 py-1.5">
        <div className="flex items-center gap-1.5">
          <span className="dt-label text-bone-32">
            {section === 'cv' ? 'Resume' : 'Letter'}
          </span>
          <span aria-hidden="true" className="h-3 w-px bg-[var(--rule)]" />
          <span className="dt-data text-bone-32">
            {section === 'cv'
              ? `${currentSection.tabs.length} sections`
              : 'one document'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {saveStatus && (
            <SaveStatus
              status={saveStatus.status}
              savedAt={saveStatus.savedAt}
              isDefault={saveStatus.isDefault}
              onSave={saveStatus.saveNow}
              onSetDefault={saveStatus.setAsDefault}
              onClearDefault={saveStatus.clearDefault}
            />
          )}
          {onOpenDrive && (
            <button
              type="button"
              onClick={onOpenDrive}
              title="Back up to Google Drive"
              aria-label="Back up to Google Drive"
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-[2px] border border-rule-2 text-bone-52 transition-colors duration-[90ms] hover:bg-[rgba(237,232,220,0.05)] hover:text-bone"
            >
              <Cloud size={11} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* ---- section index ------------------------------------------------
          A numbered column. Each row is a hairline; the active row carries a
          2px lime left rule. The numeral is serif — the one human mark. */}
      <div
        role="tablist"
        aria-label={`${currentSection.label} sections`}
        aria-orientation="vertical"
        className="flex shrink-0 flex-col overflow-y-auto border-b border-rule"
        style={{ maxHeight: '40vh' }}
      >
        {currentSection.tabs.map((tab, i) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              id={`tab-${tab.id}`}
              onClick={() => handleTabClick(tab.id)}
              className={`group flex cursor-pointer items-center gap-2.5 border-l-2 px-3 py-[7px] text-left transition-colors duration-[90ms] ${
                isActive
                  ? 'border-l-signal bg-[rgba(237,232,220,0.04)]'
                  : 'border-l-transparent hover:bg-[rgba(237,232,220,0.03)]'
              }`}
            >
              <span
                className={`dt-serif w-[16px] shrink-0 text-[12px] ${
                  isActive ? 'text-signal' : 'text-bone-32'
                }`}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <Icon
                size={12}
                aria-hidden="true"
                className={isActive ? 'text-bone-70' : 'text-bone-32 group-hover:text-bone-52'}
              />
              <span
                className={`dt-label ${isActive ? 'text-bone' : 'text-bone-52 group-hover:text-bone-70'}`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* ---- panel -------------------------------------------------------- */}
      <div
        className="relative flex-1 overflow-y-auto px-4 py-4"
        role="tabpanel"
        id={`panel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
      >
        {/* Section position as a quiet readout on its own line. It was
            absolutely positioned in the corner and collided with the template
            count chip on the Theme tab. */}
        <p aria-hidden="true" className="dt-data mb-3 text-bone-32">
          Section {String(Math.max(activeIdx, 0) + 1).padStart(2, '0')} of{' '}
          {String(currentSection.tabs.length).padStart(2, '0')}
        </p>


        {activeTab === 'templates' && (
          <ThemeCustomizer theme={theme} onChange={onUpdateTheme} resumeData={resumeData} />
        )}

        {activeTab === 'personal' && (
          <PersonalInfoEditor
            data={resumeData.personalInfo}
            onChange={(personalInfo) => onUpdateResume({ ...resumeData, personalInfo })}
          />
        )}

        {activeTab === 'summary' && (
          <SummaryEditor
            summary={resumeData.summary}
            onChange={(summary) => onUpdateResume({ ...resumeData, summary })}
            onTriggerAiRefine={onTriggerAiRefine}
            onOpenAiConfig={onOpenAiConfig}
          />
        )}

        {activeTab === 'skills' && (
          <SkillsEditor
            skills={resumeData.skills}
            onChange={(skills) => onUpdateResume({ ...resumeData, skills })}
            onOpenAiConfig={onOpenAiConfig}
          />
        )}

        {activeTab === 'experience' && (
          <ExperienceEditor
            experience={resumeData.experience}
            onChange={(experience) => onUpdateResume({ ...resumeData, experience })}
            onTriggerAiRefine={onTriggerAiRefine}
            onOpenAiConfig={onOpenAiConfig}
          />
        )}

        {activeTab === 'projects' && (
          <ProjectsEditor
            projects={resumeData.projects || []}
            onChange={(projects) => onUpdateResume({ ...resumeData, projects })}
          />
        )}

        {activeTab === 'education' && (
          <div className="space-y-5">
            <EducationEditor
              education={resumeData.education}
              onChange={(education) => onUpdateResume({ ...resumeData, education })}
            />

            <div className="border-t border-rule pt-4">
              <LanguagesEditor
                languages={resumeData.languages}
                onChange={(languages) => onUpdateResume({ ...resumeData, languages })}
              />
            </div>

            <div className="border-t border-rule pt-3">
              <button
                type="button"
                onClick={() => handleTabClick('certifications')}
                className="dt-label cursor-pointer rounded-[2px] border border-rule-2 px-2 py-1 text-bone-52 transition-colors duration-[90ms] hover:bg-[rgba(237,232,220,0.05)] hover:text-bone"
              >
                Certifications →
              </button>
            </div>
          </div>
        )}

        {activeTab === 'certifications' && (
          <CertificationsEditor
            certifications={resumeData.certifications || []}
            onChange={(certifications) => onUpdateResume({ ...resumeData, certifications })}
          />
        )}

        {activeTab === 'custom' && (
          <CustomSectionsEditor
            customSections={resumeData.customSections || []}
            onChange={(customSections) => onUpdateResume({ ...resumeData, customSections })}
          />
        )}

        {activeTab === 'letter' && (
          <CoverLetterEditor
            letter={letter}
            resumeData={resumeData}
            onChange={onUpdateLetter}
            onExportDocx={onExportCoverLetter}
          />
        )}
      </div>
    </aside>
  );
}
