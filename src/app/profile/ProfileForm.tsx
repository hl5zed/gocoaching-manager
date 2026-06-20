"use client";

import { FormEvent, useState } from "react";
import type { SafeProfile } from "@/types/profile";

export type ProfileTranslations = {
  common: {
    save: string;
    cancel: string;
    loading: string;
    error: string;
    language: string;
    timezone: string;
    back: string;
  };
  profile: {
    title: string;
    edit_profile: string;
    display_name: string;
    phone: string;
    email_readonly: string;
    primary_role_readonly: string;
    status_readonly: string;
    preferred_language: string;
    timezone: string;
    save_profile: string;
    profile_saved: string;
    profile_save_failed: string;
    invalid_language: string;
    disallowed_fields: string;
  };
};

type ProfileFormProps = {
  profile: SafeProfile;
  translations: ProfileTranslations;
};

type PatchMeResponse =
  | {
      ok: true;
      profile: SafeProfile;
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        fields?: string[];
      };
    };

function displayValue(value: string | null) {
  return value && value.trim().length > 0 ? value : "-";
}

export function ProfileForm({ profile, translations }: ProfileFormProps) {
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [preferredLanguage, setPreferredLanguage] = useState(
    profile.preferred_language ?? "ko",
  );
  const [timezone, setTimezone] = useState(profile.timezone ?? "Asia/Bangkok");
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setErrorMessage(null);
    setIsSaving(true);

    const response = await fetch("/api/me", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        display_name: displayName,
        phone,
        preferred_language: preferredLanguage,
        timezone,
      }),
    });

    const result = (await response.json()) as PatchMeResponse;
    setIsSaving(false);

    if (!response.ok || !result.ok) {
      setErrorMessage(
        result.ok
          ? translations.profile.profile_save_failed
          : result.error.message || translations.profile.profile_save_failed,
      );
      return;
    }

    setDisplayName(result.profile.display_name ?? "");
    setPhone(result.profile.phone ?? "");
    setPreferredLanguage(result.profile.preferred_language ?? "ko");
    setTimezone(result.profile.timezone ?? "Asia/Bangkok");
    setMessage(translations.profile.profile_saved);
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label
            className="block text-sm font-medium text-ink-base"
            htmlFor="display_name"
          >
            {translations.profile.display_name}
          </label>
          <input
            className="mt-2 w-full rounded-md border border-line-base bg-surface-card px-3 py-2 text-ink-strong outline-none focus:border-brand-600"
            id="display_name"
            onChange={(event) => setDisplayName(event.target.value)}
            type="text"
            value={displayName}
          />
        </div>

        <div>
          <label
            className="block text-sm font-medium text-ink-base"
            htmlFor="email"
          >
            {translations.profile.email_readonly}
          </label>
          <input
            className="mt-2 w-full rounded-md border border-line-base bg-surface-sunken px-3 py-2 text-ink-muted"
            id="email"
            readOnly
            type="email"
            value={profile.email ?? ""}
          />
        </div>

        <div>
          <label
            className="block text-sm font-medium text-ink-base"
            htmlFor="phone"
          >
            {translations.profile.phone}
          </label>
          <input
            className="mt-2 w-full rounded-md border border-line-base bg-surface-card px-3 py-2 text-ink-strong outline-none focus:border-brand-600"
            id="phone"
            onChange={(event) => setPhone(event.target.value)}
            type="tel"
            value={phone}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-base">
            {translations.profile.primary_role_readonly}
          </label>
          <div className="mt-2 rounded-md border border-line-base bg-surface-sunken px-3 py-2 text-ink-muted">
            {displayValue(profile.primary_role)}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-base">
            {translations.profile.status_readonly}
          </label>
          <div className="mt-2 rounded-md border border-line-base bg-surface-sunken px-3 py-2 text-ink-muted">
            {displayValue(profile.status)}
          </div>
        </div>

        <div>
          <label
            className="block text-sm font-medium text-ink-base"
            htmlFor="preferred_language"
          >
            {translations.profile.preferred_language ||
              translations.common.language}
          </label>
          <select
            className="mt-2 w-full rounded-md border border-line-base bg-surface-card px-3 py-2 text-ink-strong outline-none focus:border-brand-600"
            id="preferred_language"
            onChange={(event) => setPreferredLanguage(event.target.value)}
            value={preferredLanguage}
          >
            <option value="ko">ko</option>
            <option value="en">en</option>
            <option value="th">th</option>
          </select>
        </div>

        <div>
          <label
            className="block text-sm font-medium text-ink-base"
            htmlFor="timezone"
          >
            {translations.profile.timezone || translations.common.timezone}
          </label>
          <input
            className="mt-2 w-full rounded-md border border-line-base bg-surface-card px-3 py-2 text-ink-strong outline-none focus:border-brand-600"
            id="timezone"
            onChange={(event) => setTimezone(event.target.value)}
            type="text"
            value={timezone}
          />
        </div>
      </div>

      {message && (
        <p className="rounded-control border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">
          {message}
        </p>
      )}

      {errorMessage && (
        <p className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {errorMessage}
        </p>
      )}

      <button
        className="rounded-control bg-navy-900 px-5 py-2.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isSaving}
        type="submit"
      >
        {isSaving ? `${translations.common.loading}...` : translations.profile.save_profile}
      </button>
    </form>
  );
}
