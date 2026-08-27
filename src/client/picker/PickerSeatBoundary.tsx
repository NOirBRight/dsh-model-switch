import type { ReactNode } from 'react'
import { RetryBoundary } from './RetryBoundary.tsx'

interface PickerSeatBoundaryProps {
  children: ReactNode
  errorLabel: (message: string) => string
}

export function PickerSeatBoundary({ children, errorLabel }: PickerSeatBoundaryProps) {
  return (
    <RetryBoundary
      logLabel="dsh-model-switch: composer picker seat crashed"
      renderFallback={(message, retry) => (
        <button
          type="button"
          data-dsh-ms-seat-error
          title={message}
          onClick={retry}
          style={{
            maxWidth: 280,
            border: 0,
            background: 'transparent',
            color: 'var(--dsw-alias-state-error-primary)',
            font: 'var(--dsw-font-xs-13)',
            overflowWrap: 'anywhere',
            cursor: 'pointer',
          }}
        >
          {errorLabel(message)}
        </button>
      )}
    >
      {children}
    </RetryBoundary>
  )
}
