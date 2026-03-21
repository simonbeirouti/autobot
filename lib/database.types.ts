export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      automation_runs: {
        Row: {
          automation_key: string
          created_at: string
          finished_at: string | null
          id: string
          input_summary: string | null
          result_summary: string | null
          started_at: string
          status: Database["public"]["Enums"]["usage_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          automation_key: string
          created_at?: string
          finished_at?: string | null
          id?: string
          input_summary?: string | null
          result_summary?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["usage_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          automation_key?: string
          created_at?: string
          finished_at?: string | null
          id?: string
          input_summary?: string | null
          result_summary?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["usage_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clarification_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          questions: Json
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          questions?: Json
          role: string
          session_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          questions?: Json
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clarification_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_submissions: {
        Row: {
          created_at: string
          description: string
          id: string
          score: number
          title: string
          type: Database["public"]["Enums"]["feedback_submission_type"]
          updated_at: string
          user_email: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          score: number
          title: string
          type: Database["public"]["Enums"]["feedback_submission_type"]
          updated_at?: string
          user_email?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          score?: number
          title?: string
          type?: Database["public"]["Enums"]["feedback_submission_type"]
          updated_at?: string
          user_email?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_drafts: {
        Row: {
          clarification_summary: string | null
          completed_at: string | null
          confidence_to_proceed: number | null
          created_at: string
          current_step: number
          draft_markdown: string | null
          event_narrative: Json
          execution_mode: string | null
          generated_markdown: string | null
          id: string
          last_edited_at: string | null
          last_generated_at: string | null
          objective: string
          objective_id: string | null
          project_id: string | null
          question_count: number
          run_id: string | null
          session_id: string
          status: Database["public"]["Enums"]["intake_draft_status"]
          task_drafts: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          clarification_summary?: string | null
          completed_at?: string | null
          confidence_to_proceed?: number | null
          created_at?: string
          current_step?: number
          draft_markdown?: string | null
          event_narrative?: Json
          execution_mode?: string | null
          generated_markdown?: string | null
          id?: string
          last_edited_at?: string | null
          last_generated_at?: string | null
          objective: string
          objective_id?: string | null
          project_id?: string | null
          question_count?: number
          run_id?: string | null
          session_id: string
          status?: Database["public"]["Enums"]["intake_draft_status"]
          task_drafts?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          clarification_summary?: string | null
          completed_at?: string | null
          confidence_to_proceed?: number | null
          created_at?: string
          current_step?: number
          draft_markdown?: string | null
          event_narrative?: Json
          execution_mode?: string | null
          generated_markdown?: string | null
          id?: string
          last_edited_at?: string | null
          last_generated_at?: string | null
          objective?: string
          objective_id?: string | null
          project_id?: string | null
          question_count?: number
          run_id?: string | null
          session_id?: string
          status?: Database["public"]["Enums"]["intake_draft_status"]
          task_drafts?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intake_drafts_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_drafts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_drafts_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_drafts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_questions: {
        Row: {
          allow_other: boolean
          answer: string | null
          answer_text: string | null
          answered_at: string | null
          created_at: string
          description: string
          draft_id: string
          id: string
          input_kind: string
          is_optional: boolean
          options: Json
          other_label: string | null
          other_placeholder: string | null
          position: number
          prefill: Json
          question: string
          question_key: string | null
          response: Json
          updated_at: string
        }
        Insert: {
          allow_other?: boolean
          answer?: string | null
          answer_text?: string | null
          answered_at?: string | null
          created_at?: string
          description?: string
          draft_id: string
          id?: string
          input_kind?: string
          is_optional?: boolean
          options?: Json
          other_label?: string | null
          other_placeholder?: string | null
          position?: number
          prefill?: Json
          question: string
          question_key?: string | null
          response?: Json
          updated_at?: string
        }
        Update: {
          allow_other?: boolean
          answer?: string | null
          answer_text?: string | null
          answered_at?: string | null
          created_at?: string
          description?: string
          draft_id?: string
          id?: string
          input_kind?: string
          is_optional?: boolean
          options?: Json
          other_label?: string | null
          other_placeholder?: string | null
          position?: number
          prefill?: Json
          question?: string
          question_key?: string | null
          response?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intake_questions_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "intake_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_tool_definitions: {
        Row: {
          approval_policy: Database["public"]["Enums"]["tool_approval_policy"]
          capabilities: string[]
          created_at: string
          description: string
          enabled_by_default: boolean
          execution_mode: string
          executor_key: string
          id: string
          input_schema: Json | null
          metadata: Json
          output_schema: Json | null
          requires_connection: boolean
          risk_level: string
          slug: string
          source: Database["public"]["Enums"]["internal_tool_source"]
          tags: string[]
          title: string
          toolkit_slug: string
          updated_at: string
        }
        Insert: {
          approval_policy?: Database["public"]["Enums"]["tool_approval_policy"]
          capabilities?: string[]
          created_at?: string
          description: string
          enabled_by_default?: boolean
          execution_mode: string
          executor_key: string
          id?: string
          input_schema?: Json | null
          metadata?: Json
          output_schema?: Json | null
          requires_connection?: boolean
          risk_level: string
          slug: string
          source: Database["public"]["Enums"]["internal_tool_source"]
          tags?: string[]
          title: string
          toolkit_slug: string
          updated_at?: string
        }
        Update: {
          approval_policy?: Database["public"]["Enums"]["tool_approval_policy"]
          capabilities?: string[]
          created_at?: string
          description?: string
          enabled_by_default?: boolean
          execution_mode?: string
          executor_key?: string
          id?: string
          input_schema?: Json | null
          metadata?: Json
          output_schema?: Json | null
          requires_connection?: boolean
          risk_level?: string
          slug?: string
          source?: Database["public"]["Enums"]["internal_tool_source"]
          tags?: string[]
          title?: string
          toolkit_slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      memory_records: {
        Row: {
          company_key: string
          content: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["memory_kind"]
          metadata: Json
          objective_id: string | null
          project_id: string | null
          scope: Database["public"]["Enums"]["memory_scope"]
          source_id: string | null
          source_type: string
          summary: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_key: string
          content: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["memory_kind"]
          metadata?: Json
          objective_id?: string | null
          project_id?: string | null
          scope: Database["public"]["Enums"]["memory_scope"]
          source_id?: string | null
          source_type: string
          summary: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_key?: string
          content?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["memory_kind"]
          metadata?: Json
          objective_id?: string | null
          project_id?: string | null
          scope?: Database["public"]["Enums"]["memory_scope"]
          source_id?: string | null
          source_type?: string
          summary?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memory_records_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memory_records_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memory_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          marketing_email: boolean
          platform_updates_email: boolean
          platform_updates_in_app: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          marketing_email?: boolean
          platform_updates_email?: boolean
          platform_updates_in_app?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          marketing_email?: boolean
          platform_updates_email?: boolean
          platform_updates_in_app?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_href: string | null
          action_label: string | null
          body: string
          category: string
          channel: string
          created_at: string
          dedupe_key: string | null
          dismissed_at: string | null
          href: string | null
          id: string
          kind: string
          metadata: Json
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          action_href?: string | null
          action_label?: string | null
          body: string
          category: string
          channel: string
          created_at?: string
          dedupe_key?: string | null
          dismissed_at?: string | null
          href?: string | null
          id?: string
          kind: string
          metadata?: Json
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          action_href?: string | null
          action_label?: string | null
          body?: string
          category?: string
          channel?: string
          created_at?: string
          dedupe_key?: string | null
          dismissed_at?: string | null
          href?: string | null
          id?: string
          kind?: string
          metadata?: Json
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      objectives: {
        Row: {
          created_at: string
          description: string
          id: string
          project_id: string
          source_draft_id: string | null
          source_run_id: string | null
          status: Database["public"]["Enums"]["objective_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          project_id: string
          source_draft_id?: string | null
          source_run_id?: string | null
          status?: Database["public"]["Enums"]["objective_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          project_id?: string
          source_draft_id?: string | null
          source_run_id?: string | null
          status?: Database["public"]["Enums"]["objective_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "objectives_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objectives_source_draft_id_fkey"
            columns: ["source_draft_id"]
            isOneToOne: false
            referencedRelation: "intake_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objectives_source_run_id_fkey"
            columns: ["source_run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objectives_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_files: {
        Row: {
          content_type: string | null
          created_at: string
          id: string
          label: string | null
          profile_id: string
          size_bytes: number | null
          storage_path: string
          updated_at: string
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          id?: string
          label?: string | null
          profile_id: string
          size_bytes?: number | null
          storage_path: string
          updated_at?: string
        }
        Update: {
          content_type?: string | null
          created_at?: string
          id?: string
          label?: string | null
          profile_id?: string
          size_bytes?: number | null
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_files_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          id: string
          updated_at: string | null
        }
        Insert: {
          id: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      project_assets: {
        Row: {
          asset_type: string
          created_at: string
          id: string
          label: string
          metadata: Json
          project_id: string
          storage_path: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_type: string
          created_at?: string
          id?: string
          label: string
          metadata?: Json
          project_id: string
          storage_path?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_type?: string
          created_at?: string
          id?: string
          label?: string
          metadata?: Json
          project_id?: string
          storage_path?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_chat_messages: {
        Row: {
          agent_id: string | null
          cited_memory_ids: string[]
          content: string
          created_at: string
          id: string
          objective_id: string | null
          project_id: string
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          cited_memory_ids?: string[]
          content: string
          created_at?: string
          id?: string
          objective_id?: string | null
          project_id: string
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          agent_id?: string | null
          cited_memory_ids?: string[]
          content?: string
          created_at?: string
          id?: string
          objective_id?: string | null
          project_id?: string
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_chat_messages_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_chat_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "project_chat_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_chat_threads: {
        Row: {
          created_at: string
          id: string
          objective_id: string | null
          project_id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          objective_id?: string | null
          project_id: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          objective_id?: string | null
          project_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_chat_threads_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_chat_threads_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_chat_threads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_internal_tool_enablements: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          project_id: string
          tool_slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          project_id: string
          tool_slug: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          project_id?: string
          tool_slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_internal_tool_enablements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_internal_tool_enablements_tool_slug_fkey"
            columns: ["tool_slug"]
            isOneToOne: false
            referencedRelation: "internal_tool_definitions"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "project_internal_tool_enablements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_toolkit_selections: {
        Row: {
          created_at: string
          id: string
          project_id: string
          toolkit_slug: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          toolkit_slug: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          toolkit_slug?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_toolkit_selections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_toolkit_selections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          archived_at: string | null
          company_key: string
          created_at: string
          deleted_at: string | null
          description: string
          icon_key: string
          id: string
          name: string
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          company_key: string
          created_at?: string
          deleted_at?: string | null
          description?: string
          icon_key?: string
          id?: string
          name: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          company_key?: string
          created_at?: string
          deleted_at?: string | null
          description?: string
          icon_key?: string
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_connections: {
        Row: {
          api_key_last_four: string | null
          api_key_updated_at: string | null
          auth_scheme: string | null
          callback_url: string | null
          composio_session_id: string | null
          connected_account_id: string | null
          created_at: string
          encrypted_api_key: string | null
          id: string
          last_synced_at: string | null
          redirect_url: string | null
          status: Database["public"]["Enums"]["toolkit_connection_status"]
          toolkit_slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key_last_four?: string | null
          api_key_updated_at?: string | null
          auth_scheme?: string | null
          callback_url?: string | null
          composio_session_id?: string | null
          connected_account_id?: string | null
          created_at?: string
          encrypted_api_key?: string | null
          id?: string
          last_synced_at?: string | null
          redirect_url?: string | null
          status?: Database["public"]["Enums"]["toolkit_connection_status"]
          toolkit_slug: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key_last_four?: string | null
          api_key_updated_at?: string | null
          auth_scheme?: string | null
          callback_url?: string | null
          composio_session_id?: string | null
          connected_account_id?: string | null
          created_at?: string
          encrypted_api_key?: string | null
          id?: string
          last_synced_at?: string | null
          redirect_url?: string | null
          status?: Database["public"]["Enums"]["toolkit_connection_status"]
          toolkit_slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      run_events: {
        Row: {
          agent_id: string | null
          agent_label: string | null
          color_token: string | null
          created_at: string
          id: string
          message: string
          metadata: Json | null
          run_id: string
          type: Database["public"]["Enums"]["event_type"]
        }
        Insert: {
          agent_id?: string | null
          agent_label?: string | null
          color_token?: string | null
          created_at?: string
          id?: string
          message: string
          metadata?: Json | null
          run_id: string
          type: Database["public"]["Enums"]["event_type"]
        }
        Update: {
          agent_id?: string | null
          agent_label?: string | null
          color_token?: string | null
          created_at?: string
          id?: string
          message?: string
          metadata?: Json | null
          run_id?: string
          type?: Database["public"]["Enums"]["event_type"]
        }
        Relationships: [
          {
            foreignKeyName: "run_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      run_tasks: {
        Row: {
          action_required: Json | null
          agent_id: string | null
          agent_label: string | null
          created_at: string
          description: string | null
          execution_strategy: string
          id: string
          optional_toolkit_slugs: string[]
          position: number
          required_tool_ids: string[]
          required_toolkit_slugs: string[]
          run_id: string
          status: Database["public"]["Enums"]["task_status"]
          title: string
          tool_requirement: string
          tool_summary: string | null
          updated_at: string
        }
        Insert: {
          action_required?: Json | null
          agent_id?: string | null
          agent_label?: string | null
          created_at?: string
          description?: string | null
          execution_strategy?: string
          id?: string
          optional_toolkit_slugs?: string[]
          position?: number
          required_tool_ids?: string[]
          required_toolkit_slugs?: string[]
          run_id: string
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          tool_requirement?: string
          tool_summary?: string | null
          updated_at?: string
        }
        Update: {
          action_required?: Json | null
          agent_id?: string | null
          agent_label?: string | null
          created_at?: string
          description?: string | null
          execution_strategy?: string
          id?: string
          optional_toolkit_slugs?: string[]
          position?: number
          required_tool_ids?: string[]
          required_toolkit_slugs?: string[]
          run_id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          tool_requirement?: string
          tool_summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "run_tasks_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      runs: {
        Row: {
          action_required: Json | null
          created_at: string
          execution_mode: string
          final_summary: string | null
          id: string
          objective: string
          objective_id: string | null
          project_id: string | null
          readiness_summary: string | null
          session_id: string
          status: Database["public"]["Enums"]["run_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          action_required?: Json | null
          created_at?: string
          execution_mode: string
          final_summary?: string | null
          id?: string
          objective: string
          objective_id?: string | null
          project_id?: string | null
          readiness_summary?: string | null
          session_id: string
          status?: Database["public"]["Enums"]["run_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          action_required?: Json | null
          created_at?: string
          execution_mode?: string
          final_summary?: string | null
          id?: string
          objective?: string
          objective_id?: string | null
          project_id?: string | null
          readiness_summary?: string | null
          session_id?: string
          status?: Database["public"]["Enums"]["run_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "runs_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_invocations: {
        Row: {
          created_at: string
          id: string
          input_summary: string | null
          metadata: Json
          objective_id: string | null
          project_id: string | null
          result_summary: string | null
          run_id: string | null
          status: string
          thread_id: string | null
          tool_slug: string
          toolkit_slug: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          input_summary?: string | null
          metadata?: Json
          objective_id?: string | null
          project_id?: string | null
          result_summary?: string | null
          run_id?: string | null
          status: string
          thread_id?: string | null
          tool_slug: string
          toolkit_slug: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          input_summary?: string | null
          metadata?: Json
          objective_id?: string | null
          project_id?: string | null
          result_summary?: string | null
          run_id?: string | null
          status?: string
          thread_id?: string | null
          tool_slug?: string
          toolkit_slug?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tool_invocations_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_invocations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_invocations_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_invocations_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "project_chat_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_invocations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_records: {
        Row: {
          agent_id: string | null
          category: Database["public"]["Enums"]["usage_category"]
          cost_estimate: number | null
          finished_at: string | null
          id: string
          input_summary: string | null
          latency_ms: number | null
          name: string
          result_summary: string | null
          run_id: string | null
          session_id: string | null
          started_at: string
          status: Database["public"]["Enums"]["usage_status"]
          token_count: number | null
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          category: Database["public"]["Enums"]["usage_category"]
          cost_estimate?: number | null
          finished_at?: string | null
          id?: string
          input_summary?: string | null
          latency_ms?: number | null
          name: string
          result_summary?: string | null
          run_id?: string | null
          session_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["usage_status"]
          token_count?: number | null
          user_id: string
        }
        Update: {
          agent_id?: string | null
          category?: Database["public"]["Enums"]["usage_category"]
          cost_estimate?: number | null
          finished_at?: string | null
          id?: string
          input_summary?: string | null
          latency_ms?: number | null
          name?: string
          result_summary?: string | null
          run_id?: string | null
          session_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["usage_status"]
          token_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_records_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tool_onboarding: {
        Row: {
          completed_at: string | null
          created_at: string
          selected_toolkit_slugs: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          selected_toolkit_slugs?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          selected_toolkit_slugs?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tool_onboarding_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      save_provider_connection_api_key: {
        Args: {
          p_api_key: string
          p_auth_scheme: string
          p_encryption_secret: string
          p_toolkit_slug: string
        }
        Returns: {
          api_key_last_four: string | null
          api_key_updated_at: string | null
          auth_scheme: string | null
          callback_url: string | null
          composio_session_id: string | null
          connected_account_id: string | null
          created_at: string
          encrypted_api_key: string | null
          id: string
          last_synced_at: string | null
          redirect_url: string | null
          status: Database["public"]["Enums"]["toolkit_connection_status"]
          toolkit_slug: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "provider_connections"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      event_type: "system" | "agent" | "tool" | "handoff" | "task"
      feedback_submission_type: "feedback" | "feature_request"
      intake_draft_status:
        | "collecting_input"
        | "review_ready"
        | "executing"
        | "archived"
      internal_tool_source: "internal_builtin" | "internal_custom"
      memory_kind:
        | "objective"
        | "decision"
        | "constraint"
        | "fact"
        | "artifact"
        | "preference"
      memory_scope: "company" | "project" | "objective" | "user"
      objective_status: "draft" | "active" | "completed" | "archived"
      project_status: "active" | "archived" | "deleted"
      run_status:
        | "clarifying"
        | "ready"
        | "running"
        | "completed"
        | "blocked"
        | "failed"
      task_status: "waiting" | "underway" | "complete"
      tool_approval_policy: "none" | "confirm_writes"
      toolkit_connection_status:
        | "not_connected"
        | "initiated"
        | "active"
        | "failed"
        | "expired"
        | "disabled"
      usage_category: "chat" | "tool" | "automation" | "agent_handoff"
      usage_status: "started" | "succeeded" | "failed" | "cancelled"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      event_type: ["system", "agent", "tool", "handoff", "task"],
      feedback_submission_type: ["feedback", "feature_request"],
      intake_draft_status: [
        "collecting_input",
        "review_ready",
        "executing",
        "archived",
      ],
      internal_tool_source: ["internal_builtin", "internal_custom"],
      memory_kind: [
        "objective",
        "decision",
        "constraint",
        "fact",
        "artifact",
        "preference",
      ],
      memory_scope: ["company", "project", "objective", "user"],
      objective_status: ["draft", "active", "completed", "archived"],
      project_status: ["active", "archived", "deleted"],
      run_status: [
        "clarifying",
        "ready",
        "running",
        "completed",
        "blocked",
        "failed",
      ],
      task_status: ["waiting", "underway", "complete"],
      tool_approval_policy: ["none", "confirm_writes"],
      toolkit_connection_status: [
        "not_connected",
        "initiated",
        "active",
        "failed",
        "expired",
        "disabled",
      ],
      usage_category: ["chat", "tool", "automation", "agent_handoff"],
      usage_status: ["started", "succeeded", "failed", "cancelled"],
    },
  },
} as const

