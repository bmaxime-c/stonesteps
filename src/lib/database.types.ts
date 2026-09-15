export type Json =
  string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5'
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
      exercises: {
        Row: {
          created_at: string
          id: string
          muscle_group: Database['public']['Enums']['muscle_group']
          name: string
          owner_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          muscle_group: Database['public']['Enums']['muscle_group']
          name: string
          owner_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          muscle_group?: Database['public']['Enums']['muscle_group']
          name?: string
          owner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'exercises_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      grid_followers: {
        Row: {
          created_at: string
          frozen_at_version: number | null
          grid_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          frozen_at_version?: number | null
          grid_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          frozen_at_version?: number | null
          grid_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'grid_followers_grid_id_fkey'
            columns: ['grid_id']
            isOneToOne: false
            referencedRelation: 'grids'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'grid_followers_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      grid_versions: {
        Row: {
          accent_color: string
          created_at: string
          grid_id: string
          id: string
          name: string
          published_at: string | null
          rest_seconds: number
          status: Database['public']['Enums']['grid_version_status']
          unchanged_prefix: number
          updated_at: string
          version: number
        }
        Insert: {
          accent_color?: string
          created_at?: string
          grid_id: string
          id?: string
          name: string
          published_at?: string | null
          rest_seconds?: number
          status?: Database['public']['Enums']['grid_version_status']
          unchanged_prefix?: number
          updated_at?: string
          version: number
        }
        Update: {
          accent_color?: string
          created_at?: string
          grid_id?: string
          id?: string
          name?: string
          published_at?: string | null
          rest_seconds?: number
          status?: Database['public']['Enums']['grid_version_status']
          unchanged_prefix?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: 'grid_versions_grid_id_fkey'
            columns: ['grid_id']
            isOneToOne: false
            referencedRelation: 'grids'
            referencedColumns: ['id']
          },
        ]
      }
      grids: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_public: boolean
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_public?: boolean
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_public?: boolean
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'grids_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      level_exercises: {
        Row: {
          exercise_id: string
          id: string
          level_id: string
          position: number
        }
        Insert: {
          exercise_id: string
          id?: string
          level_id: string
          position: number
        }
        Update: {
          exercise_id?: string
          id?: string
          level_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: 'level_exercises_exercise_id_fkey'
            columns: ['exercise_id']
            isOneToOne: false
            referencedRelation: 'exercises'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'level_exercises_level_id_fkey'
            columns: ['level_id']
            isOneToOne: false
            referencedRelation: 'levels'
            referencedColumns: ['id']
          },
        ]
      }
      level_sets: {
        Row: {
          id: string
          level_exercise_id: string
          position: number
          target_reps: number
          timer_mode: Database['public']['Enums']['timer_mode']
          timer_seconds: number | null
        }
        Insert: {
          id?: string
          level_exercise_id: string
          position: number
          target_reps?: number
          timer_mode?: Database['public']['Enums']['timer_mode']
          timer_seconds?: number | null
        }
        Update: {
          id?: string
          level_exercise_id?: string
          position?: number
          target_reps?: number
          timer_mode?: Database['public']['Enums']['timer_mode']
          timer_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'level_sets_level_exercise_id_fkey'
            columns: ['level_exercise_id']
            isOneToOne: false
            referencedRelation: 'level_exercises'
            referencedColumns: ['id']
          },
        ]
      }
      levels: {
        Row: {
          grid_version_id: string
          id: string
          position: number
        }
        Insert: {
          grid_version_id: string
          id?: string
          position: number
        }
        Update: {
          grid_version_id?: string
          id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: 'levels_grid_version_id_fkey'
            columns: ['grid_version_id']
            isOneToOne: false
            referencedRelation: 'grid_versions'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          timer_blink: boolean
          timer_flash: boolean
          timer_sound: boolean
          timer_warning_percent: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          timer_blink?: boolean
          timer_flash?: boolean
          timer_sound?: boolean
          timer_warning_percent?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          timer_blink?: boolean
          timer_flash?: boolean
          timer_sound?: boolean
          timer_warning_percent?: number
          updated_at?: string
        }
        Relationships: []
      }
      session_sets: {
        Row: {
          actual_value: number
          exercise_name: string
          id: string
          level_set_id: string | null
          session_id: string
          set_index: number
          set_label: string
          status: Database['public']['Enums']['set_status']
          target_value: number
          unit: string
        }
        Insert: {
          actual_value: number
          exercise_name: string
          id?: string
          level_set_id?: string | null
          session_id: string
          set_index: number
          set_label: string
          status: Database['public']['Enums']['set_status']
          target_value: number
          unit: string
        }
        Update: {
          actual_value?: number
          exercise_name?: string
          id?: string
          level_set_id?: string | null
          session_id?: string
          set_index?: number
          set_label?: string
          status?: Database['public']['Enums']['set_status']
          target_value?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: 'session_sets_level_set_id_fkey'
            columns: ['level_set_id']
            isOneToOne: false
            referencedRelation: 'level_sets'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'session_sets_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'sessions'
            referencedColumns: ['id']
          },
        ]
      }
      sessions: {
        Row: {
          completed_at: string | null
          grid_id: string | null
          grid_name: string
          grid_version: number
          id: string
          level_id: string | null
          level_number: number
          owner_id: string
          started_at: string
          validated: boolean
        }
        Insert: {
          completed_at?: string | null
          grid_id?: string | null
          grid_name: string
          grid_version?: number
          id?: string
          level_id?: string | null
          level_number: number
          owner_id: string
          started_at?: string
          validated?: boolean
        }
        Update: {
          completed_at?: string | null
          grid_id?: string | null
          grid_name?: string
          grid_version?: number
          id?: string
          level_id?: string | null
          level_number?: number
          owner_id?: string
          started_at?: string
          validated?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'sessions_grid_id_fkey'
            columns: ['grid_id']
            isOneToOne: false
            referencedRelation: 'grids'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sessions_level_id_fkey'
            columns: ['level_id']
            isOneToOne: false
            referencedRelation: 'levels'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sessions_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_read_grid: { Args: { g: string }; Returns: boolean }
      can_read_grid_version: { Args: { v: string }; Returns: boolean }
      can_read_level: { Args: { l: string }; Returns: boolean }
      can_read_level_exercise: { Args: { le: string }; Returns: boolean }
      owns_grid: { Args: { g: string }; Returns: boolean }
      owns_grid_version: { Args: { v: string }; Returns: boolean }
      owns_level: { Args: { l: string }; Returns: boolean }
      owns_level_exercise: { Args: { le: string }; Returns: boolean }
      owns_session: { Args: { s: string }; Returns: boolean }
      shares_a_grid_with_me: { Args: { p: string }; Returns: boolean }
    }
    Enums: {
      grid_version_status: 'draft' | 'published'
      muscle_group: 'push' | 'pull' | 'legs' | 'core'
      set_status: 'success' | 'surpass' | 'fail'
      timer_mode: 'none' | 'minimal' | 'strict'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      grid_version_status: ['draft', 'published'],
      muscle_group: ['push', 'pull', 'legs', 'core'],
      set_status: ['success', 'surpass', 'fail'],
      timer_mode: ['none', 'minimal', 'strict'],
    },
  },
} as const
