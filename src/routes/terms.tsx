import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileText } from "lucide-react";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms and Conditions · Pinboard" },
      { name: "description", content: "Terms of Service and Conditions for Pinboard." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-12 md:py-16">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" /> Back to App
          </Link>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="grid size-10 place-items-center rounded-lg bg-muted text-foreground">
            <FileText className="size-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Terms and Conditions</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Last updated: October 18, 2026</p>
          </div>
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Pinboard, you agree to be bound by these Terms and Conditions.
              If you do not agree with any part of these terms, you may not use the service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">
              2. Account Registration and Security
            </h2>
            <p>
              To access board features, you must register using a valid email address. You are
              responsible for safeguarding your account credentials and for any activity that occurs
              under your account. You agree to notify us immediately of any unauthorized access or
              security breach.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">
              3. User Conduct and Content Ownership
            </h2>
            <p>
              You retain full copyright and ownership of all task titles, descriptions, notes, and
              milestones you create. You agree not to use the service for any unlawful, harassing,
              infringing, or malicious activities. We reserve the right to terminate accounts that
              violate system integrity or security policies.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">
              4. Service Availability and Modifications
            </h2>
            <p>
              We strive for high uptime and continuous reliability. However, the service is provided
              on an "as is" and "as available" basis without warranties of any kind. We reserve the
              right to modify or discontinue features with reasonable advance notice whenever
              practical.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">5. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Pinboard and its operators shall not be liable
              for any indirect, incidental, consequential, or punitive damages arising from the use
              or inability to use the service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">6. Contact Information</h2>
            <p>
              For legal inquiries or questions regarding these terms, please contact
              legal@pinboard.app.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
