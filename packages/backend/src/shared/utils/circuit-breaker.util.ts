/**
 * Circuit Breaker Configuration
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Duration in ms to keep circuit open */
  openStateDuration: number;
  /** Number of successes needed to close circuit */
  successThreshold: number;
  /** Time window in ms for failure counting */
  failureCountWindow: number;
  /** Failure rate threshold (percentage) */
  failureRateThreshold: number;
  /** Minimum number of calls before evaluating */
  minimumNumberOfCalls: number;
}

/**
 * Circuit Breaker States
 */
export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

/**
 * Circuit Breaker Error
 */
export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

/**
 * Circuit Breaker Implementation
 *
 * Prevents cascading failures by temporarily blocking calls to failing services
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failures = 0;
  private successes = 0;
  private lastFailureTime?: Date;
  private openedAt?: Date;
  private callHistory: { timestamp: Date; success: boolean }[] = [];

  private readonly config: CircuitBreakerConfig;

  constructor(
    private readonly name: string,
    config?: Partial<CircuitBreakerConfig>,
  ) {
    this.config = {
      failureThreshold: 5,
      openStateDuration: 30000, // 30 seconds
      successThreshold: 3,
      failureCountWindow: 60000, // 1 minute
      failureRateThreshold: 50, // 50%
      minimumNumberOfCalls: 5,
      ...config,
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      const now = Date.now();
      const openDuration = now - (this.openedAt?.getTime() || 0);

      if (openDuration < this.config.openStateDuration) {
        throw new CircuitBreakerOpenError(`Circuit breaker ${this.name} is OPEN. Retry after ${Math.ceil((this.config.openStateDuration - openDuration) / 1000)} seconds`);
      }

      // Transition to half-open
      this.state = CircuitBreakerState.HALF_OPEN;
      this.successes = 0;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.addToHistory(true);

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successes++;

      if (this.successes >= this.config.successThreshold) {
        this.state = CircuitBreakerState.CLOSED;
        this.failures = 0;
        this.successes = 0;
      }
    } else if (this.state === CircuitBreakerState.CLOSED) {
      // Reset failure count on success in closed state
      this.failures = 0;
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.addToHistory(false);
    this.lastFailureTime = new Date();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      // Immediately open on failure in half-open state
      this.open();
    } else if (this.state === CircuitBreakerState.CLOSED) {
      this.failures++;

      // Check if we should open based on threshold or rate
      if (this.shouldOpen()) {
        this.open();
      }
    }
  }

  /**
   * Check if circuit should open
   */
  private shouldOpen(): boolean {
    // Check absolute threshold
    if (this.failures >= this.config.failureThreshold) {
      return true;
    }

    // Check failure rate
    const recentCalls = this.getRecentCalls();
    if (recentCalls.length >= this.config.minimumNumberOfCalls) {
      const failureCount = recentCalls.filter((call) => !call.success).length;
      const failureRate = (failureCount / recentCalls.length) * 100;

      return failureRate >= this.config.failureRateThreshold;
    }

    return false;
  }

  /**
   * Open the circuit
   */
  private open(): void {
    this.state = CircuitBreakerState.OPEN;
    this.openedAt = new Date();
    this.failures = 0;
    this.successes = 0;
  }

  /**
   * Add call to history
   */
  private addToHistory(success: boolean): void {
    const now = new Date();
    this.callHistory.push({ timestamp: now, success });

    // Clean old entries
    const cutoff = new Date(now.getTime() - this.config.failureCountWindow);
    this.callHistory = this.callHistory.filter((call) => call.timestamp > cutoff);
  }

  /**
   * Get recent calls within the failure count window
   */
  private getRecentCalls(): typeof this.callHistory {
    const cutoff = new Date(Date.now() - this.config.failureCountWindow);
    return this.callHistory.filter((call) => call.timestamp > cutoff);
  }

  /**
   * Get current status
   */
  getStatus(): {
    state: CircuitBreakerState;
    failures: number;
    successes: number;
    lastFailureTime?: Date;
    openedAt?: Date;
    recentCallCount: number;
    recentFailureRate: number;
  } {
    const recentCalls = this.getRecentCalls();
    const recentFailures = recentCalls.filter((call) => !call.success).length;

    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      openedAt: this.openedAt,
      recentCallCount: recentCalls.length,
      recentFailureRate: recentCalls.length > 0 ? (recentFailures / recentCalls.length) * 100 : 0,
    };
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = undefined;
    this.openedAt = undefined;
    this.callHistory = [];
  }
}
