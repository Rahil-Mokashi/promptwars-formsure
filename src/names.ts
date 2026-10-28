import type { Lang, SlotDef } from './core/types';

/** Primary name in the chosen language, secondary line in another (the design shows Marathi under English). */
export function slotNames(slot: SlotDef, lang: Lang): { name: string; subLang: Lang; sub: string } {
  const subLang: Lang = lang === 'en' ? 'mr' : 'en';
  return { name: slot.label[lang], subLang, sub: slot.label[subLang] };
}
