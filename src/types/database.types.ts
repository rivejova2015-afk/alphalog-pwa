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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      account_categories: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          name_lower: string | null
          sort_index: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          name_lower?: string | null
          sort_index?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          name_lower?: string | null
          sort_index?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      accounts: {
        Row: {
          account_size: number | null
          category_id: string
          created_at: string
          currency: string
          current_balance: number | null
          deleted_at: string | null
          id: string
          name: string
          operation_state: string | null
          phase_status: string | null
          role: string | null
          sort_index: number
          status: string
          updated_at: string
          user_id: string
          withdrawals_enabled: boolean
        }
        Insert: {
          account_size?: number | null
          category_id: string
          created_at?: string
          currency?: string
          current_balance?: number | null
          deleted_at?: string | null
          id?: string
          name: string
          operation_state?: string | null
          phase_status?: string | null
          role?: string | null
          sort_index?: number
          status?: string
          updated_at?: string
          user_id: string
          withdrawals_enabled?: boolean
        }
        Update: {
          account_size?: number | null
          category_id?: string
          created_at?: string
          currency?: string
          current_balance?: number | null
          deleted_at?: string | null
          id?: string
          name?: string
          operation_state?: string | null
          phase_status?: string | null
          role?: string | null
          sort_index?: number
          status?: string
          updated_at?: string
          user_id?: string
          withdrawals_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "accounts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "account_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          capabilities: string[] | null
          completeness: number | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          division: string
          id: string
          metadata: Json | null
          model: string | null
          name: string
          parent_agent_id: string | null
          priority: string | null
          project_id: string
          role: string
          sort_index: number | null
          status: string | null
          tier: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          capabilities?: string[] | null
          completeness?: number | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          division: string
          id?: string
          metadata?: Json | null
          model?: string | null
          name: string
          parent_agent_id?: string | null
          priority?: string | null
          project_id: string
          role: string
          sort_index?: number | null
          status?: string | null
          tier?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          capabilities?: string[] | null
          completeness?: number | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          division?: string
          id?: string
          metadata?: Json | null
          model?: string | null
          name?: string
          parent_agent_id?: string | null
          priority?: string | null
          project_id?: string
          role?: string
          sort_index?: number | null
          status?: string | null
          tier?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agents_parent_agent_id_fkey"
            columns: ["parent_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "lattice_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      app_logs: {
        Row: {
          area: string
          created_at: string
          deleted_at: string | null
          fingerprint: string
          id: string
          level: string
          message: string
          meta: Json | null
          resolved_at: string | null
          url: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          area: string
          created_at?: string
          deleted_at?: string | null
          fingerprint: string
          id?: string
          level: string
          message: string
          meta?: Json | null
          resolved_at?: string | null
          url?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          area?: string
          created_at?: string
          deleted_at?: string | null
          fingerprint?: string
          id?: string
          level?: string
          message?: string
          meta?: Json | null
          resolved_at?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      app_update_events: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json
          update_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json
          update_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json
          update_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_update_events_update_id_fkey"
            columns: ["update_id"]
            isOneToOne: false
            referencedRelation: "active_app_update"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_update_events_update_id_fkey"
            columns: ["update_id"]
            isOneToOne: false
            referencedRelation: "app_updates"
            referencedColumns: ["id"]
          },
        ]
      }
      app_updates: {
        Row: {
          build_hash: string
          created_at: string
          created_by: string | null
          force_refresh: boolean
          id: string
          is_active: boolean
          version: string
        }
        Insert: {
          build_hash: string
          created_at?: string
          created_by?: string | null
          force_refresh?: boolean
          id?: string
          is_active?: boolean
          version: string
        }
        Update: {
          build_hash?: string
          created_at?: string
          created_by?: string | null
          force_refresh?: boolean
          id?: string
          is_active?: boolean
          version?: string
        }
        Relationships: []
      }
      bot_accounts: {
        Row: {
          account_id: string
          app_account_id: string | null
          bot_id: string
          created_at: string
          id: string
          label: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          app_account_id?: string | null
          bot_id: string
          created_at?: string
          id?: string
          label?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          app_account_id?: string | null
          bot_id?: string
          created_at?: string
          id?: string
          label?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_accounts_app_account_id_fkey"
            columns: ["app_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_accounts_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_active_skill: {
        Row: {
          activated_at: string | null
          created_at: string
          id: string
          instrument: string
          llm_rules: Json | null
          q_table_path: string | null
          skill_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          id?: string
          instrument?: string
          llm_rules?: Json | null
          q_table_path?: string | null
          skill_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          id?: string
          instrument?: string
          llm_rules?: Json | null
          q_table_path?: string | null
          skill_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_active_skill_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "bot_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_command_status: {
        Row: {
          acked_at: string | null
          bot_account_id: string
          command_id: string
          created_at: string
          id: string
          message: string | null
          status: string
          updated_at: string
        }
        Insert: {
          acked_at?: string | null
          bot_account_id: string
          command_id: string
          created_at?: string
          id?: string
          message?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          acked_at?: string | null
          bot_account_id?: string
          command_id?: string
          created_at?: string
          id?: string
          message?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_command_status_bot_account_id_fkey"
            columns: ["bot_account_id"]
            isOneToOne: false
            referencedRelation: "bot_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_command_status_command_id_fkey"
            columns: ["command_id"]
            isOneToOne: false
            referencedRelation: "bot_commands"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_commands: {
        Row: {
          bot_id: string
          command_type: string
          created_at: string
          created_by: string | null
          id: string
          payload: Json
          status: string
          target_scope: string
          updated_at: string
        }
        Insert: {
          bot_id: string
          command_type: string
          created_at?: string
          created_by?: string | null
          id?: string
          payload?: Json
          status?: string
          target_scope?: string
          updated_at?: string
        }
        Update: {
          bot_id?: string
          command_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          payload?: Json
          status?: string
          target_scope?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_commands_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_events: {
        Row: {
          bot_account_id: string | null
          bot_id: string
          created_at: string
          event_type: string
          id: string
          payload: Json
        }
        Insert: {
          bot_account_id?: string | null
          bot_id: string
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
        }
        Update: {
          bot_account_id?: string | null
          bot_id?: string
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "bot_events_bot_account_id_fkey"
            columns: ["bot_account_id"]
            isOneToOne: false
            referencedRelation: "bot_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_events_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_instances: {
        Row: {
          bot_account_id: string
          created_at: string
          id: string
          instance_id: string
          is_paper_mode: boolean
          last_heartbeat_at: string | null
          platform: string
          status: string
          updated_at: string
        }
        Insert: {
          bot_account_id: string
          created_at?: string
          id?: string
          instance_id: string
          is_paper_mode?: boolean
          last_heartbeat_at?: string | null
          platform?: string
          status?: string
          updated_at?: string
        }
        Update: {
          bot_account_id?: string
          created_at?: string
          id?: string
          instance_id?: string
          is_paper_mode?: boolean
          last_heartbeat_at?: string | null
          platform?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_instances_bot_account_id_fkey"
            columns: ["bot_account_id"]
            isOneToOne: false
            referencedRelation: "bot_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_regime_states: {
        Row: {
          bot_instance_id: string
          confidence: number
          created_at: string
          detected_at: string
          features_snapshot: Json
          hmm_state_probs: Json
          hmm_viterbi_path: Json | null
          id: string
          is_cold_start: boolean
          regime_code: string
          strategy_applied: string
          user_id: string
        }
        Insert: {
          bot_instance_id: string
          confidence?: number
          created_at?: string
          detected_at?: string
          features_snapshot?: Json
          hmm_state_probs?: Json
          hmm_viterbi_path?: Json | null
          id?: string
          is_cold_start?: boolean
          regime_code: string
          strategy_applied?: string
          user_id?: string
        }
        Update: {
          bot_instance_id?: string
          confidence?: number
          created_at?: string
          detected_at?: string
          features_snapshot?: Json
          hmm_state_probs?: Json
          hmm_viterbi_path?: Json | null
          id?: string
          is_cold_start?: boolean
          regime_code?: string
          strategy_applied?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_regime_states_bot_instance_id_fkey"
            columns: ["bot_instance_id"]
            isOneToOne: false
            referencedRelation: "bot_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_settings_global: {
        Row: {
          bot_id: string
          created_at: string
          id: string
          settings: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bot_id: string
          created_at?: string
          id?: string
          settings?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bot_id?: string
          created_at?: string
          id?: string
          settings?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_settings_global_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_settings_override: {
        Row: {
          bot_account_id: string
          created_at: string
          id: string
          settings: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bot_account_id: string
          created_at?: string
          id?: string
          settings?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bot_account_id?: string
          created_at?: string
          id?: string
          settings?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_settings_override_bot_account_id_fkey"
            columns: ["bot_account_id"]
            isOneToOne: false
            referencedRelation: "bot_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_signal_engine_state: {
        Row: {
          bot_instance_id: string
          circuit_breaker_at: string | null
          circuit_breaker_reason: string | null
          circuit_breaker_triggered: boolean
          created_at: string
          current_equity: number | null
          daily_pnl_pct: number
          id: string
          kelly_current: number | null
          ops_count: number
          quantum_state: Json | null
          regime_code: string | null
          session_base_equity: number | null
          session_close: string | null
          session_date: string
          session_open: string | null
          updated_at: string
          user_id: string
          vol_target_current: number | null
        }
        Insert: {
          bot_instance_id: string
          circuit_breaker_at?: string | null
          circuit_breaker_reason?: string | null
          circuit_breaker_triggered?: boolean
          created_at?: string
          current_equity?: number | null
          daily_pnl_pct?: number
          id?: string
          kelly_current?: number | null
          ops_count?: number
          quantum_state?: Json | null
          regime_code?: string | null
          session_base_equity?: number | null
          session_close?: string | null
          session_date: string
          session_open?: string | null
          updated_at?: string
          user_id?: string
          vol_target_current?: number | null
        }
        Update: {
          bot_instance_id?: string
          circuit_breaker_at?: string | null
          circuit_breaker_reason?: string | null
          circuit_breaker_triggered?: boolean
          created_at?: string
          current_equity?: number | null
          daily_pnl_pct?: number
          id?: string
          kelly_current?: number | null
          ops_count?: number
          quantum_state?: Json | null
          regime_code?: string | null
          session_base_equity?: number | null
          session_close?: string | null
          session_date?: string
          session_open?: string | null
          updated_at?: string
          user_id?: string
          vol_target_current?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_signal_engine_state_bot_instance_id_fkey"
            columns: ["bot_instance_id"]
            isOneToOne: false
            referencedRelation: "bot_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_skill_audit_log: {
        Row: {
          created_at: string
          epsilon_after: number | null
          epsilon_before: number | null
          event_type: string
          id: string
          llm_rules_generated: number | null
          notes: string | null
          params_after: Json | null
          params_before: Json | null
          performance_delta: Json | null
          reward_avg: number | null
          rl_episode_count: number | null
          skill_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          epsilon_after?: number | null
          epsilon_before?: number | null
          event_type: string
          id?: string
          llm_rules_generated?: number | null
          notes?: string | null
          params_after?: Json | null
          params_before?: Json | null
          performance_delta?: Json | null
          reward_avg?: number | null
          rl_episode_count?: number | null
          skill_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          epsilon_after?: number | null
          epsilon_before?: number | null
          event_type?: string
          id?: string
          llm_rules_generated?: number | null
          notes?: string | null
          params_after?: Json | null
          params_before?: Json | null
          performance_delta?: Json | null
          reward_avg?: number | null
          rl_episode_count?: number | null
          skill_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_skill_audit_log_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "bot_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_skills: {
        Row: {
          approval_requested_at: string | null
          approved_at: string | null
          created_at: string
          deleted_at: string | null
          environment: string
          epsilon_current: number
          id: string
          instrument: string
          model_blob_path: string | null
          model_version: number
          notes: string | null
          performance_after: Json | null
          performance_before: Json | null
          skill_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approval_requested_at?: string | null
          approved_at?: string | null
          created_at?: string
          deleted_at?: string | null
          environment?: string
          epsilon_current?: number
          id?: string
          instrument?: string
          model_blob_path?: string | null
          model_version?: number
          notes?: string | null
          performance_after?: Json | null
          performance_before?: Json | null
          skill_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          approval_requested_at?: string | null
          approved_at?: string | null
          created_at?: string
          deleted_at?: string | null
          environment?: string
          epsilon_current?: number
          id?: string
          instrument?: string
          model_blob_path?: string | null
          model_version?: number
          notes?: string | null
          performance_after?: Json | null
          performance_before?: Json | null
          skill_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bot_telemetry: {
        Row: {
          balance: number | null
          basket_r: number | null
          bot_account_id: string
          created_at: string
          equity: number | null
          id: string
          instance_id: string
          last_heartbeat_ts: string | null
          last_signal_text: string | null
          last_signal_ts: string | null
          payload: Json
          positions_buy: number | null
          positions_sell: number | null
          positions_total: number | null
          tier: string | null
          updated_at: string
        }
        Insert: {
          balance?: number | null
          basket_r?: number | null
          bot_account_id: string
          created_at?: string
          equity?: number | null
          id?: string
          instance_id: string
          last_heartbeat_ts?: string | null
          last_signal_text?: string | null
          last_signal_ts?: string | null
          payload?: Json
          positions_buy?: number | null
          positions_sell?: number | null
          positions_total?: number | null
          tier?: string | null
          updated_at?: string
        }
        Update: {
          balance?: number | null
          basket_r?: number | null
          bot_account_id?: string
          created_at?: string
          equity?: number | null
          id?: string
          instance_id?: string
          last_heartbeat_ts?: string | null
          last_signal_text?: string | null
          last_signal_ts?: string | null
          payload?: Json
          positions_buy?: number | null
          positions_sell?: number | null
          positions_total?: number | null
          tier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_telemetry_bot_account_id_fkey"
            columns: ["bot_account_id"]
            isOneToOne: false
            referencedRelation: "bot_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      bots: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      business_alert_history: {
        Row: {
          alert_month: string | null
          alert_type: string
          created_at: string
          id: string
          subscriptions_sent: number
          user_id: string
        }
        Insert: {
          alert_month?: string | null
          alert_type: string
          created_at?: string
          id?: string
          subscriptions_sent?: number
          user_id: string
        }
        Update: {
          alert_month?: string | null
          alert_type?: string
          created_at?: string
          id?: string
          subscriptions_sent?: number
          user_id?: string
        }
        Relationships: []
      }
      business_cost_templates: {
        Row: {
          active: boolean
          amount: number
          category: string
          created_at: string
          day_of_month: number
          deleted_at: string | null
          description: string
          id: string
          last_generated_month: string | null
          sort_index: number
          start_month: string
          updated_at: string
          user_id: string
          vendor: string
        }
        Insert: {
          active?: boolean
          amount: number
          category: string
          created_at?: string
          day_of_month: number
          deleted_at?: string | null
          description: string
          id?: string
          last_generated_month?: string | null
          sort_index?: number
          start_month: string
          updated_at?: string
          user_id: string
          vendor: string
        }
        Update: {
          active?: boolean
          amount?: number
          category?: string
          created_at?: string
          day_of_month?: number
          deleted_at?: string | null
          description?: string
          id?: string
          last_generated_month?: string | null
          sort_index?: number
          start_month?: string
          updated_at?: string
          user_id?: string
          vendor?: string
        }
        Relationships: []
      }
      business_costs: {
        Row: {
          amount: number
          category: string
          cost_date: string
          created_at: string
          deleted_at: string | null
          description: string
          id: string
          is_recurring_instance: boolean
          sort_index: number
          template_id: string | null
          updated_at: string
          user_id: string
          vendor: string
        }
        Insert: {
          amount: number
          category: string
          cost_date: string
          created_at?: string
          deleted_at?: string | null
          description: string
          id?: string
          is_recurring_instance?: boolean
          sort_index?: number
          template_id?: string | null
          updated_at?: string
          user_id: string
          vendor: string
        }
        Update: {
          amount?: number
          category?: string
          cost_date?: string
          created_at?: string
          deleted_at?: string | null
          description?: string
          id?: string
          is_recurring_instance?: boolean
          sort_index?: number
          template_id?: string | null
          updated_at?: string
          user_id?: string
          vendor?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_costs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "business_cost_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      business_decision_tasks: {
        Row: {
          created_at: string
          decision_id: string
          deleted_at: string | null
          done: boolean
          id: string
          sort_index: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decision_id: string
          deleted_at?: string | null
          done?: boolean
          id?: string
          sort_index?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decision_id?: string
          deleted_at?: string | null
          done?: boolean
          id?: string
          sort_index?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_decision_tasks_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "business_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      business_decisions: {
        Row: {
          context: string
          created_at: string
          decision: string
          deleted_at: string | null
          id: string
          impact: string
          priority: string
          rationale: string
          sort_index: number
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          context: string
          created_at?: string
          decision: string
          deleted_at?: string | null
          id?: string
          impact: string
          priority?: string
          rationale: string
          sort_index?: number
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          context?: string
          created_at?: string
          decision?: string
          deleted_at?: string | null
          id?: string
          impact?: string
          priority?: string
          rationale?: string
          sort_index?: number
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      business_milestones: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string
          goal_id: string | null
          id: string
          notes: string | null
          sort_index: number
          status: string
          target_date: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description: string
          goal_id?: string | null
          id?: string
          notes?: string | null
          sort_index?: number
          status?: string
          target_date?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string
          goal_id?: string | null
          id?: string
          notes?: string | null
          sort_index?: number
          status?: string
          target_date?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_milestones_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "tradermap_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      business_sop_items: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          label: string
          sop_id: string
          sort_index: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          label: string
          sop_id: string
          sort_index?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          label?: string
          sop_id?: string
          sort_index?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_sop_items_sop_id_fkey"
            columns: ["sop_id"]
            isOneToOne: false
            referencedRelation: "business_sops"
            referencedColumns: ["id"]
          },
        ]
      }
      business_sop_run_items: {
        Row: {
          checked: boolean
          checked_at: string | null
          created_at: string
          deleted_at: string | null
          id: string
          item_id: string
          note: string | null
          run_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          checked?: boolean
          checked_at?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          item_id: string
          note?: string | null
          run_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          checked?: boolean
          checked_at?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          item_id?: string
          note?: string | null
          run_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_sop_run_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "business_sop_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_sop_run_items_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "business_sop_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      business_sop_runs: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          notes: string | null
          run_date: string
          sop_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          notes?: string | null
          run_date: string
          sop_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          notes?: string | null
          run_date?: string
          sop_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_sop_runs_sop_id_fkey"
            columns: ["sop_id"]
            isOneToOne: false
            referencedRelation: "business_sops"
            referencedColumns: ["id"]
          },
        ]
      }
      business_sops: {
        Row: {
          content: string
          created_at: string
          deleted_at: string | null
          id: string
          sort_index: number
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          sort_index?: number
          title: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          sort_index?: number
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          name_lower: string | null
          sort_index: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          name_lower?: string | null
          sort_index?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          name_lower?: string | null
          sort_index?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          account_id: string | null
          active_quarter: string | null
          created_at: string
          deleted_at: string | null
          id: string
          q1_end_date: string | null
          q1_start_balance: number | null
          q1_start_date: string | null
          q1_target_balance: number | null
          q2_end_date: string | null
          q2_start_balance: number | null
          q2_start_date: string | null
          q2_target_balance: number | null
          q3_end_date: string | null
          q3_start_balance: number | null
          q3_start_date: string | null
          q3_target_balance: number | null
          q4_end_date: string | null
          q4_start_balance: number | null
          q4_start_date: string | null
          q4_target_balance: number | null
          title: string | null
          updated_at: string
          user_id: string | null
          year: number | null
        }
        Insert: {
          account_id?: string | null
          active_quarter?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          q1_end_date?: string | null
          q1_start_balance?: number | null
          q1_start_date?: string | null
          q1_target_balance?: number | null
          q2_end_date?: string | null
          q2_start_balance?: number | null
          q2_start_date?: string | null
          q2_target_balance?: number | null
          q3_end_date?: string | null
          q3_start_balance?: number | null
          q3_start_date?: string | null
          q3_target_balance?: number | null
          q4_end_date?: string | null
          q4_start_balance?: number | null
          q4_start_date?: string | null
          q4_target_balance?: number | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
          year?: number | null
        }
        Update: {
          account_id?: string | null
          active_quarter?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          q1_end_date?: string | null
          q1_start_balance?: number | null
          q1_start_date?: string | null
          q1_target_balance?: number | null
          q2_end_date?: string | null
          q2_start_balance?: number | null
          q2_start_date?: string | null
          q2_target_balance?: number | null
          q3_end_date?: string | null
          q3_start_balance?: number | null
          q3_start_date?: string | null
          q3_target_balance?: number | null
          q4_end_date?: string | null
          q4_start_balance?: number | null
          q4_start_date?: string | null
          q4_target_balance?: number | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "goals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      instruments: {
        Row: {
          created_at: string
          display_name: string
          id: string
          sort_index: number
          symbol: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          sort_index?: number
          symbol: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          sort_index?: number
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      intelligence_capital_accounts: {
        Row: {
          account_name: string
          account_type: string
          created_at: string
          current_capital: number
          deleted_at: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name: string
          account_type: string
          created_at?: string
          current_capital: number
          deleted_at?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string
          account_type?: string
          created_at?: string
          current_capital?: number
          deleted_at?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      intelligence_capital_targets: {
        Row: {
          account_type: string
          capital_account_id: string | null
          created_at: string
          custom_current_capital: number | null
          custom_current_updated_at: string | null
          deleted_at: string | null
          id: string
          manual_annual_pct: number | null
          manual_monthly_pct: number | null
          manual_quarterly_pct: number | null
          manual_semiannual_pct: number | null
          manual_updated_at: string | null
          target_capital: number
          target_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type: string
          capital_account_id?: string | null
          created_at?: string
          custom_current_capital?: number | null
          custom_current_updated_at?: string | null
          deleted_at?: string | null
          id?: string
          manual_annual_pct?: number | null
          manual_monthly_pct?: number | null
          manual_quarterly_pct?: number | null
          manual_semiannual_pct?: number | null
          manual_updated_at?: string | null
          target_capital: number
          target_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: string
          capital_account_id?: string | null
          created_at?: string
          custom_current_capital?: number | null
          custom_current_updated_at?: string | null
          deleted_at?: string | null
          id?: string
          manual_annual_pct?: number | null
          manual_monthly_pct?: number | null
          manual_quarterly_pct?: number | null
          manual_semiannual_pct?: number | null
          manual_updated_at?: string | null
          target_capital?: number
          target_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intelligence_capital_targets_capital_account_id_fkey"
            columns: ["capital_account_id"]
            isOneToOne: false
            referencedRelation: "intelligence_capital_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      iv_surface_snapshots: {
        Row: {
          created_at: string
          heston_kappa: number
          heston_rho: number
          heston_sigma: number
          heston_theta: number
          heston_v0: number
          id: string
          instrument: string
          realized_vol_15m: number | null
          realized_vol_1h: number | null
          snapshot_at: string
          spot_price: number
          surface_grid: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          heston_kappa: number
          heston_rho: number
          heston_sigma: number
          heston_theta: number
          heston_v0: number
          id?: string
          instrument?: string
          realized_vol_15m?: number | null
          realized_vol_1h?: number | null
          snapshot_at?: string
          spot_price: number
          surface_grid?: Json
          user_id?: string
        }
        Update: {
          created_at?: string
          heston_kappa?: number
          heston_rho?: number
          heston_sigma?: number
          heston_theta?: number
          heston_v0?: number
          id?: string
          instrument?: string
          realized_vol_15m?: number | null
          realized_vol_1h?: number | null
          snapshot_at?: string
          spot_price?: number
          surface_grid?: Json
          user_id?: string
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          content: string | null
          created_at: string
          date: string | null
          deleted_at: string | null
          id: string
          mood: string
          tags: string[]
          title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          date?: string | null
          deleted_at?: string | null
          id?: string
          mood: string
          tags: string[]
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          date?: string | null
          deleted_at?: string | null
          id?: string
          mood?: string
          tags?: string[]
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      lattice_agent_package_items: {
        Row: {
          description: string | null
          division: string
          id: string
          model: string | null
          name: string
          package_id: string
          parent_item_name: string | null
          priority: string | null
          role: string
          sort_index: number | null
          tier: string | null
        }
        Insert: {
          description?: string | null
          division: string
          id?: string
          model?: string | null
          name: string
          package_id: string
          parent_item_name?: string | null
          priority?: string | null
          role: string
          sort_index?: number | null
          tier?: string | null
        }
        Update: {
          description?: string | null
          division?: string
          id?: string
          model?: string | null
          name?: string
          package_id?: string
          parent_item_name?: string | null
          priority?: string | null
          role?: string
          sort_index?: number | null
          tier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lattice_agent_package_items_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "lattice_agent_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      lattice_agent_packages: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_default: boolean | null
          name: string
          version: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          version?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          version?: string | null
        }
        Relationships: []
      }
      lattice_projects: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          description: string | null
          id: string
          metadata: Json | null
          name: string
          slug: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          name: string
          slug: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          slug?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      live_market_data: {
        Row: {
          ask: number
          bid: number
          created_at: string
          id: string
          last: number
          raw_payload: Json
          received_at: string
          source: string
          symbol: string
          token_ok: boolean
          updated_at: string
        }
        Insert: {
          ask: number
          bid: number
          created_at?: string
          id?: string
          last: number
          raw_payload?: Json
          received_at?: string
          source?: string
          symbol: string
          token_ok?: boolean
          updated_at?: string
        }
        Update: {
          ask?: number
          bid?: number
          created_at?: string
          id?: string
          last?: number
          raw_payload?: Json
          received_at?: string
          source?: string
          symbol?: string
          token_ok?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      llc_inbox_items: {
        Row: {
          attachment_path: string | null
          created_at: string
          deleted_at: string | null
          id: string
          notes: string | null
          received_on: string
          sort_index: number
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attachment_path?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          notes?: string | null
          received_on: string
          sort_index?: number
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attachment_path?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          notes?: string | null
          received_on?: string
          sort_index?: number
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      llc_info: {
        Row: {
          annual_fee_baseline: number
          annual_report_due_month: number
          created_at: string
          deleted_at: string | null
          ein: string
          formation_date: string | null
          id: string
          last_annual_report_push_year: number | null
          llc_name: string
          notes: string | null
          registered_agent_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          annual_fee_baseline?: number
          annual_report_due_month: number
          created_at?: string
          deleted_at?: string | null
          ein: string
          formation_date?: string | null
          id?: string
          last_annual_report_push_year?: number | null
          llc_name: string
          notes?: string | null
          registered_agent_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          annual_fee_baseline?: number
          annual_report_due_month?: number
          created_at?: string
          deleted_at?: string | null
          ein?: string
          formation_date?: string | null
          id?: string
          last_annual_report_push_year?: number | null
          llc_name?: string
          notes?: string | null
          registered_agent_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      log_attachments: {
        Row: {
          created_at: string
          deleted_at: string | null
          filename: string
          id: string
          log_id: string
          mime_type: string | null
          path: string
          size_bytes: number | null
          sort_index: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          filename: string
          id?: string
          log_id: string
          mime_type?: string | null
          path: string
          size_bytes?: number | null
          sort_index?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          filename?: string
          id?: string
          log_id?: string
          mime_type?: string | null
          path?: string
          size_bytes?: number | null
          sort_index?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "log_attachments_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "logs"
            referencedColumns: ["id"]
          },
        ]
      }
      log_tags: {
        Row: {
          created_at: string
          log_id: string
          tag_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          log_id: string
          tag_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          log_id?: string
          tag_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "log_tags_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      logs: {
        Row: {
          category_id: string
          created_at: string
          created_day_utc: string | null
          deleted_at: string | null
          id: string
          notes: string
          sort_index: number
          title: string
          title_lower: string | null
          type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          created_day_utc?: string | null
          deleted_at?: string | null
          id?: string
          notes: string
          sort_index?: number
          title: string
          title_lower?: string | null
          type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          created_day_utc?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string
          sort_index?: number
          title?: string
          title_lower?: string | null
          type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "logs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      paper_trades: {
        Row: {
          account_id: string
          created_at: string
          deleted_at: string | null
          direction: string
          entry_date: string
          entry_price: number
          exit_date: string | null
          exit_price: number
          id: string
          is_featured_in_report: boolean
          is_paper: boolean
          lots: number
          notes: string | null
          pnl: number
          pnl_percent: number
          screenshot_path: string | null
          setup_id: string | null
          sort_index: number
          status: string
          stop_loss_price: number
          symbol: string
          take_profit_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          deleted_at?: string | null
          direction: string
          entry_date: string
          entry_price: number
          exit_date?: string | null
          exit_price: number
          id?: string
          is_featured_in_report?: boolean
          is_paper?: boolean
          lots: number
          notes?: string | null
          pnl: number
          pnl_percent: number
          screenshot_path?: string | null
          setup_id?: string | null
          sort_index?: number
          status: string
          stop_loss_price: number
          symbol: string
          take_profit_price: number
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          deleted_at?: string | null
          direction?: string
          entry_date?: string
          entry_price?: number
          exit_date?: string | null
          exit_price?: number
          id?: string
          is_featured_in_report?: boolean
          is_paper?: boolean
          lots?: number
          notes?: string | null
          pnl?: number
          pnl_percent?: number
          screenshot_path?: string | null
          setup_id?: string | null
          sort_index?: number
          status?: string
          stop_loss_price?: number
          symbol?: string
          take_profit_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "paper_trades_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paper_trades_setup_id_fkey"
            columns: ["setup_id"]
            isOneToOne: false
            referencedRelation: "setups"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_setup_current: {
        Row: {
          current_version_id: string
          group_id: string
          updated_at: string
        }
        Insert: {
          current_version_id: string
          group_id: string
          updated_at?: string
        }
        Update: {
          current_version_id?: string
          group_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "playbook_setup_current_current_version_id_fkey"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "playbook_setup_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_setup_current_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: true
            referencedRelation: "playbook_setup_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_setup_groups: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          name_lower: string | null
          sort_index: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          name_lower?: string | null
          sort_index?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          name_lower?: string | null
          sort_index?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      playbook_setup_versions: {
        Row: {
          checklist: string | null
          created_at: string
          description: string | null
          group_id: string
          id: string
          user_id: string
          version: number
        }
        Insert: {
          checklist?: string | null
          created_at?: string
          description?: string | null
          group_id: string
          id?: string
          user_id: string
          version: number
        }
        Update: {
          checklist?: string | null
          created_at?: string
          description?: string | null
          group_id?: string
          id?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "playbook_setup_versions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "playbook_setup_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      polyarb_agents: {
        Row: {
          api_key_encrypted: string | null
          api_passphrase_encrypted: string | null
          api_secret_encrypted: string | null
          config: Json
          created_at: string
          deleted_at: string | null
          fly_instance_id: string | null
          id: string
          last_heartbeat_at: string | null
          name: string
          starting_capital_usd: number | null
          status: string
          updated_at: string
          user_id: string
          wallet_address: string | null
        }
        Insert: {
          api_key_encrypted?: string | null
          api_passphrase_encrypted?: string | null
          api_secret_encrypted?: string | null
          config?: Json
          created_at?: string
          deleted_at?: string | null
          fly_instance_id?: string | null
          id?: string
          last_heartbeat_at?: string | null
          name?: string
          starting_capital_usd?: number | null
          status?: string
          updated_at?: string
          user_id: string
          wallet_address?: string | null
        }
        Update: {
          api_key_encrypted?: string | null
          api_passphrase_encrypted?: string | null
          api_secret_encrypted?: string | null
          config?: Json
          created_at?: string
          deleted_at?: string | null
          fly_instance_id?: string | null
          id?: string
          last_heartbeat_at?: string | null
          name?: string
          starting_capital_usd?: number | null
          status?: string
          updated_at?: string
          user_id?: string
          wallet_address?: string | null
        }
        Relationships: []
      }
      polyarb_circuit_breaker_events: {
        Row: {
          action_taken: string
          agent_id: string
          created_at: string
          detail: string | null
          equity_at_trigger: number | null
          id: string
          payload: Json | null
          severity: string
          trigger_type: string
          user_id: string
        }
        Insert: {
          action_taken: string
          agent_id: string
          created_at?: string
          detail?: string | null
          equity_at_trigger?: number | null
          id?: string
          payload?: Json | null
          severity: string
          trigger_type: string
          user_id: string
        }
        Update: {
          action_taken?: string
          agent_id?: string
          created_at?: string
          detail?: string | null
          equity_at_trigger?: number | null
          id?: string
          payload?: Json | null
          severity?: string
          trigger_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "polyarb_circuit_breaker_events_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "polyarb_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      polyarb_compliance_audit: {
        Row: {
          after_state: Json | null
          agent_id: string
          before_state: Json | null
          created_at: string
          entity_id: string | null
          entity_table: string | null
          event_type: string
          id: string
          user_id: string
        }
        Insert: {
          after_state?: Json | null
          agent_id: string
          before_state?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_table?: string | null
          event_type: string
          id?: string
          user_id: string
        }
        Update: {
          after_state?: Json | null
          agent_id?: string
          before_state?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_table?: string | null
          event_type?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "polyarb_compliance_audit_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "polyarb_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      polyarb_equity_snapshots: {
        Row: {
          agent_id: string
          btc_price: number | null
          equity_usd: number
          id: string
          open_positions: number
          pnl_usd: number
          snapshot_at: string
          user_id: string
        }
        Insert: {
          agent_id: string
          btc_price?: number | null
          equity_usd: number
          id?: string
          open_positions?: number
          pnl_usd?: number
          snapshot_at?: string
          user_id: string
        }
        Update: {
          agent_id?: string
          btc_price?: number | null
          equity_usd?: number
          id?: string
          open_positions?: number
          pnl_usd?: number
          snapshot_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "polyarb_equity_snapshots_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "polyarb_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      polyarb_positions: {
        Row: {
          agent_id: string
          closed_at: string | null
          condition_id: string | null
          created_at: string
          deleted_at: string | null
          entry_price: number | null
          entry_reason: Json | null
          exit_price: number | null
          exit_reason: string | null
          id: string
          leverage_used: number | null
          market_slug: string
          opened_at: string | null
          outcome: string
          pnl_percent: number | null
          pnl_usd: number | null
          shares: number | null
          side: string
          size_usd: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_id: string
          closed_at?: string | null
          condition_id?: string | null
          created_at?: string
          deleted_at?: string | null
          entry_price?: number | null
          entry_reason?: Json | null
          exit_price?: number | null
          exit_reason?: string | null
          id?: string
          leverage_used?: number | null
          market_slug: string
          opened_at?: string | null
          outcome: string
          pnl_percent?: number | null
          pnl_usd?: number | null
          shares?: number | null
          side: string
          size_usd?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_id?: string
          closed_at?: string | null
          condition_id?: string | null
          created_at?: string
          deleted_at?: string | null
          entry_price?: number | null
          entry_reason?: Json | null
          exit_price?: number | null
          exit_reason?: string | null
          id?: string
          leverage_used?: number | null
          market_slug?: string
          opened_at?: string | null
          outcome?: string
          pnl_percent?: number | null
          pnl_usd?: number | null
          shares?: number | null
          side?: string
          size_usd?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "polyarb_positions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "polyarb_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      polyarb_signal_memory: {
        Row: {
          agent_id: string
          closed_at: string | null
          condition_id: string
          created_at: string | null
          distance_zone: string
          edge_at_entry: number
          entered_at: string
          hunt_bucket: string
          id: string
          outcome: string | null
          pnl_usd: number | null
          regime: string
          symbol: string
          user_id: string
          velocity_alignment: string
        }
        Insert: {
          agent_id: string
          closed_at?: string | null
          condition_id: string
          created_at?: string | null
          distance_zone: string
          edge_at_entry: number
          entered_at: string
          hunt_bucket: string
          id: string
          outcome?: string | null
          pnl_usd?: number | null
          regime: string
          symbol: string
          user_id: string
          velocity_alignment: string
        }
        Update: {
          agent_id?: string
          closed_at?: string | null
          condition_id?: string
          created_at?: string | null
          distance_zone?: string
          edge_at_entry?: number
          entered_at?: string
          hunt_bucket?: string
          id?: string
          outcome?: string | null
          pnl_usd?: number | null
          regime?: string
          symbol?: string
          user_id?: string
          velocity_alignment?: string
        }
        Relationships: []
      }
      polyarb_telemetry: {
        Row: {
          adaptive_kelly_state: Json | null
          agent_id: string
          available_balance_usd: number | null
          btc_spot_price: number | null
          consecutive_losses: number | null
          consecutive_wins: number | null
          created_at: string
          cross_market_snapshot: Json | null
          equity_usd: number | null
          error_count_1h: number | null
          id: string
          last_heartbeat_at: string
          last_signal: Json | null
          loop_latency_ms: number | null
          max_drawdown_pct: number | null
          memory_bank_stats: Json | null
          open_positions_count: number | null
          payload: Json | null
          profit_factor: number | null
          regime_snapshot: Json | null
          sentiment_snapshot: Json | null
          sharpe_ratio: number | null
          total_pnl_usd: number | null
          updated_at: string
          user_id: string
          velocity_snapshot: Json | null
          win_rate: number | null
          ws_binance_connected: boolean | null
          ws_polymarket_connected: boolean | null
        }
        Insert: {
          adaptive_kelly_state?: Json | null
          agent_id: string
          available_balance_usd?: number | null
          btc_spot_price?: number | null
          consecutive_losses?: number | null
          consecutive_wins?: number | null
          created_at?: string
          cross_market_snapshot?: Json | null
          equity_usd?: number | null
          error_count_1h?: number | null
          id?: string
          last_heartbeat_at?: string
          last_signal?: Json | null
          loop_latency_ms?: number | null
          max_drawdown_pct?: number | null
          memory_bank_stats?: Json | null
          open_positions_count?: number | null
          payload?: Json | null
          profit_factor?: number | null
          regime_snapshot?: Json | null
          sentiment_snapshot?: Json | null
          sharpe_ratio?: number | null
          total_pnl_usd?: number | null
          updated_at?: string
          user_id: string
          velocity_snapshot?: Json | null
          win_rate?: number | null
          ws_binance_connected?: boolean | null
          ws_polymarket_connected?: boolean | null
        }
        Update: {
          adaptive_kelly_state?: Json | null
          agent_id?: string
          available_balance_usd?: number | null
          btc_spot_price?: number | null
          consecutive_losses?: number | null
          consecutive_wins?: number | null
          created_at?: string
          cross_market_snapshot?: Json | null
          equity_usd?: number | null
          error_count_1h?: number | null
          id?: string
          last_heartbeat_at?: string
          last_signal?: Json | null
          loop_latency_ms?: number | null
          max_drawdown_pct?: number | null
          memory_bank_stats?: Json | null
          open_positions_count?: number | null
          payload?: Json | null
          profit_factor?: number | null
          regime_snapshot?: Json | null
          sentiment_snapshot?: Json | null
          sharpe_ratio?: number | null
          total_pnl_usd?: number | null
          updated_at?: string
          user_id?: string
          velocity_snapshot?: Json | null
          win_rate?: number | null
          ws_binance_connected?: boolean | null
          ws_polymarket_connected?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "polyarb_telemetry_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "polyarb_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      polyarb_trades: {
        Row: {
          agent_id: string
          condition_id: string | null
          created_at: string
          executed_at: string
          execution_latency_ms: number | null
          fee_rate_bps: number | null
          fee_usd: number | null
          id: string
          market_slug: string | null
          order_id: string | null
          order_signature: string | null
          outcome: string | null
          position_id: string | null
          price: number
          raw_response: Json | null
          side: string
          size: number
          size_usd: number | null
          slippage_bps: number | null
          status: string
          user_id: string
        }
        Insert: {
          agent_id: string
          condition_id?: string | null
          created_at?: string
          executed_at?: string
          execution_latency_ms?: number | null
          fee_rate_bps?: number | null
          fee_usd?: number | null
          id?: string
          market_slug?: string | null
          order_id?: string | null
          order_signature?: string | null
          outcome?: string | null
          position_id?: string | null
          price: number
          raw_response?: Json | null
          side: string
          size: number
          size_usd?: number | null
          slippage_bps?: number | null
          status?: string
          user_id: string
        }
        Update: {
          agent_id?: string
          condition_id?: string | null
          created_at?: string
          executed_at?: string
          execution_latency_ms?: number | null
          fee_rate_bps?: number | null
          fee_usd?: number | null
          id?: string
          market_slug?: string | null
          order_id?: string | null
          order_signature?: string | null
          outcome?: string | null
          position_id?: string | null
          price?: number
          raw_response?: Json | null
          side?: string
          size?: number
          size_usd?: number | null
          slippage_bps?: number | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "polyarb_trades_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "polyarb_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polyarb_trades_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "polyarb_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          occurred_at: string
          ref_id: string | null
          ref_table: string | null
          user_id: string
          xp_delta: number
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          occurred_at?: string
          ref_id?: string | null
          ref_table?: string | null
          user_id: string
          xp_delta?: number
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          occurred_at?: string
          ref_id?: string | null
          ref_table?: string | null
          user_id?: string
          xp_delta?: number
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          updated_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      secure_allowed_senders: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean | null
          mailbox_id: string
          sender_email: string
          sort_index: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean | null
          mailbox_id: string
          sender_email: string
          sort_index?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean | null
          mailbox_id?: string
          sender_email?: string
          sort_index?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "secure_allowed_senders_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "secure_mailboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      secure_attachments: {
        Row: {
          created_at: string
          deleted_at: string | null
          filename_ciphertext: string
          id: string
          message_id: string
          mime_type: string
          size_bytes: number
          sort_index: number | null
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          filename_ciphertext: string
          id?: string
          message_id: string
          mime_type: string
          size_bytes: number
          sort_index?: number | null
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          filename_ciphertext?: string
          id?: string
          message_id?: string
          mime_type?: string
          size_bytes?: number
          sort_index?: number | null
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "secure_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "secure_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      secure_contacts_keys: {
        Row: {
          contact_email: string
          created_at: string
          deleted_at: string | null
          id: string
          pgp_public_key: string
          sort_index: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_email: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          pgp_public_key: string
          sort_index?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_email?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          pgp_public_key?: string
          sort_index?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      secure_mailboxes: {
        Row: {
          created_at: string
          deleted_at: string | null
          email_alias: string
          id: string
          key_kdf: Json
          pgp_private_key_encrypted: string
          pgp_public_key: string
          sort_index: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          email_alias: string
          id?: string
          key_kdf?: Json
          pgp_private_key_encrypted: string
          pgp_public_key: string
          sort_index?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          email_alias?: string
          id?: string
          key_kdf?: Json
          pgp_private_key_encrypted?: string
          pgp_public_key?: string
          sort_index?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      secure_message_access_audit: {
        Row: {
          created_at: string
          event: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "secure_message_access_audit_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "secure_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      secure_messages: {
        Row: {
          body_ciphertext: string
          created_at: string
          deleted_at: string | null
          direction: string
          from_email: string
          id: string
          mailbox_id: string
          meta: Json | null
          provider_message_id: string | null
          received_at: string | null
          sort_index: number | null
          status: string
          subject_ciphertext: string
          thread_id: string | null
          to_email: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body_ciphertext: string
          created_at?: string
          deleted_at?: string | null
          direction: string
          from_email: string
          id?: string
          mailbox_id: string
          meta?: Json | null
          provider_message_id?: string | null
          received_at?: string | null
          sort_index?: number | null
          status: string
          subject_ciphertext: string
          thread_id?: string | null
          to_email: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body_ciphertext?: string
          created_at?: string
          deleted_at?: string | null
          direction?: string
          from_email?: string
          id?: string
          mailbox_id?: string
          meta?: Json | null
          provider_message_id?: string | null
          received_at?: string | null
          sort_index?: number | null
          status?: string
          subject_ciphertext?: string
          thread_id?: string | null
          to_email?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "secure_messages_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "secure_mailboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      setup_library: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          entry_model: string | null
          id: string
          invalidations: string | null
          market_conditions: string | null
          name: string
          short_name: string | null
          statistics_enabled: boolean
          tags: string[]
          timeframes: string[]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          entry_model?: string | null
          id?: string
          invalidations?: string | null
          market_conditions?: string | null
          name: string
          short_name?: string | null
          statistics_enabled?: boolean
          tags?: string[]
          timeframes?: string[]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          entry_model?: string | null
          id?: string
          invalidations?: string | null
          market_conditions?: string | null
          name?: string
          short_name?: string | null
          statistics_enabled?: boolean
          tags?: string[]
          timeframes?: string[]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      setups: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          name_lower: string | null
          sort_index: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          name_lower?: string | null
          sort_index?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          name_lower?: string | null
          sort_index?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          name_lower: string | null
          sort_index: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          name_lower?: string | null
          sort_index?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          name_lower?: string | null
          sort_index?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      terminal_events: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          impact: string | null
          instrument_id: string
          name: string
          sort_index: number
          timestamp_utc: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          impact?: string | null
          instrument_id: string
          name: string
          sort_index?: number
          timestamp_utc: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          impact?: string | null
          instrument_id?: string
          name?: string
          sort_index?: number
          timestamp_utc?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "terminal_events_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      terminal_evidence_attachments: {
        Row: {
          created_at: string
          deleted_at: string | null
          filename: string
          id: string
          mime_type: string | null
          path: string
          report_id: string
          size_bytes: number
          sort_index: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          filename: string
          id?: string
          mime_type?: string | null
          path: string
          report_id: string
          size_bytes: number
          sort_index?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          filename?: string
          id?: string
          mime_type?: string | null
          path?: string
          report_id?: string
          size_bytes?: number
          sort_index?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "terminal_evidence_attachments_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "terminal_evidence_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      terminal_evidence_reports: {
        Row: {
          content: string
          created_at: string
          deleted_at: string | null
          id: string
          instrument_id: string | null
          sort_index: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          instrument_id?: string | null
          sort_index?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          instrument_id?: string | null
          sort_index?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      terminal_news: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          impact_label: string | null
          instrument_id: string
          relevancy_score: number | null
          sort_index: number
          source: string | null
          timestamp_utc: string
          title: string
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          impact_label?: string | null
          instrument_id: string
          relevancy_score?: number | null
          sort_index?: number
          source?: string | null
          timestamp_utc?: string
          title: string
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          impact_label?: string | null
          instrument_id?: string
          relevancy_score?: number | null
          sort_index?: number
          source?: string | null
          timestamp_utc?: string
          title?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "terminal_news_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      terminal_report_jobs: {
        Row: {
          asset: string
          created_at: string
          error: string | null
          id: string
          outcome: string | null
          qstash_schedule_id: string | null
          scheduled_for: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          asset: string
          created_at?: string
          error?: string | null
          id?: string
          outcome?: string | null
          qstash_schedule_id?: string | null
          scheduled_for: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          asset?: string
          created_at?: string
          error?: string | null
          id?: string
          outcome?: string | null
          qstash_schedule_id?: string | null
          scheduled_for?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      terminal_report_state: {
        Row: {
          asset: string
          created_at: string
          id: string
          last_checked_at: string
          last_hash: string | null
          last_item_ids: Json | null
          last_report_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          asset: string
          created_at?: string
          id?: string
          last_checked_at?: string
          last_hash?: string | null
          last_item_ids?: Json | null
          last_report_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          asset?: string
          created_at?: string
          id?: string
          last_checked_at?: string
          last_hash?: string | null
          last_item_ids?: Json | null
          last_report_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trade_evidence: {
        Row: {
          account_id: string | null
          created_at: string
          deleted_at: string | null
          file_path: string | null
          id: string
          mime_type: string | null
          report_text: string
          size_bytes: number | null
          sort_index: number
          title: string
          trade_id: string | null
          updated_at: string
          user_id: string
          validation_status: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          deleted_at?: string | null
          file_path?: string | null
          id?: string
          mime_type?: string | null
          report_text: string
          size_bytes?: number | null
          sort_index?: number
          title: string
          trade_id?: string | null
          updated_at?: string
          user_id: string
          validation_status?: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          deleted_at?: string | null
          file_path?: string | null
          id?: string
          mime_type?: string | null
          report_text?: string
          size_bytes?: number | null
          sort_index?: number
          title?: string
          trade_id?: string | null
          updated_at?: string
          user_id?: string
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_evidence_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_evidence_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      tradermap_goal_quarters: {
        Row: {
          completed_at: string | null
          created_at: string
          current_balance: number | null
          deleted_at: string | null
          end_date: string
          goal_id: string
          id: string
          quarter: string
          sort_index: number
          start_balance: number
          start_date: string
          target_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_balance?: number | null
          deleted_at?: string | null
          end_date: string
          goal_id: string
          id?: string
          quarter: string
          sort_index?: number
          start_balance: number
          start_date: string
          target_balance: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_balance?: number | null
          deleted_at?: string | null
          end_date?: string
          goal_id?: string
          id?: string
          quarter?: string
          sort_index?: number
          start_balance?: number
          start_date?: string
          target_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tradermap_goal_quarters_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "tradermap_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      tradermap_goals: {
        Row: {
          account_id: string
          active_quarter: string
          created_at: string
          deleted_at: string | null
          id: string
          sort_index: number
          title: string
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          account_id: string
          active_quarter?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          sort_index?: number
          title: string
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          account_id?: string
          active_quarter?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          sort_index?: number
          title?: string
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "tradermap_goals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          account_id: string
          created_at: string
          deleted_at: string | null
          direction: string
          entry_date: string
          entry_price: number
          exit_date: string | null
          exit_price: number
          id: string
          is_featured_in_report: boolean
          lots: number
          notes: string | null
          pnl: number
          pnl_percent: number
          screenshot_path: string | null
          setup_id: string | null
          sort_index: number
          status: string
          stop_loss_price: number
          symbol: string
          tags: string[]
          take_profit_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          deleted_at?: string | null
          direction: string
          entry_date: string
          entry_price: number
          exit_date?: string | null
          exit_price: number
          id?: string
          is_featured_in_report?: boolean
          lots: number
          notes?: string | null
          pnl: number
          pnl_percent: number
          screenshot_path?: string | null
          setup_id?: string | null
          sort_index?: number
          status: string
          stop_loss_price: number
          symbol: string
          tags?: string[]
          take_profit_price: number
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          deleted_at?: string | null
          direction?: string
          entry_date?: string
          entry_price?: number
          exit_date?: string | null
          exit_price?: number
          id?: string
          is_featured_in_report?: boolean
          lots?: number
          notes?: string | null
          pnl?: number
          pnl_percent?: number
          screenshot_path?: string | null
          setup_id?: string | null
          sort_index?: number
          status?: string
          stop_loss_price?: number
          symbol?: string
          tags?: string[]
          take_profit_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_setup_id_fkey"
            columns: ["setup_id"]
            isOneToOne: false
            referencedRelation: "setups"
            referencedColumns: ["id"]
          },
        ]
      }
      treasury_budgets: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: string
          notes: string | null
          period_end: string
          period_start: string
          target_expense: number | null
          target_income: number | null
          target_payout: number | null
          updated_at: string | null
          user_id: string
          wallet_id: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          period_end: string
          period_start: string
          target_expense?: number | null
          target_income?: number | null
          target_payout?: number | null
          updated_at?: string | null
          user_id: string
          wallet_id: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          target_expense?: number | null
          target_income?: number | null
          target_payout?: number | null
          updated_at?: string | null
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treasury_budgets_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "treasury_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      treasury_calendar_events: {
        Row: {
          account_id: string
          created_at: string
          deleted_at: string | null
          event_date: string
          id: string
          kind: string
          push_enabled: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          deleted_at?: string | null
          event_date: string
          id?: string
          kind?: string
          push_enabled?: boolean
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          deleted_at?: string | null
          event_date?: string
          id?: string
          kind?: string
          push_enabled?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treasury_calendar_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      treasury_configs: {
        Row: {
          account_id: string
          anti_drawdown_active: boolean
          anti_drawdown_threshold: number
          balance_threshold: number | null
          created_at: string | null
          deleted_at: string | null
          id: string
          last_threshold_push_cycle_start: string | null
          last_withdrawal_push_cycle_start: string | null
          milestone_bonus_vault: number
          milestone_target: number | null
          push_withdrawal_day_enabled: boolean
          sort_index: number
          split_mode: string
          tax_buffer_accumulated: number
          tax_buffer_percentage: number
          tax_buffer_target: number | null
          updated_at: string | null
          user_id: string
          wallet_id: string | null
          withdrawal_day: number
        }
        Insert: {
          account_id: string
          anti_drawdown_active?: boolean
          anti_drawdown_threshold?: number
          balance_threshold?: number | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          last_threshold_push_cycle_start?: string | null
          last_withdrawal_push_cycle_start?: string | null
          milestone_bonus_vault?: number
          milestone_target?: number | null
          push_withdrawal_day_enabled?: boolean
          sort_index?: number
          split_mode?: string
          tax_buffer_accumulated?: number
          tax_buffer_percentage?: number
          tax_buffer_target?: number | null
          updated_at?: string | null
          user_id: string
          wallet_id?: string | null
          withdrawal_day?: number
        }
        Update: {
          account_id?: string
          anti_drawdown_active?: boolean
          anti_drawdown_threshold?: number
          balance_threshold?: number | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          last_threshold_push_cycle_start?: string | null
          last_withdrawal_push_cycle_start?: string | null
          milestone_bonus_vault?: number
          milestone_target?: number | null
          push_withdrawal_day_enabled?: boolean
          sort_index?: number
          split_mode?: string
          tax_buffer_accumulated?: number
          tax_buffer_percentage?: number
          tax_buffer_target?: number | null
          updated_at?: string | null
          user_id?: string
          wallet_id?: string | null
          withdrawal_day?: number
        }
        Relationships: [
          {
            foreignKeyName: "treasury_configs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasury_configs_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "treasury_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      treasury_payouts: {
        Row: {
          account_id: string
          amount: number
          blocked_reasons: Json
          bonus_vault_amount: number
          calc_cutoff: string
          cash_payout_amount: number
          created_at: string | null
          cycle_expected_end: string
          cycle_start: string
          deleted_at: string | null
          id: string
          method: string | null
          notes: string | null
          payout_date: string
          status: string
          tax_reserve_amount: number
          updated_at: string | null
          user_id: string
          version: number
          wallet_id: string
        }
        Insert: {
          account_id: string
          amount: number
          blocked_reasons?: Json
          bonus_vault_amount?: number
          calc_cutoff?: string
          cash_payout_amount?: number
          created_at?: string | null
          cycle_expected_end?: string
          cycle_start?: string
          deleted_at?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          payout_date: string
          status?: string
          tax_reserve_amount?: number
          updated_at?: string | null
          user_id: string
          version?: number
          wallet_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          blocked_reasons?: Json
          bonus_vault_amount?: number
          calc_cutoff?: string
          cash_payout_amount?: number
          created_at?: string | null
          cycle_expected_end?: string
          cycle_start?: string
          deleted_at?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          payout_date?: string
          status?: string
          tax_reserve_amount?: number
          updated_at?: string | null
          user_id?: string
          version?: number
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treasury_payouts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasury_payouts_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "treasury_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      treasury_transactions: {
        Row: {
          account_id: string | null
          amount: number
          created_at: string | null
          deleted_at: string | null
          description: string | null
          id: string
          notes: string | null
          occurred_on: string
          sort_index: number
          type: string
          updated_at: string | null
          user_id: string
          wallet_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          occurred_on: string
          sort_index?: number
          type: string
          updated_at?: string | null
          user_id: string
          wallet_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          occurred_on?: string
          sort_index?: number
          type?: string
          updated_at?: string | null
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treasury_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasury_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "treasury_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      treasury_wallets: {
        Row: {
          created_at: string | null
          currency: string
          deleted_at: string | null
          id: string
          name: string
          starting_balance: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          currency: string
          deleted_at?: string | null
          id?: string
          name: string
          starting_balance?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          currency?: string
          deleted_at?: string | null
          id?: string
          name?: string
          starting_balance?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tv_analysis_evidence: {
        Row: {
          account_id: string | null
          captured_at: string
          created_at: string
          deleted_at: string | null
          id: string
          image_path: string
          sort_index: number
          trade_id: string | null
          updated_at: string
          user_id: string
          user_notes: string | null
          validation_status: string
        }
        Insert: {
          account_id?: string | null
          captured_at?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          image_path: string
          sort_index?: number
          trade_id?: string | null
          updated_at?: string
          user_id: string
          user_notes?: string | null
          validation_status?: string
        }
        Update: {
          account_id?: string | null
          captured_at?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          image_path?: string
          sort_index?: number
          trade_id?: string | null
          updated_at?: string
          user_id?: string
          user_notes?: string | null
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "tv_analysis_evidence_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tv_analysis_evidence_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      user_level_state: {
        Row: {
          last_activity_date: string | null
          level: number
          streak_days: number
          updated_at: string
          user_id: string
          xp_total: number
        }
        Insert: {
          last_activity_date?: string | null
          level?: number
          streak_days?: number
          updated_at?: string
          user_id: string
          xp_total?: number
        }
        Update: {
          last_activity_date?: string | null
          level?: number
          streak_days?: number
          updated_at?: string
          user_id?: string
          xp_total?: number
        }
        Relationships: []
      }
      weekly_reports: {
        Row: {
          content_md: string
          created_at: string
          deleted_at: string | null
          id: string
          sort_index: number
          title: string
          total_pnl: number | null
          total_trades: number
          updated_at: string
          user_id: string
          version: number
          week_end: string
          week_start: string
          win_rate: number | null
        }
        Insert: {
          content_md: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          sort_index?: number
          title: string
          total_pnl?: number | null
          total_trades?: number
          updated_at?: string
          user_id: string
          version?: number
          week_end: string
          week_start: string
          win_rate?: number | null
        }
        Update: {
          content_md?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          sort_index?: number
          title?: string
          total_pnl?: number | null
          total_trades?: number
          updated_at?: string
          user_id?: string
          version?: number
          week_end?: string
          week_start?: string
          win_rate?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      active_app_update: {
        Row: {
          build_hash: string | null
          created_at: string | null
          created_by: string | null
          force_refresh: boolean | null
          id: string | null
          is_active: boolean | null
          version: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      activate_app_update: { Args: { p_update_id: string }; Returns: undefined }
      force_app_refresh: { Args: { reason?: string }; Returns: undefined }
      security_rls_audit: {
        Args: { target_tables?: string[] }
        Returns: {
          policy_count: number
          rls_enabled: boolean
          status: string
          table_exists: boolean
          table_name: string
        }[]
      }
      upsert_user_level_state: {
        Args: { p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const
