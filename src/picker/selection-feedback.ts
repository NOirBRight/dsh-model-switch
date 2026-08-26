/** Immediate picker feedback around an asynchronous Host model selection. */
export async function beginSelection(
  select: () => Promise<boolean>,
  showFeedback: () => void,
  settle: (accepted: boolean) => void,
): Promise<void> {
  showFeedback()
  settle(await select())
}
