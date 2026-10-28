import { m } from 'framer-motion';
import { slotNames } from '../../core/slotNames';
import type { Lang, SchemePack } from '../../core/types';
import { useReduce } from '../../hooks/useMotion';
import { FileIcon } from '../icons';
import { fadeUp } from '../motionProps';

const LIST_DELAY_S = 0.12;
const LIST_STAGGER_S = 0.06;

/** The documents the chosen scheme needs, named in the chosen language. */
export function RequiredDocs({ pack, lang }: { pack: SchemePack; lang: Lang }) {
  const reduce = useReduce();
  return (
    <section className="card panel" aria-labelledby="req-docs">
      <p className="ptitle" id="req-docs">
        Documents this scheme needs
      </p>
      <p className="pdesc">
        {pack.slots.length} documents for {pack.name}
      </p>
      <ul className="doclist">
        {pack.slots.map((slot, i) => {
          const n = slotNames(slot, lang);
          return (
            <m.li key={slot.id} {...fadeUp(reduce, LIST_DELAY_S + i * LIST_STAGGER_S)}>
              <span className="dicon">
                <FileIcon size={16} />
              </span>
              <span>
                {n.name}
                <span className="mr dev" lang={n.subLang}>
                  {n.sub}
                </span>
              </span>
            </m.li>
          );
        })}
      </ul>
    </section>
  );
}
