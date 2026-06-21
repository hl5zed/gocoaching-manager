"use client";

import { useEffect } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";

export default function MyCoachingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[my-coaching]", error);
  }, [error]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>화면을 불러오지 못했습니다</CardTitle>
          <CardDescription>
            일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button type="button" onClick={() => reset()}>
            다시 시도
          </Button>
          <Button type="button" variant="secondary" onClick={() => window.location.assign("/my-coaching")}>
            홈으로
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
