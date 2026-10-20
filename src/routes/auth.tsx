import { useState, useEffect } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { StickyNote, Loader2, AlertCircle, CheckCircle2, Mail, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) {
      throw redirect({ to: "/board" });
    }
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      throw redirect({ to: "/board" });
    }
  },
  head: () => ({ meta: [{ title: "Sign In · Pinboard" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [viewMode, setViewMode] = useState<"auth" | "forgot_password" | "update_password">("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Detect recovery links from Supabase password reset email
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      const search = window.location.search;
      if (hash.includes("type=recovery") || search.includes("mode=update_password") || search.includes("reset=true")) {
        setViewMode("update_password");
      }
    }
  }, []);

  function resetFeedback() {
    setErrorMessage(null);
    setSuccessMessage(null);
    setNeedsConfirmation(false);
  }

  async function handleResetPasswordRequest(e: React.FormEvent) {
    e.preventDefault();
    resetFeedback();

    if (!email) {
      setErrorMessage("Please enter your registered email address.");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth?mode=update_password`,
      });

      if (error) {
        setErrorMessage(error.message);
        toast.error(error.message);
        return;
      }

      setSuccessMessage(
        `A password reset link has been sent to ${email.trim()}. Please check your inbox (and spam folder).`
      );
      toast.success("Password reset email sent! Check your inbox.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send reset email";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdateNewPassword(e: React.FormEvent) {
    e.preventDefault();
    resetFeedback();

    if (!newPassword || newPassword.length < 6) {
      setErrorMessage("New password must be at least 6 characters long.");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setErrorMessage(error.message);
        toast.error(error.message);
        return;
      }

      toast.success("Password updated successfully! Redirecting...");
      navigate({ to: "/board", replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update password";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    resetFeedback();

    if (!email || !password) {
      setErrorMessage("Please enter both your email and password.");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        if (error.message.toLowerCase().includes("email not confirmed")) {
          setNeedsConfirmation(true);
          setErrorMessage(
            "Your email has not been confirmed yet. Please check your inbox and click the confirmation link, or resend it below.",
          );
        } else if (error.message.toLowerCase().includes("invalid login credentials")) {
          setErrorMessage(
            "Invalid email or password. If you haven't created an account yet, please use the Sign Up tab.",
          );
        } else {
          setErrorMessage(error.message);
        }
        toast.error(error.message);
        return;
      }

      if (data.session) {
        toast.success("Welcome back!");
        navigate({ to: "/board", replace: true });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to sign in";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleEmailSignUp(e: React.FormEvent) {
    e.preventDefault();
    resetFeedback();

    if (!email || !password) {
      setErrorMessage("Please enter both your email and password.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          ...(typeof window !== "undefined"
            ? { emailRedirectTo: `${window.location.origin}/board` }
            : {}),
        },
      });

      if (error) {
        setErrorMessage(error.message);
        toast.error(error.message);
        return;
      }

      if (data.session) {
        toast.success("Account created! Redirecting to board...");
        navigate({ to: "/board", replace: true });
      } else {
        setSuccessMessage(
          `Confirmation email sent to ${email.trim()}! Please check your inbox (and spam folder) to verify your account, then sign in.`,
        );
        setNeedsConfirmation(true);
        toast.info("Please check your email to confirm your account before signing in.", {
          duration: 6000,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create account";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResendConfirmation() {
    if (!email) {
      setErrorMessage("Please enter your email above to resend confirmation.");
      return;
    }
    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: {
          ...(typeof window !== "undefined"
            ? { emailRedirectTo: `${window.location.origin}/board` }
            : {}),
        },
      });
      if (error) {
        toast.error(error.message);
        setErrorMessage(error.message);
      } else {
        toast.success("Confirmation email resent! Please check your inbox.");
        setSuccessMessage(`Confirmation email resent to ${email.trim()}.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to resend confirmation email";
      toast.error(msg);
    } finally {
      setIsResending(false);
    }
  }

  return (
    <div className="whiteboard flex min-h-screen items-center justify-center p-4">
      <div className="note-fold relative w-full max-w-md rounded-md bg-card p-6 pt-8 shadow-note-lift md:p-8 md:pt-10">
        <span className="absolute left-1/2 top-2.5 size-4 -translate-x-1/2 rounded-full bg-pin shadow-note" />

        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-2 grid size-12 -rotate-6 place-items-center rounded-lg bg-note-yellow shadow-note">
            <StickyNote className="size-7 text-ink" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Pinboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your tactile whiteboard for tasks and goals
          </p>
        </div>

        {errorMessage && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="size-4" />
            <AlertTitle>Sign-in Issue</AlertTitle>
            <AlertDescription className="text-xs leading-relaxed">{errorMessage}</AlertDescription>
          </Alert>
        )}

        {successMessage && (
          <Alert className="mb-4 border-emerald-500/50 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200">
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
            <AlertTitle>Check Your Email</AlertTitle>
            <AlertDescription className="text-xs leading-relaxed">
              {successMessage}
            </AlertDescription>
          </Alert>
        )}

        {needsConfirmation && (
          <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-medium">
                <Mail className="size-3.5" />
                Didn't receive the email?
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={handleResendConfirmation}
                disabled={isResending}
              >
                {isResending ? <Loader2 className="size-3 animate-spin" /> : "Resend"}
              </Button>
            </div>
          </div>
        )}

        {viewMode === "forgot_password" ? (
          <div className="space-y-4 mt-2">
            <div className="space-y-1 text-center">
              <h2 className="text-lg font-bold">Reset Your Password</h2>
              <p className="text-xs text-muted-foreground">
                Enter your account email and we'll send you a link to choose a new password.
              </p>
            </div>
            <form onSubmit={handleResetPasswordRequest} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="reset-email">Email address</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="email"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="size-4 animate-spin" /> : "Send Password Reset Link"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-xs"
                onClick={() => {
                  resetFeedback();
                  setViewMode("auth");
                }}
              >
                ← Back to Sign In
              </Button>
            </form>
          </div>
        ) : viewMode === "update_password" ? (
          <div className="space-y-4 mt-2">
            <div className="space-y-1 text-center">
              <h2 className="text-lg font-bold">Set New Password</h2>
              <p className="text-xs text-muted-foreground">
                Choose a strong new password for your Pinboard account.
              </p>
            </div>
            <form onSubmit={handleUpdateNewPassword} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="update-password">New Password</Label>
                <Input
                  id="update-password"
                  type="password"
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="size-4 animate-spin" /> : "Save New Password"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-xs"
                onClick={() => {
                  resetFeedback();
                  setViewMode("auth");
                }}
              >
                Cancel
              </Button>
            </form>
          </div>
        ) : (
          <Tabs
            value={tab}
            onValueChange={(v) => {
              resetFeedback();
              setTab(v as "signin" | "signup");
            }}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <div className="mt-5">
              <TabsContent value="signin" className="m-0 space-y-4">
                <form onSubmit={handleEmailSignIn} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="signin-password">Password</Label>
                      <button
                        type="button"
                        onClick={() => {
                          resetFeedback();
                          setViewMode("forgot_password");
                        }}
                        className="text-xs text-primary hover:underline font-medium cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      autoComplete="current-password"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? <Loader2 className="size-4 animate-spin" /> : "Sign In"}
                  </Button>
                </form>
              </TabsContent>

            <TabsContent value="signup" className="m-0 space-y-4">
              <form onSubmit={handleEmailSignUp} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    autoComplete="email"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Use a real email (e.g. Gmail) to receive the activation link.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    autoComplete="new-password"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Avoid common passwords (e.g. 123456) to pass security checks.
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? <Loader2 className="size-4 animate-spin" /> : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </div>
        </Tabs>
        )}

        <div className="mt-6 flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-[11px] text-muted-foreground">
          <Info className="size-4 shrink-0 text-muted-foreground/80 mt-0.5" />
          <span>
            Pinboard uses Supabase Auth with email verification enabled. If you are a new user,
            switch to <strong>Sign Up</strong> first.
          </span>
        </div>

        <footer className="mt-8 flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <a href="/privacy" className="hover:text-foreground transition-colors">
            Privacy Policy
          </a>
          <span>·</span>
          <a href="/terms" className="hover:text-foreground transition-colors">
            Terms and Conditions
          </a>
        </footer>
      </div>
    </div>
  );
}
