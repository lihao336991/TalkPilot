export type AuthFlowErrorCode =
  | 'appleUnsupportedPlatform'
  | 'appleUnavailable'
  | 'appleMissingToken'
  | 'appleCancelled'
  | 'googleUnsupportedPlatform'
  | 'googleMissingToken'
  | 'googleCancelled';

export class AuthFlowError extends Error {
  code: AuthFlowErrorCode;

  constructor(code: AuthFlowErrorCode) {
    super(code);
    this.name = 'AuthFlowError';
    this.code = code;
  }
}
