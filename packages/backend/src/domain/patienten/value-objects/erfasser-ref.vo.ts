import { Result } from '@domain/common/result';
import { ValueObject } from '@domain/common/value-object';

/**
 * Erfasser-Bimodalität (Architecture §D-5):
 *
 * - **Online-Einsatz-Erfassung:** `{ type: 'user', userId }` — eingeloggter User
 *   mit JWT.
 * - **Standalone-Capture:** `{ type: 'device', deviceId, captureSessionId? }` —
 *   kein User, Backfill via Attach (Epic 2).
 *
 * Das Aggregate erlaubt beide Modi. Die spätere Use-Case-Schicht (Story 1.2 /
 * Epic 2) entscheidet, welcher Modus erlaubt ist.
 */
export type UserErfasserData = {
  readonly type: 'user';
  readonly userId: string;
};

export type DeviceErfasserData = {
  readonly type: 'device';
  readonly deviceId: string;
  readonly captureSessionId?: string;
};

export type ErfasserRefData = UserErfasserData | DeviceErfasserData;

interface ErfasserRefProps extends Record<string, unknown> {
  data: ErfasserRefData;
}

export class ErfasserRef extends ValueObject<ErfasserRefProps> {
  private constructor(props: ErfasserRefProps) {
    super(props);
  }

  static user(userId: string): Result<ErfasserRef> {
    if (typeof userId !== 'string' || userId.trim().length === 0) {
      return Result.fail<ErfasserRef>('ErfasserRef.user: userId darf nicht leer sein');
    }
    return Result.ok(new ErfasserRef({ data: { type: 'user', userId: userId.trim() } }));
  }

  static device(deviceId: string, captureSessionId?: string): Result<ErfasserRef> {
    if (typeof deviceId !== 'string' || deviceId.trim().length === 0) {
      return Result.fail<ErfasserRef>('ErfasserRef.device: deviceId darf nicht leer sein');
    }
    if (captureSessionId !== undefined) {
      if (typeof captureSessionId !== 'string' || captureSessionId.trim().length === 0) {
        return Result.fail<ErfasserRef>('ErfasserRef.device: captureSessionId darf nicht leer sein, wenn angegeben');
      }
    }
    const data: DeviceErfasserData =
      captureSessionId === undefined ? { type: 'device', deviceId: deviceId.trim() } : { type: 'device', deviceId: deviceId.trim(), captureSessionId: captureSessionId.trim() };
    return Result.ok(new ErfasserRef({ data }));
  }

  get data(): ErfasserRefData {
    return this.props.data;
  }

  get type(): 'user' | 'device' {
    return this.props.data.type;
  }

  static isUserErfasser(data: ErfasserRefData): data is UserErfasserData {
    return data.type === 'user';
  }

  static isDeviceErfasser(data: ErfasserRefData): data is DeviceErfasserData {
    return data.type === 'device';
  }
}
