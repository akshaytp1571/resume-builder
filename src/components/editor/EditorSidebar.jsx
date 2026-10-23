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

const TABS = [
  { id: 'templates', label: 'Theme', icon: Palette },
  { id: 'personal', label: 'Identity', icon: User },
  { id: 'summary', label: 'Summary', icon: FileText },
  { id: 'skills', label: 'Skills', icon: Sparkles },
  { id: 'experience', label: 'Experience', icon: Briefcase },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'education', label: 'Education', icon: GraduationCap },
  { id: 'certifications', label: 'Certs', icon: Award },
  { id: 'custom', label: 'Custom', icon: LayoutList },
  { id: 'letter', label: 'Letter', icon: Mail },
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
}) {
  const [activeTab, setActiveTab] = useState('templates');

  const handleTabClick = (tabId) => {
    sound.playTab();
    setActiveTab(tabId);
  };

  return (
    <aside
      aria-label="Resume editor"
      className="w-full lg:w-[500px] shrink-0 border-r border-pink-500/20 bg-[#18071a]/95 backdrop-blur-2xl flex flex-col h-[calc(100vh-70px)] overflow-hidden no-print select-none"
    >
      {/* Botanical Atelier Sub-Header */}
      <div className="px-4 py-2 bg-[#140616] border-b border-pink-500/20 flex items-center justify-between text-xs text-pink-200">
        <div className="flex items-center gap-1.5">
          <Sparkles size={13} className="text-rose-400 animate-pulse" aria-hidden="true" />
          <span className="font-bold tracking-wider text-[11px] uppercase">✦ Resume Studio Workshop</span>
        </div>
        <span className="text-[10px] text-pink-400/85 font-sans">Live Auto-Sync</span>
      </div>

      {/* Elegant Tab Selector
          Ten tabs now, so the column count is chosen to divide 10 evenly:
          2 on mobile (5 rows), 5 from sm up (2 rows). The old 3-column mobile
          grid would leave a ragged single tab on the last row. */}
      <div
        role="tablist"
        aria-label="Editor sections"
        className="grid grid-cols-2 sm:grid-cols-5 gap-1 p-2 bg-[#140516] border-b border-pink-500/15"
      >
        {TABS.map((tab) => {
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
              <span className="truncate w-full text-center font-semibold text-[10px]">{tab.label}</span>
              {isActive && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-[2px] bg-rose-400 shadow-[0_0_8px_#f43f5e]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content Panel */}
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
            onChange={(personalInfo) =>
              onUpdateResume({ ...resumeData, personalInfo })
            }
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
            onChange={(experience) =>
              onUpdateResume({ ...resumeData, experience })
            }
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
              onChange={(education) =>
                onUpdateResume({ ...resumeData, education })
              }
            />

            <div className="border-t border-pink-500/20 pt-5">
              <LanguagesEditor
                languages={resumeData.languages}
                onChange={(languages) =>
                  onUpdateResume({ ...resumeData, languages })
                }
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
