import { Component, type ErrorInfo, type ReactNode } from 'react';
interface RetryBoundaryProps {
    children: ReactNode;
    logLabel: string;
    renderFallback: (message: string, retry: () => void) => ReactNode;
}
/** Own retryable React error-boundary state while callers own presentation and copy. */
export declare class RetryBoundary extends Component<RetryBoundaryProps, {
    message: string | null;
}> {
    state: {
        message: null;
    };
    static getDerivedStateFromError(error: unknown): {
        message: string;
    };
    componentDidCatch(error: unknown, info: ErrorInfo): void;
    render(): ReactNode;
}
export {};
