import { apiPost } from "@/lib/api/client";
import type {
  EmailVerificationConfirmPayload,
  EmailVerificationSendPayload,
  LinkSocialAccountPayload,
  PasswordResetConfirmPayload,
  PasswordResetSendPayload,
  SignInPayload,
  SignUpPayload,
  UserResponse,
} from "@/features/auth/types";

export function sendVerificationEmail(payload: EmailVerificationSendPayload): Promise<null> {
  return apiPost<null, EmailVerificationSendPayload>("/api/auth/email/send", payload);
}

export function verifyEmailCode(payload: EmailVerificationConfirmPayload): Promise<null> {
  return apiPost<null, EmailVerificationConfirmPayload>("/api/auth/email/verify", payload);
}

export function sendPasswordResetCode(payload: PasswordResetSendPayload): Promise<null> {
  return apiPost<null, PasswordResetSendPayload>("/api/auth/password/reset/send", payload);
}

export function confirmPasswordReset(payload: PasswordResetConfirmPayload): Promise<null> {
  return apiPost<null, PasswordResetConfirmPayload>("/api/auth/password/reset/confirm", payload);
}

export function signUp(payload: SignUpPayload): Promise<UserResponse> {
  return apiPost<UserResponse, SignUpPayload>("/api/auth/sign-up", payload);
}

export function signIn(payload: SignInPayload): Promise<null> {
  return apiPost<null, SignInPayload>("/api/auth/sign-in", payload);
}

export function linkSocialAccount(payload: LinkSocialAccountPayload): Promise<null> {
  return apiPost<null, LinkSocialAccountPayload>("/api/auth/oauth2/link", payload);
}

export function refreshToken(): Promise<null> {
  return apiPost<null>("/api/auth/refresh");
}

export function signOut(): Promise<null> {
  return apiPost<null>("/api/auth/sign-out");
}
