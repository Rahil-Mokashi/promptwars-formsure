import type { Trio } from './types';

/** Shown instead of a rule's fix when a check could not be verified (the fix texts describe failures). */
export const NEEDS_REVIEW_FIX: Trio = {
  en: 'FormSure could not verify this automatically. Check it against your original document yourself, or ask your college scholarship desk to look at it.',
  mr: 'FormSure हे आपोआप पडताळू शकले नाही. मूळ कागदपत्राशी स्वतः तपासा किंवा तुमच्या महाविद्यालयाच्या शिष्यवृत्ती विभागाला तपासायला सांगा.',
  hi: 'FormSure इसे अपने आप सत्यापित नहीं कर सका। मूल दस्तावेज़ से खुद मिलान करें, या अपने कॉलेज के छात्रवृत्ति विभाग से जँचवाएं।',
};

/** Heading of a check that could not be verified. */
export const NEEDS_REVIEW_WHY: Trio = {
  en: 'A missing, unreadable or ambiguous value means FormSure cannot say whether this passes, so it never guesses.',
  mr: 'मूल्य अनुपस्थित, अस्पष्ट किंवा संदिग्ध असल्यास हे पास होते की नाही हे FormSure सांगू शकत नाही, म्हणून ते कधीही अंदाज करत नाही.',
  hi: 'कोई मान गायब, अस्पष्ट या संदिग्ध हो तो FormSure नहीं कह सकता कि यह पास है या नहीं, इसलिए वह कभी अंदाज़ा नहीं लगाता।',
};

/** The disclaimer that goes with every report. */
export const PRECHECK_DISCLAIMER = 'This is a document pre-check, not an eligibility decision or approval guarantee.';

/** `Pre-check complete — 4 passed, 3 need fixing, 0 couldn't be verified.` */
export const precheckSummary = (passed: number, failed: number, needsReview: number): string =>
  `Pre-check complete — ${passed} passed, ${failed} need fixing, ${needsReview} couldn’t be verified.`;
