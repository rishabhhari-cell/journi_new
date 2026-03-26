import type { CitationFormData } from '@/types';

export interface SeededSectionData {
  title: string;
  content: string;
}

export interface SeededPaperData {
  source: {
    doi: string;
    articleUrl: string;
    issueUrl: string;
    publishedAt: string;
  };
  manuscriptTitle: string;
  paperTitle: string;
  sections: SeededSectionData[];
  citations: Array<CitationFormData & { metadata?: Record<string, unknown> }>;
}

export const OUP_AI_REVIEW_SEED: SeededPaperData = {
  "source": {
    "doi": "10.1093/bmb/ldab016",
    "articleUrl": "https://academic.oup.com/bmb/article/139/1/4/6353269?login=false",
    "issueUrl": "https://academic.oup.com/bmb/issue/139/1",
    "publishedAt": "2021-08-17"
  },
  "manuscriptTitle": "AI Systematic Review",
  "paperTitle": "The promise of artificial intelligence: a review of the opportunities and challenges of artificial intelligence in healthcare",
  "sections": [
    {
      "title": "Title",
      "content": "<p>The promise of artificial intelligence: a review of the opportunities and challenges of artificial intelligence in healthcare</p>"
    },
    {
      "title": "Abstract",
      "content": "<h3>Introduction</h3><p>Artificial intelligence (AI) and machine learning (ML) are rapidly evolving fields in various sectors, including healthcare. This article reviews AI’s present applications in healthcare, including its benefits, limitations and future scope.</p><h3>Sources of data</h3><p>A review of the English literature was conducted with search terms ‘AI’ or ‘ML’ or ‘deep learning’ and ‘healthcare’ or ‘medicine’ using PubMED and Google Scholar from 2000–2021.</p><h3>Areas of agreement</h3><p>AI could transform physician workflow and patient care through its applications, from assisting physicians and replacing administrative tasks to augmenting medical knowledge.</p><h3>Areas of controversy</h3><p>From challenges training ML systems to unclear accountability, AI’s implementation is difficult and incremental at best. Physicians also lack understanding of what AI implementation could represent.</p><h3>Growing points</h3><p>AI can ultimately prove beneficial in healthcare, but requires meticulous governance similar to the governance of physician conduct.</p><h3>Areas timely for developing research</h3><p>Regulatory guidelines are needed on how to safely implement and assess AI technology, alongside further research into the specific capabilities and limitations of its medical use.</p>"
    },
    {
      "title": "Introduction",
      "content": "<p>The application of AI ( Fig. 1 ) in medicine was first described in 1976, when a computer algorithm was used to identify causes of acute abdominal pain. Since then, there have been diverse and manifold applications of AI in medicine proposed. These range from aiding in the detection of disease, such as in detecting skin cancers in dermatology or diabetic retinopathy in ophthalmology; to the improved classification of pathology, for example in classifying scans in radiology or delineating electrocardiogram features in cardiology; to predicting disease patterns and epidemiology, a prime example of which being ML-based algorithms developed during the COVID-19 pandemic. However, despite the healthcare industry’s heavy investment into AI technology, adoption of AI solutions and their implementation in healthcare remains in its infancy. Some of the most pressing current challenges facing healthcare are reduced expenditure, physician shortage and burnout, and the shift towards chronic disease management. As the workforce appears critically stretched, it has been proposed that AI, in particular deep learning, could be key to filling this gap. If AI systems are more widely adopted, not only could it reduce workload but also increase the quality of patient care. The question therefore remains: if such opportunities for AI in healthcare do exist, why do they remain untapped, and what hinders their implementation In this article, we review and describe the current benefits and challenges in AI use in healthcare as highlighted by the literature thus far.</p><p>Some key definitions pertaining to AI.</p>"
    },
    {
      "title": "Search Strategy",
      "content": "<p>A review of the English literature was conducted with search terms ‘AI’ or ‘ML’ or ‘deep learning’ and ‘healthcare’ or ‘medicine’ using PubMED and Google Scholar from 2000–2021.</p>"
    },
    {
      "title": "Results & Synthesis",
      "content": "<p>The impact of AI on the general workforce, as well as specifically in healthcare, may be considered using four concepts—relieving, splitting up, replacing and augmenting ( Fig. 2 ).</p><p>A summary of the benefits of AI in healthcare, as proposed by Eggers.</p><h3>Relieving workload</h3><p>First, AI can relieve the critically stretched workload of healthcare professionals. Although the advent of information technology such as electronic health records was meant to simplify and integrate patient care, it has resulted in burnout symptoms in many doctors, from difficulty navigating the technological systems to being burdened by their bureaucracy. AI could help by assisting clerking duties similarly to a medical scribe, or assisting those facing difficulty operating the system. Alternatively, AI could synthesize patient records and summarize health concerns for the physician; rather than manually sifting through patient data, AI could search through available information much faster and highlight key points.</p><p>Second, AI could also relieve workload in specialties involving diagnostic images and their interpretation. DL has demonstrated robust performance in detecting various medical conditions including diabetic retinopathy, tuberculosis, breast cancer and irregular heart rhythms. AI could work as an initial screening tool in scan interpretation, prioritizing those of concern so that the physician’s attention can be brought to critical situations quicker. From an economical perspective, this would also save time and resources. For example, Optellum is a tool that automatically scans lung X-ray images taken in hospitals and highlights those of concern. Similarly, in cardiology and radiology, AI can be used as a preliminary tool to screen images, potentially even partially completing reports for physicians to then approve. This not only reduces manual workload, but can eliminate unnecessary further investigation. For example, the American College of Cardiology recently introduced an AI initiative tracking appropriate use criteria for radionucleotide imaging, which reduced instances of inappropriate imaging from 10% to 5%.</p><h3>Splitting up tasks</h3><p>Splitting up the workload of healthcare practitioners using ML algorithms would streamline the efforts of human workers. To this end, AI could be used to reduce hospital admissions by circumventing unnecessary admissions before they occur. For example, the UK’s National Health Service is trialing ML-based Babylon chatbots that can determine a medical diagnosis through a series of questions, thereby diverting patients to the appropriate healthcare pathway. Beyond national programs, there are also many smartphone applications giving patients tailored health advice without being in hospital. These include applications that can diagnose symptoms or offer advice on whether one should seek further help, or assist in managing chronic diseases such as diabetes or asthma, in order to prevent hospital admission. While the safety of such applications may be debated, the opportunity for AI to split off a portion of patients that would typically report to a hospital is clear.</p><h3>Replacing certain tasks</h3><p>AI can be used to replace some tasks normally carried out by healthcare professionals. Many of the administrative jobs that physicians or nurses complete are repetitive and require little cognition. These could easily be replaced by AI applications. For example, Ting et al. demonstrated a comparable diagnostic performance between human graders versus AI in a national diabetic retinopathy screening program that could potentially reduce the screening load by 75%. Again, this would free up valuable time and cognitive effort for healthcare workers to focus on more complex tasks that AI cannot replicate, such as patient interaction. In addition, this could also reduce cost in large-scale screening services.</p><h3>Augmenting clinical practice</h3><p>Most importantly, AI has massive potential to augment clinical practice and patient care. Here, AI not only complements the work of healthcare professionals but could even extend the scope of what they can do. AI can provide quantitative skill beyond what humans are capable of, with a higher level of precision and detail. For example, a DL model CADx classifying breast tumors as benign or malignant showed higher diagnostic accuracy and sensitivity than humans or previous algorithms. DL has also been used to analyze stroke treatment, specifically tissue plasminogen activator treatment, to predict the likelihood of intracranial haemorrhage.</p><p>AI could also act as a decision making aid. A key issue in healthcare today is medical error, as doctors like all humans are prone to err. When considering their immense workload and stress, it seems understandable that they would make mistakes. However, in healthcare mistakes can have disastrous consequences. Therefore, it would be optimal for AI to act as a second pair of eyes, reducing medical error due to the precision of the algorithm. Beyond correcting for accidental error, AI can also enable better clinical decision making by providing up-to-date guidance on clinical guidelines or developments. Physicians are hard-pressed to constantly keep up with the latest clinical recommendations and policies. There has been research into whether AI software could assist in such situations and provide real-time advice based in specific contexts. For example, IBM Watson Health is employing ML to assist in clinical decision-making in cancer patients to predict the best clinical outcome, with 99% of the recommendations compliant with that of physicians.</p><p>Another way of augmenting clinical care would be to augment the database of medical knowledge. Specifically, unsupervised ML creates algorithms from a given dataset and outcomes, thus predicting patterns. Importantly, the algorithm improves as more and more data is fed into it, through a feedback mechanism that ensures higher levels of precision at every stage. These techniques could be used to predict patient risk in communicable diseases and stratify risks within the population. Unsupervised learning could also help in disease classification, identifying through its algorithms separate subtypes to ensure more tailored care and accurate prognoses. For example, DL has been applied to magnetic resonance images of strokes to classify endophenotypes of motor disability post-stroke. Natural language processing similarly can assist in characterizing and classifying diseases by discovering relevant keywords that commonly appear in diagnosis, or that link to adverse outcomes. Ultimately, AI can be thought of as identifying ‘anomalous patterns’ that can influence patient outcomes and devising potential hypotheses to explain them. Therefore, we can also use AI to increase our medical knowledge and improve care.</p><p>Finally, AI has shown great promise in the analysis of -omics biological datasets because they are extremely adept at inference from complex inputs. In particular, AI has been successful in various steps in clinical genomic analysis, including variant calling, genome annotation, variant classification, and phenotype–genotype correspondence. Taking this further, there is increasing research aiming to integrate genomics information with epigenetics, transcriptomics and proteomics to increase the understanding of biological networks in health and disease. AI is therefore already augmenting our understanding of biology and pathology, with future application of these algorithms as clinical decision support tools requiring further acquisition of both -omics and phenotype data.</p>"
    },
    {
      "title": "Discussion",
      "content": "<p>There are diverse challenges to the successful implementation of any information technology in healthcare, let alone AI. These challenges occur at all stages of AI implementation: data acquisition, technology development, clinical implementation, ethical and social issues ( Fig. 3 ).</p><p>A summary of the drawbacks of AI in healthcare from multiple perspectives.</p><h3>Data challenges</h3><p>The first barrier is data availability. ML and deep learning models require large datasets to accurately classify or predict different tasks. Sectors where ML has seen immense progression are those with large datasets available to enable more complex, precise algorithms. In healthcare, however, the availability of data is a complex issue. On the organizational level, health data is not only expensive, but there is ingrained reluctance towards data sharing between hospitals as they are considered the property of each hospital to manage their individual patients. A further issue faced is the continued availability of data following introduction of the algorithm analyzing it. Ideally, ML-based systems would require continuous improvement from training with progressively bigger datasets. However, due to organizational resistance, this is often difficult to achieve. To this end, it has been suggested that what is required for information technology and AI to progress in healthcare is a transformative shift from focusing on individual patient treatment to overall patient outcomes, thus incentivising data sharing to improve clinical outcomes. Additionally, technical developments may alleviate the challenge of limited datasets, for example through improved algorithms that can work on a unimodal or less expansive basis as opposed to multimodal learning; as well as the converse challenge of storing these ever-increasing datasets, through the increased uptake of cloud computing servers.</p><p>AI-based applications bring concerns about data privacy and security. Health data is sensitive and a frequent target for data breaches. The protection of patient data is thus paramount. With the development of AI comes additional concerns regarding data privacy, as individuals may mistake artificial systems for humans and allow further unconscious data collection. Patient consent is therefore a crucial component in data privacy concerns, as healthcare organizations may permit the large-scale use of patient data for AI training without sufficient individual patient consent. Such was the case in 2018, when DeepMind Health were acquired by Google. Their application, Streams, containing an algorithm for managing patients with acute kidney injuries, had come under fire when it was revealed that the NHS had given the data of 1.6 million patients without their consent to DeepMind servers to train its algorithm. In the USA, Google was also investigated on patients’ data privacy on Project Nightingale. Now with the application officially on Google servers, data privacy represents an even larger concern.</p><p>Potential solutions to this issue include the tightening of regulations and laws with regard to personal data, such as the General Data Processing Regulations and Health Research Regulations enforced across Europe in 2018. However, such regulations put into place to protect data and ameliorate this issue can reduce the amount of data available to train AI systems on both a national and international scale, as the different regulations applied to different regions complicate matters of cooperation and collaborative research. Therefore, these regulations importantly must be coupled with improved data security practices, in order to not hinder developments in the field. These range from better data encryption individually, to the use of federated learning, where models can be trained centrally despite data being distributed locally across various clients.</p><p>The quality of data used to train systems is also difficult to ascertain. Patient data is estimated to have a half-life of roughly 4 months, implying that some predictive models may not be as successful at anticipating future outcomes as in replicating those of the past. Health data is also frequently messy—it is inconsistent, occasionally inaccurate and lacks standardization in how it is stored and formatted. Despite efforts at data cleansing and processing, unknown gaps will consequently exist in the datasets training AI systems. Although this is likely to improve, particularly as electronic health records are more widely adopted, issues of standardization and interoperability between institutions remain, which then limit the scale and precision of the data on which algorithms are to be devised.</p><h3>Developer challenges</h3><p>Biases may occur in the collection of the data used to train models, leading to biased outcomes. For example, racial biases may be introduced in the creation of datasets, with minorities being under-represented thereby leading to lower-than-expected prediction performance. Various methods exist to counteract this bias, such as including creating multi-ethnic training sets. Conversely, bias can also be addressed within AI models, such as a recent bias-resilient neural network that reduces the effect of such confounding variables. Only time will tell whether such approaches will be successful in eliminating biases in practice.</p><p>Following the procurement of data, the next challenge lies in the development of the AI technology. Overfitting may occur, where the system learns relationships between patient variables and outcomes that are not relevant. It is the result of having too many variable parameters relative to outcomes, thus the algorithm predicts using inappropriate features. The algorithm may therefore work within the training dataset, but give inaccurate results when predicting future outcomes. Another concern is data leakage. If the algorithm has exceedingly positive predictive accuracy, it is possible that a covariate in the dataset has accidentally alluded to the outcome, negating the significance of the algorithm in predicting outcomes outside of the training dataset. This issue however can only then be addressed through the use of external datasets to validate the results, which would then require a separate dataset for comparison. Better collaboration between organizations or even on a national level is thus necessary to allow for distinct datasets for comparison, such as the national clinical research network PCORnet linking data across multiple healthcare systems in the USA.</p><p>One popular criticism of AI technologies is the ‘black-box’ problem. Deep learning algorithms are often unable to provide detailed explanations for their predictions. Legally, this poses an issue should the recommendations be mistaken, as the system cannot provide justification for itself. This is also a barrier to the scientific understanding of the connection between the data and the predictions. More importantly, the ‘black box’ may undermine patients’ trust in the system. This debate is ongoing, but it is worth noting that many commonly used drugs such as paracetamol have a poorly understood mechanism of action, and most physicians have no more than a basic knowledge of technologies such as magnetic resonance imaging or computed tomography. Nevertheless, this is an active area of research, with Google recently publishing a tool to help create interpretable AI algorithms.</p><h3>Clinical implementation challenges</h3><p>The first barrier to successful implementation is the lack of empirical evidence proving the efficacy of AI-based interventions in prospective clinical trials. Empirical research remains scarce and largely pertains to AI in the general workforce, not its effect on patient outcomes. Research into AI’s effect in healthcare is mostly preclinical, and occurs in artificial environments. Results are therefore difficult to extrapolate to reality. Randomized controlled trials are considered the gold standard in medicine but are lacking in proving the efficacy of AI in healthcare. The first systematic review was published of deep learning performance in detecting diseases from medical imaging —this showed that deep learning models perform similarly to human professionals, and few studies externally validated their results or compared performance between humans and algorithm using the same dataset. Thus, it is slow and difficult for organizations to adopt AI-based interventions considering the lack of empirical proof and variable quality of research.</p><p>Subsequent to the adoption of AI, the next stage to successful implementation would be integration into physician workflow. With all information technology, it is crucial that maximum usability is ensured for a positive effect on reducing workload. For AI-based interventions, be that to do with scan interpretation or navigating electronic medical records, they must speed up rather than slow down physicians. This includes time and resources spent training physicians and healthcare providers to use the technology. To this date, instances of successful integration of AI into clinical care are lacking and remain mostly in trial stages. In many instances of information technology adoption, the key barrier to successful integration has been stakeholder involvement in the development process. Opinions from multiple stakeholders are vital to ensure that the resulting product can be integrated into physician workflow. A key example of this is the multitude of AI innovations that have been created in the wake of the COVID-19 pandemic, understandably aimed at improving outcomes through better epidemiological predictions or earlier diagnoses. However, these rapidly produced innovations are not without their pitfalls, as their successful implementation is contingent on proper integration within physician workflow without confusing or slowing down physicians untrained in AI use.</p><h3>Ethical challenges</h3><p>Ethical concerns and protests have beleaguered AI since its inception. Aside from those regarding data privacy and safety listed previously, the main concern is accountability. Particularly in healthcare, poor decisions carry heavy consequences and the current paradigm is that some person must be held accountable. AI is often viewed as a ‘black-box’ where one cannot discern why the algorithm arrived at a particular prediction or recommendation. One could argue that the ‘black-box’ phenomenon need not be as concerning for algorithms in applications with lower stakes at hand, such as those that are not patient-centered but instead focused on efficiency or improved operations. However, the question of accountability is far more crucial when considering AI applications that aim to improve outcomes for patients, especially when things go wrong. Therefore it is unclear who should take responsibility should the system be wrong. To hold the physician accountable may seem unfair as the algorithm is neither developed nor controlled in any manner by them, yet to hold the developer accountable seems too removed from the clinical context. In China, it is illegal for AI to make any decision in healthcare, requiring some form of human input such that they are held accountable.</p><p>This issue is further complicated by the absence of industry guidelines on the ethical use of AI and ML in healthcare. Without universal standards for how AI is to be used, the extent to which it can be ethically adopted in hospitals is unclear. To this end, the US Food and Drug Administration (FDA) has begun its first attempt at defining guidance for how to evaluate the safety and efficacy of AI systems. The NHS is similarly defining a code of guidelines on how to prove efficacy of AI-driven technology, that also aims not to complicate innovation and adoption in the vetting process. Both attempts remain in progress, and it represents a barrier to the approval of AI-based interventions by courts and regulatory boards. Moreover, it is important that a more public debate of these ethical issues takes place, ultimately leading to the adoption of a universal ethical standard that benefits patients.</p><h3>Social challenges</h3><p>A longstanding concern regarding AI in healthcare is the fear it will replace jobs, thus rendering healthcare workers obsolete. The threat of replacement translates to distrust and dislike of AI-based interventions. However, this belief is based largely on a misunderstanding of AI in its various forms. Even when disregarding the years that it would hypothetically take for AI to be advanced enough to successfully replace healthcare workers, the introduction of AI does not mean that jobs become obsolete, but rather re-engineered. Many aspects of medicine are innately human and unpredictable and cannot ever be completely linear or structured like an algorithm. However, the damaging effect of distrust in AI is clear and represents a further challenge to its adoption. Conversely, insufficient understanding of AI may lead to unrealistically high expectations of its results and efficacy. The general public may misunderstand the current capabilities of AI, and their resulting disappointment may give way to reluctance to trust such technology. Therefore again, a more public debate about AI in healthcare is needed to address these beliefs amongst both patients and healthcare professionals.</p>"
    },
    {
      "title": "Limitations",
      "content": "<p>Several limitations of this review must be acknowledged. First, this is a narrative rather than systematic review, and as such is subject to inherent selection bias in the literature chosen for inclusion. The authors’ choices regarding which studies and examples to highlight may not be fully representative of the breadth of research in this field, and a formal quality appraisal of included studies was not performed.</p><p>Second, the search was restricted to English-language publications retrieved from PubMED and Google Scholar, which may have introduced language bias and excluded relevant findings published in other languages or indexed in databases not searched, such as Embase, Cochrane or regional repositories. Grey literature, conference proceedings and preprints were likewise not systematically captured.</p><p>Third, the literature search covered the period 2000–2021; given the exceptionally rapid pace of development in artificial intelligence and machine learning, a number of the findings summarised here may already be superseded. Technologies, regulatory frameworks and clinical deployment examples referenced were current as of the search date, and readers should interpret the review in that temporal context.</p><p>Fourth, the majority of primary studies cited originate from high-income countries—predominantly the United States and United Kingdom—which limits the generalisability of conclusions to lower-resource healthcare settings where infrastructure, data availability and regulatory environments differ substantially.</p><p>Finally, the scope of this review focused on opportunities and challenges at a broad level; it did not undertake a quantitative synthesis or meta-analysis of clinical outcome data, and the heterogeneity of AI applications surveyed prevents definitive conclusions about comparative efficacy across specialties. Future systematic reviews with pre-registered protocols and quantitative pooling of outcome data are needed to provide stronger evidence for specific clinical use cases.</p>"
    },
    {
      "title": "Conclusions",
      "content": "<p>Undoubtedly, AI has untapped potential in healthcare. If successfully implemented, AI could relieve workload for healthcare professionals and increase the quality of work produced by reducing error and increasing precision. It could grant patients more responsibility in their health management and reduce unnecessary hospital admissions. It could also extend the scope of medical knowledge, improving upon current clinical recommendations. However, the accompanying challenges are significant. Acquiring sufficient data to train precise algorithms is an ongoing process, requiring a shift in thinking towards data sharing that supports technological development. Clear guidelines are needed on how to safely implement and assess AI technology, as well as research on the capabilities and limitations of AI. Robust study is also needed to empirically prove the benefits of AI use in the real world. While the optimal conditions for successful AI adoption may not yet be met, there is still space for progression of AI in healthcare. To that end, there are several key considerations of note.</p><p>Given the lack of consensus in AI governance, it may not presently be possible to devise AI-based systems whose algorithms can be generalized across healthcare settings. Thus, it may be prudent to focus on systems that can be implemented and used effectively in the institutions they were built. Fundamentally, patient care must be prioritized over the excitement of ground-breaking technology. The safety and competence of the artificial system must be weighed, such that its use is only where appropriate and beneficial to patients.</p><p>Secondly, AI in healthcare must still be accompanied by human input. Although AI may have advantages of speed and accuracy, physicians are still required for the more cognitively complex or emotional aspects and tasks. In the same manner that measuring and monitoring vital signs is now automated, the idea behind AI is not to erase physician input altogether, but focus their talents on where they are more critical and on what machines cannot and may never replicate.</p><p>Thirdly, while it is important to temper expectations, it is crucial not to be overly pessimistic on AI’s role in healthcare. While physicians may not understand the mechanisms of AI algorithms, the same could be said to some extent of most physicians’ understanding of magnetic resonance imaging or computed tomography. These investigations are widely adopted despite a lack of individual physician understanding on their precise mechanism. The lack of transparency in ML algorithms may therefore be somewhat acceptable, provided the algorithm’s efficacy can be proven.</p><p>Rather than holding AI to a criterion of either perfect results or naught, one should compare the results of employing AI to that of the real world, where physicians can and will make mistakes. Importantly, AI is also dynamic in nature, capable of improving with larger datasets. It is therefore entirely feasible that the integrated use of both physician and AI input would be more effective than the sum of its parts, and can show continued improvement with time.</p><p>The opportunities for enhancing the experience of both patients and physicians seem clear. However, it is important not to overestimate the current state of AI. Its adoption in healthcare will be a careful, slow and incremental process, involving tight regulation and monitoring of its use and efficacy. United with input and supervision from healthcare professionals, AI can serve patients and improve quality of care.</p>"
    },
    {
      "title": "References",
      "content": "<ol><li>Fogel AL, Kvedar JC. Artificial intelligence powers digital medicine. Npj Digit Med [Internet] 14 March 2018 [cited 9 November 2018]; 1: 5. http://www.nature.com/articles/s41746-017-0012-2.</li><li>Topol EJ. High-performance medicine: the convergence of human and artificial intelligence. Nat Med [Internet] 2019; 25: 44 – 56. 10.1038/s41591-018-0300-7.</li><li>Chen J, See K. Artificial intelligence for COVID-19: rapid review. J Med Internet Res 2020; 22: e21476. 10.2196/21476.</li><li>Meskó B, Hetényi G, Győrffy Z. Will artificial intelligence solve the human resource crisis in healthcare BMC Health Serv Res [Internet] 2018 [cited 9 November 2018]; 18: 545. https://bmchealthservres.biomedcentral.com/articles/10.1186/s12913-018-3359-4.</li><li>Eggers WD, Schatsky D, Viechnicki P. AI-augmented government: Using cognitive technologies to redesign public sector work A report from the Deloitte Center for Government Insights [Internet]. 2017. https://www2.deloitte.com/us/en/insights/focus/cognitive-technologies/artificial-intelligence-government.html</li><li>Verghese A, Shah NH, Harrington RA. What this computer needs is a physician. JAMA [Internet] 2018 Jan 2 [cited 14 November 2018]; 319: 19. http://jama.jamanetwork.com/article.aspxdoi=10.1001/jama.2017.19198.</li><li>Spencer M. Brittleness and bureaucracy: software as a material for science. Perspect Sci [Internet] 2015 [cited 14 November 2018]; 23: 466 – 84. http://www.mitpressjournals.org/doi/10.1162/POSC_a_00184.</li><li>Dilsizian SE, Siegel EL. Artificial intelligence in medicine and cardiac imaging: harnessing big data and advanced computing to provide personalized medical diagnosis and treatment. Curr Cardiol Rep [Internet] 2014 [cited 9 November 2018]; 16: 441. http://www.ncbi.nlm.nih.gov/pubmed/24338557.</li><li>Ting DSW, Cheung CYL, Lim G et al. Development and validation of a deep learning system for diabetic retinopathy and related eye diseases using retinal images from multiethnic populations with diabetes. JAMA 2017; 318: 2211 – 23.</li><li>Lakhani P, Sundaram B. Deep learning at chest radiography: automated classification of pulmonary tuberculosis by using convolutional neural networks. Radiology 2017; 284: 574 – 82.</li><li>McKinney S, Sieniek M, Godbole V et al. International evaluation of an AI system for breast cancer screening. Nature 2020; 577: 89 – 94.</li><li>Attia Z, Noseworthy P, Lopez-Jimenez F et al. An artificial intelligence-enabled ECG algorithm for the identification of patients with atrial fibrillation during sinus rhythm: a retrospective analysis of outcome prediction. Lancet 2019; 394: 861 – 7.</li><li>Houlton S. How artificial intelligence is transforming healthcare [Internet]. Prescriber 2018 [cited 14 November 2018]. https://www.prescriber.co.uk/article/how-artificial-intelligence-is-transforming-healthcare/.</li><li>Kahn CE. From images to actions: opportunities for artificial intelligence in radiology. Radiology 2017; 285:7.</li><li>Saifi S, Taylor AJ, Allen J et al. The use of a learning community and online evaluation of utilization for SPECT myocardial perfusion imaging. JACC Cardiovasc Imaging 2013; 6: 823 – 9.</li><li>Armstrong S. The apps attempting to transfer NHS 111 online. BMJ [Internet] 2018 [cited 14 November 2018]; 360: k156. http://www.ncbi.nlm.nih.gov/pubmed/29335297.</li><li>Lupton D, Jutel A. ‘It’s like having a physician in your pocket!’ A critical analysis of self-diagnosis smartphone apps. Soc Sci Med [Internet] 2015 [cited 14 November 2018]; 133: 128 – 35. https://www.sciencedirect.com/science/article/pii/S0277953615002245.</li><li>Stewart J, Sprivulis P, Dwivedi G. Artificial intelligence and machine learning in emergency medicine. Emerg Med Australas [Internet] 2018 [cited 15 November 2018]; 30: 870 – 4. http://doi.wiley.com/10.1111/1742-6723.13145.</li><li>Jones LD, Golan D, Hanna SA et al. Artificial intelligence, machine learning and the evolution of healthcare. Bone Joint Res [Internet] 2018 [cited 9 November 2018]; 7: 223 – 5. http://online.boneandjoint.org.uk/doi/10.1302/2046-3758.73.BJR-2017-0147.R1.</li><li>Tufail A, Rudisill C, Egan C et al. Automated diabetic retinopathy image assessment software. Ophthalmology 2017; 124: 343 – 51.</li><li>Cheng J-Z, Ni D, Chou Y-H et al. Computer-aided diagnosis with deep learning architecture: applications to breast lesions in US images and pulmonary nodules in CT scans. Sci Rep [Internet] 2016 [cited 14 November 2018]; 6: 24454. http://www.nature.com/articles/srep24454.</li><li>Jiang F, Jiang Y, Zhi H et al. Artificial intelligence in healthcare: past, present and future. Stroke Vasc Neurol [Internet] 2017 [cited 9 November 2018]; 2: 230 – 43. http://www.ncbi.nlm.nih.gov/pubmed/29507784.</li><li>Oliveira T, Novais P, Neves J. Development and implementation of clinical guidelines: an artificial intelligence perspective. Artif Intell Rev [Internet] 2014 [cited 15 November 2018]; 42: 999 – 1027. http://link.springer.com/10.1007/s10462-013-9402-2.</li><li>Neill DB. Using artificial intelligence to improve hospital inpatient care. IEEE Intell Syst 2013; 28: 92 – 5.</li><li>Dias R, Torkamani A. Artificial intelligence in clinical and genomic diagnostics. Genome Med 2019; 11: 70.</li><li>Zitnik M, Nguyen F, Wang B et al. Machine learning for integrating data in biology and medicine: principles, practice, and opportunities. Inf Fusion [Internet] 2019; 50: 71 – 91. https://doi.org/10.1016/j.inffus.2018.09.012.</li><li>Johnson KW, Torres Soto J, Glicksberg BS et al. Artificial intelligence in cardiology. J Am Coll Cardiol [Internet] 2018 [cited 15 November 2018]; 71: 2668 – 79. https://linkinghub.elsevier.com/retrieve/pii/S0735109718344085.</li><li>Lopez K, Fodeh S, Allam A et al. Reducing annotation burden through multimodal learning. Frontiers In Big Data 2020; 3:8. 10.3389/fdata.2020.00019.</li><li>Sun TQ, Medaglia R. Mapping the challenges of artificial intelligence in the public sector: evidence from public healthcare. Gov Inf Q [Internet] 2018 [cited 9 November 2018]. https://linkinghub.elsevier.com/retrieve/pii/S0740624X17304781.</li><li>Luxton DD. Recommendations for the ethical use and design of artificial intelligent care providers. Artif Intell Med [Internet] 2014 [cited 15 November 2018]; 62: 1 – 10. http://www.ncbi.nlm.nih.gov/pubmed/25059820.</li><li>Powles J, Hodson H. Google DeepMind and healthcare in an age of algorithms. Health Technol (Berl) [Internet] 2017 [cited 15 November 2018]; 7: 351 – 67. http://link.springer.com/10.1007/s12553-017-0179-1.</li><li>Clarke N, Vale G, Reeves E et al. GDPR: an impediment to research Irish Journal Of Medical Science (1971) 2019; 188: 1129 – 35. 10.1007/s11845-019-01980-2.</li><li>Pesapane F, Volonté C, Codari M et al. Artificial intelligence as a medical device in radiology: ethical and regulatory issues in Europe and the United States. Insights Imaging 2018; 9: 745 – 53. 10.1007/s13244-018-0645-y.</li><li>Forcier M, Gallois H, Mullan S et al. Integrating artificial intelligence into health care through data access: can the GDPR act as a beacon for policymakers J Law Biosci 2019; 6: 317 – 35. 10.1093/jlb/lsz013.</li><li>Wang F, Preininger A. AI in health: state of the art, challenges, and future directions. Yearb Med Inform 2019; 28: 016 – 26. 10.1055/s-0039-1677908.</li><li>Wiens J, Shenoy ES. Machine learning for healthcare: on the verge of a major shift in healthcare epidemiology. Clin Infect Dis [Internet] 2018 [cited 9 November 2018]; 66: 149 – 53. http://www.ncbi.nlm.nih.gov/pubmed/29020316.</li><li>Wang F, Casalino L, Khullar D. Deep learning in medicine—promise, progress, and challenges. JAMA Intern Med 2019; 179: 293. 10.1001/jamainternmed.2018.7117.</li><li>Kleinberg J, Ludwig J, Mullainathan S et al. Discrimination in the age of algorithms. J Leg Anal 2018; 10: 113 – 74.</li><li>Adeli E, Zhao Q, Pfefferbaum A et al. Bias-resilient neural network. ArXiv [Internet] 2019; 1 – 12. http://arxiv.org/abs/1910.03676 23 November 2020, preprint: not peer reviewed.</li><li>Price WN. Artificial intelligence in health care: applications and legal implications. The SciTech Lawyer [Internet] 2017 [cited 15 November 2018]; 14: 10 – 3. https://repository.law.umich.edu/articles.</li><li>Watson DS, Krutzinna J, Bruce IN et al. Clinical applications of machine learning algorithms: beyond the black box. BMJ [Internet] 2019; 364, 10 – 13. http://dx.doi.org/doi:10.1136/bmj.l886.</li><li>Google. AI Explainability Whitepaper [Internet]. Google Cloud; 2019. p. 1 – 27. https://storage.googleapis.com/cloud-ai-whitepapers/AI Explainability Whitepaper.pdf</li><li>Wang F, Kaushal R, Khullar D. Should health care demand interpretable artificial intelligence or accept “black box” medicine Ann Intern Med 2019; 172: 59. 10.7326/m19-2548.</li><li>Ramesh AN, Kambhampati C, Monson JRT et al. Artificial intelligence in medicine. Ann R Coll Surg Engl [Internet] 2004 [cited 9 November 2018]; 86: 334 – 8. http://www.ncbi.nlm.nih.gov/pubmed/15333167.</li><li>Liu X, Faes L, Kale AU et al. A comparison of deep learning performance against health-care professionals in detecting diseases from medical imaging: a systematic review and meta-analysis. Lancet Digit Heal Internet 2019; 1: e271 – e297. 10.1016/S2589-7500(19)30123-2.</li><li>GOV.UK. Initial code of conduct for data-driven health and care technology [Internet]. UK Department of Health &amp; Social Care. 2019 [cited 18 November 2018]. https://www.gov.uk/government/publications/code-of-conduct-for-data-driven-health-and-care-technology/initial-code-of-conduct-for-data-driven-health-and-care-technology</li></ol>"
    }
  ],
  "citations": [
    {
      "authors": [
        "Fogel"
      ],
      "title": "Artificial intelligence powers digital medicine",
      "year": 2018,
      "journal": "Npj Digit Med",
      "doi": "10.1038/s41746-017-0012-2",
      "url": "https://doi.org/10.1038/s41746-017-0012-2",
      "type": "article",
      "volume": "1",
      "pages": "5",
      "metadata": {
        "refIndex": 1,
        "raw": "Fogel AL, Kvedar JC. Artificial intelligence powers digital medicine. Npj Digit Med [Internet] 14 March 2018 [cited 9 November 2018]; 1: 5. http://www.nature.com/articles/s41746-017-0012-2.",
        "crossrefKey": "2021091012574367300_ref1"
      }
    },
    {
      "authors": [
        "Topol"
      ],
      "title": "High-performance medicine: the convergence of human and artificial intelligence",
      "year": 2019,
      "journal": "Nat Med",
      "doi": "10.1038/s41591-018-0300-7",
      "url": "https://doi.org/10.1038/s41591-018-0300-7",
      "type": "article",
      "volume": "25",
      "pages": "44",
      "metadata": {
        "refIndex": 2,
        "raw": "Topol EJ. High-performance medicine: the convergence of human and artificial intelligence. Nat Med [Internet] 2019; 25: 44 – 56. 10.1038/s41591-018-0300-7.",
        "crossrefKey": "2021091012574367300_ref2"
      }
    },
    {
      "authors": [
        "Chen"
      ],
      "title": "Artificial intelligence for COVID-19: rapid review",
      "year": 2020,
      "journal": "J Med Internet Res",
      "doi": "10.2196/21476",
      "url": "https://doi.org/10.2196/21476",
      "type": "article",
      "volume": "22",
      "pages": "e21476",
      "metadata": {
        "refIndex": 3,
        "raw": "Chen J, See K. Artificial intelligence for COVID-19: rapid review. J Med Internet Res 2020; 22: e21476. 10.2196/21476.",
        "crossrefKey": "2021091012574367300_ref3"
      }
    },
    {
      "authors": [
        "Meskó"
      ],
      "title": "Will artificial intelligence solve the human resource crisis in healthcare?",
      "year": 2018,
      "journal": "BMC Health Serv Res",
      "doi": "10.1186/s12913-018-3359-4",
      "url": "https://doi.org/10.1186/s12913-018-3359-4",
      "type": "article",
      "volume": "18",
      "pages": "545",
      "metadata": {
        "refIndex": 4,
        "raw": "Meskó B, Hetényi G, Győrffy Z. Will artificial intelligence solve the human resource crisis in healthcare BMC Health Serv Res [Internet] 2018 [cited 9 November 2018]; 18: 545. https://bmchealthservres.biomedcentral.com/articles/10.1186/s12913-018-3359-4.",
        "crossrefKey": "2021091012574367300_ref4"
      }
    },
    {
      "authors": [
        "Eggers"
      ],
      "title": "AI-augmented government: Using cognitive technologies to redesign public sector work A report from the Deloitte Center for Government Insights",
      "year": 2017,
      "type": "book",
      "metadata": {
        "refIndex": 5,
        "raw": "Eggers WD, Schatsky D, Viechnicki P. AI-augmented government: Using cognitive technologies to redesign public sector work A report from the Deloitte Center for Government Insights [Internet]. 2017. https://www2.deloitte.com/us/en/insights/focus/cognitive-technologies/artificial-intelligence-government.html",
        "crossrefKey": "2021091012574367300_ref5"
      }
    },
    {
      "authors": [
        "Verghese"
      ],
      "title": "What this computer needs is a physician",
      "year": 2018,
      "journal": "JAMA",
      "doi": "10.1001/jama.2017.19198",
      "url": "https://doi.org/10.1001/jama.2017.19198",
      "type": "article",
      "volume": "319",
      "pages": "19",
      "metadata": {
        "refIndex": 6,
        "raw": "Verghese A, Shah NH, Harrington RA. What this computer needs is a physician. JAMA [Internet] 2018 Jan 2 [cited 14 November 2018]; 319: 19. http://jama.jamanetwork.com/article.aspxdoi=10.1001/jama.2017.19198.",
        "crossrefKey": "2021091012574367300_ref6"
      }
    },
    {
      "authors": [
        "Spencer"
      ],
      "title": "Brittleness and bureaucracy: software as a material for science",
      "year": 2015,
      "journal": "Perspect Sci",
      "doi": "10.1162/POSC_a_00184",
      "url": "https://doi.org/10.1162/POSC_a_00184",
      "type": "article",
      "volume": "23",
      "pages": "466",
      "metadata": {
        "refIndex": 7,
        "raw": "Spencer M. Brittleness and bureaucracy: software as a material for science. Perspect Sci [Internet] 2015 [cited 14 November 2018]; 23: 466 – 84. http://www.mitpressjournals.org/doi/10.1162/POSC_a_00184.",
        "crossrefKey": "2021091012574367300_ref7"
      }
    },
    {
      "authors": [
        "Dilsizian"
      ],
      "title": "Artificial intelligence in medicine and cardiac imaging: harnessing big data and advanced computing to provide personalized medical diagnosis and treatment",
      "year": 2014,
      "journal": "Curr Cardiol Rep",
      "doi": "10.1007/s11886-013-0441-8",
      "url": "https://doi.org/10.1007/s11886-013-0441-8",
      "type": "article",
      "volume": "16",
      "pages": "441",
      "metadata": {
        "refIndex": 8,
        "raw": "Dilsizian SE, Siegel EL. Artificial intelligence in medicine and cardiac imaging: harnessing big data and advanced computing to provide personalized medical diagnosis and treatment. Curr Cardiol Rep [Internet] 2014 [cited 9 November 2018]; 16: 441. http://www.ncbi.nlm.nih.gov/pubmed/24338557.",
        "crossrefKey": "2021091012574367300_ref8"
      }
    },
    {
      "authors": [
        "Ting"
      ],
      "title": "Development and validation of a deep learning system for diabetic retinopathy and related eye diseases using retinal images from multiethnic populations with diabetes",
      "year": 2017,
      "journal": "JAMA",
      "doi": "10.1001/jama.2017.18152",
      "url": "https://doi.org/10.1001/jama.2017.18152",
      "type": "article",
      "volume": "318",
      "pages": "2211",
      "metadata": {
        "refIndex": 9,
        "raw": "Ting DSW, Cheung CYL, Lim G et al. Development and validation of a deep learning system for diabetic retinopathy and related eye diseases using retinal images from multiethnic populations with diabetes. JAMA 2017; 318: 2211 – 23.",
        "crossrefKey": "2021091012574367300_ref9"
      }
    },
    {
      "authors": [
        "Lakhani"
      ],
      "title": "Deep learning at chest radiography: automated classification of pulmonary tuberculosis by using convolutional neural networks",
      "year": 2017,
      "journal": "Radiology",
      "doi": "10.1148/radiol.2017162326",
      "url": "https://doi.org/10.1148/radiol.2017162326",
      "type": "article",
      "volume": "284",
      "pages": "574",
      "metadata": {
        "refIndex": 10,
        "raw": "Lakhani P, Sundaram B. Deep learning at chest radiography: automated classification of pulmonary tuberculosis by using convolutional neural networks. Radiology 2017; 284: 574 – 82.",
        "crossrefKey": "2021091012574367300_ref10"
      }
    },
    {
      "authors": [
        "McKinney"
      ],
      "title": "International evaluation of an AI system for breast cancer screening",
      "year": 2020,
      "journal": "Nature",
      "doi": "10.1038/s41586-019-1799-6",
      "url": "https://doi.org/10.1038/s41586-019-1799-6",
      "type": "article",
      "volume": "577",
      "pages": "89",
      "metadata": {
        "refIndex": 11,
        "raw": "McKinney S, Sieniek M, Godbole V et al. International evaluation of an AI system for breast cancer screening. Nature 2020; 577: 89 – 94.",
        "crossrefKey": "2021091012574367300_ref11"
      }
    },
    {
      "authors": [
        "Attia"
      ],
      "title": "An artificial intelligence-enabled ECG algorithm for the identification of patients with atrial fibrillation during sinus rhythm: a retrospective analysis of outcome prediction",
      "year": 2019,
      "journal": "Lancet",
      "doi": "10.1016/S0140-6736(19)31721-0",
      "url": "https://doi.org/10.1016/S0140-6736(19)31721-0",
      "type": "article",
      "volume": "394",
      "pages": "861",
      "metadata": {
        "refIndex": 12,
        "raw": "Attia Z, Noseworthy P, Lopez-Jimenez F et al. An artificial intelligence-enabled ECG algorithm for the identification of patients with atrial fibrillation during sinus rhythm: a retrospective analysis of outcome prediction. Lancet 2019; 394: 861 – 7.",
        "crossrefKey": "2021091012574367300_ref12"
      }
    },
    {
      "authors": [
        "Houlton"
      ],
      "title": "How artificial intelligence is transforming healthcare",
      "year": 2018,
      "journal": "Prescriber",
      "doi": "10.1002/psb.1708",
      "url": "https://doi.org/10.1002/psb.1708",
      "type": "article",
      "metadata": {
        "refIndex": 13,
        "raw": "Houlton S. How artificial intelligence is transforming healthcare [Internet]. Prescriber 2018 [cited 14 November 2018]. https://www.prescriber.co.uk/article/how-artificial-intelligence-is-transforming-healthcare/.",
        "crossrefKey": "2021091012574367300_ref13"
      }
    },
    {
      "authors": [
        "Kahn"
      ],
      "title": "From images to actions: opportunities for artificial intelligence in radiology",
      "year": 2017,
      "journal": "Radiology",
      "doi": "10.1148/radiol.2017171734",
      "url": "https://doi.org/10.1148/radiol.2017171734",
      "type": "article",
      "volume": "285",
      "metadata": {
        "refIndex": 14,
        "raw": "Kahn CE. From images to actions: opportunities for artificial intelligence in radiology. Radiology 2017; 285:7.",
        "crossrefKey": "2021091012574367300_ref14"
      }
    },
    {
      "authors": [
        "Saifi"
      ],
      "title": "The use of a learning community and online evaluation of utilization for SPECT myocardial perfusion imaging",
      "year": 2013,
      "journal": "JACC Cardiovasc Imaging",
      "doi": "10.1016/j.jcmg.2013.01.012",
      "url": "https://doi.org/10.1016/j.jcmg.2013.01.012",
      "type": "article",
      "volume": "6",
      "pages": "823",
      "metadata": {
        "refIndex": 15,
        "raw": "Saifi S, Taylor AJ, Allen J et al. The use of a learning community and online evaluation of utilization for SPECT myocardial perfusion imaging. JACC Cardiovasc Imaging 2013; 6: 823 – 9.",
        "crossrefKey": "2021091012574367300_ref15"
      }
    },
    {
      "authors": [
        "Armstrong"
      ],
      "title": "The apps attempting to transfer NHS 111 online",
      "year": 2018,
      "journal": "BMJ",
      "doi": "10.1136/bmj.k156",
      "url": "https://doi.org/10.1136/bmj.k156",
      "type": "article",
      "volume": "360",
      "pages": "k156",
      "metadata": {
        "refIndex": 16,
        "raw": "Armstrong S. The apps attempting to transfer NHS 111 online. BMJ [Internet] 2018 [cited 14 November 2018]; 360: k156. http://www.ncbi.nlm.nih.gov/pubmed/29335297.",
        "crossrefKey": "2021091012574367300_ref16"
      }
    },
    {
      "authors": [
        "Lupton"
      ],
      "title": "‘It’s like having a physician in your pocket!’ A critical analysis of self-diagnosis smartphone apps",
      "year": 2015,
      "journal": "Soc Sci Med",
      "doi": "10.1016/j.socscimed.2015.04.004",
      "url": "https://doi.org/10.1016/j.socscimed.2015.04.004",
      "type": "article",
      "volume": "133",
      "pages": "128",
      "metadata": {
        "refIndex": 17,
        "raw": "Lupton D, Jutel A. ‘It’s like having a physician in your pocket!’ A critical analysis of self-diagnosis smartphone apps. Soc Sci Med [Internet] 2015 [cited 14 November 2018]; 133: 128 – 35. https://www.sciencedirect.com/science/article/pii/S0277953615002245.",
        "crossrefKey": "2021091012574367300_ref17"
      }
    },
    {
      "authors": [
        "Stewart"
      ],
      "title": "Artificial intelligence and machine learning in emergency medicine",
      "year": 2018,
      "journal": "Emerg Med Australas",
      "doi": "10.1111/1742-6723.13145",
      "url": "https://doi.org/10.1111/1742-6723.13145",
      "type": "article",
      "volume": "30",
      "pages": "870",
      "metadata": {
        "refIndex": 18,
        "raw": "Stewart J, Sprivulis P, Dwivedi G. Artificial intelligence and machine learning in emergency medicine. Emerg Med Australas [Internet] 2018 [cited 15 November 2018]; 30: 870 – 4. http://doi.wiley.com/10.1111/1742-6723.13145.",
        "crossrefKey": "2021091012574367300_ref18"
      }
    },
    {
      "authors": [
        "Jones"
      ],
      "title": "Artificial intelligence, machine learning and the evolution of healthcare",
      "year": 2018,
      "journal": "Bone Joint Res",
      "doi": "10.1302/2046-3758.73.BJR-2017-0147.R1",
      "url": "https://doi.org/10.1302/2046-3758.73.BJR-2017-0147.R1",
      "type": "article",
      "volume": "7",
      "pages": "223",
      "metadata": {
        "refIndex": 19,
        "raw": "Jones LD, Golan D, Hanna SA et al. Artificial intelligence, machine learning and the evolution of healthcare. Bone Joint Res [Internet] 2018 [cited 9 November 2018]; 7: 223 – 5. http://online.boneandjoint.org.uk/doi/10.1302/2046-3758.73.BJR-2017-0147.R1.",
        "crossrefKey": "2021091012574367300_ref19"
      }
    },
    {
      "authors": [
        "Tufail"
      ],
      "title": "Automated diabetic retinopathy image assessment software",
      "year": 2017,
      "journal": "Ophthalmology",
      "doi": "10.1016/j.ophtha.2016.11.014",
      "url": "https://doi.org/10.1016/j.ophtha.2016.11.014",
      "type": "article",
      "volume": "124",
      "pages": "343",
      "metadata": {
        "refIndex": 20,
        "raw": "Tufail A, Rudisill C, Egan C et al. Automated diabetic retinopathy image assessment software. Ophthalmology 2017; 124: 343 – 51.",
        "crossrefKey": "2021091012574367300_ref20"
      }
    },
    {
      "authors": [
        "Cheng"
      ],
      "title": "Computer-aided diagnosis with deep learning architecture: applications to breast lesions in US images and pulmonary nodules in CT scans",
      "year": 2016,
      "journal": "Sci Rep",
      "doi": "10.1038/srep24454",
      "url": "https://doi.org/10.1038/srep24454",
      "type": "article",
      "volume": "6",
      "pages": "24454",
      "metadata": {
        "refIndex": 21,
        "raw": "Cheng J-Z, Ni D, Chou Y-H et al. Computer-aided diagnosis with deep learning architecture: applications to breast lesions in US images and pulmonary nodules in CT scans. Sci Rep [Internet] 2016 [cited 14 November 2018]; 6: 24454. http://www.nature.com/articles/srep24454.",
        "crossrefKey": "2021091012574367300_ref21"
      }
    },
    {
      "authors": [
        "Jiang"
      ],
      "title": "Artificial intelligence in healthcare: past, present and future",
      "year": 2017,
      "journal": "Stroke Vasc Neurol",
      "doi": "10.1136/svn-2017-000101",
      "url": "https://doi.org/10.1136/svn-2017-000101",
      "type": "article",
      "volume": "2",
      "pages": "230",
      "metadata": {
        "refIndex": 22,
        "raw": "Jiang F, Jiang Y, Zhi H et al. Artificial intelligence in healthcare: past, present and future. Stroke Vasc Neurol [Internet] 2017 [cited 9 November 2018]; 2: 230 – 43. http://www.ncbi.nlm.nih.gov/pubmed/29507784.",
        "crossrefKey": "2021091012574367300_ref22"
      }
    },
    {
      "authors": [
        "Oliveira"
      ],
      "title": "Development and implementation of clinical guidelines: an artificial intelligence perspective",
      "year": 2014,
      "journal": "Artif Intell Rev",
      "doi": "10.1007/s10462-013-9402-2",
      "url": "https://doi.org/10.1007/s10462-013-9402-2",
      "type": "article",
      "volume": "42",
      "pages": "999",
      "metadata": {
        "refIndex": 23,
        "raw": "Oliveira T, Novais P, Neves J. Development and implementation of clinical guidelines: an artificial intelligence perspective. Artif Intell Rev [Internet] 2014 [cited 15 November 2018]; 42: 999 – 1027. http://link.springer.com/10.1007/s10462-013-9402-2.",
        "crossrefKey": "2021091012574367300_ref23"
      }
    },
    {
      "authors": [
        "Neill"
      ],
      "title": "Using artificial intelligence to improve hospital inpatient care",
      "year": 2013,
      "journal": "IEEE Intell Syst",
      "doi": "10.1109/MIS.2013.51",
      "url": "https://doi.org/10.1109/MIS.2013.51",
      "type": "article",
      "volume": "28",
      "pages": "92",
      "metadata": {
        "refIndex": 24,
        "raw": "Neill DB. Using artificial intelligence to improve hospital inpatient care. IEEE Intell Syst 2013; 28: 92 – 5.",
        "crossrefKey": "2021091012574367300_ref24"
      }
    },
    {
      "authors": [
        "Dias"
      ],
      "title": "Artificial intelligence in clinical and genomic diagnostics",
      "year": 2019,
      "journal": "Genome Med",
      "doi": "10.1186/s13073-019-0689-8",
      "url": "https://doi.org/10.1186/s13073-019-0689-8",
      "type": "article",
      "volume": "11",
      "pages": "70",
      "metadata": {
        "refIndex": 25,
        "raw": "Dias R, Torkamani A. Artificial intelligence in clinical and genomic diagnostics. Genome Med 2019; 11: 70.",
        "crossrefKey": "2021091012574367300_ref25"
      }
    },
    {
      "authors": [
        "Zitnik"
      ],
      "title": "Machine learning for integrating data in biology and medicine: principles, practice, and opportunities",
      "year": 2019,
      "journal": "Inf Fusion",
      "doi": "10.1016/j.inffus.2018.09.012",
      "url": "https://doi.org/10.1016/j.inffus.2018.09.012",
      "type": "article",
      "volume": "50",
      "pages": "71",
      "metadata": {
        "refIndex": 26,
        "raw": "Zitnik M, Nguyen F, Wang B et al. Machine learning for integrating data in biology and medicine: principles, practice, and opportunities. Inf Fusion [Internet] 2019; 50: 71 – 91. https://doi.org/10.1016/j.inffus.2018.09.012.",
        "crossrefKey": "2021091012574367300_ref26"
      }
    },
    {
      "authors": [
        "Johnson"
      ],
      "title": "Artificial intelligence in cardiology",
      "year": 2018,
      "journal": "J Am Coll Cardiol",
      "doi": "10.1016/j.jacc.2018.03.521",
      "url": "https://doi.org/10.1016/j.jacc.2018.03.521",
      "type": "article",
      "volume": "71",
      "pages": "2668",
      "metadata": {
        "refIndex": 27,
        "raw": "Johnson KW, Torres Soto J, Glicksberg BS et al. Artificial intelligence in cardiology. J Am Coll Cardiol [Internet] 2018 [cited 15 November 2018]; 71: 2668 – 79. https://linkinghub.elsevier.com/retrieve/pii/S0735109718344085.",
        "crossrefKey": "2021091012574367300_ref27"
      }
    },
    {
      "authors": [
        "Lopez"
      ],
      "title": "Reducing annotation burden through multimodal learning",
      "year": 2020,
      "journal": "Frontiers In Big Data",
      "doi": "10.3389/fdata.2020.00019",
      "url": "https://doi.org/10.3389/fdata.2020.00019",
      "type": "article",
      "volume": "3",
      "metadata": {
        "refIndex": 28,
        "raw": "Lopez K, Fodeh S, Allam A et al. Reducing annotation burden through multimodal learning. Frontiers In Big Data 2020; 3:8. 10.3389/fdata.2020.00019.",
        "crossrefKey": "2021091012574367300_ref28"
      }
    },
    {
      "authors": [
        "Sun"
      ],
      "title": "Mapping the challenges of artificial intelligence in the public sector: evidence from public healthcare",
      "year": 2018,
      "journal": "Gov Inf Q",
      "type": "article",
      "metadata": {
        "refIndex": 29,
        "raw": "Sun TQ, Medaglia R. Mapping the challenges of artificial intelligence in the public sector: evidence from public healthcare. Gov Inf Q [Internet] 2018 [cited 9 November 2018]. https://linkinghub.elsevier.com/retrieve/pii/S0740624X17304781.",
        "crossrefKey": "2021091012574367300_ref29"
      }
    },
    {
      "authors": [
        "Luxton"
      ],
      "title": "Recommendations for the ethical use and design of artificial intelligent care providers",
      "year": 2014,
      "journal": "Artif Intell Med",
      "doi": "10.1016/j.artmed.2014.06.004",
      "url": "https://doi.org/10.1016/j.artmed.2014.06.004",
      "type": "article",
      "volume": "62",
      "pages": "1",
      "metadata": {
        "refIndex": 30,
        "raw": "Luxton DD. Recommendations for the ethical use and design of artificial intelligent care providers. Artif Intell Med [Internet] 2014 [cited 15 November 2018]; 62: 1 – 10. http://www.ncbi.nlm.nih.gov/pubmed/25059820.",
        "crossrefKey": "2021091012574367300_ref30"
      }
    },
    {
      "authors": [
        "Powles"
      ],
      "title": "Google DeepMind and healthcare in an age of algorithms",
      "year": 2017,
      "journal": "Health Technol (Berl)",
      "doi": "10.1007/s12553-017-0179-1",
      "url": "https://doi.org/10.1007/s12553-017-0179-1",
      "type": "article",
      "volume": "7",
      "pages": "351",
      "metadata": {
        "refIndex": 31,
        "raw": "Powles J, Hodson H. Google DeepMind and healthcare in an age of algorithms. Health Technol (Berl) [Internet] 2017 [cited 15 November 2018]; 7: 351 – 67. http://link.springer.com/10.1007/s12553-017-0179-1.",
        "crossrefKey": "2021091012574367300_ref31"
      }
    },
    {
      "authors": [
        "Clarke"
      ],
      "title": "GDPR: an impediment to research?",
      "year": 2019,
      "journal": "Irish Journal Of Medical Science (1971)",
      "doi": "10.1007/s11845-019-01980-2",
      "url": "https://doi.org/10.1007/s11845-019-01980-2",
      "type": "article",
      "volume": "188",
      "pages": "1129",
      "metadata": {
        "refIndex": 32,
        "raw": "Clarke N, Vale G, Reeves E et al. GDPR: an impediment to research Irish Journal Of Medical Science (1971) 2019; 188: 1129 – 35. 10.1007/s11845-019-01980-2.",
        "crossrefKey": "2021091012574367300_ref32"
      }
    },
    {
      "authors": [
        "Pesapane"
      ],
      "title": "Artificial intelligence as a medical device in radiology: ethical and regulatory issues in Europe and the United States",
      "year": 2018,
      "journal": "Insights Imaging",
      "doi": "10.1007/s13244-018-0645-y",
      "url": "https://doi.org/10.1007/s13244-018-0645-y",
      "type": "article",
      "volume": "9",
      "pages": "745",
      "metadata": {
        "refIndex": 33,
        "raw": "Pesapane F, Volonté C, Codari M et al. Artificial intelligence as a medical device in radiology: ethical and regulatory issues in Europe and the United States. Insights Imaging 2018; 9: 745 – 53. 10.1007/s13244-018-0645-y.",
        "crossrefKey": "2021091012574367300_ref33"
      }
    },
    {
      "authors": [
        "Forcier"
      ],
      "title": "Integrating artificial intelligence into health care through data access: can the GDPR act as a beacon for policymakers?",
      "year": 2019,
      "journal": "J Law Biosci",
      "doi": "10.1093/jlb/lsz013",
      "url": "https://doi.org/10.1093/jlb/lsz013",
      "type": "article",
      "volume": "6",
      "pages": "317",
      "metadata": {
        "refIndex": 34,
        "raw": "Forcier M, Gallois H, Mullan S et al. Integrating artificial intelligence into health care through data access: can the GDPR act as a beacon for policymakers J Law Biosci 2019; 6: 317 – 35. 10.1093/jlb/lsz013.",
        "crossrefKey": "2021091012574367300_ref34"
      }
    },
    {
      "authors": [
        "Wang"
      ],
      "title": "AI in health: state of the art, challenges, and future directions",
      "year": 2019,
      "journal": "Yearb Med Inform",
      "doi": "10.1055/s-0039-1677908",
      "url": "https://doi.org/10.1055/s-0039-1677908",
      "type": "article",
      "volume": "28",
      "pages": "016",
      "metadata": {
        "refIndex": 35,
        "raw": "Wang F, Preininger A. AI in health: state of the art, challenges, and future directions. Yearb Med Inform 2019; 28: 016 – 26. 10.1055/s-0039-1677908.",
        "crossrefKey": "2021091012574367300_ref35"
      }
    },
    {
      "authors": [
        "Wiens"
      ],
      "title": "Machine learning for healthcare: on the verge of a major shift in healthcare epidemiology",
      "year": 2018,
      "journal": "Clin Infect Dis",
      "doi": "10.1093/cid/cix731",
      "url": "https://doi.org/10.1093/cid/cix731",
      "type": "article",
      "volume": "66",
      "pages": "149",
      "metadata": {
        "refIndex": 36,
        "raw": "Wiens J, Shenoy ES. Machine learning for healthcare: on the verge of a major shift in healthcare epidemiology. Clin Infect Dis [Internet] 2018 [cited 9 November 2018]; 66: 149 – 53. http://www.ncbi.nlm.nih.gov/pubmed/29020316.",
        "crossrefKey": "2021091012574367300_ref36"
      }
    },
    {
      "authors": [
        "Wang"
      ],
      "title": "Deep learning in medicine—promise, progress, and challenges",
      "year": 2019,
      "journal": "JAMA Intern Med",
      "doi": "10.1001/jamainternmed.2018.7117",
      "url": "https://doi.org/10.1001/jamainternmed.2018.7117",
      "type": "article",
      "volume": "179",
      "pages": "293",
      "metadata": {
        "refIndex": 37,
        "raw": "Wang F, Casalino L, Khullar D. Deep learning in medicine—promise, progress, and challenges. JAMA Intern Med 2019; 179: 293. 10.1001/jamainternmed.2018.7117.",
        "crossrefKey": "2021091012574367300_ref37"
      }
    },
    {
      "authors": [
        "Kleinberg"
      ],
      "title": "Discrimination in the age of algorithms",
      "year": 2018,
      "journal": "J Leg Anal",
      "doi": "10.1093/jla/laz001",
      "url": "https://doi.org/10.1093/jla/laz001",
      "type": "article",
      "volume": "10",
      "pages": "113",
      "metadata": {
        "refIndex": 38,
        "raw": "Kleinberg J, Ludwig J, Mullainathan S et al. Discrimination in the age of algorithms. J Leg Anal 2018; 10: 113 – 74.",
        "crossrefKey": "2021091012574367300_ref38"
      }
    },
    {
      "authors": [
        "Adeli"
      ],
      "title": "Bias-resilient neural network",
      "year": 2019,
      "journal": "ArXiv",
      "type": "article",
      "pages": "1",
      "metadata": {
        "refIndex": 39,
        "raw": "Adeli E, Zhao Q, Pfefferbaum A et al. Bias-resilient neural network. ArXiv [Internet] 2019; 1 – 12. http://arxiv.org/abs/1910.03676 23 November 2020, preprint: not peer reviewed.",
        "crossrefKey": "2021091012574367300_ref39"
      }
    },
    {
      "authors": [
        "Price"
      ],
      "title": "Artificial intelligence in health care: applications and legal implications",
      "year": 2017,
      "journal": "The SciTech Lawyer",
      "type": "article",
      "volume": "14",
      "pages": "10",
      "metadata": {
        "refIndex": 40,
        "raw": "Price WN. Artificial intelligence in health care: applications and legal implications. The SciTech Lawyer [Internet] 2017 [cited 15 November 2018]; 14: 10 – 3. https://repository.law.umich.edu/articles.",
        "crossrefKey": "2021091012574367300_ref40"
      }
    },
    {
      "authors": [
        "Watson"
      ],
      "title": "Clinical applications of machine learning algorithms: beyond the black box",
      "year": 2019,
      "journal": "BMJ",
      "type": "article",
      "pages": "364",
      "metadata": {
        "refIndex": 41,
        "raw": "Watson DS, Krutzinna J, Bruce IN et al. Clinical applications of machine learning algorithms: beyond the black box. BMJ [Internet] 2019; 364, 10 – 13. http://dx.doi.org/doi:10.1136/bmj.l886.",
        "crossrefKey": "2021091012574367300_ref41"
      }
    },
    {
      "authors": [
        "Google"
      ],
      "title": "AI Explainability Whitepaper",
      "year": 2019,
      "type": "book",
      "pages": "1",
      "metadata": {
        "refIndex": 42,
        "raw": "Google. AI Explainability Whitepaper [Internet]. Google Cloud; 2019. p. 1 – 27. https://storage.googleapis.com/cloud-ai-whitepapers/AI Explainability Whitepaper.pdf",
        "crossrefKey": "2021091012574367300_ref42"
      }
    },
    {
      "authors": [
        "Wang"
      ],
      "title": "Should health care demand interpretable artificial intelligence or accept “black box” medicine?",
      "year": 2019,
      "journal": "Ann Intern Med",
      "doi": "10.7326/m19-2548",
      "url": "https://doi.org/10.7326/m19-2548",
      "type": "article",
      "volume": "172",
      "pages": "59",
      "metadata": {
        "refIndex": 43,
        "raw": "Wang F, Kaushal R, Khullar D. Should health care demand interpretable artificial intelligence or accept “black box” medicine Ann Intern Med 2019; 172: 59. 10.7326/m19-2548.",
        "crossrefKey": "2021091012574367300_ref43"
      }
    },
    {
      "authors": [
        "Ramesh"
      ],
      "title": "Artificial intelligence in medicine",
      "year": 2004,
      "journal": "Ann R Coll Surg Engl",
      "doi": "10.1308/147870804290",
      "url": "https://doi.org/10.1308/147870804290",
      "type": "article",
      "volume": "86",
      "pages": "334",
      "metadata": {
        "refIndex": 44,
        "raw": "Ramesh AN, Kambhampati C, Monson JRT et al. Artificial intelligence in medicine. Ann R Coll Surg Engl [Internet] 2004 [cited 9 November 2018]; 86: 334 – 8. http://www.ncbi.nlm.nih.gov/pubmed/15333167.",
        "crossrefKey": "2021091012574367300_ref44"
      }
    },
    {
      "authors": [
        "Liu"
      ],
      "title": "A comparison of deep learning performance against health-care professionals in detecting diseases from medical imaging: a systematic review and meta-analysis",
      "year": 2019,
      "journal": "Lancet Digit Heal",
      "doi": "10.1016/S2589-7500(19)30123-2",
      "url": "https://doi.org/10.1016/S2589-7500(19)30123-2",
      "type": "article",
      "volume": "1",
      "pages": "e271",
      "metadata": {
        "refIndex": 45,
        "raw": "Liu X, Faes L, Kale AU et al. A comparison of deep learning performance against health-care professionals in detecting diseases from medical imaging: a systematic review and meta-analysis. Lancet Digit Heal Internet 2019; 1: e271 – e297. 10.1016/S2589-7500(19)30123-2.",
        "crossrefKey": "2021091012574367300_ref45"
      }
    },
    {
      "authors": [
        "GOV.UK"
      ],
      "title": "Initial code of conduct for data-driven health and care technology",
      "year": 2019,
      "type": "book",
      "metadata": {
        "refIndex": 46,
        "raw": "GOV.UK. Initial code of conduct for data-driven health and care technology [Internet]. UK Department of Health & Social Care. 2019 [cited 18 November 2018]. https://www.gov.uk/government/publications/code-of-conduct-for-data-driven-health-and-care-technology/initial-code-of-conduct-for-data-driven-health-and-care-technology",
        "crossrefKey": "2021091012574367300_ref46"
      }
    }
  ]
};
