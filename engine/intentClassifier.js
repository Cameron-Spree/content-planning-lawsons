/**
 * Intent and Audience Classification for UK Building, Fencing & Tool Supplies
 */

const QUESTION_WORDS = ['how', 'why', 'what', 'when', 'where', 'which', 'can', 'should', 'is', 'are', 'do', 'does'];

const INFORMATIONAL_TERMS = [
  'guide', 'tutorial', 'instructions', 'ideas', 'tips', 'advice', 'diy',
  'how to', 'install', 'installation', 'build', 'fitting', 'calculation',
  'calculator', 'formula', 'rules', 'regulations', 'planning permission',
  'height', 'depth', 'spacing', 'treatment', 'maintenance', 'repair',
  'which way', 'per meter', 'per metre', 'spacing', 'posts', 'how many'
];

const COMMERCIAL_TERMS = [
  'best', 'top', 'review', 'reviews', 'vs', 'versus', 'compared', 'difference',
  'worth it', 'ratings', 'pros and cons', 'cordless vs', 'petrol vs',
  'electric vs', 'buying guide', 'recommendations'
];

const TRANSACTIONAL_TERMS = [
  'buy', 'cheap', 'price', 'cost', 'sale', 'online', 'supplies', 'bulk',
  'bulk bag', 'stockist', 'supplier', 'quote', 'order', 'delivery',
  'merchant', 'for sale', 'hire'
];

const TRADE_INDICATORS = [
  'trade', 'site', 'commercial', 'contractor', 'heavy duty', 'industrial',
  'bulk', 'bulk bag', 'spec', 'twinwall', 'underground drainage', 'mot type 1',
  'groundworks', 'structural', 'sub base', 'pallet', 'pack of', '110v'
];

const DIY_INDICATORS = [
  'diy', 'garden', 'home', 'backyard', 'easy', 'patio', 'beginner',
  'small', 'domestic', 'cottage', 'step by step', 'decorative', 'budget'
];

function classifyIntent(keyword, isQuestionFlag) {
  const kw = keyword.toLowerCase();

  // If flagged as Question or starts with question word
  if (isQuestionFlag || QUESTION_WORDS.some(w => kw.startsWith(w + ' '))) {
    return 'Informational / How-To';
  }

  // Commercial intent (investigation / comparisons)
  if (COMMERCIAL_TERMS.some(t => kw.includes(t))) {
    return 'Commercial / Buying Guide';
  }

  // Informational guides
  if (INFORMATIONAL_TERMS.some(t => kw.includes(t))) {
    return 'Informational / How-To';
  }

  // Transactional
  if (TRANSACTIONAL_TERMS.some(t => kw.includes(t))) {
    return 'Transactional / Product Focus';
  }

  return 'Informational / Guide';
}

function classifyAudience(keyword, pillar) {
  const kw = keyword.toLowerCase();

  const isTrade = TRADE_INDICATORS.some(t => kw.includes(t));
  const isDIY = DIY_INDICATORS.some(t => kw.includes(t));

  if (isTrade && !isDIY) return 'Trade & Contractors';
  if (isDIY && !isTrade) return 'Domestic & DIY';

  // Pillar defaults
  if (pillar === 'Building Materials') return 'Trade & DIY';
  if (pillar === 'Power Tools') return 'DIY & Professionals';
  return 'Domestic & DIY';
}

module.exports = {
  classifyIntent,
  classifyAudience
};
