// What the tank puts in the tray menu (platform plan D38): a status line and a list of items, from the summary of the
// tank. The host adds its own items (mode, settings, Quit) and sends the id of a chosen item back to `onMenu`.

/** The status line, for example "2 pellets waiting · 5 in the stash · 1 hungry". */
export function statusLine(summary) {
  if (summary.allFull && summary.waiting === 0 && summary.stash === 0) {
    return 'Nothing to do right now'; // the greyed feeding item below already says that everyone is full
  }
  const parts = [];
  if (summary.waiting > 0)
    parts.push(`${summary.waiting} ${summary.waiting === 1 ? 'pellet' : 'pellets'} waiting`);
  parts.push(`${summary.stash} in the stash`);
  parts.push(summary.allFull ? 'everyone is full' : `${summary.hungry} hungry`);
  return parts.join(' · ');
}

/**
 * The items of the tank, in menu order. An item with an `id` can be chosen; one without is a greyed line that says
 * why something is not possible.
 * @param {{waiting: number, stash: number, stashFull: boolean, hungry: number, fishCount: number, eggs: number,
 *          eggReady: boolean, allFull: boolean, feeding: boolean}} summary
 * @returns {{id?: string, label: string, enabled?: boolean}[]}
 */
export function menuItems(summary) {
  const items = [];

  // Collect pellets
  if (summary.stashFull) items.push({ label: 'Stash is full' });
  else if (summary.waiting === 0) items.push({ label: 'No pellets waiting' });
  else items.push({ id: 'collect', label: 'Collect pellets' });

  // Feeding. The reason a feeding item is greyed comes first: nobody is hungry, then an empty stash.
  const feedBlock =
    summary.fishCount === 0 || summary.allFull
      ? 'Everyone is full and happy'
      : summary.stash === 0
        ? 'No pellets in the stash'
        : null;
  if (feedBlock) {
    items.push({ label: feedBlock });
  } else {
    items.push({ id: 'feed', label: 'Feed a pellet' });
    items.push(
      summary.feeding
        ? { id: 'stopFeeding', label: 'Stop feeding' }
        : { id: 'feedUntilFull', label: 'Feed until full' },
    );
  }
  if (summary.feeding && feedBlock) items.push({ id: 'stopFeeding', label: 'Stop feeding' });

  // Hatch egg: only while an egg is waiting.
  if (summary.eggs > 0) {
    items.push(
      summary.eggReady
        ? { id: 'hatch', label: 'Hatch egg' }
        : { label: 'An egg is waiting (the tank is full)' },
    );
  }
  return items;
}
