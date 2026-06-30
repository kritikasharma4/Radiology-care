"""
ACR BI-RADS 5th Edition clinical knowledge base.
Each entry is embedded into ChromaDB on first startup.
Sources: ACR BI-RADS Atlas 5th Edition, ACR Practice Parameters,
         American Cancer Society Guidelines, published clinical literature.
"""

CLINICAL_CHUNKS = [

    # ── BI-RADS Categories Overview ──────────────────────────────────────────
    {
        "id": "birads_overview",
        "text": (
            "BI-RADS (Breast Imaging Reporting and Data System) Assessment Categories: "
            "The ACR BI-RADS lexicon provides standardized categories 0 through 6 for mammography reporting. "
            "Category 0: Incomplete assessment — additional imaging needed (recall for further evaluation). "
            "Category 1: Negative — no abnormality found, routine annual screening. "
            "Category 2: Benign finding — no malignancy, routine annual screening. "
            "Category 3: Probably benign — short-interval 6-month follow-up to establish stability. "
            "Category 4: Suspicious — biopsy should be considered; subdivided into 4A (low suspicion, PPV 2–10%), "
            "4B (moderate suspicion, PPV 10–50%), 4C (high suspicion, PPV 50–95%). "
            "Category 5: Highly suggestive of malignancy — PPV ≥95%, biopsy required. "
            "Category 6: Known biopsy-proven malignancy — treatment planning. "
            "The final assessment category drives all clinical management decisions and must be the HIGHEST category "
            "of any individual finding in the study."
        ),
        "metadata": {"source": "ACR BI-RADS 5th Edition", "category": "birads_overview"},
    },

    # ── BI-RADS 3 — Probably Benign ──────────────────────────────────────────
    {
        "id": "birads_3",
        "text": (
            "BI-RADS Category 3 — Probably Benign: "
            "Assigned when a finding has less than 2% likelihood of malignancy. "
            "Standard management: 6-month unilateral diagnostic mammogram, then bilateral at 12 and 24 months. "
            "If stable at 24 months, can be downgraded to BI-RADS 2 (benign). "
            "Classic BI-RADS 3 findings include: "
            "(1) Non-calcified circumscribed oval or round solid mass on a screening exam — most are fibroadenomas. "
            "(2) Focal asymmetry that is not palpable and has no associated findings. "
            "(3) Single cluster of punctate calcifications. "
            "BI-RADS 3 should NOT be used in a screening report — it requires diagnostic workup first. "
            "Do not use BI-RADS 3 if the patient has not had prior imaging for comparison. "
            "If a patient is very anxious, has a strong family history, or cannot comply with follow-up, "
            "biopsy is an acceptable alternative to surveillance. "
            "Key principle: BI-RADS 3 means 'watch, do not biopsy yet' — NOT 'not suspicious.'"
        ),
        "metadata": {"source": "ACR BI-RADS 5th Edition", "category": "birads_category", "birads": 3},
    },

    # ── BI-RADS 4A — Low Suspicion ───────────────────────────────────────────
    {
        "id": "birads_4a",
        "text": (
            "BI-RADS Category 4A — Low Suspicion for Malignancy: "
            "Positive predictive value (PPV) range: 2–10%. "
            "Management: Tissue sampling (biopsy) is warranted but expectation of benign outcome is reasonable. "
            "A benign concordant biopsy result can be followed with 6-month imaging. "
            "Examples of BI-RADS 4A findings: "
            "(1) Palpable circumscribed solid mass — most likely fibroadenoma or cyst, but cannot exclude malignancy without biopsy. "
            "(2) Solitary dilated duct — may indicate intraductal papilloma. "
            "(3) Mildly suspicious calcifications that don't meet BI-RADS 3 criteria but are not overtly malignant. "
            "(4) A focal asymmetry with suspicious features but no discrete mass. "
            "The radiologist should recommend tissue sampling but can inform the patient that benign is the likely outcome. "
            "Ultrasound-guided core needle biopsy is the preferred method for 4A solid masses."
        ),
        "metadata": {"source": "ACR BI-RADS 5th Edition", "category": "birads_category", "birads": 4},
    },

    # ── BI-RADS 4B — Moderate Suspicion ─────────────────────────────────────
    {
        "id": "birads_4b",
        "text": (
            "BI-RADS Category 4B — Moderate Suspicion for Malignancy: "
            "Positive predictive value (PPV) range: 10–50%. "
            "Management: Tissue sampling required. Benign biopsy result requires radiologic-pathologic concordance review. "
            "If benign pathology (e.g. fibroadenoma) is returned but imaging was highly suspicious, "
            "consider repeat biopsy or short-interval follow-up. "
            "Examples of BI-RADS 4B findings: "
            "(1) Irregular mass with indistinct margins — higher malignancy risk than circumscribed mass. "
            "(2) New or changing mass on comparison with prior imaging. "
            "(3) Grouped amorphous or fine pleomorphic calcifications. "
            "(4) Mass with microlobulated margins — lobulation suggests active growth. "
            "Key distinction from 4A: In 4B, a benign biopsy result should prompt pathologic correlation "
            "before dismissing the finding. The radiologist must judge whether pathology explains the imaging. "
            "Core needle biopsy with clip placement is standard."
        ),
        "metadata": {"source": "ACR BI-RADS 5th Edition", "category": "birads_category", "birads": 4},
    },

    # ── BI-RADS 4C — High Suspicion ──────────────────────────────────────────
    {
        "id": "birads_4c_5",
        "text": (
            "BI-RADS Category 4C — High Suspicion for Malignancy: "
            "Positive predictive value (PPV) range: 50–95%. "
            "Management: Biopsy required with surgical referral on standby. "
            "Discordant benign biopsy must trigger repeat biopsy or excision. "
            "Examples: Irregular mass with spiculated margins, fine linear calcifications in segmental distribution. "
            "\n"
            "BI-RADS Category 5 — Highly Suggestive of Malignancy: "
            "PPV ≥95%. Appearance is classic for breast cancer. "
            "Management: Biopsy required BEFORE any surgical intervention. "
            "Marker clip placed at time of biopsy — essential if patient will undergo neoadjuvant chemotherapy. "
            "Pre-biopsy staging workup may be warranted (chest CT, bone scan) depending on clinical context. "
            "Classic BI-RADS 5 findings: spiculated high-density irregular mass, fine linear branching "
            "(casting) calcifications in segmental distribution, spiculated mass with associated malignant calcifications. "
            "A BI-RADS 5 diagnosis commits the care team to a cancer pathway — surgical oncology referral is indicated."
        ),
        "metadata": {"source": "ACR BI-RADS 5th Edition", "category": "birads_category", "birads": 5},
    },

    # ── Mass: Shape ──────────────────────────────────────────────────────────
    {
        "id": "mass_shape",
        "text": (
            "Mass Shape Descriptors (ACR BI-RADS Lexicon): "
            "ROUND: Spherical, ball-shaped; all axes approximately equal. "
            "Round masses are relatively low suspicion when circumscribed. Common entities: cyst, fibroadenoma, lymph node. "
            "\n"
            "OVAL: Elliptical or egg-shaped, may have 2–3 undulations (gently lobulated). "
            "Oval circumscribed masses are the classic benign appearance of fibroadenoma. "
            "An oval circumscribed non-calcified mass on screening may be assigned BI-RADS 3. "
            "\n"
            "IRREGULAR: Shape is neither round nor oval — margins are angulated, lobulated beyond 3 undulations, "
            "or the shape does not suggest any specific benign entity. "
            "Irregular shape is a significant malignancy predictor. "
            "Irregular shape combined with spiculated or indistinct margins: high malignancy suspicion (BI-RADS ≥4B). "
            "\n"
            "Clinical significance: Shape is secondary to margin in predicting malignancy. "
            "A round mass with spiculated margin is still highly suspicious. "
            "An irregular mass with circumscribed margin has lower (but not absent) malignancy risk."
        ),
        "metadata": {"source": "ACR BI-RADS 5th Edition", "category": "mass_descriptors", "descriptor": "shape"},
    },

    # ── Mass: Margin ─────────────────────────────────────────────────────────
    {
        "id": "mass_margin",
        "text": (
            "Mass Margin Descriptors — THE MOST IMPORTANT PREDICTOR OF MALIGNANCY (ACR BI-RADS Lexicon): "
            "\n"
            "CIRCUMSCRIBED (was 'well-defined' in older editions): Sharply demarcated abrupt interface between mass and "
            "surrounding tissue. Greater than 75% of margin is well-defined. "
            "Most circumscribed masses are benign (cyst, fibroadenoma). Circumscribed = low suspicion when oval/round. "
            "\n"
            "OBSCURED: More than 25% of margin is hidden by overlying or adjacent normal tissue. "
            "Requires ultrasound to evaluate the hidden margin. If ultrasound shows circumscribed: likely benign. "
            "If ultrasound shows irregular: upgrade suspicion. "
            "\n"
            "MICROLOBULATED: Short-cycle undulations along the margin. Indicates active growth at the margin. "
            "Associated with malignancy — do not assign BI-RADS 3. Minimum BI-RADS 4A. "
            "\n"
            "INDISTINCT (ill-defined): No clear demarcation between mass and surrounding tissue. "
            "Suggests infiltration of adjacent parenchyma. Malignancy or radial scar/sclerosing lesion. "
            "Minimum BI-RADS 4B. "
            "\n"
            "SPICULATED: Lines radiating from the mass. The single strongest predictor of malignancy on mammography. "
            "Spiculated mass = BI-RADS ≥4C in most cases; BI-RADS 5 if other features also present. "
            "Differential: invasive ductal carcinoma (most common), radial scar, post-surgical scar, fat necrosis (rare). "
            "Spiculated + irregular shape + high density = classic breast cancer appearance."
        ),
        "metadata": {"source": "ACR BI-RADS 5th Edition", "category": "mass_descriptors", "descriptor": "margin"},
    },

    # ── Mass: Density ────────────────────────────────────────────────────────
    {
        "id": "mass_density",
        "text": (
            "Mass Density Descriptors (ACR BI-RADS Lexicon): "
            "\n"
            "HIGH DENSITY: The mass appears whiter (more attenuating) than an equal volume of fibroglandular tissue. "
            "High-density masses are more suspicious than low-density masses of the same margin type. "
            "Most malignant masses are equal or high density. "
            "\n"
            "EQUAL DENSITY: The mass has the same attenuation as an equal volume of fibroglandular tissue. "
            "No independent contribution to suspicion level. Assessed with other features. "
            "\n"
            "LOW DENSITY: The mass appears darker than fibroglandular tissue but not fat-containing. "
            "Low density masses with circumscribed margins are almost always benign (cyst is an example). "
            "\n"
            "FAT-CONTAINING: The mass contains macroscopic fat. "
            "FAT-CONTAINING masses are always benign: lipoma, oil cyst (fat necrosis), hamartoma, galactocele. "
            "No biopsy needed for fat-containing masses unless clinical concern (e.g. rapidly enlarging). "
            "\n"
            "Key principle: Density modifies the suspicion level — a spiculated mass is suspicious regardless of density. "
            "A circumscribed mass is further reassured if low density, further penalized if high density."
        ),
        "metadata": {"source": "ACR BI-RADS 5th Edition", "category": "mass_descriptors", "descriptor": "density"},
    },

    # ── Calcifications: Typically Benign ─────────────────────────────────────
    {
        "id": "calc_benign",
        "text": (
            "Typically Benign Calcification Morphologies (ACR BI-RADS Lexicon) — No Biopsy Needed: "
            "\n"
            "SKIN CALCIFICATIONS: Lucent center, usually polygonal; found along breast surface. "
            "VASCULAR CALCIFICATIONS: Parallel tracks (tram-track) along vessel walls. Associated with atherosclerosis. "
            "COARSE (POPCORN) CALCIFICATIONS: Large >2-3mm, irregular; represent involuting fibroadenoma. "
            "LARGE ROD-LIKE (SECRETORY): Dense cylindrical along ducts; plasma cell mastitis pattern. "
            "ROUND: Formed in acini of lobules. When <0.5mm called punctate — if grouped, can be BI-RADS 3. "
            "LUCENT-CENTERED: Round with central lucency; oil cysts, fat necrosis, sebaceous cysts. "
            "EGGSHELL / RIM: Very thin rim calcification of a spherical structure; oil cyst. "
            "DYSTROPHIC: Irregular coarse calcifications in irradiated or traumatized tissue; typically >0.5mm. "
            "MILK OF CALCIUM: Teacup shape on lateral view (layering), smudgy on CC view; benign cystic. "
            "SUTURE: Linear or tubular, in expected location of prior surgery. "
            "\n"
            "These morphologies do NOT require biopsy. Assign BI-RADS 2 (or BI-RADS 3 for grouped punctate in some cases). "
            "Description in report is sufficient to document benign finding."
        ),
        "metadata": {"source": "ACR BI-RADS 5th Edition", "category": "calcification_descriptors", "descriptor": "benign_morphology"},
    },

    # ── Calcifications: Suspicious Morphology ────────────────────────────────
    {
        "id": "calc_suspicious",
        "text": (
            "Suspicious Calcification Morphologies (ACR BI-RADS Lexicon): "
            "\n"
            "AMORPHOUS: Too small or hazy to characterize morphology; powder-like appearance. "
            "Bilateral diffuse amorphous may be BI-RADS 3; unilateral grouped amorphous = BI-RADS 4B. "
            "PPV approximately 20%. Associated with ADH, LCIS, DCIS. "
            "\n"
            "COARSE HETEROGENEOUS: Irregular, larger (>0.5mm), irregular size and shape. "
            "May represent fibroadenoma in evolution or DCIS. BI-RADS 4B. PPV ~15%. "
            "\n"
            "FINE PLEOMORPHIC: Various shapes and sizes, smaller than coarse heterogeneous. "
            "High suspicion for DCIS. BI-RADS 4B–4C depending on distribution. PPV ~25–29%. "
            "\n"
            "FINE LINEAR / FINE LINEAR BRANCHING (CASTING): Thin irregular linear forms, "
            "may fill and outline a duct or duct branch. "
            "Highest malignancy suspicion among calcification morphologies. "
            "Strongly associated with high-grade DCIS. BI-RADS 4C or 5. PPV ~60–78%. "
            "\n"
            "CRITICAL RULE: When calcification morphology is suspicious, assess distribution to finalize BI-RADS. "
            "Segmental distribution of fine linear calcifications = BI-RADS 5 in most cases. "
            "The combination of fine linear/pleomorphic morphology + segmental or linear distribution "
            "is the calcification equivalent of a spiculated mass — biopsy is mandatory."
        ),
        "metadata": {"source": "ACR BI-RADS 5th Edition", "category": "calcification_descriptors", "descriptor": "suspicious_morphology"},
    },

    # ── Calcifications: Distribution ─────────────────────────────────────────
    {
        "id": "calc_distribution",
        "text": (
            "Calcification Distribution Descriptors (ACR BI-RADS Lexicon): "
            "\n"
            "DIFFUSE: Randomly distributed throughout the breast. "
            "Usually bilateral and symmetric. Most diffuse calcifications are benign (e.g. bilateral diffuse amorphous). "
            "\n"
            "REGIONAL: Scattered in a large volume (>2cc) of breast tissue, not conforming to a duct system. "
            "May indicate benign lobular changes. If suspicious morphology in regional distribution: BI-RADS 4A–4B. "
            "\n"
            "GROUPED (formerly 'clustered'): At least 5 calcifications occupying a small volume of tissue (<2cc). "
            "Grouped distribution upgrades suspicion compared to diffuse or regional. "
            "Grouped fine pleomorphic = BI-RADS 4B/4C. "
            "\n"
            "LINEAR: Calcifications arranged in a line, suggesting filling of a duct. "
            "May branch (arborizing pattern). If morphology is fine linear in linear distribution: BI-RADS 4C–5. "
            "\n"
            "SEGMENTAL: Calcifications distributed in a lobe or segment, suggesting filling of ducts "
            "and their branches within a segment. "
            "HIGHEST MALIGNANCY RISK among distributions for suspicious morphology. "
            "Segmental + fine linear morphology = BI-RADS 5 (classic DCIS pattern). "
            "\n"
            "Key correlation: Distribution significance depends on morphology. "
            "Benign morphology in any distribution remains benign. "
            "Suspicious morphology in segmental/linear distribution = highest risk. "
            "The upgrading effect: grouped > regional > diffuse; linear > grouped in some contexts."
        ),
        "metadata": {"source": "ACR BI-RADS 5th Edition", "category": "calcification_descriptors", "descriptor": "distribution"},
    },

    # ── Architectural Distortion ──────────────────────────────────────────────
    {
        "id": "architectural_distortion",
        "text": (
            "Architectural Distortion — Underdiagnosed, Clinically Important Finding: "
            "\n"
            "Definition: The normal architecture of the breast is distorted with no visible mass. "
            "Includes spiculations radiating from a point and focal retraction, distortion, or straightening "
            "at the edges of the parenchyma. "
            "\n"
            "Clinical significance: Architectural distortion without a central mass on mammography "
            "is associated with malignancy in approximately 60–70% of cases when detected on 2D mammography. "
            "On tomosynthesis (DBT), architectural distortion is MORE conspicuous and detection rates are higher, "
            "but the PPV may be lower (~40–50%) as more radial scars are detected. "
            "\n"
            "Differential diagnosis (in order of frequency): "
            "1. Radial scar / complex sclerosing lesion — can mimic malignancy, requires biopsy to exclude "
            "2. Invasive lobular carcinoma (ILC) — ILC classically presents as architectural distortion, "
            "   not a discrete mass, which is why it is often missed on mammography "
            "3. Invasive ductal carcinoma (IDC) — may present as distortion only "
            "4. Post-surgical scar — only if explained by prior surgery in that location "
            "5. Fat necrosis (rare) "
            "\n"
            "Management: BI-RADS 4 (biopsy required) unless clearly post-surgical. "
            "Ultrasound correlation required — if sonographic correlate found (hypoechoic lesion with shadowing), "
            "ultrasound-guided biopsy is preferred. If no sonographic correlate, stereotactic biopsy. "
            "\n"
            "WARNING: Do not dismiss architectural distortion as post-surgical unless surgery is documented "
            "at that exact location. Invasive lobular carcinoma is the great masquerader."
        ),
        "metadata": {"source": "ACR BI-RADS 5th Edition", "category": "special_finding", "finding_type": "architectural_distortion"},
    },

    # ── Asymmetry Types ──────────────────────────────────────────────────────
    {
        "id": "asymmetry_types",
        "text": (
            "Asymmetry Descriptors (ACR BI-RADS Lexicon): "
            "\n"
            "ASYMMETRY: A unilateral deposit of fibroglandular tissue not conforming to the definition of a mass. "
            "Asymmetry visible on only one mammographic projection is most likely a summation artifact. "
            "Asymmetry seen on two projections requires further workup. "
            "\n"
            "GLOBAL ASYMMETRY: An asymmetry occupying a large volume (>one quadrant) of one breast. "
            "Usually a normal variant (natural developmental asymmetry). "
            "Clinically significant if NEW compared to prior, or if palpable. "
            "\n"
            "FOCAL ASYMMETRY: A confined asymmetry with a similar shape on two projections "
            "but lacking the outward convex borders and conspicuity of a mass. "
            "The hallmark of focal asymmetry: it lacks the 'mass effect' — no architectural distortion. "
            "Focal asymmetry without associated features (e.g. calcifications, distortion) may be BI-RADS 3 "
            "if truly stable on comparison with prior studies. "
            "\n"
            "DEVELOPING ASYMMETRY (MOST IMPORTANT): A focal asymmetry that is new, larger, or more conspicuous "
            "compared to a prior examination. "
            "The word 'developing' means change over time — this is the red flag. "
            "PPV for developing asymmetry: approximately 12–15% for malignancy. "
            "Minimum BI-RADS 4 — tissue sampling required. "
            "Never downgrade a developing asymmetry to BI-RADS 3 without additional diagnostic workup. "
            "\n"
            "Clinical rule: Any asymmetry with associated calcifications, architectural distortion, "
            "or palpable abnormality is a mass equivalent — biopsy required."
        ),
        "metadata": {"source": "ACR BI-RADS 5th Edition", "category": "special_finding", "finding_type": "asymmetry"},
    },

    # ── Breast Density A and B ───────────────────────────────────────────────
    {
        "id": "density_ab",
        "text": (
            "Breast Composition Categories A and B (ACR BI-RADS 5th Edition): "
            "\n"
            "CATEGORY A — Almost entirely fatty: "
            "The breasts are almost entirely composed of fat (<25% glandular). "
            "Mammography has high sensitivity in fatty breasts — lesions stand out against fat background. "
            "Lower risk of a significant lesion being obscured. "
            "Most common in post-menopausal women. "
            "Supplemental screening (ultrasound, MRI) not indicated based on density alone. "
            "\n"
            "CATEGORY B — Scattered areas of fibroglandular density: "
            "There are scattered areas of fibroglandular density (25–50% glandular). "
            "Some areas of the breast could obscure lesions but most of the breast is well-visualized. "
            "Mammographic sensitivity is adequate. "
            "Scattered fibroglandular density is the most common breast composition category in the general population. "
            "\n"
            "Both categories A and B: Routine annual mammographic screening is appropriate. "
            "No supplemental screening requirement based on density alone (varies by jurisdiction — "
            "some US states require notification for B as well). "
            "\n"
            "Note: Breast density is one component of breast cancer risk. "
            "Category B women have only slightly elevated risk vs Category A — clinically not significant in isolation."
        ),
        "metadata": {"source": "ACR BI-RADS 5th Edition", "category": "breast_density", "density": "AB"},
    },

    # ── Breast Density C and D ───────────────────────────────────────────────
    {
        "id": "density_cd",
        "text": (
            "Breast Composition Categories C and D (Dense Breasts) — ACR BI-RADS 5th Edition: "
            "\n"
            "CATEGORY C — Heterogeneously dense: "
            "The breasts have heterogeneous density (51–75% glandular) that may obscure small masses. "
            "Dense tissue is distributed unevenly — some areas have dense clumps that make focal lesions hard to find. "
            "Sensitivity of mammography is reduced. "
            "Supplemental ultrasound detects additional cancers in dense breasts (~4–7 per 1,000 screened). "
            "\n"
            "CATEGORY D — Extremely dense: "
            "The breasts are extremely dense (>75% glandular). "
            "This reduces the sensitivity of mammography — tumors can be completely obscured ('hidden'). "
            "Extremely dense breasts carry an independently elevated cancer risk (relative risk ~2x vs fatty). "
            "Whole-breast ultrasound or breast MRI as supplemental screening should be considered. "
            "\n"
            "Indian population context: Indian women have higher rates of dense breast tissue compared to Western populations "
            "(estimated 50–60% category C/D in Indian women vs 40% in Western). "
            "This is clinically important — mammography may miss more cancers in the Indian population "
            "than Western validation studies suggest. Consider ultrasound more readily in Indian patients. "
            "\n"
            "Density must be reported in every mammographic report per ACR and most national guidelines. "
            "The radiologist should comment on how density affects the sensitivity of the examination."
        ),
        "metadata": {"source": "ACR BI-RADS 5th Edition", "category": "breast_density", "density": "CD"},
    },

    # ── Management Pathways ──────────────────────────────────────────────────
    {
        "id": "management_pathways",
        "text": (
            "Mammography Management Pathways by BI-RADS Category: "
            "\n"
            "BI-RADS 1 / 2: Routine annual screening mammography. No additional workup needed. "
            "BI-RADS 3: Short-interval 6-month follow-up diagnostic mammogram (unilateral). "
            "   Then bilateral mammograms at 12 and 24 months. Stable × 2 years = downgrade to BI-RADS 2. "
            "   If finding enlarges or develops new suspicious feature → upgrade and biopsy. "
            "BI-RADS 4A: Tissue sampling (biopsy). Target timeline: within 2 weeks. "
            "   Benign concordant result: 6-month imaging follow-up. "
            "BI-RADS 4B: Tissue sampling required. Radiologic-pathologic concordance review mandatory. "
            "   Discordant benign result (pathology doesn't explain imaging) → repeat biopsy. "
            "BI-RADS 4C: Tissue sampling required. If benign discordant → surgical excision. "
            "   Clip placement at time of biopsy recommended. "
            "BI-RADS 5: Biopsy before any surgery. Clip placement required. "
            "   Staging workup (CT chest/abdomen/pelvis, bone scan) for clinically node-positive disease. "
            "   Oncology referral. Neoadjuvant vs upfront surgery discussion. "
            "BI-RADS 6: Known malignancy. MDT (multidisciplinary team) discussion. "
            "   Surgical oncology + medical oncology + radiation oncology coordination. "
            "   If neoadjuvant treatment planned, marker clip must be present for post-treatment localization. "
            "\n"
            "Biopsy technique selection: "
            "   Masses with ultrasound correlate → US-guided core needle biopsy (preferred, real-time). "
            "   Calcifications only / no US correlate → Stereotactic (mammography-guided) vacuum-assisted biopsy. "
            "   MRI-only finding → MRI-guided biopsy. "
            "   Minimum 12-gauge core needle; 9-gauge vacuum-assisted preferred for calcifications."
        ),
        "metadata": {"source": "ACR BI-RADS 5th Edition", "category": "management", "type": "pathway"},
    },

    # ── Special Findings: Skin, Nipple, Lymph Nodes ──────────────────────────
    {
        "id": "special_findings",
        "text": (
            "Special Mammographic Findings: Skin, Nipple, and Axillary Lymph Nodes: "
            "\n"
            "SKIN THICKENING: Normal skin thickness is 0.5–2mm. Thickening >2mm is abnormal. "
            "Diffuse skin thickening: Consider inflammatory breast carcinoma (IBC), CHF/edema, post-radiation changes, "
            "lymphatic obstruction from axillary node disease. "
            "Focal skin thickening: Suggests underlying mass with skin involvement — upgrade to BI-RADS 5 "
            "if associated with a suspicious mass. "
            "CRITICAL: Inflammatory breast carcinoma presents with diffuse skin thickening and peau d'orange "
            "(skin dimpling) WITHOUT a discrete mass. It is a clinical + imaging diagnosis. "
            "\n"
            "NIPPLE RETRACTION/INVERSION: New nipple retraction is suspicious for subareolar carcinoma "
            "or ductal carcinoma pulling on the nipple-areolar complex. "
            "Longstanding bilateral retraction is usually benign (developmental). "
            "New unilateral retraction requires additional workup. "
            "\n"
            "AXILLARY LYMPH NODES: Normal lymph node: fatty hilum, cortex <3mm. "
            "Abnormal features: cortical thickening >3mm, absent hilum, rounded shape, increased size >2cm. "
            "Abnormal ipsilateral axillary nodes in context of suspicious breast mass = potential N1 disease. "
            "Report as 'lymph_node_status: abnormal' — triggers staging workup. "
            "\n"
            "TRABECULAR THICKENING: Thickening of fibrous septa; associated with edema, lymphoma, IBC. "
            "\n"
            "These findings, when present, must be reported even if no discrete mass is identified, "
            "as they may be the only mammographic sign of malignancy (especially IBC)."
        ),
        "metadata": {"source": "ACR BI-RADS 5th Edition", "category": "special_findings"},
    },

    # ── Prior Study Comparison ────────────────────────────────────────────────
    {
        "id": "prior_comparison",
        "text": (
            "Comparison with Prior Studies — Critical for Accurate BI-RADS Assignment: "
            "\n"
            "ANY change compared to prior imaging is the single most powerful modifier of BI-RADS category. "
            "\n"
            "STABLE × 2 YEARS: A finding stable for ≥2 years may be downgraded from BI-RADS 3 to BI-RADS 2. "
            "Stability does not guarantee benignity (slowly growing malignancy exists) but is reassuring. "
            "\n"
            "NEW FINDING: A finding not present on the most recent prior study requires upgrading: "
            "   - New circumscribed mass: minimum BI-RADS 3 regardless of morphology. "
            "   - New asymmetry: developing asymmetry = minimum BI-RADS 4. "
            "   - New calcifications: any new cluster requires diagnostic workup. "
            "\n"
            "ENLARGING FINDING: Any previously BI-RADS 3 finding that has increased in size "
            "should be upgraded to BI-RADS 4 and biopsied. "
            "Exception: Clearly benign lesion with well-understood growth (e.g. enlarging cyst on ultrasound). "
            "\n"
            "NEW SUSPICIOUS FEATURES: A finding that was BI-RADS 3 but has developed "
            "indistinct margins, calcifications, or architectural distortion → BI-RADS 4 or 5. "
            "\n"
            "When prior imaging is unavailable: "
            "Do not assign BI-RADS 3 to a finding on a screening exam without prior studies. "
            "Recall for diagnostic workup (BI-RADS 0) is appropriate when findings require comparison "
            "with unavailable priors or additional views."
        ),
        "metadata": {"source": "ACR BI-RADS 5th Edition", "category": "comparison_priors"},
    },

    # ── Indian/Asian Epidemiology ─────────────────────────────────────────────
    {
        "id": "indian_epidemiology",
        "text": (
            "Breast Cancer Epidemiology: India and Asian Populations — Clinical Context for Reporting: "
            "\n"
            "AGE AT DIAGNOSIS: Indian women are diagnosed with breast cancer at a younger average age "
            "(median ~45–50 years) vs Western women (median ~61 years). "
            "This means BI-RADS assessment should not be relaxed in younger Indian patients — "
            "the 'under 40' argument for lower suspicion is less applicable. "
            "\n"
            "BREAST DENSITY: Indian women have higher rates of ACR category C and D breast density "
            "(estimated 50–60%) vs Western populations (~40%). "
            "Dense tissue reduces mammographic sensitivity. Supplemental ultrasound should be considered "
            "liberally for Indian women with category C/D density. "
            "\n"
            "HORMONE RECEPTOR STATUS: Indian breast cancers have a higher proportion of triple-negative "
            "breast cancer (TNBC, ~25–30% vs ~15% in Western) — more aggressive biology, no targeted therapy. "
            "TNBC often presents as a circumscribed mass mimicking a benign lesion — do not be falsely reassured. "
            "\n"
            "FUJIFILM SCANNER NOTE: Many Indian hospitals use FUJIFILM FDR-3000AWS digital mammography systems. "
            "These systems embed a patient information panel on the left ~38% of the image width. "
            "This panel must be cropped before AI analysis to avoid false positive findings from the info panel region. "
            "\n"
            "SCREENING GAPS: India lacks a national organized mammography screening program. "
            "Most patients present symptomatically (palpable lump) at stage II–III. "
            "Early-detection platform value is therefore very high — every BI-RADS 4/5 case that is caught "
            "before clinical presentation is a survival-benefit case."
        ),
        "metadata": {"source": "Clinical Literature / ICMR Guidelines", "category": "epidemiology", "region": "india"},
    },

    # ── Malignancy Risk Features ──────────────────────────────────────────────
    {
        "id": "malignancy_risk_features",
        "text": (
            "Imaging Features That Predict Malignancy — Ranked by Predictive Power: "
            "\n"
            "HIGHEST RISK (BI-RADS ≥4C or 5): "
            "1. Spiculated margin on any mass — PPV 60–80% "
            "2. Fine linear branching calcifications in segmental distribution — PPV 60–80% "
            "3. New or enlarging irregular mass — especially with spiculated or indistinct margin "
            "4. Skin thickening + diffuse edema (inflammatory breast carcinoma) "
            "5. New architectural distortion without prior surgery "
            "\n"
            "HIGH RISK (BI-RADS 4B–4C): "
            "6. Irregular mass with indistinct margins "
            "7. Fine pleomorphic calcifications in grouped or linear distribution "
            "8. Developing asymmetry "
            "9. Mass with associated skin thickening (focal) "
            "10. Spiculated mass regardless of size "
            "\n"
            "MODERATE RISK (BI-RADS 4A): "
            "11. Microlobulated mass margin "
            "12. Oval circumscribed solid mass that is new or palpable "
            "13. Grouped amorphous calcifications (unilateral) "
            "14. Solitary dilated duct (papilloma until proven otherwise) "
            "\n"
            "LOW RISK (BI-RADS 3): "
            "15. Oval circumscribed non-calcified mass — stable or first seen on screening "
            "16. Single cluster of punctate calcifications "
            "17. Focal asymmetry — non-palpable, no associated findings, no change "
            "\n"
            "MODIFIERS that increase suspicion regardless of primary descriptor: "
            "New vs prior, palpable, abnormal axillary lymph node, patient age >50, family history, BRCA mutation. "
            "MODIFIERS that decrease suspicion: "
            "Fat-containing, bilateral symmetric, stable × 2+ years, classic benign appearance (calcified fibroadenoma)."
        ),
        "metadata": {"source": "ACR BI-RADS 5th Edition", "category": "risk_features"},
    },

    # ── BI-RADS 1 and 2 — Negative and Benign ────────────────────────────────
    {
        "id": "birads_1_2",
        "text": (
            "BI-RADS Category 1 — Negative: "
            "No abnormality found. Symmetrical breasts, no masses, no architectural distortion, no suspicious calcifications. "
            "Management: Routine annual screening mammography. "
            "If screening, no follow-up imaging needed. "
            "\n"
            "BI-RADS Category 2 — Benign: "
            "A clearly benign finding is present but it does not affect management. "
            "Examples of BI-RADS 2 findings: "
            "- Calcified fibroadenoma (coarse popcorn calcifications) "
            "- Multiple bilateral circumscribed masses (cysts) "
            "- Vascular calcifications "
            "- Fat-containing mass (lipoma, hamartoma, oil cyst) "
            "- Stable non-calcified circumscribed mass on multiple prior exams (stable fibroadenoma) "
            "- Lymph node with normal fatty hilum "
            "- Breast implant without complications "
            "Management: Routine annual screening. No additional workup needed. "
            "\n"
            "BI-RADS 0 — Incomplete Assessment: "
            "Used ONLY on screening mammograms when additional evaluation is needed. "
            "Should NEVER be used as a final assessment on a diagnostic exam. "
            "Reasons for BI-RADS 0: prior images needed for comparison, additional views needed, "
            "ultrasound required to evaluate a possible mass. "
            "All BI-RADS 0 cases must have a final assessment assigned after diagnostic workup."
        ),
        "metadata": {"source": "ACR BI-RADS 5th Edition", "category": "birads_category", "birads": 2},
    },

    # ── Tomosynthesis (DBT) vs 2D Mammography ────────────────────────────────
    {
        "id": "tomosynthesis_vs_2d",
        "text": (
            "Digital Breast Tomosynthesis (DBT) vs 2D Mammography — Clinical Differences: "
            "\n"
            "DBT ADVANTAGES: "
            "- Reduces recall rate by 15–40% by eliminating summation artifacts that mimic masses on 2D. "
            "- Increases invasive cancer detection rate by ~30–50% vs 2D alone. "
            "- Better visualization of architectural distortion (ILC, radial scar). "
            "- Fewer false recalls — especially for masses obscured by overlying tissue on 2D. "
            "\n"
            "DBT SLICES: A standard DBT acquisition produces 40–80 reconstructed 1mm slices. "
            "A suspicious finding visible on only 1–2 slices may be artifactual. "
            "A true finding should be visible across 3+ consecutive slices. "
            "\n"
            "DBT LIMITATIONS: "
            "- Higher radiation dose than 2D (offset by C-view synthetic 2D or combo mode). "
            "- Longer reading time per case. "
            "- Calcifications: thin-slice DBT can miss calcifications that are clearly seen on 2D. "
            "  Always view synthetic 2D for calcification evaluation in addition to DBT slices. "
            "- Architectural distortion PPV may be lower on DBT vs 2D (more radial scars detected). "
            "\n"
            "BIOPSY PLANNING FROM DBT: "
            "Clip placement coordinates are derived from the slice number (z-axis), CC position (x), "
            "and MLO position (y). The depth from the skin can be calculated from the slice number × slice thickness. "
            "\n"
            "Current best practice: DBT + synthetic 2D (C-view) is now preferred over 2D alone "
            "for both screening and diagnostic mammography where equipment is available."
        ),
        "metadata": {"source": "ACR Practice Parameter / Clinical Literature", "category": "technique", "modality": "tomosynthesis"},
    },

    # ── DCIS — Ductal Carcinoma In Situ ──────────────────────────────────────
    {
        "id": "dcis",
        "text": (
            "Ductal Carcinoma In Situ (DCIS) — Mammographic Features and Management: "
            "\n"
            "DEFINITION: Malignant epithelial cells confined within the ductal system. No invasion. "
            "Stage 0 — no metastatic potential until invasion occurs. "
            "\n"
            "MAMMOGRAPHIC PRESENTATION (in order of frequency): "
            "1. Calcifications alone (80–90% of DCIS cases on mammography) "
            "   - Most common: fine pleomorphic in grouped/linear/segmental distribution "
            "   - High-grade DCIS: fine linear branching (casting) in segmental distribution "
            "   - Intermediate grade: amorphous or coarse heterogeneous "
            "   - Low grade: may be round or punctate — hardest to detect "
            "2. Soft tissue density alone (10–15%): mass, focal asymmetry, architectural distortion "
            "3. Both calcifications and a mass (5–10%): combined pattern "
            "\n"
            "EXTENT ASSESSMENT: The extent of DCIS determines surgical management (lumpectomy vs mastectomy). "
            "Measure the maximum linear extent of suspicious calcifications on the mammogram. "
            "Extent >4–5cm typically requires mastectomy. "
            "MRI is recommended for pre-operative extent assessment when calcifications span a large area. "
            "\n"
            "PATHOLOGIC GRADES: "
            "- High grade DCIS: fine linear/branching calcifications, necrosis, comedo pattern. "
            "  More aggressive, higher recurrence rate. Radiotherapy after BCS is usually required. "
            "- Low/intermediate grade DCIS: variable calcification morphology, better prognosis. "
            "\n"
            "MANAGEMENT: Stereotactic vacuum-assisted biopsy (9-gauge preferred). "
            "Post-biopsy clip placement essential for surgical localization. "
            "Wire localization or radioactive seed localization (RSL) before lumpectomy."
        ),
        "metadata": {"source": "ACR / NCCN Guidelines", "category": "pathology", "entity": "DCIS"},
    },

    # ── Invasive Breast Cancer Types ─────────────────────────────────────────
    {
        "id": "invasive_cancer_types",
        "text": (
            "Common Invasive Breast Cancer Entities — Imaging Characteristics: "
            "\n"
            "INVASIVE DUCTAL CARCINOMA (IDC) — Most common (70–80%): "
            "Classic mammographic appearance: irregular spiculated high-density mass. "
            "May have associated calcifications (DCIS component). "
            "Presents as a hard, palpable mass in ~60% of symptomatic cases. "
            "US: hypoechoic mass, irregular shape, posterior acoustic shadowing, angular margins. "
            "\n"
            "INVASIVE LOBULAR CARCINOMA (ILC) — 10–15%: "
            "The most commonly MISSED cancer on mammography (~20–30% false negative rate on 2D). "
            "Why: ILC infiltrates in single-file strands without forming a cohesive mass. "
            "Mammographic presentation: architectural distortion (most common), focal asymmetry, "
            "subtle density increase, or normal mammogram. "
            "ALWAYS consider ILC when evaluating architectural distortion. "
            "MRI is superior for ILC extent assessment. "
            "\n"
            "TRIPLE NEGATIVE BREAST CANCER (TNBC) — 15–25%: "
            "ER−, PR−, HER2−. More common in younger women and Indian/African women. "
            "Paradoxically often presents as CIRCUMSCRIBED mass (looks benign on mammography!). "
            "TNBC may be assigned BI-RADS 3 on imaging — clinical correlation is critical. "
            "High grade, aggressive, responds well to neoadjuvant chemotherapy. "
            "\n"
            "MUCINOUS / MEDULLARY / PAPILLARY: Circumscribed or oval masses — may mimic fibroadenoma. "
            "These 'special type' cancers have better prognosis but require biopsy to diagnose. "
            "Never dismiss a circumscribed oval mass as definitely benign in a symptomatic patient."
        ),
        "metadata": {"source": "Clinical Literature", "category": "pathology", "entity": "invasive_cancer"},
    },

    # ── ACR Reporting Standards ───────────────────────────────────────────────
    {
        "id": "reporting_standards",
        "text": (
            "ACR Mammography Report Structure — Required Elements: "
            "\n"
            "1. INDICATION: Screening vs diagnostic; reason for diagnostic exam (palpable lump, nipple discharge, etc.). "
            "\n"
            "2. TECHNIQUE: Views obtained (CC, MLO, spot compression, magnification). "
            "   Modality: 2D vs tomosynthesis. Comparison with prior studies (date and facility). "
            "\n"
            "3. BREAST COMPOSITION: One of four ACR categories (A, B, C, D). "
            "   Mandatory statement on how density affects sensitivity: "
            "   'The sensitivity of mammography is [not/somewhat/substantially] limited by breast density.' "
            "\n"
            "4. FINDINGS: Each finding described using BI-RADS lexicon. "
            "   For each finding: type (mass/calcification/asymmetry/distortion), "
            "   location (breast, quadrant, clock position, depth from nipple), "
            "   size, descriptors (shape, margin, density for masses; morphology, distribution for calcs). "
            "\n"
            "5. IMPRESSION: Summary sentence. Overall BI-RADS assessment category (single highest). "
            "   Recommended management. "
            "\n"
            "6. COMPARISON STATEMENT: If priors available — 'No significant change' or specific description of change. "
            "\n"
            "COMMUNICATION STANDARDS: "
            "BI-RADS 4 and 5 findings require direct communication to referring clinician (phone/EMR message) "
            "in addition to written report. "
            "Radiologist should not leave for the day without communicating actionable findings. "
            "\n"
            "DOCUMENTATION: Each finding must have a recommended action that makes clinical sense for the BI-RADS category. "
            "Reports should not contain 'clinical correlation required' as the sole management recommendation — "
            "this is not actionable. Specify the next step precisely."
        ),
        "metadata": {"source": "ACR Mammography Accreditation / MQSA", "category": "reporting"},
    },
]
