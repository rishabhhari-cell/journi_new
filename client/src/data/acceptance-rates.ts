// Curated acceptance rate lookup keyed by normalised ISSN (no hyphens).
// Sourced from journal About pages and published annual reports.
// Update periodically as journals publish new stats.
// Used to enrich API-sourced journal results that lack a static DB match.

export const ACCEPTANCE_RATES: Record<string, number> = {
  // General / Internal Medicine
  '00284793': 5,   // NEJM
  '01406736': 5,   // The Lancet
  '00987484': 5,   // JAMA
  '09598138': 7,   // The BMJ
  '10788956': 8,   // Nature Medicine
  '00034819': 8,   // Annals of Internal Medicine
  '15491676': 12,  // PLOS Medicine
  '00256196': 15,  // Mayo Clinic Proceedings
  '21686106': 7,   // JAMA Internal Medicine
  '2214109X': 6,   // The Lancet Global Health
  '08203946': 12,  // CMAJ
  '0025729X': 15,  // Medical Journal of Australia
  '09536205': 20,  // European Journal of Internal Medicine
  '09546820': 18,  // Journal of Internal Medicine
  '17417015': 10,  // BMC Medicine

  // Oncology
  '00079235': 4,   // CA: A Cancer Journal for Clinicians
  '14702045': 6,   // The Lancet Oncology
  '0732183X': 10,  // Journal of Clinical Oncology
  '1474175X': 8,   // Nature Reviews Cancer
  '15356108': 8,   // Cancer Cell
  '21598274': 10,  // Cancer Discovery
  '00085472': 15,  // Cancer Research
  '23742437': 8,   // JAMA Oncology
  '09237534': 12,  // Annals of Oncology
  '10780432': 15,  // Clinical Cancer Research
  '09598049': 18,  // European Journal of Cancer
  '00070920': 20,  // British Journal of Cancer
  '00207136': 22,  // International Journal of Cancer
  '20726694': 35,  // Cancers
  '2234943X': 38,  // Frontiers in Oncology
  '14712407': 40,  // BMC Cancer

  // Cardiology
  '0195668X': 10,  // European Heart Journal
  '00097322': 10,  // Circulation
  '07351097': 10,  // JACC
  '17595002': 8,   // Nature Reviews Cardiology
  '00097330': 12,  // Circulation Research
  '23806583': 8,   // JAMA Cardiology
  '13556037': 18,  // Heart
  '00028703': 25,  // American Heart Journal
  '01675273': 30,  // International Journal of Cardiology
  '2297055X': 38,  // Frontiers in Cardiovascular Medicine

  // Neuroscience / Neurology
  '10976256': 8,   // Nature Neuroscience
  '08966273': 10,  // Neuron
  '14744422': 5,   // The Lancet Neurology
  '00068950': 12,  // Brain
  '03645134': 15,  // Annals of Neurology
  '21686149': 7,   // JAMA Neurology
  '00283878': 15,  // Neurology
  '02706474': 22,  // Journal of Neuroscience
  '1662453X': 35,  // Frontiers in Neuroscience
  '10538119': 25,  // NeuroImage
  '13524585': 20,  // Multiple Sclerosis Journal
  '00139580': 22,  // Epilepsia

  // Surgery
  '00034932': 12,  // Annals of Surgery
  '21686254': 8,   // JAMA Surgery
  '00071323': 15,  // British Journal of Surgery
  '00396060': 25,  // Surgery
  '10727515': 18,  // Journal of the American College of Surgeons
  '03642313': 30,  // World Journal of Surgery
  '09302794': 28,  // Surgical Endoscopy

  // Pediatrics
  '00314005': 12,  // Pediatrics
  '21686203': 7,   // JAMA Pediatrics
  '23524642': 8,   // The Lancet Child & Adolescent Health
  '00223476': 20,  // Journal of Pediatrics
  '00039888': 18,  // Archives of Disease in Childhood
  '00313998': 25,  // Pediatric Research

  // Psychiatry
  '2168622X': 7,   // JAMA Psychiatry
  '22150366': 6,   // The Lancet Psychiatry
  '0002953X': 10,  // American Journal of Psychiatry
  '13594184': 12,  // Molecular Psychiatry
  '00071250': 15,  // British Journal of Psychiatry
};
