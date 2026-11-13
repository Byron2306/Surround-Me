// Surround_me.txt, Greyline → Enemy Adaptation Matrix.
// Values are playtest tuning; the direction of each change is authored.
export function enemyTellScale(family,side,extremity) {
  const weight=Number.isFinite(extremity)?Math.min(1,Math.max(0,extremity)):0;
  const polarity=side==='compulsion'?1:side==='restraint'?-1:0;
  if(family==='rehearsed') return 1+polarity*weight*.30;
  if(family==='deferred') return 1+(polarity<0?.35:polarity>0?-.20:0)*weight;
  return 1;
}
