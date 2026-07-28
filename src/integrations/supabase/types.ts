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
  public: {
    Tables: {
      caidas: {
        Row: {
          circunstancia: string | null
          created_at: string
          fecha: string
          golpe_craneal: boolean
          hospitalizacion: boolean
          id: string
          lesion: string | null
          lugar: string | null
          owner_id: string
          patient_id: string
        }
        Insert: {
          circunstancia?: string | null
          created_at?: string
          fecha?: string
          golpe_craneal?: boolean
          hospitalizacion?: boolean
          id?: string
          lesion?: string | null
          lugar?: string | null
          owner_id: string
          patient_id: string
        }
        Update: {
          circunstancia?: string | null
          created_at?: string
          fecha?: string
          golpe_craneal?: boolean
          hospitalizacion?: boolean
          id?: string
          lesion?: string | null
          lugar?: string | null
          owner_id?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "caidas_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      chequeos_diarios: {
        Row: {
          color: string | null
          created_at: string
          fecha: string
          id: string
          ieg: number | null
          owner_id: string
          patient_id: string
          respuestas: Json
        }
        Insert: {
          color?: string | null
          created_at?: string
          fecha?: string
          id?: string
          ieg?: number | null
          owner_id: string
          patient_id: string
          respuestas?: Json
        }
        Update: {
          color?: string | null
          created_at?: string
          fecha?: string
          id?: string
          ieg?: number | null
          owner_id?: string
          patient_id?: string
          respuestas?: Json
        }
        Relationships: [
          {
            foreignKeyName: "chequeos_diarios_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluaciones_escala: {
        Row: {
          created_at: string
          fecha: string
          id: string
          owner_id: string
          patient_id: string
          puntaje: number
          respuestas: Json
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fecha?: string
          id?: string
          owner_id: string
          patient_id: string
          puntaje: number
          respuestas?: Json
          tipo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fecha?: string
          id?: string
          owner_id?: string
          patient_id?: string
          puntaje?: number
          respuestas?: Json
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluaciones_escala_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      medicamento_horarios: {
        Row: {
          activo: boolean
          created_at: string
          hora: string
          id: string
          medicamento_id: string
          owner_id: string
          patient_id: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          hora: string
          id?: string
          medicamento_id: string
          owner_id: string
          patient_id: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          hora?: string
          id?: string
          medicamento_id?: string
          owner_id?: string
          patient_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medicamento_horarios_medicamento_id_fkey"
            columns: ["medicamento_id"]
            isOneToOne: false
            referencedRelation: "medicamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicamento_horarios_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      medicamento_tomas: {
        Row: {
          created_at: string
          estado: string
          fecha: string
          id: string
          medicamento_id: string
          nota: string | null
          owner_id: string
          patient_id: string
        }
        Insert: {
          created_at?: string
          estado: string
          fecha?: string
          id?: string
          medicamento_id: string
          nota?: string | null
          owner_id: string
          patient_id: string
        }
        Update: {
          created_at?: string
          estado?: string
          fecha?: string
          id?: string
          medicamento_id?: string
          nota?: string | null
          owner_id?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medicamento_tomas_medicamento_id_fkey"
            columns: ["medicamento_id"]
            isOneToOne: false
            referencedRelation: "medicamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicamento_tomas_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      medicamentos: {
        Row: {
          activo: boolean
          created_at: string
          dosis: string | null
          fecha_inicio: string | null
          frecuencia: string | null
          id: string
          nombre: string
          owner_id: string
          patient_id: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          dosis?: string | null
          fecha_inicio?: string | null
          frecuencia?: string | null
          id?: string
          nombre: string
          owner_id: string
          patient_id: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          dosis?: string | null
          fecha_inicio?: string | null
          frecuencia?: string | null
          id?: string
          nombre?: string
          owner_id?: string
          patient_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medicamentos_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          barthel_total: number | null
          caidas_12m: boolean | null
          cfs_nivel: number | null
          cognicion_basal: Json | null
          comorbilidades: Json | null
          created_at: string
          edad: number | null
          escolaridad: string | null
          horas_acompanado: number | null
          id: string
          jenkins_basal: number | null
          lawton_total: number | null
          miedo_caer: boolean | null
          movilidad: string | null
          nombre: string
          objetivos: Json | null
          owner_id: string
          peso: number | null
          sexo: string | null
          sueno_despertares: number | null
          sueno_hipnoticos: boolean | null
          sueno_horas: number | null
          talla: number | null
          tipo_cuidador: string | null
          updated_at: string
          valoracion_completa: boolean
          vive_solo: boolean | null
          zarit_basal: number | null
        }
        Insert: {
          barthel_total?: number | null
          caidas_12m?: boolean | null
          cfs_nivel?: number | null
          cognicion_basal?: Json | null
          comorbilidades?: Json | null
          created_at?: string
          edad?: number | null
          escolaridad?: string | null
          horas_acompanado?: number | null
          id?: string
          jenkins_basal?: number | null
          lawton_total?: number | null
          miedo_caer?: boolean | null
          movilidad?: string | null
          nombre: string
          objetivos?: Json | null
          owner_id: string
          peso?: number | null
          sexo?: string | null
          sueno_despertares?: number | null
          sueno_hipnoticos?: boolean | null
          sueno_horas?: number | null
          talla?: number | null
          tipo_cuidador?: string | null
          updated_at?: string
          valoracion_completa?: boolean
          vive_solo?: boolean | null
          zarit_basal?: number | null
        }
        Update: {
          barthel_total?: number | null
          caidas_12m?: boolean | null
          cfs_nivel?: number | null
          cognicion_basal?: Json | null
          comorbilidades?: Json | null
          created_at?: string
          edad?: number | null
          escolaridad?: string | null
          horas_acompanado?: number | null
          id?: string
          jenkins_basal?: number | null
          lawton_total?: number | null
          miedo_caer?: boolean | null
          movilidad?: string | null
          nombre?: string
          objetivos?: Json | null
          owner_id?: string
          peso?: number | null
          sexo?: string | null
          sueno_despertares?: number | null
          sueno_hipnoticos?: boolean | null
          sueno_horas?: number | null
          talla?: number | null
          tipo_cuidador?: string | null
          updated_at?: string
          valoracion_completa?: boolean
          vive_solo?: boolean | null
          zarit_basal?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      profundizaciones_clinicas: {
        Row: {
          chequeo_id: string | null
          created_at: string
          dominio_principal: string | null
          dominios: Json
          fecha: string
          id: string
          nivel_deterioro: string | null
          owner_id: string
          patient_id: string
          respuestas: Json
          resumen: string | null
          updated_at: string
        }
        Insert: {
          chequeo_id?: string | null
          created_at?: string
          dominio_principal?: string | null
          dominios?: Json
          fecha?: string
          id?: string
          nivel_deterioro?: string | null
          owner_id: string
          patient_id: string
          respuestas?: Json
          resumen?: string | null
          updated_at?: string
        }
        Update: {
          chequeo_id?: string | null
          created_at?: string
          dominio_principal?: string | null
          dominios?: Json
          fecha?: string
          id?: string
          nivel_deterioro?: string | null
          owner_id?: string
          patient_id?: string
          respuestas?: Json
          resumen?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profundizaciones_clinicas_chequeo_id_fkey"
            columns: ["chequeo_id"]
            isOneToOne: false
            referencedRelation: "chequeos_diarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profundizaciones_clinicas_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          owner_id: string
          p256dh: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          owner_id: string
          p256dh: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          owner_id?: string
          p256dh?: string
        }
        Relationships: []
      }
      recordatorio_envios: {
        Row: {
          created_at: string
          fecha: string
          hora: string
          horario_id: string
          id: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          fecha: string
          hora: string
          horario_id: string
          id?: string
          owner_id: string
        }
        Update: {
          created_at?: string
          fecha?: string
          hora?: string
          horario_id?: string
          id?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recordatorio_envios_horario_id_fkey"
            columns: ["horario_id"]
            isOneToOne: false
            referencedRelation: "medicamento_horarios"
            referencedColumns: ["id"]
          },
        ]
      }
      signos_vitales: {
        Row: {
          created_at: string
          fc: number | null
          fecha: string
          glucosa: number | null
          id: string
          owner_id: string
          patient_id: string
          saturacion: number | null
          ta_diastolica: number | null
          ta_sistolica: number | null
          temperatura: number | null
        }
        Insert: {
          created_at?: string
          fc?: number | null
          fecha?: string
          glucosa?: number | null
          id?: string
          owner_id: string
          patient_id: string
          saturacion?: number | null
          ta_diastolica?: number | null
          ta_sistolica?: number | null
          temperatura?: number | null
        }
        Update: {
          created_at?: string
          fc?: number | null
          fecha?: string
          glucosa?: number | null
          id?: string
          owner_id?: string
          patient_id?: string
          saturacion?: number | null
          ta_diastolica?: number | null
          ta_sistolica?: number | null
          temperatura?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "signos_vitales_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
