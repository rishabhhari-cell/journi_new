// Real indexed medical journal database for Journi Platform
// Covers all major medical specialties with real journal data

import type { JournalFormattingRequirements } from '@/types';

const GRADIENTS = [
  'from-blue-800 to-blue-600',
  'from-emerald-800 to-emerald-600',
  'from-purple-800 to-purple-600',
  'from-rose-800 to-rose-600',
  'from-amber-800 to-amber-600',
  'from-teal-800 to-teal-600',
  'from-indigo-800 to-indigo-600',
  'from-pink-800 to-pink-600',
  'from-cyan-800 to-cyan-600',
  'from-orange-800 to-orange-600',
];

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter((w) => w.length > 2)
    .map((w) => w[0])
    .join('')
    .substring(0, 3)
    .toUpperCase();
}

// ============================================================================
// Formatting requirement templates by publisher style
// ============================================================================

const FMT_VANCOUVER_STRUCTURED: JournalFormattingRequirements = {
  sectionOrder: ['Abstract', 'Introduction', 'Methods', 'Results', 'Discussion', 'References'],
  wordLimits: { total: 3000, abstract: 250, title: 100 },
  abstractStructure: 'structured',
  referenceStyle: 'vancouver',
  requiresKeywords: true,
  maxKeywords: 5,
  requiresCoverLetter: true,
  requiresConflictOfInterest: true,
  requiresFundingStatement: true,
};

const FMT_NEJM: JournalFormattingRequirements = {
  sectionOrder: ['Abstract', 'Introduction', 'Methods', 'Results', 'Discussion', 'References'],
  wordLimits: { total: 2500, abstract: 250, title: 100 },
  abstractStructure: 'structured',
  referenceStyle: 'vancouver',
  requiresKeywords: false,
  requiresCoverLetter: true,
  figureLimit: 4,
  tableLimit: 3,
  requiresConflictOfInterest: true,
  requiresFundingStatement: true,
};

const FMT_LANCET: JournalFormattingRequirements = {
  sectionOrder: ['Abstract', 'Introduction', 'Methods', 'Results', 'Discussion', 'References'],
  wordLimits: { total: 3000, abstract: 300 },
  abstractStructure: 'structured',
  referenceStyle: 'vancouver',
  requiresKeywords: false,
  requiresCoverLetter: true,
  figureLimit: 5,
  tableLimit: 5,
  requiresConflictOfInterest: true,
  requiresFundingStatement: true,
  additionalSections: ['Role of the Funding Source'],
};

const FMT_JAMA: JournalFormattingRequirements = {
  sectionOrder: ['Abstract', 'Introduction', 'Methods', 'Results', 'Discussion', 'Conclusion', 'References'],
  wordLimits: { total: 3000, abstract: 350 },
  abstractStructure: 'structured',
  referenceStyle: 'ama',
  requiresKeywords: true,
  maxKeywords: 5,
  requiresCoverLetter: true,
  requiresConflictOfInterest: true,
  requiresFundingStatement: true,
  additionalSections: ['Key Points'],
};

const FMT_BMJ: JournalFormattingRequirements = {
  sectionOrder: ['Abstract', 'Introduction', 'Methods', 'Results', 'Discussion', 'Conclusion', 'References'],
  wordLimits: { total: 4000, abstract: 250 },
  abstractStructure: 'structured',
  referenceStyle: 'vancouver',
  requiresKeywords: true,
  maxKeywords: 5,
  requiresCoverLetter: true,
  requiresConflictOfInterest: true,
  requiresFundingStatement: true,
  additionalSections: ['What is Already Known', 'What This Study Adds'],
};

const FMT_ELSEVIER: JournalFormattingRequirements = {
  sectionOrder: ['Abstract', 'Introduction', 'Materials and Methods', 'Results', 'Discussion', 'Conclusion', 'References'],
  wordLimits: { total: 6000, abstract: 300 },
  abstractStructure: 'unstructured',
  referenceStyle: 'apa',
  requiresKeywords: true,
  maxKeywords: 6,
  requiresCoverLetter: true,
  requiresConflictOfInterest: true,
  requiresFundingStatement: true,
};

const FMT_ELSEVIER_STRUCTURED: JournalFormattingRequirements = {
  sectionOrder: ['Abstract', 'Introduction', 'Materials and Methods', 'Results', 'Discussion', 'Conclusion', 'References'],
  wordLimits: { total: 5000, abstract: 250 },
  abstractStructure: 'structured',
  referenceStyle: 'vancouver',
  requiresKeywords: true,
  maxKeywords: 6,
  requiresCoverLetter: true,
  requiresConflictOfInterest: true,
  requiresFundingStatement: true,
};

const FMT_SPRINGER: JournalFormattingRequirements = {
  sectionOrder: ['Abstract', 'Introduction', 'Methods', 'Results', 'Discussion', 'Conclusion', 'Declarations', 'References'],
  wordLimits: { total: 8000, abstract: 350 },
  abstractStructure: 'structured',
  referenceStyle: 'vancouver',
  requiresKeywords: true,
  maxKeywords: 5,
  requiresConflictOfInterest: true,
  requiresFundingStatement: true,
  additionalSections: ['Data Availability Statement', 'Ethics Approval'],
};

const FMT_WILEY: JournalFormattingRequirements = {
  sectionOrder: ['Abstract', 'Introduction', 'Methods', 'Results', 'Discussion', 'Conclusion', 'References'],
  wordLimits: { total: 6000, abstract: 250 },
  abstractStructure: 'unstructured',
  referenceStyle: 'apa',
  requiresKeywords: true,
  maxKeywords: 6,
  requiresCoverLetter: true,
  requiresConflictOfInterest: true,
  requiresFundingStatement: true,
};

const FMT_NATURE: JournalFormattingRequirements = {
  sectionOrder: ['Abstract', 'Introduction', 'Results', 'Discussion', 'Methods', 'References'],
  wordLimits: { total: 5000, abstract: 150 },
  abstractStructure: 'unstructured',
  referenceStyle: 'vancouver',
  requiresKeywords: false,
  requiresCoverLetter: true,
  figureLimit: 8,
  tableLimit: 3,
  requiresConflictOfInterest: true,
  requiresFundingStatement: true,
  additionalSections: ['Data Availability', 'Author Contributions'],
};

const FMT_PLOS: JournalFormattingRequirements = {
  sectionOrder: ['Abstract', 'Introduction', 'Materials and Methods', 'Results', 'Discussion', 'Conclusion', 'Supporting Information', 'References'],
  wordLimits: { abstract: 300 },
  abstractStructure: 'unstructured',
  referenceStyle: 'vancouver',
  requiresKeywords: false,
  requiresConflictOfInterest: true,
  requiresFundingStatement: true,
  additionalSections: ['Data Availability Statement', 'Author Contributions'],
};

const FMT_MDPI: JournalFormattingRequirements = {
  sectionOrder: ['Abstract', 'Introduction', 'Materials and Methods', 'Results', 'Discussion', 'Conclusion', 'References'],
  wordLimits: { abstract: 200 },
  abstractStructure: 'unstructured',
  referenceStyle: 'vancouver',
  requiresKeywords: true,
  maxKeywords: 5,
  requiresConflictOfInterest: true,
  requiresFundingStatement: true,
  additionalSections: ['Data Availability Statement', 'Author Contributions'],
};

const FMT_FRONTIERS: JournalFormattingRequirements = {
  sectionOrder: ['Abstract', 'Introduction', 'Materials and Methods', 'Results', 'Discussion', 'Conclusion', 'Data Availability Statement', 'References'],
  wordLimits: { total: 12000, abstract: 350 },
  abstractStructure: 'unstructured',
  referenceStyle: 'vancouver',
  requiresKeywords: true,
  maxKeywords: 8,
  requiresConflictOfInterest: true,
  requiresFundingStatement: true,
  additionalSections: ['Ethics Statement', 'Author Contributions'],
};

const FMT_OUP: JournalFormattingRequirements = {
  sectionOrder: ['Abstract', 'Introduction', 'Methods', 'Results', 'Discussion', 'Conclusion', 'References'],
  wordLimits: { total: 5000, abstract: 250 },
  abstractStructure: 'structured',
  referenceStyle: 'vancouver',
  requiresKeywords: true,
  maxKeywords: 6,
  requiresCoverLetter: true,
  requiresConflictOfInterest: true,
  requiresFundingStatement: true,
};

const FMT_TAYLOR_FRANCIS: JournalFormattingRequirements = {
  sectionOrder: ['Abstract', 'Introduction', 'Methods', 'Results', 'Discussion', 'Conclusion', 'References'],
  wordLimits: { total: 7000, abstract: 300 },
  abstractStructure: 'unstructured',
  referenceStyle: 'apa',
  requiresKeywords: true,
  maxKeywords: 6,
  requiresCoverLetter: true,
  requiresConflictOfInterest: true,
  requiresFundingStatement: true,
};

const FMT_SAGE: JournalFormattingRequirements = {
  sectionOrder: ['Abstract', 'Introduction', 'Methods', 'Results', 'Discussion', 'Conclusion', 'References'],
  wordLimits: { total: 6000, abstract: 250 },
  abstractStructure: 'unstructured',
  referenceStyle: 'apa',
  requiresKeywords: true,
  maxKeywords: 5,
  requiresCoverLetter: true,
  requiresConflictOfInterest: true,
  requiresFundingStatement: true,
};

const FMT_BIOMED_CENTRAL: JournalFormattingRequirements = {
  sectionOrder: ['Abstract', 'Background', 'Methods', 'Results', 'Discussion', 'Conclusion', 'Declarations', 'References'],
  wordLimits: { abstract: 350 },
  abstractStructure: 'structured',
  referenceStyle: 'vancouver',
  requiresKeywords: true,
  maxKeywords: 5,
  requiresConflictOfInterest: true,
  requiresFundingStatement: true,
  additionalSections: ['Ethics Approval', 'Data Availability'],
};

const FMT_WOLTERS_KLUWER: JournalFormattingRequirements = {
  sectionOrder: ['Abstract', 'Introduction', 'Methods', 'Results', 'Discussion', 'Conclusion', 'References'],
  wordLimits: { total: 5000, abstract: 250 },
  abstractStructure: 'structured',
  referenceStyle: 'vancouver',
  requiresKeywords: true,
  maxKeywords: 5,
  requiresCoverLetter: true,
  requiresConflictOfInterest: true,
  requiresFundingStatement: true,
};

const FMT_CUP: JournalFormattingRequirements = {
  sectionOrder: ['Abstract', 'Introduction', 'Methods', 'Results', 'Discussion', 'Conclusion', 'References'],
  wordLimits: { total: 6000, abstract: 250 },
  abstractStructure: 'unstructured',
  referenceStyle: 'harvard',
  requiresKeywords: true,
  maxKeywords: 6,
  requiresCoverLetter: true,
  requiresConflictOfInterest: true,
  requiresFundingStatement: true,
};

// ============================================================================
// Raw journal data — real indexed medical journals
// ============================================================================

interface RawJournalEntry {
  name: string;
  issn: string;
  impactFactor: number;
  acceptanceRate: number;
  publisher: string;
  subjectAreas: string[];
  geographicLocation: string;
  website: string;
  openAccess: boolean;
  avgDecisionDays: number;
  formattingRequirements: JournalFormattingRequirements;
}

const RAW_JOURNALS: RawJournalEntry[] = [
  // ========== GENERAL / INTERNAL MEDICINE ==========
  { name: 'The New England Journal of Medicine', issn: '0028-4793', impactFactor: 176.1, acceptanceRate: 5, publisher: 'Massachusetts Medical Society', subjectAreas: ['Medicine', 'Clinical Research'], geographicLocation: 'United States', website: 'https://www.nejm.org', openAccess: false, avgDecisionDays: 14, formattingRequirements: FMT_NEJM },
  { name: 'The Lancet', issn: '0140-6736', impactFactor: 168.9, acceptanceRate: 5, publisher: 'Elsevier', subjectAreas: ['Medicine', 'Clinical Research'], geographicLocation: 'United Kingdom', website: 'https://www.thelancet.com', openAccess: false, avgDecisionDays: 21, formattingRequirements: FMT_LANCET },
  { name: 'JAMA', issn: '0098-7484', impactFactor: 120.7, acceptanceRate: 5, publisher: 'American Medical Association', subjectAreas: ['Medicine', 'Clinical Research'], geographicLocation: 'United States', website: 'https://jamanetwork.com/journals/jama', openAccess: false, avgDecisionDays: 18, formattingRequirements: FMT_JAMA },
  { name: 'The BMJ', issn: '0959-8138', impactFactor: 105.7, acceptanceRate: 7, publisher: 'BMJ Publishing Group', subjectAreas: ['Medicine', 'Clinical Research', 'Public Health'], geographicLocation: 'United Kingdom', website: 'https://www.bmj.com', openAccess: false, avgDecisionDays: 28, formattingRequirements: FMT_BMJ },
  { name: 'Nature Medicine', issn: '1078-8956', impactFactor: 82.9, acceptanceRate: 8, publisher: 'Nature Publishing Group', subjectAreas: ['Medicine', 'Translational Medicine', 'Molecular Biology'], geographicLocation: 'United Kingdom', website: 'https://www.nature.com/nm', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_NATURE },
  { name: 'Annals of Internal Medicine', issn: '0003-4819', impactFactor: 51.8, acceptanceRate: 8, publisher: 'American College of Physicians', subjectAreas: ['Medicine', 'Clinical Research'], geographicLocation: 'United States', website: 'https://www.acpjournals.org/journal/aim', openAccess: false, avgDecisionDays: 25, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'PLOS Medicine', issn: '1549-1676', impactFactor: 15.8, acceptanceRate: 12, publisher: 'PLOS', subjectAreas: ['Medicine', 'Public Health', 'Clinical Research'], geographicLocation: 'United States', website: 'https://journals.plos.org/plosmedicine', openAccess: true, avgDecisionDays: 45, formattingRequirements: FMT_PLOS },
  { name: 'Mayo Clinic Proceedings', issn: '0025-6196', impactFactor: 8.9, acceptanceRate: 15, publisher: 'Elsevier', subjectAreas: ['Medicine', 'Clinical Research'], geographicLocation: 'United States', website: 'https://www.mayoclinicproceedings.org', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_ELSEVIER },
  { name: 'JAMA Internal Medicine', issn: '2168-6106', impactFactor: 39.3, acceptanceRate: 7, publisher: 'American Medical Association', subjectAreas: ['Medicine', 'Clinical Research'], geographicLocation: 'United States', website: 'https://jamanetwork.com/journals/jamainternalmedicine', openAccess: false, avgDecisionDays: 22, formattingRequirements: FMT_JAMA },
  { name: 'The Lancet Global Health', issn: '2214-109X', impactFactor: 34.3, acceptanceRate: 6, publisher: 'Elsevier', subjectAreas: ['Public Health', 'Medicine', 'Epidemiology'], geographicLocation: 'United Kingdom', website: 'https://www.thelancet.com/journals/langlo', openAccess: true, avgDecisionDays: 30, formattingRequirements: FMT_LANCET },
  { name: 'Canadian Medical Association Journal', issn: '0820-3946', impactFactor: 9.6, acceptanceRate: 12, publisher: 'CMA Impact', subjectAreas: ['Medicine', 'Clinical Research'], geographicLocation: 'International', website: 'https://www.cmaj.ca', openAccess: true, avgDecisionDays: 35, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Medical Journal of Australia', issn: '0025-729X', impactFactor: 7.2, acceptanceRate: 15, publisher: 'Wiley', subjectAreas: ['Medicine', 'Clinical Research'], geographicLocation: 'Australia', website: 'https://www.mja.com.au', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_WILEY },
  { name: 'European Journal of Internal Medicine', issn: '0953-6205', impactFactor: 8.0, acceptanceRate: 20, publisher: 'Elsevier', subjectAreas: ['Medicine', 'Clinical Research'], geographicLocation: 'Europe', website: 'https://www.ejinme.com', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_ELSEVIER },
  { name: 'Journal of Internal Medicine', issn: '0954-6820', impactFactor: 11.1, acceptanceRate: 18, publisher: 'Wiley', subjectAreas: ['Medicine', 'Clinical Research'], geographicLocation: 'Europe', website: 'https://onlinelibrary.wiley.com/journal/13652796', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_WILEY },
  { name: 'BMC Medicine', issn: '1741-7015', impactFactor: 9.3, acceptanceRate: 10, publisher: 'BioMed Central', subjectAreas: ['Medicine', 'Clinical Research'], geographicLocation: 'United Kingdom', website: 'https://bmcmedicine.biomedcentral.com', openAccess: true, avgDecisionDays: 40, formattingRequirements: FMT_BIOMED_CENTRAL },

  // ========== ONCOLOGY ==========
  { name: 'CA: A Cancer Journal for Clinicians', issn: '0007-9235', impactFactor: 254.7, acceptanceRate: 4, publisher: 'Wiley', subjectAreas: ['Oncology', 'Medicine'], geographicLocation: 'United States', website: 'https://acsjournals.onlinelibrary.wiley.com/journal/15424863', openAccess: false, avgDecisionDays: 14, formattingRequirements: FMT_WILEY },
  { name: 'The Lancet Oncology', issn: '1470-2045', impactFactor: 51.1, acceptanceRate: 6, publisher: 'Elsevier', subjectAreas: ['Oncology', 'Medicine'], geographicLocation: 'United Kingdom', website: 'https://www.thelancet.com/journals/lanonc', openAccess: false, avgDecisionDays: 25, formattingRequirements: FMT_LANCET },
  { name: 'Journal of Clinical Oncology', issn: '0732-183X', impactFactor: 45.3, acceptanceRate: 10, publisher: 'American Society of Clinical Oncology', subjectAreas: ['Oncology', 'Clinical Research'], geographicLocation: 'United States', website: 'https://ascopubs.org/journal/jco', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Nature Reviews Cancer', issn: '1474-175X', impactFactor: 78.5, acceptanceRate: 8, publisher: 'Nature Publishing Group', subjectAreas: ['Oncology', 'Molecular Biology'], geographicLocation: 'United Kingdom', website: 'https://www.nature.com/nrc', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_NATURE },
  { name: 'Cancer Cell', issn: '1535-6108', impactFactor: 50.3, acceptanceRate: 8, publisher: 'Cell Press', subjectAreas: ['Oncology', 'Cell Biology', 'Molecular Biology'], geographicLocation: 'United States', website: 'https://www.cell.com/cancer-cell', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_NATURE },
  { name: 'Cancer Discovery', issn: '2159-8274', impactFactor: 29.7, acceptanceRate: 10, publisher: 'American Association for Cancer Research', subjectAreas: ['Oncology', 'Translational Medicine'], geographicLocation: 'United States', website: 'https://cancerdiscovery.aacrjournals.org', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Cancer Research', issn: '0008-5472', impactFactor: 12.7, acceptanceRate: 15, publisher: 'American Association for Cancer Research', subjectAreas: ['Oncology', 'Molecular Biology'], geographicLocation: 'United States', website: 'https://cancerres.aacrjournals.org', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'JAMA Oncology', issn: '2374-2437', impactFactor: 33.0, acceptanceRate: 8, publisher: 'American Medical Association', subjectAreas: ['Oncology', 'Clinical Research'], geographicLocation: 'United States', website: 'https://jamanetwork.com/journals/jamaoncology', openAccess: false, avgDecisionDays: 22, formattingRequirements: FMT_JAMA },
  { name: 'Annals of Oncology', issn: '0923-7534', impactFactor: 32.0, acceptanceRate: 12, publisher: 'Elsevier', subjectAreas: ['Oncology', 'Clinical Research'], geographicLocation: 'Europe', website: 'https://www.annalsofoncology.org', openAccess: false, avgDecisionDays: 28, formattingRequirements: FMT_ELSEVIER_STRUCTURED },
  { name: 'Clinical Cancer Research', issn: '1078-0432', impactFactor: 11.5, acceptanceRate: 15, publisher: 'American Association for Cancer Research', subjectAreas: ['Oncology', 'Clinical Research', 'Translational Medicine'], geographicLocation: 'United States', website: 'https://clincancerres.aacrjournals.org', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'European Journal of Cancer', issn: '0959-8049', impactFactor: 8.4, acceptanceRate: 18, publisher: 'Elsevier', subjectAreas: ['Oncology', 'Clinical Research'], geographicLocation: 'Europe', website: 'https://www.ejcancer.com', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_ELSEVIER },
  { name: 'British Journal of Cancer', issn: '0007-0920', impactFactor: 8.8, acceptanceRate: 20, publisher: 'Nature Publishing Group', subjectAreas: ['Oncology'], geographicLocation: 'United Kingdom', website: 'https://www.nature.com/bjc', openAccess: true, avgDecisionDays: 35, formattingRequirements: FMT_NATURE },
  { name: 'International Journal of Cancer', issn: '0020-7136', impactFactor: 7.3, acceptanceRate: 22, publisher: 'Wiley', subjectAreas: ['Oncology', 'Molecular Biology'], geographicLocation: 'International', website: 'https://onlinelibrary.wiley.com/journal/10970215', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_WILEY },
  { name: 'Cancers', issn: '2072-6694', impactFactor: 5.2, acceptanceRate: 35, publisher: 'MDPI', subjectAreas: ['Oncology'], geographicLocation: 'Switzerland', website: 'https://www.mdpi.com/journal/cancers', openAccess: true, avgDecisionDays: 30, formattingRequirements: FMT_MDPI },
  { name: 'Frontiers in Oncology', issn: '2234-943X', impactFactor: 4.7, acceptanceRate: 38, publisher: 'Frontiers Media', subjectAreas: ['Oncology'], geographicLocation: 'Switzerland', website: 'https://www.frontiersin.org/journals/oncology', openAccess: true, avgDecisionDays: 45, formattingRequirements: FMT_FRONTIERS },
  { name: 'BMC Cancer', issn: '1471-2407', impactFactor: 4.0, acceptanceRate: 40, publisher: 'BioMed Central', subjectAreas: ['Oncology', 'Clinical Research'], geographicLocation: 'United Kingdom', website: 'https://bmccancer.biomedcentral.com', openAccess: true, avgDecisionDays: 45, formattingRequirements: FMT_BIOMED_CENTRAL },

  // ========== CARDIOLOGY ==========
  { name: 'European Heart Journal', issn: '0195-668X', impactFactor: 39.3, acceptanceRate: 10, publisher: 'Oxford University Press', subjectAreas: ['Cardiology', 'Medicine'], geographicLocation: 'Europe', website: 'https://academic.oup.com/eurheartj', openAccess: false, avgDecisionDays: 20, formattingRequirements: FMT_OUP },
  { name: 'Circulation', issn: '0009-7322', impactFactor: 37.8, acceptanceRate: 10, publisher: 'American Heart Association', subjectAreas: ['Cardiology', 'Medicine'], geographicLocation: 'United States', website: 'https://www.ahajournals.org/journal/circ', openAccess: false, avgDecisionDays: 21, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Journal of the American College of Cardiology', issn: '0735-1097', impactFactor: 24.0, acceptanceRate: 10, publisher: 'Elsevier', subjectAreas: ['Cardiology', 'Clinical Research'], geographicLocation: 'United States', website: 'https://www.jacc.org', openAccess: false, avgDecisionDays: 25, formattingRequirements: FMT_ELSEVIER_STRUCTURED },
  { name: 'Nature Reviews Cardiology', issn: '1759-5002', impactFactor: 41.7, acceptanceRate: 8, publisher: 'Nature Publishing Group', subjectAreas: ['Cardiology'], geographicLocation: 'United Kingdom', website: 'https://www.nature.com/nrcardio', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_NATURE },
  { name: 'Circulation Research', issn: '0009-7330', impactFactor: 20.1, acceptanceRate: 12, publisher: 'American Heart Association', subjectAreas: ['Cardiology', 'Molecular Biology'], geographicLocation: 'United States', website: 'https://www.ahajournals.org/journal/res', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'JAMA Cardiology', issn: '2380-6583', impactFactor: 24.7, acceptanceRate: 8, publisher: 'American Medical Association', subjectAreas: ['Cardiology', 'Clinical Research'], geographicLocation: 'United States', website: 'https://jamanetwork.com/journals/jamacardiology', openAccess: false, avgDecisionDays: 20, formattingRequirements: FMT_JAMA },
  { name: 'Heart', issn: '1355-6037', impactFactor: 6.1, acceptanceRate: 18, publisher: 'BMJ Publishing Group', subjectAreas: ['Cardiology', 'Clinical Research'], geographicLocation: 'United Kingdom', website: 'https://heart.bmj.com', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_BMJ },
  { name: 'American Heart Journal', issn: '0002-8703', impactFactor: 4.5, acceptanceRate: 25, publisher: 'Elsevier', subjectAreas: ['Cardiology', 'Clinical Research'], geographicLocation: 'United States', website: 'https://www.ahjonline.com', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_ELSEVIER },
  { name: 'International Journal of Cardiology', issn: '0167-5273', impactFactor: 3.5, acceptanceRate: 30, publisher: 'Elsevier', subjectAreas: ['Cardiology'], geographicLocation: 'International', website: 'https://www.internationaljournalofcardiology.com', openAccess: false, avgDecisionDays: 45, formattingRequirements: FMT_ELSEVIER },
  { name: 'Frontiers in Cardiovascular Medicine', issn: '2297-055X', impactFactor: 3.6, acceptanceRate: 38, publisher: 'Frontiers Media', subjectAreas: ['Cardiology'], geographicLocation: 'Switzerland', website: 'https://www.frontiersin.org/journals/cardiovascular-medicine', openAccess: true, avgDecisionDays: 45, formattingRequirements: FMT_FRONTIERS },

  // ========== NEUROSCIENCE / NEUROLOGY ==========
  { name: 'Nature Neuroscience', issn: '1097-6256', impactFactor: 25.0, acceptanceRate: 8, publisher: 'Nature Publishing Group', subjectAreas: ['Neuroscience', 'Molecular Biology'], geographicLocation: 'United States', website: 'https://www.nature.com/neuro', openAccess: false, avgDecisionDays: 28, formattingRequirements: FMT_NATURE },
  { name: 'Neuron', issn: '0896-6273', impactFactor: 16.2, acceptanceRate: 10, publisher: 'Cell Press', subjectAreas: ['Neuroscience', 'Cell Biology'], geographicLocation: 'United States', website: 'https://www.cell.com/neuron', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_NATURE },
  { name: 'The Lancet Neurology', issn: '1474-4422', impactFactor: 46.4, acceptanceRate: 5, publisher: 'Elsevier', subjectAreas: ['Neurology', 'Neuroscience', 'Clinical Research'], geographicLocation: 'United Kingdom', website: 'https://www.thelancet.com/journals/laneur', openAccess: false, avgDecisionDays: 25, formattingRequirements: FMT_LANCET },
  { name: 'Brain', issn: '0006-8950', impactFactor: 14.5, acceptanceRate: 12, publisher: 'Oxford University Press', subjectAreas: ['Neurology', 'Neuroscience'], geographicLocation: 'United Kingdom', website: 'https://academic.oup.com/brain', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_OUP },
  { name: 'Annals of Neurology', issn: '0364-5134', impactFactor: 11.2, acceptanceRate: 15, publisher: 'Wiley', subjectAreas: ['Neurology', 'Neuroscience', 'Clinical Research'], geographicLocation: 'United States', website: 'https://onlinelibrary.wiley.com/journal/15318249', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_WILEY },
  { name: 'JAMA Neurology', issn: '2168-6149', impactFactor: 29.0, acceptanceRate: 7, publisher: 'American Medical Association', subjectAreas: ['Neurology', 'Clinical Research'], geographicLocation: 'United States', website: 'https://jamanetwork.com/journals/jamaneurology', openAccess: false, avgDecisionDays: 22, formattingRequirements: FMT_JAMA },
  { name: 'Neurology', issn: '0028-3878', impactFactor: 9.9, acceptanceRate: 15, publisher: 'Wolters Kluwer', subjectAreas: ['Neurology', 'Clinical Research'], geographicLocation: 'United States', website: 'https://www.neurology.org', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_WOLTERS_KLUWER },
  { name: 'Journal of Neuroscience', issn: '0270-6474', impactFactor: 5.3, acceptanceRate: 22, publisher: 'Society for Neuroscience', subjectAreas: ['Neuroscience'], geographicLocation: 'United States', website: 'https://www.jneurosci.org', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Frontiers in Neuroscience', issn: '1662-453X', impactFactor: 4.3, acceptanceRate: 35, publisher: 'Frontiers Media', subjectAreas: ['Neuroscience'], geographicLocation: 'Switzerland', website: 'https://www.frontiersin.org/journals/neuroscience', openAccess: true, avgDecisionDays: 50, formattingRequirements: FMT_FRONTIERS },
  { name: 'NeuroImage', issn: '1053-8119', impactFactor: 5.7, acceptanceRate: 25, publisher: 'Elsevier', subjectAreas: ['Neuroscience', 'Radiology'], geographicLocation: 'United States', website: 'https://www.journals.elsevier.com/neuroimage', openAccess: false, avgDecisionDays: 45, formattingRequirements: FMT_ELSEVIER },
  { name: 'Multiple Sclerosis Journal', issn: '1352-4585', impactFactor: 6.4, acceptanceRate: 20, publisher: 'SAGE Publications', subjectAreas: ['Neurology', 'Immunology'], geographicLocation: 'United Kingdom', website: 'https://journals.sagepub.com/home/msj', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_SAGE },
  { name: 'Epilepsia', issn: '0013-9580', impactFactor: 6.6, acceptanceRate: 22, publisher: 'Wiley', subjectAreas: ['Neurology', 'Clinical Research'], geographicLocation: 'United States', website: 'https://onlinelibrary.wiley.com/journal/15281167', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_WILEY },

  // ========== SURGERY ==========
  { name: 'Annals of Surgery', issn: '0003-4932', impactFactor: 11.3, acceptanceRate: 12, publisher: 'Wolters Kluwer', subjectAreas: ['Surgery', 'Clinical Research'], geographicLocation: 'United States', website: 'https://journals.lww.com/annalsofsurgery', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_WOLTERS_KLUWER },
  { name: 'JAMA Surgery', issn: '2168-6254', impactFactor: 16.9, acceptanceRate: 8, publisher: 'American Medical Association', subjectAreas: ['Surgery', 'Clinical Research'], geographicLocation: 'United States', website: 'https://jamanetwork.com/journals/jamasurgery', openAccess: false, avgDecisionDays: 22, formattingRequirements: FMT_JAMA },
  { name: 'British Journal of Surgery', issn: '0007-1323', impactFactor: 8.6, acceptanceRate: 15, publisher: 'Oxford University Press', subjectAreas: ['Surgery', 'Clinical Research'], geographicLocation: 'United Kingdom', website: 'https://academic.oup.com/bjs', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_OUP },
  { name: 'Surgery', issn: '0039-6060', impactFactor: 3.7, acceptanceRate: 25, publisher: 'Elsevier', subjectAreas: ['Surgery'], geographicLocation: 'United States', website: 'https://www.journals.elsevier.com/surgery', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_ELSEVIER },
  { name: 'Journal of the American College of Surgeons', issn: '1072-7515', impactFactor: 5.9, acceptanceRate: 18, publisher: 'Elsevier', subjectAreas: ['Surgery', 'Clinical Research'], geographicLocation: 'United States', website: 'https://www.journalacs.org', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_ELSEVIER },
  { name: 'World Journal of Surgery', issn: '0364-2313', impactFactor: 2.7, acceptanceRate: 30, publisher: 'Springer Nature', subjectAreas: ['Surgery'], geographicLocation: 'International', website: 'https://link.springer.com/journal/268', openAccess: false, avgDecisionDays: 50, formattingRequirements: FMT_SPRINGER },
  { name: 'Surgical Endoscopy', issn: '0930-2794', impactFactor: 3.5, acceptanceRate: 28, publisher: 'Springer Nature', subjectAreas: ['Surgery'], geographicLocation: 'International', website: 'https://link.springer.com/journal/464', openAccess: false, avgDecisionDays: 45, formattingRequirements: FMT_SPRINGER },

  // ========== PEDIATRICS ==========
  { name: 'Pediatrics', issn: '0031-4005', impactFactor: 8.0, acceptanceRate: 12, publisher: 'American Academy of Pediatrics', subjectAreas: ['Pediatrics', 'Medicine'], geographicLocation: 'United States', website: 'https://publications.aap.org/pediatrics', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'JAMA Pediatrics', issn: '2168-6203', impactFactor: 26.1, acceptanceRate: 7, publisher: 'American Medical Association', subjectAreas: ['Pediatrics', 'Clinical Research'], geographicLocation: 'United States', website: 'https://jamanetwork.com/journals/jamapediatrics', openAccess: false, avgDecisionDays: 22, formattingRequirements: FMT_JAMA },
  { name: 'The Lancet Child & Adolescent Health', issn: '2352-4642', impactFactor: 19.9, acceptanceRate: 8, publisher: 'Elsevier', subjectAreas: ['Pediatrics', 'Public Health'], geographicLocation: 'United Kingdom', website: 'https://www.thelancet.com/journals/lanchi', openAccess: false, avgDecisionDays: 25, formattingRequirements: FMT_LANCET },
  { name: 'Journal of Pediatrics', issn: '0022-3476', impactFactor: 3.7, acceptanceRate: 20, publisher: 'Elsevier', subjectAreas: ['Pediatrics'], geographicLocation: 'United States', website: 'https://www.jpeds.com', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_ELSEVIER },
  { name: 'Archives of Disease in Childhood', issn: '0003-9888', impactFactor: 4.7, acceptanceRate: 18, publisher: 'BMJ Publishing Group', subjectAreas: ['Pediatrics', 'Clinical Research'], geographicLocation: 'United Kingdom', website: 'https://adc.bmj.com', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_BMJ },
  { name: 'Pediatric Research', issn: '0031-3998', impactFactor: 3.1, acceptanceRate: 25, publisher: 'Nature Publishing Group', subjectAreas: ['Pediatrics', 'Clinical Research'], geographicLocation: 'International', website: 'https://www.nature.com/pr', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_NATURE },

  // ========== PSYCHIATRY ==========
  { name: 'JAMA Psychiatry', issn: '2168-622X', impactFactor: 25.8, acceptanceRate: 7, publisher: 'American Medical Association', subjectAreas: ['Psychiatry', 'Clinical Research'], geographicLocation: 'United States', website: 'https://jamanetwork.com/journals/jamapsychiatry', openAccess: false, avgDecisionDays: 22, formattingRequirements: FMT_JAMA },
  { name: 'The Lancet Psychiatry', issn: '2215-0366', impactFactor: 30.8, acceptanceRate: 6, publisher: 'Elsevier', subjectAreas: ['Psychiatry', 'Clinical Research'], geographicLocation: 'United Kingdom', website: 'https://www.thelancet.com/journals/lanpsy', openAccess: false, avgDecisionDays: 25, formattingRequirements: FMT_LANCET },
  { name: 'American Journal of Psychiatry', issn: '0002-953X', impactFactor: 18.1, acceptanceRate: 10, publisher: 'American Psychiatric Association', subjectAreas: ['Psychiatry', 'Clinical Research'], geographicLocation: 'United States', website: 'https://ajp.psychiatryonline.org', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Molecular Psychiatry', issn: '1359-4184', impactFactor: 11.0, acceptanceRate: 12, publisher: 'Nature Publishing Group', subjectAreas: ['Psychiatry', 'Molecular Biology', 'Neuroscience'], geographicLocation: 'United Kingdom', website: 'https://www.nature.com/mp', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_NATURE },
  { name: 'British Journal of Psychiatry', issn: '0007-1250', impactFactor: 8.7, acceptanceRate: 15, publisher: 'Cambridge University Press', subjectAreas: ['Psychiatry', 'Clinical Research'], geographicLocation: 'United Kingdom', website: 'https://www.cambridge.org/core/journals/the-british-journal-of-psychiatry', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_CUP },
  { name: 'Psychological Medicine', issn: '0033-2917', impactFactor: 6.9, acceptanceRate: 18, publisher: 'Cambridge University Press', subjectAreas: ['Psychiatry', 'Psychology'], geographicLocation: 'United Kingdom', website: 'https://www.cambridge.org/core/journals/psychological-medicine', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_CUP },
  { name: 'Frontiers in Psychiatry', issn: '1664-0640', impactFactor: 4.7, acceptanceRate: 38, publisher: 'Frontiers Media', subjectAreas: ['Psychiatry'], geographicLocation: 'Switzerland', website: 'https://www.frontiersin.org/journals/psychiatry', openAccess: true, avgDecisionDays: 50, formattingRequirements: FMT_FRONTIERS },

  // ========== GASTROENTEROLOGY ==========
  { name: 'Gastroenterology', issn: '0016-5085', impactFactor: 29.4, acceptanceRate: 10, publisher: 'Elsevier', subjectAreas: ['Gastroenterology', 'Medicine'], geographicLocation: 'United States', website: 'https://www.gastrojournal.org', openAccess: false, avgDecisionDays: 25, formattingRequirements: FMT_ELSEVIER_STRUCTURED },
  { name: 'Gut', issn: '0017-5749', impactFactor: 24.5, acceptanceRate: 10, publisher: 'BMJ Publishing Group', subjectAreas: ['Gastroenterology', 'Medicine'], geographicLocation: 'United Kingdom', website: 'https://gut.bmj.com', openAccess: false, avgDecisionDays: 25, formattingRequirements: FMT_BMJ },
  { name: 'The Lancet Gastroenterology & Hepatology', issn: '2468-1253', impactFactor: 35.7, acceptanceRate: 6, publisher: 'Elsevier', subjectAreas: ['Gastroenterology', 'Clinical Research'], geographicLocation: 'United Kingdom', website: 'https://www.thelancet.com/journals/langas', openAccess: false, avgDecisionDays: 25, formattingRequirements: FMT_LANCET },
  { name: 'Hepatology', issn: '0270-9139', impactFactor: 12.9, acceptanceRate: 15, publisher: 'Wolters Kluwer', subjectAreas: ['Gastroenterology', 'Medicine'], geographicLocation: 'United States', website: 'https://journals.lww.com/hep', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_WOLTERS_KLUWER },
  { name: 'American Journal of Gastroenterology', issn: '0002-9270', impactFactor: 9.4, acceptanceRate: 18, publisher: 'Wolters Kluwer', subjectAreas: ['Gastroenterology', 'Clinical Research'], geographicLocation: 'United States', website: 'https://journals.lww.com/ajg', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_WOLTERS_KLUWER },
  { name: 'Journal of Hepatology', issn: '0168-8278', impactFactor: 25.7, acceptanceRate: 10, publisher: 'Elsevier', subjectAreas: ['Gastroenterology', 'Medicine'], geographicLocation: 'Europe', website: 'https://www.journal-of-hepatology.eu', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_ELSEVIER_STRUCTURED },
  { name: 'Alimentary Pharmacology & Therapeutics', issn: '0269-2813', impactFactor: 7.6, acceptanceRate: 20, publisher: 'Wiley', subjectAreas: ['Gastroenterology', 'Pharmacology'], geographicLocation: 'United Kingdom', website: 'https://onlinelibrary.wiley.com/journal/13652036', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_WILEY },

  // ========== ENDOCRINOLOGY ==========
  { name: 'The Lancet Diabetes & Endocrinology', issn: '2213-8587', impactFactor: 44.9, acceptanceRate: 6, publisher: 'Elsevier', subjectAreas: ['Endocrinology', 'Medicine'], geographicLocation: 'United Kingdom', website: 'https://www.thelancet.com/journals/landia', openAccess: false, avgDecisionDays: 25, formattingRequirements: FMT_LANCET },
  { name: 'Diabetes Care', issn: '0149-5992', impactFactor: 16.2, acceptanceRate: 12, publisher: 'American Diabetes Association', subjectAreas: ['Endocrinology', 'Clinical Research'], geographicLocation: 'United States', website: 'https://diabetesjournals.org/care', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Diabetologia', issn: '0012-186X', impactFactor: 8.2, acceptanceRate: 18, publisher: 'Springer Nature', subjectAreas: ['Endocrinology', 'Medicine'], geographicLocation: 'Europe', website: 'https://link.springer.com/journal/125', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_SPRINGER },
  { name: 'Diabetes', issn: '0012-1797', impactFactor: 7.7, acceptanceRate: 18, publisher: 'American Diabetes Association', subjectAreas: ['Endocrinology', 'Molecular Biology'], geographicLocation: 'United States', website: 'https://diabetesjournals.org/diabetes', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Journal of Clinical Endocrinology and Metabolism', issn: '0021-972X', impactFactor: 5.8, acceptanceRate: 20, publisher: 'Oxford University Press', subjectAreas: ['Endocrinology', 'Clinical Research'], geographicLocation: 'United States', website: 'https://academic.oup.com/jcem', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_OUP },
  { name: 'Thyroid', issn: '1050-7256', impactFactor: 5.7, acceptanceRate: 22, publisher: 'Mary Ann Liebert', subjectAreas: ['Endocrinology'], geographicLocation: 'United States', website: 'https://www.liebertpub.com/journal/thy', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_VANCOUVER_STRUCTURED },

  // ========== IMMUNOLOGY ==========
  { name: 'Nature Immunology', issn: '1529-2908', impactFactor: 30.5, acceptanceRate: 8, publisher: 'Nature Publishing Group', subjectAreas: ['Immunology', 'Molecular Biology'], geographicLocation: 'United States', website: 'https://www.nature.com/ni', openAccess: false, avgDecisionDays: 28, formattingRequirements: FMT_NATURE },
  { name: 'Immunity', issn: '1074-7613', impactFactor: 32.4, acceptanceRate: 8, publisher: 'Cell Press', subjectAreas: ['Immunology', 'Cell Biology'], geographicLocation: 'United States', website: 'https://www.cell.com/immunity', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_NATURE },
  { name: 'Nature Reviews Immunology', issn: '1474-1733', impactFactor: 100.3, acceptanceRate: 5, publisher: 'Nature Publishing Group', subjectAreas: ['Immunology'], geographicLocation: 'United Kingdom', website: 'https://www.nature.com/nri', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_NATURE },
  { name: 'Journal of Allergy and Clinical Immunology', issn: '0091-6749', impactFactor: 14.2, acceptanceRate: 12, publisher: 'Elsevier', subjectAreas: ['Immunology', 'Clinical Research'], geographicLocation: 'United States', website: 'https://www.jacionline.org', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_ELSEVIER_STRUCTURED },
  { name: 'Journal of Experimental Medicine', issn: '0022-1007', impactFactor: 15.3, acceptanceRate: 10, publisher: 'Rockefeller University Press', subjectAreas: ['Immunology', 'Cell Biology', 'Molecular Biology'], geographicLocation: 'United States', website: 'https://rupress.org/jem', openAccess: true, avgDecisionDays: 35, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Frontiers in Immunology', issn: '1664-3224', impactFactor: 7.3, acceptanceRate: 35, publisher: 'Frontiers Media', subjectAreas: ['Immunology'], geographicLocation: 'Switzerland', website: 'https://www.frontiersin.org/journals/immunology', openAccess: true, avgDecisionDays: 45, formattingRequirements: FMT_FRONTIERS },

  // ========== INFECTIOUS DISEASE ==========
  { name: 'The Lancet Infectious Diseases', issn: '1473-3099', impactFactor: 56.3, acceptanceRate: 6, publisher: 'Elsevier', subjectAreas: ['Infectious Disease', 'Clinical Research', 'Microbiology'], geographicLocation: 'United Kingdom', website: 'https://www.thelancet.com/journals/laninf', openAccess: false, avgDecisionDays: 25, formattingRequirements: FMT_LANCET },
  { name: 'Clinical Infectious Diseases', issn: '1058-4838', impactFactor: 11.8, acceptanceRate: 15, publisher: 'Oxford University Press', subjectAreas: ['Infectious Disease', 'Clinical Research', 'Microbiology'], geographicLocation: 'United States', website: 'https://academic.oup.com/cid', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_OUP },
  { name: 'Journal of Infectious Diseases', issn: '0022-1899', impactFactor: 6.4, acceptanceRate: 20, publisher: 'Oxford University Press', subjectAreas: ['Infectious Disease', 'Microbiology'], geographicLocation: 'United States', website: 'https://academic.oup.com/jid', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_OUP },
  { name: 'Emerging Infectious Diseases', issn: '1080-6040', impactFactor: 7.2, acceptanceRate: 18, publisher: 'Centers for Disease Control and Prevention', subjectAreas: ['Infectious Disease', 'Epidemiology', 'Public Health'], geographicLocation: 'United States', website: 'https://wwwnc.cdc.gov/eid', openAccess: true, avgDecisionDays: 30, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Journal of Antimicrobial Chemotherapy', issn: '0305-7453', impactFactor: 5.4, acceptanceRate: 22, publisher: 'Oxford University Press', subjectAreas: ['Infectious Disease', 'Pharmacology', 'Microbiology'], geographicLocation: 'United Kingdom', website: 'https://academic.oup.com/jac', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_OUP },
  { name: 'International Journal of Antimicrobial Agents', issn: '0924-8579', impactFactor: 4.9, acceptanceRate: 25, publisher: 'Elsevier', subjectAreas: ['Infectious Disease', 'Pharmacology'], geographicLocation: 'Europe', website: 'https://www.sciencedirect.com/journal/international-journal-of-antimicrobial-agents', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_ELSEVIER },

  // ========== NEPHROLOGY ==========
  { name: 'Journal of the American Society of Nephrology', issn: '1046-6673', impactFactor: 10.3, acceptanceRate: 15, publisher: 'Wolters Kluwer', subjectAreas: ['Nephrology', 'Medicine'], geographicLocation: 'United States', website: 'https://journals.lww.com/jasn', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_WOLTERS_KLUWER },
  { name: 'Kidney International', issn: '0085-2538', impactFactor: 14.8, acceptanceRate: 12, publisher: 'Elsevier', subjectAreas: ['Nephrology', 'Medicine'], geographicLocation: 'International', website: 'https://www.kidney-international.org', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_ELSEVIER_STRUCTURED },
  { name: 'American Journal of Kidney Diseases', issn: '0272-6386', impactFactor: 9.4, acceptanceRate: 15, publisher: 'Elsevier', subjectAreas: ['Nephrology', 'Clinical Research'], geographicLocation: 'United States', website: 'https://www.ajkd.org', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_ELSEVIER },
  { name: 'Nephrology Dialysis Transplantation', issn: '0931-0509', impactFactor: 6.1, acceptanceRate: 20, publisher: 'Oxford University Press', subjectAreas: ['Nephrology'], geographicLocation: 'Europe', website: 'https://academic.oup.com/ndt', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_OUP },
  { name: 'Clinical Journal of the American Society of Nephrology', issn: '1555-9041', impactFactor: 9.8, acceptanceRate: 15, publisher: 'Wolters Kluwer', subjectAreas: ['Nephrology', 'Clinical Research'], geographicLocation: 'United States', website: 'https://journals.lww.com/cjasn', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_WOLTERS_KLUWER },

  // ========== PULMONOLOGY ==========
  { name: 'The Lancet Respiratory Medicine', issn: '2213-2600', impactFactor: 38.4, acceptanceRate: 6, publisher: 'Elsevier', subjectAreas: ['Pulmonology', 'Medicine', 'Clinical Research'], geographicLocation: 'United Kingdom', website: 'https://www.thelancet.com/journals/lanres', openAccess: false, avgDecisionDays: 25, formattingRequirements: FMT_LANCET },
  { name: 'American Journal of Respiratory and Critical Care Medicine', issn: '1073-449X', impactFactor: 24.7, acceptanceRate: 12, publisher: 'American Thoracic Society', subjectAreas: ['Pulmonology', 'Critical Care', 'Medicine'], geographicLocation: 'United States', website: 'https://www.atsjournals.org/journal/ajrccm', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Thorax', issn: '0040-6376', impactFactor: 9.0, acceptanceRate: 15, publisher: 'BMJ Publishing Group', subjectAreas: ['Pulmonology', 'Clinical Research'], geographicLocation: 'United Kingdom', website: 'https://thorax.bmj.com', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_BMJ },
  { name: 'European Respiratory Journal', issn: '0903-1936', impactFactor: 16.7, acceptanceRate: 12, publisher: 'European Respiratory Society', subjectAreas: ['Pulmonology', 'Medicine'], geographicLocation: 'Europe', website: 'https://erj.ersjournals.com', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Chest', issn: '0012-3692', impactFactor: 9.6, acceptanceRate: 15, publisher: 'Elsevier', subjectAreas: ['Pulmonology', 'Critical Care'], geographicLocation: 'United States', website: 'https://journal.chestnet.org', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_ELSEVIER_STRUCTURED },

  // ========== HEMATOLOGY ==========
  { name: 'Blood', issn: '0006-4971', impactFactor: 21.0, acceptanceRate: 12, publisher: 'American Society of Hematology', subjectAreas: ['Hematology', 'Oncology'], geographicLocation: 'United States', website: 'https://ashpublications.org/blood', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Journal of Clinical Oncology', issn: '0732-183X', impactFactor: 45.3, acceptanceRate: 10, publisher: 'American Society of Clinical Oncology', subjectAreas: ['Hematology', 'Oncology', 'Clinical Research'], geographicLocation: 'United States', website: 'https://ascopubs.org/journal/jco', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Leukemia', issn: '0887-6924', impactFactor: 12.8, acceptanceRate: 15, publisher: 'Nature Publishing Group', subjectAreas: ['Hematology', 'Oncology'], geographicLocation: 'United Kingdom', website: 'https://www.nature.com/leu', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_NATURE },
  { name: 'Haematologica', issn: '0390-6078', impactFactor: 10.1, acceptanceRate: 18, publisher: 'Ferrata Storti Foundation', subjectAreas: ['Hematology'], geographicLocation: 'Europe', website: 'https://haematologica.org', openAccess: true, avgDecisionDays: 35, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'American Journal of Hematology', issn: '0361-8609', impactFactor: 12.0, acceptanceRate: 18, publisher: 'Wiley', subjectAreas: ['Hematology', 'Clinical Research'], geographicLocation: 'United States', website: 'https://onlinelibrary.wiley.com/journal/10968652', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_WILEY },

  // ========== DERMATOLOGY ==========
  { name: 'JAMA Dermatology', issn: '2168-6068', impactFactor: 11.8, acceptanceRate: 10, publisher: 'American Medical Association', subjectAreas: ['Dermatology', 'Clinical Research'], geographicLocation: 'United States', website: 'https://jamanetwork.com/journals/jamadermatology', openAccess: false, avgDecisionDays: 22, formattingRequirements: FMT_JAMA },
  { name: 'Journal of Investigative Dermatology', issn: '0022-202X', impactFactor: 7.5, acceptanceRate: 18, publisher: 'Elsevier', subjectAreas: ['Dermatology', 'Molecular Biology'], geographicLocation: 'United States', website: 'https://www.jidonline.org', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_ELSEVIER },
  { name: 'British Journal of Dermatology', issn: '0007-0963', impactFactor: 11.1, acceptanceRate: 15, publisher: 'Oxford University Press', subjectAreas: ['Dermatology', 'Clinical Research'], geographicLocation: 'United Kingdom', website: 'https://academic.oup.com/bjd', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_OUP },
  { name: 'Journal of the American Academy of Dermatology', issn: '0190-9622', impactFactor: 11.5, acceptanceRate: 15, publisher: 'Elsevier', subjectAreas: ['Dermatology', 'Clinical Research'], geographicLocation: 'United States', website: 'https://www.jaad.org', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_ELSEVIER },
  { name: 'Dermatology', issn: '1018-8665', impactFactor: 3.5, acceptanceRate: 28, publisher: 'Karger', subjectAreas: ['Dermatology'], geographicLocation: 'Switzerland', website: 'https://www.karger.com/drm', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_VANCOUVER_STRUCTURED },

  // ========== OPHTHALMOLOGY ==========
  { name: 'Ophthalmology', issn: '0161-6420', impactFactor: 13.7, acceptanceRate: 15, publisher: 'Elsevier', subjectAreas: ['Ophthalmology', 'Clinical Research'], geographicLocation: 'United States', website: 'https://www.aao.org/ophthalmology-journal', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_ELSEVIER_STRUCTURED },
  { name: 'JAMA Ophthalmology', issn: '2168-6165', impactFactor: 8.1, acceptanceRate: 10, publisher: 'American Medical Association', subjectAreas: ['Ophthalmology', 'Clinical Research'], geographicLocation: 'United States', website: 'https://jamanetwork.com/journals/jamaophthalmology', openAccess: false, avgDecisionDays: 22, formattingRequirements: FMT_JAMA },
  { name: 'British Journal of Ophthalmology', issn: '0007-1161', impactFactor: 4.7, acceptanceRate: 20, publisher: 'BMJ Publishing Group', subjectAreas: ['Ophthalmology'], geographicLocation: 'United Kingdom', website: 'https://bjo.bmj.com', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_BMJ },
  { name: 'American Journal of Ophthalmology', issn: '0002-9394', impactFactor: 4.2, acceptanceRate: 22, publisher: 'Elsevier', subjectAreas: ['Ophthalmology', 'Clinical Research'], geographicLocation: 'United States', website: 'https://www.ajo.com', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_ELSEVIER },

  // ========== RADIOLOGY ==========
  { name: 'Radiology', issn: '0033-8419', impactFactor: 12.1, acceptanceRate: 15, publisher: 'Radiological Society of North America', subjectAreas: ['Radiology', 'Medicine'], geographicLocation: 'United States', website: 'https://pubs.rsna.org/journal/radiology', openAccess: false, avgDecisionDays: 25, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'European Radiology', issn: '0938-7994', impactFactor: 5.9, acceptanceRate: 22, publisher: 'Springer Nature', subjectAreas: ['Radiology'], geographicLocation: 'Europe', website: 'https://link.springer.com/journal/330', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_SPRINGER },
  { name: 'Investigative Radiology', issn: '0020-9996', impactFactor: 7.0, acceptanceRate: 18, publisher: 'Wolters Kluwer', subjectAreas: ['Radiology'], geographicLocation: 'United States', website: 'https://journals.lww.com/investigativeradiology', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_WOLTERS_KLUWER },
  { name: 'American Journal of Roentgenology', issn: '0361-803X', impactFactor: 4.7, acceptanceRate: 25, publisher: 'American Roentgen Ray Society', subjectAreas: ['Radiology'], geographicLocation: 'United States', website: 'https://www.ajronline.org', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_VANCOUVER_STRUCTURED },

  // ========== ORTHOPEDICS ==========
  { name: 'Journal of Bone and Joint Surgery', issn: '0021-9355', impactFactor: 5.3, acceptanceRate: 18, publisher: 'Wolters Kluwer', subjectAreas: ['Orthopedics', 'Surgery'], geographicLocation: 'United States', website: 'https://journals.lww.com/jbjsjournal', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_WOLTERS_KLUWER },
  { name: 'Osteoarthritis and Cartilage', issn: '1063-4584', impactFactor: 7.0, acceptanceRate: 20, publisher: 'Elsevier', subjectAreas: ['Orthopedics', 'Rheumatology'], geographicLocation: 'United Kingdom', website: 'https://www.oarsijournal.com', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_ELSEVIER },
  { name: 'American Journal of Sports Medicine', issn: '0363-5465', impactFactor: 6.2, acceptanceRate: 18, publisher: 'SAGE Publications', subjectAreas: ['Orthopedics', 'Sports Medicine'], geographicLocation: 'United States', website: 'https://journals.sagepub.com/home/ajs', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_SAGE },
  { name: 'Bone & Joint Journal', issn: '2049-4394', impactFactor: 4.9, acceptanceRate: 22, publisher: 'British Editorial Society of Bone & Joint Surgery', subjectAreas: ['Orthopedics', 'Surgery'], geographicLocation: 'United Kingdom', website: 'https://boneandjoint.org.uk/journal/BJJ', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_VANCOUVER_STRUCTURED },

  // ========== RHEUMATOLOGY ==========
  { name: 'Annals of the Rheumatic Diseases', issn: '0003-4967', impactFactor: 27.4, acceptanceRate: 10, publisher: 'BMJ Publishing Group', subjectAreas: ['Rheumatology', 'Immunology'], geographicLocation: 'United Kingdom', website: 'https://ard.bmj.com', openAccess: false, avgDecisionDays: 25, formattingRequirements: FMT_BMJ },
  { name: 'Arthritis & Rheumatology', issn: '2326-5191', impactFactor: 13.3, acceptanceRate: 15, publisher: 'Wiley', subjectAreas: ['Rheumatology', 'Immunology'], geographicLocation: 'United States', website: 'https://onlinelibrary.wiley.com/journal/23265205', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_WILEY },
  { name: 'Rheumatology', issn: '1462-0324', impactFactor: 5.6, acceptanceRate: 20, publisher: 'Oxford University Press', subjectAreas: ['Rheumatology', 'Clinical Research'], geographicLocation: 'United Kingdom', website: 'https://academic.oup.com/rheumatology', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_OUP },
  { name: 'Lupus', issn: '0961-2033', impactFactor: 2.2, acceptanceRate: 30, publisher: 'SAGE Publications', subjectAreas: ['Rheumatology', 'Immunology'], geographicLocation: 'United Kingdom', website: 'https://journals.sagepub.com/home/lup', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_SAGE },

  // ========== UROLOGY ==========
  { name: 'European Urology', issn: '0302-2838', impactFactor: 25.3, acceptanceRate: 10, publisher: 'Elsevier', subjectAreas: ['Urology', 'Surgery'], geographicLocation: 'Europe', website: 'https://www.europeanurology.com', openAccess: false, avgDecisionDays: 25, formattingRequirements: FMT_ELSEVIER_STRUCTURED },
  { name: 'Journal of Urology', issn: '0022-5347', impactFactor: 7.4, acceptanceRate: 18, publisher: 'Wolters Kluwer', subjectAreas: ['Urology', 'Surgery'], geographicLocation: 'United States', website: 'https://www.auajournals.org/journal/juro', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_WOLTERS_KLUWER },
  { name: 'BJU International', issn: '1464-4096', impactFactor: 3.8, acceptanceRate: 25, publisher: 'Wiley', subjectAreas: ['Urology', 'Surgery'], geographicLocation: 'United Kingdom', website: 'https://bjui-journals.onlinelibrary.wiley.com/journal/1464410x', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_WILEY },
  { name: 'Prostate Cancer and Prostatic Diseases', issn: '1365-7852', impactFactor: 5.6, acceptanceRate: 20, publisher: 'Nature Publishing Group', subjectAreas: ['Urology', 'Oncology'], geographicLocation: 'United Kingdom', website: 'https://www.nature.com/pcan', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_NATURE },

  // ========== OBSTETRICS & GYNECOLOGY ==========
  { name: 'American Journal of Obstetrics and Gynecology', issn: '0002-9378', impactFactor: 9.8, acceptanceRate: 15, publisher: 'Elsevier', subjectAreas: ['Obstetrics', 'Gynecology'], geographicLocation: 'United States', website: 'https://www.ajog.org', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_ELSEVIER },
  { name: 'Obstetrics & Gynecology', issn: '0029-7844', impactFactor: 7.2, acceptanceRate: 15, publisher: 'Wolters Kluwer', subjectAreas: ['Obstetrics', 'Gynecology', 'Clinical Research'], geographicLocation: 'United States', website: 'https://journals.lww.com/greenjournal', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_WOLTERS_KLUWER },
  { name: 'BJOG: An International Journal of Obstetrics & Gynaecology', issn: '1470-0328', impactFactor: 7.2, acceptanceRate: 18, publisher: 'Wiley', subjectAreas: ['Obstetrics', 'Gynecology'], geographicLocation: 'United Kingdom', website: 'https://obgyn.onlinelibrary.wiley.com/journal/14710528', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_WILEY },
  { name: 'Human Reproduction', issn: '0268-1161', impactFactor: 6.1, acceptanceRate: 18, publisher: 'Oxford University Press', subjectAreas: ['Obstetrics', 'Gynecology', 'Reproductive Medicine'], geographicLocation: 'United Kingdom', website: 'https://academic.oup.com/humrep', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_OUP },
  { name: 'Fertility and Sterility', issn: '0015-0282', impactFactor: 6.7, acceptanceRate: 18, publisher: 'Elsevier', subjectAreas: ['Reproductive Medicine', 'Gynecology'], geographicLocation: 'United States', website: 'https://www.fertstert.org', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_ELSEVIER },
  { name: 'Gynecologic Oncology', issn: '0090-8258', impactFactor: 4.9, acceptanceRate: 22, publisher: 'Elsevier', subjectAreas: ['Gynecology', 'Oncology'], geographicLocation: 'United States', website: 'https://www.gynecologiconcology-online.net', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_ELSEVIER },

  // ========== ANESTHESIOLOGY / CRITICAL CARE ==========
  { name: 'Anesthesiology', issn: '0003-3022', impactFactor: 9.1, acceptanceRate: 15, publisher: 'Wolters Kluwer', subjectAreas: ['Anesthesiology', 'Critical Care'], geographicLocation: 'United States', website: 'https://pubs.asahq.org/anesthesiology', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_WOLTERS_KLUWER },
  { name: 'British Journal of Anaesthesia', issn: '0007-0912', impactFactor: 9.8, acceptanceRate: 15, publisher: 'Elsevier', subjectAreas: ['Anesthesiology', 'Critical Care'], geographicLocation: 'United Kingdom', website: 'https://www.bjanaesthesia.org', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_ELSEVIER_STRUCTURED },
  { name: 'Intensive Care Medicine', issn: '0342-4642', impactFactor: 27.1, acceptanceRate: 10, publisher: 'Springer Nature', subjectAreas: ['Critical Care', 'Medicine'], geographicLocation: 'Europe', website: 'https://link.springer.com/journal/134', openAccess: false, avgDecisionDays: 20, formattingRequirements: FMT_SPRINGER },
  { name: 'Critical Care Medicine', issn: '0090-3493', impactFactor: 8.8, acceptanceRate: 15, publisher: 'Wolters Kluwer', subjectAreas: ['Critical Care', 'Medicine'], geographicLocation: 'United States', website: 'https://journals.lww.com/ccmjournal', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_WOLTERS_KLUWER },
  { name: 'Critical Care', issn: '1364-8535', impactFactor: 15.1, acceptanceRate: 12, publisher: 'BioMed Central', subjectAreas: ['Critical Care', 'Medicine'], geographicLocation: 'United Kingdom', website: 'https://ccforum.biomedcentral.com', openAccess: true, avgDecisionDays: 25, formattingRequirements: FMT_BIOMED_CENTRAL },

  // ========== EMERGENCY MEDICINE ==========
  { name: 'Annals of Emergency Medicine', issn: '0196-0644', impactFactor: 6.8, acceptanceRate: 12, publisher: 'Elsevier', subjectAreas: ['Emergency Medicine', 'Clinical Research'], geographicLocation: 'United States', website: 'https://www.annemergmed.com', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_ELSEVIER_STRUCTURED },
  { name: 'Academic Emergency Medicine', issn: '1069-6563', impactFactor: 4.3, acceptanceRate: 20, publisher: 'Wiley', subjectAreas: ['Emergency Medicine', 'Clinical Research'], geographicLocation: 'United States', website: 'https://onlinelibrary.wiley.com/journal/15532712', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_WILEY },
  { name: 'Emergency Medicine Journal', issn: '1472-0205', impactFactor: 3.1, acceptanceRate: 22, publisher: 'BMJ Publishing Group', subjectAreas: ['Emergency Medicine'], geographicLocation: 'United Kingdom', website: 'https://emj.bmj.com', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_BMJ },

  // ========== PUBLIC HEALTH / EPIDEMIOLOGY ==========
  { name: 'The Lancet Public Health', issn: '2468-2667', impactFactor: 25.4, acceptanceRate: 8, publisher: 'Elsevier', subjectAreas: ['Public Health', 'Epidemiology'], geographicLocation: 'United Kingdom', website: 'https://www.thelancet.com/journals/lanpub', openAccess: true, avgDecisionDays: 25, formattingRequirements: FMT_LANCET },
  { name: 'American Journal of Epidemiology', issn: '0002-9262', impactFactor: 5.2, acceptanceRate: 18, publisher: 'Oxford University Press', subjectAreas: ['Epidemiology', 'Public Health'], geographicLocation: 'United States', website: 'https://academic.oup.com/aje', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_OUP },
  { name: 'International Journal of Epidemiology', issn: '0300-5771', impactFactor: 7.7, acceptanceRate: 15, publisher: 'Oxford University Press', subjectAreas: ['Epidemiology', 'Public Health'], geographicLocation: 'United Kingdom', website: 'https://academic.oup.com/ije', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_OUP },
  { name: 'Bulletin of the World Health Organization', issn: '0042-9686', impactFactor: 11.1, acceptanceRate: 12, publisher: 'World Health Organization', subjectAreas: ['Public Health', 'Epidemiology', 'Medicine'], geographicLocation: 'International', website: 'https://www.who.int/bulletin', openAccess: true, avgDecisionDays: 35, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'BMJ Global Health', issn: '2059-7908', impactFactor: 8.1, acceptanceRate: 15, publisher: 'BMJ Publishing Group', subjectAreas: ['Public Health', 'Epidemiology'], geographicLocation: 'United Kingdom', website: 'https://gh.bmj.com', openAccess: true, avgDecisionDays: 35, formattingRequirements: FMT_BMJ },
  { name: 'Environmental Health Perspectives', issn: '0091-6765', impactFactor: 10.4, acceptanceRate: 15, publisher: 'National Institute of Environmental Health Sciences', subjectAreas: ['Public Health', 'Epidemiology'], geographicLocation: 'United States', website: 'https://ehp.niehs.nih.gov', openAccess: true, avgDecisionDays: 40, formattingRequirements: FMT_VANCOUVER_STRUCTURED },

  // ========== PHARMACOLOGY ==========
  { name: 'Clinical Pharmacology & Therapeutics', issn: '0009-9236', impactFactor: 7.0, acceptanceRate: 18, publisher: 'Wiley', subjectAreas: ['Pharmacology', 'Clinical Research'], geographicLocation: 'United States', website: 'https://ascpt.onlinelibrary.wiley.com/journal/15326535', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_WILEY },
  { name: 'British Journal of Pharmacology', issn: '0007-1188', impactFactor: 7.3, acceptanceRate: 18, publisher: 'Wiley', subjectAreas: ['Pharmacology'], geographicLocation: 'United Kingdom', website: 'https://bpspubs.onlinelibrary.wiley.com/journal/14765381', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_WILEY },
  { name: 'Journal of Pharmacology and Experimental Therapeutics', issn: '0022-3565', impactFactor: 3.9, acceptanceRate: 22, publisher: 'American Society for Pharmacology and Experimental Therapeutics', subjectAreas: ['Pharmacology'], geographicLocation: 'United States', website: 'https://jpet.aspetjournals.org', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'European Journal of Pharmacology', issn: '0014-2999', impactFactor: 4.2, acceptanceRate: 25, publisher: 'Elsevier', subjectAreas: ['Pharmacology'], geographicLocation: 'Europe', website: 'https://www.journals.elsevier.com/european-journal-of-pharmacology', openAccess: false, avgDecisionDays: 45, formattingRequirements: FMT_ELSEVIER },
  { name: 'Pharmaceuticals', issn: '1424-8247', impactFactor: 4.6, acceptanceRate: 35, publisher: 'MDPI', subjectAreas: ['Pharmacology'], geographicLocation: 'Switzerland', website: 'https://www.mdpi.com/journal/pharmaceuticals', openAccess: true, avgDecisionDays: 30, formattingRequirements: FMT_MDPI },

  // ========== GENETICS ==========
  { name: 'Nature Genetics', issn: '1061-4036', impactFactor: 31.7, acceptanceRate: 8, publisher: 'Nature Publishing Group', subjectAreas: ['Genetics', 'Molecular Biology'], geographicLocation: 'United States', website: 'https://www.nature.com/ng', openAccess: false, avgDecisionDays: 28, formattingRequirements: FMT_NATURE },
  { name: 'American Journal of Human Genetics', issn: '0002-9297', impactFactor: 11.1, acceptanceRate: 12, publisher: 'Cell Press', subjectAreas: ['Genetics', 'Molecular Biology'], geographicLocation: 'United States', website: 'https://www.cell.com/ajhg', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_NATURE },
  { name: 'European Journal of Human Genetics', issn: '1018-4813', impactFactor: 4.4, acceptanceRate: 22, publisher: 'Nature Publishing Group', subjectAreas: ['Genetics', 'Clinical Research'], geographicLocation: 'Europe', website: 'https://www.nature.com/ejhg', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_NATURE },
  { name: 'Genetics in Medicine', issn: '1098-3600', impactFactor: 12.6, acceptanceRate: 12, publisher: 'Elsevier', subjectAreas: ['Genetics', 'Clinical Research', 'Precision Medicine'], geographicLocation: 'United States', website: 'https://www.gimjournal.org', openAccess: true, avgDecisionDays: 35, formattingRequirements: FMT_ELSEVIER },
  { name: 'Human Molecular Genetics', issn: '0964-6906', impactFactor: 3.5, acceptanceRate: 25, publisher: 'Oxford University Press', subjectAreas: ['Genetics', 'Molecular Biology'], geographicLocation: 'United Kingdom', website: 'https://academic.oup.com/hmg', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_OUP },

  // ========== PATHOLOGY ==========
  { name: 'Journal of Pathology', issn: '0022-3417', impactFactor: 7.6, acceptanceRate: 18, publisher: 'Wiley', subjectAreas: ['Pathology', 'Molecular Biology'], geographicLocation: 'United Kingdom', website: 'https://pathsocjournals.onlinelibrary.wiley.com/journal/10969896', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_WILEY },
  { name: 'American Journal of Surgical Pathology', issn: '0147-5185', impactFactor: 5.3, acceptanceRate: 20, publisher: 'Wolters Kluwer', subjectAreas: ['Pathology', 'Surgery'], geographicLocation: 'United States', website: 'https://journals.lww.com/ajsp', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_WOLTERS_KLUWER },
  { name: 'Modern Pathology', issn: '0893-3952', impactFactor: 7.1, acceptanceRate: 18, publisher: 'Elsevier', subjectAreas: ['Pathology'], geographicLocation: 'United States', website: 'https://www.modernpathology.org', openAccess: true, avgDecisionDays: 35, formattingRequirements: FMT_ELSEVIER },

  // ========== OTOLARYNGOLOGY ==========
  { name: 'JAMA Otolaryngology-Head & Neck Surgery', issn: '2168-6181', impactFactor: 5.5, acceptanceRate: 12, publisher: 'American Medical Association', subjectAreas: ['Otolaryngology', 'Surgery'], geographicLocation: 'United States', website: 'https://jamanetwork.com/journals/jamaotolaryngology', openAccess: false, avgDecisionDays: 22, formattingRequirements: FMT_JAMA },
  { name: 'Laryngoscope', issn: '0023-852X', impactFactor: 2.8, acceptanceRate: 25, publisher: 'Wiley', subjectAreas: ['Otolaryngology', 'Surgery'], geographicLocation: 'United States', website: 'https://onlinelibrary.wiley.com/journal/15314995', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_WILEY },
  { name: 'Head & Neck', issn: '1043-3074', impactFactor: 2.9, acceptanceRate: 25, publisher: 'Wiley', subjectAreas: ['Otolaryngology', 'Oncology', 'Surgery'], geographicLocation: 'United States', website: 'https://onlinelibrary.wiley.com/journal/10970347', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_WILEY },

  // ========== CELL BIOLOGY / MOLECULAR BIOLOGY ==========
  { name: 'Cell', issn: '0092-8674', impactFactor: 64.5, acceptanceRate: 5, publisher: 'Cell Press', subjectAreas: ['Cell Biology', 'Molecular Biology'], geographicLocation: 'United States', website: 'https://www.cell.com/cell', openAccess: false, avgDecisionDays: 21, formattingRequirements: FMT_NATURE },
  { name: 'Nature Cell Biology', issn: '1465-7392', impactFactor: 21.3, acceptanceRate: 8, publisher: 'Nature Publishing Group', subjectAreas: ['Cell Biology', 'Molecular Biology'], geographicLocation: 'United Kingdom', website: 'https://www.nature.com/ncb', openAccess: false, avgDecisionDays: 28, formattingRequirements: FMT_NATURE },
  { name: 'Molecular Cell', issn: '1097-2765', impactFactor: 16.0, acceptanceRate: 10, publisher: 'Cell Press', subjectAreas: ['Molecular Biology', 'Cell Biology'], geographicLocation: 'United States', website: 'https://www.cell.com/molecular-cell', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_NATURE },
  { name: 'EMBO Journal', issn: '0261-4189', impactFactor: 11.4, acceptanceRate: 12, publisher: 'EMBO Press', subjectAreas: ['Molecular Biology', 'Cell Biology', 'Biochemistry'], geographicLocation: 'Europe', website: 'https://www.embopress.org/journal/14602075', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Journal of Cell Biology', issn: '0021-9525', impactFactor: 8.1, acceptanceRate: 15, publisher: 'Rockefeller University Press', subjectAreas: ['Cell Biology'], geographicLocation: 'United States', website: 'https://rupress.org/jcb', openAccess: true, avgDecisionDays: 35, formattingRequirements: FMT_VANCOUVER_STRUCTURED },

  // ========== BIOCHEMISTRY ==========
  { name: 'Nature Chemical Biology', issn: '1552-4450', impactFactor: 14.8, acceptanceRate: 10, publisher: 'Nature Publishing Group', subjectAreas: ['Biochemistry', 'Molecular Biology'], geographicLocation: 'United States', website: 'https://www.nature.com/nchembio', openAccess: false, avgDecisionDays: 28, formattingRequirements: FMT_NATURE },
  { name: 'Journal of Biological Chemistry', issn: '0021-9258', impactFactor: 4.8, acceptanceRate: 30, publisher: 'American Society for Biochemistry and Molecular Biology', subjectAreas: ['Biochemistry', 'Molecular Biology'], geographicLocation: 'United States', website: 'https://www.jbc.org', openAccess: true, avgDecisionDays: 35, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Nucleic Acids Research', issn: '0305-1048', impactFactor: 14.9, acceptanceRate: 15, publisher: 'Oxford University Press', subjectAreas: ['Biochemistry', 'Genetics', 'Molecular Biology'], geographicLocation: 'United Kingdom', website: 'https://academic.oup.com/nar', openAccess: true, avgDecisionDays: 40, formattingRequirements: FMT_OUP },

  // ========== MICROBIOLOGY ==========
  { name: 'Nature Microbiology', issn: '2058-5276', impactFactor: 28.3, acceptanceRate: 8, publisher: 'Nature Publishing Group', subjectAreas: ['Microbiology', 'Infectious Disease'], geographicLocation: 'United Kingdom', website: 'https://www.nature.com/nmicrobiol', openAccess: false, avgDecisionDays: 28, formattingRequirements: FMT_NATURE },
  { name: 'mBio', issn: '2150-7511', impactFactor: 6.4, acceptanceRate: 22, publisher: 'American Society for Microbiology', subjectAreas: ['Microbiology'], geographicLocation: 'United States', website: 'https://journals.asm.org/journal/mbio', openAccess: true, avgDecisionDays: 35, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Journal of Clinical Microbiology', issn: '0095-1137', impactFactor: 6.8, acceptanceRate: 20, publisher: 'American Society for Microbiology', subjectAreas: ['Microbiology', 'Infectious Disease', 'Clinical Research'], geographicLocation: 'United States', website: 'https://journals.asm.org/journal/jcm', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Antimicrobial Agents and Chemotherapy', issn: '0066-4804', impactFactor: 4.9, acceptanceRate: 25, publisher: 'American Society for Microbiology', subjectAreas: ['Microbiology', 'Pharmacology', 'Infectious Disease'], geographicLocation: 'United States', website: 'https://journals.asm.org/journal/aac', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_VANCOUVER_STRUCTURED },

  // ========== BIOSTATISTICS / BIOINFORMATICS ==========
  { name: 'Bioinformatics', issn: '1367-4803', impactFactor: 5.8, acceptanceRate: 20, publisher: 'Oxford University Press', subjectAreas: ['Bioinformatics', 'Biostatistics'], geographicLocation: 'United Kingdom', website: 'https://academic.oup.com/bioinformatics', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_OUP },
  { name: 'Genome Biology', issn: '1474-760X', impactFactor: 12.3, acceptanceRate: 12, publisher: 'BioMed Central', subjectAreas: ['Bioinformatics', 'Genetics', 'Molecular Biology'], geographicLocation: 'United Kingdom', website: 'https://genomebiology.biomedcentral.com', openAccess: true, avgDecisionDays: 35, formattingRequirements: FMT_BIOMED_CENTRAL },
  { name: 'Briefings in Bioinformatics', issn: '1467-5463', impactFactor: 9.5, acceptanceRate: 18, publisher: 'Oxford University Press', subjectAreas: ['Bioinformatics', 'Biostatistics'], geographicLocation: 'United Kingdom', website: 'https://academic.oup.com/bib', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_OUP },

  // ========== BIOTECHNOLOGY ==========
  { name: 'Nature Biotechnology', issn: '1087-0156', impactFactor: 46.9, acceptanceRate: 8, publisher: 'Nature Publishing Group', subjectAreas: ['Biotechnology', 'Molecular Biology'], geographicLocation: 'United States', website: 'https://www.nature.com/nbt', openAccess: false, avgDecisionDays: 28, formattingRequirements: FMT_NATURE },
  { name: 'Trends in Biotechnology', issn: '0167-7799', impactFactor: 17.3, acceptanceRate: 10, publisher: 'Cell Press', subjectAreas: ['Biotechnology'], geographicLocation: 'United Kingdom', website: 'https://www.cell.com/trends/biotechnology', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_NATURE },
  { name: 'Biotechnology and Bioengineering', issn: '0006-3592', impactFactor: 3.8, acceptanceRate: 25, publisher: 'Wiley', subjectAreas: ['Biotechnology', 'Biomedical Engineering'], geographicLocation: 'United States', website: 'https://onlinelibrary.wiley.com/journal/10970290', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_WILEY },

  // ========== TRANSLATIONAL / PRECISION / REGENERATIVE MEDICINE ==========
  { name: 'Science Translational Medicine', issn: '1946-6234', impactFactor: 17.1, acceptanceRate: 8, publisher: 'American Association for the Advancement of Science', subjectAreas: ['Translational Medicine', 'Medicine'], geographicLocation: 'United States', website: 'https://www.science.org/journal/stm', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Nature Reviews Drug Discovery', issn: '1474-1776', impactFactor: 120.1, acceptanceRate: 5, publisher: 'Nature Publishing Group', subjectAreas: ['Pharmacology', 'Translational Medicine'], geographicLocation: 'United Kingdom', website: 'https://www.nature.com/nrd', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_NATURE },
  { name: 'Cell Stem Cell', issn: '1934-5909', impactFactor: 19.8, acceptanceRate: 10, publisher: 'Cell Press', subjectAreas: ['Regenerative Medicine', 'Cell Biology'], geographicLocation: 'United States', website: 'https://www.cell.com/cell-stem-cell', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_NATURE },
  { name: 'Stem Cells', issn: '1066-5099', impactFactor: 5.2, acceptanceRate: 20, publisher: 'Oxford University Press', subjectAreas: ['Regenerative Medicine', 'Cell Biology'], geographicLocation: 'United States', website: 'https://academic.oup.com/stmcls', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_OUP },
  { name: 'NPJ Precision Oncology', issn: '2397-768X', impactFactor: 6.8, acceptanceRate: 18, publisher: 'Nature Publishing Group', subjectAreas: ['Precision Medicine', 'Oncology'], geographicLocation: 'United Kingdom', website: 'https://www.nature.com/npjprecisiononcology', openAccess: true, avgDecisionDays: 40, formattingRequirements: FMT_NATURE },
  { name: 'Biomaterials', issn: '0142-9612', impactFactor: 14.0, acceptanceRate: 15, publisher: 'Elsevier', subjectAreas: ['Regenerative Medicine', 'Biomedical Engineering', 'Biotechnology'], geographicLocation: 'United Kingdom', website: 'https://www.journals.elsevier.com/biomaterials', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_ELSEVIER },

  // ========== PHYSIOLOGY ==========
  { name: 'Journal of Physiology', issn: '0022-3751', impactFactor: 5.5, acceptanceRate: 20, publisher: 'Wiley', subjectAreas: ['Physiology'], geographicLocation: 'United Kingdom', website: 'https://physoc.onlinelibrary.wiley.com/journal/14697793', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_WILEY },
  { name: 'American Journal of Physiology', issn: '0363-6143', impactFactor: 4.2, acceptanceRate: 22, publisher: 'American Physiological Society', subjectAreas: ['Physiology'], geographicLocation: 'United States', website: 'https://journals.physiology.org', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_VANCOUVER_STRUCTURED },

  // ========== GENERAL SCIENCE WITH MEDICAL COVERAGE ==========
  { name: 'Nature', issn: '0028-0836', impactFactor: 64.8, acceptanceRate: 5, publisher: 'Nature Publishing Group', subjectAreas: ['Medicine', 'Molecular Biology', 'Cell Biology'], geographicLocation: 'United Kingdom', website: 'https://www.nature.com', openAccess: false, avgDecisionDays: 14, formattingRequirements: FMT_NATURE },
  { name: 'Science', issn: '0036-8075', impactFactor: 56.9, acceptanceRate: 5, publisher: 'American Association for the Advancement of Science', subjectAreas: ['Medicine', 'Molecular Biology'], geographicLocation: 'United States', website: 'https://www.science.org', openAccess: false, avgDecisionDays: 14, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Proceedings of the National Academy of Sciences', issn: '0027-8424', impactFactor: 11.1, acceptanceRate: 15, publisher: 'National Academy of Sciences', subjectAreas: ['Medicine', 'Molecular Biology', 'Genetics'], geographicLocation: 'United States', website: 'https://www.pnas.org', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Nature Communications', issn: '2041-1723', impactFactor: 16.6, acceptanceRate: 15, publisher: 'Nature Publishing Group', subjectAreas: ['Medicine', 'Molecular Biology', 'Clinical Research'], geographicLocation: 'United Kingdom', website: 'https://www.nature.com/ncomms', openAccess: true, avgDecisionDays: 40, formattingRequirements: FMT_NATURE },
  { name: 'Science Advances', issn: '2375-2548', impactFactor: 13.6, acceptanceRate: 12, publisher: 'American Association for the Advancement of Science', subjectAreas: ['Medicine', 'Molecular Biology'], geographicLocation: 'United States', website: 'https://www.science.org/journal/sciadv', openAccess: true, avgDecisionDays: 35, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'eLife', issn: '2050-084X', impactFactor: 7.7, acceptanceRate: 15, publisher: 'eLife Sciences Publications', subjectAreas: ['Medicine', 'Cell Biology', 'Neuroscience'], geographicLocation: 'United Kingdom', website: 'https://elifesciences.org', openAccess: true, avgDecisionDays: 45, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'PLOS ONE', issn: '1932-6203', impactFactor: 3.7, acceptanceRate: 50, publisher: 'PLOS', subjectAreas: ['Medicine', 'Clinical Research', 'Molecular Biology'], geographicLocation: 'United States', website: 'https://journals.plos.org/plosone', openAccess: true, avgDecisionDays: 50, formattingRequirements: FMT_PLOS },
  { name: 'Scientific Reports', issn: '2045-2322', impactFactor: 4.6, acceptanceRate: 45, publisher: 'Nature Publishing Group', subjectAreas: ['Medicine', 'Molecular Biology', 'Clinical Research'], geographicLocation: 'United Kingdom', website: 'https://www.nature.com/srep', openAccess: true, avgDecisionDays: 50, formattingRequirements: FMT_NATURE },

  // ========== BIOMEDICAL ENGINEERING ==========
  { name: 'Nature Biomedical Engineering', issn: '2157-846X', impactFactor: 28.1, acceptanceRate: 8, publisher: 'Nature Publishing Group', subjectAreas: ['Biomedical Engineering', 'Medicine'], geographicLocation: 'United Kingdom', website: 'https://www.nature.com/natbiomedeng', openAccess: false, avgDecisionDays: 28, formattingRequirements: FMT_NATURE },
  { name: 'Annals of Biomedical Engineering', issn: '0090-6964', impactFactor: 3.5, acceptanceRate: 25, publisher: 'Springer Nature', subjectAreas: ['Biomedical Engineering'], geographicLocation: 'United States', website: 'https://link.springer.com/journal/10439', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_SPRINGER },
  { name: 'Journal of Biomedical Science', issn: '1021-7770', impactFactor: 9.0, acceptanceRate: 18, publisher: 'BioMed Central', subjectAreas: ['Biomedical Engineering', 'Medicine', 'Molecular Biology'], geographicLocation: 'International', website: 'https://jbiomedsci.biomedcentral.com', openAccess: true, avgDecisionDays: 35, formattingRequirements: FMT_BIOMED_CENTRAL },

  // ========== CLINICAL RESEARCH (GENERAL) ==========
  { name: 'Journal of Clinical Investigation', issn: '0021-9738', impactFactor: 15.9, acceptanceRate: 10, publisher: 'American Society for Clinical Investigation', subjectAreas: ['Clinical Research', 'Medicine', 'Translational Medicine'], geographicLocation: 'United States', website: 'https://www.jci.org', openAccess: true, avgDecisionDays: 30, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Clinical Investigation', issn: '2041-6792', impactFactor: 3.1, acceptanceRate: 35, publisher: 'Future Science Group', subjectAreas: ['Clinical Research', 'Translational Medicine'], geographicLocation: 'United Kingdom', website: 'https://www.future-science.com/journal/cli', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Trials', issn: '1745-6215', impactFactor: 2.5, acceptanceRate: 40, publisher: 'BioMed Central', subjectAreas: ['Clinical Research', 'Medicine'], geographicLocation: 'United Kingdom', website: 'https://trialsjournal.biomedcentral.com', openAccess: true, avgDecisionDays: 45, formattingRequirements: FMT_BIOMED_CENTRAL },
  { name: 'BMJ Evidence-Based Medicine', issn: '2515-446X', impactFactor: 9.0, acceptanceRate: 12, publisher: 'BMJ Publishing Group', subjectAreas: ['Clinical Research', 'Medicine'], geographicLocation: 'United Kingdom', website: 'https://ebm.bmj.com', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_BMJ },
];

// ============================================================================
// Export processed journal database
// ============================================================================

export const MEDICAL_JOURNALS = RAW_JOURNALS.map((raw, index) => ({
  id: `journal-${index + 1}`,
  name: raw.name,
  coverColor: GRADIENTS[index % GRADIENTS.length],
  coverInitial: getInitials(raw.name),
  impactFactor: raw.impactFactor,
  avgDecisionDays: raw.avgDecisionDays,
  acceptanceRate: raw.acceptanceRate,
  openAccess: raw.openAccess,
  subjectAreas: raw.subjectAreas,
  geographicLocation: raw.geographicLocation,
  publisher: raw.publisher,
  issn: raw.issn,
  website: raw.website,
  formattingRequirements: raw.formattingRequirements,
}));

// Export unique subject areas and locations for filters
export const ALL_SUBJECT_AREAS = [...new Set(RAW_JOURNALS.flatMap((j) => j.subjectAreas))].sort();
export const ALL_GEOGRAPHIC_LOCATIONS = [...new Set(RAW_JOURNALS.map((j) => j.geographicLocation))].sort();
