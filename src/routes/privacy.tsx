import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Shield } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy · Pinboard" },
      {
        name: "description",
        content: "Privacy Policy for Pinboard task planning and whiteboard application.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
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
            <Shield className="size-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Last updated: October 18, 2026</p>
          </div>
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">1. Overview</h2>
            <p>
              Pinboard ("we", "our", or "us") provides a personal task planning, daily
              time-blocking, and monthly goal tracking whiteboard application. We respect your
              personal privacy and are committed to protecting the data you store within your
              account.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">2. Information We Collect</h2>
            <p>We collect only the information necessary to provide and operate the service:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong className="text-foreground">Account Information:</strong> Your email address
                and authentication credentials when creating an account.
              </li>
              <li>
                <strong className="text-foreground">Task & Goal Content:</strong> Task titles,
                descriptions, due dates, categories, notes, board positions, and monthly progress
                values entered into your boards.
              </li>
              <li>
                <strong className="text-foreground">Usage Preferences:</strong> Theme settings,
                working hour ranges, and board layout preferences.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">
              3. How Your Information is Used
            </h2>
            <p>
              Your data is used solely to store, organize, synchronize, and display your personal
              tasks, schedules, and goals across your devices. We do not sell your personal data or
              your task content to third parties, data brokers, or advertisers.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">
              4. Data Storage and Security
            </h2>
            <p>
              Your account data is secured using industry-standard encryption in transit (HTTPS /
              TLS) and at rest. Access to task data is strictly authenticated and scoped to your
              user ID using PostgreSQL Row-Level Security (RLS) policies.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">
              5. Your Rights & Data Deletion
            </h2>
            <p>
              You maintain full ownership of your tasks and notes. You may delete individual tasks,
              notes, goals, or your entire account at any time. Upon account deletion, all
              associated data is permanently purged from our active databases.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">6. Contact</h2>
            <p>
              If you have any questions or concerns regarding this privacy policy or your personal
              data, please contact our support team at support@pinboard.app.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
