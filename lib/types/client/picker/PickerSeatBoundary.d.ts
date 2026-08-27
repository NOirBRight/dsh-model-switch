import type { ReactNode } from 'react';
interface PickerSeatBoundaryProps {
    children: ReactNode;
    errorLabel: (message: string) => string;
}
export declare function PickerSeatBoundary({ children, errorLabel }: PickerSeatBoundaryProps): import("react").JSX.Element;
export {};
