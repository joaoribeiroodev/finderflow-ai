/**
 * Tipos do banco de dados Supabase.
 *
 * Gerado automaticamente a partir do projeto real (lxzsefabmnagiaywaxeb) via:
 *
 *   mcp__Supabase__generate_typescript_types (MCP), equivalente a
 *   npx supabase gen types typescript --project-id lxzsefabmnagiaywaxeb --schema public
 *
 * NÃO EDITAR AS SEÇÕES GERADAS À MÃO. Para atualizar após uma nova migration,
 * regenere e substitua o conteúdo abaixo (mantendo os aliases de
 * conveniência ao final do arquivo).
 */

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
      ai_analyses: {
        Row: {
          analysis_type: string
          company_id: string | null
          confidence: string | null
          created_at: string
          created_by: string | null
          id: string
          lead_id: string | null
          model: string
          organization_id: string
          prompt_version: string
          result: Json
          score: number | null
          sources: Json
        }
        Insert: {
          analysis_type: string
          company_id?: string | null
          confidence?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string | null
          model: string
          organization_id: string
          prompt_version: string
          result: Json
          score?: number | null
          sources?: Json
        }
        Update: {
          analysis_type?: string
          company_id?: string | null
          confidence?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string | null
          model?: string
          organization_id?: string
          prompt_version?: string
          result?: Json
          score?: number | null
          sources?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ai_analyses_company_same_org_fk"
            columns: ["organization_id", "company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "ai_analyses_lead_same_org_fk"
            columns: ["organization_id", "lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "ai_analyses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          last_response_id: string | null
          organization_id: string
          pending_tool_call: Json | null
          status: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_response_id?: string | null
          organization_id: string
          pending_tool_call?: Json | null
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_response_id?: string | null
          organization_id?: string
          pending_tool_call?: Json | null
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          organization_id: string
          role: string
          tool_calls: Json | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          organization_id: string
          role: string
          tool_calls?: Json | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          tool_calls?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_same_org_fk"
            columns: ["organization_id", "conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "ai_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_events: {
        Row: {
          created_at: string
          duration_ms: number | null
          estimated_cost: number
          id: string
          input_tokens: number
          model: string
          operation: string
          organization_id: string
          output_tokens: number
          prompt_version: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          estimated_cost?: number
          id?: string
          input_tokens?: number
          model: string
          operation: string
          organization_id: string
          output_tokens?: number
          prompt_version?: string | null
          status: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          estimated_cost?: number
          id?: string
          input_tokens?: number
          model?: string
          operation?: string
          organization_id?: string
          output_tokens?: number
          prompt_version?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_webhook_events: {
        Row: {
          attempts: number
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          processing_status: string
          provider_event_id: string
          received_at: string
        }
        Insert: {
          attempts?: number
          error_message?: string | null
          event_type: string
          id?: string
          payload: Json
          processed_at?: string | null
          processing_status?: string
          provider_event_id: string
          received_at?: string
        }
        Update: {
          attempts?: number
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          processing_status?: string
          provider_event_id?: string
          received_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          organization_id: string | null
          request_id: string | null
          resource_id: string | null
          resource_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          organization_id?: string | null
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          organization_id?: string | null
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_payments: {
        Row: {
          amount: number
          created_at: string
          due_date: string | null
          external_payment_id: string
          id: string
          invoice_url: string | null
          organization_id: string
          paid_at: string | null
          provider: string
          status: string
          subscription_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date?: string | null
          external_payment_id: string
          id?: string
          invoice_url?: string | null
          organization_id: string
          paid_at?: string | null
          provider?: string
          status: string
          subscription_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string | null
          external_payment_id?: string
          id?: string
          invoice_url?: string | null
          organization_id?: string
          paid_at?: string | null
          provider?: string
          status?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_payment_subscription_same_org_fk"
            columns: ["organization_id", "subscription_id"]
            isOneToOne: false
            referencedRelation: "organization_subscriptions"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "billing_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: Json
          archived_at: string | null
          category: string | null
          cnpj: string | null
          created_at: string
          description: string | null
          email: string | null
          id: string
          legal_name: string | null
          name: string
          normalized_name: string
          organization_id: string
          origin: string
          phone: string | null
          social_links: Json
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: Json
          archived_at?: string | null
          category?: string | null
          cnpj?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          legal_name?: string | null
          name: string
          normalized_name: string
          organization_id: string
          origin?: string
          phone?: string | null
          social_links?: Json
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: Json
          archived_at?: string | null
          category?: string | null
          cnpj?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          legal_name?: string | null
          name?: string
          normalized_name?: string
          organization_id?: string
          origin?: string
          phone?: string | null
          social_links?: Json
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      company_source_refs: {
        Row: {
          attribution: Json
          company_id: string
          created_at: string
          expires_at: string | null
          external_id: string
          fetched_at: string
          id: string
          organization_id: string
          provider: string
          retention_policy: string | null
        }
        Insert: {
          attribution?: Json
          company_id: string
          created_at?: string
          expires_at?: string | null
          external_id: string
          fetched_at?: string
          id?: string
          organization_id: string
          provider: string
          retention_policy?: string | null
        }
        Update: {
          attribution?: Json
          company_id?: string
          created_at?: string
          expires_at?: string | null
          external_id?: string
          fetched_at?: string
          id?: string
          organization_id?: string
          provider?: string
          retention_policy?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_source_refs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_refs_company_same_org_fk"
            columns: ["organization_id", "company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      contacts: {
        Row: {
          company_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          organization_id: string
          phone: string | null
          position: string | null
          preferred_channel: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          organization_id: string
          phone?: string | null
          position?: string | null
          preferred_channel?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          organization_id?: string
          phone?: string | null
          position?: string | null
          preferred_channel?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_same_org_fk"
            columns: ["organization_id", "company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          amount: number
          closed_at: string | null
          created_at: string
          expected_close_at: string | null
          id: string
          lead_id: string
          lost_reason: string | null
          organization_id: string
          proposal_id: string | null
          status: string
          title: string
        }
        Insert: {
          amount?: number
          closed_at?: string | null
          created_at?: string
          expected_close_at?: string | null
          id?: string
          lead_id: string
          lost_reason?: string | null
          organization_id: string
          proposal_id?: string | null
          status?: string
          title: string
        }
        Update: {
          amount?: number
          closed_at?: string | null
          created_at?: string
          expected_close_at?: string | null
          id?: string
          lead_id?: string
          lost_reason?: string | null
          organization_id?: string
          proposal_id?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_lead_same_org_fk"
            columns: ["organization_id", "lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "deals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_proposal_same_org_fk"
            columns: ["organization_id", "proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      entitlements: {
        Row: {
          feature_key: string
          id: string
          limit_value: number | null
          metadata: Json
          organization_id: string
          period_end: string | null
          period_start: string | null
          updated_at: string
        }
        Insert: {
          feature_key: string
          id?: string
          limit_value?: number | null
          metadata?: Json
          organization_id: string
          period_end?: string | null
          period_start?: string | null
          updated_at?: string
        }
        Update: {
          feature_key?: string
          id?: string
          limit_value?: number | null
          metadata?: Json
          organization_id?: string
          period_end?: string | null
          period_start?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entitlements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_report: Json
          file_name: string
          file_path: string | null
          id: string
          organization_id: string
          status: string
          summary: Json
          total_rows: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_report?: Json
          file_name: string
          file_path?: string | null
          id?: string
          organization_id: string
          status?: string
          summary?: Json
          total_rows?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_report?: Json
          file_name?: string
          file_path?: string | null
          id?: string
          organization_id?: string
          status?: string
          summary?: Json
          total_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      interactions: {
        Row: {
          actor_id: string | null
          channel: string | null
          content_summary: string
          created_at: string
          id: string
          lead_id: string
          occurred_at: string
          organization_id: string
          type: string
        }
        Insert: {
          actor_id?: string | null
          channel?: string | null
          content_summary: string
          created_at?: string
          id?: string
          lead_id: string
          occurred_at?: string
          organization_id: string
          type: string
        }
        Update: {
          actor_id?: string | null
          channel?: string | null
          content_summary?: string
          created_at?: string
          id?: string
          lead_id?: string
          occurred_at?: string
          organization_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "interactions_lead_same_org_fk"
            columns: ["organization_id", "lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "interactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          id: string
          idempotency_key: string | null
          job_type: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          organization_id: string | null
          payload: Json
          run_after: string
          status: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          job_type: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          organization_id?: string | null
          payload?: Json
          run_after?: string
          status?: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          job_type?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          organization_id?: string | null
          payload?: Json
          run_after?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_stage_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_stage_id: string | null
          id: string
          lead_id: string
          organization_id: string
          to_stage_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_stage_id?: string | null
          id?: string
          lead_id: string
          organization_id: string
          to_stage_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_stage_id?: string | null
          id?: string
          lead_id?: string
          organization_id?: string
          to_stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_stage_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_history_from_stage_same_org_fk"
            columns: ["organization_id", "from_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "stage_history_lead_same_org_fk"
            columns: ["organization_id", "lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "stage_history_to_stage_same_org_fk"
            columns: ["organization_id", "to_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      leads: {
        Row: {
          archived_at: string | null
          assigned_to: string | null
          company_id: string
          created_at: string
          estimated_value: number | null
          id: string
          loss_reason: string | null
          next_contact_at: string | null
          organization_id: string
          priority: Database["public"]["Enums"]["lead_priority"]
          probability: number | null
          score: number | null
          service_interest: string | null
          stage_id: string
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          assigned_to?: string | null
          company_id: string
          created_at?: string
          estimated_value?: number | null
          id?: string
          loss_reason?: string | null
          next_contact_at?: string | null
          organization_id: string
          priority?: Database["public"]["Enums"]["lead_priority"]
          probability?: number | null
          score?: number | null
          service_interest?: string | null
          stage_id: string
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          assigned_to?: string | null
          company_id?: string
          created_at?: string
          estimated_value?: number | null
          id?: string
          loss_reason?: string | null
          next_contact_at?: string | null
          organization_id?: string
          priority?: Database["public"]["Enums"]["lead_priority"]
          probability?: number | null
          score?: number | null
          service_interest?: string | null
          stage_id?: string
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_company_same_org_fk"
            columns: ["organization_id", "company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_stage_same_org_fk"
            columns: ["organization_id", "stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          metadata: Json
          organization_id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          organization_id: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          organization_id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          external_checkout_id: string | null
          external_customer_id: string | null
          external_subscription_id: string | null
          id: string
          next_due_date: string | null
          organization_id: string
          plan_id: string
          provider: string
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          external_checkout_id?: string | null
          external_customer_id?: string | null
          external_subscription_id?: string | null
          id?: string
          next_due_date?: string | null
          organization_id: string
          plan_id: string
          provider?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          external_checkout_id?: string | null
          external_customer_id?: string | null
          external_subscription_id?: string | null
          id?: string
          next_due_date?: string | null
          organization_id?: string
          plan_id?: string
          provider?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          billing_document: string | null
          billing_email: string | null
          billing_name: string | null
          created_at: string
          id: string
          name: string
          settings: Json
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          billing_document?: string | null
          billing_email?: string | null
          billing_name?: string | null
          created_at?: string
          id?: string
          name: string
          settings?: Json
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          billing_document?: string | null
          billing_email?: string | null
          billing_name?: string | null
          created_at?: string
          id?: string
          name?: string
          settings?: Json
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          is_closed: boolean
          name: string
          organization_id: string
          position: number
          result_type: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_closed?: boolean
          name: string
          organization_id: string
          position: number
          result_type?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_closed?: boolean
          name?: string
          organization_id?: string
          position?: number
          result_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          billing_interval: string
          created_at: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          limits: Json
          name: string
          price: number
          slug: string
        }
        Insert: {
          billing_interval: string
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          limits?: Json
          name: string
          price: number
          slug: string
        }
        Update: {
          billing_interval?: string
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          limits?: Json
          name?: string
          price?: number
          slug?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      proposal_items: {
        Row: {
          description: string
          id: string
          organization_id: string
          proposal_id: string
          quantity: number
          service_id: string | null
          total: number
          unit_price: number
        }
        Insert: {
          description: string
          id?: string
          organization_id: string
          proposal_id: string
          quantity?: number
          service_id?: string | null
          total?: number
          unit_price?: number
        }
        Update: {
          description?: string
          id?: string
          organization_id?: string
          proposal_id?: string
          quantity?: number
          service_id?: string | null
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposal_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_items_proposal_same_org_fk"
            columns: ["organization_id", "proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "proposal_items_service_same_org_fk"
            columns: ["organization_id", "service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      proposals: {
        Row: {
          created_at: string
          document_path: string | null
          id: string
          lead_id: string
          organization_id: string
          proposal_number: string
          status: string
          total_amount: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          document_path?: string | null
          id?: string
          lead_id: string
          organization_id: string
          proposal_number: string
          status?: string
          total_amount?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          document_path?: string | null
          id?: string
          lead_id?: string
          organization_id?: string
          proposal_number?: string
          status?: string
          total_amount?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_lead_same_org_fk"
            columns: ["organization_id", "lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "proposals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      search_results: {
        Row: {
          attribution: Json
          company_id: string | null
          display_data: Json
          expires_at: string | null
          external_id: string | null
          fetched_at: string
          id: string
          organization_id: string
          provider: string
          search_id: string
        }
        Insert: {
          attribution?: Json
          company_id?: string | null
          display_data?: Json
          expires_at?: string | null
          external_id?: string | null
          fetched_at?: string
          id?: string
          organization_id: string
          provider: string
          search_id: string
        }
        Update: {
          attribution?: Json
          company_id?: string | null
          display_data?: Json
          expires_at?: string | null
          external_id?: string | null
          fetched_at?: string
          id?: string
          organization_id?: string
          provider?: string
          search_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_results_company_same_org_fk"
            columns: ["organization_id", "company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "search_results_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_results_search_same_org_fk"
            columns: ["organization_id", "search_id"]
            isOneToOne: false
            referencedRelation: "searches"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      searches: {
        Row: {
          city: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          filters: Json
          id: string
          organization_id: string
          providers: Json
          query: string
          segment: string | null
          state: string | null
          status: string
          total_results: number
        }
        Insert: {
          city?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          filters?: Json
          id?: string
          organization_id: string
          providers?: Json
          query: string
          segment?: string | null
          state?: string | null
          status?: string
          total_results?: number
        }
        Update: {
          city?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          filters?: Json
          id?: string
          organization_id?: string
          providers?: Json
          query?: string
          segment?: string | null
          state?: string | null
          status?: string
          total_results?: number
        }
        Relationships: [
          {
            foreignKeyName: "searches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          base_price: number | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          pricing_type: string
          updated_at: string
        }
        Insert: {
          base_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          pricing_type?: string
          updated_at?: string
        }
        Update: {
          base_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          pricing_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_at: string | null
          id: string
          lead_id: string | null
          organization_id: string
          status: Database["public"]["Enums"]["task_status"]
          title: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          lead_id?: string | null
          organization_id: string
          status?: Database["public"]["Enums"]["task_status"]
          title: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          lead_id?: string | null
          organization_id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_lead_same_org_fk"
            columns: ["organization_id", "lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_admin_org: { Args: { target_org: string }; Returns: boolean }
      can_edit_org: { Args: { target_org: string }; Returns: boolean }
      claim_asaas_webhook_event: {
        Args: {
          p_event_type: string
          p_payload: Json
          p_provider_event_id: string
        }
        Returns: {
          attempts: number
          claimed: boolean
          event_id: string
          processing_status: string
        }[]
      }
      count_ai_usage_in_period: {
        Args: {
          p_organization_id: string
          p_period_end: string
          p_period_start: string
        }
        Returns: number
      }
      create_organization_with_defaults: {
        Args: { org_name: string; org_slug: string }
        Returns: string
      }
      get_or_create_ai_quota: {
        Args: {
          p_default_limit: number
          p_feature_key: string
          p_organization_id: string
        }
        Returns: {
          feature_key: string
          id: string
          limit_value: number | null
          metadata: Json
          organization_id: string
          period_end: string | null
          period_start: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "entitlements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_org_role: {
        Args: {
          allowed_roles: Database["public"]["Enums"]["org_role"][]
          target_org: string
        }
        Returns: boolean
      }
      is_org_member: { Args: { target_org: string }; Returns: boolean }
      log_ai_usage: {
        Args: {
          p_duration_ms: number
          p_estimated_cost: number
          p_input_tokens: number
          p_model: string
          p_operation: string
          p_organization_id: string
          p_output_tokens: number
          p_prompt_version: string
          p_status: string
        }
        Returns: {
          created_at: string
          duration_ms: number | null
          estimated_cost: number
          id: string
          input_tokens: number
          model: string
          operation: string
          organization_id: string
          output_tokens: number
          prompt_version: string | null
          status: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "ai_usage_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      move_lead_stage: {
        Args: {
          p_lead_id: string
          p_loss_reason?: string
          p_to_stage_id: string
        }
        Returns: {
          archived_at: string | null
          assigned_to: string | null
          company_id: string
          created_at: string
          estimated_value: number | null
          id: string
          loss_reason: string | null
          next_contact_at: string | null
          organization_id: string
          priority: Database["public"]["Enums"]["lead_priority"]
          probability: number | null
          score: number | null
          service_interest: string | null
          stage_id: string
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "leads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      recompute_proposal_total: {
        Args: { p_proposal_id: string }
        Returns: undefined
      }
      reorder_pipeline_stages: {
        Args: { p_ordered_ids: string[]; p_organization_id: string }
        Returns: undefined
      }
      shares_org_with: { Args: { target_user: string }; Returns: boolean }
    }
    Enums: {
      lead_priority: "low" | "medium" | "high"
      lead_status: "open" | "won" | "lost"
      org_role: "owner" | "admin" | "manager" | "member" | "viewer"
      subscription_status:
        | "incomplete"
        | "trialing"
        | "active"
        | "past_due"
        | "suspended"
        | "canceled"
        | "expired"
      task_status: "pending" | "in_progress" | "completed" | "canceled"
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
      lead_priority: ["low", "medium", "high"],
      lead_status: ["open", "won", "lost"],
      org_role: ["owner", "admin", "manager", "member", "viewer"],
      subscription_status: [
        "incomplete",
        "trialing",
        "active",
        "past_due",
        "suspended",
        "canceled",
        "expired",
      ],
      task_status: ["pending", "in_progress", "completed", "canceled"],
    },
  },
} as const

/**
 * Aliases de conveniência usados pelos módulos de domínio
 * (src/modules/organizations, src/lib/permissions). `OrgRole` é extraído
 * diretamente do enum `org_role` gerado acima para nunca divergir do banco.
 * `MemberStatus` não é um enum do Postgres (coluna `status` é `text` com
 * check constraint em organization_members), por isso é mantido manualmente —
 * atualizar se a constraint mudar.
 */
export type OrgRole = Database["public"]["Enums"]["org_role"]
export type MemberStatus = "invited" | "active" | "suspended"
