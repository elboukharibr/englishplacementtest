// Sample and demo study material, written for this product. It is clearly labelled as
// sample content in the UI and is never mixed into a learner's own analytics.
// Every card quote must appear verbatim in its section text (checked by a unit test).

export type SampleCard = { q: string; a: string; type: string; section: number; quote: string; topic: string };
export type SampleSection = { heading: string; page: number; text: string };
export type SampleSubject = {
  key: string;
  subject: string;
  documentTitle: string;
  deckName: string;
  sections: SampleSection[];
  cards: SampleCard[];
  concepts: { name: string; kind: string; summary: string; importance: number; section: number; related: string[] }[];
};

export const MEDIA_STUDIES: SampleSubject = {
  key: "media",
  subject: "Media Studies",
  documentTitle: "Sample — Platforms and Media Power (study notes)",
  deckName: "Sample Deck — Platforms and Media Power",
  sections: [
    {
      heading: "Gatekeeping",
      page: 1,
      text:
        "Gatekeeping describes the process by which editors and journalists select which events become news. The idea was borrowed from the social psychologist Kurt Lewin, and David Manning White applied it to newsrooms in 1950 by studying how a wire editor chose stories. In the classic model, a small number of professional gatekeepers control access to public attention.\n\nGatekeeping is criticised for overstating individual choice: routines, deadlines, ownership and audience expectations also shape what passes the gate.",
    },
    {
      heading: "Platformization",
      page: 2,
      text:
        "Platformization refers to the penetration of the infrastructures, economic processes and governance frameworks of digital platforms into different sectors of society. News organisations increasingly depend on platforms for distribution, which shifts power over visibility from editors to platform companies.\n\nAlgorithmic curation is the automated ranking and filtering of content by software. Unlike editorial gatekeeping, algorithmic curation is optimised for signals such as engagement, and its criteria are rarely transparent to the public. Because amplification determines which issues become widely visible, algorithmic visibility can affect public accountability.",
    },
    {
      heading: "Consequences for news organisations",
      page: 3,
      text:
        "For a small independent outlet, platform distribution can increase reach at low cost, but it also makes the outlet's visibility dependent on ranking changes it cannot control. Scholars therefore describe a relationship of asymmetric dependence between publishers and platforms.",
    },
  ],
  concepts: [
    { name: "Gatekeeping", kind: "definition", summary: "Editorial selection of which events become news.", importance: 82, section: 0, related: ["Algorithmic curation"] },
    { name: "Platformization", kind: "definition", summary: "Penetration of platform infrastructures, economics and governance into social sectors.", importance: 92, section: 1, related: ["Algorithmic curation", "Asymmetric dependence"] },
    { name: "Algorithmic curation", kind: "concept", summary: "Automated ranking and filtering of content, optimised for signals such as engagement.", importance: 85, section: 1, related: ["Gatekeeping", "Platformization"] },
    { name: "Asymmetric dependence", kind: "concept", summary: "Publishers depend on platforms far more than platforms depend on any single publisher.", importance: 70, section: 2, related: ["Platformization"] },
    { name: "David Manning White", kind: "scholar", summary: "Applied gatekeeping to newsrooms in 1950.", importance: 60, section: 0, related: ["Gatekeeping"] },
  ],
  cards: [
    { q: "What does gatekeeping describe in news production?", a: "The process by which editors and journalists select which events become news.", type: "definition", section: 0, quote: "Gatekeeping describes the process by which editors and journalists select which events become news.", topic: "Gatekeeping" },
    { q: "Who applied the gatekeeping concept to newsrooms in 1950?", a: "David Manning White, by studying how a wire editor chose stories.", type: "scholar", section: 0, quote: "David Manning White applied it to newsrooms in 1950 by studying how a wire editor chose stories.", topic: "Gatekeeping" },
    { q: "Why is the classic gatekeeping model criticised?", a: "It overstates individual choice; routines, deadlines, ownership and audience expectations also shape selection.", type: "critical", section: 0, quote: "Gatekeeping is criticised for overstating individual choice: routines, deadlines, ownership and audience expectations also shape what passes the gate.", topic: "Gatekeeping" },
    { q: "Define platformization.", a: "The penetration of platform infrastructures, economic processes and governance frameworks into different sectors of society.", type: "definition", section: 1, quote: "Platformization refers to the penetration of the infrastructures, economic processes and governance frameworks of digital platforms into different sectors of society.", topic: "Platformization" },
    { q: "How does platformization redistribute power over visibility in news?", a: "It shifts power over visibility from editors to platform companies.", type: "cause_effect", section: 1, quote: "shifts power over visibility from editors to platform companies", topic: "Platformization" },
    { q: "Algorithmic curation is the automated {{ranking and filtering}} of content by software.", a: "ranking and filtering", type: "cloze", section: 1, quote: "Algorithmic curation is the automated ranking and filtering of content by software.", topic: "Algorithmic curation" },
    { q: "How does algorithmic curation differ from editorial gatekeeping?", a: "It is automated and optimised for signals such as engagement, with criteria rarely transparent to the public.", type: "comparison", section: 1, quote: "Unlike editorial gatekeeping, algorithmic curation is optimised for signals such as engagement, and its criteria are rarely transparent to the public.", topic: "Algorithmic curation" },
    { q: "Why can algorithmic visibility affect public accountability?", a: "Because amplification determines which issues become widely visible.", type: "cause_effect", section: 1, quote: "Because amplification determines which issues become widely visible, algorithmic visibility can affect public accountability.", topic: "Algorithmic curation" },
    { q: "How might platform distribution affect a small independent news outlet?", a: "It can increase reach at low cost but makes visibility dependent on ranking changes the outlet cannot control.", type: "application", section: 2, quote: "platform distribution can increase reach at low cost, but it also makes the outlet's visibility dependent on ranking changes it cannot control", topic: "Asymmetric dependence" },
    { q: "What term describes the publisher–platform relationship in these notes?", a: "Asymmetric dependence.", type: "basic", section: 2, quote: "Scholars therefore describe a relationship of asymmetric dependence between publishers and platforms.", topic: "Asymmetric dependence" },
  ],
};

export const BIOLOGY: SampleSubject = {
  key: "biology",
  subject: "Biology",
  documentTitle: "Demo — Cellular Respiration",
  deckName: "Demo — Cellular Respiration",
  sections: [
    {
      heading: "Glycolysis",
      page: 1,
      text:
        "Glycolysis takes place in the cytoplasm and splits one molecule of glucose into two molecules of pyruvate. It does not require oxygen. Glycolysis yields a net gain of two ATP molecules and two NADH molecules per glucose.",
    },
    {
      heading: "The Krebs cycle",
      page: 2,
      text:
        "In the presence of oxygen, pyruvate enters the mitochondrion and is converted to acetyl-CoA. The Krebs cycle (citric acid cycle) runs in the mitochondrial matrix and releases carbon dioxide while producing NADH and FADH2.",
    },
    {
      heading: "Oxidative phosphorylation",
      page: 3,
      text:
        "The electron transport chain is located in the inner mitochondrial membrane. Electrons carried by NADH and FADH2 pass along the chain, and the energy released pumps protons across the membrane. Protons flowing back through ATP synthase drive the production of most of the cell's ATP. Oxygen is the final electron acceptor and combines with protons to form water.",
    },
  ],
  concepts: [
    { name: "Glycolysis", kind: "process", summary: "Splits glucose into two pyruvate in the cytoplasm.", importance: 85, section: 0, related: ["Krebs cycle"] },
    { name: "Krebs cycle", kind: "process", summary: "Runs in the mitochondrial matrix, releasing CO2 and producing NADH and FADH2.", importance: 80, section: 1, related: ["Glycolysis", "Electron transport chain"] },
    { name: "Electron transport chain", kind: "mechanism", summary: "Pumps protons across the inner membrane using electron energy.", importance: 88, section: 2, related: ["ATP synthase"] },
    { name: "ATP synthase", kind: "mechanism", summary: "Uses proton flow to make ATP.", importance: 75, section: 2, related: ["Electron transport chain"] },
  ],
  cards: [
    { q: "Where does glycolysis take place?", a: "In the cytoplasm.", type: "basic", section: 0, quote: "Glycolysis takes place in the cytoplasm", topic: "Glycolysis" },
    { q: "What is the net ATP yield of glycolysis per glucose?", a: "Two ATP (plus two NADH).", type: "basic", section: 0, quote: "Glycolysis yields a net gain of two ATP molecules and two NADH molecules per glucose.", topic: "Glycolysis" },
    { q: "Where does the Krebs cycle run?", a: "In the mitochondrial matrix.", type: "basic", section: 1, quote: "The Krebs cycle (citric acid cycle) runs in the mitochondrial matrix", topic: "Krebs cycle" },
    { q: "What is the final electron acceptor in the electron transport chain?", a: "Oxygen, which combines with protons to form water.", type: "basic", section: 2, quote: "Oxygen is the final electron acceptor and combines with protons to form water.", topic: "Oxidative phosphorylation" },
    { q: "Protons flowing back through {{ATP synthase}} drive the production of most of the cell's ATP.", a: "ATP synthase", type: "cloze", section: 2, quote: "Protons flowing back through ATP synthase drive the production of most of the cell's ATP.", topic: "Oxidative phosphorylation" },
  ],
};

export const ECONOMICS: SampleSubject = {
  key: "economics",
  subject: "Economics",
  documentTitle: "Demo — Core Microeconomics",
  deckName: "Demo — Core Microeconomics",
  sections: [
    {
      heading: "Opportunity cost",
      page: 1,
      text:
        "The opportunity cost of a choice is the value of the next best alternative that is given up. Because resources are scarce, every economic decision involves an opportunity cost, even when no money changes hands.",
    },
    {
      heading: "Price elasticity of demand",
      page: 2,
      text:
        "Price elasticity of demand measures how strongly the quantity demanded responds to a change in price. It is calculated as the percentage change in quantity demanded divided by the percentage change in price. Demand is called elastic when the absolute value is greater than one and inelastic when it is less than one. Goods with few substitutes, such as many necessities, tend to have inelastic demand.",
    },
    {
      heading: "Comparative advantage",
      page: 3,
      text:
        "A country has a comparative advantage in a good when it can produce it at a lower opportunity cost than its trading partners. David Ricardo used this idea in 1817 to argue that trade can benefit both partners even when one is more productive at everything.",
    },
  ],
  concepts: [
    { name: "Opportunity cost", kind: "definition", summary: "Value of the next best alternative given up.", importance: 90, section: 0, related: ["Comparative advantage"] },
    { name: "Price elasticity of demand", kind: "formula", summary: "%ΔQd / %ΔP.", importance: 85, section: 1, related: [] },
    { name: "Comparative advantage", kind: "theory", summary: "Lower opportunity cost of production than trading partners.", importance: 85, section: 2, related: ["Opportunity cost"] },
  ],
  cards: [
    { q: "Define opportunity cost.", a: "The value of the next best alternative that is given up.", type: "definition", section: 0, quote: "The opportunity cost of a choice is the value of the next best alternative that is given up.", topic: "Opportunity cost" },
    { q: "How is price elasticity of demand calculated?", a: "Percentage change in quantity demanded divided by percentage change in price.", type: "basic", section: 1, quote: "It is calculated as the percentage change in quantity demanded divided by the percentage change in price.", topic: "Elasticity" },
    { q: "When is demand called elastic?", a: "When the absolute value of price elasticity is greater than one.", type: "basic", section: 1, quote: "Demand is called elastic when the absolute value is greater than one", topic: "Elasticity" },
    { q: "Why do necessities often have inelastic demand?", a: "Because they have few substitutes.", type: "cause_effect", section: 1, quote: "Goods with few substitutes, such as many necessities, tend to have inelastic demand.", topic: "Elasticity" },
    { q: "When does a country have a comparative advantage in a good?", a: "When it can produce the good at a lower opportunity cost than its trading partners.", type: "definition", section: 2, quote: "A country has a comparative advantage in a good when it can produce it at a lower opportunity cost than its trading partners.", topic: "Comparative advantage" },
  ],
};

export const RESEARCH_METHODS: SampleSubject = {
  key: "methods",
  subject: "Research Methods",
  documentTitle: "Demo — Validity and Reliability",
  deckName: "Demo — Research Methods",
  sections: [
    {
      heading: "Reliability and validity",
      page: 1,
      text:
        "Reliability is the consistency of a measurement: a reliable instrument gives similar results under similar conditions. Validity is whether an instrument measures what it claims to measure. A measure can be reliable without being valid, but it cannot be valid without being reliable.",
    },
    {
      heading: "Internal and external validity",
      page: 2,
      text:
        "Internal validity is the degree to which a study can rule out alternative explanations for its results. A confounding variable is a variable that influences both the supposed cause and the outcome, threatening internal validity. External validity is the extent to which findings generalise to other people, settings and times.",
    },
    {
      heading: "Random assignment versus random sampling",
      page: 3,
      text:
        "Random assignment places participants into conditions by chance and mainly protects internal validity. Random sampling selects participants from a population by chance and mainly supports external validity.",
    },
  ],
  concepts: [
    { name: "Reliability", kind: "definition", summary: "Consistency of a measurement.", importance: 85, section: 0, related: ["Validity"] },
    { name: "Validity", kind: "definition", summary: "Whether an instrument measures what it claims to measure.", importance: 85, section: 0, related: ["Reliability"] },
    { name: "Confounding variable", kind: "definition", summary: "Influences both cause and outcome.", importance: 75, section: 1, related: ["Internal validity"] },
    { name: "Random assignment", kind: "method", summary: "Protects internal validity.", importance: 70, section: 2, related: ["Random sampling"] },
  ],
  cards: [
    { q: "What is reliability in measurement?", a: "The consistency of a measurement under similar conditions.", type: "definition", section: 0, quote: "Reliability is the consistency of a measurement", topic: "Reliability and validity" },
    { q: "Can a measure be valid without being reliable?", a: "No. It can be reliable without being valid, but not valid without being reliable.", type: "critical", section: 0, quote: "A measure can be reliable without being valid, but it cannot be valid without being reliable.", topic: "Reliability and validity" },
    { q: "What is a confounding variable?", a: "A variable that influences both the supposed cause and the outcome.", type: "definition", section: 1, quote: "A confounding variable is a variable that influences both the supposed cause and the outcome", topic: "Internal validity" },
    { q: "How does random assignment differ from random sampling?", a: "Assignment places participants into conditions by chance (internal validity); sampling selects participants from a population by chance (external validity).", type: "comparison", section: 2, quote: "Random assignment places participants into conditions by chance and mainly protects internal validity.", topic: "Random assignment" },
  ],
};

export const DEMO_SUBJECTS = [MEDIA_STUDIES, BIOLOGY, ECONOMICS, RESEARCH_METHODS];
