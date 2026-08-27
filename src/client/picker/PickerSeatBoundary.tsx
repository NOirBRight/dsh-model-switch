import { Component, type ErrorInfo, type ReactNode } from 'react'

export class PickerSeatBoundary extends Component<{ children: ReactNode }, { message: string | null }> {
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
          overflow: 'hidden',
          border: 0,
          background: 'transparent',
          color: 'var(--dsw-alias-state-error-primary)',
          font: 'var(--dsw-font-xs-13)',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          cursor: 'pointer',
        }}
      >
        {`Model picker error: ${this.state.message}`}
      </button>
    )
  }
}
