import { DEFAULT_PHOTO_URL } from '../assets/defaultPhoto.js';

// Sample data shown on first launch, before the user has saved anything.
// All values are fictional placeholders - replace them with your own details
// in the app, or load a resume from a DOCX/JSON file.
export const INITIAL_RESUME_DATA = {
  personalInfo: {
    fullName: "Alex Morgan",
    title: "QA Lead | Functional, API & Performance Testing",
    email: "alex.morgan@example.com",
    phone: "+1 555 0100",
    location: "Springfield, USA",
    relocation: "",
    linkedin: "linkedin.com/in/example-profile",
    github: "github.com/example-user",
    website: "",
    photo: DEFAULT_PHOTO_URL,
    showPhoto: true,
    photoStyle: "square-frame", // 'square-frame', 'circle', 'rounded'
  },
  summary:
    "QA Lead with 5 years of experience in software testing for enterprise web and mobile products. Led a QA team for an end-to-end Order-to-Cash automation platform, covering three mobile apps and a central web interface. Hands-on in manual functional testing, API testing (Postman, Rest Assured), performance testing (JMeter), and Selenium automation. Experienced in production L2 support, team leadership, and Agile delivery using JIRA.",
  skills: [
    {
      id: "skill-1",
      category: "Testing",
      items: "Manual functional testing, regression testing, end-to-end testing, cross-platform testing (web, Android, iOS)",
    },
    {
      id: "skill-2",
      category: "API",
      items: "Postman, Rest Assured, API response validation",
    },
    {
      id: "skill-3",
      category: "Performance",
      items: "JMeter",
    },
    {
      id: "skill-4",
      category: "Automation",
      items: "Selenium WebDriver, Java, TestNG, Python (test data and analysis tools)",
    },
    {
      id: "skill-5",
      category: "Tools",
      items: "JIRA, MantisBT, Google Apps Script, SQL",
    },
    {
      id: "skill-6",
      category: "Process",
      items: "Agile/Scrum, production L2 support, team leadership",
    },
    {
      id: "skill-7",
      category: "AI",
      items: "Generative AI for test case and script generation",
    },
  ],
  experience: [
    {
      id: "exp-1",
      role: "QA Lead",
      company: "Northwind Technologies, Austin",
      period: "April 2021 – Present",
      product: "Product: FleetWorks, an order-to-cash automation platform for logistics and field-service operations",
      highlights: [
        "Led a QA team for an end-to-end order-to-cash platform spanning three mobile apps and a central web interface.",
        "Owned test strategy and execution across manual functional, regression, and cross-platform testing for web and mobile (Android/iOS).",
        "Performed API testing using Postman and Rest Assured, and built Python tools to convert JSON responses to Excel for faster validation.",
        "Ran performance testing with JMeter to verify scalability and reliability.",
        "Built and maintained Selenium (Java, TestNG) automation scripts for critical regression scenarios on the web interface.",
        "Designed a workflow automation and reporting system using Google Apps Script and APIs, providing automated notifications and daily/weekly reports to stakeholders.",
        "Provided L2 production support after go-live and led the support team, handling escalations and driving issue resolution.",
      ],
    },
  ],
  education: [
    {
      id: "edu-1",
      school: "State University of Technology",
      degree: "Bachelor of Technology (B.Tech), Computer Science and Engineering",
      score: "CGPA: 8.00/10.00",
      year: "2015 – 2019",
    },
    {
      id: "edu-2",
      school: "Central Higher Secondary School",
      degree: "Class XII (Senior Secondary Examination)",
      score: "Aggregate 88.0%",
      year: "2015",
    },
    {
      id: "edu-3",
      school: "Riverside Public School",
      degree: "Class X (Secondary Examination)",
      score: "CGPA: 8.6/10",
      year: "2013",
    },
  ],
  languages: [
    { id: "lang-1", name: "English", proficiency: "Native" },
    { id: "lang-2", name: "Spanish", proficiency: "Professional Working" },
    { id: "lang-3", name: "Hindi", proficiency: "Professional Working" },
  ],
  certifications: [
    {
      id: "cert-1",
      name: "ISTQB Certified Tester Foundation Level",
      issuer: "ISTQB",
      year: "2021",
    },
    {
      id: "cert-2",
      name: "Selenium Automation Specialist",
      issuer: "Internal Certification",
      year: "2022",
    },
  ],
  projects: [
    {
      id: "proj-1",
      name: "Test Automation Framework",
      role: "Creator & Maintainer",
      period: "2022 – Present",
      link: "github.com/example-user/qa-framework",
      highlights: [
        "Built a Selenium + TestNG framework covering 120 regression scenarios.",
        "Cut regression run time from 6 hours to 45 minutes.",
      ],
    },
  ],
  customSections: [
    {
      id: "custom-1",
      title: "Publications",
      items: [
        "Practical API Testing with Postman - internal engineering blog, 2023",
      ],
    },
  ],
};

export const DEFAULT_THEME = {
  templateId: "classic", // Default exact match of the uploaded file!
  primaryColor: "#3E5566", // Exact heading color from original docx
  secondaryColor: "#56707F", // Exact border/subheading color from original docx
  accentColor: "#2563eb",
  fontFamily: "Calibri",
  /* A4 is the default everywhere the original document was built on A4. This
     is also the value the sheet, the @page rule and the PDF exporter read — see
     the data-paper attribute wiring in App.jsx. */
  paperSize: "a4", // 'a4' | 'letter'
  fontSize: "compact", // 'compact', 'normal', 'relaxed'
  sectionSpacing: "compact",
  singlePage: true, // 1-page fit optimization
};

export const TEMPLATES_CONFIG = [
  {
    id: "classic",
    name: "Executive Classic",
    badge: "Default (As per file)",
    description: "Original document style with framed photo, slate teal headings, and crisp dividing rules.",
    previewColor: "#3E5566",
    tag: "Original File",
  },
  {
    id: "modern",
    name: "Modern Two-Tone",
    badge: "Popular",
    description: "Sleek dual-column layout with high-contrast accent sidebar and structured timelines.",
    previewColor: "#0f766e",
    tag: "Tech & QA",
  },
  {
    id: "minimal",
    name: "Minimalist ATS Pro",
    badge: "ATS Friendly",
    description: "Ultra-clean single column layout optimized for maximum scannability and applicant tracking systems.",
    previewColor: "#1e293b",
    tag: "Corporate",
  },
  {
    id: "creative",
    name: "Emerald Horizon",
    badge: "Vibrant",
    description: "Modern top banner with gradient accents, pill badges for skills, and polished card containers.",
    previewColor: "#059669",
    tag: "Modern",
  },
  {
    id: "executive",
    name: "Nordic Luxury",
    badge: "Leadership",
    description: "Sophisticated serif typography with elegant gold/navy accents for senior roles and leadership.",
    previewColor: "#1e3a8a",
    tag: "Executive",
  },
  {
    id: "compact",
    name: "Grid Master (1-Page)",
    badge: "High Density",
    description: "Engineered to fit maximum achievements and technical depth into a balanced, crisp single page.",
    previewColor: "#4f46e5",
    tag: "Dense Layout",
  },
  {
    id: "tech",
    name: "Developer Console",
    badge: "Engineering",
    description: "Monospace accents with a left rail of skills and tools, terminal-style section labels, and a wide experience column.",
    previewColor: "#0f766e",
    tag: "Tech & SDET",
  },
  {
    id: "academic",
    name: "Academic CV",
    badge: "Research",
    description: "Dense serif single column with numbered section headings and generous line height for publications and postgrad work.",
    previewColor: "#7c2d12",
    tag: "Research",
  },
  {
    id: "startup",
    name: "Startup One-Pager",
    badge: "Compact",
    description: "Bold two-column header band with a large name, accent underline, and pill-style skills for maximum density on one page.",
    previewColor: "#ea580c",
    tag: "Startup",
  },
];
