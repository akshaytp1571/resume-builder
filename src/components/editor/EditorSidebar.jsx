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
  FileUser,
  PenLine,
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
import { Cloud } from 'lucide-react';

/**
 * Two documents, two sections.
 *
 * Previously the cover letter was the tenth tab in a grid of nine resume tabs,
 * which made it look like a field of the resume. It is not: it is a separate
 * document with its own content, its own export, and its own editor. The letter
 * tab was also the only one that changed the *right-hand preview's* subject
 * without any indication that it had.
 *
 * So the sidebar is now split at the top level:
 *   CV     — everything about the resume document
 *   Letter — the cover letter document, alone
 *
 * The tab grid is per-section, which also fixes a layout problem: 9 CV tabs and
 * 1 letter tab in a single grid left a ragged row no matter the column count.
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
  {
    id: 'cv',
    label: 'CV',
    icon: FileUser,
    hint: 'The resume document',
    tabs: CV_TABS,
    defaultTab: 'templates',
  },
  {
    id: 'letter',
    label: 'Letter',
    icon: PenLine,
    hint: 'The cover letter document',
    tabs: LETTER_TABS,
    defaultTab: 'letter',
  },
];

const GRID_BY_COUNT = {
  1: 'grid-cols-1',
  9: 'grid-cols-3 sm:grid-cols-5 lg:grid-cols-5',
};

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

  const gridClass = GRID_BY_COUNT[currentSection.tabs.length] || 'grid-cols-3';

  return (
    <aside
      aria-label="Document editor"
      className="w-full lg:w-[500px] shrink-0 border-r border-pink-500/20 bg-[#18071a]/95 backdrop-blur-2xl flex flex-col h-[calc(100vh-70px)] overflow-hidden no-print select-none"
    >
      {/* Section switcher — CV vs Letter.
          Deliberately above the tab grid and visually distinct from it: these
          are two documents, not two fields of one. */}
      <div
        role="tablist"
        aria-label="Document"
        className="flex border-b border-pink-500/25 bg-[#140616]"
      >
        {SECTIONS.map((s) => {
          const Icon = s.icon;
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
              className={`relative flex flex-1 items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose-400 ${
                isActive
                  ? 'bg-[#221026] text-pink-50'
                  : 'text-pink-300/70 hover:bg-pink-950/30 hover:text-pink-100'
              }`}
            >
              <Icon size={15} aria-hidden="true" className={isActive ? 'text-rose-300' : ''} />
              <span>{s.label}</span>
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-rose-400 shadow-[0_0_8px_#f43f5e]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Sub-header: which document, and whether it is saved */}
      <div className="px-3 py-1.5 bg-[#140616] border-b border-pink-500/20 flex flex-wrap items-center justify-between gap-2 text-xs text-pink-200">
        <div className="flex items-center gap-1.5 shrink-0">
          <Sparkles size={12} className="text-rose-400 animate-pulse" aria-hidden="true" />
          <span className="font-bold tracking-wider text-[10px] uppercase">
            {section === 'cv' ? '✦ Resume Workshop' : '✦ Cover Letter Workshop'}
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
              className="rounded-lg border border-pink-500/30 bg-[#250d2b] p-1 text-pink-200 transition-colors hover:bg-[#32113a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
            >
              <Cloud size={12} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Tab selector for the current section */}
      <div
        role="tablist"
        aria-label={`${currentSection.label} sections`}
        className={`grid ${gridClass} gap-1 p-2 bg-[#140516] border-b border-pink-500/15`}
      >
        {currentSection.tabs.map((tab) => {
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
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[10px] tracking-wide transition-all cursor-pointer relative group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#140516] ${
                isActive
                  ? 'bg-gradient-to-b from-[#3a133d] to-[#270b29] text-pink-100 border border-pink-400/70 shadow-[0_4px_16px_rgba(244,63,94,0.25)]'
                  : 'text-pink-300/70 hover:text-pink-100 hover:bg-pink-950/30 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-1 mb-1">
                <Icon
                  size={14}
                  aria-hidden="true"
                  className={isActive ? 'text-rose-300' : 'text-pink-400/85 group-hover:text-pink-300'}
                />
              </div>
              <span className="truncate w-full text-center font-semibold text-[10px]">
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-[2px] bg-rose-400 shadow-[0_0_8px_#f43f5e]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Panel */}
      <div
        className="flex-1 overflow-y-auto p-4 sm:p-5 relative"
        role="tabpanel"
        id={`panel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
      >
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
          <div className="space-y-6">
            <EducationEditor
              education={resumeData.education}
              onChange={(education) => onUpdateResume({ ...resumeData, education })}
            />

            <div className="border-t border-pink-500/20 pt-5">
              <LanguagesEditor
                languages={resumeData.languages}
                onChange={(languages) => onUpdateResume({ ...resumeData, languages })}
              />
            </div>

            <div className="border-t border-pink-500/20 pt-5">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[11px] font-bold text-pink-300">
                  Looking for Certifications?
                </span>
                <button
                  type="button"
                  onClick={() => handleTabClick('certifications')}
                  className="px-3 py-1 text-[11px] font-bold rounded-xl bg-pink-950/60 hover:bg-pink-900/80 text-pink-200 border border-pink-500/40 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                >
                  Go to Certifications Tab →
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'certifications' && (
          <CertificationsEditor
            certifications={resumeData.certifications || []}
            onChange={(certifications) =>
              onUpdateResume({ ...resumeData, certifications })
            }
          />
        )}

        {activeTab === 'custom' && (
          <CustomSectionsEditor
            customSections={resumeData.customSections || []}
            onChange={(customSections) =>
              onUpdateResume({ ...resumeData, customSections })
            }
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
