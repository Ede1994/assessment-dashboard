import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient, QuestionType, Role } from "../src/generated/prisma/client";
import path from "path";
import { tutorQuestionsEn } from "./tutorQuestionsEn";
import { ctQuestionsEn } from "./ctQuestionsEn";
import { hashPassword } from "../src/lib/password";
import { isMriHeavy } from "../src/lib/assignmentPresets";

const dbUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const relative = dbUrl.replace(/^file:/, "");
const url = path.isAbsolute(relative)
  ? relative
  : path.join(process.cwd(), relative.replace(/^\.\//, ""));

const adapter = new PrismaBetterSqlite3({ url });
const prisma = new PrismaClient({ adapter });

type SeedChoice = { label: string; isCorrect: boolean };
type SeedQuestion = {
  title: string;
  prompt: string;
  roundLabel: string;
  tags: string;
  type: QuestionType;
  codeSnippet?: string;
  choices?: SeedChoice[];
  idealAnswer: string;
  explanation: string;
  codeSolution?: string;
};

type SeedCategory = {
  slug: string;
  name: string;
  icon: string;
  color: string;
  questions: SeedQuestion[];
};

const categories: SeedCategory[] = [
  {
    slug: "pytorch",
    name: "PyTorch Core",
    icon: "fa-fire",
    color: "orange",
    questions: [
      {
        title: "3D Training Loop CUDA Out-Of-Memory Leak",
        prompt:
          "A junior engineer reports that training a 3D segmentation model crashes with `CUDA out of memory` after a few epochs even with batch size 1. Where is the bug in the snippet?",
        roundLabel: "Round 1",
        tags: "PyTorch Memory",
        type: QuestionType.FREE_TEXT,
        codeSnippet: `def train_one_epoch(model, loader, opt, crit, dev):
    total_loss = 0.0
    for img, mask in loader:
        img, mask = img.to(dev), mask.to(dev)
        out = model(img)
        loss = crit(out, mask)
        loss.backward()
        opt.step()
        opt.zero_grad()
        # MEMORY LEAK: keeps the full computation graph in VRAM!
        total_loss += loss
    return total_loss / len(loader)`,
        idealAnswer:
          "Never accumulate raw loss tensors across iterations — that retains the full autograd graph in VRAM. Always use `loss.item()`. Also enable `torch.cuda.amp.autocast()` for mixed precision and `opt.zero_grad(set_to_none=True)` for memory efficiency with 3D volumes.",
        explanation:
          "The expression `total_loss += loss` adds the PyTorch tensor including its reference to the entire autograd computation graph. PyTorch cannot free memory for earlier batches. Calling `loss.item()` extracts a plain Python float and releases the graph.",
        codeSolution: `def train_one_epoch(model, loader, opt, crit, dev):
    total_loss = 0.0
    for img, mask in loader:
        img, mask = img.to(dev, non_blocking=True), mask.to(dev, non_blocking=True)
        opt.zero_grad(set_to_none=True)
        with torch.cuda.amp.autocast():
            out = model(img)
            loss = crit(out, mask)
        loss.backward()
        opt.step()
        total_loss += loss.item()
    return total_loss / len(loader)`,
      },
      {
        title: "DataLoader I/O Bottleneck & Memory Mapping",
        prompt:
          "GPU utilization is only 10–20%. The DataLoader parses compressed `.nii.gz` files via SimpleITK on every `__getitem__` call. How do you fix this bottleneck?",
        roundLabel: "Round 6",
        tags: "Data Engineering & I/O",
        type: QuestionType.MULTIPLE_CHOICE,
        choices: [
          {
            label: "Increase batch size until GPU memory is full",
            isCorrect: false,
          },
          {
            label:
              "Offline preprocess to uncompressed .npy/Zarr, use mmap, num_workers>0, pin_memory=True",
            isCorrect: true,
          },
          {
            label: "Switch from SimpleITK to PIL for loading NIfTI",
            isCorrect: false,
          },
          {
            label: "Disable CUDA and train on CPU to avoid I/O waits",
            isCorrect: false,
          },
        ],
        idealAnswer:
          "In production pipelines, separate preprocessing and I/O from model training: convert scans offline to uncompressed binary formats (.npy or Zarr). In the Dataset use `np.load(..., mmap_mode='r')` with `pin_memory=True` and multiple workers so the GPU stays near full utilization.",
        explanation:
          "Parsing gzip-compressed NIfTI on every batch is CPU-bound. Offline resampling/normalization plus memory-mapped arrays removes decompression from the hot path.",
      },
      {
        title: "Boundary Bug in 3D Patch Cropping",
        prompt:
          "A DataLoader randomly crops 3D patches of size 96³. Near volume borders the crop can go out of bounds and crash collation. What is the robust fix?",
        roundLabel: "Round 9",
        tags: "DataLoader & Cropping",
        type: QuestionType.FREE_TEXT,
        idealAnswer:
          "Clamp crop start indices so `start + patch_size <= volume_size` on each axis, or pad volumes to at least the patch size before cropping. Avoid relying on random indices without bounds checks.",
        explanation:
          "Random crop origins near edges produce variable-sized or invalid tensors. Clamp the maximum start index to `dim_size - patch_size` (or pad first) so every sample has a fixed shape for batching.",
      },
      {
        title: "Numerically Stable Softmax / Cross-Entropy",
        prompt:
          "Your custom 3D segmentation loss implements softmax manually and occasionally produces NaNs. Which practice prevents overflow?",
        roundLabel: "Round 13",
        tags: "Numerical Stability",
        type: QuestionType.MULTIPLE_CHOICE,
        choices: [
          {
            label: "Subtract max logit before exp: softmax(x) = exp(x - max(x)) / sum(...)",
            isCorrect: true,
          },
          {
            label: "Always cast logits to float16 before softmax",
            isCorrect: false,
          },
          {
            label: "Add a large constant (e.g. 1e6) to all logits",
            isCorrect: false,
          },
          {
            label: "Use ReLU on logits before softmax",
            isCorrect: false,
          },
        ],
        idealAnswer:
          "Prefer `F.cross_entropy` / `F.log_softmax` which apply the log-sum-exp trick. If implementing manually, subtract the max logit before exponentiation to avoid overflow.",
        explanation:
          "Exponentiating large positive logits overflows float32. The log-sum-exp / max-subtraction trick keeps values in a stable range.",
      },
      {
        title: "AMP GradScaler Role",
        prompt:
          "You enable automatic mixed precision with autocast but omit GradScaler. What can go wrong with FP16 gradients?",
        roundLabel: "Round 16",
        tags: "AMP & Training",
        type: QuestionType.FREE_TEXT,
        idealAnswer:
          "FP16 gradients can underflow to zero for small losses. GradScaler scales the loss up before backward and unscales before the optimizer step so tiny gradients remain representable.",
        explanation:
          "Without loss scaling, many parameter updates become zero in FP16, stalling learning especially early in training.",
      },
    ],
  },
  {
    slug: "dicom",
    name: "DICOM & Spatial Geometry",
    icon: "fa-x-ray",
    color: "cyan",
    questions: [
      {
        title: "Resampling Anisotropic Scans & Interpolation",
        prompt:
          "Multi-center dataset: Center A delivers $1\\times1\\times1\\text{ mm}^3$ (isotropic). Center B delivers $0.6\\times0.6\\times5.0\\text{ mm}^3$ (anisotropic). Which interpolation do you use for intensity images vs binary masks when resampling to $1\\times1\\times1\\text{ mm}^3$?",
        roundLabel: "Round 2",
        tags: "DICOM & Preprocessing",
        type: QuestionType.MULTIPLE_CHOICE,
        choices: [
          {
            label: "Images: nearest-neighbor; masks: trilinear",
            isCorrect: false,
          },
          {
            label: "Images: trilinear/B-spline; masks: nearest-neighbor",
            isCorrect: true,
          },
          {
            label: "Both: trilinear interpolation",
            isCorrect: false,
          },
          {
            label: "Both: nearest-neighbor only",
            isCorrect: false,
          },
        ],
        idealAnswer:
          "For CT/MR intensities use trilinear or B-spline interpolation. For segmentation masks, nearest-neighbor is mandatory — trilinear creates fractional labels that corrupt volumes after thresholding.",
        explanation:
          "Trilinear mask interpolation yields values like 0.45; thresholding at 0.5 artificially changes lesion volume, which breaks clinical metrics (e.g. RECIST) under EU MDR scrutiny.",
      },
      {
        title: "Multi-Sequence MRI Intensity Normalization",
        prompt:
          "Unlike CT Hounsfield units, MRI intensities have no absolute physical scale. Why does a global z-score $\\frac{x-\\mu}{\\sigma}$ over the entire scan (including air background) cause problems, and how do you fix it?",
        roundLabel: "Round 7",
        tags: "MRT Preprocessing",
        type: QuestionType.FREE_TEXT,
        idealAnswer:
          "Air background (~70% of voxels near 0) pulls μ down and inflates σ, washing out tissue contrast. Compute μ_fg / σ_fg on a foreground mask (Otsu or skull-strip), optionally clip percentiles and apply Nyúl histogram standardization across scanners.",
        explanation:
          "Foreground-only z-score or Nyúl matching aligns tissue intensities across scanners without being dominated by background air.",
      },
      {
        title: "LPS vs RAS Patient Coordinate Systems",
        prompt:
          "A pipeline mixes SimpleITK (typically LPS) and NiBabel/torchio (often RAS). Segmentations appear mirrored. What went wrong and how do you prevent it?",
        roundLabel: "Round 11",
        tags: "Coordinate Systems",
        type: QuestionType.FREE_TEXT,
        idealAnswer:
          "LPS and RAS flip the first two patient axes. Always reorient to a single canonical space (e.g. RAS or LPS) using direction/affine metadata before stacking modalities or applying masks, and verify with known anatomical landmarks.",
        explanation:
          "Ignoring ImageOrientationPatient / affine direction cosines causes left-right or anterior-posterior flips that look like correct shapes but wrong laterality.",
      },
      {
        title: "DICOM ImageOrientationPatient",
        prompt:
          "Which DICOM attribute primarily encodes how voxel axes map to patient anatomy?",
        roundLabel: "Round 15",
        tags: "DICOM Tags",
        type: QuestionType.MULTIPLE_CHOICE,
        choices: [
          { label: "RescaleSlope / RescaleIntercept", isCorrect: false },
          { label: "ImageOrientationPatient (0020,0037)", isCorrect: true },
          { label: "WindowCenter / WindowWidth", isCorrect: false },
          { label: "SeriesDescription", isCorrect: false },
        ],
        idealAnswer:
          "ImageOrientationPatient (0020,0037) stores direction cosines of the image rows/columns in the patient coordinate system. PixelSpacing and ImagePositionPatient complete the affine.",
        explanation:
          "Rescale tags convert stored values to HU; window tags are for display only; SeriesDescription is free text.",
      },
    ],
  },
  {
    slug: "ct-mri",
    name: "CT & MRI Clinical Imaging",
    icon: "fa-hospital",
    color: "sky",
    questions: [
      {
        title: "Hounsfield Windowing: Soft Tissue vs Bone",
        prompt:
          "You visualize a chest CT. Soft-tissue structures are washed out when you use a bone window. Which window center/width pair is appropriate for soft tissue?",
        roundLabel: "CT-1",
        tags: "CT Windowing",
        type: QuestionType.MULTIPLE_CHOICE,
        choices: [
          { label: "Center 400 HU, width 1800 HU (bone)", isCorrect: false },
          { label: "Center 40 HU, width 400 HU (soft tissue)", isCorrect: true },
          { label: "Center −600 HU, width 1500 HU (lung) for mediastinum", isCorrect: false },
          { label: "Center 0 HU, width 1 HU", isCorrect: false },
        ],
        idealAnswer:
          "Soft-tissue windowing is typically around center 40 HU and width ~350–400 HU. Bone windows use a much wider width (~1500–2000) centered near 300–500 HU, which flattens soft-tissue contrast.",
        explanation:
          "Windowing maps a HU range to display greyscale. Wrong windows hide pathology even when raw data is fine.",
      },
      {
        title: "CT vs MRI Intensity Semantics",
        prompt:
          "Explain why a trained CT Hounsfield-normalized model cannot be naively applied to T1-weighted MRI volumes of the same anatomy.",
        roundLabel: "CT-2",
        tags: "Modality Semantics",
        type: QuestionType.FREE_TEXT,
        idealAnswer:
          "CT intensities are calibrated HU with physical meaning (water=0, air=−1000). MRI intensities are relative, sequence- and scanner-dependent, with different contrast mechanisms (T1/T2/FLAIR). Distributions, noise, and artifacts differ; you need modality-specific normalization and usually separate models or domain adaptation.",
        explanation:
          "Input statistics and tissue contrast are not transferable across modalities without careful harmonization.",
      },
      {
        title: "Slice Thickness & Partial Volume Effect",
        prompt:
          "Thick CT slices (e.g. 5 mm) make small pulmonary nodules harder to segment accurately. What physical effect is primarily responsible?",
        roundLabel: "CT-3",
        tags: "Partial Volume",
        type: QuestionType.MULTIPLE_CHOICE,
        choices: [
          { label: "Beam hardening only", isCorrect: false },
          { label: "Partial volume averaging along the z-axis", isCorrect: true },
          { label: "Gibbs ringing", isCorrect: false },
          { label: "Chemical shift artifact", isCorrect: false },
        ],
        idealAnswer:
          "Partial volume effect: a voxel mixes nodule and surrounding lung, biasing intensity and apparent size. Thinner reconstructions or isotropic resampling (with care) reduce but do not eliminate PVE.",
        explanation:
          "Large z-spacing averages tissue over several millimeters, blurring small lesions and mask boundaries.",
      },
      {
        title: "Multi-Sequence MRI Registration",
        prompt:
          "You fuse T1, T2, and FLAIR for brain tumor segmentation. Scans were acquired in different sessions with slight head motion. What preprocessing step is essential before channel stacking?",
        roundLabel: "MRI-1",
        tags: "MRI Registration",
        type: QuestionType.FREE_TEXT,
        idealAnswer:
          "Rigid (or affine) co-registration of all sequences to a common reference (often T1 or a template), plus consistent orientation/spacing and brain extraction if used. Only then stack as multi-channel input so voxels correspond anatomically.",
        explanation:
          "Without registration, channels are misaligned and the network sees inconsistent anatomy per channel.",
      },
      {
        title: "MRI Bias Field Correction",
        prompt:
          "A brain MRI shows slowly varying brightness across the FOV due to B1 inhomogeneity. Which preprocessing is commonly applied before intensity normalization?",
        roundLabel: "MRI-2",
        tags: "N4 Bias Correction",
        type: QuestionType.MULTIPLE_CHOICE,
        choices: [
          { label: "Histogram equalization only", isCorrect: false },
          { label: "N4 / N3 bias field correction", isCorrect: true },
          { label: "Sobel edge enhancement", isCorrect: false },
          { label: "JPEG compression", isCorrect: false },
        ],
        idealAnswer:
          "N4ITK (or N3) bias field correction estimates and removes the low-frequency multiplicative intensity field before z-score or Nyúl normalization.",
        explanation:
          "Uncorrected bias fields confound intensity-based features and segmentation models across the FOV.",
      },
    ],
  },
  {
    slug: "governance",
    name: "Data Governance & MDR",
    icon: "fa-shield-halved",
    color: "emerald",
    questions: [
      {
        title: "Data Leakage: Slice-Level vs Patient-Level Splits",
        prompt:
          "20,000 2D slices from 100 CTs are split with a random `train_test_split`. Validation Dice is 0.96, but external performance drops to 0.58. Why?",
        roundLabel: "Round 3",
        tags: "Governance & Validation",
        type: QuestionType.MULTIPLE_CHOICE,
        choices: [
          {
            label: "The learning rate was too high",
            isCorrect: false,
          },
          {
            label:
              "Slice-level split leaked same-patient slices into train and val (need patient-level GroupKFold)",
            isCorrect: true,
          },
          {
            label: "Dice is not a valid metric for CT",
            isCorrect: false,
          },
          {
            label: "Batch size of 1 always causes overfitting",
            isCorrect: false,
          },
        ],
        idealAnswer:
          "Random slice splits cause massive leakage: adjacent slices of the same patient appear in train and val. Use StratifiedGroupKFold by patient_id; a patient must exist only in train or validation. Stratify by scanner/pathology when possible.",
        explanation:
          "The model memorizes patient-specific texture rather than learning generalizable features — classic phantom effect.",
      },
      {
        title: "Handling Divergent Radiologist Annotations",
        prompt:
          "Radiologist A annotates only the tumor core (conservative). Radiologist B includes edema (generous). How do you build ground truth?",
        roundLabel: "Round 5",
        tags: "Multi-Rater Variability",
        type: QuestionType.FREE_TEXT,
        idealAnswer:
          "Use probabilistic fusion such as STAPLE or soft labels instead of naive binary majority. Evaluate model performance against inter-rater Dice so you know if the model sits within human expert variability.",
        explanation:
          "Hard consensus masks discard uncertainty. Soft labels / STAPLE encode rater reliability and disagreement.",
      },
      {
        title: "EU MDR Traceability of Preprocessing",
        prompt:
          "In a regulated medical device ML pipeline, why must resampling and normalization parameters be versioned and locked for validation?",
        roundLabel: "Round 10",
        tags: "EU MDR",
        type: QuestionType.FREE_TEXT,
        idealAnswer:
          "Clinical performance claims depend on a fixed preprocessing configuration. Changing interpolation, spacing, or normalization after validation breaks traceability and can invalidate claimed sensitivity/specificity under MDR.",
        explanation:
          "Preprocessing is part of the intended algorithm. Uncontrolled changes are design changes requiring re-validation.",
      },
    ],
  },
  {
    slug: "architecture",
    name: "Architectures & U-Net",
    icon: "fa-network-wired",
    color: "purple",
    questions: [
      {
        title: "3D U-Net Shape Mismatch in Skip Connections",
        prompt:
          "You get `RuntimeError: Sizes of tensor buffers must match [...] got [1, 64, 16, 32, 32] and [1, 64, 15, 30, 30]` on `torch.cat` in the decoder. What causes this and how do you fix it?",
        roundLabel: "Round 4",
        tags: "3D U-Net Mechanics",
        type: QuestionType.FREE_TEXT,
        codeSnippet: `def forward(self, x, skip_features):
    x = self.up(x)  # ConvTranspose3d stride=2
    # odd dims after pooling cause mismatch
    return self.conv(torch.cat([x, skip_features], dim=1))`,
        idealAnswer:
          "Odd spatial sizes after max-pooling round down; upsampling by 2 cannot recover the skip size. Fix with dynamic padding (F.pad), crop skips, or ensure input dims are multiples of 2^N. Alternatives: Upsample to the skip size with trilinear interpolation.",
        explanation:
          "Example: size 31 → pool → 15 → upsample ×2 → 30 ≠ 31. Padding or constrained input sizes resolve the concat.",
        codeSolution: `def forward(self, x, skip_features):
    x = self.up(x)
    diff_d = skip_features.size(2) - x.size(2)
    diff_h = skip_features.size(3) - x.size(3)
    diff_w = skip_features.size(4) - x.size(4)
    x = F.pad(x, [diff_w // 2, diff_w - diff_w // 2,
                  diff_h // 2, diff_h - diff_h // 2,
                  diff_d // 2, diff_d - diff_d // 2])
    return self.conv(torch.cat([x, skip_features], dim=1))`,
      },
      {
        title: "Anisotropic 3D Scans & Adaptive Encoder Pooling",
        prompt:
          "Why does naive isotropic $3\\times3\\times3$ convolution and $2\\times2\\times2$ max-pooling hurt on strongly anisotropic scans (e.g. $0.5\\times0.5\\times5.0\\text{ mm}^3$), and how do you adapt the architecture?",
        roundLabel: "Round 8",
        tags: "3D U-Net System Design",
        type: QuestionType.MULTIPLE_CHOICE,
        choices: [
          {
            label: "Always pool 2×2×2 from the first encoder stage",
            isCorrect: false,
          },
          {
            label:
              "Use anisotropic strides (e.g. 1×2×2) until the physical receptive field is roughly isotropic (nnU-Net style)",
            isCorrect: true,
          },
          {
            label: "Replace all 3D convs with 1D temporal convolutions",
            isCorrect: false,
          },
          {
            label: "Disable skip connections for anisotropic data",
            isCorrect: false,
          },
        ],
        idealAnswer:
          "Early 2×2×2 pooling collapses the already-coarse z-axis too fast (one voxel may span 10–20 mm). Use anisotropic strides (1×2×2) and pseudo-2D kernels early, then pool in z once the receptive field is quasi-isotropic.",
        explanation:
          "This is standard nnU-Net practice for anisotropic medical volumes.",
      },
      {
        title: "Dice + Cross-Entropy Combined Loss",
        prompt:
          "Why do many medical segmentation pipelines combine Dice loss with cross-entropy instead of using Dice alone?",
        roundLabel: "Round 14",
        tags: "Loss Functions",
        type: QuestionType.FREE_TEXT,
        idealAnswer:
          "Dice focuses on overlap and handles class imbalance but can have unstable gradients especially early on. Cross-entropy provides denser per-voxel gradients. Combined, they stabilize training and improve boundary quality on rare foreground classes.",
        explanation:
          "The losses are complementary: CE for classification signal, Dice for region overlap under imbalance.",
      },
      {
        title: "Patch-Based Inference & Overlapping Tiles",
        prompt:
          "At inference you tile a large CT with overlapping 3D patches. How should overlapping predictions be merged?",
        roundLabel: "Round 12",
        tags: "Inference Design",
        type: QuestionType.MULTIPLE_CHOICE,
        choices: [
          { label: "Keep only the center patch; discard overlaps", isCorrect: false },
          {
            label: "Average probabilities (optionally Gaussian-weighted) in overlapping regions",
            isCorrect: true,
          },
          { label: "Take the maximum logit only at borders", isCorrect: false },
          { label: "Concatenate patches along the batch dimension for display", isCorrect: false },
        ],
        idealAnswer:
          "Accumulate predicted probabilities with a weight map (often Gaussian peaking at patch centers) and normalize by the weight sum to reduce seam artifacts.",
        explanation:
          "Hard stitching creates boundary artifacts; weighted averaging smooths predictions across tiles.",
      },
    ],
  },
  {
    slug: "python",
    name: "Python & Programming",
    icon: "fa-code",
    color: "amber",
    questions: [
      {
        title: "Patient-Level GroupKFold in scikit-learn",
        prompt:
          "You have arrays `X` (slices), `y` (labels), and `groups` (patient_id per slice). Which splitter keeps all slices of a patient in the same fold?",
        roundLabel: "PY-1",
        tags: "scikit-learn",
        type: QuestionType.MULTIPLE_CHOICE,
        choices: [
          { label: "KFold", isCorrect: false },
          { label: "StratifiedKFold", isCorrect: false },
          { label: "GroupKFold / StratifiedGroupKFold", isCorrect: true },
          { label: "ShuffleSplit", isCorrect: false },
        ],
        idealAnswer:
          "Use `GroupKFold` or `StratifiedGroupKFold` with `groups=patient_id` so no patient appears in both train and test folds.",
        explanation:
          "Standard KFold ignores groups and will leak patients across folds.",
      },
      {
        title: "Mutable Default Argument Bug",
        prompt:
          "What is wrong with `def add_scan(scan, cache=[])` in a long-running preprocessing service?",
        roundLabel: "PY-2",
        tags: "Python Pitfalls",
        type: QuestionType.FREE_TEXT,
        codeSnippet: `def add_scan(scan, cache=[]):
    cache.append(scan)
    return cache`,
        idealAnswer:
          "The default list is created once at function definition and shared across calls, causing unbounded growth and cross-request leakage. Use `cache=None` and `cache = []` inside the function, or inject an explicit cache object.",
        explanation:
          "Mutable default arguments are a classic Python footgun in servers and notebooks alike.",
      },
    ],
  },
  {
    slug: "medical-data",
    name: "Medical Data Processing",
    icon: "fa-database",
    color: "teal",
    questions: [
      {
        title: "Offline Preprocessing Manifest",
        prompt:
          "Design a minimal reproducible preprocessing record for a CT cohort used in training. Which fields must be stored?",
        roundLabel: "MD-1",
        tags: "Pipeline Reproducibility",
        type: QuestionType.FREE_TEXT,
        idealAnswer:
          "Store for each case: source path/UID, target spacing/orientation, interpolation methods (image vs mask), intensity window or normalization stats, software versions (SimpleITK, etc.), and output checksums. This enables audit and exact regeneration.",
        explanation:
          "Without a manifest, regenerating training tensors after a library upgrade is unreliable.",
      },
      {
        title: "Caching NIfTI as Memory-Mapped Arrays",
        prompt:
          "Why is `np.load(path, mmap_mode='r')` preferred over loading full volumes into RAM inside `__getitem__` for large 3D cohorts?",
        roundLabel: "MD-2",
        tags: "I/O Patterns",
        type: QuestionType.MULTIPLE_CHOICE,
        choices: [
          {
            label: "mmap always decompresses gzip faster than SimpleITK",
            isCorrect: false,
          },
          {
            label:
              "It maps file pages on demand so workers share OS cache without duplicating full arrays in RAM",
            isCorrect: true,
          },
          {
            label: "mmap converts HU to float16 automatically",
            isCorrect: false,
          },
          {
            label: "mmap removes the need for any preprocessing",
            isCorrect: false,
          },
        ],
        idealAnswer:
          "Memory mapping lets the OS page in only needed regions and share caches across DataLoader workers, reducing RAM spikes versus `np.load` of entire arrays per worker.",
        explanation:
          "This assumes data was already converted to uncompressed .npy (mmap does not replace decompression of .nii.gz).",
      },
    ],
  },
  {
    slug: "ai-dl",
    name: "AI & Deep Learning",
    icon: "fa-brain",
    color: "rose",
    questions: [
      {
        title: "Class Imbalance in Lesion Segmentation",
        prompt:
          "Foreground lesion voxels are <1% of a CT volume. Which training strategies help?",
        roundLabel: "AI-1",
        tags: "Imbalance",
        type: QuestionType.FREE_TEXT,
        idealAnswer:
          "Use Dice/Focal/Tversky losses, oversample patches containing foreground, class-balanced sampling, and appropriate metrics (Dice, sensitivity) rather than accuracy. Consider deep supervision and larger effective receptive fields for small lesions.",
        explanation:
          "Pixel accuracy is dominated by background; region-based losses and sampling fix the learning signal.",
      },
      {
        title: "Train/Val Leakage via Augmentation",
        prompt:
          "True or false style: Applying random elastic deformations once offline and then splitting patients randomly can still leak information if the same original patient appears in both splits via different augmented copies. What is the correct workflow?",
        roundLabel: "AI-2",
        tags: "Augmentation Hygiene",
        type: QuestionType.MULTIPLE_CHOICE,
        choices: [
          {
            label: "Augment fully offline, then randomly split all files",
            isCorrect: false,
          },
          {
            label:
              "Split by patient first, then apply augmentation only within the training set",
            isCorrect: true,
          },
          {
            label: "Augment validation more heavily than training",
            isCorrect: false,
          },
          {
            label: "Share augmented copies across train and val for consistency",
            isCorrect: false,
          },
        ],
        idealAnswer:
          "Always partition by patient (or study) first. Apply stochastic augmentation only on the training loader so validation remains a clean estimate of generalization.",
        explanation:
          "Augmented clones of the same patient in both sets inflate validation metrics.",
      },
    ],
  },
  {
    slug: "dl-basics",
    name: "DL Fundamentals",
    icon: "fa-atom",
    color: "violet",
    questions: [],
  },
];

async function main() {
  console.log("Seeding database...");

  await prisma.questionAssignment.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.choice.deleteMany();
  await prisma.solution.deleteMany();
  await prisma.question.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  // Merge tutor + CT quiz questions into category buckets (skip unknown slugs).
  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  for (const tq of [...tutorQuestionsEn, ...ctQuestionsEn]) {
    const cat = bySlug.get(tq.categorySlug);
    if (!cat) {
      console.warn(`Unknown category for imported question: ${tq.categorySlug}`);
      continue;
    }
    cat.questions.push({
      title: tq.title,
      prompt: tq.prompt,
      roundLabel: tq.roundLabel,
      tags: tq.tags,
      type: tq.type,
      choices: tq.choices,
      idealAnswer: tq.idealAnswer,
      explanation: tq.explanation,
    });
  }

  const student = await prisma.user.create({
    data: {
      username: "student",
      passwordHash: await hashPassword("student"),
      role: Role.STUDENT,
      displayName: "Demo Student (full track)",
    },
  });
  const student2 = await prisma.user.create({
    data: {
      username: "student2",
      passwordHash: await hashPassword("student2"),
      role: Role.STUDENT,
      displayName: "Demo Student 2 (CT-focused)",
    },
  });
  await prisma.user.create({
    data: {
      username: "trainer",
      passwordHash: await hashPassword("NRAD2026"),
      role: Role.TRAINER,
      displayName: "Demo Trainer",
    },
  });

  const allQuestionIds: string[] = [];
  const ctFocusedIds: string[] = [];

  let sortOrder = 0;
  for (let cIdx = 0; cIdx < categories.length; cIdx++) {
    const cat = categories[cIdx];
    const createdCat = await prisma.category.create({
      data: {
        slug: cat.slug,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        sortOrder: cIdx,
      },
    });

    for (let qIdx = 0; qIdx < cat.questions.length; qIdx++) {
      const q = cat.questions[qIdx];
      sortOrder += 1;
      const createdQ = await prisma.question.create({
        data: {
          categoryId: createdCat.id,
          title: q.title,
          prompt: q.prompt,
          roundLabel: q.roundLabel,
          tags: q.tags,
          type: q.type,
          codeSnippet: q.codeSnippet ?? null,
          sortOrder,
          solution: {
            create: {
              idealAnswer: q.idealAnswer,
              explanation: q.explanation,
              codeSolution: q.codeSolution ?? null,
            },
          },
          choices: q.choices
            ? {
                create: q.choices.map((ch, i) => ({
                  label: ch.label,
                  isCorrect: ch.isCorrect,
                  sortOrder: i,
                })),
              }
            : undefined,
        },
      });
      allQuestionIds.push(createdQ.id);
      if (!isMriHeavy(q.title, q.tags, q.prompt)) {
        ctFocusedIds.push(createdQ.id);
      }
      console.log(`  + ${createdQ.title}`);
    }
  }

  await prisma.questionAssignment.createMany({
    data: allQuestionIds.map((questionId) => ({
      userId: student.id,
      questionId,
    })),
  });
  await prisma.questionAssignment.createMany({
    data: ctFocusedIds.map((questionId) => ({
      userId: student2.id,
      questionId,
    })),
  });

  const qCount = await prisma.question.count();
  const aCount = await prisma.questionAssignment.count();
  console.log(
    `Done. ${qCount} questions, ${aCount} assignments (student=all, student2=CT-focused without MRI-heavy).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
