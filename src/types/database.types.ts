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
      agent_operations: {
        Row: {
          agent_id: string
          closed_at: string | null
          confidence: number | null
          created_at: string
          direction: string
          entry_price: number | null
          exit_price: number | null
          id: string
          lots: number | null
          opened_at: string
          pnl: number | null
          reasoning: string | null
          status: string
          symbol: string
          user_id: string
        }
        Insert: {
          agent_id: string
          closed_at?: string | null
          confidence?: number | null
          created_at?: string
          direction: string
          entry_price?: number | null
          exit_price?: number | null
          id?: string
          lots?: number | null
          opened_at?: string
          pnl?: number | null
          reasoning?: string | null
          status?: string
          symbol: string
          user_id: string
        }
        Update: {
          agent_id?: string
          closed_at?: string | null
          confidence?: number | null
          created_at?: string
          direction?: string
          entry_price?: number | null
          exit_price?: number | null
          id?: string
          lots?: number | null
          opened_at?: string
          pnl?: number | null
          reasoning?: string | null
          status?: string
          symbol?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_operations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
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
      algo_cme_accounts: {
        Row: {
          account_number: string
          account_type: string
          created_at: string
          deleted_at: string | null
          funded_amount: number | null
          id: string
          is_paper: boolean
          label: string | null
          max_daily_loss: number | null
          max_trailing_dd: number | null
          provider_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_number: string
          account_type: string
          created_at?: string
          deleted_at?: string | null
          funded_amount?: number | null
          id?: string
          is_paper?: boolean
          label?: string | null
          max_daily_loss?: number | null
          max_trailing_dd?: number | null
          provider_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_number?: string
          account_type?: string
          created_at?: string
          deleted_at?: string | null
          funded_amount?: number | null
          id?: string
          is_paper?: boolean
          label?: string | null
          max_daily_loss?: number | null
          max_trailing_dd?: number | null
          provider_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      algo_paper_trades: {
        Row: {
          algorithm_id: string | null
          closed_at: string | null
          created_at: string
          direction: string
          entry_price: number | null
          exit_price: number | null
          id: string
          opened_at: string
          pnl: number | null
          quantity: number
          signal_log_id: string | null
          source: string
          status: string
          symbol: string
          user_id: string
        }
        Insert: {
          algorithm_id?: string | null
          closed_at?: string | null
          created_at?: string
          direction: string
          entry_price?: number | null
          exit_price?: number | null
          id?: string
          opened_at?: string
          pnl?: number | null
          quantity?: number
          signal_log_id?: string | null
          source?: string
          status?: string
          symbol: string
          user_id: string
        }
        Update: {
          algorithm_id?: string | null
          closed_at?: string | null
          created_at?: string
          direction?: string
          entry_price?: number | null
          exit_price?: number | null
          id?: string
          opened_at?: string
          pnl?: number | null
          quantity?: number
          signal_log_id?: string | null
          source?: string
          status?: string
          symbol?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "algo_paper_trades_algorithm_id_fkey"
            columns: ["algorithm_id"]
            isOneToOne: false
            referencedRelation: "algorithms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "algo_paper_trades_signal_log_id_fkey"
            columns: ["signal_log_id"]
            isOneToOne: false
            referencedRelation: "algo_signal_log"
            referencedColumns: ["id"]
          },
        ]
      }
      algo_signal_log: {
        Row: {
          algorithm_id: string
          confidence: number | null
          created_at: string
          final_action: string
          generated_at: string
          id: string
          lots: number | null
          overlay_kind: string
          regime_code: string | null
          session_code: string | null
          signal_action: string
          signal_id: string
          symbol: string
          user_id: string
          vol_15m: number | null
        }
        Insert: {
          algorithm_id: string
          confidence?: number | null
          created_at?: string
          final_action: string
          generated_at?: string
          id?: string
          lots?: number | null
          overlay_kind?: string
          regime_code?: string | null
          session_code?: string | null
          signal_action: string
          signal_id: string
          symbol: string
          user_id: string
          vol_15m?: number | null
        }
        Update: {
          algorithm_id?: string
          confidence?: number | null
          created_at?: string
          final_action?: string
          generated_at?: string
          id?: string
          lots?: number | null
          overlay_kind?: string
          regime_code?: string | null
          session_code?: string | null
          signal_action?: string
          signal_id?: string
          symbol?: string
          user_id?: string
          vol_15m?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "algo_signal_log_algorithm_id_fkey"
            columns: ["algorithm_id"]
            isOneToOne: false
            referencedRelation: "trading_algorithms"
            referencedColumns: ["id"]
          },
        ]
      }
      algorithm_alert_preferences: {
        Row: {
          coinarb_heartbeat_dedup_minutes: number
          coinarb_heartbeat_stale_sec: number
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          coinarb_heartbeat_dedup_minutes?: number
          coinarb_heartbeat_stale_sec?: number
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          coinarb_heartbeat_dedup_minutes?: number
          coinarb_heartbeat_stale_sec?: number
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      algorithm_backtest_results: {
        Row: {
          algorithm_id: string
          created_at: string
          id: string
          max_drawdown: number | null
          net_profit: number | null
          period_end: string | null
          period_start: string | null
          platform: string
          profit_factor: number | null
          raw_data: Json | null
          recovery_factor: number | null
          sharpe_ratio: number | null
          total_trades: number | null
          user_id: string
          win_rate: number | null
        }
        Insert: {
          algorithm_id: string
          created_at?: string
          id?: string
          max_drawdown?: number | null
          net_profit?: number | null
          period_end?: string | null
          period_start?: string | null
          platform: string
          profit_factor?: number | null
          raw_data?: Json | null
          recovery_factor?: number | null
          sharpe_ratio?: number | null
          total_trades?: number | null
          user_id: string
          win_rate?: number | null
        }
        Update: {
          algorithm_id?: string
          created_at?: string
          id?: string
          max_drawdown?: number | null
          net_profit?: number | null
          period_end?: string | null
          period_start?: string | null
          platform?: string
          profit_factor?: number | null
          raw_data?: Json | null
          recovery_factor?: number | null
          sharpe_ratio?: number | null
          total_trades?: number | null
          user_id?: string
          win_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "algorithm_backtest_results_algorithm_id_fkey"
            columns: ["algorithm_id"]
            isOneToOne: false
            referencedRelation: "trading_algorithms"
            referencedColumns: ["id"]
          },
        ]
      }
      algorithm_deployments: {
        Row: {
          algorithm_id: string
          bot_account_id: string
          created_at: string
          deployed_at: string
          id: string
          notes: string | null
          status: string
          stopped_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          algorithm_id: string
          bot_account_id: string
          created_at?: string
          deployed_at?: string
          id?: string
          notes?: string | null
          status?: string
          stopped_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          algorithm_id?: string
          bot_account_id?: string
          created_at?: string
          deployed_at?: string
          id?: string
          notes?: string | null
          status?: string
          stopped_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "algorithm_deployments_algorithm_id_fkey"
            columns: ["algorithm_id"]
            isOneToOne: false
            referencedRelation: "algorithms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "algorithm_deployments_bot_account_id_fkey"
            columns: ["bot_account_id"]
            isOneToOne: false
            referencedRelation: "bot_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      algorithm_phase_log: {
        Row: {
          algorithm_id: string
          capital_at_change: number | null
          changed_at: string
          created_at: string
          from_phase: string | null
          from_risk_pct: number | null
          id: string
          reason: string | null
          to_phase: string | null
          to_risk_pct: number | null
          user_id: string
        }
        Insert: {
          algorithm_id: string
          capital_at_change?: number | null
          changed_at?: string
          created_at?: string
          from_phase?: string | null
          from_risk_pct?: number | null
          id?: string
          reason?: string | null
          to_phase?: string | null
          to_risk_pct?: number | null
          user_id: string
        }
        Update: {
          algorithm_id?: string
          capital_at_change?: number | null
          changed_at?: string
          created_at?: string
          from_phase?: string | null
          from_risk_pct?: number | null
          id?: string
          reason?: string | null
          to_phase?: string | null
          to_risk_pct?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "algorithm_phase_log_algorithm_id_fkey"
            columns: ["algorithm_id"]
            isOneToOne: false
            referencedRelation: "algorithms"
            referencedColumns: ["id"]
          },
        ]
      }
      algorithm_quality_gate_definitions: {
        Row: {
          category: string
          created_at: string
          description: string
          gate_key: string
          is_active: boolean
          name: string
          severity: string
          sort_index: number
          source_field: string
          threshold_op: string
          threshold_value: number
          unit: string | null
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          gate_key: string
          is_active?: boolean
          name: string
          severity: string
          sort_index: number
          source_field: string
          threshold_op: string
          threshold_value: number
          unit?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          gate_key?: string
          is_active?: boolean
          name?: string
          severity?: string
          sort_index?: number
          source_field?: string
          threshold_op?: string
          threshold_value?: number
          unit?: string | null
        }
        Relationships: []
      }
      algorithm_quality_gate_results: {
        Row: {
          algorithm_id: string
          computed_at: string
          gate_key: string
          id: string
          passed: boolean
          reason: string | null
          user_id: string
          value_observed: number | null
        }
        Insert: {
          algorithm_id: string
          computed_at?: string
          gate_key: string
          id?: string
          passed: boolean
          reason?: string | null
          user_id: string
          value_observed?: number | null
        }
        Update: {
          algorithm_id?: string
          computed_at?: string
          gate_key?: string
          id?: string
          passed?: boolean
          reason?: string | null
          user_id?: string
          value_observed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "algorithm_quality_gate_results_algorithm_id_fkey"
            columns: ["algorithm_id"]
            isOneToOne: false
            referencedRelation: "algorithms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "algorithm_quality_gate_results_gate_key_fkey"
            columns: ["gate_key"]
            isOneToOne: false
            referencedRelation: "algorithm_quality_gate_definitions"
            referencedColumns: ["gate_key"]
          },
        ]
      }
      algorithm_templates: {
        Row: {
          algo_type: string
          created_at: string
          default_direction: string
          default_instrument: string
          default_lot_size: number
          default_max_trades: number
          default_risk_percent: number
          description: string | null
          id: string
          is_active: boolean
          magic_number: number | null
          market_type: string
          name: string
          parameters: Json
          sort_index: number
          source_path: string | null
          supported_platforms: string[]
          template_key: string
          updated_at: string
        }
        Insert: {
          algo_type: string
          created_at?: string
          default_direction?: string
          default_instrument: string
          default_lot_size?: number
          default_max_trades?: number
          default_risk_percent?: number
          description?: string | null
          id?: string
          is_active?: boolean
          magic_number?: number | null
          market_type: string
          name: string
          parameters?: Json
          sort_index?: number
          source_path?: string | null
          supported_platforms?: string[]
          template_key: string
          updated_at?: string
        }
        Update: {
          algo_type?: string
          created_at?: string
          default_direction?: string
          default_instrument?: string
          default_lot_size?: number
          default_max_trades?: number
          default_risk_percent?: number
          description?: string | null
          id?: string
          is_active?: boolean
          magic_number?: number | null
          market_type?: string
          name?: string
          parameters?: Json
          sort_index?: number
          source_path?: string | null
          supported_platforms?: string[]
          template_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      algorithm_trades: {
        Row: {
          algorithm_id: string
          closed_at: string | null
          created_at: string
          direction: string
          duration_min: number | null
          entry_price: number | null
          exit_price: number | null
          id: string
          instrument: string
          lots: number | null
          opened_at: string
          pnl: number | null
          status: string
          trade_number: number | null
          user_id: string
        }
        Insert: {
          algorithm_id: string
          closed_at?: string | null
          created_at?: string
          direction: string
          duration_min?: number | null
          entry_price?: number | null
          exit_price?: number | null
          id?: string
          instrument: string
          lots?: number | null
          opened_at?: string
          pnl?: number | null
          status?: string
          trade_number?: number | null
          user_id: string
        }
        Update: {
          algorithm_id?: string
          closed_at?: string | null
          created_at?: string
          direction?: string
          duration_min?: number | null
          entry_price?: number | null
          exit_price?: number | null
          id?: string
          instrument?: string
          lots?: number | null
          opened_at?: string
          pnl?: number | null
          status?: string
          trade_number?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "algorithm_trades_algorithm_id_fkey"
            columns: ["algorithm_id"]
            isOneToOne: false
            referencedRelation: "algorithms"
            referencedColumns: ["id"]
          },
        ]
      }
      algorithms: {
        Row: {
          created_at: string
          default_backtest_balance: number | null
          deleted_at: string | null
          direction: string
          drawdown_pct: number
          engine_config: Json | null
          id: string
          instrument: string[]
          last_dispatch_action: string | null
          last_dispatch_at: string | null
          last_dispatch_reason: string | null
          last_signal_bar_ts: string | null
          linked_bot_account_id: string | null
          lot_size: number
          market_type: string
          max_drawdown_pct: number
          max_trades: number
          name: string
          parameters: Json
          platform: string
          pnl_today: number
          pnl_total: number
          profit_factor: number
          risk_percent: number
          scan_config: Json
          sort_index: number
          status: string
          trade_count: number
          updated_at: string
          user_id: string
          win_rate: number
        }
        Insert: {
          created_at?: string
          default_backtest_balance?: number | null
          deleted_at?: string | null
          direction?: string
          drawdown_pct?: number
          engine_config?: Json | null
          id?: string
          instrument?: string[]
          last_dispatch_action?: string | null
          last_dispatch_at?: string | null
          last_dispatch_reason?: string | null
          last_signal_bar_ts?: string | null
          linked_bot_account_id?: string | null
          lot_size?: number
          market_type?: string
          max_drawdown_pct?: number
          max_trades?: number
          name: string
          parameters?: Json
          platform?: string
          pnl_today?: number
          pnl_total?: number
          profit_factor?: number
          risk_percent?: number
          scan_config?: Json
          sort_index?: number
          status?: string
          trade_count?: number
          updated_at?: string
          user_id: string
          win_rate?: number
        }
        Update: {
          created_at?: string
          default_backtest_balance?: number | null
          deleted_at?: string | null
          direction?: string
          drawdown_pct?: number
          engine_config?: Json | null
          id?: string
          instrument?: string[]
          last_dispatch_action?: string | null
          last_dispatch_at?: string | null
          last_dispatch_reason?: string | null
          last_signal_bar_ts?: string | null
          linked_bot_account_id?: string | null
          lot_size?: number
          market_type?: string
          max_drawdown_pct?: number
          max_trades?: number
          name?: string
          parameters?: Json
          platform?: string
          pnl_today?: number
          pnl_total?: number
          profit_factor?: number
          risk_percent?: number
          scan_config?: Json
          sort_index?: number
          status?: string
          trade_count?: number
          updated_at?: string
          user_id?: string
          win_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "algorithms_linked_bot_account_id_fkey"
            columns: ["linked_bot_account_id"]
            isOneToOne: false
            referencedRelation: "bot_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      api_rate_limits: {
        Row: {
          created_at: string
          hits: number
          id: string
          key: string
          updated_at: string
          window_start: string
        }
        Insert: {
          created_at?: string
          hits?: number
          id?: string
          key: string
          updated_at?: string
          window_start: string
        }
        Update: {
          created_at?: string
          hits?: number
          id?: string
          key?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
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
      arbitrage_latency_pairs: {
        Row: {
          algorithm_id: string
          created_at: string
          enabled: boolean
          fast_bot_account_id: string
          id: string
          last_signal_at: string | null
          max_hold_seconds: number
          max_skew_points: number
          min_hold_seconds: number
          min_pulse_ticks: number
          pulse_window_ms: number
          slow_bot_account_id: string
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          algorithm_id: string
          created_at?: string
          enabled?: boolean
          fast_bot_account_id: string
          id?: string
          last_signal_at?: string | null
          max_hold_seconds?: number
          max_skew_points?: number
          min_hold_seconds?: number
          min_pulse_ticks?: number
          pulse_window_ms?: number
          slow_bot_account_id: string
          symbol: string
          updated_at?: string
          user_id: string
        }
        Update: {
          algorithm_id?: string
          created_at?: string
          enabled?: boolean
          fast_bot_account_id?: string
          id?: string
          last_signal_at?: string | null
          max_hold_seconds?: number
          max_skew_points?: number
          min_hold_seconds?: number
          min_pulse_ticks?: number
          pulse_window_ms?: number
          slow_bot_account_id?: string
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arbitrage_latency_pairs_algorithm_id_fkey"
            columns: ["algorithm_id"]
            isOneToOne: false
            referencedRelation: "algorithms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arbitrage_latency_pairs_fast_bot_account_id_fkey"
            columns: ["fast_bot_account_id"]
            isOneToOne: false
            referencedRelation: "bot_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arbitrage_latency_pairs_slow_bot_account_id_fkey"
            columns: ["slow_bot_account_id"]
            isOneToOne: false
            referencedRelation: "bot_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          changes: Json | null
          created_at: string
          error_message: string | null
          id: string
          ip_hint: string | null
          resource_id: string | null
          resource_type: string
          status: string | null
          user_agent_hash: string | null
          user_id: string
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          ip_hint?: string | null
          resource_id?: string | null
          resource_type: string
          status?: string | null
          user_agent_hash?: string | null
          user_id: string
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          ip_hint?: string | null
          resource_id?: string | null
          resource_type?: string
          status?: string | null
          user_agent_hash?: string | null
          user_id?: string
        }
        Relationships: []
      }
      backtest_daemon_state: {
        Row: {
          algorithm_id: string
          created_at: string
          decay_alert: boolean
          decay_alert_emitted_at: string | null
          id: string
          last_check_at: string
          last_is_sharpe: number | null
          last_oos_sharpe: number | null
          meta: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          algorithm_id: string
          created_at?: string
          decay_alert?: boolean
          decay_alert_emitted_at?: string | null
          id?: string
          last_check_at?: string
          last_is_sharpe?: number | null
          last_oos_sharpe?: number | null
          meta?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          algorithm_id?: string
          created_at?: string
          decay_alert?: boolean
          decay_alert_emitted_at?: string | null
          id?: string
          last_check_at?: string
          last_is_sharpe?: number | null
          last_oos_sharpe?: number | null
          meta?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "backtest_daemon_state_algorithm_id_fkey"
            columns: ["algorithm_id"]
            isOneToOne: true
            referencedRelation: "algorithms"
            referencedColumns: ["id"]
          },
        ]
      }
      backtest_jobs: {
        Row: {
          algorithm_id: string | null
          config: Json
          created_at: string
          current_phase: string | null
          engine_version: string
          error: string | null
          finished_at: string | null
          id: string
          progress_pct: number
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          algorithm_id?: string | null
          config: Json
          created_at?: string
          current_phase?: string | null
          engine_version?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          progress_pct?: number
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          algorithm_id?: string | null
          config?: Json
          created_at?: string
          current_phase?: string | null
          engine_version?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          progress_pct?: number
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "backtest_jobs_algorithm_id_fkey"
            columns: ["algorithm_id"]
            isOneToOne: false
            referencedRelation: "algorithms"
            referencedColumns: ["id"]
          },
        ]
      }
      backtest_paper_signals: {
        Row: {
          algorithm_id: string
          created_at: string
          entry_price: number | null
          expected_pnl: number | null
          id: string
          meta: Json | null
          side: string
          signal_ts: string
          sl_price: number | null
          source: string
          symbol: string
          timeframe: string
          tp_price: number | null
          user_id: string
        }
        Insert: {
          algorithm_id: string
          created_at?: string
          entry_price?: number | null
          expected_pnl?: number | null
          id?: string
          meta?: Json | null
          side: string
          signal_ts: string
          sl_price?: number | null
          source?: string
          symbol: string
          timeframe: string
          tp_price?: number | null
          user_id: string
        }
        Update: {
          algorithm_id?: string
          created_at?: string
          entry_price?: number | null
          expected_pnl?: number | null
          id?: string
          meta?: Json | null
          side?: string
          signal_ts?: string
          sl_price?: number | null
          source?: string
          symbol?: string
          timeframe?: string
          tp_price?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "backtest_paper_signals_algorithm_id_fkey"
            columns: ["algorithm_id"]
            isOneToOne: false
            referencedRelation: "algorithms"
            referencedColumns: ["id"]
          },
        ]
      }
      backtest_results: {
        Row: {
          advanced: Json | null
          created_at: string
          equity_curve: Json
          job_id: string
          metrics: Json
          monte_carlo: Json | null
          regime: Json | null
          robustness: Json | null
          sensitivity: Json | null
          stress_tests: Json | null
          trades: Json
          user_id: string
          walk_forward: Json | null
        }
        Insert: {
          advanced?: Json | null
          created_at?: string
          equity_curve: Json
          job_id: string
          metrics: Json
          monte_carlo?: Json | null
          regime?: Json | null
          robustness?: Json | null
          sensitivity?: Json | null
          stress_tests?: Json | null
          trades: Json
          user_id: string
          walk_forward?: Json | null
        }
        Update: {
          advanced?: Json | null
          created_at?: string
          equity_curve?: Json
          job_id?: string
          metrics?: Json
          monte_carlo?: Json | null
          regime?: Json | null
          robustness?: Json | null
          sensitivity?: Json | null
          stress_tests?: Json | null
          trades?: Json
          user_id?: string
          walk_forward?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "backtest_results_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "backtest_jobs"
            referencedColumns: ["id"]
          },
        ]
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
          target_strategy: string
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
          target_strategy?: string
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
          target_strategy?: string
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
          instance_secret: string
          is_paper_mode: boolean
          last_heartbeat_at: string | null
          pairing_token_expires_at: string | null
          pairing_token_hash: string | null
          pairing_token_used_at: string | null
          platform: string
          signal_secret_hash: string | null
          status: string
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          bot_account_id: string
          created_at?: string
          id?: string
          instance_id: string
          instance_secret: string
          is_paper_mode?: boolean
          last_heartbeat_at?: string | null
          pairing_token_expires_at?: string | null
          pairing_token_hash?: string | null
          pairing_token_used_at?: string | null
          platform?: string
          signal_secret_hash?: string | null
          status?: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          bot_account_id?: string
          created_at?: string
          id?: string
          instance_id?: string
          instance_secret?: string
          is_paper_mode?: boolean
          last_heartbeat_at?: string | null
          pairing_token_expires_at?: string | null
          pairing_token_hash?: string | null
          pairing_token_used_at?: string | null
          platform?: string
          signal_secret_hash?: string | null
          status?: string
          updated_at?: string
          webhook_secret?: string | null
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
      bot_monitor_state: {
        Row: {
          bot_instance_id: string
          down_since: string | null
          is_down: boolean
          last_alerted_at: string | null
          recovery_cmd_id: string | null
          updated_at: string
        }
        Insert: {
          bot_instance_id: string
          down_since?: string | null
          is_down?: boolean
          last_alerted_at?: string | null
          recovery_cmd_id?: string | null
          updated_at?: string
        }
        Update: {
          bot_instance_id?: string
          down_since?: string | null
          is_down?: boolean
          last_alerted_at?: string | null
          recovery_cmd_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_monitor_state_bot_instance_id_fkey"
            columns: ["bot_instance_id"]
            isOneToOne: true
            referencedRelation: "bot_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_open_positions: {
        Row: {
          algorithm_id: string | null
          bot_account_id: string
          close_price: number | null
          closed_at: string | null
          created_at: string
          current_price: number | null
          direction: string
          id: string
          last_updated_at: string
          lots: number
          open_price: number
          open_time: string | null
          profit: number
          sl: number | null
          status: string
          symbol: string
          ticket: number
          tp: number | null
          user_id: string
        }
        Insert: {
          algorithm_id?: string | null
          bot_account_id: string
          close_price?: number | null
          closed_at?: string | null
          created_at?: string
          current_price?: number | null
          direction: string
          id?: string
          last_updated_at?: string
          lots: number
          open_price: number
          open_time?: string | null
          profit?: number
          sl?: number | null
          status?: string
          symbol: string
          ticket: number
          tp?: number | null
          user_id: string
        }
        Update: {
          algorithm_id?: string | null
          bot_account_id?: string
          close_price?: number | null
          closed_at?: string | null
          created_at?: string
          current_price?: number | null
          direction?: string
          id?: string
          last_updated_at?: string
          lots?: number
          open_price?: number
          open_time?: string | null
          profit?: number
          sl?: number | null
          status?: string
          symbol?: string
          ticket?: number
          tp?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_open_positions_algorithm_id_fkey"
            columns: ["algorithm_id"]
            isOneToOne: false
            referencedRelation: "algorithms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_open_positions_bot_account_id_fkey"
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
          execution_latency_ms: number | null
          feed_latency_ms: number | null
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
          execution_latency_ms?: number | null
          feed_latency_ms?: number | null
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
          execution_latency_ms?: number | null
          feed_latency_ms?: number | null
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
        Relationships: []
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
      cme_connections: {
        Row: {
          access_token_vault_key: string | null
          broker_type: string
          cme_account_id: string
          created_at: string
          daily_pnl_usd: number | null
          error_at: string | null
          id: string
          last_connected_at: string | null
          last_error: string | null
          status: string
          token_expires_at: string | null
          tradovate_account_id: number | null
          tradovate_account_spec: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_vault_key?: string | null
          broker_type?: string
          cme_account_id: string
          created_at?: string
          daily_pnl_usd?: number | null
          error_at?: string | null
          id?: string
          last_connected_at?: string | null
          last_error?: string | null
          status?: string
          token_expires_at?: string | null
          tradovate_account_id?: number | null
          tradovate_account_spec?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_vault_key?: string | null
          broker_type?: string
          cme_account_id?: string
          created_at?: string
          daily_pnl_usd?: number | null
          error_at?: string | null
          id?: string
          last_connected_at?: string | null
          last_error?: string | null
          status?: string
          token_expires_at?: string | null
          tradovate_account_id?: number | null
          tradovate_account_spec?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cme_connections_cme_account_id_fkey"
            columns: ["cme_account_id"]
            isOneToOne: false
            referencedRelation: "algo_cme_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_equity_snapshots: {
        Row: {
          balance_usd: number
          cme_account_id: string
          daily_pnl_usd: number
          equity_usd: number
          id: string
          open_pnl_usd: number
          snapshot_at: string
          user_id: string
        }
        Insert: {
          balance_usd: number
          cme_account_id: string
          daily_pnl_usd?: number
          equity_usd: number
          id?: string
          open_pnl_usd?: number
          snapshot_at?: string
          user_id: string
        }
        Update: {
          balance_usd?: number
          cme_account_id?: string
          daily_pnl_usd?: number
          equity_usd?: number
          id?: string
          open_pnl_usd?: number
          snapshot_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cme_equity_snapshots_cme_account_id_fkey"
            columns: ["cme_account_id"]
            isOneToOne: false
            referencedRelation: "algo_cme_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_positions: {
        Row: {
          algorithm_id: string | null
          avg_entry_price: number | null
          broker_position_id: string | null
          cme_account_id: string
          connection_id: string | null
          contract: string
          current_price: number | null
          direction: string
          id: string
          is_manual: boolean
          opened_at: string | null
          quantity: number
          stop_loss_price: number | null
          take_profit_price: number | null
          unrealized_pnl_usd: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          algorithm_id?: string | null
          avg_entry_price?: number | null
          broker_position_id?: string | null
          cme_account_id: string
          connection_id?: string | null
          contract: string
          current_price?: number | null
          direction: string
          id?: string
          is_manual?: boolean
          opened_at?: string | null
          quantity: number
          stop_loss_price?: number | null
          take_profit_price?: number | null
          unrealized_pnl_usd?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          algorithm_id?: string | null
          avg_entry_price?: number | null
          broker_position_id?: string | null
          cme_account_id?: string
          connection_id?: string | null
          contract?: string
          current_price?: number | null
          direction?: string
          id?: string
          is_manual?: boolean
          opened_at?: string | null
          quantity?: number
          stop_loss_price?: number | null
          take_profit_price?: number | null
          unrealized_pnl_usd?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cme_positions_algorithm_id_fkey"
            columns: ["algorithm_id"]
            isOneToOne: false
            referencedRelation: "algorithms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_positions_cme_account_id_fkey"
            columns: ["cme_account_id"]
            isOneToOne: false
            referencedRelation: "algo_cme_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_positions_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "cme_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_risk_configs: {
        Row: {
          circuit_breaker_pct: number
          cme_account_id: string
          created_at: string
          enabled: boolean
          id: string
          max_positions: number | null
          paused_at: string | null
          paused_reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          circuit_breaker_pct?: number
          cme_account_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          max_positions?: number | null
          paused_at?: string | null
          paused_reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          circuit_breaker_pct?: number
          cme_account_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          max_positions?: number | null
          paused_at?: string | null
          paused_reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cme_risk_configs_cme_account_id_fkey"
            columns: ["cme_account_id"]
            isOneToOne: false
            referencedRelation: "algo_cme_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_signals: {
        Row: {
          algorithm_id: string | null
          cme_account_id: string
          contract: string
          created_at: string
          direction: string
          executed_at: string | null
          execution_algo: string | null
          expires_at: string
          id: string
          parent_signal_id: string | null
          quantity: number
          reject_reason: string | null
          risk_check_result: Json | null
          scheduled_at: string | null
          signal_type: string
          slice_index: number | null
          status: string
          stop_loss_ticks: number | null
          take_profit_ticks: number | null
          total_slices: number | null
          user_id: string
        }
        Insert: {
          algorithm_id?: string | null
          cme_account_id: string
          contract: string
          created_at?: string
          direction: string
          executed_at?: string | null
          execution_algo?: string | null
          expires_at?: string
          id?: string
          parent_signal_id?: string | null
          quantity?: number
          reject_reason?: string | null
          risk_check_result?: Json | null
          scheduled_at?: string | null
          signal_type?: string
          slice_index?: number | null
          status?: string
          stop_loss_ticks?: number | null
          take_profit_ticks?: number | null
          total_slices?: number | null
          user_id: string
        }
        Update: {
          algorithm_id?: string | null
          cme_account_id?: string
          contract?: string
          created_at?: string
          direction?: string
          executed_at?: string | null
          execution_algo?: string | null
          expires_at?: string
          id?: string
          parent_signal_id?: string | null
          quantity?: number
          reject_reason?: string | null
          risk_check_result?: Json | null
          scheduled_at?: string | null
          signal_type?: string
          slice_index?: number | null
          status?: string
          stop_loss_ticks?: number | null
          take_profit_ticks?: number | null
          total_slices?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cme_signals_algorithm_id_fkey"
            columns: ["algorithm_id"]
            isOneToOne: false
            referencedRelation: "algorithms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_signals_cme_account_id_fkey"
            columns: ["cme_account_id"]
            isOneToOne: false
            referencedRelation: "algo_cme_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_signals_parent_signal_id_fkey"
            columns: ["parent_signal_id"]
            isOneToOne: false
            referencedRelation: "cme_signals"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_trades_propfirm: {
        Row: {
          algorithm_id: string | null
          broker_order_id: string | null
          broker_position_id: string | null
          close_reason: string | null
          cme_account_id: string
          commission_usd: number | null
          connection_id: string | null
          contract: string
          created_at: string
          direction: string
          entry_price: number | null
          exit_price: number | null
          fill_price: number | null
          fill_timestamp: string | null
          id: string
          pnl_usd: number | null
          quantity: number
          signal_id: string | null
          slippage_ticks: number | null
          status: string
          stop_loss_price: number | null
          take_profit_price: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          algorithm_id?: string | null
          broker_order_id?: string | null
          broker_position_id?: string | null
          close_reason?: string | null
          cme_account_id: string
          commission_usd?: number | null
          connection_id?: string | null
          contract: string
          created_at?: string
          direction: string
          entry_price?: number | null
          exit_price?: number | null
          fill_price?: number | null
          fill_timestamp?: string | null
          id?: string
          pnl_usd?: number | null
          quantity?: number
          signal_id?: string | null
          slippage_ticks?: number | null
          status?: string
          stop_loss_price?: number | null
          take_profit_price?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          algorithm_id?: string | null
          broker_order_id?: string | null
          broker_position_id?: string | null
          close_reason?: string | null
          cme_account_id?: string
          commission_usd?: number | null
          connection_id?: string | null
          contract?: string
          created_at?: string
          direction?: string
          entry_price?: number | null
          exit_price?: number | null
          fill_price?: number | null
          fill_timestamp?: string | null
          id?: string
          pnl_usd?: number | null
          quantity?: number
          signal_id?: string | null
          slippage_ticks?: number | null
          status?: string
          stop_loss_price?: number | null
          take_profit_price?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cme_trades_propfirm_algorithm_id_fkey"
            columns: ["algorithm_id"]
            isOneToOne: false
            referencedRelation: "algorithms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_trades_propfirm_cme_account_id_fkey"
            columns: ["cme_account_id"]
            isOneToOne: false
            referencedRelation: "algo_cme_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_trades_propfirm_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "cme_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_trades_real: {
        Row: {
          algorithm_id: string | null
          broker_order_id: string | null
          broker_position_id: string | null
          close_reason: string | null
          cme_account_id: string
          commission_usd: number | null
          connection_id: string | null
          contract: string
          created_at: string
          direction: string
          entry_price: number | null
          exit_price: number | null
          fill_price: number | null
          fill_timestamp: string | null
          id: string
          pnl_usd: number | null
          quantity: number
          signal_id: string | null
          slippage_ticks: number | null
          status: string
          stop_loss_price: number | null
          take_profit_price: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          algorithm_id?: string | null
          broker_order_id?: string | null
          broker_position_id?: string | null
          close_reason?: string | null
          cme_account_id: string
          commission_usd?: number | null
          connection_id?: string | null
          contract: string
          created_at?: string
          direction: string
          entry_price?: number | null
          exit_price?: number | null
          fill_price?: number | null
          fill_timestamp?: string | null
          id?: string
          pnl_usd?: number | null
          quantity?: number
          signal_id?: string | null
          slippage_ticks?: number | null
          status?: string
          stop_loss_price?: number | null
          take_profit_price?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          algorithm_id?: string | null
          broker_order_id?: string | null
          broker_position_id?: string | null
          close_reason?: string | null
          cme_account_id?: string
          commission_usd?: number | null
          connection_id?: string | null
          contract?: string
          created_at?: string
          direction?: string
          entry_price?: number | null
          exit_price?: number | null
          fill_price?: number | null
          fill_timestamp?: string | null
          id?: string
          pnl_usd?: number | null
          quantity?: number
          signal_id?: string | null
          slippage_ticks?: number | null
          status?: string
          stop_loss_price?: number | null
          take_profit_price?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cme_trades_real_algorithm_id_fkey"
            columns: ["algorithm_id"]
            isOneToOne: false
            referencedRelation: "algorithms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_trades_real_cme_account_id_fkey"
            columns: ["cme_account_id"]
            isOneToOne: false
            referencedRelation: "algo_cme_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_trades_real_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "cme_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      coinarb_50x_validation_checkpoints: {
        Row: {
          agent_id: string
          checkpoint_day: number
          decision: string
          executed_at: string
          id: string
          metrics_json: Json
          recommendation: string | null
          validation_passed: boolean
        }
        Insert: {
          agent_id: string
          checkpoint_day: number
          decision: string
          executed_at?: string
          id?: string
          metrics_json: Json
          recommendation?: string | null
          validation_passed: boolean
        }
        Update: {
          agent_id?: string
          checkpoint_day?: number
          decision?: string
          executed_at?: string
          id?: string
          metrics_json?: Json
          recommendation?: string | null
          validation_passed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "coinarb_50x_validation_checkpoints_agent_fk"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "coinarb_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      coinarb_agents: {
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
      coinarb_calibration: {
        Row: {
          agent_id: string
          brier_score: number
          closed_at: string
          created_at: string
          id: string
          outcome: number
          pnl_usd: number
          position_id: string | null
          predicted_confidence: number
          predicted_edge: number | null
          regime: string | null
          symbol: string
          tier: string | null
          user_id: string
          venue: string
        }
        Insert: {
          agent_id: string
          brier_score: number
          closed_at: string
          created_at?: string
          id?: string
          outcome: number
          pnl_usd: number
          position_id?: string | null
          predicted_confidence: number
          predicted_edge?: number | null
          regime?: string | null
          symbol: string
          tier?: string | null
          user_id: string
          venue: string
        }
        Update: {
          agent_id?: string
          brier_score?: number
          closed_at?: string
          created_at?: string
          id?: string
          outcome?: number
          pnl_usd?: number
          position_id?: string | null
          predicted_confidence?: number
          predicted_edge?: number | null
          regime?: string | null
          symbol?: string
          tier?: string | null
          user_id?: string
          venue?: string
        }
        Relationships: []
      }
      coinarb_calibration_data: {
        Row: {
          agent_id: string
          id: string
          prob_bucket: string
          symbol: string
          total: number
          updated_at: string
          user_id: string
          wins: number
        }
        Insert: {
          agent_id: string
          id?: string
          prob_bucket: string
          symbol: string
          total?: number
          updated_at?: string
          user_id: string
          wins?: number
        }
        Update: {
          agent_id?: string
          id?: string
          prob_bucket?: string
          symbol?: string
          total?: number
          updated_at?: string
          user_id?: string
          wins?: number
        }
        Relationships: []
      }
      coinarb_circuit_breaker_events: {
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
            foreignKeyName: "coinarb_circuit_breaker_events_agent_fk"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "coinarb_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      coinarb_compliance_audit: {
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
            foreignKeyName: "coinarb_compliance_audit_agent_fk"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "coinarb_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      coinarb_daily_stats: {
        Row: {
          agent_id: string
          best_trade_usd: number | null
          capital_end_usd: number | null
          capital_start_usd: number | null
          circuit_breaker_triggered: boolean
          consecutive_loss_max: number
          created_at: string
          day_utc: string
          fear_greed_avg: number | null
          id: string
          losses: number
          phase_end: string | null
          phase_start: string | null
          strategy_id: string
          total_pnl_usd: number
          total_trades: number
          updated_at: string
          user_id: string
          win_rate: number | null
          wins: number
          worst_trade_usd: number | null
        }
        Insert: {
          agent_id: string
          best_trade_usd?: number | null
          capital_end_usd?: number | null
          capital_start_usd?: number | null
          circuit_breaker_triggered?: boolean
          consecutive_loss_max?: number
          created_at?: string
          day_utc: string
          fear_greed_avg?: number | null
          id?: string
          losses?: number
          phase_end?: string | null
          phase_start?: string | null
          strategy_id?: string
          total_pnl_usd?: number
          total_trades?: number
          updated_at?: string
          user_id: string
          win_rate?: number | null
          wins?: number
          worst_trade_usd?: number | null
        }
        Update: {
          agent_id?: string
          best_trade_usd?: number | null
          capital_end_usd?: number | null
          capital_start_usd?: number | null
          circuit_breaker_triggered?: boolean
          consecutive_loss_max?: number
          created_at?: string
          day_utc?: string
          fear_greed_avg?: number | null
          id?: string
          losses?: number
          phase_end?: string | null
          phase_start?: string | null
          strategy_id?: string
          total_pnl_usd?: number
          total_trades?: number
          updated_at?: string
          user_id?: string
          win_rate?: number | null
          wins?: number
          worst_trade_usd?: number | null
        }
        Relationships: []
      }
      coinarb_decisions: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          kind: string
          meta: Json | null
          reason: string
          regime: string | null
          strategy_id: string
          symbol: string | null
          user_id: string
          venue: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          kind: string
          meta?: Json | null
          reason: string
          regime?: string | null
          strategy_id?: string
          symbol?: string | null
          user_id: string
          venue?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          kind?: string
          meta?: Json | null
          reason?: string
          regime?: string | null
          strategy_id?: string
          symbol?: string | null
          user_id?: string
          venue?: string | null
        }
        Relationships: []
      }
      coinarb_equity_snapshots: {
        Row: {
          agent_id: string
          archived_at: string | null
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
          archived_at?: string | null
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
          archived_at?: string | null
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
            foreignKeyName: "coinarb_equity_snapshots_agent_fk"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "coinarb_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      coinarb_liquidity_map: {
        Row: {
          agent_id: string
          created_at: string
          detected_at: string
          id: string
          meta: Json | null
          price_bottom: number
          price_top: number
          swept_at: string | null
          symbol: string
          timeframe: string
          user_id: string
          zone_type: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          detected_at?: string
          id?: string
          meta?: Json | null
          price_bottom: number
          price_top: number
          swept_at?: string | null
          symbol: string
          timeframe: string
          user_id: string
          zone_type: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          detected_at?: string
          id?: string
          meta?: Json | null
          price_bottom?: number
          price_top?: number
          swept_at?: string | null
          symbol?: string
          timeframe?: string
          user_id?: string
          zone_type?: string
        }
        Relationships: []
      }
      coinarb_phase_log: {
        Row: {
          agent_id: string
          capital_at_change: number
          changed_at: string
          created_at: string
          from_phase: string | null
          from_risk_pct: number | null
          id: string
          reason: string | null
          strategy_id: string
          to_phase: string
          to_risk_pct: number
          user_id: string
        }
        Insert: {
          agent_id: string
          capital_at_change: number
          changed_at?: string
          created_at?: string
          from_phase?: string | null
          from_risk_pct?: number | null
          id?: string
          reason?: string | null
          strategy_id?: string
          to_phase: string
          to_risk_pct: number
          user_id: string
        }
        Update: {
          agent_id?: string
          capital_at_change?: number
          changed_at?: string
          created_at?: string
          from_phase?: string | null
          from_risk_pct?: number | null
          id?: string
          reason?: string | null
          strategy_id?: string
          to_phase?: string
          to_risk_pct?: number
          user_id?: string
        }
        Relationships: []
      }
      coinarb_positions: {
        Row: {
          agent_id: string
          arb_gap_pct: number | null
          base_qty: number | null
          closed_at: string | null
          created_at: string
          deleted_at: string | null
          direction: string
          entry_price: number | null
          entry_reason: Json | null
          exit_price: number | null
          exit_reason: string | null
          fear_greed_at_entry: number | null
          id: string
          opened_at: string | null
          phase_at_entry: string | null
          pnl_percent: number | null
          pnl_usd: number | null
          regime: string | null
          side: string
          size_usd: number | null
          smc_zone_price: number | null
          smc_zone_type: string | null
          status: string
          stop_loss_price: number | null
          strategy_id: string
          symbol: string
          take_profit_price: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_id: string
          arb_gap_pct?: number | null
          base_qty?: number | null
          closed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          direction?: string
          entry_price?: number | null
          entry_reason?: Json | null
          exit_price?: number | null
          exit_reason?: string | null
          fear_greed_at_entry?: number | null
          id?: string
          opened_at?: string | null
          phase_at_entry?: string | null
          pnl_percent?: number | null
          pnl_usd?: number | null
          regime?: string | null
          side: string
          size_usd?: number | null
          smc_zone_price?: number | null
          smc_zone_type?: string | null
          status?: string
          stop_loss_price?: number | null
          strategy_id?: string
          symbol?: string
          take_profit_price?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_id?: string
          arb_gap_pct?: number | null
          base_qty?: number | null
          closed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          direction?: string
          entry_price?: number | null
          entry_reason?: Json | null
          exit_price?: number | null
          exit_reason?: string | null
          fear_greed_at_entry?: number | null
          id?: string
          opened_at?: string | null
          phase_at_entry?: string | null
          pnl_percent?: number | null
          pnl_usd?: number | null
          regime?: string | null
          side?: string
          size_usd?: number | null
          smc_zone_price?: number | null
          smc_zone_type?: string | null
          status?: string
          stop_loss_price?: number | null
          strategy_id?: string
          symbol?: string
          take_profit_price?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coinarb_positions_agent_fk"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "coinarb_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      coinarb_regime_snapshots: {
        Row: {
          agent_id: string
          agent_multiplier: number
          captured_at: string
          consistency_score: number | null
          id: string
          is_transition: boolean
          previous_regime: string | null
          regime: string
          trend: string | null
          trend_strength: number | null
          user_id: string
          volatility_pct: number | null
        }
        Insert: {
          agent_id: string
          agent_multiplier: number
          captured_at?: string
          consistency_score?: number | null
          id?: string
          is_transition?: boolean
          previous_regime?: string | null
          regime: string
          trend?: string | null
          trend_strength?: number | null
          user_id: string
          volatility_pct?: number | null
        }
        Update: {
          agent_id?: string
          agent_multiplier?: number
          captured_at?: string
          consistency_score?: number | null
          id?: string
          is_transition?: boolean
          previous_regime?: string | null
          regime?: string
          trend?: string | null
          trend_strength?: number | null
          user_id?: string
          volatility_pct?: number | null
        }
        Relationships: []
      }
      coinarb_signal_memory: {
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
      coinarb_smc_signals: {
        Row: {
          agent_id: string
          created_at: string
          detected_at: string
          direction: string | null
          id: string
          invalidated_at: string | null
          meta: Json | null
          price: number | null
          signal_type: string
          strategy_id: string
          strength: number | null
          symbol: string
          timeframe: string
          user_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          detected_at?: string
          direction?: string | null
          id?: string
          invalidated_at?: string | null
          meta?: Json | null
          price?: number | null
          signal_type: string
          strategy_id?: string
          strength?: number | null
          symbol: string
          timeframe: string
          user_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          detected_at?: string
          direction?: string | null
          id?: string
          invalidated_at?: string | null
          meta?: Json | null
          price?: number | null
          signal_type?: string
          strategy_id?: string
          strength?: number | null
          symbol?: string
          timeframe?: string
          user_id?: string
        }
        Relationships: []
      }
      coinarb_telemetry: {
        Row: {
          agent_id: string
          available_balance_usd: number | null
          btc_spot_price: number | null
          capital_current: number | null
          consecutive_losses: number | null
          consecutive_wins: number | null
          created_at: string
          daily_losses: number | null
          daily_trades_count: number | null
          daily_wins: number | null
          equity_usd: number | null
          error_count_1h: number | null
          fear_greed_index: number | null
          id: string
          last_heartbeat_at: string
          last_signal: Json | null
          loop_latency_ms: number | null
          max_drawdown_pct: number | null
          open_positions_count: number | null
          paused_until: string | null
          payload: Json | null
          phase_current: string | null
          profit_factor: number | null
          regime: string | null
          risk_pct_current: number | null
          sharpe_ratio: number | null
          smc_bias: Json | null
          strategy_id: string
          total_pnl_usd: number | null
          updated_at: string
          user_id: string
          win_rate: number | null
          ws_binance_connected: boolean | null
          ws_binance_connected_spot: boolean | null
          ws_coinbase_connected: boolean | null
        }
        Insert: {
          agent_id: string
          available_balance_usd?: number | null
          btc_spot_price?: number | null
          capital_current?: number | null
          consecutive_losses?: number | null
          consecutive_wins?: number | null
          created_at?: string
          daily_losses?: number | null
          daily_trades_count?: number | null
          daily_wins?: number | null
          equity_usd?: number | null
          error_count_1h?: number | null
          fear_greed_index?: number | null
          id?: string
          last_heartbeat_at?: string
          last_signal?: Json | null
          loop_latency_ms?: number | null
          max_drawdown_pct?: number | null
          open_positions_count?: number | null
          paused_until?: string | null
          payload?: Json | null
          phase_current?: string | null
          profit_factor?: number | null
          regime?: string | null
          risk_pct_current?: number | null
          sharpe_ratio?: number | null
          smc_bias?: Json | null
          strategy_id?: string
          total_pnl_usd?: number | null
          updated_at?: string
          user_id: string
          win_rate?: number | null
          ws_binance_connected?: boolean | null
          ws_binance_connected_spot?: boolean | null
          ws_coinbase_connected?: boolean | null
        }
        Update: {
          agent_id?: string
          available_balance_usd?: number | null
          btc_spot_price?: number | null
          capital_current?: number | null
          consecutive_losses?: number | null
          consecutive_wins?: number | null
          created_at?: string
          daily_losses?: number | null
          daily_trades_count?: number | null
          daily_wins?: number | null
          equity_usd?: number | null
          error_count_1h?: number | null
          fear_greed_index?: number | null
          id?: string
          last_heartbeat_at?: string
          last_signal?: Json | null
          loop_latency_ms?: number | null
          max_drawdown_pct?: number | null
          open_positions_count?: number | null
          paused_until?: string | null
          payload?: Json | null
          phase_current?: string | null
          profit_factor?: number | null
          regime?: string | null
          risk_pct_current?: number | null
          sharpe_ratio?: number | null
          smc_bias?: Json | null
          strategy_id?: string
          total_pnl_usd?: number | null
          updated_at?: string
          user_id?: string
          win_rate?: number | null
          ws_binance_connected?: boolean | null
          ws_binance_connected_spot?: boolean | null
          ws_coinbase_connected?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "coinarb_telemetry_agent_fk"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "coinarb_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      coinarb_trades: {
        Row: {
          agent_id: string
          archived_at: string | null
          created_at: string
          direction: string | null
          executed_at: string
          execution_latency_ms: number | null
          fee_rate_bps: number | null
          fee_usd: number | null
          id: string
          order_id: string | null
          pnl_usd: number | null
          position_id: string | null
          price: number
          raw_response: Json | null
          regime: string | null
          side: string
          size: number
          size_usd: number | null
          slippage_bps: number | null
          status: string
          strategy_id: string
          symbol: string | null
          trade_type: string
          user_id: string
        }
        Insert: {
          agent_id: string
          archived_at?: string | null
          created_at?: string
          direction?: string | null
          executed_at?: string
          execution_latency_ms?: number | null
          fee_rate_bps?: number | null
          fee_usd?: number | null
          id?: string
          order_id?: string | null
          pnl_usd?: number | null
          position_id?: string | null
          price: number
          raw_response?: Json | null
          regime?: string | null
          side: string
          size: number
          size_usd?: number | null
          slippage_bps?: number | null
          status?: string
          strategy_id?: string
          symbol?: string | null
          trade_type?: string
          user_id: string
        }
        Update: {
          agent_id?: string
          archived_at?: string | null
          created_at?: string
          direction?: string | null
          executed_at?: string
          execution_latency_ms?: number | null
          fee_rate_bps?: number | null
          fee_usd?: number | null
          id?: string
          order_id?: string | null
          pnl_usd?: number | null
          position_id?: string | null
          price?: number
          raw_response?: Json | null
          regime?: string | null
          side?: string
          size?: number
          size_usd?: number | null
          slippage_bps?: number | null
          status?: string
          strategy_id?: string
          symbol?: string | null
          trade_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coinarb_trades_agent_fk"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "coinarb_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coinarb_trades_position_fk"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "coinarb_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      copy_group_events: {
        Row: {
          actor_id: string | null
          copy_group_id: string
          created_at: string
          event_type: string
          id: string
          payload_json: Json | null
        }
        Insert: {
          actor_id?: string | null
          copy_group_id: string
          created_at?: string
          event_type: string
          id?: string
          payload_json?: Json | null
        }
        Update: {
          actor_id?: string | null
          copy_group_id?: string
          created_at?: string
          event_type?: string
          id?: string
          payload_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "copy_group_events_copy_group_id_fkey"
            columns: ["copy_group_id"]
            isOneToOne: false
            referencedRelation: "copy_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      copy_group_experiments: {
        Row: {
          copy_group_id: string
          created_at: string
          flags_json: Json
          id: string
          updated_at: string
        }
        Insert: {
          copy_group_id: string
          created_at?: string
          flags_json?: Json
          id?: string
          updated_at?: string
        }
        Update: {
          copy_group_id?: string
          created_at?: string
          flags_json?: Json
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "copy_group_experiments_copy_group_id_fkey"
            columns: ["copy_group_id"]
            isOneToOne: false
            referencedRelation: "copy_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      copy_group_links: {
        Row: {
          child_account_id: string
          copy_group_id: string
          copy_multiplier: number
          created_at: string
          id: string
          link_type: string
          parent_account_id: string
        }
        Insert: {
          child_account_id: string
          copy_group_id: string
          copy_multiplier?: number
          created_at?: string
          id?: string
          link_type?: string
          parent_account_id: string
        }
        Update: {
          child_account_id?: string
          copy_group_id?: string
          copy_multiplier?: number
          created_at?: string
          id?: string
          link_type?: string
          parent_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "copy_group_links_child_account_id_fkey"
            columns: ["child_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copy_group_links_copy_group_id_fkey"
            columns: ["copy_group_id"]
            isOneToOne: false
            referencedRelation: "copy_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copy_group_links_parent_account_id_fkey"
            columns: ["parent_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      copy_group_nodes: {
        Row: {
          account_id: string
          copy_group_id: string
          created_at: string
          id: string
          risk_node: Json | null
          risk_pct: number
          role: string
          sort_index: number
          status: string
          updated_at: string
        }
        Insert: {
          account_id: string
          copy_group_id: string
          created_at?: string
          id?: string
          risk_node?: Json | null
          risk_pct?: number
          role: string
          sort_index?: number
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          copy_group_id?: string
          created_at?: string
          id?: string
          risk_node?: Json | null
          risk_pct?: number
          role?: string
          sort_index?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "copy_group_nodes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copy_group_nodes_copy_group_id_fkey"
            columns: ["copy_group_id"]
            isOneToOne: false
            referencedRelation: "copy_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      copy_group_snapshots: {
        Row: {
          checksum: string
          copy_group_id: string
          created_at: string
          id: string
          snapshot_json: Json
          version_int: number
        }
        Insert: {
          checksum: string
          copy_group_id: string
          created_at?: string
          id?: string
          snapshot_json: Json
          version_int: number
        }
        Update: {
          checksum?: string
          copy_group_id?: string
          created_at?: string
          id?: string
          snapshot_json?: Json
          version_int?: number
        }
        Relationships: [
          {
            foreignKeyName: "copy_group_snapshots_copy_group_id_fkey"
            columns: ["copy_group_id"]
            isOneToOne: false
            referencedRelation: "copy_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      copy_group_versions: {
        Row: {
          copy_group_id: string
          created_at: string
          created_by: string | null
          id: string
          message: string | null
          version_int: number
        }
        Insert: {
          copy_group_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string | null
          version_int: number
        }
        Update: {
          copy_group_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string | null
          version_int?: number
        }
        Relationships: [
          {
            foreignKeyName: "copy_group_versions_copy_group_id_fkey"
            columns: ["copy_group_id"]
            isOneToOne: false
            referencedRelation: "copy_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      copy_groups: {
        Row: {
          active_version: number
          created_at: string
          id: string
          name: string
          owner_id: string
          sync_mode: string
          updated_at: string
        }
        Insert: {
          active_version?: number
          created_at?: string
          id?: string
          name: string
          owner_id: string
          sync_mode?: string
          updated_at?: string
        }
        Update: {
          active_version?: number
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          sync_mode?: string
          updated_at?: string
        }
        Relationships: []
      }
      engine_backtest_runs: {
        Row: {
          advanced: Json | null
          algorithm_id: string
          bars_loaded: Json
          baseline_metrics: Json
          created_at: string
          duration_ms: number | null
          equity_curve: Json
          final_balance: number | null
          id: string
          monte_carlo: Json | null
          params: Json
          range_from: string
          range_to: string
          symbol: string
          total_trades: number | null
          user_id: string
          walk_forward: Json | null
        }
        Insert: {
          advanced?: Json | null
          algorithm_id: string
          bars_loaded?: Json
          baseline_metrics?: Json
          created_at?: string
          duration_ms?: number | null
          equity_curve?: Json
          final_balance?: number | null
          id?: string
          monte_carlo?: Json | null
          params?: Json
          range_from: string
          range_to: string
          symbol: string
          total_trades?: number | null
          user_id: string
          walk_forward?: Json | null
        }
        Update: {
          advanced?: Json | null
          algorithm_id?: string
          bars_loaded?: Json
          baseline_metrics?: Json
          created_at?: string
          duration_ms?: number | null
          equity_curve?: Json
          final_balance?: number | null
          id?: string
          monte_carlo?: Json | null
          params?: Json
          range_from?: string
          range_to?: string
          symbol?: string
          total_trades?: number | null
          user_id?: string
          walk_forward?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "engine_backtest_runs_algorithm_id_fkey"
            columns: ["algorithm_id"]
            isOneToOne: false
            referencedRelation: "algorithms"
            referencedColumns: ["id"]
          },
        ]
      }
      global_trading_halt: {
        Row: {
          halted: boolean
          halted_at: string | null
          halted_by: string | null
          reason: string | null
          resumed_at: string | null
          resumed_by: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          halted?: boolean
          halted_at?: string | null
          halted_by?: string | null
          reason?: string | null
          resumed_at?: string | null
          resumed_by?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          halted?: boolean
          halted_at?: string | null
          halted_by?: string | null
          reason?: string | null
          resumed_at?: string | null
          resumed_by?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      historical_bars: {
        Row: {
          close: number
          created_at: string
          high: number
          id: number
          low: number
          open: number
          source: string
          spread: number | null
          symbol: string
          timeframe: string
          ts: string
          uploaded_by: string | null
          volume: number
        }
        Insert: {
          close: number
          created_at?: string
          high: number
          id?: number
          low: number
          open: number
          source: string
          spread?: number | null
          symbol: string
          timeframe: string
          ts: string
          uploaded_by?: string | null
          volume?: number
        }
        Update: {
          close?: number
          created_at?: string
          high?: number
          id?: number
          low?: number
          open?: number
          source?: string
          spread?: number | null
          symbol?: string
          timeframe?: string
          ts?: string
          uploaded_by?: string | null
          volume?: number
        }
        Relationships: []
      }
      historical_bars_coverage: {
        Row: {
          bar_count: number
          last_ingest_at: string
          range_end: string
          range_start: string
          source: string
          symbol: string
          timeframe: string
        }
        Insert: {
          bar_count: number
          last_ingest_at?: string
          range_end: string
          range_start: string
          source: string
          symbol: string
          timeframe: string
        }
        Update: {
          bar_count?: number
          last_ingest_at?: string
          range_end?: string
          range_start?: string
          source?: string
          symbol?: string
          timeframe?: string
        }
        Relationships: []
      }
      instruments: {
        Row: {
          category: string
          created_at: string
          display_name: string
          id: string
          market_type: string
          sort_index: number
          symbol: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          display_name: string
          id?: string
          market_type?: string
          sort_index?: number
          symbol: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          display_name?: string
          id?: string
          market_type?: string
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
      map_hot_goal_links: {
        Row: {
          algorithm_id: string
          created_at: string
          goal_id: string
          id: string
          user_id: string
        }
        Insert: {
          algorithm_id: string
          created_at?: string
          goal_id: string
          id?: string
          user_id: string
        }
        Update: {
          algorithm_id?: string
          created_at?: string
          goal_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "map_hot_goal_links_algorithm_id_fkey"
            columns: ["algorithm_id"]
            isOneToOne: false
            referencedRelation: "algorithms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "map_hot_goal_links_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "map_hot_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      map_hot_goal_snapshots: {
        Row: {
          created_at: string
          current_value: number
          goal_id: string
          id: string
          recorded_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_value: number
          goal_id: string
          id?: string
          recorded_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_value?: number
          goal_id?: string
          id?: string
          recorded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "map_hot_goal_snapshots_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "map_hot_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      map_hot_goals: {
        Row: {
          created_at: string
          current_value: number
          deleted_at: string | null
          due_date: string | null
          id: string
          name: string
          sort_index: number
          status: string
          target_value: number
          timeframe: string
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_value?: number
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          name: string
          sort_index?: number
          status?: string
          target_value: number
          timeframe: string
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_value?: number
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          name?: string
          sort_index?: number
          status?: string
          target_value?: number
          timeframe?: string
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      map_hot_milestones: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          label: string
          quarter: string
          sort_index: number
          status: string
          target_amount: number
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          label: string
          quarter: string
          sort_index?: number
          status?: string
          target_amount: number
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          label?: string
          quarter?: string
          sort_index?: number
          status?: string
          target_amount?: number
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      ml_models: {
        Row: {
          algorithm_id: string | null
          created_at: string
          feature_names: string[]
          id: string
          kind: string
          symbol: string | null
          timeframe: string | null
          train_acc: number | null
          trained_at: string
          user_id: string
          valid_acc: number | null
          weights: Json
        }
        Insert: {
          algorithm_id?: string | null
          created_at?: string
          feature_names?: string[]
          id?: string
          kind: string
          symbol?: string | null
          timeframe?: string | null
          train_acc?: number | null
          trained_at?: string
          user_id: string
          valid_acc?: number | null
          weights: Json
        }
        Update: {
          algorithm_id?: string | null
          created_at?: string
          feature_names?: string[]
          id?: string
          kind?: string
          symbol?: string | null
          timeframe?: string | null
          train_acc?: number | null
          trained_at?: string
          user_id?: string
          valid_acc?: number | null
          weights?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ml_models_algorithm_id_fkey"
            columns: ["algorithm_id"]
            isOneToOne: false
            referencedRelation: "algorithms"
            referencedColumns: ["id"]
          },
        ]
      }
      ops_alert_history: {
        Row: {
          created_at: string
          id: string
          job_name: string
          message: string
          metadata: Json
          severity: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_name: string
          message: string
          metadata?: Json
          severity: string
        }
        Update: {
          created_at?: string
          id?: string
          job_name?: string
          message?: string
          metadata?: Json
          severity?: string
        }
        Relationships: []
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
      polyarb_50x_validation_checkpoints: {
        Row: {
          agent_id: string
          checkpoint_day: number
          decision: string
          executed_at: string
          id: string
          metrics_json: Json
          recommendation: string | null
          validation_passed: boolean
        }
        Insert: {
          agent_id: string
          checkpoint_day: number
          decision: string
          executed_at?: string
          id?: string
          metrics_json: Json
          recommendation?: string | null
          validation_passed: boolean
        }
        Update: {
          agent_id?: string
          checkpoint_day?: number
          decision?: string
          executed_at?: string
          id?: string
          metrics_json?: Json
          recommendation?: string | null
          validation_passed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "polyarb_50x_validation_checkpoints_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "polyarb_agents"
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
      polyarb_calibration_data: {
        Row: {
          agent_id: string
          id: string
          prob_bucket: string
          symbol: string
          total: number
          updated_at: string
          user_id: string
          wins: number
        }
        Insert: {
          agent_id: string
          id?: string
          prob_bucket: string
          symbol: string
          total?: number
          updated_at?: string
          user_id: string
          wins?: number
        }
        Update: {
          agent_id?: string
          id?: string
          prob_bucket?: string
          symbol?: string
          total?: number
          updated_at?: string
          user_id?: string
          wins?: number
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
      polyarb_decisions: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          kind: string
          meta: Json | null
          reason: string
          symbol: string | null
          user_id: string
          venue: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          kind: string
          meta?: Json | null
          reason: string
          symbol?: string | null
          user_id: string
          venue?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          kind?: string
          meta?: Json | null
          reason?: string
          symbol?: string | null
          user_id?: string
          venue?: string | null
        }
        Relationships: []
      }
      polyarb_equity_snapshots: {
        Row: {
          agent_id: string
          archived_at: string | null
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
          archived_at?: string | null
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
          archived_at?: string | null
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
      polyarb_event_log: {
        Row: {
          agent_id: string
          created_at: string
          detected_at: string
          event_type: string
          id: string
          metadata: Json | null
          severity: number
          ttl_ms: number
          user_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          detected_at: string
          event_type: string
          id?: string
          metadata?: Json | null
          severity: number
          ttl_ms: number
          user_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          detected_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          severity?: number
          ttl_ms?: number
          user_id?: string
        }
        Relationships: []
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
          market_question: string | null
          market_slug: string
          opened_at: string | null
          outcome: string
          pnl_percent: number | null
          pnl_usd: number | null
          redeemed: boolean
          redeemed_at: string | null
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
          market_question?: string | null
          market_slug: string
          opened_at?: string | null
          outcome: string
          pnl_percent?: number | null
          pnl_usd?: number | null
          redeemed?: boolean
          redeemed_at?: string | null
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
          market_question?: string | null
          market_slug?: string
          opened_at?: string | null
          outcome?: string
          pnl_percent?: number | null
          pnl_usd?: number | null
          redeemed?: boolean
          redeemed_at?: string | null
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
          event_state: Json | null
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
          event_state?: Json | null
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
          event_state?: Json | null
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
          archived_at: string | null
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
          pnl_usd: number | null
          position_id: string | null
          price: number
          raw_response: Json | null
          side: string
          size: number
          size_usd: number | null
          slippage_bps: number | null
          status: string
          trade_type: string
          user_id: string
        }
        Insert: {
          agent_id: string
          archived_at?: string | null
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
          pnl_usd?: number | null
          position_id?: string | null
          price: number
          raw_response?: Json | null
          side: string
          size: number
          size_usd?: number | null
          slippage_bps?: number | null
          status?: string
          trade_type?: string
          user_id: string
        }
        Update: {
          agent_id?: string
          archived_at?: string | null
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
          pnl_usd?: number | null
          position_id?: string | null
          price?: number
          raw_response?: Json | null
          side?: string
          size?: number
          size_usd?: number | null
          slippage_bps?: number | null
          status?: string
          trade_type?: string
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
      portfolio_allocations: {
        Row: {
          algorithm_id: string
          created_at: string
          daily_return_stdev: number | null
          id: string
          is_current: boolean
          lookback_days: number
          run_at: string
          user_id: string
          weight: number
        }
        Insert: {
          algorithm_id: string
          created_at?: string
          daily_return_stdev?: number | null
          id?: string
          is_current?: boolean
          lookback_days: number
          run_at?: string
          user_id: string
          weight: number
        }
        Update: {
          algorithm_id?: string
          created_at?: string
          daily_return_stdev?: number | null
          id?: string
          is_current?: boolean
          lookback_days?: number
          run_at?: string
          user_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_allocations_algorithm_id_fkey"
            columns: ["algorithm_id"]
            isOneToOne: false
            referencedRelation: "algorithms"
            referencedColumns: ["id"]
          },
        ]
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
      replication_jobs: {
        Row: {
          attempts: number
          copy_group_id: string
          created_at: string
          id: string
          last_error: string | null
          master_trade_id: string
          scheduled_at: string
          slave_account_id: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          copy_group_id: string
          created_at?: string
          id?: string
          last_error?: string | null
          master_trade_id: string
          scheduled_at?: string
          slave_account_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          copy_group_id?: string
          created_at?: string
          id?: string
          last_error?: string | null
          master_trade_id?: string
          scheduled_at?: string
          slave_account_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "replication_jobs_copy_group_id_fkey"
            columns: ["copy_group_id"]
            isOneToOne: false
            referencedRelation: "copy_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replication_jobs_master_trade_id_fkey"
            columns: ["master_trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replication_jobs_slave_account_id_fkey"
            columns: ["slave_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
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
      securities_exam_results: {
        Row: {
          answers: Json
          attempt_no: number
          id: string
          passed: boolean | null
          score: number
          section: string | null
          taken_at: string
          total: number
          user_id: string
        }
        Insert: {
          answers?: Json
          attempt_no: number
          id?: string
          passed?: boolean | null
          score: number
          section?: string | null
          taken_at?: string
          total: number
          user_id: string
        }
        Update: {
          answers?: Json
          attempt_no?: number
          id?: string
          passed?: boolean | null
          score?: number
          section?: string | null
          taken_at?: string
          total?: number
          user_id?: string
        }
        Relationships: []
      }
      securities_homework_submissions: {
        Row: {
          content: string | null
          created_at: string
          deleted_at: string | null
          graded_at: string | null
          homework_id: number
          id: string
          points: number | null
          status: string
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          graded_at?: string | null
          homework_id: number
          id?: string
          points?: number | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          graded_at?: string | null
          homework_id?: number
          id?: string
          points?: number | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      securities_library_uploads: {
        Row: {
          author: string | null
          category: string | null
          created_at: string
          deleted_at: string | null
          id: string
          level: string
          mime_type: string | null
          notes: string | null
          size_bytes: number | null
          storage_path: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          author?: string | null
          category?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          level?: string
          mime_type?: string | null
          notes?: string | null
          size_bytes?: number | null
          storage_path: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          author?: string | null
          category?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          level?: string
          mime_type?: string | null
          notes?: string | null
          size_bytes?: number | null
          storage_path?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      securities_progress: {
        Row: {
          completed_levels: string[]
          created_at: string
          id: string
          module_id: number
          research_done: boolean
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_levels?: string[]
          created_at?: string
          id?: string
          module_id: number
          research_done?: boolean
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_levels?: string[]
          created_at?: string
          id?: string
          module_id?: number
          research_done?: boolean
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      securities_quiz_results: {
        Row: {
          answers: Json
          id: string
          lesson_id: number
          level: string
          score: number
          taken_at: string
          total: number
          user_id: string
        }
        Insert: {
          answers?: Json
          id?: string
          lesson_id: number
          level?: string
          score: number
          taken_at?: string
          total: number
          user_id: string
        }
        Update: {
          answers?: Json
          id?: string
          lesson_id?: number
          level?: string
          score?: number
          taken_at?: string
          total?: number
          user_id?: string
        }
        Relationships: []
      }
      securities_user_state: {
        Row: {
          daily_goal: number
          gating: string
          last_notified_on: string | null
          milestone_snapshot: Json | null
          notify_streak: boolean
          placement_done: boolean
          specialization: string | null
          srs: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          daily_goal?: number
          gating?: string
          last_notified_on?: string | null
          milestone_snapshot?: Json | null
          notify_streak?: boolean
          placement_done?: boolean
          specialization?: string | null
          srs?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          daily_goal?: number
          gating?: string
          last_notified_on?: string | null
          milestone_snapshot?: Json | null
          notify_streak?: boolean
          placement_done?: boolean
          specialization?: string | null
          srs?: Json
          updated_at?: string
          user_id?: string
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
      slave_trade_links: {
        Row: {
          id: string
          last_error: string | null
          master_trade_id: string
          slave_account_id: string
          slave_trade_id: string
          status: string
          updated_at: string
        }
        Insert: {
          id?: string
          last_error?: string | null
          master_trade_id: string
          slave_account_id: string
          slave_trade_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          id?: string
          last_error?: string | null
          master_trade_id?: string
          slave_account_id?: string
          slave_trade_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "slave_trade_links_master_trade_id_fkey"
            columns: ["master_trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slave_trade_links_slave_account_id_fkey"
            columns: ["slave_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slave_trade_links_slave_trade_id_fkey"
            columns: ["slave_trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
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
      terminal_assistant_memory: {
        Row: {
          asset: string | null
          content: string
          created_at: string
          id: string
          importance_score: number
          last_accessed_at: string
          memory_type: string
          source_session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          asset?: string | null
          content: string
          created_at?: string
          id?: string
          importance_score?: number
          last_accessed_at?: string
          memory_type: string
          source_session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          asset?: string | null
          content?: string
          created_at?: string
          id?: string
          importance_score?: number
          last_accessed_at?: string
          memory_type?: string
          source_session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "terminal_assistant_memory_source_session_id_fkey"
            columns: ["source_session_id"]
            isOneToOne: false
            referencedRelation: "terminal_chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      terminal_assistant_settings: {
        Row: {
          assistant_name: string
          default_asset: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assistant_name?: string
          default_asset?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assistant_name?: string
          default_asset?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      terminal_chat_messages: {
        Row: {
          content: string
          context_snapshot: Json | null
          created_at: string
          id: string
          image_path: string | null
          rating: number | null
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          context_snapshot?: Json | null
          created_at?: string
          id?: string
          image_path?: string | null
          rating?: number | null
          role: string
          session_id: string
          user_id: string
        }
        Update: {
          content?: string
          context_snapshot?: Json | null
          created_at?: string
          id?: string
          image_path?: string | null
          rating?: number | null
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "terminal_chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "terminal_chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      terminal_chat_sessions: {
        Row: {
          asset: string
          created_at: string
          deleted_at: string | null
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          asset?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          asset?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          title?: string
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
      trade_replication_map: {
        Row: {
          copy_group_id: string
          created_at: string
          id: string
          master_account_id: string
          master_trade_id: string
        }
        Insert: {
          copy_group_id: string
          created_at?: string
          id?: string
          master_account_id: string
          master_trade_id: string
        }
        Update: {
          copy_group_id?: string
          created_at?: string
          id?: string
          master_account_id?: string
          master_trade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_replication_map_copy_group_id_fkey"
            columns: ["copy_group_id"]
            isOneToOne: false
            referencedRelation: "copy_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_replication_map_master_account_id_fkey"
            columns: ["master_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_replication_map_master_trade_id_fkey"
            columns: ["master_trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
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
      trading_algorithms: {
        Row: {
          algo_type: string
          created_at: string
          deleted_at: string | null
          description: string | null
          engine_config: Json | null
          id: string
          name: string
          parameters: Json
          platform: string
          slot_number: number
          sort_index: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          algo_type: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          engine_config?: Json | null
          id?: string
          name: string
          parameters?: Json
          platform: string
          slot_number: number
          sort_index?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          algo_type?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          engine_config?: Json | null
          id?: string
          name?: string
          parameters?: Json
          platform?: string
          slot_number?: number
          sort_index?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      algorithm_quality_score: {
        Row: {
          algorithm_id: string | null
          gates_passed: number | null
          gates_total: number | null
          last_computed_at: string | null
          must_failed: number | null
          should_failed: number | null
          tier: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "algorithm_quality_gate_results_algorithm_id_fkey"
            columns: ["algorithm_id"]
            isOneToOne: false
            referencedRelation: "algorithms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      activate_app_update: { Args: { p_update_id: string }; Returns: undefined }
      copy_group_apply_snapshot: {
        Args: { p_copy_group_id: string; p_snapshot: Json }
        Returns: undefined
      }
      copy_group_get_solid_descendants: {
        Args: { p_copy_group_id: string; p_root_account_id: string }
        Returns: {
          account_id: string
          depth: number
          multiplier_path: number
          parent_account_id: string
        }[]
      }
      copy_group_would_create_cycle: {
        Args: {
          p_child_account_id: string
          p_copy_group_id: string
          p_parent_account_id: string
        }
        Returns: boolean
      }
      force_app_refresh: { Args: { reason?: string }; Returns: undefined }
      get_user_audit_logs: {
        Args: {
          p_action?: string
          p_limit?: number
          p_offset?: number
          p_resource_type?: string
        }
        Returns: {
          action: string
          changes: Json
          created_at: string
          id: string
          resource_id: string
          resource_type: string
          status: string
        }[]
      }
      increment_api_rate_limit: {
        Args: { p_key: string; p_window_start: string }
        Returns: number
      }
      log_audit_event: {
        Args: {
          p_action: string
          p_changes?: Json
          p_error_message?: string
          p_ip_hint?: string
          p_resource_id?: string
          p_resource_type: string
          p_status?: string
          p_user_agent_hash?: string
          p_user_id: string
        }
        Returns: string
      }
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
