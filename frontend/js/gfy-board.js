// Table in-play card rank — avoid showing full hand cards during set bank / bluff prompts.
export function resolveTableRank(view, tableActiveRank, lastActiveRank) {
  if (tableActiveRank) return tableActiveRank;
  const p = view?.prompt?.type;
  if (p === 'createSet' || p === 'createSetWait' || p === 'bluff' || p === 'bluffWait' || p === 'chaos') {
    return null;
  }
  const ev = view?.event;
  if (ev?.rank && ['ask', 'give', 'gfy'].includes(ev.kind)) return ev.rank;
  if (view?.prompt?.type === 'drink' && view.prompt.rank) return view.prompt.rank;
  return lastActiveRank || null;
}
