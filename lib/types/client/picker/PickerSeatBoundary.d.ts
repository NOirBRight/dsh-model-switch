import { Component, type ErrorInfo, type ReactNode } from 'react';
interface PickerSeatBoundaryProps {
    children: ReactNode;
    errorLabel: (message: string) => string;
}
export declare class PickerSeatBoundary extends Component<PickerSeatBoundaryProps, {
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
