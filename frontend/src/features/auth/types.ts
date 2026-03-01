export type SignInPayload = {
  email: string;
  password: string;
};

export type SignUpPayload = {
  email: string;
  password: string;
  nickname: string;
};

export type EmailVerificationSendPayload = {
  email: string;
};

export type EmailVerificationConfirmPayload = {
  email: string;
  code: string;
};

export type PasswordResetSendPayload = {
  email: string;
};

export type PasswordResetConfirmPayload = {
  email: string;
  code: string;
  newPassword: string;
};

export type LinkSocialAccountPayload = {
  email: string;
  password: string;
  provider: string;
  providerId: string;
};

export type UserResponse = {
  id: number;
  email: string;
  nickname: string;
  createdAt: string;
};
