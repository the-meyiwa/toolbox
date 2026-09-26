/* ============================================================
   Legal engine — research planning (DOM-free)

   Turns a research question into a plan: the issues to answer,
   threshold (preliminary) points a Nigerian court will look at
   first, the doctrines and statutory provisions in play, Boolean
   queries for LawPavilion, LegalPedia, NigeriaLII and Google
   Scholar, and an authority matrix to fill in as the research
   is done.

   It names statutes and doctrines only. It never suggests case
   names: authorities come from the research itself, and each one
   entered in the matrix is parsed and weighed against the forum.
   ============================================================ */

import { normaliseCitation } from './citations.js';
import { bindingEffect, COURTS } from './courts.js';
import { oneLine } from './text.js';

/* ---------------- areas ---------------- */

export const AREAS = {
  contract:     { label: 'Contract & commercial', re: /\bcontract|agreement|breach|consideration|offer|acceptance|sale\s+of\s+goods|supplier|buyer|invoice|guarantee|indemnit|clause\b/i },
  land:         { label: 'Land, property & tenancy', re: /\bland|property|tenan|landlord|lease|premises|certificate\s+of\s+occupancy|governor'?s\s+consent|mortgage|title|possession|quit|rent\b/i },
  employment:   { label: 'Labour & employment', re: /\bemploy|dismiss|terminat(?:ion|ed)\s+of\s+(?:employment|appointment)|redundan|worker|staff|salary|wages|union|NIC\b|industrial/i },
  corporate:    { label: 'Company & commercial', re: /\bcompany|companies|director|shareholder|CAMA|corporate|winding\s+up|liquidat|share|board|AGM|incorporat/i },
  rights:       { label: 'Constitutional & human rights', re: /\bfundamental\s+rights?|constitution|fair\s+hearing|personal\s+liberty|detention|dignity|privacy|freedom\s+of|FREP|judicial\s+review|locus\s+standi/i },
  criminal:     { label: 'Criminal law & procedure', re: /\bcriminal|crime|offence|accused|prosecution|charge|bail|confession|arraign|convict|sentence|murder|fraud|theft|stealing|EFCC|ICPC/i },
  evidence:     { label: 'Evidence', re: /\bevidence|admissib|electronic|computer[-\s]generated|certificate|hearsay|burden\s+of\s+proof|witness|documentary|certified\s+true\s+cop/i },
  procedure:    { label: 'Civil procedure & jurisdiction', re: /\bjurisdiction|limitation|pre-action|service\s+of\s+process|default\s+judgment|summary\s+judgment|stay\s+of|injunction|abuse\s+of\s+(?:court\s+)?process|originating\s+summons|writ|garnishee|enforcement/i },
  arbitration:  { label: 'Arbitration & ADR', re: /\barbitra|award|mediat|ADR|stay\s+of\s+proceedings\s+pending\s+arbitration/i },
  tort:         { label: 'Tort', re: /\bnegligen|defam|libel|slander|nuisance|trespass|vicarious|duty\s+of\s+care|personal\s+injury|medical/i },
  family:       { label: 'Family & succession', re: /\bdivorce|marriage|matrimonial|custody|maintenance|child|will\b|wills|estate|probate|letters\s+of\s+administration|inheritance|succession/i },
  data:         { label: 'Data protection & cyber', re: /\bdata\s+protection|personal\s+data|NDPA|privacy\s+policy|cyber|hacking|online\s+fraud/i },
  election:     { label: 'Elections', re: /\belection|electoral|INEC|pre-election|candidate|nomination|petition\s+tribunal/i },
};

/* ---------------- concepts ---------------- */
// Each: re (trigger), area, issue (a neutral "Whether …" framing), doctrine, statutes, terms (search synonyms).
export const CONCEPTS = [
  // contract
  { id: 'formation', area: 'contract', re: /\bformation|offer|acceptance|consideration|intention\s+to\s+create|binding\s+contract|enforceable\s+contract\b/i,
    issue: 'Whether a valid and binding contract was formed (offer, acceptance, consideration, intention to create legal relations, capacity)',
    doctrine: 'Formation of contract: offer, unqualified acceptance, consideration and intention to create legal relations', statutes: [], terms: [['"offer and acceptance"', '"formation of contract"'], ['consideration', '"binding contract"']] },
  { id: 'variation', area: 'contract', re: /\boral(?:ly)?\s+var|variation|vari(?:ed|y)|no\s+oral\s+modification|amend(?:ed|ment)?\s+(?:orally|by\s+conduct)|NOM\b/i,
    issue: 'Whether the written contract was validly varied (orally or by conduct), and the effect of any clause requiring variations to be in writing and signed',
    doctrine: 'Variation of written contracts; parol evidence rule; clauses requiring written variation; waiver and estoppel by conduct', statutes: ['Evidence Act 2011, s. 128 (oral evidence to vary a document)'], terms: [['"oral variation"', '"variation of contract"', '"varied orally"'], ['"written contract"', '"written agreement"'], ['"parol evidence"', 'waiver', 'estoppel']] },
  { id: 'breach', area: 'contract', re: /\bbreach|damages|remoteness|loss\s+of\s+profit|repudiat/i,
    issue: 'Whether there was a breach of contract and the measure of damages recoverable (remoteness, mitigation, special and general damages)',
    doctrine: 'Breach and repudiation; damages for breach (remoteness, mitigation); special damages must be specifically pleaded and strictly proved', statutes: [], terms: [['"breach of contract"', 'repudiation'], ['"special damages"', '"general damages"', 'remoteness']] },
  { id: 'specific', area: 'contract', re: /\bspecific\s+performance|injunction\s+to\s+enforce/i,
    issue: 'Whether specific performance is available, or damages are an adequate remedy',
    doctrine: 'Specific performance as an equitable, discretionary remedy; adequacy of damages; contracts for land', statutes: [], terms: [['"specific performance"'], ['"adequate remedy"', '"equitable remedy"']] },
  { id: 'frustration', area: 'contract', re: /\bfrustrat|force\s+majeure|impossib|supervening/i,
    issue: 'Whether performance was excused by frustration or a force majeure event, and the consequences for sums paid',
    doctrine: 'Frustration (supervening event making performance radically different); contractual force majeure clauses construed strictly', statutes: [], terms: [['frustration', '"force majeure"'], ['"supervening event"', 'impossibility']] },
  { id: 'misrep', area: 'contract', re: /\bmisrepresent|induce|fraudulent\s+representation|rescission/i,
    issue: 'Whether the contract was induced by misrepresentation, and whether rescission or damages is available',
    doctrine: 'Misrepresentation (fraudulent, negligent, innocent); rescission and bars to rescission; fraud must be specifically pleaded and proved beyond reasonable doubt where it is criminal in nature', statutes: ['Evidence Act 2011, s. 135 (standard where commission of a crime is in issue)'], terms: [['misrepresentation', 'rescission'], ['fraud', '"induced the contract"']] },
  { id: 'penalty', area: 'contract', re: /\bpenalt|liquidated\s+damages|default\s+interest/i,
    issue: 'Whether the agreed sum or interest rate is a genuine pre-estimate of loss or an unenforceable penalty',
    doctrine: 'Liquidated damages versus penalties; genuine pre-estimate of loss', statutes: [], terms: [['"liquidated damages"', 'penalty'], ['"genuine pre-estimate"']] },
  { id: 'restraint', area: 'contract', re: /\brestraint\s+of\s+trade|non-?compete|non-?solicit/i,
    issue: 'Whether the restrictive covenant is reasonable in scope, duration and area, and so enforceable',
    doctrine: 'Restraint of trade: prima facie void unless reasonable in the interests of the parties and the public', statutes: [], terms: [['"restraint of trade"', '"restrictive covenant"'], ['reasonable', '"non-compete"']] },
  { id: 'sog', area: 'contract', re: /\bsale\s+of\s+goods|merchantable|fitness\s+for\s+purpose|goods\s+(?:were\s+)?defective/i,
    issue: 'Whether the goods complied with the implied terms as to description, quality and fitness for purpose',
    doctrine: 'Implied terms in contracts for the sale of goods; acceptance and rejection of goods', statutes: ['Sale of Goods Act 1893 (statute of general application) or the Sale of Goods Law of the State', 'Federal Competition and Consumer Protection Act 2018 (consumer transactions)'], terms: [['"sale of goods"', '"merchantable quality"'], ['"fitness for purpose"', '"implied term"']] },
  // land
  { id: 'consent', area: 'land', re: /\bgovernor'?s?\s+consent|alienat|section\s+22|s\.\s*22\b|statutory\s+right\s+of\s+occupancy|certificate\s+of\s+occupancy/i,
    issue: 'Whether the transaction required the Governor\'s consent, and the effect of its absence on the parties\' rights',
    doctrine: 'Alienation of a statutory right of occupancy requires the Governor\'s prior consent; a transaction without it is inchoate and unenforceable until consent is obtained', statutes: ['Land Use Act 1978 (Cap. L5 LFN 2004), ss. 21, 22 and 26'], terms: [['"governor\'s consent"', '"section 22"'], ['"Land Use Act"', 'alienation', '"right of occupancy"']] },
  { id: 'recovery', area: 'land', re: /\brecover(?:y)?\s+(?:of\s+)?(?:possession|premises)|evict|notice\s+to\s+quit|quit\s+notice|landlord|tenant/i,
    issue: 'Whether the landlord served valid statutory notices (notice to quit and the notice of owner\'s intention to recover possession) and may recover possession',
    doctrine: 'Recovery of premises: strict compliance with the statutory notices; the length of the notice to quit depends on the tenancy; mesne profits and arrears of rent', statutes: ['Tenancy Law of Lagos State 2011 (Lagos)', 'Recovery of Premises Act (Federal Capital Territory)', 'Recovery of Premises Law of the relevant State'], terms: [['"notice to quit"', '"recovery of premises"'], ['"seven days notice"', '"owner\'s intention"', '"possession"']] },
  { id: 'title', area: 'land', re: /\bdeclaration\s+of\s+title|title\s+to\s+land|ownership\s+of\s+(?:the\s+)?land|root\s+of\s+title|traditional\s+history/i,
    issue: 'Whether the claimant has proved title to the land by any of the recognised methods',
    doctrine: 'Proof of title to land: traditional evidence, documents of title, acts of ownership, long possession, or possession of connected land; the claimant succeeds on the strength of their own case', statutes: ['Evidence Act 2011 (burden of proof, ss. 131–134)'], terms: [['"declaration of title"', '"title to land"'], ['"traditional history"', '"acts of ownership"', '"root of title"']] },
  { id: 'mortgage', area: 'land', re: /\bmortgag|power\s+of\s+sale|redemption|receiver/i,
    issue: 'Whether the mortgagee\'s power of sale had arisen and become exercisable, and the effect of any irregularity on the purchaser',
    doctrine: 'Mortgagee\'s power of sale: when it arises (debt due) and when it becomes exercisable (demand/notice as the deed or statute requires); protection of purchasers; the mortgagor\'s equity of redemption', statutes: ['Conveyancing Act 1881 (statute of general application) or Property and Conveyancing Law (Western States)', 'Mortgage and Property Law of Lagos State 2010 (Lagos)', 'Land Use Act 1978, s. 22 (consent to mortgage)'], terms: [['"power of sale"', 'mortgagee'], ['"notice of demand"', '"equity of redemption"', '"private treaty"']] },
  // employment
  { id: 'dismissal', area: 'employment', re: /\bdismiss|terminat|wrongful|unfair|sack|disengag|redundan/i,
    issue: 'Whether the termination or dismissal complied with the contract of employment (and any statutory flavour), and the remedies available',
    doctrine: 'Master and servant relationship versus employment with statutory flavour; wrongful termination (damages limited to the notice period) versus reinstatement; summary dismissal for gross misconduct and fair hearing; unfair labour practice in the National Industrial Court', statutes: ['Labour Act (Cap. L1 LFN 2004)', 'Constitution of the Federal Republic of Nigeria 1999 (as amended), s. 254C (jurisdiction of the National Industrial Court)', 'National Industrial Court Act 2006'], terms: [['"wrongful termination"', '"wrongful dismissal"', '"unfair dismissal"'], ['"statutory flavour"', '"master and servant"'], ['reinstatement', '"gross misconduct"']] },
  // corporate
  { id: 'directors', area: 'corporate', re: /\bdirector|fiduciary|board|conflict\s+of\s+interest/i,
    issue: 'Whether the directors acted within their powers and in breach of their fiduciary duties or duty of care',
    doctrine: 'Directors\' fiduciary duties and duty of care and skill; conflicts of interest; ratification', statutes: ['Companies and Allied Matters Act 2020 (directors\' duties)'], terms: [['"fiduciary duty"', '"directors\' duties"'], ['"Companies and Allied Matters Act"', 'CAMA']] },
  { id: 'minority', area: 'corporate', re: /\bminority|derivative|oppress|unfair(?:ly)?\s+prejudic|shareholder/i,
    issue: 'Whether a shareholder may sue (derivative action or unfair prejudice petition) and on what conditions',
    doctrine: 'Majority rule and its exceptions; statutory derivative action (leave of court); relief for unfairly prejudicial or oppressive conduct', statutes: ['Companies and Allied Matters Act 2020 (derivative actions; unfair prejudice)'], terms: [['"derivative action"', '"unfairly prejudicial"', 'oppressive'], ['"minority shareholder"', '"majority rule"']] },
  { id: 'veil', area: 'corporate', re: /\bveil|separate\s+(?:legal\s+)?personality|alter\s+ego|sham/i,
    issue: 'Whether the corporate veil should be lifted to reach the shareholders or directors',
    doctrine: 'Separate legal personality and the exceptions (fraud, sham or façade, agency, statutory provisions)', statutes: ['Companies and Allied Matters Act 2020'], terms: [['"lifting the veil"', '"corporate veil"'], ['"separate legal personality"', 'fraud', 'sham']] },
  // rights
  { id: 'fairhearing', area: 'rights', re: /\bfair\s+hearing|audi\s+alteram|natural\s+justice|bias|not\s+heard/i,
    issue: 'Whether the party was denied a fair hearing, and whether that vitiates the proceedings',
    doctrine: 'Right to fair hearing: notice and an opportunity to be heard; an independent and impartial tribunal; breach renders the proceedings a nullity', statutes: ['Constitution of the Federal Republic of Nigeria 1999 (as amended), s. 36'], terms: [['"fair hearing"', '"natural justice"'], ['"section 36"', '"audi alteram partem"']] },
  { id: 'liberty', area: 'rights', re: /\bdetain|detention|arrest|personal\s+liberty|police\s+custody|remand/i,
    issue: 'Whether the arrest or detention was lawful, and the remedies (release, damages, apology) available',
    doctrine: 'Right to personal liberty; time limits for bringing a suspect before a court; damages for unlawful detention', statutes: ['Constitution of the Federal Republic of Nigeria 1999 (as amended), ss. 35 and 46', 'Fundamental Rights (Enforcement Procedure) Rules 2009', 'Administration of Criminal Justice Act 2015'], terms: [['"personal liberty"', '"unlawful detention"'], ['"fundamental rights"', '"section 35"']] },
  { id: 'frep', area: 'rights', re: /\bfundamental\s+rights?|FREP|enforcement\s+procedure|human\s+rights?/i,
    issue: 'Whether the claim is properly brought under the Fundamental Rights (Enforcement Procedure) Rules, with the main relief being the enforcement of a fundamental right',
    doctrine: 'Main claim versus ancillary claim test for fundamental rights applications; courts with concurrent jurisdiction; no limitation period under the 2009 Rules', statutes: ['Constitution of the Federal Republic of Nigeria 1999 (as amended), Chapter IV and s. 46', 'Fundamental Rights (Enforcement Procedure) Rules 2009'], terms: [['"fundamental rights"', '"enforcement procedure"'], ['"main claim"', '"ancillary"']] },
  { id: 'standing', area: 'rights', re: /\blocus\s+standi|standing\s+to\s+sue|public\s+interest\s+litigation/i,
    issue: 'Whether the claimant has locus standi to bring the action',
    doctrine: 'Locus standi: sufficient interest in the subject matter; liberal approach for fundamental rights and public interest litigation under the 2009 Rules', statutes: ['Constitution of the Federal Republic of Nigeria 1999 (as amended), s. 6(6)(b)', 'Fundamental Rights (Enforcement Procedure) Rules 2009, Preamble'], terms: [['"locus standi"', '"standing to sue"'], ['"sufficient interest"', '"public interest"']] },
  // criminal
  { id: 'proof', area: 'criminal', re: /\bbeyond\s+reasonable\s+doubt|standard\s+of\s+proof|presumption\s+of\s+innocence|ingredients\s+of\s+the\s+offence/i,
    issue: 'Whether the prosecution proved every ingredient of the offence beyond reasonable doubt',
    doctrine: 'Presumption of innocence; burden on the prosecution throughout; proof beyond reasonable doubt; ingredients of the offence charged', statutes: ['Constitution of the Federal Republic of Nigeria 1999 (as amended), s. 36(5)', 'Evidence Act 2011, s. 135'], terms: [['"beyond reasonable doubt"', '"burden of proof"'], ['"ingredients of the offence"', 'prosecution']] },
  { id: 'confession', area: 'criminal', re: /\bconfess|extra-?judicial\s+statement|voluntar|trial\s+within\s+(?:a\s+)?trial/i,
    issue: 'Whether the confessional statement was made voluntarily and is admissible, and what weight it carries',
    doctrine: 'Confessions: voluntariness, trial-within-trial, retracted confessions and corroboration; recording requirements', statutes: ['Evidence Act 2011, ss. 28 and 29', 'Administration of Criminal Justice Act 2015 (recording of statements)'], terms: [['confession', '"confessional statement"'], ['voluntary', '"trial within trial"', 'retracted']] },
  { id: 'bail', area: 'criminal', re: /\bbail\b/i,
    issue: 'Whether the applicant should be admitted to bail, and on what terms',
    doctrine: 'Bail: presumption of innocence and the factors a court weighs (nature of the charge, evidence, risk of absconding or interference)', statutes: ['Constitution of the Federal Republic of Nigeria 1999 (as amended), s. 35', 'Administration of Criminal Justice Act 2015 (bail)'], terms: [['bail', '"bail pending trial"'], ['"presumption of innocence"']] },
  // evidence
  { id: 'electronic', area: 'evidence', re: /\belectronic|computer[-\s]generated|e-?mail|whatsapp|screenshot|print-?out|section\s+84|s\.\s*84\b/i,
    issue: 'Whether the electronic or computer-generated document is admissible (certificate of authentication and conditions)',
    doctrine: 'Admissibility of computer-generated evidence: conditions and certificate of authentication; admissibility is governed by the Evidence Act', statutes: ['Evidence Act 2011, s. 84 (as amended by the Evidence (Amendment) Act 2023)'], terms: [['"section 84"', '"computer generated"', '"electronic evidence"'], ['certificate', 'admissibility']] },
  { id: 'burden', area: 'evidence', re: /\bburden\s+of\s+proof|onus|who\s+asserts|preponderance|balance\s+of\s+probabilit/i,
    issue: 'On whom the burden of proof lies, and whether it was discharged on the balance of probabilities',
    doctrine: 'Legal and evidential burden; he who asserts must prove; civil standard on the balance of probabilities', statutes: ['Evidence Act 2011, ss. 131–134'], terms: [['"burden of proof"', 'onus'], ['"balance of probabilities"', '"preponderance of evidence"']] },
  { id: 'publicdocs', area: 'evidence', re: /\bpublic\s+document|certified\s+true\s+cop|CTC\b|secondary\s+evidence/i,
    issue: 'Whether the public document was properly certified and admissible as secondary evidence',
    doctrine: 'Public documents are proved by certified true copies; payment of fees and certification requirements', statutes: ['Evidence Act 2011, ss. 102, 104 and 105'], terms: [['"certified true copy"', '"public document"'], ['"secondary evidence"', 'admissibility']] },
  // procedure
  { id: 'jurisdiction', area: 'procedure', re: /\bjurisdiction|competen(?:ce|t)\s+(?:of\s+the\s+)?court|federal\s+high\s+court|section\s+251|s\.\s*251/i,
    issue: 'Whether the court has jurisdiction over the subject matter and parties (including the exclusive jurisdiction of the Federal High Court or the National Industrial Court)',
    doctrine: 'Jurisdiction is determined from the claimant\'s claim; it can be raised at any stage; exclusive jurisdiction of the Federal High Court and National Industrial Court', statutes: ['Constitution of the Federal Republic of Nigeria 1999 (as amended), ss. 6, 251, 254C and 272'], terms: [['jurisdiction', '"subject matter"'], ['"section 251"', '"Federal High Court"', '"section 272"']] },
  { id: 'limitation', area: 'procedure', re: /\blimitation|statute[-\s]barred|time[-\s]barred|public\s+officers?\s+protection/i,
    issue: 'Whether the action is statute-barred, and when time began to run',
    doctrine: 'Limitation: time runs from when the cause of action accrued; the writ and statement of claim determine the date; public officers are protected by a three-month limitation for acts done in the execution of public duty', statutes: ['Limitation Law of the relevant State (or the Limitation Act for the FCT)', 'Public Officers Protection Act (Cap. P41 LFN 2004), s. 2(a)'], terms: [['"statute barred"', 'limitation'], ['"cause of action"', '"Public Officers Protection"']] },
  { id: 'preaction', area: 'procedure', re: /\bpre-?action\s+notice|condition\s+precedent|notice\s+of\s+intention\s+to\s+sue/i,
    issue: 'Whether a statutory pre-action notice or other condition precedent was required and complied with',
    doctrine: 'Pre-action notice as a condition precedent: non-compliance renders the action incompetent, but the defect can be waived by the defendant', statutes: ['The statute establishing the defendant agency (check its pre-action notice provision)'], terms: [['"pre-action notice"', '"condition precedent"'], ['waiver', 'incompetent']] },
  { id: 'service', area: 'procedure', re: /\bservice\s+of\s+(?:the\s+)?(?:writ|process|originating)|substituted\s+service|outside\s+(?:the\s+)?(?:state|jurisdiction)|endorsement/i,
    issue: 'Whether the originating process was properly served (including service outside the State)',
    doctrine: 'Service of originating process is fundamental; service outside the State requires the statutory endorsement and time for appearance', statutes: ['Sheriffs and Civil Process Act (Cap. S6 LFN 2004), ss. 97 and 99', 'Rules of the relevant court on service'], terms: [['"service of originating process"', '"substituted service"'], ['"section 97"', 'endorsement', '"Sheriffs and Civil Process Act"']] },
  { id: 'injunction', area: 'procedure', re: /\binjunction|restrain|status\s+quo|interlocutory|ex\s+parte/i,
    issue: 'Whether an interlocutory injunction should be granted',
    doctrine: 'Interlocutory injunctions: legal right, serious question to be tried, balance of convenience, adequacy of damages, undertaking as to damages; ex parte orders only in real urgency', statutes: ['Rules of the relevant court on injunctions'], terms: [['"interlocutory injunction"', '"balance of convenience"'], ['"undertaking as to damages"', '"serious question"']] },
  { id: 'stay', area: 'procedure', re: /\bstay\s+of\s+execution|stay\s+(?:of\s+)?proceedings/i,
    issue: 'Whether the court should stay execution of the judgment (or proceedings) pending appeal',
    doctrine: 'Stay of execution: special or exceptional circumstances; the successful party is not to be deprived of the fruits of judgment lightly', statutes: ['Rules of the relevant appellate and trial courts'], terms: [['"stay of execution"', '"exceptional circumstances"'], ['"pending appeal"', '"fruits of judgment"']] },
  { id: 'garnishee', area: 'procedure', re: /\bgarnish|enforce(?:ment)?\s+of\s+judgment|attachment\s+of\s+debt/i,
    issue: 'Whether the judgment may be enforced by garnishee proceedings, and whether the consent of the Attorney-General is required for funds in the custody of a public officer',
    doctrine: 'Garnishee proceedings (order nisi and absolute); consent of the Attorney-General before attaching money in the custody of a public officer', statutes: ['Sheriffs and Civil Process Act (Cap. S6 LFN 2004), s. 84', 'Judgment Enforcement Rules'], terms: [['garnishee', '"order absolute"'], ['"section 84"', '"Attorney-General"', '"public funds"']] },
  // arbitration
  { id: 'arbitration', area: 'arbitration', re: /\barbitra|award|stay\s+of\s+proceedings\s+pending/i,
    issue: 'Whether the dispute is arbitrable and the court should stay proceedings (or set aside or enforce the award)',
    doctrine: 'Party autonomy; stay of proceedings where there is an arbitration agreement; limited grounds for setting aside; recognition and enforcement (New York Convention)', statutes: ['Arbitration and Mediation Act 2023'], terms: [['arbitration', '"arbitral award"'], ['"stay of proceedings"', '"set aside"', '"New York Convention"']] },
  // tort
  { id: 'negligence', area: 'tort', re: /\bnegligen|duty\s+of\s+care|reasonable\s+care|accident/i,
    issue: 'Whether the defendant owed and breached a duty of care causing damage that is not too remote',
    doctrine: 'Negligence: duty of care, breach, causation and damage; particulars of negligence must be pleaded and proved; res ipsa loquitur', statutes: [], terms: [['negligence', '"duty of care"'], ['causation', '"res ipsa loquitur"', '"particulars of negligence"']] },
  { id: 'defamation', area: 'tort', re: /\bdefam|libel|slander|publication/i,
    issue: 'Whether the words were published, referred to the claimant and were defamatory, and whether any defence applies',
    doctrine: 'Defamation: publication to a third party, reference to the claimant, defamatory meaning; defences of justification, fair comment and privilege', statutes: ['Defamation Law of the relevant State (where enacted)'], terms: [['defamation', 'libel', 'slander'], ['publication', 'justification', '"fair comment"']] },
  // family
  { id: 'divorce', area: 'family', re: /\bdivorce|dissolution\s+of\s+marriage|irretrievabl|matrimonial/i,
    issue: 'Whether the marriage has broken down irretrievably on one of the statutory facts',
    doctrine: 'Dissolution on irretrievable breakdown proved by one of the statutory facts; ancillary reliefs (custody, maintenance, settlement of property)', statutes: ['Matrimonial Causes Act (Cap. M7 LFN 2004), s. 15'], terms: [['"irretrievable breakdown"', '"dissolution of marriage"'], ['"Matrimonial Causes Act"', '"section 15"']] },
  { id: 'custody', area: 'family', re: /\bcustody|child|welfare\s+of\s+the\s+child|maintenance/i,
    issue: 'What arrangement for custody and maintenance serves the best interests of the child',
    doctrine: 'Best interests (welfare) of the child as the paramount consideration', statutes: ['Child\'s Rights Act 2003 (or the State\'s Child\'s Rights Law)', 'Matrimonial Causes Act (Cap. M7 LFN 2004)'], terms: [['custody', '"best interest of the child"'], ['maintenance', 'welfare']] },
  { id: 'wills', area: 'family', re: /\bwill\b|wills|testat|probate|letters\s+of\s+administration|estate|intestat/i,
    issue: 'Whether the will is valid (capacity, execution, attestation) or how the estate devolves on intestacy',
    doctrine: 'Formal validity of wills (signature and attestation); testamentary capacity; customary law limits on testamentary freedom; administration of estates', statutes: ['Wills Act 1837 or the Wills Law of the relevant State', 'Administration of Estates Law of the relevant State'], terms: [['will', 'probate', '"testamentary capacity"'], ['"letters of administration"', 'intestacy']] },
  // data
  { id: 'ndpa', area: 'data', re: /\bpersonal\s+data|data\s+protection|NDPA|data\s+breach|consent\s+to\s+process/i,
    issue: 'Whether the processing of personal data had a lawful basis and complied with the data protection principles',
    doctrine: 'Lawful basis for processing; data subject rights; security and breach notification; cross-border transfers', statutes: ['Nigeria Data Protection Act 2023', 'Constitution of the Federal Republic of Nigeria 1999 (as amended), s. 37 (privacy)'], terms: [['"personal data"', '"data protection"'], ['NDPA', 'privacy', '"section 37"']] },
  // election
  { id: 'preelection', area: 'election', re: /\bpre-?election|primar(?:y|ies)|nomination|candidate/i,
    issue: 'Whether the pre-election matter was filed within the constitutional time limits and before the right court',
    doctrine: 'Pre-election matters: strict time limits for filing, hearing and appeals; courts with jurisdiction', statutes: ['Constitution of the Federal Republic of Nigeria 1999 (as amended), s. 285', 'Electoral Act 2022'], terms: [['"pre-election matter"', 'primaries'], ['"section 285"', '"Electoral Act"']] },
];

/* ---------------- threshold points ---------------- */

const THRESHOLD = {
  civil: [
    { id: 'jurisdiction', text: 'Jurisdiction: subject matter (ss. 251 and 254C CFRN for the Federal High Court and NIC), territorial jurisdiction and the proper Division' },
    { id: 'standing', text: 'Locus standi of the claimant and juristic personality of every party' },
    { id: 'limitation', text: 'Limitation: when the cause of action accrued; Public Officers Protection Act (3 months) if a public officer or agency is sued' },
    { id: 'preaction', text: 'Pre-action notice or other conditions precedent in the statute establishing the defendant' },
    { id: 'mode', text: 'Mode of commencement: writ, originating summons (no substantial dispute of facts) or the FREP Rules' },
    { id: 'process', text: 'Competence of the originating process (signed by a legal practitioner whose name is on the Roll; seal and stamp of the NBA)' },
  ],
  criminal: [
    { id: 'jurisdiction', text: 'Jurisdiction of the trial court over the offence and the place of commission' },
    { id: 'charge', text: 'Competence of the charge or information (ingredients, particulars, duplicity) and consent where required' },
    { id: 'arraignment', text: 'Valid arraignment and plea' },
    { id: 'rights', text: 'Constitutional safeguards: s. 35 and s. 36 CFRN (time, interpreter, counsel, adequate facilities)' },
  ],
  appeal: [
    { id: 'notice', text: 'Competence of the notice of appeal: filed in time, signed, grounds arising from the decision' },
    { id: 'leave', text: 'Leave to appeal where required (interlocutory decisions on facts or mixed law and fact; appeals out of time)' },
    { id: 'grounds', text: 'Issues must arise from the grounds of appeal; a ground from which no issue is formulated is deemed abandoned' },
    { id: 'record', text: 'Record of appeal compiled and transmitted; briefs filed within the time in the Rules' },
  ],
};

/* ---------------- plan ---------------- */

export function detectArea(question) {
  let best = null, bestN = 0;
  for (const [id, a] of Object.entries(AREAS)) {
    const n = (String(question).match(new RegExp(a.re.source, 'gi')) || []).length;
    if (n > bestN) { best = id; bestN = n; }
  }
  return best || 'contract';
}

const QUESTION_STOP = new Set('without within whose claim claims client able a an the of to in on for and or is was were be been by with at as that this whether which who whom from it its his her their there not no any all into upon under than then so such same can could would should may might must shall will does do did has have had what when where why how if my our your client clients sued sue court'.split(' '));

function keyPhrases(q) {
  const words = oneLine(q).replace(/[^A-Za-z0-9'\s-]/g, ' ').split(/\s+/).filter(Boolean);
  const kept = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i].toLowerCase();
    if (QUESTION_STOP.has(w) || w.length < 4) continue;
    const next = words[i + 1]?.toLowerCase();
    if (next && !QUESTION_STOP.has(next) && next.length >= 4) { kept.push(`"${w} ${next}"`); i++; } else kept.push(w);
  }
  return [...new Set(kept)].slice(0, 5);
}

const orGroup = (alts) => (alts.length === 1 ? alts[0] : `(${alts.join(' OR ')})`);

/**
 * Builds a research plan.
 * opts.area: area id or 'auto'; opts.forum: court id where the matter is (for binding weight); opts.stage: 'civil' | 'criminal' | 'appeal'.
 */
export function buildPlan(question, opts = {}) {
  const q = oneLine(question);
  const area = !opts.area || opts.area === 'auto' ? detectArea(q) : opts.area;
  const forum = opts.forum || 'HC';
  const stage = opts.stage || (area === 'criminal' ? 'criminal' : /\bappeal\b/i.test(q) ? 'appeal' : 'civil');
  let concepts = CONCEPTS.filter(c => c.re.test(q));
  if (!concepts.length) concepts = CONCEPTS.filter(c => c.area === area).slice(0, 2);
  concepts = concepts.slice(0, 6);

  const issues = [];
  // The question itself, framed as the primary issue.
  const primary = /^whether\b/i.test(q) ? q.replace(/\?$/, '') : `Whether, on the facts stated, ${q.replace(/\?$/, '').replace(/^(?:can|could|is|are|does|do|will|would|should|may|must|has|have)\s+/i, (m) => '').replace(/^./, c => c.toLowerCase())}`;
  issues.push({ id: 'i1', text: primary, primary: true, concepts: concepts.map(c => c.id) });
  concepts.forEach((c, i) => issues.push({ id: `i${i + 2}`, text: c.issue, concept: c.id }));

  const statutes = [...new Set(concepts.flatMap(c => c.statutes))];
  const doctrines = concepts.map(c => ({ id: c.id, label: c.doctrine, statutes: c.statutes, area: AREAS[c.area]?.label }));
  const threshold = [...THRESHOLD[stage === 'criminal' ? 'criminal' : 'civil'], ...(stage === 'appeal' ? THRESHOLD.appeal : [])];

  // Queries: concept synonym groups + the question's own key phrases.
  const groups = concepts.flatMap(c => c.terms.slice(0, 2)).slice(0, 3);
  const phrases = keyPhrases(q);
  if (phrases.length) groups.push(phrases.slice(0, 3));
  const core = groups.map(orGroup).join(' AND ');
  const simple = [...new Set(concepts.flatMap(c => c.terms[0]).concat(phrases.slice(0, 2)))].slice(0, 4).join(' ');
  const queries = [
    { db: 'lawpavilion', label: 'LawPavilion', query: `${core} AND ("Supreme Court" OR "Court of Appeal")`, url: null, note: 'Paste into LawPavilion Prime search, then filter by Court (Supreme Court first) and by year.' },
    { db: 'legalpedia', label: 'LegalPedia', query: core, url: null, note: 'Use Advanced Search; narrow by subject and court. Read the full judgment, not only the summary.' },
    { db: 'nigerialii', label: 'NigeriaLII', query: simple.replace(/"/g, '"'), url: `https://nigerialii.org/search/?q=${encodeURIComponent(simple)}`, note: 'Free access to judgments and legislation.' },
    { db: 'scholar', label: 'Google Scholar', query: `${simple} Nigeria`, url: `https://scholar.google.com/scholar?q=${encodeURIComponent(`${simple} Nigeria`)}`, note: 'Useful for articles and commentary; verify any case found against an official report.' },
    { db: 'statutes', label: 'Statutes (NigeriaLII legislation)', query: statutes.slice(0, 2).map(s => s.replace(/,.*$/, '').replace(/\s*\(.*?\)\s*/g, ' ').trim()).join(' | ') || 'Relevant Act or Law', url: statutes.length ? `https://nigerialii.org/search/?q=${encodeURIComponent(statutes[0].replace(/,.*$/, '').replace(/\s*\(.*?\)\s*/g, ' ').trim())}` : null, note: 'Confirm the current text and any amendment before citing a section.' },
  ];

  const matrix = [];
  issues.forEach((iss) => {
    const rows = [
      { kind: 'statute', label: 'Constitution / statute', authority: iss.concept ? (CONCEPTS.find(c => c.id === iss.concept)?.statutes[0] || '') : (statutes[0] || '') },
      { kind: 'sc', label: 'Leading Supreme Court decision', authority: '' },
      { kind: 'ca', label: 'Court of Appeal decisions', authority: '' },
      { kind: 'contra', label: 'Contrary or distinguishable authority', authority: '' },
    ];
    if (iss.primary) rows.push({ kind: 'foreign', label: 'Persuasive foreign authority (optional)', authority: '' });
    for (const r of rows) matrix.push({ id: `${iss.id}-${r.kind}`, issue: iss.id, kind: r.kind, label: r.label, authority: r.authority, proposition: '', status: r.authority ? 'to verify' : 'to find' });
  });

  return { question: q, area, areaLabel: AREAS[area].label, forum, forumLabel: COURTS[forum]?.short || forum, stage, issues, threshold, doctrines, statutes, queries, matrix, createdAt: new Date().toISOString() };
}

/** Parses an authority typed into the matrix and says how much it weighs before the forum. */
export function assessAuthority(text, forum = 'HC') {
  const t = oneLine(text);
  if (!t) return null;
  const n = normaliseCitation(t);
  if (!n.ok) return { ok: false, normalised: t, note: 'Not recognised as a citation. Check the format, for example (2019) 10 NWLR (Pt. 1680) 1 or (2018) LPELR-44990(SC).' };
  if (n.kind === 'case') {
    const court = n.court ? COURTS[n.court.id] : null;
    const eff = court ? bindingEffect(court, forum) : null;
    return { ok: true, kind: 'case', normalised: n.full, court: court ? court.short : null, courtInferred: Boolean(n.court?.inferred), weight: eff ? eff.label : 'Court not shown in the citation', weightStatus: eff?.status || 'unknown', reason: eff?.reason || 'NWLR and similar reports carry decisions of several courts; check which court decided it.', warnings: n.warnings || [] };
  }
  if (n.kind === 'suit') {
    const court = n.court ? COURTS[n.court.id] : null;
    const eff = court ? bindingEffect(court, forum) : null;
    return { ok: true, kind: 'suit', normalised: n.normalised, court: court?.short || null, weight: eff?.label || '—', weightStatus: eff?.status || 'unknown', reason: eff?.reason || '' };
  }
  return { ok: true, kind: n.kind, normalised: n.normalised, court: null, weight: 'Statute', weightStatus: 'statute', reason: 'Binding legislation (check it is in force and the current text).' };
}

export function planMarkdown(p, log = []) {
  const L = [`# Research plan`, '', `**Question:** ${p.question}  `, `**Area:** ${p.areaLabel}  `, `**Forum:** ${p.forumLabel}  `, `**Prepared:** ${new Date(p.createdAt).toISOString().slice(0, 10)}`, ''];
  L.push('## Issues', '');
  p.issues.forEach((i, n) => L.push(`${n + 1}. ${i.text}`));
  L.push('', '## Threshold points', '', ...p.threshold.map(t => `- [ ] ${t.text}`), '');
  L.push('## Doctrines and provisions', '');
  for (const d of p.doctrines) L.push(`- **${d.label}**${d.statutes.length ? ` — ${d.statutes.join('; ')}` : ''}`);
  L.push('', '## Search queries', '');
  for (const q of p.queries) L.push(`- **${q.label}:** \`${q.query}\`${q.url ? ` (${q.url})` : ''}`);
  L.push('', '## Authority matrix', '', '| Issue | Slot | Authority | Court / weight | Proposition | Status |', '|---|---|---|---|---|---|');
  for (const r of p.matrix) {
    const a = r.assessment;
    L.push(`| ${p.issues.findIndex(i => i.id === r.issue) + 1} | ${r.label} | ${r.authority ? (a?.normalised || r.authority).replace(/\|/g, '/') : ''} | ${a ? `${a.court || ''}${a.weight ? ` — ${a.weight}` : ''}` : ''} | ${(r.proposition || '').replace(/\|/g, '/')} | ${r.status} |`);
  }
  if (log.length) {
    L.push('', '## Research log', '');
    for (const e of log) L.push(`- ${e.at.slice(0, 16).replace('T', ' ')} — **${e.db}**: \`${e.query}\`${e.note ? ` — ${e.note}` : ''}`);
  }
  L.push('', '---', '*Plan generated on-device from the question. It names statutes and doctrines only; every authority must come from your own research and be read in full before it is cited.*');
  return L.join('\n');
}
