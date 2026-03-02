import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { authApi } from "@/features/api";
import { useAuthStore } from "@/stores/authStore";

type AuthMode = "signIn" | "signUp";

type FieldErrors = {
  email?: string;
  password?: string;
  nickname?: string;
  verificationCode?: string;
};

function validateFields(mode: AuthMode, email: string, password: string, nickname: string): FieldErrors {
  const errors: FieldErrors = {};

  const normalizedEmail = email.trim();
  const normalizedNickname = nickname.trim();

  if (!normalizedEmail) {
    errors.email = "이메일을 입력해 주세요.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    errors.email = "올바른 이메일 형식을 입력해 주세요.";
  }

  if (!password) {
    errors.password = "비밀번호를 입력해 주세요.";
  } else if (mode === "signUp") {
    if (password.length < 8) {
      errors.password = "비밀번호는 8자 이상이어야 합니다.";
    } else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      errors.password = "비밀번호는 영문과 숫자를 모두 포함해 주세요.";
    }
  }

  if (mode === "signUp") {
    if (!normalizedNickname) {
      errors.nickname = "닉네임을 입력해 주세요.";
    } else if (normalizedNickname.length < 2 || normalizedNickname.length > 20) {
      errors.nickname = "닉네임은 2자 이상 20자 이하로 입력해 주세요.";
    }
  }

  return errors;
}

function hasFieldErrors(errors: FieldErrors): boolean {
  return Boolean(errors.email || errors.password || errors.nickname || errors.verificationCode);
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function inputClass(hasError: boolean): string {
  return `w-full rounded-md border bg-slate-950 px-3 py-2 text-sm outline-none transition ${
    hasError
      ? "border-rose-500 focus:border-rose-400"
      : "border-slate-700 focus:border-sky-500"
  }`;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { setAuthenticated } = useAuthStore();

  const [mode, setMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyNotice, setVerifyNotice] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    const nextErrors = validateFields(mode, email, password, nickname);
    if (mode === "signUp" && (!emailVerified || verifiedEmail !== email.trim())) {
      nextErrors.verificationCode = "이메일 인증을 완료해 주세요.";
    }
    setFieldErrors(nextErrors);
    if (hasFieldErrors(nextErrors)) return;

    setLoading(true);
    try {
      if (mode === "signIn") {
        await authApi.signIn({ email: email.trim(), password });
        setAuthenticated(true);
        navigate("/");
      } else {
        await authApi.signUp({ email: email.trim(), password, nickname: nickname.trim() });
        setMode("signIn");
        setSuccess("회원가입이 완료되었습니다. 로그인해 주세요.");
      }
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "요청 처리 중 오류가 발생했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendVerificationCode = async () => {
    const normalizedEmail = email.trim();
    setVerifyNotice("");
    setVerifyError("");

    if (!normalizedEmail) {
      setFieldErrors((prev) => ({ ...prev, email: "이메일을 입력해 주세요." }));
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      setFieldErrors((prev) => ({ ...prev, email: "올바른 이메일 형식을 입력해 주세요." }));
      return;
    }

    setVerifyLoading(true);
    try {
      await authApi.sendVerificationEmail({ email: normalizedEmail });
      setEmailVerified(false);
      setVerifiedEmail("");
      setVerifyNotice("인증코드를 전송했습니다. 이메일을 확인해 주세요.");
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : "인증코드 전송에 실패했습니다.";
      setVerifyError(message);
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    const normalizedEmail = email.trim();
    const normalizedCode = verificationCode.trim();
    setVerifyNotice("");
    setVerifyError("");
    setFieldErrors((prev) => ({ ...prev, verificationCode: undefined }));

    if (!normalizedCode) {
      setFieldErrors((prev) => ({ ...prev, verificationCode: "인증코드를 입력해 주세요." }));
      return;
    }

    setVerifyLoading(true);
    try {
      await authApi.verifyEmailCode({ email: normalizedEmail, code: normalizedCode });
      setEmailVerified(true);
      setVerifiedEmail(normalizedEmail);
      setVerifyNotice("이메일 인증이 완료되었습니다.");
    } catch (verifyCodeError) {
      const message = verifyCodeError instanceof Error ? verifyCodeError.message : "인증코드 확인에 실패했습니다.";
      setVerifyError(message);
      setEmailVerified(false);
      setVerifiedEmail("");
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    const backendBase = (import.meta.env.VITE_BACKEND_BASE_URL as string | undefined) ?? "http://localhost:8080";
    window.location.href = `${backendBase}/oauth2/authorization/google`;
  };

  return (
    <MainLayout>
      <section className="mx-auto mt-16 w-full max-w-[360px] px-4">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-[0_24px_60px_rgba(2,6,23,0.5)]">
          <h1 className="text-2xl font-bold tracking-tight">{mode === "signIn" ? "로그인" : "회원가입"}</h1>
          <p className="mt-2 text-sm text-slate-400">
            {mode === "signIn" ? "계정으로 로그인해 거래 화면으로 이동하세요." : "새 계정을 만들고 바로 시작하세요."}
          </p>

          <form className="mt-5 space-y-3" onSubmit={handleSubmit} noValidate>
            <div>
              <input
                className={inputClass(Boolean(fieldErrors.email))}
                placeholder="이메일"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (verifiedEmail !== event.target.value.trim()) {
                    setEmailVerified(false);
                  }
                  setFieldErrors((prev) => ({ ...prev, email: undefined }));
                }}
              />
              {fieldErrors.email && <p className="mt-1 text-xs text-rose-300">{fieldErrors.email}</p>}
            </div>

            {mode === "signUp" && (
              <>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSendVerificationCode}
                    disabled={verifyLoading}
                    className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    인증코드 받기
                  </button>
                  <span className={`text-xs ${emailVerified ? "text-emerald-300" : "text-slate-400"}`}>
                    {emailVerified ? "인증 완료" : "미인증"}
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <input
                      className={inputClass(Boolean(fieldErrors.verificationCode))}
                      placeholder="인증코드 6자리"
                      value={verificationCode}
                      onChange={(event) => {
                        setVerificationCode(event.target.value);
                        setFieldErrors((prev) => ({ ...prev, verificationCode: undefined }));
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleVerifyCode}
                      disabled={verifyLoading}
                      className="shrink-0 rounded-md border border-sky-600 bg-sky-500 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      인증 확인
                    </button>
                  </div>
                  {fieldErrors.verificationCode && (
                    <p className="mt-1 text-xs text-rose-300">{fieldErrors.verificationCode}</p>
                  )}
                </div>
              </>
            )}

            <div>
              <input
                className={inputClass(Boolean(fieldErrors.password))}
                placeholder="비밀번호"
                type="password"
                autoComplete={mode === "signIn" ? "current-password" : "new-password"}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setFieldErrors((prev) => ({ ...prev, password: undefined }));
                }}
              />
              {fieldErrors.password && <p className="mt-1 text-xs text-rose-300">{fieldErrors.password}</p>}
            </div>

            {mode === "signUp" && (
              <div>
                <input
                  className={inputClass(Boolean(fieldErrors.nickname))}
                  placeholder="닉네임"
                  value={nickname}
                  onChange={(event) => {
                    setNickname(event.target.value);
                    setFieldErrors((prev) => ({ ...prev, nickname: undefined }));
                  }}
                />
                {fieldErrors.nickname && <p className="mt-1 text-xs text-rose-300">{fieldErrors.nickname}</p>}
              </div>
            )}

            {error && <p className="text-sm text-rose-300">{error}</p>}
            {success && <p className="text-sm text-emerald-300">{success}</p>}
            {verifyError && <p className="text-sm text-rose-300">{verifyError}</p>}
            {verifyNotice && <p className="text-sm text-emerald-300">{verifyNotice}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-sky-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "처리 중..." : mode === "signIn" ? "로그인" : "회원가입"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-400">
            {mode === "signIn" ? "처음이신가요?" : "이미 계정이 있나요?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signIn" ? "signUp" : "signIn");
                setFieldErrors({});
                setError("");
                setSuccess("");
                setVerificationCode("");
                setEmailVerified(false);
                setVerifiedEmail("");
                setVerifyNotice("");
                setVerifyError("");
              }}
              className="font-medium text-sky-300 hover:text-sky-200"
            >
              {mode === "signIn" ? "회원가입" : "로그인"}
            </button>
          </p>

          <div className="my-5 h-px bg-slate-800" />

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full rounded-md border border-slate-700 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
          >
            구글로 로그인
          </button>
        </div>
      </section>
    </MainLayout>
  );
}
