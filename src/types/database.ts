/**
 * Tipos do banco de dados Supabase.
 *
 * TODO: substituir por tipos gerados automaticamente assim que houver um
 * projeto Supabase real conectado:
 *
 *   npx supabase gen types typescript --project-id <id> --schema public > src/types/database.ts
 *
 * Até lá, este arquivo é mantido manualmente e cobre apenas as tabelas
 * usadas pela Fase 0/1 (identidade e multi-tenancy). Novas tabelas das
 * próximas fases devem ser adicionadas aqui (ou o arquivo inteiro
 * regenerado) antes de serem consumidas pelo app.
 */

export type OrgRole = "owner" | "admin" | "manager" | "member" | "viewer";
export type MemberStatus = "invited" | "active" | "suspended";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          timezone: string;
          settings: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          timezone?: string;
          settings?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["organizations"]["Insert"]>;
        Relationships: [];
      };
      organization_members: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: OrgRole;
          status: MemberStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role?: OrgRole;
          status?: MemberStatus;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["organization_members"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      pipeline_stages: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          color: string;
          position: number;
          is_closed: boolean;
          result_type: "won" | "lost" | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          color?: string;
          position: number;
          is_closed?: boolean;
          result_type?: "won" | "lost" | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["pipeline_stages"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_org_member: {
        Args: { target_org: string };
        Returns: boolean;
      };
      has_org_role: {
        Args: { target_org: string; allowed_roles: OrgRole[] };
        Returns: boolean;
      };
      can_edit_org: {
        Args: { target_org: string };
        Returns: boolean;
      };
      can_admin_org: {
        Args: { target_org: string };
        Returns: boolean;
      };
      create_organization_with_defaults: {
        Args: { org_name: string; org_slug: string };
        Returns: string;
      };
    };
    Enums: {
      org_role: OrgRole;
    };
  };
}
