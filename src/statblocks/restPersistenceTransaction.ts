/**
 * Coordinates the compensating side of a Rest operation that writes to both the Atlas
 * runtime and an Obsidian note. The note writer invokes `registerAtlasReceipt` immediately
 * after the Atlas commit; if the note write (or any later work inside the writer) rejects,
 * the Atlas commit is compensated before the error is propagated.
 *
 * Atlas and Vault do not share an atomic transaction. This helper makes the ordering and
 * compensation boundary explicit without pretending that cross-store atomicity is absolute.
 */
export async function runRestNotePersistenceWithAtlasRollback<T, Receipt>(
  persistNote: (registerAtlasReceipt: (receipt: Receipt) => void) => Promise<T>,
  rollbackAtlas: (receipt: Receipt) => void,
): Promise<T> {
  let hasReceipt = false;
  let receipt!: Receipt;

  const registerAtlasReceipt = (nextReceipt: Receipt): void => {
    if (hasReceipt) {
      throw new Error('Uma operação de Rest tentou registrar mais de um recibo de commit do Atlas.');
    }
    receipt = nextReceipt;
    hasReceipt = true;
  };

  try {
    return await persistNote(registerAtlasReceipt);
  } catch (error) {
    if (!hasReceipt) throw error;

    try {
      rollbackAtlas(receipt);
    } catch (rollbackError) {
      const originalMessage = error instanceof Error ? error.message : String(error);
      const rollbackMessage = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
      throw new Error(`${originalMessage} Além disso, não foi possível reverter o Resource Atlas: ${rollbackMessage}`);
    }

    throw error;
  }
}
