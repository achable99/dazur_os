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
    PostgrestVersion: "14.5"
  }
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
      cash_flow_entries: {
        Row: {
          amount: number
          category: string | null
          concept: string
          created_at: string
          date: string
          id: string
          notes: string | null
          origin: string
          origin_id: string | null
          type: string
        }
        Insert: {
          amount: number
          category?: string | null
          concept: string
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          origin?: string
          origin_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          category?: string | null
          concept?: string
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          origin?: string
          origin_id?: string | null
          type?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          codigo_postal: string
          created_at: string
          email: string | null
          id: string
          nombre_comercial: string | null
          razon_social: string
          regimen_fiscal: string
          rfc: string
          telefono: string | null
          tipo_persona: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          codigo_postal: string
          created_at?: string
          email?: string | null
          id?: string
          nombre_comercial?: string | null
          razon_social: string
          regimen_fiscal: string
          rfc: string
          telefono?: string | null
          tipo_persona: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          codigo_postal?: string
          created_at?: string
          email?: string | null
          id?: string
          nombre_comercial?: string | null
          razon_social?: string
          regimen_fiscal?: string
          rfc?: string
          telefono?: string | null
          tipo_persona?: string
          updated_at?: string
        }
        Relationships: []
      }
      credit_lines: {
        Row: {
          created_at: string
          id: string
          interest_rate: number
          name: string
          num_payments: number
          payment_day: number
          payment_type: string
          rate_type: string
          start_date: string
          total_amount: number
          type: string
          used_amount: number
        }
        Insert: {
          created_at?: string
          id?: string
          interest_rate: number
          name: string
          num_payments: number
          payment_day: number
          payment_type: string
          rate_type: string
          start_date: string
          total_amount: number
          type: string
          used_amount?: number
        }
        Update: {
          created_at?: string
          id?: string
          interest_rate?: number
          name?: string
          num_payments?: number
          payment_day?: number
          payment_type?: string
          rate_type?: string
          start_date?: string
          total_amount?: number
          type?: string
          used_amount?: number
        }
        Relationships: []
      }
      credit_payments: {
        Row: {
          created_at: string
          credit_line_id: string
          due_date: string
          id: string
          interest: number
          paid_date: string | null
          payment_number: number
          principal: number
          status: string
          total: number
        }
        Insert: {
          created_at?: string
          credit_line_id: string
          due_date: string
          id?: string
          interest: number
          paid_date?: string | null
          payment_number: number
          principal: number
          status?: string
          total: number
        }
        Update: {
          created_at?: string
          credit_line_id?: string
          due_date?: string
          id?: string
          interest?: number
          paid_date?: string | null
          payment_number?: number
          principal?: number
          status?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_payments_credit_line_id_fkey"
            columns: ["credit_line_id"]
            isOneToOne: false
            referencedRelation: "credit_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_invoices: {
        Row: {
          category: string
          concept: string
          created_at: string
          date: string
          folio_fiscal: string
          id: string
          iva: number
          month: number
          no_deducible: boolean
          notes: string | null
          subtotal: number
          total: number
          year: number
        }
        Insert: {
          category: string
          concept: string
          created_at?: string
          date: string
          folio_fiscal: string
          id?: string
          iva?: number
          month: number
          no_deducible?: boolean
          notes?: string | null
          subtotal: number
          total: number
          year: number
        }
        Update: {
          category?: string
          concept?: string
          created_at?: string
          date?: string
          folio_fiscal?: string
          id?: string
          iva?: number
          month?: number
          no_deducible?: boolean
          notes?: string | null
          subtotal?: number
          total?: number
          year?: number
        }
        Relationships: []
      }
      fiscal_carryovers: {
        Row: {
          created_at: string
          from_month: number
          from_year: number
          id: string
          isr_amount: number
          iva_amount: number
          iva_favor_amount: number
          iva_pending_amount: number
          to_month: number
          to_year: number
        }
        Insert: {
          created_at?: string
          from_month: number
          from_year: number
          id?: string
          isr_amount?: number
          iva_amount?: number
          iva_favor_amount?: number
          iva_pending_amount?: number
          to_month: number
          to_year: number
        }
        Update: {
          created_at?: string
          from_month?: number
          from_year?: number
          id?: string
          isr_amount?: number
          iva_amount?: number
          iva_favor_amount?: number
          iva_pending_amount?: number
          to_month?: number
          to_year?: number
        }
        Relationships: []
      }
      fiscal_period_adjustments: {
        Row: {
          created_at: string
          id: string
          iva_acreditable_adjustment: number
          month: number
          note: string | null
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          iva_acreditable_adjustment?: number
          month: number
          note?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          iva_acreditable_adjustment?: number
          month?: number
          note?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      income_invoices: {
        Row: {
          client_id: string
          collected_date: string | null
          created_at: string
          date: string
          folio_fiscal: string
          id: string
          invoice_type: string
          is_collected: boolean
          isr: number
          iva: number
          month: number
          notes: string | null
          paid_amount: number
          subtotal: number
          total: number
          year: number
        }
        Insert: {
          client_id: string
          collected_date?: string | null
          created_at?: string
          date: string
          folio_fiscal: string
          id?: string
          invoice_type: string
          is_collected?: boolean
          isr: number
          iva: number
          month: number
          notes?: string | null
          paid_amount?: number
          subtotal: number
          total: number
          year: number
        }
        Update: {
          client_id?: string
          collected_date?: string | null
          created_at?: string
          date?: string
          folio_fiscal?: string
          id?: string
          invoice_type?: string
          is_collected?: boolean
          isr?: number
          iva?: number
          month?: number
          notes?: string | null
          paid_amount?: number
          subtotal?: number
          total?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "income_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      opening_balances: {
        Row: {
          amount: number
          created_at: string
          id: string
          is_manual_override: boolean
          month: number
          year: number
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          is_manual_override?: boolean
          month: number
          year: number
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          is_manual_override?: boolean
          month?: number
          year?: number
        }
        Relationships: []
      }
      payment_complement_allocations: {
        Row: {
          amount: number
          complement_id: string
          created_at: string
          id: string
          invoice_id: string
        }
        Insert: {
          amount: number
          complement_id: string
          created_at?: string
          id?: string
          invoice_id: string
        }
        Update: {
          amount?: number
          complement_id?: string
          created_at?: string
          id?: string
          invoice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_complement_allocations_complement_id_fkey"
            columns: ["complement_id"]
            isOneToOne: false
            referencedRelation: "payment_complements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_complement_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "income_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_complements: {
        Row: {
          client_id: string
          created_at: string
          date: string
          folio_fiscal: string
          id: string
          month: number
          notes: string | null
          payment_method: string | null
          total: number
          traceability_only: boolean
          updated_at: string
          year: number
        }
        Insert: {
          client_id: string
          created_at?: string
          date: string
          folio_fiscal: string
          id?: string
          month: number
          notes?: string | null
          payment_method?: string | null
          total: number
          traceability_only?: boolean
          updated_at?: string
          year: number
        }
        Update: {
          client_id?: string
          created_at?: string
          date?: string
          folio_fiscal?: string
          id?: string
          month?: number
          notes?: string | null
          payment_method?: string | null
          total?: number
          traceability_only?: boolean
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "payment_complements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          created_at: string
          description: string
          id: string
          line_total: number
          position: number
          quantity: number
          quote_id: string
          unit: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          line_total?: number
          position?: number
          quantity?: number
          quote_id: string
          unit?: string | null
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          line_total?: number
          position?: number
          quantity?: number
          quote_id?: string
          unit?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          apply_isr: boolean
          apply_iva: boolean
          city: string
          client_id: string | null
          created_at: string
          currency_note: string | null
          date: string
          delivery_time: string | null
          id: string
          isr: number
          iva: number
          notes: string | null
          number: number
          payment_terms: string | null
          show_client: boolean
          subtotal: number
          total: number
          updated_at: string
          validity: string | null
        }
        Insert: {
          apply_isr?: boolean
          apply_iva?: boolean
          city?: string
          client_id?: string | null
          created_at?: string
          currency_note?: string | null
          date: string
          delivery_time?: string | null
          id?: string
          isr?: number
          iva?: number
          notes?: string | null
          number?: number
          payment_terms?: string | null
          show_client?: boolean
          subtotal?: number
          total?: number
          updated_at?: string
          validity?: string | null
        }
        Update: {
          apply_isr?: boolean
          apply_iva?: boolean
          city?: string
          client_id?: string | null
          created_at?: string
          currency_note?: string | null
          date?: string
          delivery_time?: string | null
          id?: string
          isr?: number
          iva?: number
          notes?: string | null
          number?: number
          payment_terms?: string | null
          show_client?: boolean
          subtotal?: number
          total?: number
          updated_at?: string
          validity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_payment_complement: {
        Args: { _complement_id: string }
        Returns: undefined
      }
      collect_invoice: {
        Args: { _collected_date: string; _invoice_id: string }
        Returns: undefined
      }
      mark_credit_payment_paid: {
        Args: { _paid_date: string; _payment_id: string }
        Returns: undefined
      }
      revert_payment_complement: {
        Args: { _complement_id: string }
        Returns: undefined
      }
      uncollect_invoice: { Args: { _invoice_id: string }; Returns: undefined }
      unmark_credit_payment_paid: {
        Args: { _payment_id: string }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
