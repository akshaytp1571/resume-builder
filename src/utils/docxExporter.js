import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ImageRun,
} from 'docx';
import { saveAs } from 'file-saver';
import { normalizeCoverLetter, formatLetterDate } from './coverLetter.js';

function base64ToUint8Array(base64) {
  if (!base64 || typeof base64 !== 'string') return null;
  try {
    // Accept both full data URLs and bare base64 payloads.
    const raw = base64.replace(/^data:image\/[\w.+-]+;base64,/, '');
    const binaryString = atob(raw);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    console.error('Error converting base64 to uint8array', e);
    return null;
  }
}

/**
 * Read an image's intrinsic size from a base64 data URL so the DOCX photo
 * keeps its aspect ratio instead of being squashed into a square.
 * Returns null when the size cannot be determined.
 */
function readBase64ImageSize(base64) {
  if (!base64 || typeof base64 !== 'string') return null;
  const raw = base64.replace(/^data:image\/[\w.+-]+;base64,/, '');
  try {
    const bin = atob(raw.slice(0, 64 * 1024));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const isPng =
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    if (isPng && bytes.length > 24) {
      // IHDR width/height are big-endian 32-bit ints at offsets 16 and 20.
      const w = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
      const h = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
      if (w > 0 && h > 0) return { width: w, height: h };
    }

    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
    if (isJpeg) {
      let offset = 2;
      while (offset + 9 < bytes.length) {
        if (bytes[offset] !== 0xff) {
          offset += 1;
          continue;
        }
        const marker = bytes[offset + 1];
        // SOF0..SOF15 (except DHT, JPG and DAC) carry the frame size.
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          const h = (bytes[offset + 5] << 8) | bytes[offset + 6];
          const w = (bytes[offset + 7] << 8) | bytes[offset + 8];
          if (w > 0 && h > 0) return { width: w, height: h };
        }
        const len = (bytes[offset + 2] << 8) | bytes[offset + 3];
        if (len <= 0) break;
        offset += 2 + len;
      }
    }
  } catch (e) {
    /* fall through to null */
  }
  return null;
}

export async function exportToDocx(resumeData, themeSettings) {
  const primaryHex = (themeSettings?.primaryColor || '#3E5566').replace('#', '');
  const secondaryHex = (themeSettings?.secondaryColor || '#56707F').replace('#', '');
  const font = themeSettings?.fontFamily?.includes('Merriweather')
    ? 'Georgia'
    : 'Calibri';

  const isSinglePage = themeSettings?.singlePage !== false;

  // Guard every optional section: a partially parsed resume must still export.
  const personalInfo = resumeData?.personalInfo || {};
  const summary = resumeData?.summary || '';
  const skills = Array.isArray(resumeData?.skills) ? resumeData.skills : [];
  const experience = Array.isArray(resumeData?.experience) ? resumeData.experience : [];
  const education = Array.isArray(resumeData?.education) ? resumeData.education : [];
  const languages = Array.isArray(resumeData?.languages) ? resumeData.languages : [];
  const certifications = Array.isArray(resumeData?.certifications) ? resumeData.certifications : [];
  const projects = Array.isArray(resumeData?.projects) ? resumeData.projects : [];
  const customSections = Array.isArray(resumeData?.customSections) ? resumeData.customSections : [];

  const docChildren = [];

  // Helper for Section Heading
  const createSectionHeading = (title) => {
    return new Paragraph({
      spacing: { before: isSinglePage ? 130 : 240, after: isSinglePage ? 40 : 100 },
      border: {
        bottom: {
          style: BorderStyle.SINGLE,
          size: 8,
          color: secondaryHex,
          space: 2,
        },
      },
      children: [
        new TextRun({
          text: title.toUpperCase(),
          bold: true,
          size: isSinglePage ? 21 : 22, // 10.5pt vs 11pt
          color: primaryHex,
          font: font,
        }),
      ],
    });
  };

  // Header Table (Photo + Info)
  const headerCells = [];

  // If photo is enabled and present
  if (personalInfo.showPhoto && personalInfo.photo) {
    const imgBytes = base64ToUint8Array(personalInfo.photo);
    if (imgBytes) {
      // Keep the photo's aspect ratio: scale the longest edge to ~100px and
      // derive the other, so a portrait shot is never stretched into a square.
      const size = readBase64ImageSize(personalInfo.photo);
      const maxEdge = 100;
      let imgW = maxEdge;
      let imgH = maxEdge;
      if (size && size.width > 0 && size.height > 0) {
        if (size.width >= size.height) {
          imgW = maxEdge;
          imgH = Math.max(1, Math.round((maxEdge * size.height) / size.width));
        } else {
          imgH = maxEdge;
          imgW = Math.max(1, Math.round((maxEdge * size.width) / size.height));
        }
      }
      headerCells.push(
        new TableCell({
          width: { size: 22, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
          },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  data: imgBytes,
                  transformation: {
                    width: imgW,
                    height: imgH,
                  },
                }),
              ],
            }),
          ],
        })
      );
    }
  }

  // Right cell: Name, Title, Contact
  const infoParagraphs = [];

  if (personalInfo.fullName) {
    infoParagraphs.push(
      new Paragraph({
        spacing: { before: 0, after: 40 },
        children: [
          new TextRun({
            text: personalInfo.fullName,
            bold: true,
            size: 34, // 17pt
            color: primaryHex,
            font: font,
          }),
        ],
      })
    );
  }

  if (personalInfo.title) {
    infoParagraphs.push(
      new Paragraph({
        spacing: { before: 0, after: 60 },
        children: [
          new TextRun({
            text: personalInfo.title,
            bold: true,
            size: 24, // 12pt
            color: secondaryHex,
            font: font,
          }),
        ],
      })
    );
  }

  // Contact info row
  const contactParts = [];
  if (personalInfo.location) contactParts.push(personalInfo.location);
  if (personalInfo.phone) contactParts.push(personalInfo.phone);
  if (personalInfo.email) contactParts.push(personalInfo.email);

  if (contactParts.length > 0) {
    infoParagraphs.push(
      new Paragraph({
        spacing: { before: 0, after: 40 },
        children: [
          new TextRun({
            text: contactParts.join('  |  '),
            size: 20, // 10pt
            color: '444444',
            font: font,
          }),
        ],
      })
    );
  }

  // Additional links or relocation badge
  const extraContact = [];
  if (personalInfo.relocation) extraContact.push(personalInfo.relocation);
  if (personalInfo.linkedin) extraContact.push(personalInfo.linkedin);
  if (personalInfo.github) extraContact.push(personalInfo.github);
  if (personalInfo.website) extraContact.push(personalInfo.website);

  if (extraContact.length > 0) {
    infoParagraphs.push(
      new Paragraph({
        spacing: { before: 0, after: 60 },
        children: [
          new TextRun({
            text: extraContact.join('  •  '),
            bold: true,
            size: 20,
            color: secondaryHex,
            font: font,
          }),
        ],
      })
    );
  }

  headerCells.push(
    new TableCell({
      width: {
        size: headerCells.length > 0 ? 78 : 100,
        type: WidthType.PERCENTAGE,
      },
      borders: {
        top: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
      },
      children: infoParagraphs,
    })
  );

  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: headerCells,
      }),
    ],
  });

  docChildren.push(headerTable);

  // 1. SUMMARY
  if (summary) {
    docChildren.push(createSectionHeading('SUMMARY'));
    docChildren.push(
      new Paragraph({
        spacing: { before: isSinglePage ? 20 : 60, after: isSinglePage ? 50 : 120 },
        children: [
          new TextRun({
            text: summary,
            size: isSinglePage ? 20 : 21, // 10pt vs 10.5pt
            color: '222222',
            font: font,
          }),
        ],
      })
    );
  }

  // 2. TECHNICAL SKILLS
  if (skills.length > 0) {
    docChildren.push(createSectionHeading('TECHNICAL SKILLS'));
    skills.forEach((skill) => {
      if (!skill.category && !skill.items) return;
      docChildren.push(
        new Paragraph({
          spacing: { before: isSinglePage ? 15 : 40, after: isSinglePage ? 15 : 40 },
          children: [
            new TextRun({
              text: `${skill.category || 'Skills'}: `,
              bold: true,
              size: isSinglePage ? 20 : 21,
              color: '111111',
              font: font,
            }),
            new TextRun({
              text: skill.items || '',
              size: isSinglePage ? 20 : 21,
              color: '222222',
              font: font,
            }),
          ],
        })
      );
    });
  }

  // 3. EXPERIENCE
  if (experience.length > 0) {
    docChildren.push(createSectionHeading('EXPERIENCE'));
    experience.forEach((exp) => {
      // Role | Company
      const roleLine = [exp.role, exp.company].filter(Boolean).join(' | ');
      if (roleLine) {
        docChildren.push(
          new Paragraph({
            spacing: { before: isSinglePage ? 40 : 100, after: 15 },
            children: [
              new TextRun({
                text: roleLine,
                bold: true,
                size: isSinglePage ? 21 : 22,
                color: primaryHex,
                font: font,
              }),
            ],
          })
        );
      }

      // Period
      if (exp.period) {
        docChildren.push(
          new Paragraph({
            spacing: { before: 0, after: 40 },
            children: [
              new TextRun({
                text: exp.period,
                italics: true,
                size: 20,
                color: secondaryHex,
                font: font,
              }),
            ],
          })
        );
      }

      // Product description
      if (exp.product) {
        docChildren.push(
          new Paragraph({
            spacing: { before: 0, after: 60 },
            children: [
              new TextRun({
                text: exp.product,
                size: 21,
                color: '333333',
                font: font,
              }),
            ],
          })
        );
      }

      // Highlights
      if (Array.isArray(exp.highlights) && exp.highlights.length > 0) {
        exp.highlights.forEach((hl) => {
          if (!hl || !String(hl).trim()) return;
          docChildren.push(
            new Paragraph({
              bullet: { level: 0 },
              spacing: { before: 20, after: 20 },
              children: [
                new TextRun({
                  text: String(hl),
                  size: 21,
                  color: '222222',
                  font: font,
                }),
              ],
            })
          );
        });
      }
    });
  }

  // 4. EDUCATION
  if (education.length > 0) {
    docChildren.push(createSectionHeading('EDUCATION'));
    education.forEach((edu) => {
      const headerLine = edu.year
        ? `${edu.school || 'Institution'} – ${edu.year}`
        : edu.school || 'Institution';

      docChildren.push(
        new Paragraph({
          spacing: { before: 80, after: 20 },
          children: [
            new TextRun({
              text: headerLine,
              bold: true,
              size: 21,
              color: '111111',
              font: font,
            }),
          ],
        })
      );

      const detailParts = [];
      if (edu.degree) detailParts.push(edu.degree);
      if (edu.score) detailParts.push(edu.score);

      if (detailParts.length > 0) {
        docChildren.push(
          new Paragraph({
            spacing: { before: 0, after: 40 },
            children: [
              new TextRun({
                text: detailParts.join(' – '),
                size: 20,
                color: '444444',
                font: font,
              }),
            ],
          })
        );
      }
    });
  }

  // 5. LANGUAGES
  if (languages.length > 0) {
    docChildren.push(createSectionHeading('LANGUAGES'));
    if (isSinglePage) {
      // Inline horizontal layout to guarantee 1-page fit
      const langRuns = [];
      languages.forEach((lang, index) => {
        langRuns.push(
          new TextRun({
            text: lang.name || '',
            bold: true,
            size: 21,
            color: '222222',
            font: font,
          })
        );
        if (lang.proficiency) {
          langRuns.push(
            new TextRun({
              text: ` (${lang.proficiency})`,
              size: 20,
              color: '666666',
              font: font,
            })
          );
        }
        if (index < languages.length - 1) {
          langRuns.push(
            new TextRun({
              text: '   •   ',
              size: 20,
              color: '888888',
              font: font,
            })
          );
        }
      });

      docChildren.push(
        new Paragraph({
          spacing: { before: 40, after: 40 },
          children: langRuns,
        })
      );
    } else {
      languages.forEach((lang) => {
        docChildren.push(
          new Paragraph({
            spacing: { before: 20, after: 20 },
            children: [
              new TextRun({
                text: lang.name,
                bold: true,
                size: 21,
                color: '222222',
                font: font,
              }),
              lang.proficiency
                ? new TextRun({
                    text: ` (${lang.proficiency})`,
                    size: 20,
                    color: '666666',
                    font: font,
                  })
                : null,
            ].filter(Boolean),
          })
        );
      });
    }
  }

  // 6. CERTIFICATIONS (if any)
  if (certifications.length > 0) {
    docChildren.push(createSectionHeading('CERTIFICATIONS'));
    certifications.forEach((cert) => {
      if (!cert.name) return;
      docChildren.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { before: 20, after: 20 },
          children: [
            new TextRun({
              text: cert.name,
              bold: true,
              size: 21,
              color: '222222',
              font: font,
            }),
            cert.issuer
              ? new TextRun({
                  text: ` – ${cert.issuer}`,
                  size: 20,
                  color: '444444',
                  font: font,
                })
              : null,
            cert.year
              ? new TextRun({
                  text: ` (${cert.year})`,
                  size: 19,
                  color: '666666',
                  font: font,
                })
              : null,
          ].filter(Boolean),
        })
      );
    });
  }

  // 7. PROJECTS
  if (projects.length > 0) {
    docChildren.push(createSectionHeading('PROJECTS'));
    projects.forEach((proj) => {
      if (!proj) return;
      const headerLine = [proj.name, proj.role].filter(Boolean).join(' | ');
      if (headerLine) {
        docChildren.push(
          new Paragraph({
            spacing: { before: isSinglePage ? 40 : 100, after: 15 },
            children: [
              new TextRun({
                text: headerLine,
                bold: true,
                size: isSinglePage ? 21 : 22,
                color: primaryHex,
                font: font,
              }),
              proj.period
                ? new TextRun({
                    text: `  ${proj.period}`,
                    italics: true,
                    size: 20,
                    color: secondaryHex,
                    font: font,
                  })
                : null,
            ].filter(Boolean),
          })
        );
      }

      if (proj.link) {
        docChildren.push(
          new Paragraph({
            spacing: { before: 0, after: 40 },
            children: [
              new TextRun({
                text: proj.link,
                size: 19,
                color: '666666',
                font: font,
              }),
            ],
          })
        );
      }

      if (Array.isArray(proj.highlights) && proj.highlights.length > 0) {
        proj.highlights.forEach((hl) => {
          if (!hl || !String(hl).trim()) return;
          docChildren.push(
            new Paragraph({
              bullet: { level: 0 },
              spacing: { before: 20, after: 20 },
              children: [
                new TextRun({
                  text: String(hl),
                  size: 21,
                  color: '222222',
                  font: font,
                }),
              ],
            })
          );
        });
      }
    });
  }

  // 8. CUSTOM SECTIONS
  if (customSections.length > 0) {
    customSections.forEach((section) => {
      if (!section || !section.title) return;
      const items = Array.isArray(section.items)
        ? section.items.filter((item) => item && String(item).trim())
        : [];
      if (items.length === 0) return;

      docChildren.push(createSectionHeading(section.title));
      items.forEach((item) => {
        docChildren.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { before: 20, after: 20 },
            children: [
              new TextRun({
                text: String(item),
                size: 21,
                color: '222222',
                font: font,
              }),
            ],
          })
        );
      });
    });
  }

  // An empty document (no photo, no name, no sections) still has to be a
  // valid .docx, so guarantee at least one child.
  if (docChildren.length === 0) {
    docChildren.push(new Paragraph({ children: [new TextRun({ text: '', font })] }));
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720, // 0.5 in
              right: 800,
              bottom: 720,
              left: 800,
            },
          },
        },
        children: docChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  // Strip everything that is not a safe filename character. A name written
  // entirely in a non-Latin script sanitises to an empty string, so fall back
  // to "Resume" rather than emitting a file called "_Resume.docx".
  const cleanName =
    (personalInfo.fullName || '')
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_]/g, '') || 'Resume';
  saveAs(blob, `${cleanName}_Resume.docx`);
}

/**
 * Export a cover letter as a .docx.
 *
 * A letter is not a resume: single column, no photo, no section headings, no
 * coloured rules. Just the standard business-letter shape — sender block,
 * date, recipient, salutation, paragraphs, sign-off — with generous 1-inch
 * margins and real paragraph spacing.
 *
 * `theme` is accepted for signature parity with exportToDocx but only its font
 * is used; the letter stays monochrome on purpose so it prints correctly on
 * letterhead and reads cleanly in an ATS.
 */
export async function exportCoverLetterToDocx(letter, resumeData, themeSettings) {
  const safeLetter = normalizeCoverLetter(letter);
  const personal =
    resumeData && typeof resumeData === 'object' && !Array.isArray(resumeData)
      ? resumeData.personalInfo || {}
      : {};

  const font = themeSettings?.fontFamily?.includes('Merriweather')
    ? 'Georgia'
    : 'Calibri';
  const name = String(personal.fullName || '').trim();
  const contact = [personal.email, personal.phone, personal.location]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean)
    .join(' · ');

  const children = [];

  /** A paragraph with the letter's standard spacing. */
  const para = (text, opts = {}) =>
    new Paragraph({
      spacing: { after: opts.after ?? 200, line: 276 },
      alignment: opts.alignment,
      children: [
        new TextRun({
          text: text ?? '',
          font,
          size: opts.size ?? 22, // half-points: 22 = 11pt
          bold: Boolean(opts.bold),
          color: opts.color ?? '222222',
        }),
      ],
    });

  // --- Sender block --------------------------------------------------------
  if (name) children.push(para(name, { bold: true, after: 40, size: 24 }));
  if (contact) children.push(para(contact, { after: 240, color: '555555' }));

  // --- Date ----------------------------------------------------------------
  children.push(para(formatLetterDate(safeLetter.date), { after: 240 }));

  // --- Recipient block -----------------------------------------------------
  if (safeLetter.hiringManager) children.push(para(safeLetter.hiringManager, { after: 20 }));
  if (safeLetter.company) children.push(para(safeLetter.company, { after: 240 }));

  // --- Salutation ----------------------------------------------------------
  children.push(
    para(
      safeLetter.hiringManager ? `Dear ${safeLetter.hiringManager},` : 'Dear Hiring Manager,',
      { after: 240 }
    )
  );

  // --- Body: one paragraph per blank-line-separated block ------------------
  const bodyParagraphs = safeLetter.body
    ? safeLetter.body
        .replace(/\r\n?/g, '\n')
        .split(/\n\s*\n/)
        .map((p) => p.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
    : [];

  if (bodyParagraphs.length === 0) {
    children.push(para('(No letter written yet.)', { after: 240 }));
  } else {
    bodyParagraphs.forEach((p) => children.push(para(p, { after: 200 })));
  }

  // --- Sign-off ------------------------------------------------------------
  children.push(para('Sincerely,', { after: 60 }));
  if (name) children.push(para(name));

  // A Document with no children is invalid; the guards above always push the
  // date and salutation, but keep the belt-and-braces check.
  if (children.length === 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: '', font })] }));
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            // 1 inch all round — standard business letter.
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const cleanName =
    name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '') || 'Cover';
  const cleanCompany = safeLetter.company
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '');
  saveAs(
    blob,
    cleanCompany ? `${cleanName}_Cover_Letter_${cleanCompany}.docx` : `${cleanName}_Cover_Letter.docx`
  );
}
