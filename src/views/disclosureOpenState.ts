/**
 * Keeps selected disclosure panels expanded when the Template Editor rebuilds
 * its sidebar after a control is changed. This is transient UI state only; it
 * is never written to a Template or Forge sidecar.
 */
export type DisclosureOpenState = Map<string, boolean>;

const trackedDisclosureElements = new WeakSet<HTMLDetailsElement>();

export function captureDisclosureOpenState(root: ParentNode, state: DisclosureOpenState): void {
  const disclosures = root.querySelectorAll<HTMLDetailsElement>('details[data-forge-disclosure-key]');
  disclosures.forEach((details) => {
    const key = details.dataset.forgeDisclosureKey;
    if (key) state.set(key, details.open);
  });
}

export function restoreDisclosureOpenState(root: ParentNode, state: DisclosureOpenState): void {
  const disclosures = root.querySelectorAll<HTMLDetailsElement>('details[data-forge-disclosure-key]');
  disclosures.forEach((details) => {
    const key = details.dataset.forgeDisclosureKey;
    if (!key) return;

    // Restore the last explicit state before wiring the new DOM node. The
    // toggle listener then keeps the map current even when a future action
    // rebuilds the entire editor rather than only refreshing the selection.
    if (state.has(key)) details.open = state.get(key)!;
    else state.set(key, details.open);

    if (!trackedDisclosureElements.has(details)) {
      details.addEventListener('toggle', () => state.set(key, details.open));
      trackedDisclosureElements.add(details);
    }
  });
}
