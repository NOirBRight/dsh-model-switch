import { Component, type ErrorInfo, type ReactNode } from 'react'

interface RetryBoundaryProps {
  children: ReactNode
  logLabel: string
  renderFallback: (message: string, retry: () => void) => ReactNode
}

/** Own retryable React error-boundary state while callers own presentation and copy. */
export class RetryBoundary extends Component<RetryBoundaryProps, { message: string | null }> {
  override state = { message: null }

  static getDerivedStateFromError(error: unknown): { message: string } {
    return { message: error instanceof Error ? error.message : String(error) }
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(this.props.logLabel, error, info)
  }

  override render(): ReactNode {
    if (this.state.message === null) return this.props.children
    return this.props.renderFallback(this.state.message, () => { this.setState({ message: null }) })
  }
}
