"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type ConfirmSubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  confirmDescription?: string;
  confirmTitle?: string;
};

export function ConfirmSubmitButton({
  children,
  confirmDescription = "이 작업은 되돌릴 수 없습니다. 계속 진행하시겠습니까?",
  confirmTitle = "정말 진행하시겠습니까?",
  onClick,
  type = "submit",
  ...props
}: ConfirmSubmitButtonProps) {
  return (
    <button
      {...props}
      onClick={(event) => {
        const message = `${confirmTitle}\n\n${confirmDescription}`;
        const confirmed = window.confirm(message);

        if (!confirmed) {
          event.preventDefault();
          return;
        }

        onClick?.(event);
      }}
      type={type}
    >
      {children}
    </button>
  );
}
