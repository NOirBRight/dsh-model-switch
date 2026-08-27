import { Component, type ErrorInfo, type ReactNode } from 'react';
export declare class PickerSeatBoundary extends Component<{
    children: ReactNode;
}, {
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
