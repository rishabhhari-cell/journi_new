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
  isMedlineIndexed?: boolean;
}

const RAW_JOURNALS: RawJournalEntry[] = [
  // ========== GENERAL / INTERNAL MEDICINE ==========
  { name: 'The New England Journal of Medicine', issn: '0028-4793', impactFactor: 176.1, acceptanceRate: 5, publisher: 'Massachusetts Medical Society', subjectAreas: ['Medicine', 'Clinical Research'], geographicLocation: 'United States', website: 'https://www.nejm.org', openAccess: false, avgDecisionDays: 14, formattingRequirements: FMT_NEJM, isMedlineIndexed: true },
  { name: 'The Lancet', issn: '0140-6736', impactFactor: 168.9, acceptanceRate: 5, publisher: 'Elsevier', subjectAreas: ['Medicine', 'Clinical Research'], geographicLocation: 'United Kingdom', website: 'https://www.thelancet.com', openAccess: false, avgDecisionDays: 21, formattingRequirements: FMT_LANCET, isMedlineIndexed: true },
  { name: 'JAMA', issn: '0098-7484', impactFactor: 120.7, acceptanceRate: 5, publisher: 'American Medical Association', subjectAreas: ['Medicine', 'Clinical Research'], geographicLocation: 'United States', website: 'https://jamanetwork.com/journals/jama', openAccess: false, avgDecisionDays: 18, formattingRequirements: FMT_JAMA, isMedlineIndexed: true },
  { name: 'The BMJ', issn: '0959-8138', impactFactor: 105.7, acceptanceRate: 7, publisher: 'BMJ Publishing Group', subjectAreas: ['Medicine', 'Clinical Research', 'Public Health'], geographicLocation: 'United Kingdom', website: 'https://www.bmj.com', openAccess: false, avgDecisionDays: 28, formattingRequirements: FMT_BMJ, isMedlineIndexed: true },
  { name: 'Nature Medicine', issn: '1078-8956', impactFactor: 82.9, acceptanceRate: 8, publisher: 'Nature Publishing Group', subjectAreas: ['Medicine', 'Translational Medicine', 'Molecular Biology'], geographicLocation: 'United Kingdom', website: 'https://www.nature.com/nm', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_NATURE, isMedlineIndexed: true },
  { name: 'Annals of Internal Medicine', issn: '0003-4819', impactFactor: 51.8, acceptanceRate: 8, publisher: 'American College of Physicians', subjectAreas: ['Medicine', 'Clinical Research'], geographicLocation: 'United States', website: 'https://www.acpjournals.org/journal/aim', openAccess: false, avgDecisionDays: 25, formattingRequirements: FMT_VANCOUVER_STRUCTURED, isMedlineIndexed: true },
  { name: 'PLOS Medicine', issn: '1549-1676', impactFactor: 15.8, acceptanceRate: 12, publisher: 'PLOS', subjectAreas: ['Medicine', 'Public Health', 'Clinical Research'], geographicLocation: 'United States', website: 'https://journals.plos.org/plosmedicine', openAccess: true, avgDecisionDays: 45, formattingRequirements: FMT_PLOS, isMedlineIndexed: true },
  { name: 'Mayo Clinic Proceedings', issn: '0025-6196', impactFactor: 8.9, acceptanceRate: 15, publisher: 'Elsevier', subjectAreas: ['Medicine', 'Clinical Research'], geographicLocation: 'United States', website: 'https://www.mayoclinicproceedings.org', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_ELSEVIER, isMedlineIndexed: true },
  { name: 'JAMA Internal Medicine', issn: '2168-6106', impactFactor: 39.3, acceptanceRate: 7, publisher: 'American Medical Association', subjectAreas: ['Medicine', 'Clinical Research'], geographicLocation: 'United States', website: 'https://jamanetwork.com/journals/jamainternalmedicine', openAccess: false, avgDecisionDays: 22, formattingRequirements: FMT_JAMA, isMedlineIndexed: true },
  { name: 'The Lancet Global Health', issn: '2214-109X', impactFactor: 34.3, acceptanceRate: 6, publisher: 'Elsevier', subjectAreas: ['Public Health', 'Medicine', 'Epidemiology'], geographicLocation: 'United Kingdom', website: 'https://www.thelancet.com/journals/langlo', openAccess: true, avgDecisionDays: 30, formattingRequirements: FMT_LANCET, isMedlineIndexed: true },
  { name: 'Canadian Medical Association Journal', issn: '0820-3946', impactFactor: 9.6, acceptanceRate: 12, publisher: 'CMA Impact', subjectAreas: ['Medicine', 'Clinical Research'], geographicLocation: 'International', website: 'https://www.cmaj.ca', openAccess: true, avgDecisionDays: 35, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Medical Journal of Australia', issn: '0025-729X', impactFactor: 7.2, acceptanceRate: 15, publisher: 'Wiley', subjectAreas: ['Medicine', 'Clinical Research'], geographicLocation: 'Australia', website: 'https://www.mja.com.au', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_WILEY },
  { name: 'European Journal of Internal Medicine', issn: '0953-6205', impactFactor: 8.0, acceptanceRate: 20, publisher: 'Elsevier', subjectAreas: ['Medicine', 'Clinical Research'], geographicLocation: 'Europe', website: 'https://www.ejinme.com', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_ELSEVIER },
  { name: 'Journal of Internal Medicine', issn: '0954-6820', impactFactor: 11.1, acceptanceRate: 18, publisher: 'Wiley', subjectAreas: ['Medicine', 'Clinical Research'], geographicLocation: 'Europe', website: 'https://onlinelibrary.wiley.com/journal/13652796', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_WILEY },
  { name: 'BMC Medicine', issn: '1741-7015', impactFactor: 9.3, acceptanceRate: 10, publisher: 'BioMed Central', subjectAreas: ['Medicine', 'Clinical Research'], geographicLocation: 'United Kingdom', website: 'https://bmcmedicine.biomedcentral.com', openAccess: true, avgDecisionDays: 40, formattingRequirements: FMT_BIOMED_CENTRAL },

  // ========== ONCOLOGY ==========
  { name: 'CA: A Cancer Journal for Clinicians', issn: '0007-9235', impactFactor: 254.7, acceptanceRate: 4, publisher: 'Wiley', subjectAreas: ['Oncology', 'Medicine'], geographicLocation: 'United States', website: 'https://acsjournals.onlinelibrary.wiley.com/journal/15424863', openAccess: false, avgDecisionDays: 14, formattingRequirements: FMT_WILEY },
  { name: 'The Lancet Oncology', issn: '1470-2045', impactFactor: 51.1, acceptanceRate: 6, publisher: 'Elsevier', subjectAreas: ['Oncology', 'Medicine'], geographicLocation: 'United Kingdom', website: 'https://www.thelancet.com/journals/lanonc', openAccess: false, avgDecisionDays: 25, formattingRequirements: FMT_LANCET, isMedlineIndexed: true },
  { name: 'Journal of Clinical Oncology', issn: '0732-183X', impactFactor: 45.3, acceptanceRate: 10, publisher: 'American Society of Clinical Oncology', subjectAreas: ['Oncology', 'Clinical Research'], geographicLocation: 'United States', website: 'https://ascopubs.org/journal/jco', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_VANCOUVER_STRUCTURED, isMedlineIndexed: true },
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
  { name: 'European Heart Journal', issn: '0195-668X', impactFactor: 39.3, acceptanceRate: 10, publisher: 'Oxford University Press', subjectAreas: ['Cardiology', 'Medicine'], geographicLocation: 'Europe', website: 'https://academic.oup.com/eurheartj', openAccess: false, avgDecisionDays: 20, formattingRequirements: FMT_OUP, isMedlineIndexed: true },
  { name: 'Circulation', issn: '0009-7322', impactFactor: 37.8, acceptanceRate: 10, publisher: 'American Heart Association', subjectAreas: ['Cardiology', 'Medicine'], geographicLocation: 'United States', website: 'https://www.ahajournals.org/journal/circ', openAccess: false, avgDecisionDays: 21, formattingRequirements: FMT_VANCOUVER_STRUCTURED, isMedlineIndexed: true },
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
  { name: 'The Lancet Neurology', issn: '1474-4422', impactFactor: 46.4, acceptanceRate: 5, publisher: 'Elsevier', subjectAreas: ['Neurology', 'Neuroscience', 'Clinical Research'], geographicLocation: 'United Kingdom', website: 'https://www.thelancet.com/journals/laneur', openAccess: false, avgDecisionDays: 25, formattingRequirements: FMT_LANCET, isMedlineIndexed: true },
  { name: 'Brain', issn: '0006-8950', impactFactor: 14.5, acceptanceRate: 12, publisher: 'Oxford University Press', subjectAreas: ['Neurology', 'Neuroscience'], geographicLocation: 'United Kingdom', website: 'https://academic.oup.com/brain', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_OUP, isMedlineIndexed: true },
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

  // ========== SPORTS MEDICINE ==========
  { name: 'British Journal of Sports Medicine', issn: '0306-3674', impactFactor: 18.4, acceptanceRate: 10, publisher: 'BMJ Publishing Group', subjectAreas: ['Sports Medicine', 'Orthopedics'], geographicLocation: 'United Kingdom', website: 'https://bjsm.bmj.com', openAccess: false, avgDecisionDays: 25, formattingRequirements: FMT_BMJ },
  { name: 'Sports Medicine', issn: '0112-1642', impactFactor: 9.3, acceptanceRate: 15, publisher: 'Springer Nature', subjectAreas: ['Sports Medicine'], geographicLocation: 'International', website: 'https://link.springer.com/journal/40279', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_SPRINGER },
  { name: 'Medicine & Science in Sports & Exercise', issn: '0195-9131', impactFactor: 6.3, acceptanceRate: 18, publisher: 'Wolters Kluwer', subjectAreas: ['Sports Medicine', 'Physiology'], geographicLocation: 'United States', website: 'https://journals.lww.com/acsm-msse', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_WOLTERS_KLUWER },
  { name: 'Journal of Sports Sciences', issn: '0264-0414', impactFactor: 3.8, acceptanceRate: 25, publisher: 'Taylor & Francis', subjectAreas: ['Sports Medicine'], geographicLocation: 'United Kingdom', website: 'https://www.tandfonline.com/toc/rjsp20/current', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_TAYLOR_FRANCIS },
  { name: 'Clinical Journal of Sport Medicine', issn: '1050-642X', impactFactor: 2.8, acceptanceRate: 28, publisher: 'Wolters Kluwer', subjectAreas: ['Sports Medicine', 'Clinical Research'], geographicLocation: 'United States', website: 'https://journals.lww.com/cjsportsmed', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_WOLTERS_KLUWER },
  { name: 'Journal of Science and Medicine in Sport', issn: '1440-2440', impactFactor: 5.2, acceptanceRate: 20, publisher: 'Elsevier', subjectAreas: ['Sports Medicine', 'Physiology'], geographicLocation: 'Australia', website: 'https://www.jsams.org', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_ELSEVIER },
  { name: 'Scandinavian Journal of Medicine & Science in Sports', issn: '0905-7188', impactFactor: 4.1, acceptanceRate: 22, publisher: 'Wiley', subjectAreas: ['Sports Medicine'], geographicLocation: 'Europe', website: 'https://onlinelibrary.wiley.com/journal/16000838', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_WILEY },
  { name: 'Journal of Athletic Training', issn: '1062-6050', impactFactor: 3.2, acceptanceRate: 25, publisher: 'National Athletic Trainers Association', subjectAreas: ['Sports Medicine', 'Orthopedics'], geographicLocation: 'United States', website: 'https://meridian.allenpress.com/jat', openAccess: false, avgDecisionDays: 45, formattingRequirements: FMT_VANCOUVER_STRUCTURED },

  // ========== PSYCHOLOGY ==========
  { name: 'American Psychologist', issn: '0003-066X', impactFactor: 16.4, acceptanceRate: 8, publisher: 'American Psychological Association', subjectAreas: ['Psychology'], geographicLocation: 'United States', website: 'https://www.apa.org/pubs/journals/amp', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Psychological Bulletin', issn: '0033-2909', impactFactor: 22.4, acceptanceRate: 5, publisher: 'American Psychological Association', subjectAreas: ['Psychology'], geographicLocation: 'United States', website: 'https://www.apa.org/pubs/journals/bul', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Clinical Psychology Review', issn: '0272-7358', impactFactor: 12.8, acceptanceRate: 10, publisher: 'Elsevier', subjectAreas: ['Psychology', 'Psychiatry'], geographicLocation: 'United States', website: 'https://www.sciencedirect.com/journal/clinical-psychology-review', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_ELSEVIER },
  { name: 'Journal of Abnormal Psychology', issn: '0021-843X', impactFactor: 6.7, acceptanceRate: 15, publisher: 'American Psychological Association', subjectAreas: ['Psychology', 'Psychiatry'], geographicLocation: 'United States', website: 'https://www.apa.org/pubs/journals/abn', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Journal of Consulting and Clinical Psychology', issn: '0022-006X', impactFactor: 6.3, acceptanceRate: 15, publisher: 'American Psychological Association', subjectAreas: ['Psychology', 'Psychiatry'], geographicLocation: 'United States', website: 'https://www.apa.org/pubs/journals/ccp', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Health Psychology', issn: '0278-6133', impactFactor: 4.5, acceptanceRate: 20, publisher: 'American Psychological Association', subjectAreas: ['Psychology', 'Public Health'], geographicLocation: 'United States', website: 'https://www.apa.org/pubs/journals/hea', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Neuropsychology', issn: '0894-4105', impactFactor: 3.4, acceptanceRate: 22, publisher: 'American Psychological Association', subjectAreas: ['Psychology', 'Neuroscience'], geographicLocation: 'United States', website: 'https://www.apa.org/pubs/journals/neu', openAccess: false, avgDecisionDays: 45, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Journal of Health Psychology', issn: '1359-1053', impactFactor: 3.2, acceptanceRate: 25, publisher: 'SAGE Publications', subjectAreas: ['Psychology', 'Public Health'], geographicLocation: 'United Kingdom', website: 'https://journals.sagepub.com/home/hpq', openAccess: false, avgDecisionDays: 45, formattingRequirements: FMT_SAGE },

  // ========== ALLERGY ==========
  { name: 'Journal of Allergy and Clinical Immunology: In Practice', issn: '2213-2198', impactFactor: 10.2, acceptanceRate: 15, publisher: 'Elsevier', subjectAreas: ['Immunology', 'Clinical Research'], geographicLocation: 'United States', website: 'https://www.jaci-inpractice.org', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_ELSEVIER },
  { name: 'Allergy', issn: '0105-4538', impactFactor: 12.6, acceptanceRate: 12, publisher: 'Wiley', subjectAreas: ['Immunology', 'Clinical Research'], geographicLocation: 'Europe', website: 'https://onlinelibrary.wiley.com/journal/13989995', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_WILEY },
  { name: 'Clinical & Experimental Allergy', issn: '0954-7894', impactFactor: 6.3, acceptanceRate: 20, publisher: 'Wiley', subjectAreas: ['Immunology', 'Pulmonology'], geographicLocation: 'United Kingdom', website: 'https://onlinelibrary.wiley.com/journal/13652222', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_WILEY },
  { name: 'Pediatric Allergy and Immunology', issn: '0905-6157', impactFactor: 4.8, acceptanceRate: 22, publisher: 'Wiley', subjectAreas: ['Immunology', 'Pediatrics'], geographicLocation: 'Europe', website: 'https://onlinelibrary.wiley.com/journal/13993038', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_WILEY },
  { name: 'Annals of Allergy, Asthma & Immunology', issn: '1081-1206', impactFactor: 5.1, acceptanceRate: 22, publisher: 'Elsevier', subjectAreas: ['Immunology', 'Pulmonology'], geographicLocation: 'United States', website: 'https://www.annallergy.org', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_ELSEVIER },

  // ========== GERIATRICS & GERONTOLOGY ==========
  { name: 'Age and Ageing', issn: '0002-0729', impactFactor: 12.4, acceptanceRate: 12, publisher: 'Oxford University Press', subjectAreas: ['Medicine', 'Public Health'], geographicLocation: 'United Kingdom', website: 'https://academic.oup.com/ageing', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_OUP },
  { name: 'Journal of the American Geriatrics Society', issn: '0002-8614', impactFactor: 6.3, acceptanceRate: 18, publisher: 'Wiley', subjectAreas: ['Medicine', 'Clinical Research'], geographicLocation: 'United States', website: 'https://agsjournals.onlinelibrary.wiley.com/journal/15325415', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_WILEY },
  { name: 'Journals of Gerontology Series A', issn: '1079-5006', impactFactor: 5.9, acceptanceRate: 18, publisher: 'Oxford University Press', subjectAreas: ['Medicine', 'Physiology'], geographicLocation: 'United States', website: 'https://academic.oup.com/biomedgerontology', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_OUP },
  { name: 'Gerontology', issn: '0304-324X', impactFactor: 4.1, acceptanceRate: 25, publisher: 'Karger', subjectAreas: ['Medicine', 'Public Health'], geographicLocation: 'Switzerland', website: 'https://www.karger.com/ger', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'BMC Geriatrics', issn: '1471-2318', impactFactor: 4.1, acceptanceRate: 35, publisher: 'BioMed Central', subjectAreas: ['Medicine', 'Clinical Research'], geographicLocation: 'United Kingdom', website: 'https://bmcgeriatr.biomedcentral.com', openAccess: true, avgDecisionDays: 40, formattingRequirements: FMT_BIOMED_CENTRAL },

  // ========== PALLIATIVE CARE ==========
  { name: 'Palliative Medicine', issn: '0269-2163', impactFactor: 5.3, acceptanceRate: 18, publisher: 'SAGE Publications', subjectAreas: ['Medicine'], geographicLocation: 'United Kingdom', website: 'https://journals.sagepub.com/home/pmj', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_SAGE },
  { name: 'Journal of Pain and Symptom Management', issn: '0885-3924', impactFactor: 3.6, acceptanceRate: 25, publisher: 'Elsevier', subjectAreas: ['Medicine', 'Anesthesiology'], geographicLocation: 'United States', website: 'https://www.jpsmjournal.com', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_ELSEVIER },
  { name: 'Journal of Palliative Medicine', issn: '1096-6218', impactFactor: 2.9, acceptanceRate: 30, publisher: 'Mary Ann Liebert', subjectAreas: ['Medicine', 'Clinical Research'], geographicLocation: 'United States', website: 'https://www.liebertpub.com/journal/jpm', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'BMC Palliative Care', issn: '1472-684X', impactFactor: 3.1, acceptanceRate: 38, publisher: 'BioMed Central', subjectAreas: ['Medicine'], geographicLocation: 'United Kingdom', website: 'https://bmcpalliatcare.biomedcentral.com', openAccess: true, avgDecisionDays: 40, formattingRequirements: FMT_BIOMED_CENTRAL },

  // ========== DENTAL & ORAL MEDICINE ==========
  { name: 'Journal of Dental Research', issn: '0022-0345', impactFactor: 7.6, acceptanceRate: 15, publisher: 'SAGE Publications', subjectAreas: ['Medicine'], geographicLocation: 'United States', website: 'https://journals.sagepub.com/home/jdr', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_SAGE },
  { name: 'Journal of Clinical Periodontology', issn: '0303-6979', impactFactor: 7.8, acceptanceRate: 15, publisher: 'Wiley', subjectAreas: ['Medicine', 'Surgery'], geographicLocation: 'Europe', website: 'https://onlinelibrary.wiley.com/journal/1600051x', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_WILEY },
  { name: 'Oral Oncology', issn: '1368-8375', impactFactor: 5.3, acceptanceRate: 20, publisher: 'Elsevier', subjectAreas: ['Oncology', 'Surgery'], geographicLocation: 'United Kingdom', website: 'https://www.journals.elsevier.com/oral-oncology', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_ELSEVIER },
  { name: 'Journal of Endodontics', issn: '0099-2399', impactFactor: 4.0, acceptanceRate: 22, publisher: 'Elsevier', subjectAreas: ['Medicine', 'Surgery'], geographicLocation: 'United States', website: 'https://www.jendodon.com', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_ELSEVIER },
  { name: 'Clinical Oral Investigations', issn: '1432-6981', impactFactor: 3.5, acceptanceRate: 28, publisher: 'Springer Nature', subjectAreas: ['Medicine', 'Clinical Research'], geographicLocation: 'Europe', website: 'https://link.springer.com/journal/784', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_SPRINGER },

  // ========== NUTRITION & DIETETICS ==========
  { name: 'American Journal of Clinical Nutrition', issn: '0002-9165', impactFactor: 7.1, acceptanceRate: 15, publisher: 'Oxford University Press', subjectAreas: ['Public Health', 'Endocrinology'], geographicLocation: 'United States', website: 'https://academic.oup.com/ajcn', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_OUP },
  { name: 'European Journal of Nutrition', issn: '1436-6207', impactFactor: 4.4, acceptanceRate: 22, publisher: 'Springer Nature', subjectAreas: ['Public Health', 'Endocrinology'], geographicLocation: 'Europe', website: 'https://link.springer.com/journal/394', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_SPRINGER },
  { name: 'Clinical Nutrition', issn: '0261-5614', impactFactor: 7.3, acceptanceRate: 15, publisher: 'Elsevier', subjectAreas: ['Clinical Research', 'Medicine'], geographicLocation: 'United Kingdom', website: 'https://www.clinicalnutritionjournal.com', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_ELSEVIER },
  { name: 'Nutrition Reviews', issn: '0029-6643', impactFactor: 5.3, acceptanceRate: 18, publisher: 'Oxford University Press', subjectAreas: ['Public Health', 'Medicine'], geographicLocation: 'United States', website: 'https://academic.oup.com/nutritionreviews', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_OUP },
  { name: 'Journal of Nutrition', issn: '0022-3166', impactFactor: 4.3, acceptanceRate: 22, publisher: 'Oxford University Press', subjectAreas: ['Public Health', 'Biochemistry'], geographicLocation: 'United States', website: 'https://academic.oup.com/jn', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_OUP },
  { name: 'Nutrients', issn: '2072-6643', impactFactor: 5.9, acceptanceRate: 35, publisher: 'MDPI', subjectAreas: ['Public Health', 'Biochemistry'], geographicLocation: 'Switzerland', website: 'https://www.mdpi.com/journal/nutrients', openAccess: true, avgDecisionDays: 30, formattingRequirements: FMT_MDPI },

  // ========== MEDICAL EDUCATION ==========
  { name: 'Academic Medicine', issn: '1040-2446', impactFactor: 7.6, acceptanceRate: 12, publisher: 'Wolters Kluwer', subjectAreas: ['Medicine', 'Public Health'], geographicLocation: 'United States', website: 'https://journals.lww.com/academicmedicine', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_WOLTERS_KLUWER },
  { name: 'Medical Education', issn: '0308-0110', impactFactor: 6.0, acceptanceRate: 15, publisher: 'Wiley', subjectAreas: ['Medicine', 'Clinical Research'], geographicLocation: 'United Kingdom', website: 'https://onlinelibrary.wiley.com/journal/13652923', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_WILEY },
  { name: 'Medical Teacher', issn: '0142-159X', impactFactor: 3.5, acceptanceRate: 22, publisher: 'Taylor & Francis', subjectAreas: ['Medicine'], geographicLocation: 'United Kingdom', website: 'https://www.tandfonline.com/toc/imte20/current', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_TAYLOR_FRANCIS },
  { name: 'BMC Medical Education', issn: '1472-6920', impactFactor: 3.6, acceptanceRate: 38, publisher: 'BioMed Central', subjectAreas: ['Medicine', 'Clinical Research'], geographicLocation: 'United Kingdom', website: 'https://bmcmededuc.biomedcentral.com', openAccess: true, avgDecisionDays: 40, formattingRequirements: FMT_BIOMED_CENTRAL },

  // ========== HEALTH SERVICES RESEARCH ==========
  { name: 'Health Affairs', issn: '0278-2715', impactFactor: 8.6, acceptanceRate: 10, publisher: 'Project HOPE', subjectAreas: ['Public Health', 'Medicine'], geographicLocation: 'United States', website: 'https://www.healthaffairs.org', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Medical Care', issn: '0025-7079', impactFactor: 4.0, acceptanceRate: 18, publisher: 'Wolters Kluwer', subjectAreas: ['Public Health', 'Clinical Research'], geographicLocation: 'United States', website: 'https://journals.lww.com/lww-medicalcare', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_WOLTERS_KLUWER },
  { name: 'Health Services Research', issn: '0017-9124', impactFactor: 3.4, acceptanceRate: 20, publisher: 'Wiley', subjectAreas: ['Public Health', 'Epidemiology'], geographicLocation: 'United States', website: 'https://onlinelibrary.wiley.com/journal/14756773', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_WILEY },
  { name: 'BMJ Quality & Safety', issn: '2044-5415', impactFactor: 7.1, acceptanceRate: 12, publisher: 'BMJ Publishing Group', subjectAreas: ['Medicine', 'Public Health'], geographicLocation: 'United Kingdom', website: 'https://qualitysafety.bmj.com', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_BMJ },
  { name: 'Value in Health', issn: '1098-3015', impactFactor: 4.9, acceptanceRate: 20, publisher: 'Elsevier', subjectAreas: ['Public Health', 'Pharmacology'], geographicLocation: 'United States', website: 'https://www.valueinhealthjournal.com', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_ELSEVIER },

  // ========== REHABILITATION MEDICINE ==========
  { name: 'Archives of Physical Medicine and Rehabilitation', issn: '0003-9993', impactFactor: 4.3, acceptanceRate: 20, publisher: 'Elsevier', subjectAreas: ['Sports Medicine', 'Medicine'], geographicLocation: 'United States', website: 'https://www.archives-pmr.org', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_ELSEVIER },
  { name: 'Journal of Rehabilitation Medicine', issn: '1650-1977', impactFactor: 2.6, acceptanceRate: 28, publisher: 'Foundation for Rehabilitation Information', subjectAreas: ['Sports Medicine', 'Medicine'], geographicLocation: 'Europe', website: 'https://www.medicaljournals.se/jrm', openAccess: true, avgDecisionDays: 40, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Disability and Rehabilitation', issn: '0963-8288', impactFactor: 2.3, acceptanceRate: 30, publisher: 'Taylor & Francis', subjectAreas: ['Medicine', 'Public Health'], geographicLocation: 'United Kingdom', website: 'https://www.tandfonline.com/toc/idre20/current', openAccess: false, avgDecisionDays: 45, formattingRequirements: FMT_TAYLOR_FRANCIS },
  { name: 'Physical Therapy', issn: '0031-9023', impactFactor: 4.0, acceptanceRate: 18, publisher: 'Oxford University Press', subjectAreas: ['Sports Medicine', 'Orthopedics'], geographicLocation: 'United States', website: 'https://academic.oup.com/ptj', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_OUP },
  { name: 'Journal of NeuroEngineering and Rehabilitation', issn: '1743-0003', impactFactor: 5.2, acceptanceRate: 22, publisher: 'BioMed Central', subjectAreas: ['Biomedical Engineering', 'Neurology'], geographicLocation: 'United Kingdom', website: 'https://jneuroengrehab.biomedcentral.com', openAccess: true, avgDecisionDays: 35, formattingRequirements: FMT_BIOMED_CENTRAL },

  // ========== VASCULAR & THORACIC SURGERY ==========
  { name: 'Journal of Vascular Surgery', issn: '0741-5214', impactFactor: 5.0, acceptanceRate: 18, publisher: 'Elsevier', subjectAreas: ['Surgery', 'Cardiology'], geographicLocation: 'United States', website: 'https://www.jvascsurg.org', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_ELSEVIER },
  { name: 'European Journal of Vascular and Endovascular Surgery', issn: '1078-5884', impactFactor: 5.5, acceptanceRate: 18, publisher: 'Elsevier', subjectAreas: ['Surgery', 'Cardiology'], geographicLocation: 'Europe', website: 'https://www.ejves.com', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_ELSEVIER },
  { name: 'Journal of Thoracic and Cardiovascular Surgery', issn: '0022-5223', impactFactor: 5.2, acceptanceRate: 18, publisher: 'Elsevier', subjectAreas: ['Surgery', 'Cardiology', 'Pulmonology'], geographicLocation: 'United States', website: 'https://www.jtcvs.org', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_ELSEVIER },
  { name: 'Annals of Thoracic Surgery', issn: '0003-4975', impactFactor: 4.6, acceptanceRate: 20, publisher: 'Elsevier', subjectAreas: ['Surgery', 'Cardiology'], geographicLocation: 'United States', website: 'https://www.annalsthoracicsurgery.org', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_ELSEVIER },
  { name: 'European Journal of Cardio-Thoracic Surgery', issn: '1010-7940', impactFactor: 3.9, acceptanceRate: 22, publisher: 'Oxford University Press', subjectAreas: ['Surgery', 'Cardiology'], geographicLocation: 'Europe', website: 'https://academic.oup.com/ejcts', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_OUP },

  // ========== PLASTIC & RECONSTRUCTIVE SURGERY ==========
  { name: 'Plastic and Reconstructive Surgery', issn: '0032-1052', impactFactor: 4.3, acceptanceRate: 18, publisher: 'Wolters Kluwer', subjectAreas: ['Surgery'], geographicLocation: 'United States', website: 'https://journals.lww.com/plasreconsurg', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_WOLTERS_KLUWER },
  { name: 'Journal of Plastic, Reconstructive & Aesthetic Surgery', issn: '1748-6815', impactFactor: 3.0, acceptanceRate: 25, publisher: 'Elsevier', subjectAreas: ['Surgery'], geographicLocation: 'United Kingdom', website: 'https://www.jprasurg.com', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_ELSEVIER },
  { name: 'Aesthetic Surgery Journal', issn: '1090-820X', impactFactor: 3.3, acceptanceRate: 22, publisher: 'Oxford University Press', subjectAreas: ['Surgery'], geographicLocation: 'United States', website: 'https://academic.oup.com/asj', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_OUP },
  { name: 'Journal of Craniofacial Surgery', issn: '1049-2275', impactFactor: 1.3, acceptanceRate: 40, publisher: 'Wolters Kluwer', subjectAreas: ['Surgery', 'Orthopedics'], geographicLocation: 'United States', website: 'https://journals.lww.com/jcraniofacialsurgery', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_WOLTERS_KLUWER },

  // ========== TRANSPLANTATION ==========
  { name: 'American Journal of Transplantation', issn: '1600-6135', impactFactor: 8.9, acceptanceRate: 15, publisher: 'Wiley', subjectAreas: ['Surgery', 'Immunology'], geographicLocation: 'United States', website: 'https://onlinelibrary.wiley.com/journal/16006143', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_WILEY },
  { name: 'Transplantation', issn: '0041-1337', impactFactor: 5.3, acceptanceRate: 18, publisher: 'Wolters Kluwer', subjectAreas: ['Surgery', 'Immunology'], geographicLocation: 'United States', website: 'https://journals.lww.com/transplantjournal', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_WOLTERS_KLUWER },
  { name: 'Transplant International', issn: '0934-0874', impactFactor: 4.2, acceptanceRate: 22, publisher: 'Wiley', subjectAreas: ['Surgery', 'Immunology'], geographicLocation: 'Europe', website: 'https://onlinelibrary.wiley.com/journal/14322277', openAccess: true, avgDecisionDays: 35, formattingRequirements: FMT_WILEY },
  { name: 'Bone Marrow Transplantation', issn: '0268-3369', impactFactor: 5.7, acceptanceRate: 20, publisher: 'Nature Publishing Group', subjectAreas: ['Hematology', 'Oncology', 'Immunology'], geographicLocation: 'United Kingdom', website: 'https://www.nature.com/bmt', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_NATURE },
  { name: 'Liver Transplantation', issn: '1527-6465', impactFactor: 4.8, acceptanceRate: 22, publisher: 'Wiley', subjectAreas: ['Surgery', 'Gastroenterology'], geographicLocation: 'United States', website: 'https://aasldpubs.onlinelibrary.wiley.com/journal/15276473', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_WILEY },

  // ========== TROPICAL MEDICINE ==========
  { name: 'The Lancet Microbe', issn: '2666-5247', impactFactor: 18.1, acceptanceRate: 8, publisher: 'Elsevier', subjectAreas: ['Infectious Disease', 'Microbiology'], geographicLocation: 'United Kingdom', website: 'https://www.thelancet.com/journals/lanmic', openAccess: true, avgDecisionDays: 25, formattingRequirements: FMT_LANCET },
  { name: 'PLoS Neglected Tropical Diseases', issn: '1935-2727', impactFactor: 4.8, acceptanceRate: 25, publisher: 'PLOS', subjectAreas: ['Infectious Disease', 'Public Health'], geographicLocation: 'United States', website: 'https://journals.plos.org/plosntds', openAccess: true, avgDecisionDays: 40, formattingRequirements: FMT_PLOS },
  { name: 'International Journal of Infectious Diseases', issn: '1201-9712', impactFactor: 4.8, acceptanceRate: 25, publisher: 'Elsevier', subjectAreas: ['Infectious Disease'], geographicLocation: 'International', website: 'https://www.ijidonline.com', openAccess: true, avgDecisionDays: 30, formattingRequirements: FMT_ELSEVIER },
  { name: 'Tropical Medicine and International Health', issn: '1360-2276', impactFactor: 3.0, acceptanceRate: 25, publisher: 'Wiley', subjectAreas: ['Infectious Disease', 'Public Health'], geographicLocation: 'United Kingdom', website: 'https://onlinelibrary.wiley.com/journal/13653156', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_WILEY },
  { name: 'American Journal of Tropical Medicine and Hygiene', issn: '0002-9637', impactFactor: 3.3, acceptanceRate: 25, publisher: 'American Society of Tropical Medicine and Hygiene', subjectAreas: ['Infectious Disease', 'Public Health'], geographicLocation: 'United States', website: 'https://www.ajtmh.org', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_VANCOUVER_STRUCTURED },

  // ========== SLEEP MEDICINE ==========
  { name: 'Sleep', issn: '0161-8105', impactFactor: 5.6, acceptanceRate: 18, publisher: 'Oxford University Press', subjectAreas: ['Neurology', 'Psychiatry'], geographicLocation: 'United States', website: 'https://academic.oup.com/sleep', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_OUP },
  { name: 'Sleep Medicine Reviews', issn: '1087-0792', impactFactor: 12.1, acceptanceRate: 10, publisher: 'Elsevier', subjectAreas: ['Neurology', 'Pulmonology'], geographicLocation: 'United Kingdom', website: 'https://www.smrv-journal.com', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_ELSEVIER },
  { name: 'Sleep Medicine', issn: '1389-9457', impactFactor: 3.8, acceptanceRate: 25, publisher: 'Elsevier', subjectAreas: ['Neurology', 'Psychiatry'], geographicLocation: 'Europe', website: 'https://www.sleep-journal.com', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_ELSEVIER },
  { name: 'Journal of Clinical Sleep Medicine', issn: '1550-9389', impactFactor: 4.5, acceptanceRate: 22, publisher: 'American Academy of Sleep Medicine', subjectAreas: ['Neurology', 'Clinical Research'], geographicLocation: 'United States', website: 'https://jcsm.aasm.org', openAccess: true, avgDecisionDays: 35, formattingRequirements: FMT_VANCOUVER_STRUCTURED },

  // ========== ADDICTION MEDICINE ==========
  { name: 'Addiction', issn: '0965-2140', impactFactor: 6.3, acceptanceRate: 12, publisher: 'Wiley', subjectAreas: ['Psychiatry', 'Public Health'], geographicLocation: 'United Kingdom', website: 'https://onlinelibrary.wiley.com/journal/13600443', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_WILEY },
  { name: 'Drug and Alcohol Dependence', issn: '0376-8716', impactFactor: 4.2, acceptanceRate: 20, publisher: 'Elsevier', subjectAreas: ['Psychiatry', 'Public Health'], geographicLocation: 'International', website: 'https://www.drugandalcoholdependence.com', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_ELSEVIER },
  { name: 'Journal of Substance Abuse Treatment', issn: '0740-5472', impactFactor: 3.7, acceptanceRate: 22, publisher: 'Elsevier', subjectAreas: ['Psychiatry', 'Clinical Research'], geographicLocation: 'United States', website: 'https://www.journalofsubstanceabusetreatment.com', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_ELSEVIER },
  { name: 'Alcoholism: Clinical and Experimental Research', issn: '0145-6008', impactFactor: 3.5, acceptanceRate: 25, publisher: 'Wiley', subjectAreas: ['Psychiatry', 'Neuroscience'], geographicLocation: 'United States', website: 'https://onlinelibrary.wiley.com/journal/15300277', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_WILEY },

  // ========== PAIN MEDICINE ==========
  { name: 'Pain', issn: '0304-3959', impactFactor: 7.4, acceptanceRate: 15, publisher: 'Wolters Kluwer', subjectAreas: ['Anesthesiology', 'Neurology'], geographicLocation: 'United States', website: 'https://journals.lww.com/pain', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_WOLTERS_KLUWER },
  { name: 'European Journal of Pain', issn: '1090-3801', impactFactor: 4.0, acceptanceRate: 22, publisher: 'Wiley', subjectAreas: ['Anesthesiology', 'Neurology'], geographicLocation: 'Europe', website: 'https://onlinelibrary.wiley.com/journal/15322149', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_WILEY },
  { name: 'Journal of Pain', issn: '1526-5900', impactFactor: 5.1, acceptanceRate: 18, publisher: 'Elsevier', subjectAreas: ['Anesthesiology', 'Clinical Research'], geographicLocation: 'United States', website: 'https://www.jpain.org', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_ELSEVIER },
  { name: 'Regional Anesthesia & Pain Medicine', issn: '1098-7339', impactFactor: 9.3, acceptanceRate: 12, publisher: 'BMJ Publishing Group', subjectAreas: ['Anesthesiology', 'Surgery'], geographicLocation: 'United States', website: 'https://rapm.bmj.com', openAccess: false, avgDecisionDays: 25, formattingRequirements: FMT_BMJ },
  { name: 'Clinical Journal of Pain', issn: '0749-8047', impactFactor: 3.2, acceptanceRate: 25, publisher: 'Wolters Kluwer', subjectAreas: ['Anesthesiology', 'Clinical Research'], geographicLocation: 'United States', website: 'https://journals.lww.com/clinicalpain', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_WOLTERS_KLUWER },

  // ========== NUCLEAR MEDICINE ==========
  { name: 'Journal of Nuclear Medicine', issn: '0161-5505', impactFactor: 9.1, acceptanceRate: 15, publisher: 'Society of Nuclear Medicine and Molecular Imaging', subjectAreas: ['Radiology', 'Oncology'], geographicLocation: 'United States', website: 'https://jnm.snmjournals.org', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'European Journal of Nuclear Medicine and Molecular Imaging', issn: '1619-7070', impactFactor: 9.1, acceptanceRate: 18, publisher: 'Springer Nature', subjectAreas: ['Radiology', 'Molecular Biology'], geographicLocation: 'Europe', website: 'https://link.springer.com/journal/259', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_SPRINGER },
  { name: 'Clinical Nuclear Medicine', issn: '0363-9762', impactFactor: 10.3, acceptanceRate: 15, publisher: 'Wolters Kluwer', subjectAreas: ['Radiology', 'Clinical Research'], geographicLocation: 'United States', website: 'https://journals.lww.com/nuclearmed', openAccess: false, avgDecisionDays: 25, formattingRequirements: FMT_WOLTERS_KLUWER },

  // ========== FORENSIC MEDICINE ==========
  { name: 'Forensic Science International', issn: '0379-0738', impactFactor: 2.2, acceptanceRate: 25, publisher: 'Elsevier', subjectAreas: ['Pathology', 'Medicine'], geographicLocation: 'International', website: 'https://www.sciencedirect.com/journal/forensic-science-international', openAccess: false, avgDecisionDays: 45, formattingRequirements: FMT_ELSEVIER },
  { name: 'Journal of Forensic Sciences', issn: '0022-1198', impactFactor: 1.8, acceptanceRate: 30, publisher: 'Wiley', subjectAreas: ['Pathology', 'Medicine'], geographicLocation: 'United States', website: 'https://onlinelibrary.wiley.com/journal/15564029', openAccess: false, avgDecisionDays: 45, formattingRequirements: FMT_WILEY },
  { name: 'International Journal of Legal Medicine', issn: '0937-9827', impactFactor: 2.8, acceptanceRate: 25, publisher: 'Springer Nature', subjectAreas: ['Pathology', 'Genetics'], geographicLocation: 'Europe', website: 'https://link.springer.com/journal/414', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_SPRINGER },

  // ========== MORE ONCOLOGY SUBSPECIALTIES ==========
  { name: 'Breast Cancer Research', issn: '1465-5411', impactFactor: 6.1, acceptanceRate: 18, publisher: 'BioMed Central', subjectAreas: ['Oncology', 'Gynecology'], geographicLocation: 'United Kingdom', website: 'https://breast-cancer-research.biomedcentral.com', openAccess: true, avgDecisionDays: 35, formattingRequirements: FMT_BIOMED_CENTRAL },
  { name: 'Neuro-Oncology', issn: '1522-8517', impactFactor: 15.9, acceptanceRate: 12, publisher: 'Oxford University Press', subjectAreas: ['Oncology', 'Neurology'], geographicLocation: 'United States', website: 'https://academic.oup.com/neuro-oncology', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_OUP },
  { name: 'International Journal of Radiation Oncology, Biology, Physics', issn: '0360-3016', impactFactor: 7.0, acceptanceRate: 18, publisher: 'Elsevier', subjectAreas: ['Oncology', 'Radiology'], geographicLocation: 'United States', website: 'https://www.redjournal.org', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_ELSEVIER },
  { name: 'Radiotherapy and Oncology', issn: '0167-8140', impactFactor: 6.9, acceptanceRate: 18, publisher: 'Elsevier', subjectAreas: ['Oncology', 'Radiology'], geographicLocation: 'Europe', website: 'https://www.thegreenjournal.com', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_ELSEVIER },
  { name: 'Journal of Thoracic Oncology', issn: '1556-0864', impactFactor: 20.4, acceptanceRate: 12, publisher: 'Elsevier', subjectAreas: ['Oncology', 'Pulmonology', 'Surgery'], geographicLocation: 'United States', website: 'https://www.jto.org', openAccess: false, avgDecisionDays: 25, formattingRequirements: FMT_ELSEVIER },
  { name: 'Molecular Cancer', issn: '1476-4598', impactFactor: 37.3, acceptanceRate: 10, publisher: 'BioMed Central', subjectAreas: ['Oncology', 'Molecular Biology', 'Cell Biology'], geographicLocation: 'United Kingdom', website: 'https://molecular-cancer.biomedcentral.com', openAccess: true, avgDecisionDays: 30, formattingRequirements: FMT_BIOMED_CENTRAL },
  { name: 'Cancer Immunology Research', issn: '2326-6066', impactFactor: 10.1, acceptanceRate: 12, publisher: 'American Association for Cancer Research', subjectAreas: ['Oncology', 'Immunology'], geographicLocation: 'United States', website: 'https://cancerimmunolres.aacrjournals.org', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Seminars in Oncology', issn: '0093-7754', impactFactor: 3.4, acceptanceRate: 28, publisher: 'Elsevier', subjectAreas: ['Oncology', 'Clinical Research'], geographicLocation: 'United States', website: 'https://www.seminoncol.org', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_ELSEVIER },

  // ========== MORE CARDIOLOGY ==========
  { name: 'JACC: Cardiovascular Interventions', issn: '1936-8798', impactFactor: 13.0, acceptanceRate: 12, publisher: 'Elsevier', subjectAreas: ['Cardiology', 'Surgery'], geographicLocation: 'United States', website: 'https://www.jacc.org/journal/interventions', openAccess: false, avgDecisionDays: 25, formattingRequirements: FMT_ELSEVIER_STRUCTURED },
  { name: 'Heart Rhythm', issn: '1547-5271', impactFactor: 5.7, acceptanceRate: 18, publisher: 'Elsevier', subjectAreas: ['Cardiology', 'Clinical Research'], geographicLocation: 'United States', website: 'https://www.heartrhythmjournal.com', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_ELSEVIER },
  { name: 'Cardiovascular Research', issn: '0008-6363', impactFactor: 10.2, acceptanceRate: 15, publisher: 'Oxford University Press', subjectAreas: ['Cardiology', 'Molecular Biology'], geographicLocation: 'Europe', website: 'https://academic.oup.com/cardiovascres', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_OUP },
  { name: 'JACC: Heart Failure', issn: '2213-1779', impactFactor: 13.0, acceptanceRate: 12, publisher: 'Elsevier', subjectAreas: ['Cardiology', 'Clinical Research'], geographicLocation: 'United States', website: 'https://www.jacc.org/journal/heart-failure', openAccess: false, avgDecisionDays: 25, formattingRequirements: FMT_ELSEVIER_STRUCTURED },
  { name: 'Atherosclerosis', issn: '0021-9150', impactFactor: 5.3, acceptanceRate: 22, publisher: 'Elsevier', subjectAreas: ['Cardiology', 'Biochemistry'], geographicLocation: 'International', website: 'https://www.atherosclerosis-journal.com', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_ELSEVIER },
  { name: 'European Heart Journal - Cardiovascular Imaging', issn: '2047-2404', impactFactor: 7.0, acceptanceRate: 18, publisher: 'Oxford University Press', subjectAreas: ['Cardiology', 'Radiology'], geographicLocation: 'Europe', website: 'https://academic.oup.com/ehjcimaging', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_OUP },

  // ========== MORE NEUROLOGY ==========
  { name: 'Movement Disorders', issn: '0885-3185', impactFactor: 10.3, acceptanceRate: 15, publisher: 'Wiley', subjectAreas: ['Neurology', 'Clinical Research'], geographicLocation: 'United States', website: 'https://movementdisorders.onlinelibrary.wiley.com/journal/15318257', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_WILEY },
  { name: 'Alzheimers & Dementia', issn: '1552-5260', impactFactor: 14.0, acceptanceRate: 12, publisher: 'Wiley', subjectAreas: ['Neurology', 'Neuroscience'], geographicLocation: 'United States', website: 'https://alz-journals.onlinelibrary.wiley.com/journal/15525279', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_WILEY },
  { name: 'Cephalalgia', issn: '0333-1024', impactFactor: 5.5, acceptanceRate: 20, publisher: 'SAGE Publications', subjectAreas: ['Neurology', 'Clinical Research'], geographicLocation: 'United Kingdom', website: 'https://journals.sagepub.com/home/cep', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_SAGE },
  { name: 'Journal of Neurology, Neurosurgery & Psychiatry', issn: '0022-3050', impactFactor: 10.5, acceptanceRate: 12, publisher: 'BMJ Publishing Group', subjectAreas: ['Neurology', 'Psychiatry', 'Surgery'], geographicLocation: 'United Kingdom', website: 'https://jnnp.bmj.com', openAccess: false, avgDecisionDays: 25, formattingRequirements: FMT_BMJ },
  { name: 'Neurobiology of Disease', issn: '0969-9961', impactFactor: 5.4, acceptanceRate: 22, publisher: 'Elsevier', subjectAreas: ['Neuroscience', 'Molecular Biology'], geographicLocation: 'United States', website: 'https://www.sciencedirect.com/journal/neurobiology-of-disease', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_ELSEVIER },
  { name: 'Acta Neuropathologica', issn: '0001-6322', impactFactor: 12.0, acceptanceRate: 15, publisher: 'Springer Nature', subjectAreas: ['Neuroscience', 'Pathology'], geographicLocation: 'Europe', website: 'https://link.springer.com/journal/401', openAccess: false, avgDecisionDays: 25, formattingRequirements: FMT_SPRINGER },
  { name: 'Stroke', issn: '0039-2499', impactFactor: 10.2, acceptanceRate: 15, publisher: 'American Heart Association', subjectAreas: ['Neurology', 'Cardiology'], geographicLocation: 'United States', website: 'https://www.ahajournals.org/journal/str', openAccess: false, avgDecisionDays: 25, formattingRequirements: FMT_VANCOUVER_STRUCTURED },

  // ========== MORE PUBLIC HEALTH ==========
  { name: 'Tobacco Control', issn: '0964-4563', impactFactor: 8.2, acceptanceRate: 15, publisher: 'BMJ Publishing Group', subjectAreas: ['Public Health', 'Epidemiology'], geographicLocation: 'United Kingdom', website: 'https://tobaccocontrol.bmj.com', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_BMJ },
  { name: 'Occupational and Environmental Medicine', issn: '1351-0711', impactFactor: 5.3, acceptanceRate: 18, publisher: 'BMJ Publishing Group', subjectAreas: ['Public Health', 'Epidemiology'], geographicLocation: 'United Kingdom', website: 'https://oem.bmj.com', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_BMJ },
  { name: 'International Journal of Environmental Research and Public Health', issn: '1660-4601', impactFactor: 4.6, acceptanceRate: 40, publisher: 'MDPI', subjectAreas: ['Public Health', 'Epidemiology'], geographicLocation: 'Switzerland', website: 'https://www.mdpi.com/journal/ijerph', openAccess: true, avgDecisionDays: 30, formattingRequirements: FMT_MDPI },
  { name: 'Journal of Epidemiology and Community Health', issn: '0143-005X', impactFactor: 5.3, acceptanceRate: 18, publisher: 'BMJ Publishing Group', subjectAreas: ['Epidemiology', 'Public Health'], geographicLocation: 'United Kingdom', website: 'https://jech.bmj.com', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_BMJ },
  { name: 'Preventive Medicine', issn: '0091-7435', impactFactor: 4.0, acceptanceRate: 22, publisher: 'Elsevier', subjectAreas: ['Public Health', 'Epidemiology'], geographicLocation: 'United States', website: 'https://www.journals.elsevier.com/preventive-medicine', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_ELSEVIER },
  { name: 'BMC Public Health', issn: '1471-2458', impactFactor: 4.5, acceptanceRate: 38, publisher: 'BioMed Central', subjectAreas: ['Public Health', 'Epidemiology'], geographicLocation: 'United Kingdom', website: 'https://bmcpublichealth.biomedcentral.com', openAccess: true, avgDecisionDays: 40, formattingRequirements: FMT_BIOMED_CENTRAL },

  // ========== MORE PEDIATRICS ==========
  { name: 'Journal of Pediatric Surgery', issn: '0022-3468', impactFactor: 2.8, acceptanceRate: 22, publisher: 'Elsevier', subjectAreas: ['Pediatrics', 'Surgery'], geographicLocation: 'United States', website: 'https://www.jpedsurg.org', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_ELSEVIER },
  { name: 'Neonatology', issn: '1661-7800', impactFactor: 4.2, acceptanceRate: 22, publisher: 'Karger', subjectAreas: ['Pediatrics', 'Critical Care'], geographicLocation: 'Switzerland', website: 'https://www.karger.com/neo', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Pediatric Infectious Disease Journal', issn: '0891-3668', impactFactor: 3.1, acceptanceRate: 22, publisher: 'Wolters Kluwer', subjectAreas: ['Pediatrics', 'Infectious Disease'], geographicLocation: 'United States', website: 'https://journals.lww.com/pidj', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_WOLTERS_KLUWER },
  { name: 'European Journal of Pediatrics', issn: '0340-6199', impactFactor: 3.8, acceptanceRate: 25, publisher: 'Springer Nature', subjectAreas: ['Pediatrics', 'Clinical Research'], geographicLocation: 'Europe', website: 'https://link.springer.com/journal/431', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_SPRINGER },
  { name: 'Journal of Adolescent Health', issn: '1054-139X', impactFactor: 6.5, acceptanceRate: 15, publisher: 'Elsevier', subjectAreas: ['Pediatrics', 'Public Health'], geographicLocation: 'United States', website: 'https://www.jahonline.org', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_ELSEVIER },
  { name: 'Pediatric Critical Care Medicine', issn: '1529-7535', impactFactor: 4.0, acceptanceRate: 20, publisher: 'Wolters Kluwer', subjectAreas: ['Pediatrics', 'Critical Care'], geographicLocation: 'United States', website: 'https://journals.lww.com/pccmjournal', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_WOLTERS_KLUWER },

  // ========== MORE SURGERY ==========
  { name: 'Journal of Trauma and Acute Care Surgery', issn: '2163-0755', impactFactor: 3.6, acceptanceRate: 20, publisher: 'Wolters Kluwer', subjectAreas: ['Surgery', 'Emergency Medicine'], geographicLocation: 'United States', website: 'https://journals.lww.com/jtrauma', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_WOLTERS_KLUWER },
  { name: 'Annals of Surgical Oncology', issn: '1068-9265', impactFactor: 4.9, acceptanceRate: 20, publisher: 'Springer Nature', subjectAreas: ['Surgery', 'Oncology'], geographicLocation: 'United States', website: 'https://link.springer.com/journal/10434', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_SPRINGER },
  { name: 'Neurosurgery', issn: '0148-396X', impactFactor: 4.5, acceptanceRate: 18, publisher: 'Wolters Kluwer', subjectAreas: ['Surgery', 'Neurology'], geographicLocation: 'United States', website: 'https://journals.lww.com/neurosurgery', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_WOLTERS_KLUWER },
  { name: 'Journal of Neurosurgery', issn: '0022-3085', impactFactor: 5.1, acceptanceRate: 18, publisher: 'American Association of Neurological Surgeons', subjectAreas: ['Surgery', 'Neurology'], geographicLocation: 'United States', website: 'https://thejns.org/journal/jns', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Transplant Proceedings', issn: '0041-1345', impactFactor: 1.1, acceptanceRate: 45, publisher: 'Elsevier', subjectAreas: ['Surgery', 'Immunology'], geographicLocation: 'United States', website: 'https://www.transplantation-proceedings.org', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_ELSEVIER },

  // ========== MORE RADIOLOGY ==========
  { name: 'Journal of Cardiovascular Magnetic Resonance', issn: '1097-6647', impactFactor: 6.4, acceptanceRate: 18, publisher: 'BioMed Central', subjectAreas: ['Radiology', 'Cardiology'], geographicLocation: 'United Kingdom', website: 'https://jcmr-online.biomedcentral.com', openAccess: true, avgDecisionDays: 35, formattingRequirements: FMT_BIOMED_CENTRAL },
  { name: 'Neuroradiology', issn: '0028-3940', impactFactor: 2.8, acceptanceRate: 25, publisher: 'Springer Nature', subjectAreas: ['Radiology', 'Neurology'], geographicLocation: 'Europe', website: 'https://link.springer.com/journal/234', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_SPRINGER },
  { name: 'AJNR American Journal of Neuroradiology', issn: '0195-6108', impactFactor: 3.5, acceptanceRate: 22, publisher: 'American Society of Neuroradiology', subjectAreas: ['Radiology', 'Neurology'], geographicLocation: 'United States', website: 'https://www.ajnr.org', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Insights into Imaging', issn: '1869-4101', impactFactor: 4.7, acceptanceRate: 25, publisher: 'Springer Nature', subjectAreas: ['Radiology'], geographicLocation: 'Europe', website: 'https://link.springer.com/journal/13244', openAccess: true, avgDecisionDays: 35, formattingRequirements: FMT_SPRINGER },

  // ========== MORE GASTROENTEROLOGY ==========
  { name: 'Clinical Gastroenterology and Hepatology', issn: '1542-3565', impactFactor: 11.6, acceptanceRate: 12, publisher: 'Elsevier', subjectAreas: ['Gastroenterology', 'Clinical Research'], geographicLocation: 'United States', website: 'https://www.cghjournal.org', openAccess: false, avgDecisionDays: 25, formattingRequirements: FMT_ELSEVIER_STRUCTURED },
  { name: 'Inflammatory Bowel Diseases', issn: '1078-0998', impactFactor: 4.5, acceptanceRate: 20, publisher: 'Oxford University Press', subjectAreas: ['Gastroenterology', 'Immunology'], geographicLocation: 'United States', website: 'https://academic.oup.com/ibdjournal', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_OUP },
  { name: 'Gastrointestinal Endoscopy', issn: '0016-5107', impactFactor: 7.7, acceptanceRate: 15, publisher: 'Elsevier', subjectAreas: ['Gastroenterology', 'Surgery'], geographicLocation: 'United States', website: 'https://www.giejournal.org', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_ELSEVIER },
  { name: 'Liver International', issn: '1478-3223', impactFactor: 6.7, acceptanceRate: 18, publisher: 'Wiley', subjectAreas: ['Gastroenterology'], geographicLocation: 'Europe', website: 'https://onlinelibrary.wiley.com/journal/14783231', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_WILEY },

  // ========== MORE ENDOCRINOLOGY ==========
  { name: 'Obesity', issn: '1930-7381', impactFactor: 5.3, acceptanceRate: 18, publisher: 'Wiley', subjectAreas: ['Endocrinology', 'Public Health'], geographicLocation: 'United States', website: 'https://onlinelibrary.wiley.com/journal/1930739x', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_WILEY },
  { name: 'International Journal of Obesity', issn: '0307-0565', impactFactor: 5.1, acceptanceRate: 20, publisher: 'Nature Publishing Group', subjectAreas: ['Endocrinology', 'Public Health'], geographicLocation: 'United Kingdom', website: 'https://www.nature.com/ijo', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_NATURE },
  { name: 'Osteoporosis International', issn: '0937-941X', impactFactor: 4.5, acceptanceRate: 22, publisher: 'Springer Nature', subjectAreas: ['Endocrinology', 'Orthopedics'], geographicLocation: 'International', website: 'https://link.springer.com/journal/198', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_SPRINGER },
  { name: 'Endocrine Reviews', issn: '0163-769X', impactFactor: 20.3, acceptanceRate: 8, publisher: 'Oxford University Press', subjectAreas: ['Endocrinology', 'Molecular Biology'], geographicLocation: 'United States', website: 'https://academic.oup.com/edrv', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_OUP },

  // ========== MORE INFECTIOUS DISEASE ==========
  { name: 'AIDS', issn: '0269-9370', impactFactor: 4.4, acceptanceRate: 20, publisher: 'Wolters Kluwer', subjectAreas: ['Infectious Disease', 'Immunology'], geographicLocation: 'United Kingdom', website: 'https://journals.lww.com/aidsonline', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_WOLTERS_KLUWER },
  { name: 'Journal of Acquired Immune Deficiency Syndromes', issn: '1525-4135', impactFactor: 3.6, acceptanceRate: 22, publisher: 'Wolters Kluwer', subjectAreas: ['Infectious Disease', 'Immunology'], geographicLocation: 'United States', website: 'https://journals.lww.com/jaids', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_WOLTERS_KLUWER },
  { name: 'PLoS Pathogens', issn: '1553-7366', impactFactor: 6.7, acceptanceRate: 18, publisher: 'PLOS', subjectAreas: ['Infectious Disease', 'Microbiology', 'Immunology'], geographicLocation: 'United States', website: 'https://journals.plos.org/plospathogens', openAccess: true, avgDecisionDays: 35, formattingRequirements: FMT_PLOS },
  { name: 'Vaccine', issn: '0264-410X', impactFactor: 4.5, acceptanceRate: 25, publisher: 'Elsevier', subjectAreas: ['Infectious Disease', 'Immunology', 'Public Health'], geographicLocation: 'International', website: 'https://www.sciencedirect.com/journal/vaccine', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_ELSEVIER },

  // ========== COMPLEMENTARY & INTEGRATIVE MEDICINE ==========
  { name: 'Journal of Integrative Medicine', issn: '2095-4964', impactFactor: 3.5, acceptanceRate: 25, publisher: 'Elsevier', subjectAreas: ['Medicine', 'Pharmacology'], geographicLocation: 'China', website: 'https://www.journals.elsevier.com/journal-of-integrative-medicine', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_ELSEVIER },
  { name: 'Evidence-Based Complementary and Alternative Medicine', issn: '1741-427X', impactFactor: 2.6, acceptanceRate: 35, publisher: 'Wiley', subjectAreas: ['Medicine', 'Pharmacology'], geographicLocation: 'International', website: 'https://onlinelibrary.wiley.com/journal/17414288', openAccess: true, avgDecisionDays: 40, formattingRequirements: FMT_WILEY },
  { name: 'Phytomedicine', issn: '0944-7113', impactFactor: 7.9, acceptanceRate: 15, publisher: 'Elsevier', subjectAreas: ['Pharmacology', 'Biochemistry'], geographicLocation: 'Europe', website: 'https://www.sciencedirect.com/journal/phytomedicine', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_ELSEVIER },

  // ========== MEDICAL ETHICS & HUMANITIES ==========
  { name: 'Journal of Medical Ethics', issn: '0306-6800', impactFactor: 3.4, acceptanceRate: 18, publisher: 'BMJ Publishing Group', subjectAreas: ['Medicine', 'Public Health'], geographicLocation: 'United Kingdom', website: 'https://jme.bmj.com', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_BMJ },
  { name: 'American Journal of Bioethics', issn: '1526-5161', impactFactor: 4.8, acceptanceRate: 15, publisher: 'Taylor & Francis', subjectAreas: ['Medicine', 'Public Health'], geographicLocation: 'United States', website: 'https://www.tandfonline.com/toc/uajb20/current', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_TAYLOR_FRANCIS },

  // ========== MORE MICROBIOLOGY ==========
  { name: 'Cell Host & Microbe', issn: '1931-3128', impactFactor: 21.0, acceptanceRate: 8, publisher: 'Cell Press', subjectAreas: ['Microbiology', 'Immunology', 'Infectious Disease'], geographicLocation: 'United States', website: 'https://www.cell.com/cell-host-microbe', openAccess: false, avgDecisionDays: 28, formattingRequirements: FMT_NATURE },
  { name: 'ISME Journal', issn: '1751-7362', impactFactor: 11.1, acceptanceRate: 12, publisher: 'Nature Publishing Group', subjectAreas: ['Microbiology'], geographicLocation: 'United Kingdom', website: 'https://www.nature.com/ismej', openAccess: true, avgDecisionDays: 35, formattingRequirements: FMT_NATURE },
  { name: 'Microbiome', issn: '2049-2618', impactFactor: 15.5, acceptanceRate: 12, publisher: 'BioMed Central', subjectAreas: ['Microbiology', 'Gastroenterology'], geographicLocation: 'United Kingdom', website: 'https://microbiomejournal.biomedcentral.com', openAccess: true, avgDecisionDays: 30, formattingRequirements: FMT_BIOMED_CENTRAL },
  { name: 'Gut Microbes', issn: '1949-0976', impactFactor: 12.2, acceptanceRate: 15, publisher: 'Taylor & Francis', subjectAreas: ['Microbiology', 'Gastroenterology', 'Immunology'], geographicLocation: 'United States', website: 'https://www.tandfonline.com/toc/kgmi20/current', openAccess: true, avgDecisionDays: 35, formattingRequirements: FMT_TAYLOR_FRANCIS },

  // ========== MORE GENETICS / BIOINFORMATICS ==========
  { name: 'Genome Research', issn: '1088-9051', impactFactor: 7.0, acceptanceRate: 15, publisher: 'Cold Spring Harbor Laboratory Press', subjectAreas: ['Genetics', 'Bioinformatics'], geographicLocation: 'United States', website: 'https://genome.cshlp.org', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Nature Reviews Genetics', issn: '1471-0056', impactFactor: 40.3, acceptanceRate: 5, publisher: 'Nature Publishing Group', subjectAreas: ['Genetics'], geographicLocation: 'United Kingdom', website: 'https://www.nature.com/nrg', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_NATURE },
  { name: 'Human Genetics', issn: '0340-6717', impactFactor: 4.0, acceptanceRate: 22, publisher: 'Springer Nature', subjectAreas: ['Genetics', 'Clinical Research'], geographicLocation: 'Europe', website: 'https://link.springer.com/journal/439', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_SPRINGER },
  { name: 'Nature Methods', issn: '1548-7091', impactFactor: 36.1, acceptanceRate: 8, publisher: 'Nature Publishing Group', subjectAreas: ['Bioinformatics', 'Molecular Biology', 'Biotechnology'], geographicLocation: 'United States', website: 'https://www.nature.com/nmeth', openAccess: false, avgDecisionDays: 25, formattingRequirements: FMT_NATURE },
  { name: 'Cell Reports', issn: '2211-1247', impactFactor: 8.8, acceptanceRate: 15, publisher: 'Cell Press', subjectAreas: ['Cell Biology', 'Molecular Biology'], geographicLocation: 'United States', website: 'https://www.cell.com/cell-reports', openAccess: true, avgDecisionDays: 30, formattingRequirements: FMT_NATURE },

  // ========== MORE IMMUNOLOGY ==========
  { name: 'Mucosal Immunology', issn: '1933-0219', impactFactor: 7.9, acceptanceRate: 15, publisher: 'Nature Publishing Group', subjectAreas: ['Immunology', 'Gastroenterology'], geographicLocation: 'United States', website: 'https://www.nature.com/mi', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_NATURE },
  { name: 'Journal of Autoimmunity', issn: '0896-8411', impactFactor: 7.8, acceptanceRate: 18, publisher: 'Elsevier', subjectAreas: ['Immunology', 'Rheumatology'], geographicLocation: 'United Kingdom', website: 'https://www.sciencedirect.com/journal/journal-of-autoimmunity', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_ELSEVIER },
  { name: 'Annals of Allergy, Asthma & Immunology', issn: '1081-1206', impactFactor: 5.1, acceptanceRate: 22, publisher: 'Elsevier', subjectAreas: ['Immunology', 'Pulmonology', 'Clinical Research'], geographicLocation: 'United States', website: 'https://www.annallergy.org', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_ELSEVIER },

  // ========== TOXICOLOGY ==========
  { name: 'Archives of Toxicology', issn: '0340-5761', impactFactor: 6.0, acceptanceRate: 18, publisher: 'Springer Nature', subjectAreas: ['Pharmacology', 'Public Health'], geographicLocation: 'Europe', website: 'https://link.springer.com/journal/204', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_SPRINGER },
  { name: 'Toxicological Sciences', issn: '1096-6080', impactFactor: 4.0, acceptanceRate: 22, publisher: 'Oxford University Press', subjectAreas: ['Pharmacology', 'Biochemistry'], geographicLocation: 'United States', website: 'https://academic.oup.com/toxsci', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_OUP },
  { name: 'Food and Chemical Toxicology', issn: '0278-6915', impactFactor: 4.3, acceptanceRate: 25, publisher: 'Elsevier', subjectAreas: ['Pharmacology', 'Public Health'], geographicLocation: 'United Kingdom', website: 'https://www.sciencedirect.com/journal/food-and-chemical-toxicology', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_ELSEVIER },

  // ========== MORE GENERAL MEDICINE ==========
  { name: 'Internal Medicine Journal', issn: '1444-0903', impactFactor: 2.6, acceptanceRate: 28, publisher: 'Wiley', subjectAreas: ['Medicine', 'Clinical Research'], geographicLocation: 'Australia', website: 'https://onlinelibrary.wiley.com/journal/14455994', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_WILEY },
  { name: 'QJM: An International Journal of Medicine', issn: '1460-2725', impactFactor: 3.3, acceptanceRate: 25, publisher: 'Oxford University Press', subjectAreas: ['Medicine', 'Clinical Research'], geographicLocation: 'United Kingdom', website: 'https://academic.oup.com/qjmed', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_OUP },
  { name: 'Annals of Medicine', issn: '0785-3890', impactFactor: 5.4, acceptanceRate: 20, publisher: 'Taylor & Francis', subjectAreas: ['Medicine', 'Clinical Research'], geographicLocation: 'International', website: 'https://www.tandfonline.com/toc/iann20/current', openAccess: true, avgDecisionDays: 35, formattingRequirements: FMT_TAYLOR_FRANCIS },
  { name: 'Nature Reviews Disease Primers', issn: '2056-676X', impactFactor: 76.9, acceptanceRate: 5, publisher: 'Nature Publishing Group', subjectAreas: ['Medicine', 'Clinical Research'], geographicLocation: 'United Kingdom', website: 'https://www.nature.com/nrdp', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_NATURE },
  { name: 'The Lancet Digital Health', issn: '2589-7500', impactFactor: 23.8, acceptanceRate: 8, publisher: 'Elsevier', subjectAreas: ['Medicine', 'Biomedical Engineering', 'Bioinformatics'], geographicLocation: 'United Kingdom', website: 'https://www.thelancet.com/journals/landig', openAccess: true, avgDecisionDays: 25, formattingRequirements: FMT_LANCET },

  // ========== MORE NEPHROLOGY ==========
  { name: 'Nature Reviews Nephrology', issn: '1759-5061', impactFactor: 28.6, acceptanceRate: 8, publisher: 'Nature Publishing Group', subjectAreas: ['Nephrology'], geographicLocation: 'United Kingdom', website: 'https://www.nature.com/nrneph', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_NATURE },
  { name: 'Kidney360', issn: '2641-7650', impactFactor: 4.2, acceptanceRate: 25, publisher: 'American Society of Nephrology', subjectAreas: ['Nephrology', 'Clinical Research'], geographicLocation: 'United States', website: 'https://kidney360.asnjournals.org', openAccess: true, avgDecisionDays: 30, formattingRequirements: FMT_VANCOUVER_STRUCTURED },

  // ========== MORE DERMATOLOGY ==========
  { name: 'Experimental Dermatology', issn: '0906-6705', impactFactor: 4.5, acceptanceRate: 25, publisher: 'Wiley', subjectAreas: ['Dermatology', 'Molecular Biology'], geographicLocation: 'Europe', website: 'https://onlinelibrary.wiley.com/journal/16000625', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_WILEY },
  { name: 'International Journal of Dermatology', issn: '0011-9059', impactFactor: 2.5, acceptanceRate: 30, publisher: 'Wiley', subjectAreas: ['Dermatology', 'Clinical Research'], geographicLocation: 'International', website: 'https://onlinelibrary.wiley.com/journal/13654632', openAccess: false, avgDecisionDays: 40, formattingRequirements: FMT_WILEY },

  // ========== MORE OPHTHALMOLOGY ==========
  { name: 'Progress in Retinal and Eye Research', issn: '1350-9462', impactFactor: 18.6, acceptanceRate: 8, publisher: 'Elsevier', subjectAreas: ['Ophthalmology', 'Neuroscience'], geographicLocation: 'United Kingdom', website: 'https://www.sciencedirect.com/journal/progress-in-retinal-and-eye-research', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_ELSEVIER },
  { name: 'Investigative Ophthalmology & Visual Science', issn: '0146-0404', impactFactor: 5.0, acceptanceRate: 20, publisher: 'Association for Research in Vision and Ophthalmology', subjectAreas: ['Ophthalmology'], geographicLocation: 'United States', website: 'https://iovs.arvojournals.org', openAccess: true, avgDecisionDays: 35, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Ocular Surface', issn: '1542-0124', impactFactor: 6.4, acceptanceRate: 18, publisher: 'Elsevier', subjectAreas: ['Ophthalmology', 'Clinical Research'], geographicLocation: 'United States', website: 'https://www.theocularsurface.com', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_ELSEVIER },

  // ========== MORE HEMATOLOGY ==========
  { name: 'Blood Advances', issn: '2473-9529', impactFactor: 7.5, acceptanceRate: 18, publisher: 'American Society of Hematology', subjectAreas: ['Hematology'], geographicLocation: 'United States', website: 'https://ashpublications.org/bloodadvances', openAccess: true, avgDecisionDays: 25, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Journal of Thrombosis and Haemostasis', issn: '1538-7933', impactFactor: 5.9, acceptanceRate: 20, publisher: 'Wiley', subjectAreas: ['Hematology', 'Clinical Research'], geographicLocation: 'International', website: 'https://onlinelibrary.wiley.com/journal/15387836', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_WILEY },
  { name: 'Thrombosis and Haemostasis', issn: '0340-6245', impactFactor: 5.0, acceptanceRate: 22, publisher: 'Georg Thieme Verlag', subjectAreas: ['Hematology'], geographicLocation: 'Europe', website: 'https://www.thieme-connect.de/products/ejournals/journal/10.1055/s-00000077', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_VANCOUVER_STRUCTURED },

  // ========== MORE BIOMEDICAL ENGINEERING ==========
  { name: 'Lab on a Chip', issn: '1473-0197', impactFactor: 6.1, acceptanceRate: 18, publisher: 'Royal Society of Chemistry', subjectAreas: ['Biomedical Engineering', 'Biotechnology'], geographicLocation: 'United Kingdom', website: 'https://pubs.rsc.org/en/journals/journalissues/lc', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'IEEE Transactions on Biomedical Engineering', issn: '0018-9294', impactFactor: 4.6, acceptanceRate: 20, publisher: 'IEEE', subjectAreas: ['Biomedical Engineering'], geographicLocation: 'United States', website: 'https://ieeexplore.ieee.org/xpl/RecentIssue.jsp?punumber=10', openAccess: false, avgDecisionDays: 45, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'ACS Nano', issn: '1936-0851', impactFactor: 17.1, acceptanceRate: 12, publisher: 'American Chemical Society', subjectAreas: ['Biomedical Engineering', 'Biochemistry', 'Biotechnology'], geographicLocation: 'United States', website: 'https://pubs.acs.org/journal/ancac3', openAccess: false, avgDecisionDays: 25, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
  { name: 'Advanced Healthcare Materials', issn: '2192-2640', impactFactor: 10.0, acceptanceRate: 15, publisher: 'Wiley', subjectAreas: ['Biomedical Engineering', 'Regenerative Medicine'], geographicLocation: 'Europe', website: 'https://onlinelibrary.wiley.com/journal/21922659', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_WILEY },
  { name: 'Biosensors and Bioelectronics', issn: '0956-5663', impactFactor: 12.6, acceptanceRate: 12, publisher: 'Elsevier', subjectAreas: ['Biomedical Engineering', 'Biochemistry'], geographicLocation: 'United Kingdom', website: 'https://www.sciencedirect.com/journal/biosensors-and-bioelectronics', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_ELSEVIER },

  // ========== MORE BIOCHEMISTRY / MOLECULAR ==========
  { name: 'Cell Metabolism', issn: '1550-4131', impactFactor: 29.0, acceptanceRate: 8, publisher: 'Cell Press', subjectAreas: ['Biochemistry', 'Endocrinology', 'Cell Biology'], geographicLocation: 'United States', website: 'https://www.cell.com/cell-metabolism', openAccess: false, avgDecisionDays: 28, formattingRequirements: FMT_NATURE },
  { name: 'Nature Structural & Molecular Biology', issn: '1545-9993', impactFactor: 12.5, acceptanceRate: 10, publisher: 'Nature Publishing Group', subjectAreas: ['Biochemistry', 'Molecular Biology'], geographicLocation: 'United States', website: 'https://www.nature.com/nsmb', openAccess: false, avgDecisionDays: 30, formattingRequirements: FMT_NATURE },
  { name: 'Annual Review of Biochemistry', issn: '0066-4154', impactFactor: 22.2, acceptanceRate: 5, publisher: 'Annual Reviews', subjectAreas: ['Biochemistry', 'Molecular Biology'], geographicLocation: 'United States', website: 'https://www.annualreviews.org/journal/biochem', openAccess: false, avgDecisionDays: 45, formattingRequirements: FMT_VANCOUVER_STRUCTURED },

  // ========== MORE PHARMACOLOGY ==========
  { name: 'Nature Reviews Drug Discovery', issn: '1474-1776', impactFactor: 120.1, acceptanceRate: 5, publisher: 'Nature Publishing Group', subjectAreas: ['Pharmacology', 'Biotechnology'], geographicLocation: 'United Kingdom', website: 'https://www.nature.com/nrd', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_NATURE },
  { name: 'Drug Discovery Today', issn: '1359-6446', impactFactor: 7.4, acceptanceRate: 18, publisher: 'Elsevier', subjectAreas: ['Pharmacology', 'Biotechnology'], geographicLocation: 'United Kingdom', website: 'https://www.sciencedirect.com/journal/drug-discovery-today', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_ELSEVIER },
  { name: 'Molecular Pharmaceutics', issn: '1543-8384', impactFactor: 5.0, acceptanceRate: 22, publisher: 'American Chemical Society', subjectAreas: ['Pharmacology', 'Molecular Biology'], geographicLocation: 'United States', website: 'https://pubs.acs.org/journal/mpohbp', openAccess: false, avgDecisionDays: 35, formattingRequirements: FMT_VANCOUVER_STRUCTURED },
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
  isMedlineIndexed: raw.isMedlineIndexed ?? false,
}));

// Export unique subject areas and locations for filters
export const ALL_SUBJECT_AREAS = Array.from(new Set(RAW_JOURNALS.flatMap((j) => j.subjectAreas))).sort();
export const ALL_GEOGRAPHIC_LOCATIONS = Array.from(new Set(RAW_JOURNALS.map((j) => j.geographicLocation))).sort();
