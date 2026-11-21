"use client";

import { AlertCircleIcon, Loader2Icon, MusicIcon } from "lucide-react";
import { useActionState } from "react";
import { login, type LoginState } from "@/actions/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="items-center text-center">
        <span className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <MusicIcon className="size-5" />
        </span>
        <CardTitle className="text-xl">TikTok Data</CardTitle>
        <CardDescription>Đăng nhập để tra cứu creator, sản phẩm và video.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="username">Tên đăng nhập</Label>
            <Input id="username" name="username" autoComplete="username" required autoFocus className="h-9" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Mật khẩu</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required className="h-9" />
          </div>
          {state.error ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" size="lg" disabled={pending} className="w-full">
            {pending ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : null}
            {pending ? "Đang đăng nhập..." : "Đăng nhập"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
