export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      access_roles: {
        Row: {
          created_at: string
          description: string
          id: string
          name: string
          permissions: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          name: string
          permissions?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          name?: string
          permissions?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      automation_executions: {
        Row: {
          created_at: string
          detail: string
          id: string
          status: string
          workflow_id: string
        }
        Insert: {
          created_at?: string
          detail?: string
          id?: string
          status: string
          workflow_id: string
        }
        Update: {
          created_at?: string
          detail?: string
          id?: string
          status?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_executions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "automation_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_workflows: {
        Row: {
          actions: Json
          conditions: Json
          created_at: string
          created_by: string | null
          description: string
          id: string
          is_default: boolean
          name: string
          status: string
          trigger: string
          updated_at: string
        }
        Insert: {
          actions?: Json
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          is_default?: boolean
          name: string
          status?: string
          trigger: string
          updated_at?: string
        }
        Update: {
          actions?: Json
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          is_default?: boolean
          name?: string
          status?: string
          trigger?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      chat_stars: {
        Row: {
          peer_id: string
          user_id: string
        }
        Insert: {
          peer_id: string
          user_id?: string
        }
        Update: {
          peer_id?: string
          user_id?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          address: string
          city: string
          contact_person: string
          country: string
          created_at: string
          email: string
          id: string
          industry: string
          is_active: boolean
          location: string
          name: string
          notes: string
          phone: string
          state: string
          website: string
        }
        Insert: {
          address?: string
          city?: string
          contact_person?: string
          country?: string
          created_at?: string
          email?: string
          id?: string
          industry?: string
          is_active?: boolean
          location?: string
          name: string
          notes?: string
          phone?: string
          state?: string
          website?: string
        }
        Update: {
          address?: string
          city?: string
          contact_person?: string
          country?: string
          created_at?: string
          email?: string
          id?: string
          industry?: string
          is_active?: boolean
          location?: string
          name?: string
          notes?: string
          phone?: string
          state?: string
          website?: string
        }
        Relationships: []
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_submissions: {
        Row: {
          company: string
          created_at: string
          email: string
          id: string
          message: string
          name: string
          phone: string
        }
        Insert: {
          company: string
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          phone: string
        }
        Update: {
          company?: string
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          phone?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          city: string
          company_id: string | null
          country: string
          created_at: string
          created_by: string | null
          email: string
          id: string
          is_active: boolean
          job_title: string
          location: string
          name: string
          notes: string
          phone: string
          state: string
          updated_at: string
        }
        Insert: {
          city?: string
          company_id?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          is_active?: boolean
          job_title?: string
          location?: string
          name: string
          notes?: string
          phone?: string
          state?: string
          updated_at?: string
        }
        Update: {
          city?: string
          company_id?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          is_active?: boolean
          job_title?: string
          location?: string
          name?: string
          notes?: string
          phone?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          id: string
          invoice_id: string
          issue_date: string
          notes: string
          number: string
          reason: string
          status: string
          tax_adjustment: number
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string
          id?: string
          invoice_id: string
          issue_date: string
          notes?: string
          number: string
          reason: string
          status?: string
          tax_adjustment?: number
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          id?: string
          invoice_id?: string
          issue_date?: string
          notes?: string
          number?: string
          reason?: string
          status?: string
          tax_adjustment?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_list_views: {
        Row: {
          columns: Json
          module: string
          updated_at: string
        }
        Insert: {
          columns?: Json
          module: string
          updated_at?: string
        }
        Update: {
          columns?: Json
          module?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_options: {
        Row: {
          category: string
          color: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          position: number
        }
        Insert: {
          category: string
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          position?: number
        }
        Update: {
          category?: string
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          position?: number
        }
        Relationships: []
      }
      crm_pipelines: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          kind: string
          name: string
          position: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          kind?: string
          name: string
          position?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          kind?: string
          name?: string
          position?: number
        }
        Relationships: []
      }
      crm_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          is_active: boolean
          kind: string
          name: string
          pipeline_id: string
          position: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          kind: string
          name: string
          pipeline_id: string
          position?: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          pipeline_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_forms: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          description: string
          fields: Json
          id: string
          is_active: boolean
          is_system: boolean
          module: string
          name: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          fields?: Json
          id?: string
          is_active?: boolean
          is_system?: boolean
          module?: string
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          fields?: Json
          id?: string
          is_active?: boolean
          is_system?: boolean
          module?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_forms_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          amount: number
          assigned_to: string | null
          company_id: string | null
          contract_type_id: string | null
          created_at: string
          created_by: string | null
          expected_close_date: string | null
          id: string
          lead_id: string | null
          pipeline_id: string | null
          stage_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          amount?: number
          assigned_to?: string | null
          company_id?: string | null
          contract_type_id?: string | null
          created_at?: string
          created_by?: string | null
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          pipeline_id?: string | null
          stage_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          assigned_to?: string | null
          company_id?: string | null
          contract_type_id?: string | null
          created_at?: string
          created_by?: string | null
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          pipeline_id?: string | null
          stage_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contract_type_id_fkey"
            columns: ["contract_type_id"]
            isOneToOne: false
            referencedRelation: "crm_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_audit_logs: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          detail: Json
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string
          created_at?: string
          detail?: Json
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          detail?: Json
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      hr_access_audit: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          employee_id: string
          id: string
          note: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          employee_id: string
          id?: string
          note?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_access_audit_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_branches: {
        Row: {
          city: string
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          city?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          city?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      hr_departments: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      hr_designations: {
        Row: {
          created_at: string
          department_id: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_designations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "hr_departments"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_employees: {
        Row: {
          access_status: string
          branch_id: string | null
          created_at: string
          department_id: string | null
          designation_id: string | null
          employee_code: string | null
          employment_type: string
          id: string
          is_active: boolean
          joining_date: string | null
          phone: string
          profile_id: string
          reporting_manager_id: string | null
          updated_at: string
        }
        Insert: {
          access_status?: string
          branch_id?: string | null
          created_at?: string
          department_id?: string | null
          designation_id?: string | null
          employee_code?: string | null
          employment_type?: string
          id?: string
          is_active?: boolean
          joining_date?: string | null
          phone?: string
          profile_id: string
          reporting_manager_id?: string | null
          updated_at?: string
        }
        Update: {
          access_status?: string
          branch_id?: string | null
          created_at?: string
          department_id?: string | null
          designation_id?: string | null
          employee_code?: string | null
          employment_type?: string
          id?: string
          is_active?: boolean
          joining_date?: string | null
          phone?: string
          profile_id?: string
          reporting_manager_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_employees_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hr_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "hr_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_employees_designation_id_fkey"
            columns: ["designation_id"]
            isOneToOne: false
            referencedRelation: "hr_designations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_employees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_employees_reporting_manager_id_fkey"
            columns: ["reporting_manager_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_settings: {
        Row: {
          config: Json
          key: string
          status: string
          updated_at: string
        }
        Insert: {
          config?: Json
          key: string
          status?: string
          updated_at?: string
        }
        Update: {
          config?: Json
          key?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          billing_details: Json
          created_at: string
          created_by: string
          customer_id: string
          discount_total: number
          due_date: string
          id: string
          issue_date: string
          items: Json
          kind: string
          notes: string
          number: string
          payment_terms: string
          seller_details: Json
          status: string
          subtotal: number
          tax_mode: string
          tax_total: number
          total: number
          updated_at: string
        }
        Insert: {
          billing_details?: Json
          created_at?: string
          created_by?: string
          customer_id: string
          discount_total?: number
          due_date: string
          id?: string
          issue_date: string
          items?: Json
          kind: string
          notes?: string
          number: string
          payment_terms?: string
          seller_details?: Json
          status?: string
          subtotal?: number
          tax_mode?: string
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Update: {
          billing_details?: Json
          created_at?: string
          created_by?: string
          customer_id?: string
          discount_total?: number
          due_date?: string
          id?: string
          issue_date?: string
          items?: Json
          kind?: string
          notes?: string
          number?: string
          payment_terms?: string
          seller_details?: Json
          status?: string
          subtotal?: number
          tax_mode?: string
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "sales_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activities: {
        Row: {
          actor_id: string | null
          created_at: string
          detail: string
          id: string
          lead_id: string
          type: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          detail?: string
          id?: string
          lead_id: string
          type: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          detail?: string
          id?: string
          lead_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          business_category: string
          business_name: string
          company_id: string | null
          created_at: string
          created_by: string | null
          customer_name: string
          email: string
          form_answers: Json
          form_id: string | null
          id: string
          interest_level: string
          meta_account_id: string | null
          meta_ad_id: string | null
          meta_ad_name: string | null
          meta_adset_id: string | null
          meta_campaign_id: string | null
          meta_campaign_name: string | null
          meta_form_id: string | null
          meta_lead_id: string | null
          meta_page_id: string | null
          phone: string
          pipeline_id: string | null
          region: string
          requirements: string
          source_id: string | null
          stage_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          business_category?: string
          business_name?: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string
          email?: string
          form_answers?: Json
          form_id?: string | null
          id?: string
          interest_level?: string
          meta_account_id?: string | null
          meta_ad_id?: string | null
          meta_ad_name?: string | null
          meta_adset_id?: string | null
          meta_campaign_id?: string | null
          meta_campaign_name?: string | null
          meta_form_id?: string | null
          meta_lead_id?: string | null
          meta_page_id?: string | null
          phone?: string
          pipeline_id?: string | null
          region?: string
          requirements?: string
          source_id?: string | null
          stage_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          business_category?: string
          business_name?: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string
          email?: string
          form_answers?: Json
          form_id?: string | null
          id?: string
          interest_level?: string
          meta_account_id?: string | null
          meta_ad_id?: string | null
          meta_ad_name?: string | null
          meta_adset_id?: string | null
          meta_campaign_id?: string | null
          meta_campaign_name?: string | null
          meta_form_id?: string | null
          meta_lead_id?: string | null
          meta_page_id?: string | null
          phone?: string
          pipeline_id?: string | null
          region?: string
          requirements?: string
          source_id?: string | null
          stage_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "crm_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      mail_messages: {
        Row: {
          body: string
          cc: string
          created_at: string
          delivery_status: string
          folder: string
          from_email: string
          id: string
          important: boolean
          is_read: boolean
          owner_id: string
          previous_folder: string | null
          scheduled_at: string | null
          starred: boolean
          subject: string
          to_emails: string
          updated_at: string
        }
        Insert: {
          body?: string
          cc?: string
          created_at?: string
          delivery_status?: string
          folder?: string
          from_email?: string
          id?: string
          important?: boolean
          is_read?: boolean
          owner_id?: string
          previous_folder?: string | null
          scheduled_at?: string | null
          starred?: boolean
          subject?: string
          to_emails?: string
          updated_at?: string
        }
        Update: {
          body?: string
          cc?: string
          created_at?: string
          delivery_status?: string
          folder?: string
          from_email?: string
          id?: string
          important?: boolean
          is_read?: boolean
          owner_id?: string
          previous_folder?: string | null
          scheduled_at?: string | null
          starred?: boolean
          subject?: string
          to_emails?: string
          updated_at?: string
        }
        Relationships: []
      }
      mailbox_secrets: {
        Row: {
          owner_id: string
          password: string
          updated_at: string
        }
        Insert: {
          owner_id: string
          password: string
          updated_at?: string
        }
        Update: {
          owner_id?: string
          password?: string
          updated_at?: string
        }
        Relationships: []
      }
      mailbox_settings: {
        Row: {
          from_email: string
          from_name: string
          has_password: boolean
          imap_host: string
          imap_port: number
          owner_id: string
          smtp_host: string
          smtp_port: number
          smtp_secure: boolean
          updated_at: string
          username: string
        }
        Insert: {
          from_email?: string
          from_name?: string
          has_password?: boolean
          imap_host?: string
          imap_port?: number
          owner_id?: string
          smtp_host?: string
          smtp_port?: number
          smtp_secure?: boolean
          updated_at?: string
          username?: string
        }
        Update: {
          from_email?: string
          from_name?: string
          has_password?: boolean
          imap_host?: string
          imap_port?: number
          owner_id?: string
          smtp_host?: string
          smtp_port?: number
          smtp_secure?: boolean
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          authorized_by: string
          created_at: string
          id: string
          invoice_id: string
          method: string
          notes: string
          payment_date: string
          reference: string
        }
        Insert: {
          amount: number
          authorized_by?: string
          created_at?: string
          id?: string
          invoice_id: string
          method: string
          notes?: string
          payment_date: string
          reference: string
        }
        Update: {
          amount?: number
          authorized_by?: string
          created_at?: string
          id?: string
          invoice_id?: string
          method?: string
          notes?: string
          payment_date?: string
          reference?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      products_services: {
        Row: {
          billing_frequency: string
          category_id: string | null
          code: string
          cost_price: number | null
          created_at: string
          created_by: string
          description: string
          id: string
          image_path: string | null
          is_active: boolean
          kind: string
          name: string
          selling_price: number
          service_duration: string
          stock_quantity: number
          tax_rate: number
          updated_at: string
        }
        Insert: {
          billing_frequency?: string
          category_id?: string | null
          code?: string
          cost_price?: number | null
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          image_path?: string | null
          is_active?: boolean
          kind?: string
          name: string
          selling_price?: number
          service_duration?: string
          stock_quantity?: number
          tax_rate?: number
          updated_at?: string
        }
        Update: {
          billing_frequency?: string
          category_id?: string | null
          code?: string
          cost_price?: number | null
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          image_path?: string | null
          is_active?: boolean
          kind?: string
          name?: string
          selling_price?: number
          service_duration?: string
          stock_quantity?: number
          tax_rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "crm_options"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"]
          avatar_url: string | null
          company_name: string
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string
          updated_at: string
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"]
          avatar_url?: string | null
          company_name?: string
          created_at?: string
          email?: string
          full_name?: string
          id: string
          phone?: string
          updated_at?: string
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"]
          avatar_url?: string | null
          company_name?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      revenue_entries: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string
          customer_id: string
          description: string
          entry_date: string
          id: string
          invoice_id: string | null
          method: string
          notes: string
          reference: string
          status: string
          title: string
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          created_by?: string
          customer_id: string
          description?: string
          entry_date: string
          id?: string
          invoice_id?: string | null
          method: string
          notes?: string
          reference: string
          status?: string
          title: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string
          customer_id?: string
          description?: string
          entry_date?: string
          id?: string
          invoice_id?: string | null
          method?: string
          notes?: string
          reference?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_entries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "sales_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_entries_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_customers: {
        Row: {
          address: string
          city: string
          company_name: string
          country: string
          created_at: string
          created_by: string
          customer_number: number
          email: string
          gstin: string
          id: string
          is_active: boolean
          kind: string
          lead_id: string | null
          name: string
          notes: string
          phone: string
          postal_code: string
          state: string
          updated_at: string
        }
        Insert: {
          address?: string
          city?: string
          company_name?: string
          country?: string
          created_at?: string
          created_by?: string
          customer_number?: never
          email?: string
          gstin?: string
          id?: string
          is_active?: boolean
          kind?: string
          lead_id?: string | null
          name: string
          notes?: string
          phone?: string
          postal_code?: string
          state?: string
          updated_at?: string
        }
        Update: {
          address?: string
          city?: string
          company_name?: string
          country?: string
          created_at?: string
          created_by?: string
          customer_number?: never
          email?: string
          gstin?: string
          id?: string
          is_active?: boolean
          kind?: string
          lead_id?: string | null
          name?: string
          notes?: string
          phone?: string
          postal_code?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_customers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_settings: {
        Row: {
          address: string
          company_name: string
          country: string
          email: string
          gstin: string
          id: boolean
          phone: string
          state: string
        }
        Insert: {
          address?: string
          company_name?: string
          country?: string
          email?: string
          gstin?: string
          id?: boolean
          phone?: string
          state?: string
        }
        Update: {
          address?: string
          company_name?: string
          country?: string
          email?: string
          gstin?: string
          id?: boolean
          phone?: string
          state?: string
        }
        Relationships: []
      }
      user_access_roles: {
        Row: {
          created_at: string
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_access_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "access_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_access_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wa_broadcast_recipients: {
        Row: {
          broadcast_id: string
          created_at: string
          error: string | null
          id: string
          name: string
          phone: string
          source: string
          source_id: string | null
          status: string
          wa_message_id: string | null
        }
        Insert: {
          broadcast_id: string
          created_at?: string
          error?: string | null
          id?: string
          name?: string
          phone: string
          source?: string
          source_id?: string | null
          status?: string
          wa_message_id?: string | null
        }
        Update: {
          broadcast_id?: string
          created_at?: string
          error?: string | null
          id?: string
          name?: string
          phone?: string
          source?: string
          source_id?: string | null
          status?: string
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wa_broadcast_recipients_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "wa_broadcasts"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_broadcasts: {
        Row: {
          audience: Json
          created_at: string
          created_by: string | null
          delivered_count: number
          event_trigger: string | null
          failed_count: number
          id: string
          kind: string
          name: string
          read_count: number
          recipients_count: number
          scheduled_at: string | null
          sent_count: number
          status: string
          template_id: string | null
          template_params: Json
          updated_at: string
        }
        Insert: {
          audience?: Json
          created_at?: string
          created_by?: string | null
          delivered_count?: number
          event_trigger?: string | null
          failed_count?: number
          id?: string
          kind?: string
          name: string
          read_count?: number
          recipients_count?: number
          scheduled_at?: string | null
          sent_count?: number
          status?: string
          template_id?: string | null
          template_params?: Json
          updated_at?: string
        }
        Update: {
          audience?: Json
          created_at?: string
          created_by?: string | null
          delivered_count?: number
          event_trigger?: string | null
          failed_count?: number
          id?: string
          kind?: string
          name?: string
          read_count?: number
          recipients_count?: number
          scheduled_at?: string | null
          sent_count?: number
          status?: string
          template_id?: string | null
          template_params?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_broadcasts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_suppression: {
        Row: {
          created_at: string
          id: string
          phone: string
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          phone: string
          reason?: string
        }
        Update: {
          created_at?: string
          id?: string
          phone?: string
          reason?: string
        }
        Relationships: []
      }
      wa_workflows: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          id: string
          name: string
          nodes: Json
          status: string
          trigger: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          name: string
          nodes?: Json
          status?: string
          trigger: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          name?: string
          nodes?: Json
          status?: string
          trigger?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          contact_name: string
          created_at: string
          id: string
          last_inbound_at: string | null
          last_message_at: string | null
          lead_id: string | null
          unread_count: number
          wa_phone: string
        }
        Insert: {
          contact_name?: string
          created_at?: string
          id?: string
          last_inbound_at?: string | null
          last_message_at?: string | null
          lead_id?: string | null
          unread_count?: number
          wa_phone: string
        }
        Update: {
          contact_name?: string
          created_at?: string
          id?: string
          last_inbound_at?: string | null
          last_message_at?: string | null
          lead_id?: string | null
          unread_count?: number
          wa_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          body: string
          broadcast_id: string | null
          conversation_id: string
          created_at: string
          delivered_at: string | null
          direction: string
          failure_reason: string | null
          id: string
          read_at: string | null
          sent_at: string | null
          status: string
          template_name: string | null
          wa_message_id: string | null
        }
        Insert: {
          body?: string
          broadcast_id?: string | null
          conversation_id: string
          created_at?: string
          delivered_at?: string | null
          direction: string
          failure_reason?: string | null
          id?: string
          read_at?: string | null
          sent_at?: string | null
          status?: string
          template_name?: string | null
          wa_message_id?: string | null
        }
        Update: {
          body?: string
          broadcast_id?: string | null
          conversation_id?: string
          created_at?: string
          delivered_at?: string | null
          direction?: string
          failure_reason?: string | null
          id?: string
          read_at?: string | null
          sent_at?: string | null
          status?: string
          template_name?: string | null
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "wa_broadcasts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          body: string
          buttons: Json
          category: string
          created_at: string
          footer: string
          header: string
          id: string
          language: string
          name: string
          status: string
          sync_status: string
          updated_at: string
        }
        Insert: {
          body: string
          buttons?: Json
          category: string
          created_at?: string
          footer?: string
          header?: string
          id?: string
          language?: string
          name: string
          status?: string
          sync_status?: string
          updated_at?: string
        }
        Update: {
          body?: string
          buttons?: Json
          category?: string
          created_at?: string
          footer?: string
          header?: string
          id?: string
          language?: string
          name?: string
          status?: string
          sync_status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_chat_with: { Args: { _other: string }; Returns: boolean }
      can_manage_sales: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hr_set_access: {
        Args: { _decision: string; _employee: string; _note?: string }
        Returns: undefined
      }
      is_company_member: {
        Args: { _company: string; _user: string }
        Returns: boolean
      }
      sales_financial_action: {
        Args: { action: string; payload: Json }
        Returns: string
      }
    }
    Enums: {
      account_status: "pending" | "active" | "blocked"
      app_role: "super_admin" | "manager" | "employee" | "client"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_status: ["pending", "active", "blocked"],
      app_role: ["super_admin", "manager", "employee", "client"],
    },
  },
} as const
