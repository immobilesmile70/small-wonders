/**
 * SMALL WONDERS - SUPERDESIGN / PERSONAL-YET-PROFESSIONAL AESTHETIC SYSTEM
 *
 * Integrated from the user's reference HTML:
 * - Palette: Deep Carbon (#050505), Vermilion Ember (#FF4500), Matte Card (#111111),
 *   Blush Ivory Hero Glow (#FFE0E0), and Crisp White Pill CTAs (#FFFFFF).
 * - Typography: Playfair Display (regular + light italic) paired with Inter (300/400/500/600).
 * - Signature Patterns: Floating surrealist hero framing, live clock + coordinate metadata strip,
 *   paired Vermilion (#FF4500) + Carbon (#111111) 4:5 aspect-ratio parallax cards with circular
 *   rotating icon badges and 01/02 index pills, dot-matrix background, and monumental 10vw footer watermark.
 */

export const DESIGN_READ =
  'Reading this as: Personal yet professional dark editorial field-journal application in the Superdesign aesthetic (#050505 carbon canvas, #FF4500 vermilion accent cards, #111111 matte cards, #FFE0E0 luminous Playfair Display typography, and Inter body copy).';

export const DESIGN_DIALS = {
  DESIGN_VARIANCE: 8,
  MOTION_INTENSITY: 6,
  VISUAL_DENSITY: 3,
} as const;

export const COLOR_TOKENS = {
  dark: {
    canvas: '#050505',
    surface1: '#111111',
    surface2: '#181818',
    text: '#FFFFFF',
    textBlush: '#FFE0E0',
    textMuted: '#9CA3AF',
    accentA: '#FF4500',
    accentB: '#FFE0E0',
  },
  light: {
    canvas: '#FAF8F6',
    surface1: '#FFFFFF',
    surface2: '#F2EFEB',
    text: '#0A0A0A',
    textBlush: '#141414',
    textMuted: '#6B7280',
    accentA: '#FF4500',
    accentB: '#FF4500',
  },
} as const;

export const CATEGORY_METADATA = {
  Nature: {
    label: 'Nature',
    description: 'Botanical details, weather shifts, birds, insects, and seasonal changes.',
    promptHint: 'A tiny fern growing between two paving stones after rain.',
  },
  Light: {
    label: 'Light',
    description: 'Reflections, shadows, late-afternoon rectangles, and shifting color temperatures.',
    promptHint: 'The last rectangle of sunlight crossing the kitchen floor at 4:40 PM.',
  },
  Architecture: {
    label: 'Architecture',
    description: 'Worn masonry, lintels, staircases, signage, and uncelebrated structural craft.',
    promptHint: 'A brass mail slot polished bright by eighty years of hands.',
  },
  People: {
    label: 'People',
    description: 'Overheard phrases, small gestures, kindnesses, and quiet human habits.',
    promptHint: 'Two neighbors comparing tomato seedlings over a low brick wall.',
  },
  Sound: {
    label: 'Sound',
    description: 'Rain on sheet metal, distant trains, room tone, and acoustic textures.',
    promptHint: 'The mechanical click the station clock makes five seconds before the hour.',
  },
  Unexpected: {
    label: 'Unexpected',
    description: 'Odd juxtapositions, lost objects, and moments that resist neat categorization.',
    promptHint: 'A single porcelain teacup resting neatly on a mossy fire hydrant.',
  },
} as const;

export const DAILY_OBSERVATION_PROMPTS = [
  'What did the light touch differently today than yesterday?',
  'Was there a sound today that made you pause, even for two seconds?',
  'Notice one worn surface near you that shows the history of hands or weather.',
  'What small living thing appeared in a place built entirely of concrete or brick?',
  'Recall one fleeting gesture or overheard fragment from your walk today.',
  'Look at the nearest window frame: what small detail in its view usually goes unseen?',
] as const;
