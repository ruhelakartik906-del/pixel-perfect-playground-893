// Per-organization feature catalog for the multi-tenant core.
// Keys are stored in org_feature_permissions / plan_features; labels are display-only.

export const FEATURE_KEYS = [
  "leads",
  "contacts",
  "companies",
  "pipeline",
  "deals",
  "tasks",
  "quotations",
  "invoices",
  "payments",
  "products",
  "import_export",
  "analytics",
  "reports",
  "whatsapp",
  "whatsapp_templates",
  "whatsapp_campaigns",
  "chatbots",
  "flows",
  "drip_campaigns",
  "integrations",
  "developer_api",
  "webhooks",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  leads: "Leads Management",
  contacts: "Contacts",
  companies: "Companies",
  pipeline: "Sales Pipeline",
  deals: "Deals",
  tasks: "Tasks & Reminders",
  quotations: "Quotations",
  invoices: "Invoices",
  payments: "Payments",
  products: "Products & Services",
  import_export: "Import / Export",
  analytics: "Analytics",
  reports: "Advanced Reports",
  whatsapp: "WhatsApp Inbox",
  whatsapp_templates: "WhatsApp Templates",
  whatsapp_campaigns: "Bulk Campaigns",
  chatbots: "Chatbot Builder",
  flows: "Flow Builder",
  drip_campaigns: "Drip Campaigns",
  integrations: "Facebook & Meta Integrations",
  developer_api: "Developer API",
  webhooks: "Webhooks",
};

export const LIMIT_KEYS = [
  "max_employees",
  "max_leads",
  "monthly_whatsapp_messages",
  "max_whatsapp_numbers",
  "max_chatbots",
  "max_workflows",
  "max_drip_campaigns",
  "max_api_requests",
  "max_storage_mb",
] as const;

export type LimitKey = (typeof LIMIT_KEYS)[number];

export const LIMIT_LABELS: Record<LimitKey, string> = {
  max_employees: "Maximum employees",
  max_leads: "Maximum leads",
  monthly_whatsapp_messages: "Monthly WhatsApp messages",
  max_whatsapp_numbers: "Connected WhatsApp numbers",
  max_chatbots: "Maximum chatbots",
  max_workflows: "Maximum active workflows",
  max_drip_campaigns: "Maximum drip campaigns",
  max_api_requests: "API requests",
  max_storage_mb: "Storage (MB)",
};

export type OrgLimits = Partial<Record<LimitKey, number | null>>;

export type CustomerRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  contact_person: string;
  is_active: boolean;
  created_at: string;
  status: "active" | "suspended" | "expired";
  plan_id: string | null;
  plan_name: string | null;
  expires_at: string | null;
  employee_count: number;
  admin_name: string;
  admin_email: string;
};

export type CustomerMember = {
  user_id: string;
  full_name: string;
  email: string;
  account_status: string;
  roles: string[];
};

export type CustomerDetail = {
  company: {
    id: string;
    name: string;
    email: string;
    phone: string;
    contact_person: string;
    is_active: boolean;
    created_at: string;
  };
  subscription: {
    status: "active" | "suspended" | "expired";
    plan_id: string | null;
    plan_name: string | null;
    term_months: number;
    starts_at: string;
    expires_at: string | null;
  } | null;
  features: Record<string, boolean>;
  limits: OrgLimits;
  members: CustomerMember[];
};

export type PlanRow = {
  id: string;
  name: string;
  description: string;
  limits: OrgLimits;
  is_active: boolean;
  features: Record<string, boolean>;
};

/** Effective status for a customer row: subscription status wins, legacy companies are active. */
export function customerStatus(
  subscription: { status: string; expires_at: string | null } | null | undefined,
): "active" | "suspended" | "expired" {
  if (!subscription) return "active";
  if (subscription.status === "active" && subscription.expires_at && new Date(subscription.expires_at).getTime() < Date.now()) {
    return "expired";
  }
  return subscription.status as "active" | "suspended" | "expired";
}

/** Days until expiry; null when no expiry is set. */
export function daysUntilExpiry(expiresAt: string | null | undefined): number | null {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
}
