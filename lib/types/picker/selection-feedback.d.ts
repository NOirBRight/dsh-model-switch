/** Immediate picker feedback around an asynchronous Host model selection. */
export declare function beginSelection(select: () => Promise<boolean>, showFeedback: () => void, settle: (accepted: boolean) => void): Promise<void>;
