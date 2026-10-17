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
      companies: {
        Row: {
          created_at: string
          email: string
          id: string
          industry: string
          is_active: boolean
          location: string
          name: string
          phone: string
        }
        Insert: {
          created_at?: string
          email?: string
          id?: string
          industry?: string
          is_active?: boolean
          location?: string
          name: string
          phone?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          industry?: string
          is_active?: boolean
          location?: string
          name?: string
          phone?: string
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
          company_id: string | null
          created_at: string
          created_by: string | null
          email: string
          id: string
          is_active: boolean
          job_title: string
          location: string
          name: string
          phone: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          is_active?: boolean
          job_title?: string
          location?: string
          name: string
          phone?: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          is_active?: boolean
          job_title?: string
          location?: string
          name?: string
          phone?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_member: {
        Args: { _company: string; _user: string }
        Returns: boolean
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
