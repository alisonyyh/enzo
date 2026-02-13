// Database types matching our Supabase schema
// These provide type safety for all database queries

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          display_name?: string | null;
          avatar_url?: string | null;
        };
      };
      puppies: {
        Row: {
          id: string;
          name: string;
          breed: string;
          age_months: number;
          age_weeks: number;
          weight_value: number | null;
          weight_unit: string;
          living_situation: string;
          photo_url: string | null;
          questionnaire_data: QuestionnaireJson | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          breed: string;
          age_months: number;
          age_weeks: number;
          weight_value?: number | null;
          weight_unit?: string;
          living_situation: string;
          photo_url?: string | null;
          questionnaire_data?: QuestionnaireJson | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          breed?: string;
          age_months?: number;
          age_weeks?: number;
          weight_value?: number | null;
          weight_unit?: string;
          living_situation?: string;
          photo_url?: string | null;
          questionnaire_data?: QuestionnaireJson | null;
        };
      };
      puppy_memberships: {
        Row: {
          id: string;
          puppy_id: string;
          user_id: string;
          role: 'owner' | 'caretaker';
          status: 'active' | 'removed';
          joined_at: string;
        };
        Insert: {
          id?: string;
          puppy_id: string;
          user_id: string;
          role: 'owner' | 'caretaker';
          status?: 'active' | 'removed';
          joined_at?: string;
        };
        Update: {
          role?: 'owner' | 'caretaker';
          status?: 'active' | 'removed';
        };
      };
      routines: {
        Row: {
          id: string;
          puppy_id: string;
          generated_at: string;
          source: string;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          puppy_id: string;
          generated_at?: string;
          source?: string;
          is_active?: boolean;
        };
        Update: {
          source?: string;
          is_active?: boolean;
        };
      };
      routine_items: {
        Row: {
          id: string;
          routine_id: string;
          activity_type: string;
          title: string;
          description: string | null;
          scheduled_time: string;
          duration_minutes: number | null;
          sort_order: number | null;
          is_enabled: boolean;
        };
        Insert: {
          id?: string;
          routine_id: string;
          activity_type: string;
          title: string;
          description?: string | null;
          scheduled_time: string;
          duration_minutes?: number | null;
          sort_order?: number | null;
          is_enabled?: boolean;
        };
        Update: {
          activity_type?: string;
          title?: string;
          description?: string | null;
          scheduled_time?: string;
          duration_minutes?: number | null;
          sort_order?: number | null;
          is_enabled?: boolean;
        };
      };
      activity_logs: {
        Row: {
          id: string;
          routine_item_id: string;
          puppy_id: string;
          date: string;
          status: 'completed' | 'missed' | 'skipped';
          completed_by: string | null;
          completed_at: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          routine_item_id: string;
          puppy_id: string;
          date: string;
          status: 'completed' | 'missed' | 'skipped';
          completed_by?: string | null;
          completed_at?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          status?: 'completed' | 'missed' | 'skipped';
          completed_by?: string | null;
          completed_at?: string | null;
          note?: string | null;
        };
      };
      invites: {
        Row: {
          id: string;
          puppy_id: string;
          invited_by: string;
          invite_token: string;
          status: 'pending' | 'accepted' | 'expired' | 'revoked';
          accepted_by: string | null;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          puppy_id: string;
          invited_by: string;
          invite_token: string;
          status?: 'pending' | 'accepted' | 'expired' | 'revoked';
          accepted_by?: string | null;
          expires_at: string;
          created_at?: string;
        };
        Update: {
          status?: 'pending' | 'accepted' | 'expired' | 'revoked';
          accepted_by?: string | null;
        };
      };
    };
  };
};

// Convenience types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Puppy = Database['public']['Tables']['puppies']['Row'];
export type PuppyMembership = Database['public']['Tables']['puppy_memberships']['Row'];
export type Routine = Database['public']['Tables']['routines']['Row'];
export type RoutineItem = Database['public']['Tables']['routine_items']['Row'];
export type ActivityLog = Database['public']['Tables']['activity_logs']['Row'];
export type Invite = Database['public']['Tables']['invites']['Row'];

// Questionnaire data stored as JSONB
export interface QuestionnaireJson {
  workArrangement: string;
  wakeUpTime: string;
  bedTime: string;
}
