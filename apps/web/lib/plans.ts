// ─── Plan definitions ─────────────────────────────────────────────────────────

export type PlanId = "basic" | "advanced";

export type AutomationId = "email" | "github" | "slack";

export type AutomationConfig = Record<string, string>;

export type EmployeeRole =
  | "ceo"
  | "cto"
  | "pm"
  | "research"
  | "growth"
  | "sales"
  | "finance"
  | "recruiter";

// ─── Automations (Basic Plan) ─────────────────────────────────────────────────

export interface Automation {
  id: AutomationId;
  name: string;
  description: string;
  icon: string;
  configFields: ConfigField[];
}

export interface ConfigField {
  key: string;
  label: string;
  placeholder: string;
  type: "text" | "email" | "url" | "password" | "select";
  options?: string[];
  required: boolean;
}

export const AUTOMATIONS: Automation[] = [
  {
    id: "email",
    name: "Email Automation",
    description:
      "Auto-send summaries, reports, and agent outputs to any email address after a goal completes.",
    icon: "✉️",
    configFields: [
      {
        key: "recipient",
        label: "Send reports to",
        placeholder: "team@yourcompany.com",
        type: "email",
        required: true,
      },
      {
        key: "subject_prefix",
        label: "Subject prefix",
        placeholder: "[GhostEmployee]",
        type: "text",
        required: false,
      },
      {
        key: "trigger",
        label: "Trigger on",
        placeholder: "",
        type: "select",
        options: ["Goal completed", "Board meeting ended", "Both"],
        required: true,
      },
    ],
  },
  {
    id: "github",
    name: "GitHub Issue Labeling",
    description:
      "Automatically label and triage GitHub issues using AI suggestions from your CTO and PM employees.",
    icon: "🐙",
    configFields: [
      {
        key: "repo_url",
        label: "Repository URL",
        placeholder: "https://github.com/your-org/your-repo",
        type: "url",
        required: true,
      },
      {
        key: "github_token",
        label: "GitHub Personal Access Token",
        placeholder: "ghp_...",
        type: "password",
        required: true,
      },
      {
        key: "label_prefix",
        label: "Label prefix (optional)",
        placeholder: "ghost:",
        type: "text",
        required: false,
      },
    ],
  },
  {
    id: "slack",
    name: "Slack Automation",
    description:
      "Post agent updates, board meeting highlights, and final reports directly to a Slack channel.",
    icon: "💬",
    configFields: [
      {
        key: "webhook_url",
        label: "Slack Webhook URL",
        placeholder: "https://hooks.slack.com/services/...",
        type: "url",
        required: true,
      },
      {
        key: "channel",
        label: "Channel name",
        placeholder: "#ghostemployee",
        type: "text",
        required: true,
      },
      {
        key: "notify_on",
        label: "Notify on",
        placeholder: "",
        type: "select",
        options: ["Every agent update", "Goal completed only", "Board meeting summary only", "All events"],
        required: true,
      },
    ],
  },
];

// ─── Employees (Advanced Plan) ────────────────────────────────────────────────

export interface Employee {
  role: EmployeeRole;
  name: string;
  description: string;
  icon: string;
  specialty: string;
}

export const EMPLOYEES: Employee[] = [
  {
    role: "ceo",
    name: "CEO Ghost",
    description: "Orchestrates the team, breaks down goals into execution plans, and synthesizes final outcomes.",
    icon: "👔",
    specialty: "Strategy & coordination",
  },
  {
    role: "cto",
    name: "CTO Ghost",
    description: "Designs system architecture, recommends tech stacks, and creates database and API plans.",
    icon: "⚙️",
    specialty: "Architecture & engineering",
  },
  {
    role: "pm",
    name: "PM Ghost",
    description: "Writes product requirements, builds roadmaps, and prioritizes features by impact.",
    icon: "🗺️",
    specialty: "Roadmap & requirements",
  },
  {
    role: "research",
    name: "Research Ghost",
    description: "Conducts market analysis, maps competitors, and surfaces data-backed insights.",
    icon: "🔬",
    specialty: "Market intelligence",
  },
  {
    role: "growth",
    name: "Growth Ghost",
    description: "Designs GTM strategy, identifies acquisition channels, and plans launch sequences.",
    icon: "📈",
    specialty: "Acquisition & GTM",
  },
  {
    role: "finance",
    name: "Finance Ghost",
    description: "Models pricing, projects revenue, and calculates unit economics and break-even.",
    icon: "💰",
    specialty: "Pricing & projections",
  },
  {
    role: "sales",
    name: "Sales Ghost",
    description: "Builds lead generation strategies and writes outreach sequences and call scripts.",
    icon: "🤝",
    specialty: "Pipeline & outreach",
  },
  {
    role: "recruiter",
    name: "Recruiter Ghost",
    description: "Defines hiring plans, writes job descriptions, and evaluates team structure.",
    icon: "👥",
    specialty: "Hiring strategy",
  },
];

// ─── Plan definitions ─────────────────────────────────────────────────────────

export interface Plan {
  id: PlanId;
  name: string;
  badge: string;
  tagline: string;
  color: string;
  features: string[];
}

export const PLANS: Plan[] = [
  {
    id: "basic",
    name: "Basic",
    badge: "Free",
    tagline: "3 powerful automations to connect your AI workforce to the tools you already use.",
    color: "#6366F1",
    features: [
      "Email automation — auto-send reports",
      "GitHub issue labeling & suggestions",
      "Slack automation — post to channels",
      "Trigger on goal complete or board meeting",
      "Standalone or project-linked",
    ],
  },
  {
    id: "advanced",
    name: "Advanced",
    badge: "Free",
    tagline: "Hire any combination of 8 specialized AI employees for your workspace.",
    color: "#E94560",
    features: [
      "All 8 AI employee roles available",
      "Pick your team per workspace",
      "Employees collaborate on every goal",
      "Board meeting with your chosen roster",
      "Role-specific outputs per employee",
    ],
  },
];