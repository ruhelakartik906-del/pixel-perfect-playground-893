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
      ad_routing_audit: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          id: string
          rule_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          rule_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          rule_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_routing_audit_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "ad_routing_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_routing_rules: {
        Row: {
          account_id: string
          ad_id: string
          adset_id: string
          campaign_id: string
          campaign_name: string
          company_id: string
          created_at: string
          creative_id: string
          creative_name: string
          id: string
          name: string
          page_id: string
          status: string
          total_leads: number
          updated_at: string
        }
        Insert: {
          account_id: string
          ad_id?: string
          adset_id?: string
          campaign_id?: string
          campaign_name?: string
          company_id: string
          created_at?: string
          creative_id?: string
          creative_name?: string
          id?: string
          name: string
          page_id?: string
          status?: string
          total_leads?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          ad_id?: string
          adset_id?: string
          campaign_id?: string
          campaign_name?: string
          company_id?: string
          created_at?: string
          creative_id?: string
          creative_name?: string
          id?: string
          name?: string
          page_id?: string
          status?: string
          total_leads?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_routing_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_routing_steps: {
        Row: {
          assigned_count: number
          id: string
          position: number
          quota: number | null
          rule_id: string
          user_id: string
        }
        Insert: {
          assigned_count?: number
          id?: string
          position: number
          quota?: number | null
          rule_id: string
          user_id: string
        }
        Update: {
          assigned_count?: number
          id?: string
          position?: number
          quota?: number | null
          rule_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_routing_steps_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "ad_routing_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_routing_steps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      chat_attachments: {
        Row: {
          created_at: string
          filename: string
          id: string
          message_id: string
          mime: string
          path: string
          size: number
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          message_id: string
          mime: string
          path: string
          size: number
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          message_id?: string
          mime?: string
          path?: string
          size?: number
        }
        Relationships: [
          {
            foreignKeyName: "chat_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_group_members: {
        Row: {
          group_id: string
          joined_at: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_groups: {
        Row: {
          company_id: string
          created_at: string
          description: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string
          id?: string
          name: string
          owner_id?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_groups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          body: string
          client_id: string | null
          created_at: string
          group_id: string | null
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          body: string
          client_id?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id?: string
        }
        Update: {
          body?: string
          client_id?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
        ]
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
      crm_work_history: {
        Row: {
          action: string
          actor_id: string
          after_record: Json | null
          before_record: Json | null
          created_at: string
          id: string
          work_id: string
        }
        Insert: {
          action: string
          actor_id: string
          after_record?: Json | null
          before_record?: Json | null
          created_at?: string
          id?: string
          work_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          after_record?: Json | null
          before_record?: Json | null
          created_at?: string
          id?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_work_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_work_history_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "crm_work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_work_items: {
        Row: {
          assigned_to: string
          checklist: Json
          company_id: string
          created_at: string
          created_by: string
          deal_id: string | null
          deleted_at: string | null
          due_date: string | null
          id: string
          interaction_type: string | null
          kind: string
          lead_id: string | null
          notes: string
          priority: string
          scheduled_at: string | null
          start_date: string | null
          status: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          assigned_to: string
          checklist?: Json
          company_id: string
          created_at?: string
          created_by: string
          deal_id?: string | null
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          interaction_type?: string | null
          kind: string
          lead_id?: string | null
          notes?: string
          priority?: string
          scheduled_at?: string | null
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          assigned_to?: string
          checklist?: Json
          company_id?: string
          created_at?: string
          created_by?: string
          deal_id?: string | null
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          interaction_type?: string | null
          kind?: string
          lead_id?: string | null
          notes?: string
          priority?: string
          scheduled_at?: string | null
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_work_items_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_work_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_work_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_work_items_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_work_items_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
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
      deal_activity_history: {
        Row: {
          action: string
          actor_id: string | null
          after_record: Json | null
          before_record: Json | null
          created_at: string
          deal_id: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_record?: Json | null
          before_record?: Json | null
          created_at?: string
          deal_id: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_record?: Json | null
          before_record?: Json | null
          created_at?: string
          deal_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_activity_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          actual_close_date: string | null
          amount: number
          assigned_to: string | null
          company_id: string | null
          contract_type_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          description: string
          expected_close_date: string | null
          final_amount: number | null
          id: string
          lead_id: string | null
          lost_reason: string
          negotiated_amount: number | null
          notes: string
          pipeline_id: string | null
          service_name: string
          stage_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          actual_close_date?: string | null
          amount?: number
          assigned_to?: string | null
          company_id?: string | null
          contract_type_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description?: string
          expected_close_date?: string | null
          final_amount?: number | null
          id?: string
          lead_id?: string | null
          lost_reason?: string
          negotiated_amount?: number | null
          notes?: string
          pipeline_id?: string | null
          service_name?: string
          stage_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          actual_close_date?: string | null
          amount?: number
          assigned_to?: string | null
          company_id?: string | null
          contract_type_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description?: string
          expected_close_date?: string | null
          final_amount?: number | null
          id?: string
          lead_id?: string | null
          lost_reason?: string
          negotiated_amount?: number | null
          notes?: string
          pipeline_id?: string | null
          service_name?: string
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
      hr_announcement_reads: {
        Row: {
          announcement_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          read_at?: string
          user_id?: string
        }
        Update: {
          announcement_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "hr_announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_announcements: {
        Row: {
          branch_id: string | null
          company_id: string
          created_at: string
          created_by: string
          department_id: string | null
          details: Json
          end_date: string | null
          id: string
          kind: string
          start_date: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string
          department_id?: string | null
          details?: Json
          end_date?: string | null
          id?: string
          kind?: string
          start_date: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          department_id?: string | null
          details?: Json
          end_date?: string | null
          id?: string
          kind?: string
          start_date?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_announcements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hr_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_announcements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_announcements_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "hr_departments"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_attendance: {
        Row: {
          attendance_date: string
          check_in: string | null
          check_out: string | null
          company_id: string
          created_at: string
          created_by: string
          employee_id: string
          id: string
          notes: string
          source_leave_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attendance_date: string
          check_in?: string | null
          check_out?: string | null
          company_id: string
          created_at?: string
          created_by?: string
          employee_id: string
          id?: string
          notes?: string
          source_leave_id?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          attendance_date?: string
          check_in?: string | null
          check_out?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          employee_id?: string
          id?: string
          notes?: string
          source_leave_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_attendance_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_attendance_source_leave_id_fkey"
            columns: ["source_leave_id"]
            isOneToOne: false
            referencedRelation: "hr_leave_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_attendance_events: {
        Row: {
          actor_id: string
          attendance_id: string
          company_id: string
          employee_id: string
          event: string
          id: string
          occurred_at: string
          reason: string
        }
        Insert: {
          actor_id?: string
          attendance_id: string
          company_id: string
          employee_id: string
          event: string
          id?: string
          occurred_at?: string
          reason?: string
        }
        Update: {
          actor_id?: string
          attendance_id?: string
          company_id?: string
          employee_id?: string
          event?: string
          id?: string
          occurred_at?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_attendance_events_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "hr_attendance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_attendance_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_attendance_events_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_audit_logs: {
        Row: {
          action: string
          actor_id: string
          after_data: Json | null
          before_data: Json | null
          company_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          reason: string
        }
        Insert: {
          action: string
          actor_id?: string
          after_data?: Json | null
          before_data?: Json | null
          company_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          reason?: string
        }
        Update: {
          action?: string
          actor_id?: string
          after_data?: Json | null
          before_data?: Json | null
          company_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_branches: {
        Row: {
          address: string
          city: string
          code: string
          company_id: string | null
          created_at: string
          email: string
          id: string
          is_active: boolean
          manager_id: string | null
          name: string
          phone: string
          postal_code: string
          state: string
        }
        Insert: {
          address?: string
          city?: string
          code?: string
          company_id?: string | null
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          manager_id?: string | null
          name: string
          phone?: string
          postal_code?: string
          state?: string
        }
        Update: {
          address?: string
          city?: string
          code?: string
          company_id?: string | null
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          manager_id?: string | null
          name?: string
          phone?: string
          postal_code?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_branches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_branches_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_departments: {
        Row: {
          branch_id: string | null
          company_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          branch_id?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          branch_id?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_departments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hr_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_departments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_designations: {
        Row: {
          branch_id: string | null
          company_id: string | null
          created_at: string
          department_id: string | null
          description: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          branch_id?: string | null
          company_id?: string | null
          created_at?: string
          department_id?: string | null
          description?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          branch_id?: string | null
          company_id?: string | null
          created_at?: string
          department_id?: string | null
          description?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_designations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hr_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_designations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_designations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "hr_departments"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_document_versions: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          document_id: string
          filename: string
          id: string
          mime: string
          path: string
          size: number
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string
          document_id: string
          filename: string
          id?: string
          mime: string
          path: string
          size: number
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          document_id?: string
          filename?: string
          id?: string
          mime?: string
          path?: string
          size?: number
        }
        Relationships: [
          {
            foreignKeyName: "hr_document_versions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "hr_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_documents: {
        Row: {
          branch_id: string | null
          company_id: string
          created_at: string
          created_by: string
          department_id: string | null
          details: Json
          end_date: string | null
          id: string
          kind: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string
          department_id?: string | null
          details?: Json
          end_date?: string | null
          id?: string
          kind?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          department_id?: string | null
          details?: Json
          end_date?: string | null
          id?: string
          kind?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_documents_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hr_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_documents_department_id_fkey"
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
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "hr_employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
      hr_holidays: {
        Row: {
          branch_id: string | null
          company_id: string
          created_at: string
          created_by: string
          details: Json
          end_date: string
          id: string
          kind: string
          start_date: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string
          details?: Json
          end_date: string
          id?: string
          kind?: string
          start_date: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          details?: Json
          end_date?: string
          id?: string
          kind?: string
          start_date?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_holidays_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hr_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_holidays_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_leave_balances: {
        Row: {
          company_id: string
          employee_id: string
          entitlement: number
          id: string
          kind: string
          used: number
          year: number
        }
        Insert: {
          company_id: string
          employee_id: string
          entitlement?: number
          id?: string
          kind: string
          used?: number
          year: number
        }
        Update: {
          company_id?: string
          employee_id?: string
          entitlement?: number
          id?: string
          kind?: string
          used?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "hr_leave_balances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_leave_requests: {
        Row: {
          approver_id: string | null
          company_id: string
          created_at: string
          created_by: string
          decided_at: string | null
          details: Json
          employee_id: string
          end_date: string
          half_day: boolean
          id: string
          kind: string
          reason: string
          start_date: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          approver_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string
          decided_at?: string | null
          details?: Json
          employee_id: string
          end_date: string
          half_day?: boolean
          id?: string
          kind: string
          reason: string
          start_date: string
          status?: string
          title?: string
          updated_at?: string
        }
        Update: {
          approver_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          decided_at?: string | null
          details?: Json
          employee_id?: string
          end_date?: string
          half_day?: boolean
          id?: string
          kind?: string
          reason?: string
          start_date?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_leave_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_meetings: {
        Row: {
          branch_id: string | null
          company_id: string
          created_at: string
          created_by: string
          department_id: string | null
          details: Json
          end_at: string
          end_date: string
          id: string
          kind: string
          start_at: string
          start_date: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string
          department_id?: string | null
          details?: Json
          end_at: string
          end_date: string
          id?: string
          kind?: string
          start_at: string
          start_date: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          department_id?: string | null
          details?: Json
          end_at?: string
          end_date?: string
          id?: string
          kind?: string
          start_at?: string
          start_date?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_meetings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hr_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_meetings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_meetings_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "hr_departments"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_payroll: {
        Row: {
          allowances: number
          basic: number
          bonuses: number
          branch_id: string | null
          company_id: string
          created_at: string
          created_by: string
          deductions: number
          employee_id: string
          gross: number | null
          id: string
          net: number | null
          notes: string
          paid_at: string | null
          payment_reference: string
          salary_date: string
          salary_period: string
          status: string
          updated_at: string
        }
        Insert: {
          allowances?: number
          basic: number
          bonuses?: number
          branch_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string
          deductions?: number
          employee_id: string
          gross?: number | null
          id?: string
          net?: number | null
          notes?: string
          paid_at?: string | null
          payment_reference?: string
          salary_date: string
          salary_period: string
          status?: string
          updated_at?: string
        }
        Update: {
          allowances?: number
          basic?: number
          bonuses?: number
          branch_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          deductions?: number
          employee_id?: string
          gross?: number | null
          id?: string
          net?: number | null
          notes?: string
          paid_at?: string | null
          payment_reference?: string
          salary_date?: string
          salary_period?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_payroll_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hr_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_payroll_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_payroll_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_schedules: {
        Row: {
          branch_id: string | null
          company_id: string
          created_at: string
          created_by: string
          details: Json
          end_at: string
          end_date: string
          id: string
          kind: string
          start_at: string
          start_date: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string
          details?: Json
          end_at: string
          end_date: string
          id?: string
          kind?: string
          start_at: string
          start_date: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          details?: Json
          end_at?: string
          end_date?: string
          id?: string
          kind?: string
          start_at?: string
          start_date?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_schedules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hr_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_schedules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
          company_id: string | null
          created_at: string
          created_by: string
          currency: string
          customer_id: string
          deal_id: string | null
          discount_total: number
          due_date: string
          id: string
          issue_date: string
          items: Json
          kind: string
          lead_id: string | null
          notes: string
          number: string
          payment_terms: string
          proposal_id: string | null
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
          company_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          customer_id: string
          deal_id?: string | null
          discount_total?: number
          due_date: string
          id?: string
          issue_date: string
          items?: Json
          kind: string
          lead_id?: string | null
          notes?: string
          number: string
          payment_terms?: string
          proposal_id?: string | null
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
          company_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          customer_id?: string
          deal_id?: string | null
          discount_total?: number
          due_date?: string
          id?: string
          issue_date?: string
          items?: Json
          kind?: string
          lead_id?: string | null
          notes?: string
          number?: string
          payment_terms?: string
          proposal_id?: string | null
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
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "sales_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "sales_proposals"
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
      lead_assignment_events: {
        Row: {
          actor_id: string | null
          assignment_type: string
          company_id: string | null
          created_at: string
          id: string
          lead_id: string
          rule_id: string | null
          snapshot: Json
          status: string
          user_id: string | null
        }
        Insert: {
          actor_id?: string | null
          assignment_type: string
          company_id?: string | null
          created_at?: string
          id?: string
          lead_id: string
          rule_id?: string | null
          snapshot: Json
          status?: string
          user_id?: string | null
        }
        Update: {
          actor_id?: string | null
          assignment_type?: string
          company_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          rule_id?: string | null
          snapshot?: Json
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_assignment_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignment_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignment_events_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "ad_routing_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignment_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_routing_queue: {
        Row: {
          lead_id: string
          reason: string
          updated_at: string
        }
        Insert: {
          lead_id: string
          reason: string
          updated_at?: string
        }
        Update: {
          lead_id?: string
          reason?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_routing_queue_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
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
          meta_creative_id: string | null
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
          meta_creative_id?: string | null
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
          meta_creative_id?: string | null
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
      personal_crm_tasks: {
        Row: {
          checklist: Json
          created_at: string
          deleted_at: string | null
          due_date: string
          id: string
          notes: string
          owner_id: string
          priority: string
          start_date: string
          status: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          checklist?: Json
          created_at?: string
          deleted_at?: string | null
          due_date: string
          id?: string
          notes?: string
          owner_id?: string
          priority?: string
          start_date: string
          status?: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          checklist?: Json
          created_at?: string
          deleted_at?: string | null
          due_date?: string
          id?: string
          notes?: string
          owner_id?: string
          priority?: string
          start_date?: string
          status?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      personal_task_history: {
        Row: {
          action: string
          actor_id: string
          after_record: Json | null
          before_record: Json | null
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          action: string
          actor_id?: string
          after_record?: Json | null
          before_record?: Json | null
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          after_record?: Json | null
          before_record?: Json | null
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_task_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "personal_crm_tasks"
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
          display_name: string
          email: string
          full_name: string
          id: string
          phone: string
          preferences: Json
          updated_at: string
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"]
          avatar_url?: string | null
          company_name?: string
          created_at?: string
          display_name?: string
          email?: string
          full_name?: string
          id: string
          phone?: string
          preferences?: Json
          updated_at?: string
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"]
          avatar_url?: string | null
          company_name?: string
          created_at?: string
          display_name?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string
          preferences?: Json
          updated_at?: string
        }
        Relationships: []
      }
      proposal_events: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          note: string
          proposal_id: string
        }
        Insert: {
          action: string
          actor_id?: string
          created_at?: string
          id?: string
          note?: string
          proposal_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          note?: string
          proposal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_events_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "sales_proposals"
            referencedColumns: ["id"]
          },
        ]
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
      sales_proposals: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          currency: string
          customer_id: string | null
          deal_id: string | null
          discount_total: number
          document: Json
          id: string
          lead_id: string | null
          number: string
          status: string
          subtotal: number
          tax_total: number
          title: string
          total: number
          updated_at: string
          valid_until: string
          version: number
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string
          currency?: string
          customer_id?: string | null
          deal_id?: string | null
          discount_total?: number
          document?: Json
          id?: string
          lead_id?: string | null
          number: string
          status?: string
          subtotal?: number
          tax_total?: number
          title: string
          total?: number
          updated_at?: string
          valid_until: string
          version?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          currency?: string
          customer_id?: string | null
          deal_id?: string | null
          discount_total?: number
          document?: Json
          id?: string
          lead_id?: string | null
          number?: string
          status?: string
          subtotal?: number
          tax_total?: number
          title?: string
          total?: number
          updated_at?: string
          valid_until?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_proposals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_proposals_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "sales_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_proposals_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_proposals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_settings: {
        Row: {
          address: string
          city: string
          company_name: string
          country: string
          default_currency: string
          email: string
          gstin: string
          id: boolean
          invoice_business_information: string
          invoice_prefix: string
          payment_instructions: string
          phone: string
          state: string
          tax_percentage: number
          tax_preference: string
        }
        Insert: {
          address?: string
          city?: string
          company_name?: string
          country?: string
          default_currency?: string
          email?: string
          gstin?: string
          id?: boolean
          invoice_business_information?: string
          invoice_prefix?: string
          payment_instructions?: string
          phone?: string
          state?: string
          tax_percentage?: number
          tax_preference?: string
        }
        Update: {
          address?: string
          city?: string
          company_name?: string
          country?: string
          default_currency?: string
          email?: string
          gstin?: string
          id?: boolean
          invoice_business_information?: string
          invoice_prefix?: string
          payment_instructions?: string
          phone?: string
          state?: string
          tax_percentage?: number
          tax_preference?: string
        }
        Relationships: []
      }
      support_attachments: {
        Row: {
          created_at: string
          filename: string
          id: string
          message_id: string | null
          mime: string
          path: string
          size: number
          ticket_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          message_id?: string | null
          mime: string
          path: string
          size: number
          ticket_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          message_id?: string | null
          mime?: string
          path?: string
          size?: number
          ticket_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "support_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          is_private: boolean
          sender_id: string
          sender_name: string
          sender_role: string
          ticket_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_private?: boolean
          sender_id: string
          sender_name: string
          sender_role: string
          ticket_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_private?: boolean
          sender_id?: string
          sender_name?: string
          sender_role?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_events: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          detail: Json
          id: string
          ticket_id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          detail?: Json
          id?: string
          ticket_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          detail?: Json
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_read_at: string | null
          category: string
          company_id: string | null
          created_at: string
          description: string
          id: string
          last_admin_message_at: string | null
          last_user_message_at: string
          number: number
          priority: string
          status: string
          subject: string
          updated_at: string
          user_email: string
          user_id: string
          user_name: string
          user_read_at: string
        }
        Insert: {
          admin_read_at?: string | null
          category: string
          company_id?: string | null
          created_at?: string
          description: string
          id?: string
          last_admin_message_at?: string | null
          last_user_message_at?: string
          number?: never
          priority?: string
          status?: string
          subject: string
          updated_at?: string
          user_email: string
          user_id: string
          user_name: string
          user_read_at?: string
        }
        Update: {
          admin_read_at?: string | null
          category?: string
          company_id?: string | null
          created_at?: string
          description?: string
          id?: string
          last_admin_message_at?: string | null
          last_user_message_at?: string
          number?: never
          priority?: string
          status?: string
          subject?: string
          updated_at?: string
          user_email?: string
          user_id?: string
          user_name?: string
          user_read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      user_work_rows: {
        Row: {
          created_at: string
          deal_id: string | null
          id: string
          lead_id: string | null
          position: number
          table_id: string
          task_id: string | null
          updated_at: string
          values: Json
          version: number
        }
        Insert: {
          created_at?: string
          deal_id?: string | null
          id?: string
          lead_id?: string | null
          position?: number
          table_id: string
          task_id?: string | null
          updated_at?: string
          values?: Json
          version?: number
        }
        Update: {
          created_at?: string
          deal_id?: string | null
          id?: string
          lead_id?: string | null
          position?: number
          table_id?: string
          task_id?: string | null
          updated_at?: string
          values?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_work_rows_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_work_rows_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_work_rows_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "user_work_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_work_rows_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "crm_work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      user_work_tables: {
        Row: {
          columns: Json
          created_at: string
          id: string
          name: string
          owner_id: string
          preferences: Json
          updated_at: string
          version: number
        }
        Insert: {
          columns?: Json
          created_at?: string
          id?: string
          name: string
          owner_id?: string
          preferences?: Json
          updated_at?: string
          version?: number
        }
        Update: {
          columns?: Json
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          preferences?: Json
          updated_at?: string
          version?: number
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
          assigned_to: string | null
          company_id: string | null
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
          assigned_to?: string | null
          company_id?: string | null
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
          assigned_to?: string | null
          company_id?: string | null
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
            foreignKeyName: "whatsapp_conversations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          company_id: string | null
          created_at: string
          created_by: string | null
          footer: string
          header: string
          header_type: string
          id: string
          language: string
          name: string
          samples: Json
          status: string
          sync_status: string
          updated_at: string
        }
        Insert: {
          body: string
          buttons?: Json
          category: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          footer?: string
          header?: string
          header_type?: string
          id?: string
          language?: string
          name: string
          samples?: Json
          status?: string
          sync_status?: string
          updated_at?: string
        }
        Update: {
          body?: string
          buttons?: Json
          category?: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          footer?: string
          header?: string
          header_type?: string
          id?: string
          language?: string
          name?: string
          samples?: Json
          status?: string
          sync_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_chat_with: { Args: { _other: string }; Returns: boolean }
      can_manage_sales: { Args: never; Returns: boolean }
      chat_group_access: { Args: { _group: string }; Returns: boolean }
      chat_group_action: {
        Args: { _action: string; _payload: Json }
        Returns: string
      }
      chat_people: {
        Args: never
        Returns: {
          avatar_url: string
          email: string
          full_name: string
          id: string
          role: string
        }[]
      }
      chat_read: { Args: { _group: string; _peer: string }; Returns: undefined }
      chat_send: {
        Args: { _body: string; _client: string; _group: string; _peer: string }
        Returns: string
      }
      commercial_line_totals: {
        Args: { _items: Json; _mode: string }
        Returns: Json
      }
      crm_work_action: {
        Args: { _action: string; _payload: Json }
        Returns: string
      }
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
      hrm_allowed: {
        Args: { _action: string; _company: string; _module: string }
        Returns: boolean
      }
      hrm_attendance_action: {
        Args: { _action: string; _payload: Json }
        Returns: string
      }
      hrm_attendance_bulk: { Args: { _payload: Json }; Returns: number }
      hrm_audience: {
        Args: {
          _audience: Json
          _branch: string
          _company: string
          _department: string
        }
        Returns: boolean
      }
      hrm_document_access: { Args: { _document: string }; Returns: undefined }
      hrm_document_version: {
        Args: {
          _document: string
          _filename: string
          _mime: string
          _path: string
          _size: number
        }
        Returns: string
      }
      hrm_leave_action: {
        Args: { _action: string; _payload: Json }
        Returns: string
      }
      hrm_leave_days: {
        Args: {
          _employee: string
          _end: string
          _half: boolean
          _start: string
        }
        Returns: number
      }
      hrm_leave_request_with_status: {
        Args: { _payload: Json }
        Returns: string
      }
      hrm_meeting_response: {
        Args: { _meeting: string; _response: string }
        Returns: undefined
      }
      hrm_owns_employee: {
        Args: { _company: string; _employee: string }
        Returns: boolean
      }
      hrm_payroll_action: {
        Args: { _action: string; _payload: Json }
        Returns: string
      }
      hrm_people: {
        Args: never
        Returns: {
          avatar_url: string
          branch_id: string
          company_id: string
          department_id: string
          designation_id: string
          email: string
          id: string
          is_active: boolean
          name: string
          profile_id: string
        }[]
      }
      is_company_member: {
        Args: { _company: string; _user: string }
        Returns: boolean
      }
      messaging_allowed: { Args: { _permission?: string }; Returns: boolean }
      route_lead: {
        Args: { _lead: string; _manual_user?: string }
        Returns: Json
      }
      routing_admin: { Args: never; Returns: boolean }
      routing_eligible: {
        Args: { _company: string; _user: string }
        Returns: boolean
      }
      routing_rule_action: {
        Args: { _action: string; _payload: Json }
        Returns: string
      }
      sales_financial_action: {
        Args: { action: string; payload: Json }
        Returns: string
      }
      save_business_settings: { Args: { _payload: Json }; Returns: undefined }
      support_access: { Args: { _ticket: string }; Returns: boolean }
      support_action: {
        Args: { _action: string; _payload: Json }
        Returns: string
      }
      support_admin: { Args: never; Returns: boolean }
      template_scope: { Args: { _company: string }; Returns: boolean }
      user_checklist_valid: { Args: { _list: Json }; Returns: boolean }
      user_commercial_allowed: {
        Args: { _permission: string }
        Returns: boolean
      }
      user_commercial_company: { Args: { _company: string }; Returns: boolean }
      user_commercial_lead: {
        Args: { _company: string; _lead: string }
        Returns: boolean
      }
      user_crm_company: { Args: { _company: string }; Returns: boolean }
      user_deal_action: {
        Args: { _action: string; _payload: Json }
        Returns: string
      }
      user_invoice_draft: { Args: { _payload: Json }; Returns: string }
      user_lead_action: {
        Args: {
          _action: string
          _id: string
          _payload: Json
          _updated_at: string
        }
        Returns: string
      }
      user_proposal_action: {
        Args: { _action: string; _payload: Json }
        Returns: string
      }
      user_sales_catalog: {
        Args: never
        Returns: {
          id: string
          name: string
          selling_price: number
          tax_rate: number
        }[]
      }
      user_table_action: {
        Args: { _action: string; _payload: Json }
        Returns: string
      }
      user_table_rows_page: {
        Args: {
          _descending?: boolean
          _filter?: string
          _page: number
          _q?: string
          _sort?: string
          _table: string
          _value?: string
        }
        Returns: Json
      }
      user_work_action: {
        Args: { _action: string; _payload: Json }
        Returns: string
      }
      user_workspace_allowed: { Args: never; Returns: boolean }
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
