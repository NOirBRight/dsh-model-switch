import { Component, type ErrorInfo, type ReactNode } from 'react'

interface PickerSeatBoundaryProps {
  children: ReactNode
  errorLabel: (message: string) => string
}

export class PickerSeatBoundary extends Component<PickerSeatBoundaryProps, { message: string | null }> {
  override state = { message: null }

  static getDerivedStateFromError(error: unknown): { message: string } {
    return { message: error instanceof Error ? error.message : String(error) }
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('dsh-model-switch: composer picker seat crashed', error, info)
  }

  override render(): ReactNode {
    if (this.state.message === null) return this.props.children
    return (
      <button
        type="button"
        data-dsh-ms-seat-error
        title={this.state.message}
        onClick={() => { this.setState({ message: null }) }}
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
        {this.props.errorLabel(this.state.message)}
      </button>
    )
  }
}
