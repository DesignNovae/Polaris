"use client";

import { motion } from "framer-motion";

export function AuthHeading({
  title,
  description,
  step,
}: {
  title: string;
  description: string;
  step?: string;
}) {
  return (
    <div className="mb-7">
      <h1 className="text-balance font-sans text-[29px] font-bold leading-[1.08] tracking-[-0.025em] text-[#2C1810] sm:text-[34px]">
        {title}
      </h1>
      <p className="mt-3 max-w-[43ch] text-[13px] leading-6 text-[#7A6B5D]">
        {description}
      </p>
      {step && (
        <p className="mt-4 text-[11px] font-semibold tracking-[0.04em] text-[#A24159]">
          {step}
        </p>
      )}
    </div>
  );
}

export function AuthField({
  id,
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
  placeholder,
  required = true,
  inputMode,
  maxLength,
  suffix,
}: {
  id: string;
  label: string;
  type?: React.HTMLInputTypeAttribute;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  suffix?: React.ReactNode;
}) {
  return (
    <label htmlFor={id} className="block">
      {label && (
        <span className="mb-2 block text-[11px] font-semibold tracking-[0.04em] text-[#4A311F]">
          {label}
        </span>
      )}
      <span className="relative block">
        <input
          id={id}
          name={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required={required}
          inputMode={inputMode}
          maxLength={maxLength}
          className="auth-input h-12 w-full rounded-xl border border-[#8B5E3C]/20 bg-white px-4 text-[14px] text-[#2C1810] caret-[#B8546A] outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-[#7A6B5D] hover:border-[#8B5E3C]/35 focus:border-[#C47D4E] focus:bg-white focus:shadow-[0_0_0_3px_rgba(196,125,78,0.13)]"
        />
        {suffix && <span className="absolute inset-y-0 right-2 flex items-center">{suffix}</span>}
      </span>
    </label>
  );
}

export function CodeField({ value, onChange, label = "Verification code" }: { value: string; onChange: (value: string) => void; label?: string }) {
  return (
    <AuthField
      id="code"
      label={label}
      value={value}
      onChange={(next) => onChange(next.replace(/\D/g, "").slice(0, 6))}
      autoComplete="one-time-code"
      placeholder="000000"
      inputMode="numeric"
      maxLength={6}
    />
  );
}

export function PasswordVisibilityButton({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="grid h-9 w-9 place-items-center rounded-lg text-[#7A6B5D] transition-colors hover:bg-[#8B5E3C]/[0.07] hover:text-[#2C1810] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#C47D4E]"
      aria-label={visible ? "Hide password" : "Show password"}
    >
      {visible ? <EyeOffIcon /> : <EyeIcon />}
    </button>
  );
}

export function SubmitButton({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <motion.button
      type="submit"
      disabled={busy}
      whileHover={busy ? undefined : { y: -1 }}
      whileTap={busy ? undefined : { scale: 0.985 }}
      className="relative flex h-12 w-full items-center justify-center overflow-hidden rounded-xl bg-[#2C1810] px-5 text-[13px] font-bold text-[#FAF6F0] shadow-[0_14px_34px_-18px_rgba(44,24,16,0.65)] transition-colors hover:bg-[#4A311F] disabled:cursor-wait disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#C47D4E]"
    >
      {busy ? (
        <span className="flex items-center gap-2.5">
          <Spinner />
          Working…
        </span>
      ) : (
        <span className="flex items-center gap-2">
          {children}
          <ArrowIcon />
        </span>
      )}
    </motion.button>
  );
}

export function GoogleButton({ busy, onClick, label }: { busy: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#8B5E3C]/20 bg-white/75 px-4 text-[13px] font-semibold text-[#2C1810] transition-[background-color,border-color,transform] hover:-translate-y-px hover:border-[#8B5E3C]/35 hover:bg-white disabled:cursor-wait disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#C47D4E]"
    >
      <GoogleIcon />
      {label}
    </button>
  );
}

export function Divider() {
  return (
    <div className="my-6 flex items-center gap-3" aria-hidden>
      <span className="h-px flex-1 bg-[#8B5E3C]/15" />
      <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#7A6B5D]">or continue with email</span>
      <span className="h-px flex-1 bg-[#8B5E3C]/15" />
    </div>
  );
}

export function AuthError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      role="alert"
      aria-live="polite"
      className="flex gap-3 rounded-xl bg-[#F5DDE3] px-4 py-3 text-[12px] leading-5 text-[#7E3145] ring-1 ring-inset ring-[#B8546A]/20"
    >
      <ErrorIcon />
      <span>{message}</span>
    </motion.div>
  );
}

export function AuthSuccess({ message }: { message: string }) {
  return (
    <div role="status" className="flex gap-3 rounded-xl bg-[#E3EEE6] px-4 py-3 text-[12px] leading-5 text-[#365A41] ring-1 ring-inset ring-[#5B8C6D]/20">
      <CheckIcon />
      <span>{message}</span>
    </div>
  );
}

export function TextButton({ children, onClick, disabled = false }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md text-[12px] font-semibold text-[#A24159] underline-offset-4 transition-colors hover:text-[#2C1810] hover:underline disabled:cursor-not-allowed disabled:text-[#9F8875] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#C47D4E]"
    >
      {children}
    </button>
  );
}

export function clerkErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "Something went wrong. Please try again.";

  const value = error as {
    message?: string;
    longMessage?: string;
    errors?: Array<{ message?: string; longMessage?: string }>;
  };
  const first = value.errors?.[0];
  return first?.longMessage || first?.message || value.longMessage || value.message || "Something went wrong. Please try again.";
}

export function PasswordStrength({ password }: { password: string }) {
  const score = password
    ? Math.min(
        4,
        Number(password.length >= 8)
          + Number(password.length >= 12)
          + Number(/[a-z]/.test(password) && /[A-Z]/.test(password))
          + Number(/\d/.test(password) || /[^A-Za-z0-9]/.test(password)),
      )
    : 0;

  const labels = ["Start with 8+ characters", "Weak", "Fair", "Good", "Strong"];
  const colors = ["bg-[#E5D8CB]", "bg-[#B8546A]", "bg-[#C47D4E]", "bg-[#C49A3B]", "bg-[#5B8C6D]"];
  const hints = [
    "A longer passphrase is easier to remember and harder to guess.",
    "Add more length and mix letter cases.",
    "Add a number or symbol, or make it longer.",
    "Good—twelve or more characters will make it stronger.",
    "Strong password.",
  ];

  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex items-center justify-between gap-4 text-[11px]">
        <span className="font-semibold text-[#4A311F]">Password strength</span>
        <span className="font-semibold text-[#7A6B5D]">{labels[score]}</span>
      </div>
      <div
        role="meter"
        aria-label="Password strength"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={score}
        aria-valuetext={labels[score]}
        className="grid grid-cols-4 gap-1.5"
      >
        {[1, 2, 3, 4].map((level) => (
          <motion.span
            key={level}
            aria-hidden
            className={`h-1.5 rounded-full ${level <= score ? colors[score] : colors[0]}`}
            initial={false}
            animate={{ scaleX: level <= score ? 1 : 0.94, opacity: level <= score ? 1 : 0.7 }}
            transition={{ duration: 0.18 }}
          />
        ))}
      </div>
      <p className="text-[10.5px] leading-4 text-[#7A6B5D]">{hints[score]}</p>
    </div>
  );
}

function Spinner() {
  return <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-[#FAF6F0]/30 border-t-[#FAF6F0]" />;
}

function ArrowIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      <path d="M2.5 7.5h9m-3.5-3.5 3.5 3.5L8 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden>
      <path d="M1.8 8.5s2.45-4.15 6.7-4.15 6.7 4.15 6.7 4.15-2.45 4.15-6.7 4.15S1.8 8.5 1.8 8.5Z" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8.5" cy="8.5" r="2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden>
      <path d="m2.2 2.2 12.6 12.6M6.6 4.6a7.1 7.1 0 0 1 1.9-.25c4.25 0 6.7 4.15 6.7 4.15a11.3 11.3 0 0 1-2 2.35M10.7 12.3a7.2 7.2 0 0 1-2.2.35C4.25 12.65 1.8 8.5 1.8 8.5a11 11 0 0 1 2-2.35" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M16.7 9.2c0-.55-.05-1.08-.14-1.6H9v3.03h4.32a3.7 3.7 0 0 1-1.6 2.43v2h2.59c1.51-1.4 2.39-3.45 2.39-5.86Z" fill="#4285F4" />
      <path d="M9 17c2.16 0 3.97-.72 5.3-1.94l-2.58-2A4.8 4.8 0 0 1 4.58 10.5H1.91v2.06A8 8 0 0 0 9 17Z" fill="#34A853" />
      <path d="M4.58 10.5A4.8 4.8 0 0 1 4.33 9c0-.52.09-1.03.25-1.5V5.44H1.91A8 8 0 0 0 1 9c0 1.29.31 2.51.91 3.56l2.67-2.06Z" fill="#FBBC05" />
      <path d="M9 4.18c1.18 0 2.23.4 3.06 1.2l2.3-2.3A7.72 7.72 0 0 0 9 1a8 8 0 0 0-7.09 4.44L4.58 7.5A4.77 4.77 0 0 1 9 4.18Z" fill="#EA4335" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 4.7v3.8m0 2.3v.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.3" />
      <path d="m4.9 8.1 2 2 4.4-4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
